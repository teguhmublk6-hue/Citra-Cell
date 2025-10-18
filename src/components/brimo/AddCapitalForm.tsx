
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore } from '@/firebase';
import { doc, writeBatch, collection } from 'firebase/firestore';
import type { KasAccount, Transaction } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';

const numberPreprocessor = (val: unknown) => (val === "" || val === undefined || val === null) ? undefined : Number(String(val).replace(/[^0-9]/g, ""));

const formSchema = z.object({
  accountId: z.string().min(1, 'Akun tujuan harus dipilih'),
  amount: z.preprocess(
    numberPreprocessor,
    z.number({ invalid_type_error: "Jumlah modal harus angka" }).positive('Jumlah modal harus lebih dari 0')
  ),
});

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

interface AddCapitalFormProps {
  accounts: KasAccount[];
  onDone: () => void;
}

export default function AddCapitalForm({ accounts, onDone }: AddCapitalFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      accountId: '',
      amount: undefined,
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!firestore) return;

    const targetAccount = accounts.find(acc => acc.id === values.accountId);
    if (!targetAccount) return;

    const batch = writeBatch(firestore);
    const amount = values.amount;
    const balanceBefore = targetAccount.balance;
    const balanceAfter = balanceBefore + amount;

    // 1. Update the account balance
    const accountRef = doc(firestore, 'kasAccounts', values.accountId);
    batch.update(accountRef, { balance: balanceAfter });
    
    // 2. Create a credit transaction
    const transactionRef = doc(collection(firestore, 'kasAccounts', values.accountId, 'transactions'));
    const newTransaction: Omit<Transaction, 'id' | 'userId'> = {
        kasAccountId: values.accountId,
        name: `Tambah modal ke: ${targetAccount.label}`,
        account: 'Setoran Modal',
        date: new Date().toISOString(),
        amount: amount,
        type: 'credit',
        category: 'capital',
        balanceBefore: balanceBefore,
        balanceAfter: balanceAfter,
    };
    batch.set(transactionRef, newTransaction);

    try {
        await batch.commit();
        toast({
            title: "Modal Ditambahkan",
            description: `Saldo ${targetAccount.label} bertambah sebesar ${formatToRupiah(values.amount)}.`
        });
        onDone();
    } catch (e) {
        console.error("Error adding capital: ", e);
        toast({
            variant: "destructive",
            title: "Gagal Menambah Modal",
            description: "Terjadi kesalahan saat memproses permintaan Anda."
        });
    }
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex flex-col h-full pt-4">
        <div className="flex-1 space-y-4">
            <FormField
            control={form.control}
            name="accountId"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Pilih Akun Kas</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                    <SelectTrigger>
                        <SelectValue placeholder="Pilih akun untuk ditambah modal..." />
                    </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                    {accounts.map(account => (
                        <SelectItem key={account.id} value={account.id}>{account.label}</SelectItem>
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
                <FormLabel>Jumlah Modal</FormLabel>
                <FormControl>
                    <Input 
                        type="text"
                        placeholder="Rp 0"
                        {...field}
                        value={formatToRupiah(field.value)}
                        onChange={(e) => {
                            field.onChange(parseRupiah(e.target.value));
                        }}
                        onBlur={(e) => {
                            const formatted = formatToRupiah(e.target.value);
                            e.target.value = formatted === "Rp 0" ? "" : formatted;
                            field.onBlur();
                        }}
                        onFocus={(e) => {
                            if (e.target.value === "Rp 0") {
                                e.target.value = "";
                            }
                        }}
                    />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
        <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onDone} className="w-full">
                Batal
            </Button>
            <Button type="submit" className="w-full">
                Tambah Modal
            </Button>
        </div>
      </form>
    </Form>
  );
}
