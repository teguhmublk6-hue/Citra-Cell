
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { KasAccount } from '@/lib/data';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';

const numberPreprocessor = (val: unknown) => (val === "" || val === undefined || val === null) ? undefined : Number(String(val).replace(/[^0-9]/g, ""));

const formSchema = z.object({
  accountId: z.string().min(1, 'Akun tujuan harus dipilih'),
  amount: z.preprocess(
    numberPreprocessor,
    z.number({ invalid_type_error: "Jumlah modal harus angka" }).positive('Jumlah modal harus lebih dari 0')
  ),
});

const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined) return 'Rp 0';
    const num = Number(value);
    if (isNaN(num)) return 'Rp 0';
    return `Rp ${num.toLocaleString('id-ID')}`;
};

interface AddCapitalFormProps {
  accounts: KasAccount[];
  onDone: () => void;
}

export default function AddCapitalForm({ accounts, onDone }: AddCapitalFormProps) {
  const firestore = useFirestore();
  const { user } = useUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      accountId: '',
      amount: undefined,
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!user) return;

    const targetAccount = accounts.find(acc => acc.id === values.accountId);
    if (!targetAccount) return;

    const newBalance = targetAccount.balance + values.amount;
    
    const docRef = doc(firestore, 'users', user.uid, 'kasAccounts', values.accountId);
    updateDocumentNonBlocking(docRef, { balance: newBalance });
    
    onDone();
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
                        onFocus={(e) => {
                            if (e.target.value === 'Rp 0') e.target.value = '';
                        }}
                        onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9]/g, "");
                            field.onChange(Number(value));
                        }}
                        onBlur={(e) => {
                            e.target.value = formatToRupiah(field.value);
                        }}
                        defaultValue={formatToRupiah(field.value)}
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
