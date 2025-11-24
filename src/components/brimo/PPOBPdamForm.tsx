
"use client";

import { useForm, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, runTransaction, addDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import type { KasAccount } from '@/lib/data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { PPOBPdamFormValues } from '@/lib/types';
import { PPOBPdamFormSchema } from '@/lib/types';
import { Card, CardContent } from '../ui/card';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '../ui/command';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { startOfDay } from 'date-fns';

interface PPOBPdamFormProps {
  onTransactionComplete: (transactionPromise: () => Promise<any>) => void;
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

const normalizeString = (str: string) => {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}


export default function PPOBPdamForm({ onTransactionComplete, onDone }: PPOBPdamFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [paymentPopoverOpen, setPaymentPopoverOpen] = useState(false);
  
  const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

  const form = useForm<PPOBPdamFormValues>({
    resolver: zodResolver(PPOBPdamFormSchema),
    defaultValues: {
        sourcePPOBAccountId: '',
        customerName: '',
        billAmount: undefined,
        totalAmount: undefined,
        cashback: 0,
        paymentMethod: 'Tunai',
        paymentToKasTransferAccountId: '',
        splitTunaiAmount: undefined,
    },
  });

  const paymentMethod = form.watch('paymentMethod');
  const sourcePPOBAccountId = form.watch('sourcePPOBAccountId');

  const selectedPPOBAccount = useMemo(() => kasAccounts?.find(acc => acc.id === sourcePPOBAccountId), [kasAccounts, sourcePPOBAccountId]);

  useEffect(() => {
    if (selectedPPOBAccount?.label === 'Mitra Bukalapak') {
      form.setValue('cashback', 700);
    } else {
      form.setValue('cashback', 0);
    }
  }, [selectedPPOBAccount, form]);

  const ppobAccounts = useMemo(() => {
    return kasAccounts?.filter(acc => acc.type === 'PPOB' && ['Mitra Shopee', 'Mitra Bukalapak'].includes(acc.label));
  }, [kasAccounts]);
  
  const inputRefs = {
    customerName: useRef<HTMLInputElement>(null),
    billAmount: useRef<HTMLInputElement>(null),
    totalAmount: useRef<HTMLInputElement>(null),
    cashback: useRef<HTMLInputElement>(null),
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentField: keyof typeof inputRefs, nextField?: keyof typeof inputRefs) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextField && inputRefs[nextField]?.current) {
        inputRefs[nextField].current?.focus();
      } else {
        currentField in inputRefs && inputRefs[currentField].current?.blur();
      }
    }
  };


  const onSubmit = async (values: PPOBPdamFormValues) => {
    onTransactionComplete(() => proceedWithTransaction(values));
  };
  
  const proceedWithTransaction = useCallback(async (values: PPOBPdamFormValues, force = false): Promise<any> => {
    if (!firestore || !selectedPPOBAccount || !kasAccounts) {
        toast({ variant: "destructive", title: "Error", description: "Database atau akun tidak ditemukan." });
        throw new Error("Database atau akun tidak ditemukan.");
    }

    if (!force) {
        const transactionsRef = collection(firestore, 'ppobPdam');
        const todayStart = startOfDay(new Date());
        const q = query(transactionsRef, where('date', '>=', Timestamp.fromDate(todayStart)));

        try {
            const querySnapshot = await getDocs(q);
            const todaysTransactions = querySnapshot.docs.map(doc => doc.data() as PPOBPdam);
            const normalizedNewName = normalizeString(values.customerName);

            const isDuplicate = todaysTransactions.some(trx => 
                trx.sourcePPOBAccountId === values.sourcePPOBAccountId &&
                normalizeString(trx.customerName) === normalizedNewName &&
                trx.billAmount === values.billAmount
            );

            if (isDuplicate) {
              return Promise.reject({ duplicate: true, onConfirm: () => proceedWithTransaction(values, true) });
            }
        } catch (error) {
            console.error("Error checking for duplicates:", error);
            // Non-fatal, proceed with transaction
        }
    }

    const laciAccount = kasAccounts.find(acc => acc.label === "Laci");
    const paymentTransferAccount = kasAccounts.find(acc => acc.id === values.paymentToKasTransferAccountId);
    const { billAmount, totalAmount, cashback, paymentMethod, splitTunaiAmount } = values;

    if (!laciAccount && (paymentMethod === 'Tunai' || paymentMethod === 'Split')) {
        toast({ variant: "destructive", title: "Akun Laci Tidak Ditemukan", description: "Pastikan akun kas 'Laci' dengan tipe 'Tunai' sudah dibuat." });
        throw new Error("Akun Laci Tidak Ditemukan");
    }

    if (selectedPPOBAccount.balance < billAmount) {
        toast({ variant: "destructive", title: "Deposit Tidak Cukup", description: `Deposit ${selectedPPOBAccount.label} tidak mencukupi.` });
        throw new Error(`Deposit ${selectedPPOBAccount.label} tidak mencukupi.`);
    }

    const now = new Date();
    const deviceName = localStorage.getItem('brimoDeviceName') || 'Unknown Device';
    const netProfit = (totalAmount - billAmount) + (cashback || 0);
    const splitTransferAmount = totalAmount - (splitTunaiAmount || 0);
    
    try {
        const auditDocRef = await addDocumentNonBlocking(collection(firestore, 'ppobPdam'), {
            date: now,
            customerName: values.customerName,
            billAmount: values.billAmount,
            totalAmount: values.totalAmount,
            cashback: values.cashback || 0,
            netProfit,
            sourcePPOBAccountId: values.sourcePPOBAccountId,
            paymentMethod: values.paymentMethod,
            paymentToKasTunaiAmount: paymentMethod === 'Tunai' ? totalAmount : (paymentMethod === 'Split' ? splitTunaiAmount : 0),
            paymentToKasTransferAccountId: paymentMethod === 'Transfer' || paymentMethod === 'Split' ? values.paymentToKasTransferAccountId : null,
            paymentToKasTransferAmount: paymentMethod === 'Transfer' ? totalAmount : (paymentMethod === 'Split' ? splitTransferAmount : 0),
            deviceName
        });
        
        if (!auditDocRef) throw new Error("Gagal membuat catatan audit.");
        const auditId = auditDocRef.id;
        const nowISO = now.toISOString();

        await runTransaction(firestore, async (transaction) => {
            const sourcePPOBAccountRef = doc(firestore, 'kasAccounts', selectedPPOBAccount.id);
            const laciAccountRef = laciAccount ? doc(firestore, 'kasAccounts', laciAccount.id) : null;
            const paymentAccRef = paymentTransferAccount ? doc(firestore, 'kasAccounts', paymentTransferAccount.id) : null;

            const [sourceDoc, laciDoc, paymentDoc] = await Promise.all([
                transaction.get(sourcePPOBAccountRef),
                laciAccountRef ? transaction.get(laciAccountRef) : Promise.resolve(null),
                paymentAccRef ? transaction.get(paymentAccRef) : Promise.resolve(null),
            ]);

            if (!sourceDoc.exists()) throw new Error("Akun sumber PPOB tidak ditemukan.");
            
            const currentSourcePPOBBalance = sourceDoc.data().balance;
            if (currentSourcePPOBBalance < billAmount) throw new Error(`Saldo ${selectedPPOBAccount.label} tidak mencukupi.`);
            
            const balanceAfterDebit = currentSourcePPOBBalance - billAmount;
            const finalSourceBalance = cashback ? balanceAfterDebit + cashback : balanceAfterDebit;
            transaction.update(sourcePPOBAccountRef, { balance: finalSourceBalance });

            const debitTxRef = doc(collection(sourcePPOBAccountRef, 'transactions'));
            transaction.set(debitTxRef, {
                kasAccountId: selectedPPOBAccount.id, type: 'debit', name: `Bayar Tagihan PDAM`, account: values.customerName, date: nowISO, amount: billAmount, balanceBefore: currentSourcePPOBBalance, balanceAfter: balanceAfterDebit, category: 'ppob_pdam_payment', deviceName, auditId
            });

            if (cashback && cashback > 0) {
                 const cashbackTxRef = doc(collection(sourcePPOBAccountRef, 'transactions'));
                 transaction.set(cashbackTxRef, {
                    kasAccountId: selectedPPOBAccount.id, type: 'credit', name: `Cashback Tagihan PDAM`, account: selectedPPOBAccount.label, date: nowISO, amount: cashback, balanceBefore: balanceAfterDebit, balanceAfter: finalSourceBalance, category: 'ppob_pdam_cashback', deviceName, auditId
                 });
            }
            
            switch (paymentMethod) {
                case 'Tunai':
                    if (!laciAccountRef || !laciDoc || !laciDoc.exists()) throw new Error("Akun Laci tidak ditemukan.");
                    const currentLaciBalance = laciDoc.data().balance;
                    transaction.update(laciAccountRef, { balance: currentLaciBalance + totalAmount });
                    const creditTunaiRef = doc(collection(laciAccountRef, 'transactions'));
                    transaction.set(creditTunaiRef, {
                         kasAccountId: laciAccount.id, type: 'credit', name: `Bayar Tagihan PDAM`, account: values.customerName, date: nowISO, amount: totalAmount, balanceBefore: currentLaciBalance, balanceAfter: currentLaciBalance + totalAmount, category: 'ppob_pdam_payment', deviceName, auditId
                    });
                    break;
                case 'Transfer':
                    if (!paymentAccRef || !paymentDoc || !paymentDoc.exists()) throw new Error("Akun penerima pembayaran tidak valid.");
                    const currentPaymentBalance = paymentDoc.data().balance;
                    transaction.update(paymentAccRef, { balance: currentPaymentBalance + totalAmount });
                    const creditTransferRef = doc(collection(paymentAccRef, 'transactions'));
                    transaction.set(creditTransferRef, {
                        kasAccountId: paymentTransferAccount!.id, type: 'credit', name: `Bayar Tagihan PDAM`, account: values.customerName, date: nowISO, amount: totalAmount, balanceBefore: currentPaymentBalance, balanceAfter: currentPaymentBalance + totalAmount, category: 'ppob_pdam_payment', deviceName, auditId
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
                         kasAccountId: laciAccount.id, type: 'credit', name: `Bayar Tunai Tagihan PDAM`, account: values.customerName, date: nowISO, amount: splitTunaiAmount, balanceBefore: currentLaciSplitBalance, balanceAfter: currentLaciSplitBalance + splitTunaiAmount, category: 'ppob_pdam_payment', deviceName, auditId
                    });

                    const currentPaymentSplitBalance = paymentDoc.data().balance;
                    transaction.update(paymentAccRef, { balance: currentPaymentSplitBalance + splitTransferAmount });
                    const creditSplitTransferRef = doc(collection(paymentAccRef, 'transactions'));
                    transaction.set(creditSplitTransferRef, {
                        kasAccountId: paymentTransferAccount!.id, type: 'credit', name: `Bayar Transfer Tagihan PDAM`, account: values.customerName, date: nowISO, amount: splitTransferAmount, balanceBefore: currentPaymentSplitBalance, balanceAfter: currentPaymentSplitBalance + splitTransferAmount, category: 'ppob_pdam_payment', deviceName, auditId
                    });
                    break;
            }
        });
    } catch (error: any) {
        console.error("Error saving PPOB PDAM transaction: ", error);
        throw error;
    }
  }, [firestore, kasAccounts, selectedPPOBAccount, toast]);
  
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
                            className="cursor-pointer hover:ring-2 hover:ring-primary transition relative overflow-hidden group aspect-video"
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
                     {ppobAccounts?.length === 0 && <p className='text-sm text-muted-foreground text-center py-8'>Tidak ada Akun Kas "Mitra Shopee" atau "Mitra Bukalapak". Silakan buat terlebih dahulu di menu Admin.</p>}
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
                 <FormField control={form.control} name="customerName" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Nama Pelanggan</FormLabel>
                        <FormControl>
                            <Input 
                                placeholder="Masukkan nama..." {...field} ref={inputRefs.customerName}
                                onKeyDown={(e) => handleKeyDown(e, 'customerName', 'billAmount')}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}/>
                
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="billAmount" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Jumlah Tagihan (Modal)</FormLabel>
                            <FormControl>
                                <Input 
                                    type="tel" placeholder="Rp 0" {...field}
                                    value={formatToRupiah(field.value)} onChange={(e) => field.onChange(parseRupiah(e.target.value))} 
                                    ref={inputRefs.billAmount}
                                    onKeyDown={(e) => handleKeyDown(e, 'billAmount', 'totalAmount')}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>
                    <FormField control={form.control} name="totalAmount" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Total Tagihan (Jual)</FormLabel>
                             <FormControl>
                                <Input 
                                    type="tel" placeholder="Rp 0" {...field}
                                    value={formatToRupiah(field.value)} onChange={(e) => field.onChange(parseRupiah(e.target.value))} 
                                    ref={inputRefs.totalAmount}
                                    onKeyDown={(e) => handleKeyDown(e, 'totalAmount', selectedPPOBAccount?.label === 'Mitra Bukalapak' ? 'cashback' : undefined)}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>
                </div>
                
                {selectedPPOBAccount?.label === 'Mitra Bukalapak' && (
                    <FormField control={form.control} name="cashback" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Cashback</FormLabel>
                             <FormControl>
                                <Input 
                                    type="tel" placeholder="Rp 0" {...field}
                                    value={formatToRupiah(field.value)} onChange={(e) => field.onChange(parseRupiah(e.target.value))}
                                    ref={inputRefs.cashback}
                                    onKeyDown={(e) => handleKeyDown(e, 'cashback')}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>
                )}

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
                                <FormControl><Input type="tel" placeholder="Rp 0" {...field} value={formatToRupiah(field.value)} onChange={(e) => field.onChange(parseRupiah(e.target.value))} /></FormControl>
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
