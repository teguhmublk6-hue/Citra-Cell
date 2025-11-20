
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, runTransaction, addDoc } from 'firebase/firestore';
import type { KasAccount } from '@/lib/data';
import { ScrollArea } from '@/components/ui/scroll-area';
import bankData from '@/lib/banks.json';
import { useState, useEffect, useMemo } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CustomerWithdrawalFormValues } from '@/lib/types';
import { CustomerWithdrawalFormSchema } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { useToast } from '@/hooks/use-toast';


interface CustomerWithdrawalFormProps {
  onTransactionComplete: () => void;
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

const calculateServiceFee = (amount: number): number => {
    if (amount >= 1000 && amount <= 49000) return 3000;
    if (amount >= 50000 && amount <= 999000) return 5000;
    if (amount >= 1000000 && amount <= 1999000) return 7000;
    if (amount >= 2000000 && amount <= 3499000) return 10000;
    if (amount >= 3500000 && amount <= 5999000) return 15000;
    if (amount >= 6000000 && amount <= 7999000) return 20000;
    if (amount >= 8000000 && amount <= 10000000) return 25000;
    return 0;
};


export default function CustomerWithdrawalForm({ onTransactionComplete, onDone }: CustomerWithdrawalFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [bankPopoverOpen, setBankPopoverOpen] = useState(false);
  const [destinationPopoverOpen, setDestinationPopoverOpen] = useState(false);

  const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

  const form = useForm<CustomerWithdrawalFormValues>({
    resolver: zodResolver(CustomerWithdrawalFormSchema),
    defaultValues: {
        customerBankSource: '',
        customerName: '',
        withdrawalAmount: undefined,
        serviceFee: undefined,
        destinationAccountId: '',
        feePaymentMethod: 'Dipotong',
    },
  });

  const withdrawalAmount = form.watch('withdrawalAmount');
  const feePaymentMethod = form.watch('feePaymentMethod');

  useEffect(() => {
    if (withdrawalAmount !== undefined) {
      const fee = calculateServiceFee(withdrawalAmount);
      form.setValue('serviceFee', fee, { shouldValidate: true });
    }
  }, [withdrawalAmount, form]);
  
  const destinationKasAccounts = useMemo(() => {
      return kasAccounts?.filter(acc => ['Bank', 'E-Wallet', 'Merchant'].includes(acc.type)) || [];
  }, [kasAccounts]);

  const onSubmit = async (values: CustomerWithdrawalFormValues) => {
    setIsSaving(true);
    
    if (!firestore || !kasAccounts) {
        toast({ variant: "destructive", title: "Error", description: "Database tidak tersedia." });
        setIsSaving(false);
        return;
    }

    const destinationAccount = kasAccounts.find(acc => acc.id === values.destinationAccountId);
    const laciAccount = kasAccounts.find(acc => acc.label === 'Laci');
    const { withdrawalAmount, serviceFee, feePaymentMethod } = values;
    const cashGivenToCustomer = feePaymentMethod === 'Dipotong' ? withdrawalAmount - serviceFee : withdrawalAmount;

    if (!destinationAccount) {
      toast({ variant: "destructive", title: "Error", description: "Akun tujuan tidak ditemukan." });
      setIsSaving(false);
      return;
    }
    if (!laciAccount) {
      toast({ variant: "destructive", title: "Akun Laci Tidak Ditemukan", description: `Silakan buat akun kas dengan nama "Laci" dan jenis "Tunai".` });
      setIsSaving(false);
      return;
    }
    if (laciAccount.balance < cashGivenToCustomer) {
      toast({ variant: "destructive", title: "Saldo Laci Tidak Cukup", description: `Saldo ${laciAccount.label} tidak mencukupi untuk memberikan uang tunai.` });
      setIsSaving(false);
      return;
    }

    toast({ title: "Memproses...", description: "Menyimpan transaksi tarik tunai." });
    
    const now = new Date();
    const nowISO = now.toISOString();
    const deviceName = localStorage.getItem('brimoDeviceName') || 'Unknown Device';
    const totalTransferFromCustomer = withdrawalAmount;

    try {
        const auditDocRef = await addDoc(collection(firestore, 'customerWithdrawals'), {
            date: now,
            customerName: values.customerName,
            customerBankSource: values.customerBankSource,
            withdrawalAmount: values.withdrawalAmount,
            serviceFee: values.serviceFee,
            feePaymentMethod: values.feePaymentMethod,
            destinationKasAccountId: values.destinationAccountId,
            sourceKasTunaiAccountId: laciAccount!.id,
            deviceName: deviceName
        });
        const auditId = auditDocRef.id;
        
        await runTransaction(firestore, async (transaction) => {
            const destAccountRef = doc(firestore, 'kasAccounts', destinationAccount.id);
            const laciAccountRef = doc(firestore, 'kasAccounts', laciAccount.id);
            
            const [destAccountDoc, laciAccountDoc] = await Promise.all([
                transaction.get(destAccountRef),
                transaction.get(laciAccountRef)
            ]);

            if (!destAccountDoc.exists()) throw new Error("Akun tujuan tidak ditemukan.");
            if (!laciAccountDoc.exists()) throw new Error("Akun Laci tidak ditemukan.");

            const currentDestBalance = destAccountDoc.data().balance;
            const currentLaciBalance = laciAccountDoc.data().balance;

            if (currentLaciBalance < cashGivenToCustomer) throw new Error(`Saldo ${laciAccount.label} tidak mencukupi.`);
            
            const newDestBalance = currentDestBalance + totalTransferFromCustomer;
            transaction.update(destAccountRef, { balance: newDestBalance });
            const creditTrxRef = doc(collection(destAccountRef, 'transactions'));
            transaction.set(creditTrxRef, { kasAccountId: destinationAccount.id, type: 'credit', name: `Trf Masuk Tarik Tunai a/n ${values.customerName}`, account: values.customerBankSource, date: nowISO, amount: totalTransferFromCustomer, balanceBefore: currentDestBalance, balanceAfter: newDestBalance, category: 'customer_withdrawal_credit', deviceName, auditId });

            if (feePaymentMethod === 'Tunai') {
                const balanceAfterDebit = currentLaciBalance - withdrawalAmount;
                const finalLaciBalance = balanceAfterDebit + serviceFee;
                transaction.update(laciAccountRef, { balance: finalLaciBalance });
                const debitTrxRef = doc(collection(laciAccountRef, 'transactions'));
                transaction.set(debitTrxRef, { kasAccountId: laciAccount.id, type: 'debit', name: `Tarik Tunai a/n ${values.customerName}`, account: 'Pelanggan', date: nowISO, amount: withdrawalAmount, balanceBefore: currentLaciBalance, balanceAfter: balanceAfterDebit, category: 'customer_withdrawal_debit', deviceName, auditId });
                const feeTrxRef = doc(collection(laciAccountRef, 'transactions'));
                 transaction.set(feeTrxRef, { kasAccountId: laciAccount.id, type: 'credit', name: `Biaya Jasa Tarik Tunai`, account: 'Pendapatan Jasa', date: nowISO, amount: serviceFee, balanceBefore: balanceAfterDebit, balanceAfter: finalLaciBalance, category: 'service_fee_income', deviceName, auditId });
            } else { // 'Dipotong'
                const newLaciBalance = currentLaciBalance - cashGivenToCustomer;
                transaction.update(laciAccountRef, { balance: newLaciBalance });
                const debitTrxRef = doc(collection(laciAccountRef, 'transactions'));
                transaction.set(debitTrxRef, { kasAccountId: laciAccount.id, type: 'debit', name: `Tarik Tunai a/n ${values.customerName} (Fee Dipotong)`, account: 'Pelanggan', date: nowISO, amount: cashGivenToCustomer, balanceBefore: currentLaciBalance, balanceAfter: newLaciBalance, category: 'customer_withdrawal_debit', deviceName, auditId });
            }
        });

        toast({ title: "Sukses", description: "Transaksi tarik tunai berhasil disimpan." });
        onTransactionComplete();
    } catch (error: any) {
        console.error("Error saving withdrawal transaction: ", error);
        toast({ variant: "destructive", title: "Error", description: error.message || "Gagal menyimpan transaksi." });
    } finally {
        setIsSaving(false);
    }
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex flex-col h-full">
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 pt-4 pb-6">
            
            <FormField
                control={form.control}
                name="customerBankSource"
                render={({ field }) => (
                <FormItem className="flex flex-col">
                    <FormLabel>Bank/E-wallet Pelanggan</FormLabel>
                    <Popover open={bankPopoverOpen} onOpenChange={setBankPopoverOpen}>
                    <PopoverTrigger asChild>
                        <FormControl>
                        <Button
                            variant="outline"
                            role="combobox"
                            className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                        >
                            {field.value ? bankData.find((bank) => bank.name === field.value)?.name : "Pilih bank/e-wallet"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                        </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[--radix-popover-content-available-height] p-0">
                        <Command>
                        <CommandInput placeholder="Cari bank..." />
                        <CommandEmpty>Bank tidak ditemukan.</CommandEmpty>
                        <CommandGroup>
                            <ScrollArea className="h-72">
                            {bankData.map((bank) => (
                                <CommandItem value={bank.name} key={bank.name} onSelect={() => { form.setValue("customerBankSource", bank.name); setBankPopoverOpen(false); }}>
                                    <Check className={cn("mr-2 h-4 w-4", bank.name === field.value ? "opacity-100" : "opacity-0")} />
                                    {bank.name}
                                </CommandItem>
                            ))}
                            </ScrollArea>
                        </CommandGroup>
                        </Command>
                    </PopoverContent>
                    </Popover>
                    <FormMessage />
                </FormItem>
                )}
            />
            
            <FormField control={form.control} name="customerName" render={({ field }) => (
                <FormItem>
                    <FormLabel>Nama Penarik Tunai</FormLabel>
                    <FormControl>
                        <Input placeholder="Masukkan nama pelanggan" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}/>

            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="withdrawalAmount" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Nominal Tarik Tunai</FormLabel>
                        <FormControl><Input type="text" placeholder="Rp 0" {...field} value={formatToRupiah(field.value)} onChange={(e) => field.onChange(parseRupiah(e.target.value))} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}/>
                <FormField control={form.control} name="serviceFee" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Biaya Jasa (Laba)</FormLabel>
                        <FormControl><Input type="text" placeholder="Rp 0" {...field} value={formatToRupiah(field.value)} onChange={(e) => field.onChange(parseRupiah(e.target.value))} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}/>
            </div>

            <FormField
              control={form.control}
              name="feePaymentMethod"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Pembayaran Biaya Jasa</FormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                      <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Dipotong" /></FormControl><FormLabel className="font-normal">Potong dari Uang Tunai</FormLabel></FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Tunai" /></FormControl><FormLabel className="font-normal">Bayar Tunai Terpisah</FormLabel></FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="destinationAccountId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Dana Masuk Ke Akun</FormLabel>
                  <Popover open={destinationPopoverOpen} onOpenChange={setDestinationPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value
                            ? destinationKasAccounts?.find(
                                (acc) => acc.id === field.value
                              )?.label
                            : "Pilih akun penerima"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[--radix-popover-content-available-height] p-0">
                      <Command>
                        <CommandInput placeholder="Cari akun..." />
                        <CommandEmpty>Akun tidak ditemukan.</CommandEmpty>
                        <CommandGroup>
                           <ScrollArea className="h-72">
                          {destinationKasAccounts?.map((acc) => (
                            <CommandItem
                              value={acc.label}
                              key={acc.id}
                              onSelect={() => {
                                form.setValue("destinationAccountId", acc.id)
                                setDestinationPopoverOpen(false)
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  acc.id === field.value
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              {acc.label} ({formatToRupiah(acc.balance)})
                            </CommandItem>
                          ))}
                          </ScrollArea>
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

          </div>
        </ScrollArea>
        <div className="flex gap-2 pt-0 pb-4 border-t border-border -mx-6 px-6 pt-4">
          <Button type="button" variant="outline" onClick={onDone} className="w-full" disabled={isSaving}>Batal</Button>
          <Button type="submit" className="w-full" disabled={isSaving}>
            {isSaving ? <Loader2 className="animate-spin" /> : "Simpan Transaksi"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
