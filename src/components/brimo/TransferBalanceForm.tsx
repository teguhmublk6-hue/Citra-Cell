
"use client";

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useFirestore, useUser } from '@/firebase';
import { doc, writeBatch } from 'firebase/firestore';
import type { KasAccount } from '@/lib/data';
import { useState } from 'react';

const numberPreprocessor = (val: unknown) => (val === "" || val === undefined || val === null) ? undefined : Number(String(val).replace(/[^0-9]/g, ""));

const adminFeeOptions = [
    { label: 'Non-Admin', value: 0 },
    { label: 'Rp 500', value: 500 },
    { label: 'Rp 750', value: 750 },
    { label: 'Rp 1.000', value: 1000 },
    { label: 'Rp 1.500', value: 1500 },
    { label: 'Rp 2.500', value: 2500 },
    { label: 'Manual', value: -1 },
];

const formSchema = z.object({
  sourceAccountId: z.string().min(1, 'Akun asal harus dipilih'),
  destinationAccountId: z.string().min(1, 'Akun tujuan harus dipilih'),
  amount: z.preprocess(
    numberPreprocessor,
    z.number({ invalid_type_error: "Jumlah transfer harus angka" }).positive('Jumlah transfer harus lebih dari 0')
  ),
  adminFee: z.preprocess(numberPreprocessor, z.number().min(0)),
  manualAdminFee: z.preprocess(numberPreprocessor, z.number().min(0).optional()),
  feeDeduction: z.enum(['source', 'destination'], { required_error: 'Opsi potong biaya harus dipilih' }),
}).refine(data => data.sourceAccountId !== data.destinationAccountId, {
    message: "Akun asal dan tujuan tidak boleh sama",
    path: ["destinationAccountId"],
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


interface TransferBalanceFormProps {
  accounts: KasAccount[];
  onDone: () => void;
}

export default function TransferBalanceForm({ accounts, onDone }: TransferBalanceFormProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const [showManualFeeInput, setShowManualFeeInput] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        sourceAccountId: '',
        destinationAccountId: '',
        amount: undefined,
        adminFee: 0,
        manualAdminFee: undefined,
        feeDeduction: 'source',
    },
  });

  const sourceAccountId = useWatch({ control: form.control, name: 'sourceAccountId' });
  const sourceAccount = accounts.find(acc => acc.id === sourceAccountId);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user || !firestore) return;

    const sourceAcc = accounts.find(acc => acc.id === values.sourceAccountId);
    const destAcc = accounts.find(acc => acc.id === values.destinationAccountId);
    if (!sourceAcc || !destAcc) return;

    const fee = values.adminFee === -1 ? (values.manualAdminFee || 0) : values.adminFee;
    const transferAmount = values.amount;

    let sourceNewBalance = sourceAcc.balance;
    let destNewBalance = destAcc.balance;

    if (values.feeDeduction === 'source') {
        if (sourceAcc.balance < transferAmount + fee) {
            form.setError('amount', { message: 'Saldo akun asal tidak mencukupi untuk transfer dan biaya admin' });
            return;
        }
        sourceNewBalance -= (transferAmount + fee);
        destNewBalance += transferAmount;
    } else { // destination
        if (sourceAcc.balance < transferAmount) {
            form.setError('amount', { message: 'Saldo akun asal tidak mencukupi untuk transfer' });
            return;
        }
        sourceNewBalance -= transferAmount;
        destNewBalance += (transferAmount - fee);
    }
    
    const batch = writeBatch(firestore);
    const sourceRef = doc(firestore, 'users', user.uid, 'kasAccounts', sourceAcc.id);
    const destRef = doc(firestore, 'users', user.uid, 'kasAccounts', destAcc.id);

    batch.update(sourceRef, { balance: sourceNewBalance });
    batch.update(destRef, { balance: destNewBalance });

    await batch.commit();
    onDone();
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex flex-col h-full pt-4">
        <div className="flex-1 space-y-4">
            <FormField
                control={form.control}
                name="sourceAccountId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Dari Akun</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Pilih akun asal" />
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
                        {accounts.filter(a => a.id !== sourceAccountId).map(account => (
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
                     {sourceAccount && <FormDescription>Saldo tersedia: {formatToRupiah(sourceAccount.balance) || 'Rp 0'}</FormDescription>}
                    <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="adminFee"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Potongan Biaya</FormLabel>
                    <Select onValueChange={(value) => {
                        const numValue = Number(value);
                        field.onChange(numValue);
                        setShowManualFeeInput(numValue === -1);
                        if (numValue !== -1) {
                            form.setValue('manualAdminFee', undefined);
                        }
                    }} defaultValue={String(field.value)}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Pilih biaya admin" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {adminFeeOptions.map(opt => (
                            <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
            />
            {showManualFeeInput && (
                <FormField
                    control={form.control}
                    name="manualAdminFee"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Biaya Admin Manual</FormLabel>
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
            )}
             <FormField
                control={form.control}
                name="feeDeduction"
                render={({ field }) => (
                    <FormItem className="space-y-3">
                    <FormLabel>Potong Biaya Dari</FormLabel>
                    <FormControl>
                        <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex space-x-4"
                        >
                        <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                            <RadioGroupItem value="source" />
                            </FormControl>
                            <FormLabel className="font-normal">Akun Asal</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                            <RadioGroupItem value="destination" />
                            </FormControl>
                            <FormLabel className="font-normal">Akun Tujuan</FormLabel>
                        </FormItem>
                        </RadioGroup>
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
                Pindah Saldo
            </Button>
        </div>
      </form>
    </Form>
  );
}
