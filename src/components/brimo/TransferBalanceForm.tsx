
"use client";

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import type { KasAccount } from '@/lib/data';
import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const numberPreprocessor = (val: unknown) => (val === "" || val === undefined || val === null) ? undefined : Number(String(val).replace(/[^0-9]/g, ""));

const formSchema = z.object({
  sourceAccountId: z.string().min(1, 'Akun sumber harus dipilih'),
  destinationAccountId: z.string().min(1, 'Akun tujuan harus dipilih'),
  amount: z.preprocess(
    numberPreprocessor,
    z.number({ invalid_type_error: "Jumlah harus angka" }).positive('Jumlah harus lebih dari 0')
  ),
  adminFee: z.preprocess(
    (val) => Number(val),
    z.number().min(0, "Biaya admin tidak boleh negatif")
  ),
  manualAdminFee: z.number({ invalid_type_error: "Nominal harus angka" }).min(0, "Biaya admin tidak boleh negatif").optional(),
  description: z.string().optional(),
}).refine(data => data.sourceAccountId !== data.destinationAccountId, {
  message: "Akun sumber dan tujuan tidak boleh sama",
  path: ["destinationAccountId"],
});

interface TransferBalanceFormProps {
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


export default function TransferBalanceForm({ onDone }: TransferBalanceFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const kasAccountsCollection = useMemoFirebase(() => {
    return collection(firestore, 'kasAccounts');
  }, [firestore]);

  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sourceAccountId: '',
      destinationAccountId: '',
      amount: undefined,
      adminFee: 0,
      manualAdminFee: 0,
      description: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!firestore || !kasAccounts) {
        toast({ variant: "destructive", title: "Gagal", description: "Database tidak tersedia." });
        return;
    }

    const sourceAccount = kasAccounts.find(acc => acc.id === values.sourceAccountId);
    const destinationAccount = kasAccounts.find(acc => acc.id === values.destinationAccountId);

    if (!sourceAccount || !destinationAccount) {
      toast({ variant: "destructive", title: "Gagal", description: "Akun tidak ditemukan." });
      return;
    }

    const fee = String(values.adminFee) === '-1' ? (values.manualAdminFee || 0) : values.adminFee;
    const totalDebit = values.amount + fee;

    if (sourceAccount.balance < totalDebit) {
      form.setError('amount', { type: 'manual', message: 'Saldo tidak mencukupi untuk transfer dan biaya admin.' });
      return;
    }
    
    try {
        const batch = writeBatch(firestore);

        // Source account refs
        const sourceDocRef = doc(firestore, 'kasAccounts', sourceAccount.id);
        const sourceTransactionRef = doc(collection(sourceDocRef, 'transactions'));
        
        // Destination account refs
        const destinationDocRef = doc(firestore, 'kasAccounts', destinationAccount.id);
        const destinationTransactionRef = doc(collection(destinationDocRef, 'transactions'));

        const now = new Date().toISOString();

        // Update balances
        batch.update(sourceDocRef, { balance: sourceAccount.balance - totalDebit });
        batch.update(destinationDocRef, { balance: destinationAccount.balance + values.amount });

        // Create debit transaction for source
        batch.set(sourceTransactionRef, {
            kasAccountId: sourceAccount.id,
            type: 'debit',
            name: `Transfer ke ${destinationAccount.label}`,
            account: destinationAccount.label,
            date: now,
            amount: values.amount,
            balanceBefore: sourceAccount.balance,
            balanceAfter: sourceAccount.balance - totalDebit,
            sourceKasAccountId: sourceAccount.id,
            destinationKasAccountId: destinationAccount.id,
            category: 'transfer'
        });

        // Create credit transaction for destination
        batch.set(destinationTransactionRef, {
            kasAccountId: destinationAccount.id,
            type: 'credit',
            name: `Transfer dari ${sourceAccount.label}`,
            account: sourceAccount.label,
            date: now,
            amount: values.amount,
            balanceBefore: destinationAccount.balance,
            balanceAfter: destinationAccount.balance + values.amount,
            sourceKasAccountId: sourceAccount.id,
            destinationKasAccountId: destinationAccount.id,
            category: 'transfer'
        });

        // Create fee transaction if applicable
        if (fee > 0) {
            const feeTransactionRef = doc(collection(sourceDocRef, 'transactions'));
            batch.set(feeTransactionRef, {
                kasAccountId: sourceAccount.id,
                type: 'debit',
                name: `Biaya Admin Transfer ke ${destinationAccount.label}`,
                account: 'Biaya Transaksi',
                date: now,
                amount: fee,
                balanceBefore: sourceAccount.balance - values.amount, // Balance after transfer, before fee
                balanceAfter: sourceAccount.balance - totalDebit, // Final balance
                category: 'operational'
            });
        }
        
        await batch.commit();

        toast({ title: "Sukses", description: "Pindah saldo berhasil." });
        onDone();
    } catch (error) {
        console.error("Error transferring balance: ", error);
        toast({ variant: "destructive", title: "Error", description: "Terjadi kesalahan saat memproses perpindahan saldo." });
    }
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex flex-col h-full">
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 pt-4 pb-6">
            <FormField
              control={form.control}
              name="sourceAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dari Akun</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih akun sumber" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {kasAccounts?.map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.label} ({formatToRupiah(acc.balance)})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                  <FormLabel>Jumlah Transfer</FormLabel>
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
              name="adminFee"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Biaya Admin</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={String(field.value)}
                      className="flex flex-col space-y-1"
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="0" />
                        </FormControl>
                        <FormLabel className="font-normal">Rp 0</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="6500" />
                        </FormControl>
                        <FormLabel className="font-normal">Online (Rp 6.500)</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="2500" />
                        </FormControl>
                        <FormLabel className="font-normal">BI-Fast (Rp 2.500)</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="-1" />
                        </FormControl>
                        <FormLabel className="font-normal">Manual</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {String(form.watch('adminFee')) === '-1' && (
                <FormField
                    control={form.control}
                    name="manualAdminFee"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Nominal Biaya Admin Manual</FormLabel>
                        <FormControl>
                            <Input
                                type="number"
                                placeholder="Masukkan nominal"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            )}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Keterangan (Opsional)</FormLabel>
                  <FormControl>
                    <Input placeholder="cth: Bayar hutang" {...field} />
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
            Pindah Saldo
          </Button>
        </div>
      </form>
    </Form>
  );
}
