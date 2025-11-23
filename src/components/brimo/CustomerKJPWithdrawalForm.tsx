
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEffect, useState } from 'react';
import type { CustomerKJPWithdrawalFormValues } from '@/lib/types';
import { CustomerKJPWithdrawalFormSchema } from '@/lib/types';
import Image from 'next/image';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { KasAccount } from '@/lib/data';
import { addDoc, collection, doc, runTransaction } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

interface CustomerKJPWithdrawalFormProps {
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
    if (amount >= 10000 && amount <= 49900) return 3000;
    if (amount >= 50000 && amount <= 105000) return 5000;
    if (amount >= 106000 && amount <= 207000) return 7000;
    if (amount >= 208000 && amount <= 308000) return 8000;
    if (amount >= 309000 && amount <= 410000) return 10000;
    if (amount >= 411000 && amount <= 512000) return 12000;
    return 0;
};


export default function CustomerKJPWithdrawalForm({ onTransactionComplete, onDone }: CustomerKJPWithdrawalFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  
  const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

  const form = useForm<CustomerKJPWithdrawalFormValues>({
    resolver: zodResolver(CustomerKJPWithdrawalFormSchema),
    defaultValues: {
        customerName: '',
        withdrawalAmount: undefined,
        serviceFee: undefined,
        feePaymentMethod: 'Dipotong',
    },
  });

  const withdrawalAmount = form.watch('withdrawalAmount');
  const { feePaymentMethod } = form.getValues();

  useEffect(() => {
    if (withdrawalAmount !== undefined) {
      const fee = calculateServiceFee(withdrawalAmount);
      form.setValue('serviceFee', fee, { shouldValidate: true });
    }
  }, [withdrawalAmount, form]);
  
  const onSubmit = async (values: CustomerKJPWithdrawalFormValues) => {
    setIsSaving(true);

    if (!firestore || !kasAccounts) {
      toast({ variant: "destructive", title: "Error", description: "Database tidak tersedia." });
      setIsSaving(false);
      return;
    }
    
    const laciAccount = kasAccounts.find(acc => acc.label === 'Laci');
    const agenDKIAccount = kasAccounts.find(acc => acc.label === 'Agen DKI');
    const { withdrawalAmount, serviceFee, feePaymentMethod } = values;
    const cashGivenToCustomer = feePaymentMethod === 'Dipotong' ? withdrawalAmount - serviceFee : withdrawalAmount;

    if (!laciAccount) {
        toast({ variant: "destructive", title: "Akun Laci Tidak Ditemukan", description: "Pastikan akun kas 'Laci' dengan tipe 'Tunai' sudah dibuat." });
        setIsSaving(false);
        return;
    }

    if (!agenDKIAccount) {
        toast({ variant: "destructive", title: "Akun Agen DKI Tidak Ditemukan", description: "Pastikan akun kas 'Agen DKI' dengan tipe 'Merchant' sudah dibuat." });
        setIsSaving(false);
        return;
    }

    if (laciAccount.balance < cashGivenToCustomer) {
        toast({ variant: "destructive", title: "Saldo Laci Tidak Cukup", description: `Saldo ${laciAccount.label} tidak mencukupi untuk penarikan ini.` });
        setIsSaving(false);
        return;
    }

    toast({ title: "Memproses...", description: "Menyimpan transaksi tarik tunai KJP." });
    
    const now = new Date();
    const nowISO = now.toISOString();
    const deviceName = localStorage.getItem('brimoDeviceName') || 'Unknown Device';
    const totalReceivedByMerchant = withdrawalAmount;

    try {
        const auditDocRef = await addDoc(collection(firestore, 'customerKJPWithdrawals'), {
            date: now,
            customerName: values.customerName,
            withdrawalAmount: values.withdrawalAmount,
            serviceFee: values.serviceFee,
            feePaymentMethod: values.feePaymentMethod,
            destinationMerchantAccountId: agenDKIAccount.id,
            sourceKasTunaiAccountId: laciAccount.id,
            deviceName: deviceName
        });
        const auditId = auditDocRef.id;

        await runTransaction(firestore, async (transaction) => {
            
            const laciAccountRef = doc(firestore, 'kasAccounts', laciAccount.id);
            const agenDKIAccountRef = doc(firestore, 'kasAccounts', agenDKIAccount.id);
            
            const [laciAccountDoc, agenDKIAccountDoc] = await Promise.all([
                transaction.get(laciAccountRef),
                transaction.get(agenDKIAccountRef)
            ]);

            if (!laciAccountDoc.exists()) throw new Error("Akun Laci tidak ditemukan.");
            if (!agenDKIAccountDoc.exists()) throw new Error("Akun Agen DKI tidak ditemukan.");

            const currentLaciBalance = laciAccountDoc.data().balance;
            const currentAgenDKIBalance = agenDKIAccountDoc.data().balance;

            if (currentLaciBalance < cashGivenToCustomer) {
                throw new Error(`Saldo ${laciAccount.label} tidak mencukupi.`);
            }
            
            // 1. Credit Agen DKI (Merchant) Account
            const newAgenDKIBalance = currentAgenDKIBalance + totalReceivedByMerchant;
            transaction.update(agenDKIAccountRef, { balance: newAgenDKIBalance });
            const creditTrxRef = doc(collection(agenDKIAccountRef, 'transactions'));
            transaction.set(creditTrxRef, {
                kasAccountId: agenDKIAccount.id, type: 'credit', name: `Penerimaan KJP a/n ${values.customerName}`, account: 'Pelanggan KJP', date: nowISO, amount: totalReceivedByMerchant, balanceBefore: currentAgenDKIBalance, balanceAfter: newAgenDKIBalance, category: 'customer_kjp_withdrawal_credit', deviceName, auditId
            });

            // 2. Handle Laci (Cash) Account
            if (feePaymentMethod === 'Tunai') {
                const balanceAfterDebit = currentLaciBalance - withdrawalAmount;
                const finalLaciBalance = balanceAfterDebit + serviceFee;

                transaction.update(laciAccountRef, { balance: finalLaciBalance });
                
                const debitTrxRef = doc(collection(laciAccountRef, 'transactions'));
                transaction.set(debitTrxRef, {
                    kasAccountId: laciAccount.id, type: 'debit', name: `Tarik Tunai KJP a/n ${values.customerName}`, account: 'Pelanggan KJP', date: nowISO, amount: withdrawalAmount, balanceBefore: currentLaciBalance, balanceAfter: balanceAfterDebit, category: 'customer_kjp_withdrawal_debit', deviceName, auditId
                });

                const feeTrxRef = doc(collection(laciAccountRef, 'transactions'));
                transaction.set(feeTrxRef, {
                    kasAccountId: laciAccount.id, type: 'credit', name: `Biaya Jasa KJP a/n ${values.customerName}`, account: 'Pendapatan Jasa', date: nowISO, amount: serviceFee, balanceBefore: balanceAfterDebit, balanceAfter: finalLaciBalance, category: 'service_fee_income_kjp', deviceName, auditId
                });

            } else { // 'Dipotong'
                const newLaciBalance = currentLaciBalance - cashGivenToCustomer;
                transaction.update(laciAccountRef, { balance: newLaciBalance });

                const debitTrxRef = doc(collection(laciAccountRef, 'transactions'));
                transaction.set(debitTrxRef, {
                    kasAccountId: laciAccount.id, type: 'debit', name: `Tarik Tunai KJP a/n ${values.customerName} (Fee Dipotong)`, account: 'Pelanggan KJP', date: nowISO, amount: cashGivenToCustomer, balanceBefore: currentLaciBalance, balanceAfter: newLaciBalance, category: 'customer_kjp_withdrawal_debit', deviceName, auditId
                });
            }
        });

        toast({ title: "Sukses", description: "Transaksi tarik tunai KJP berhasil disimpan." });
        onTransactionComplete();

    } catch (error: any) {
        console.error("Error saving KJP withdrawal transaction: ", error);
        toast({ variant: "destructive", title: "Error", description: error.message || "Gagal menyimpan transaksi." });
    } finally {
        setIsSaving(false);
    }
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex flex-col h-full">
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="relative w-full h-32 rounded-lg overflow-hidden mb-4">
              <Image 
                src="https://images.squarespace-cdn.com/content/v1/59a14544d55b41551e0b745a/1538536308008-NT718XNQ1KS2GTZPRAMA/informasi_tentang_kelebihan_penggunaan_KJP_Plus_HEADER.png?format=1500w"
                alt="KJP Banner"
                fill
                className="object-cover"
                data-ai-hint="kjp banner"
              />
          </div>
          <div className="space-y-4 pt-4 pb-6">
            
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
                        <FormControl><Input type="tel" placeholder="Rp 0" {...field} value={formatToRupiah(field.value)} onChange={(e) => field.onChange(parseRupiah(e.target.value))} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}/>
                <FormField control={form.control} name="serviceFee" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Biaya Jasa (Laba)</FormLabel>
                        <FormControl><Input type="tel" placeholder="Rp 0" {...field} value={formatToRupiah(field.value)} onChange={(e) => field.onChange(parseRupiah(e.target.value))} /></FormControl>
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
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl><RadioGroupItem value="Dipotong" /></FormControl>
                        <FormLabel className="font-normal">Potong dari Uang Tunai</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl><RadioGroupItem value="Tunai" /></FormControl>
                        <FormLabel className="font-normal">Bayar Tunai Terpisah</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

          </div>
        </ScrollArea>
        <div className="flex gap-2 pt-0 pb-4 border-t border-border -mx-6 px-6 pt-4">
          <Button type="button" variant="outline" onClick={onDone} className="w-full" disabled={isSaving}>
            Batal
          </Button>
          <Button type="submit" className="w-full" disabled={isSaving}>
            {isSaving ? <Loader2 className="animate-spin" /> : "Simpan Transaksi"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

