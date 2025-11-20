
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, runTransaction, addDoc } from 'firebase/firestore';
import type { KasAccount } from '@/lib/data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { useState, useEffect, useMemo } from 'react';
import type { PPOBPaketTelponFormValues } from '@/lib/types';
import { PPOBPaketTelponFormSchema } from '@/lib/types';
import { Card, CardContent } from '../ui/card';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '../ui/command';

interface PPOBPaketTelponFormProps {
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

export default function PPOBPaketTelponForm({ onTransactionComplete, onDone }: PPOBPaketTelponFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [paymentPopoverOpen, setPaymentPopoverOpen] = useState(false);
  
  const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

  const refinedSchema = PPOBPaketTelponFormSchema.superRefine((data, ctx) => {
    if (data.paymentMethod === 'Transfer' && !data.paymentToKasTransferAccountId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Akun penerima bayaran harus dipilih.', path: ['paymentToKasTransferAccountId'] });
    }
    if (data.paymentMethod === 'Split') {
        const totalPayment = data.sellingPrice;
        if (!data.splitTunaiAmount || data.splitTunaiAmount <= 0) {
             ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Jumlah tunai harus diisi.', path: ['splitTunaiAmount'] });
        } else if (data.splitTunaiAmount >= totalPayment) {
             ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Jumlah tunai harus lebih kecil dari total bayar.', path: ['splitTunaiAmount'] });
        }
        if (!data.paymentToKasTransferAccountId) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Akun penerima sisa bayaran harus dipilih.', path: ['paymentToKasTransferAccountId'] });
        }
    }
  });

  const form = useForm<PPOBPaketTelponFormValues>({
    resolver: zodResolver(refinedSchema),
    defaultValues: {
        sourcePPOBAccountId: '',
        packageName: '',
        costPrice: undefined,
        sellingPrice: undefined,
        paymentMethod: 'Tunai',
        paymentToKasTransferAccountId: '',
        splitTunaiAmount: undefined,
    },
  });

  const paymentMethod = form.watch('paymentMethod');
  const sourcePPOBAccountId = form.watch('sourcePPOBAccountId');

  const selectedPPOBAccount = useMemo(() => kasAccounts?.find(acc => acc.id === sourcePPOBAccountId), [kasAccounts, sourcePPOBAccountId]);

  const ppobAccounts = useMemo(() => kasAccounts?.filter(acc => acc.type === 'PPOB'), [kasAccounts]);

  const onSubmit = async (values: PPOBPaketTelponFormValues) => {
    setIsSaving(true);
    if (!firestore || !sourcePPOBAccount || !kasAccounts) {
        toast({ variant: "destructive", title: "Error", description: "Database atau akun tidak ditemukan." });
        setIsSaving(false);
        return;
    }

    const laciAccount = kasAccounts.find(acc => acc.label === "Laci");
    const paymentTransferAccount = kasAccounts.find(acc => acc.id === values.paymentToKasTransferAccountId);
    const { costPrice, sellingPrice, paymentMethod, splitTunaiAmount } = values;
    
    if (!laciAccount && (paymentMethod === 'Tunai' || paymentMethod === 'Split')) {
        toast({ variant: "destructive", title: "Akun Laci Tidak Ditemukan", description: "Pastikan akun kas 'Laci' dengan tipe 'Tunai' sudah dibuat." });
        setIsSaving(false);
        return;
    }

    if (sourcePPOBAccount.balance < costPrice) {
        toast({ variant: "destructive", title: "Deposit Tidak Cukup", description: `Deposit ${sourcePPOBAccount.label} tidak mencukupi.` });
        setIsSaving(false);
        return;
    }

    toast({ title: "Memproses...", description: "Menyimpan transaksi paket telpon." });

    const now = new Date();
    const nowISO = now.toISOString();
    const deviceName = localStorage.getItem('brimoDeviceName') || 'Unknown Device';
    const profit = sellingPrice - costPrice;
    const splitTransferAmount = sellingPrice - (splitTunaiAmount || 0);
    
    try {
        const auditDocRef = await addDoc(collection(firestore, 'ppobTransactions'), {
            date: now,
            serviceName: 'Paket Telpon',
            destination: values.packageName,
            description: `Paket Telpon: ${values.packageName}`,
            costPrice: values.costPrice,
            sellingPrice: values.sellingPrice,
            profit,
            sourcePPOBAccountId: values.sourcePPOBAccountId,
            paymentMethod: values.paymentMethod,
            paymentToKasTunaiAmount: paymentMethod === 'Tunai' ? sellingPrice : (paymentMethod === 'Split' ? splitTunaiAmount : 0),
            paymentToKasTransferAccountId: paymentMethod === 'Transfer' || paymentMethod === 'Split' ? values.paymentToKasTransferAccountId : null,
            paymentToKasTransferAmount: paymentMethod === 'Transfer' ? sellingPrice : (paymentMethod === 'Split' ? splitTransferAmount : 0),
            deviceName
        });
        const auditId = auditDocRef.id;

        await runTransaction(firestore, async (transaction) => {
            const sourcePPOBAccountRef = doc(firestore, 'kasAccounts', sourcePPOBAccount.id);
            const laciAccountRef = laciAccount ? doc(firestore, 'kasAccounts', laciAccount.id) : null;
            const paymentAccRef = paymentTransferAccount ? doc(firestore, 'kasAccounts', paymentTransferAccount.id) : null;

            const [sourceDoc, laciDoc, paymentDoc] = await Promise.all([
                transaction.get(sourcePPOBAccountRef),
                laciAccountRef ? transaction.get(laciAccountRef) : Promise.resolve(null),
                paymentAccRef ? transaction.get(paymentAccRef) : Promise.resolve(null),
            ]);

            if (!sourceDoc.exists()) throw new Error("Akun sumber PPOB tidak ditemukan.");
            
            const currentSourcePPOBBalance = sourceDoc.data().balance;
            if (currentSourcePPOBBalance < costPrice) throw new Error(`Saldo ${sourcePPOBAccount.label} tidak mencukupi.`);
            
            transaction.update(sourcePPOBAccountRef, { balance: currentSourcePPOBBalance - costPrice });
            const debitTxRef = doc(collection(sourcePPOBAccountRef, 'transactions'));
            transaction.set(debitTxRef, {
                kasAccountId: sourcePPOBAccount.id, type: 'debit', name: `Beli ${values.packageName}`, account: 'PPOB', date: nowISO, amount: costPrice, balanceBefore: currentSourcePPOBBalance, balanceAfter: currentSourcePPOBBalance - costPrice, category: 'ppob_purchase', deviceName, auditId
            });
            
            switch (paymentMethod) {
                case 'Tunai':
                    if (!laciAccountRef || !laciDoc || !laciDoc.exists()) throw new Error("Akun Laci tidak ditemukan.");
                    const currentLaciBalance = laciDoc.data().balance;
                    transaction.update(laciAccountRef, { balance: currentLaciBalance + sellingPrice });
                    const creditTunaiRef = doc(collection(laciAccountRef, 'transactions'));
                    transaction.set(creditTunaiRef, {
                         kasAccountId: laciAccount.id, type: 'credit', name: `Bayar ${values.packageName}`, account: 'Pelanggan', date: nowISO, amount: sellingPrice, balanceBefore: currentLaciBalance, balanceAfter: currentLaciBalance + sellingPrice, category: 'customer_payment_ppob', deviceName, auditId
                    });
                    break;
                case 'Transfer':
                    if (!paymentAccRef || !paymentDoc || !paymentDoc.exists()) throw new Error("Akun penerima pembayaran tidak valid.");
                    const currentPaymentBalance = paymentDoc.data().balance;
                    transaction.update(paymentAccRef, { balance: currentPaymentBalance + sellingPrice });
                    const creditTransferRef = doc(collection(paymentAccRef, 'transactions'));
                    transaction.set(creditTransferRef, {
                        kasAccountId: paymentTransferAccount!.id, type: 'credit', name: `Bayar ${values.packageName}`, account: 'Pelanggan', date: nowISO, amount: sellingPrice, balanceBefore: currentPaymentBalance, balanceAfter: currentPaymentBalance + sellingPrice, category: 'customer_payment_ppob', deviceName, auditId
                    });
                    break;
                case 'Split':
                    if (!laciAccountRef || !laciDoc || !laciDoc.exists()) throw new Error("Akun Laci tidak ditemukan.");
                    if (!paymentAccRef || !paymentDoc || !paymentDoc.exists()) throw new Error("Akun penerima pembayaran split tidak valid.");
                    if (!splitTunaiAmount) throw new Error("Jumlah tunai split tidak valid.");

                    const currentLaciSplitBalance = laciDoc.data().balance;
                    transaction.update(laciAccountRef, { balance: currentLaciSplitBalance + splitTunaiAmount });
                    const creditSplitTunaiRef = doc(collection(laciAccountRef, 'transactions'));
                    transaction.set(creditSplitTunaiRef, {
                         kasAccountId: laciAccount.id, type: 'credit', name: `Bayar Tunai ${values.packageName}`, account: 'Pelanggan', date: nowISO, amount: splitTunaiAmount, balanceBefore: currentLaciSplitBalance, balanceAfter: currentLaciSplitBalance + splitTunaiAmount, category: 'customer_payment_ppob', deviceName, auditId
                    });

                    const currentPaymentSplitBalance = paymentDoc.data().balance;
                    transaction.update(paymentAccRef, { balance: currentPaymentSplitBalance + splitTransferAmount });
                    const creditSplitTransferRef = doc(collection(paymentAccRef, 'transactions'));
                    transaction.set(creditSplitTransferRef, {
                        kasAccountId: paymentTransferAccount!.id, type: 'credit', name: `Bayar Transfer ${values.packageName}`, account: 'Pelanggan', date: nowISO, amount: splitTransferAmount, balanceBefore: currentPaymentSplitBalance, balanceAfter: currentPaymentSplitBalance + splitTransferAmount, category: 'customer_payment_ppob', deviceName, auditId
                    });
                    break;
            }
        });

        handleTransactionComplete();
    } catch (error: any) {
        console.error("Error saving PPOB Paket Telpon transaction: ", error);
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

            {currentStep === 1 && (
                <div className="space-y-4">
                    <FormLabel>Pilih Sumber Deposit PPOB</FormLabel>
                    <div className="grid grid-cols-2 gap-4">
                    {ppobAccounts?.map((acc) => (
                        <Card 
                            key={acc.id} 
                            onClick={() => { form.setValue('sourcePPOBAccountId', acc.id); setCurrentStep(2); }} 
                            className="cursor-pointer hover:ring-2 hover:ring-primary transition relative overflow-hidden group aspect-[1.5/1]"
                        >
                            <CardContent className="p-0 flex flex-col items-center justify-center h-full text-center">
                               {acc.iconUrl ? (
                                    <Image src={acc.iconUrl} alt={acc.label} fill className="object-cover" />
                                ) : (
                                    <div className="p-2">
                                        <p className="font-semibold text-lg">{acc.label}</p>
                                        <p className="text-xs text-muted-foreground">{formatToRupiah(acc.balance)}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                    </div>
                     {ppobAccounts?.length === 0 && <p className='text-sm text-muted-foreground text-center py-8'>Tidak ada Akun Kas dengan tipe "PPOB". Silakan buat terlebih dahulu di menu Admin.</p>}
                </div>
            )}
            
            {currentStep > 1 && selectedPPOBAccount && (
                 <Card className="mb-4">
                    <CardContent className="p-3 flex justify-between items-center">
                        <div>
                            <p className="text-xs text-muted-foreground">Sumber Dana PPOB</p>
                            <p className="font-semibold">{selectedPPOBAccount.label}</p>
                        </div>
                        <Button variant="link" size="sm" onClick={() => setCurrentStep(1)}>Ganti</Button>
                    </CardContent>
                 </Card>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <FormField control={form.control} name="packageName" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Nama Paket</FormLabel>
                        <FormControl><Input placeholder="cth: Telpon 1 Minggu All Operator" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}/>

                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="costPrice" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Harga Modal</FormLabel>
                            <FormControl><Input type="text" placeholder="Rp 0" {...field} value={formatToRupiah(field.value)} onChange={(e) => field.onChange(parseRupiah(e.target.value))} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>
                    <FormField control={form.control} name="sellingPrice" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Harga Jual</FormLabel>
                            <FormControl><Input type="text" placeholder="Rp 0" {...field} value={formatToRupiah(field.value)} onChange={(e) => field.onChange(parseRupiah(e.target.value))} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>
                </div>

                <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                    <FormItem className="space-y-3 pt-2">
                    <FormLabel>Metode Pembayaran Pelanggan</FormLabel>
                    <FormControl>
                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                        <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Tunai" /></FormControl><FormLabel className="font-normal">Tunai</FormLabel></FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Transfer" /></FormControl><FormLabel className="font-normal">Transfer</FormLabel></FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Split" /></FormControl><FormLabel className="font-normal">Split Bill</FormLabel></FormItem>
                        </RadioGroup>
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}/>

                {paymentMethod === 'Transfer' && (
                    <FormField control={form.control} name="paymentToKasTransferAccountId" render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Akun Penerima Bayaran</FormLabel>
                           <Popover open={paymentPopoverOpen} onOpenChange={setPaymentPopoverOpen}>
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
                                    ? kasAccounts?.find(
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
                                  {kasAccounts?.map((acc) => (
                                    <CommandItem
                                      value={acc.label}
                                      key={acc.id}
                                      onSelect={() => {
                                        form.setValue("paymentToKasTransferAccountId", acc.id)
                                        setPaymentPopoverOpen(false)
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
                                      {acc.label}
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
                )}

                {paymentMethod === 'Split' && (
                    <div className='p-4 border rounded-lg space-y-4'>
                        <FormField control={form.control} name="splitTunaiAmount" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Jumlah Dibayar Tunai</FormLabel>
                                <FormControl><Input type="text" placeholder="Rp 0" {...field} value={formatToRupiah(field.value)} onChange={(e) => field.onChange(parseRupiah(e.target.value))} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}/>
                        <FormField control={form.control} name="paymentToKasTransferAccountId" render={({ field }) => (
                            <FormItem className="flex flex-col">
                            <FormLabel>Akun Penerima Sisa Bayaran (Transfer)</FormLabel>
                            <Popover open={paymentPopoverOpen} onOpenChange={setPaymentPopoverOpen}>
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
                                        ? kasAccounts?.find(
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
                                    {kasAccounts?.map((acc) => (
                                        <CommandItem
                                        value={acc.label}
                                        key={acc.id}
                                        onSelect={() => {
                                            form.setValue("paymentToKasTransferAccountId", acc.id)
                                            setPaymentPopoverOpen(false)
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
                                        {acc.label}
                                        </CommandItem>
                                    ))}
                                    </ScrollArea>
                                    </CommandGroup>
                                </Command>
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                            </FormItem>
                        )}/>
                    </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="flex gap-2 pt-0 pb-4 border-t border-border -mx-6 px-6 pt-4">
          <Button type="button" variant="outline" onClick={onDone} className="w-full" disabled={isSaving}>Batal</Button>
          <Button type="submit" className="w-full" disabled={isSaving || currentStep !== 2}>
            {isSaving ? <Loader2 className="animate-spin" /> : "Simpan Transaksi"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
