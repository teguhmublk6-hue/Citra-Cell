
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import type { KasAccount, Transaction } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, X } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '../ui/skeleton';

const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '') return '';
    const num = Number(String(value).replace(/[^0-9]/g, ''));
    if (isNaN(num)) return '';
    return `Rp ${num.toLocaleString('id-ID')}`;
};

const parseRupiah = (value: string | undefined | null): number => {
    if (!value) return 0;
    return Number(String(value).replace(/[^0-9]/g, ''));
}

const numberPreprocessor = (val: unknown) => (val === "" || val === undefined || val === null) ? undefined : Number(String(val).replace(/[^0-9]/g, ""));

const costFormSchema = z.object({
  sourceAccountId: z.string().min(1, 'Akun sumber harus dipilih'),
  name: z.string().min(1, 'Keterangan harus diisi'),
  amount: z.preprocess(
    numberPreprocessor,
    z.number({ invalid_type_error: "Nominal harus angka" }).positive('Nominal harus lebih dari 0')
  ),
});

interface OperationalCostReportProps {
  accounts: KasAccount[];
  onDone: () => void;
}

export default function OperationalCostReport({ accounts, onDone }: OperationalCostReportProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [operationalCosts, setOperationalCosts] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const form = useForm<z.infer<typeof costFormSchema>>({
    resolver: zodResolver(costFormSchema),
    defaultValues: {
      sourceAccountId: '',
      name: '',
      amount: undefined,
    },
  });

  useEffect(() => {
    const fetchOperationalCosts = async () => {
      if (!user?.uid || !accounts.length) {
        setIsLoading(false);
        return;
      };
      
      setIsLoading(true);
      let allCosts: Transaction[] = [];

      try {
        for (const account of accounts) {
          const transactionsRef = collection(firestore, 'users', user.uid, 'kasAccounts', account.id, 'transactions');
          const q = query(transactionsRef, where('category', '==', 'operational'));
          const querySnapshot = await getDocs(q);
          querySnapshot.forEach((doc) => {
            allCosts.push({ ...(doc.data() as Transaction), id: doc.id });
          });
        }
        allCosts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setOperationalCosts(allCosts);
      } catch (error) {
        console.error("Error fetching operational costs: ", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOperationalCosts();
  }, [user, firestore, accounts]);

  const handleAddCost = async (values: z.infer<typeof costFormSchema>) => {
    if (!user || !firestore) return;

    const sourceAccount = accounts.find(acc => acc.id === values.sourceAccountId);
    if (!sourceAccount) {
      console.error("Akun sumber tidak ditemukan.");
      return;
    }

    if (sourceAccount.balance < values.amount) {
        form.setError('amount', { message: 'Saldo akun sumber tidak mencukupi' });
        return;
    }
    
    const batch = writeBatch(firestore);

    // 1. Create new transaction for the operational cost
    const transactionRef = doc(collection(firestore, 'users', user.uid, 'kasAccounts', sourceAccount.id, 'transactions'));
    const newTransaction: Omit<Transaction, 'id'> = {
      userId: user.uid,
      kasAccountId: sourceAccount.id,
      name: values.name,
      account: 'Biaya Operasional',
      date: new Date().toISOString(),
      amount: values.amount,
      type: 'debit',
      category: 'operational',
    };
    batch.set(transactionRef, newTransaction);
    
    // 2. Update the balance of the source account
    const sourceAccountRef = doc(firestore, 'users', user.uid, 'kasAccounts', sourceAccount.id);
    const newBalance = sourceAccount.balance - values.amount;
    batch.update(sourceAccountRef, { balance: newBalance });

    try {
        await batch.commit();
        form.reset();
        setShowAddForm(false);
        // Manually add to local state to reflect update instantly
        setOperationalCosts(prev => [{...newTransaction, id: transactionRef.id}, ...prev]);
    } catch(e) {
        console.error("Gagal menambahkan biaya operasional", e)
    }
  };

  const totalOperationalCost = useMemo(() => {
    return operationalCosts.reduce((sum, cost) => sum + cost.amount, 0);
  }, [operationalCosts]);

  return (
    <div className="h-full flex flex-col pt-4">
      <div className="px-1 mb-4">
        <div className="flex justify-between items-center p-4 bg-red-500/10 text-red-700 dark:text-red-300 rounded-lg">
          <div>
            <p className="text-sm font-medium">Total Biaya Operasional</p>
            <p className="text-2xl font-bold">{formatToRupiah(totalOperationalCost)}</p>
          </div>
          <Button size="icon" className="bg-white/10 hover:bg-white/20 text-red-700 dark:text-red-300 rounded-full" onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? <X size={20} /> : <Plus size={20} />}
          </Button>
        </div>
      </div>

      {showAddForm && (
        <div className="px-1 mb-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddCost)} className="space-y-4 p-4 border rounded-lg">
               <FormField
                control={form.control}
                name="sourceAccountId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Ambil dari Akun Kas</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Pilih akun sumber biaya" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {accounts.map(account => (
                            <SelectItem key={account.id} value={account.id}>{account.label} ({formatToRupiah(account.balance) || 'Rp 0'})</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Keterangan Biaya</FormLabel>
                    <FormControl><Input placeholder="cth: Beli ATK" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nominal Biaya</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Rp 0"
                        {...field}
                        value={formatToRupiah(field.value)}
                        onChange={(e) => field.onChange(parseRupiah(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="w-full" onClick={() => setShowAddForm(false)}>Batal</Button>
                <Button type="submit" className="w-full">Simpan Biaya</Button>
              </div>
            </form>
          </Form>
        </div>
      )}

      <p className="px-1 text-sm font-semibold mb-2 text-muted-foreground">Rincian Biaya</p>
      <ScrollArea className="flex-1 px-1">
        {isLoading && (
            <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        )}
        {!isLoading && operationalCosts.length === 0 && (
            <div className="text-center py-10">
                <p className="text-muted-foreground">Belum ada biaya operasional.</p>
            </div>
        )}
        <div className="space-y-2">
          {operationalCosts.map((cost) => (
            <div key={cost.id} className="flex justify-between items-center p-3 bg-card-foreground/5 rounded-lg">
              <div>
                <p className="font-medium">{cost.name}</p>
                <p className="text-xs text-muted-foreground">{new Date(cost.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <p className="font-semibold text-red-500">{formatToRupiah(cost.amount)}</p>
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="mt-4 px-1">
        <Button variant="outline" className="w-full" onClick={onDone}>Tutup</Button>
      </div>
    </div>
  );
    
