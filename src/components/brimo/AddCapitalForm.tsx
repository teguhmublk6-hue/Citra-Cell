
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import type { KasAccount } from '@/lib/data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

const numberPreprocessor = (val: unknown) => (val === "" || val === undefined || val === null) ? undefined : Number(String(val).replace(/[^0-9]/g, ""));

const formSchema = z.object({
  destinationAccountId: z.string().min(1, 'Akun tujuan harus dipilih'),
  amount: z.preprocess(
    numberPreprocessor,
    z.number({ invalid_type_error: "Jumlah harus angka" }).positive('Jumlah harus lebih dari 0')
  ),
  description: z.string().optional(),
});

interface AddCapitalFormProps {
  onDone: () => void;
}

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

export default function AddCapitalForm({ onDone }: AddCapitalFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const kasAccountsCollection = useMemoFirebase(() => {
    return collection(firestore, 'kasAccounts');
  }, [firestore]);

  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      destinationAccountId: '',
      amount: undefined,
      description: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!firestore || !kasAccounts) {
        toast({ variant: "destructive", title: "Gagal", description: "Database tidak tersedia." });
        return;
    }

    const destinationAccount = kasAccounts.find(acc => acc.id === values.destinationAccountId);

    if (!destinationAccount) {
      toast({ variant: "destructive", title: "Gagal", description: "Akun tujuan tidak ditemukan." });
      return;
    }
    
    try {
        const batch = writeBatch(firestore);

        const destinationDocRef = doc(firestore, 'kasAccounts', destinationAccount.id);
        const destinationTransactionRef = doc(collection(destinationDocRef, 'transactions'));
        const now = new Date().toISOString();

        batch.update(destinationDocRef, { balance: destinationAccount.balance + values.amount });
        
        batch.set(destinationTransactionRef, {
            kasAccountId: destinationAccount.id,
            type: 'credit',
            name: values.description || 'Tambah Modal',
            account: 'Modal Eksternal',
            date: now,
            amount: values.amount,
            balanceBefore: destinationAccount.balance,
            balanceAfter: destinationAccount.balance + values.amount,
            category: 'capital'
        });
        
        await batch.commit();

        toast({ title: "Sukses", description: "Modal berhasil ditambahkan." });
        onDone();
    } catch (error) {
        console.error("Error adding capital: ", error);
        toast({ variant: "destructive", title: "Error", description: "Terjadi kesalahan saat menambah modal." });
    }
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex flex-col h-full">
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 pt-4 pb-6">
            <FormField
              control={form.control}
              name="destinationAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ke Akun</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih akun tujuan" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {kasAccounts?.map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jumlah</FormLabel>
                  <FormControl>
                      <Input
                      type="text"
                      placeholder="Rp 0"
                      {...field}
                      value={formatToRupiah(field.value)}
                      onChange={(e) => {
                          field.onChange(parseRupiah(e.target.value));
                      }}
                      />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Keterangan (Opsional)</FormLabel>
                  <FormControl>
                    <Input placeholder="cth: Modal dari bos" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </ScrollArea>
        <div className="flex gap-2 pt-0 pb-4 border-t border-border -mx-6 px-6 pt-4">
          <Button type="button" variant="outline" onClick={onDone} className="w-full">
            Batal
          </Button>
          <Button type="submit" className="w-full">
            Simpan
          </Button>
        </div>
      </form>
    </Form>
  );
}

    