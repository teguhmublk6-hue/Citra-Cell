
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
import { Alert, AlertDescription } from '../ui/alert';
import { ScrollArea } from '../ui/scroll-area';

const numberPreprocessor = (val: unknown) => (val === "" || val === undefined || val === null) ? undefined : Number(String(val).replace(/[^0-9]/g, ""));

const formSchema = z.object({
  sourceAccountId: z.string().min(1, 'Akun sumber harus dipilih'),
  destinationAccountId: z.string().min(1, 'Akun tujuan harus dipilih'),
  amount: z.preprocess(
    numberPreprocessor,
    z.number({ invalid_type_error: "Jumlah transfer harus angka" }).positive('Jumlah transfer harus lebih dari 0')
  ),
  adminFee: z.preprocess(
    numberPreprocessor,
    z.number({ invalid_type_error: "Biaya admin harus angka" }).min(0, 'Biaya admin tidak boleh negatif').optional()
  ),
  manualAdminFee: z.preprocess(
    numberPreprocessor,
    z.number({ invalid_type_error: "Biaya admin harus angka" }).min(0, 'Biaya admin tidak boleh negatif').optional()
  ),
}).refine(data => data.sourceAccountId !== data.destinationAccountId, {
  message: "Akun sumber dan tujuan tidak boleh sama",
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

const adminFeeOptions = [
    { label: 'Gratis', value: 0 },
    { label: 'Rp 2.500', value: 2500 },
    { label: 'Rp 6.500 (BI-Fast)', value: 6500 },
    { label: 'Manual', value: -1 },
];

interface TransferBalanceFormProps {
  accounts: KasAccount[];
  onDone: () => void;
}

export default function TransferBalanceForm({ accounts, onDone }: TransferBalanceFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sourceAccountId: '',
      destinationAccountId: '',
      amount: undefined,
      adminFee: 0,
      manualAdminFee: undefined,
    },
  });

  const sourceAccountBalance = form.watch('sourceAccountId') 
    ? accounts.find(acc => acc.id === form.getValues('sourceAccountId'))?.balance ?? 0
    : 0;

  const transferAmount = form.watch('amount') ?? 0;
  const adminFeeValue = form.watch('adminFee');
  const manualAdminFeeValue = form.watch('manualAdminFee') ?? 0;
  
  const fee = adminFeeValue === -1 ? manualAdminFeeValue : (adminFeeValue ?? 0);
  const totalDeduction = transferAmount + fee;

  const isManualFee = adminFeeValue === -1;

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!firestore) return;

    const sourceAccount = accounts.find(acc => acc.id === values.sourceAccountId);
    const destinationAccount = accounts.find(acc => acc.id === values.destinationAccountId);

    if (!sourceAccount || !destinationAccount) {
        toast({ variant: "destructive", title: "Akun tidak ditemukan." });
        return;
    }
    
    const finalFee = values.adminFee === -1 ? (values.manualAdminFee || 0) : (values.adminFee || 0);
    const totalDeduction = values.amount + finalFee;

    if (sourceAccount.balance < totalDeduction) {
        form.setError("amount", { message: `Saldo ${sourceAccount.label} tidak mencukupi untuk transfer dan biaya admin.` });
        return;
    }

    const batch = writeBatch(firestore);
    const now = new Date().toISOString();

    // 1. Update source account balance
    const sourceAccountRef = doc(firestore, 'kasAccounts', sourceAccount.id);
    const sourceBalanceBefore = sourceAccount.balance;
    const sourceBalanceAfter = sourceBalanceBefore - totalDeduction;
    batch.update(sourceAccountRef, { balance: sourceBalanceAfter });

    // 2. Create debit transaction for source account
    const sourceTransactionRef = doc(collection(firestore, 'kasAccounts', sourceAccount.id, 'transactions'));
    const sourceTransaction: Omit<Transaction, 'id' | 'sourceKasAccountId' | 'destinationKasAccountId'> = {
      kasAccountId: sourceAccount.id,
      name: `Transfer ke: ${destinationAccount.label}`,
      account: destinationAccount.label,
      date: now,
      amount: values.amount,
      type: 'debit',
      category: 'transfer',
      balanceBefore: sourceBalanceBefore,
      balanceAfter: sourceBalanceAfter + (finalFee > 0 ? finalFee : 0),
    };
    batch.set(sourceTransactionRef, sourceTransaction);
    
    // 3. Create debit transaction for admin fee if applicable
    if (finalFee > 0) {
        const feeTransactionRef = doc(collection(firestore, 'kasAccounts', sourceAccount.id, 'transactions'));
        const feeTransaction: Omit<Transaction, 'id' | 'sourceKasAccountId' | 'destinationKasAccountId'> = {
            kasAccountId: sourceAccount.id,
            name: `Biaya Admin Transfer ke: ${destinationAccount.label}`,
            account: 'Biaya Admin',
            date: now,
            amount: finalFee,
            type: 'debit',
            category: 'operational',
            balanceBefore: sourceBalanceAfter + finalFee,
            balanceAfter: sourceBalanceAfter,
        };
        batch.set(feeTransactionRef, feeTransaction);
    }

    // 4. Update destination account balance
    const destinationAccountRef = doc(firestore, 'kasAccounts', destinationAccount.id);
    const destBalanceBefore = destinationAccount.balance;
    const destBalanceAfter = destBalanceBefore + values.amount;
    batch.update(destinationAccountRef, { balance: destBalanceAfter });

    // 5. Create credit transaction for destination account
    const destinationTransactionRef = doc(collection(firestore, 'kasAccounts', destinationAccount.id, 'transactions'));
    const destinationTransaction: Omit<Transaction, 'id' | 'sourceKasAccountId' | 'destinationKasAccountId'> = {
        kasAccountId: destinationAccount.id,
        name: `Transfer dari: ${sourceAccount.label}`,
        account: sourceAccount.label,
        date: now,
        amount: values.amount,
        type: 'credit',
        category: 'transfer',
        balanceBefore: destBalanceBefore,
        balanceAfter: destBalanceAfter,
    };
    batch.set(destinationTransactionRef, destinationTransaction);

    try {
        await batch.commit();
        toast({
            title: "Transfer Berhasil",
            description: `Saldo sebesar ${formatToRupiah(values.amount)} berhasil dipindahkan.`
        });
        onDone();
    } catch (e) {
        console.error("Error transferring balance: ", e);
        toast({
            variant: "destructive",
            title: "Gagal Memindahkan Saldo",
            description: "Terjadi kesalahan saat memproses permintaan Anda."
        });
    }
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex flex-col h-full pt-4">
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 pt-4 pb-6">
              <FormField
                control={form.control}
                name="sourceAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dari Akun</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Pilih akun sumber..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        {accounts.map(account => (
                          <SelectItem key={account.id} value={account.id}>{account.label} ({formatToRupiah(account.balance)})</SelectItem>
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
                      <FormControl><SelectTrigger><SelectValue placeholder="Pilih akun tujuan..." /></SelectTrigger></FormControl>
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
                    <FormLabel>Jumlah Transfer</FormLabel>
                    <FormControl>
                      <Input 
                        type="text" placeholder="Rp 0" {...field}
                        value={formatToRupiah(field.value)}
                        onChange={(e) => field.onChange(parseRupiah(e.target.value))}
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
                      <FormItem>
                      <FormLabel>Biaya Admin</FormLabel>
                      <Select onValueChange={(value) => field.onChange(Number(value))} defaultValue={String(field.value)}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Pilih biaya admin..." /></SelectTrigger></FormControl>
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
              {isManualFee && (
                  <FormField
                      control={form.control}
                      name="manualAdminFee"
                      render={({ field }) => (
                          <FormItem>
                          <FormLabel>Nominal Biaya Admin Manual</FormLabel>
                          <FormControl>
                              <Input 
                                  type="text" placeholder="Rp 0" {...field}
                                  value={formatToRupiah(field.value)}
                                  onChange={(e) => {
                                      const numericValue = parseRupiah(e.target.value);
                                      field.onChange(numericValue);
                                  }}
                              />
                          </FormControl>
                          <FormMessage />
                          </FormItem>
                      )}
                  />
              )}
              {totalDeduction > 0 && (
                  <Alert>
                      <AlertDescription className="flex justify-between items-center text-sm">
                          <span>Total Potongan Saldo:</span>
                          <span className="font-semibold">{formatToRupiah(totalDeduction)}</span>
                      </AlertDescription>
                  </Alert>
              )}
          </div>
        </ScrollArea>
        <div className="flex gap-2 pt-0 pb-4 border-t border-border -mx-6 px-6 pt-4">
            <Button type="button" variant="outline" onClick={onDone} className="w-full">Batal</Button>
            <Button type="submit" className="w-full" disabled={totalDeduction > sourceAccountBalance || totalDeduction <= 0}>Pindah Saldo</Button>
        </div>
      </form>
    </Form>
  );
}

    