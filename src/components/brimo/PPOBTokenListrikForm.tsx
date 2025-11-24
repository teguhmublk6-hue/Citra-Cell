
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, runTransaction, addDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { startOfDay } from 'date-fns';
import type { KasAccount } from '@/lib/data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { useState, useEffect, useMemo, useCallback } from 'react';
import type { PPOBTokenListrikFormValues } from '@/lib/types';
import { PPOBTokenListrikFormSchema } from '@/lib/types';
import { Card, CardContent } from '../ui/card';
import Image from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';

interface PPOBTokenListrikFormProps {
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

export default function PPOBTokenListrikForm({ onTransactionComplete, onDone }: PPOBTokenListrikFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isManualDenom, setIsManualDenom] = useState(false);
  
  const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);
  
  const pricingDocRef = useMemoFirebase(() => doc(firestore, 'appConfig', 'ppobPricing'), [firestore]);
  const { data: ppobPricingData } = useDoc<{ data: any }>(pricingDocRef);

  const refinedSchema = PPOBTokenListrikFormSchema.superRefine((data, ctx) => {
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

  const form = useForm<PPOBTokenListrikFormValues>({
    resolver: zodResolver(refinedSchema),
    defaultValues: {
        sourcePPOBAccountId: '',
        customerName: '',
        denomination: '',
        costPrice: undefined,
        sellingPrice: undefined,
        paymentMethod: 'Tunai',
        paymentToKasTransferAccountId: '',
        splitTunaiAmount: undefined,
    },
  });

  const paymentMethod = form.watch('paymentMethod');
  const denomination = form.watch('denomination');
  const sourcePPOBAccountId = form.watch('sourcePPOBAccountId');

  const selectedPPOBAccount = useMemo(() => kasAccounts?.find(acc => acc.id === sourcePPOBAccountId), [kasAccounts, sourcePPOBAccountId]);

  const availableDenominations = useMemo(() => {
    const tokenPricing = ppobPricingData?.data?.['Token Listrik'];
    if (tokenPricing) {
      return Object.keys(tokenPricing).sort((a,b) => parseInt(a, 10) - parseInt(b, 10));
    }
    return [];
  }, [ppobPricingData]);

  useEffect(() => {
    if (denomination && ppobPricingData && !isManualDenom) {
      const pricing = ppobPricingData.data?.['Token Listrik'];
      const denomPrice = pricing ? pricing[denomination] : null;

      if (denomPrice) {
        form.setValue('costPrice', denomPrice.costPrice);
        form.setValue('sellingPrice', denomPrice.sellingPrice);
      } else {
        form.setValue('costPrice', undefined);
        form.setValue('sellingPrice', undefined);
      }
    }
  }, [denomination, form, ppobPricingData, isManualDenom]);


  const ppobAccounts = useMemo(() => {
    return kasAccounts?.filter(acc => acc.type === 'PPOB' && ['Mitra Shopee', 'Mitra Bukalapak'].includes(acc.label));
  }, [kasAccounts]);

  const onSubmit = (values: PPOBTokenListrikFormValues) => {
    onTransactionComplete(() => proceedWithTransaction(values));
  };
  
  const proceedWithTransaction = useCallback(async (values: PPOBTokenListrikFormValues, force = false): Promise<any> => {
    if (!firestore || !selectedPPOBAccount || !kasAccounts) {
        toast({ variant: "destructive", title: "Error", description: "Database atau akun tidak ditemukan." });
        throw new Error("Database atau akun tidak ditemukan.");
    }
    
    if (!force) {
        const transactionsRef = collection(firestore, 'ppobTransactions');
        const todayStart = startOfDay(new Date());
        const q = query(transactionsRef, where('date', '>=', Timestamp.fromDate(todayStart)));

        try {
            const querySnapshot = await getDocs(q);
            const todaysTransactions = querySnapshot.docs.map(doc => doc.data());
            
            const isDuplicate = todaysTransactions.some(trx => 
                trx.serviceName === 'Token Listrik' &&
                trx.destination === values.customerName &&
                normalizeString(trx.description) === normalizeString(`Token ${values.denomination} an. ${values.customerName}`) &&
                trx.sourcePPOBAccountId === values.sourcePPOBAccountId
            );

            if (isDuplicate) {
              return Promise.reject({ duplicate: true, onConfirm: () => proceedWithTransaction(values, true) });
            }
        } catch (error) {
            console.error("Error checking for duplicates:", error);
        }
    }

    const laciAccount = kasAccounts.find(acc => acc.label === "Laci");
    const paymentTransferAccount = kasAccounts.find(acc => acc.id === values.paymentToKasTransferAccountId);
    const { costPrice, sellingPrice, paymentMethod, splitTunaiAmount } = values;

    if (!laciAccount && (paymentMethod === 'Tunai' || paymentMethod === 'Split')) {
        toast({ variant: "destructive", title: "Akun Laci Tidak Ditemukan", description: "Pastikan akun kas 'Laci' dengan tipe 'Tunai' sudah dibuat." });
        throw new Error("Akun Laci Tidak Ditemukan");
    }

    if (selectedPPOBAccount.balance < costPrice) {
        toast({ variant: "destructive", title: "Deposit Tidak Cukup", description: `Deposit ${selectedPPOBAccount.label} tidak mencukupi.` });
        throw new Error(`Deposit ${selectedPPOBAccount.label} tidak mencukupi.`);
    }

    const now = new Date();
    const nowISO = now.toISOString();
    const deviceName = localStorage.getItem('brimoDeviceName') || 'Unknown Device';
    const profit = sellingPrice - costPrice;
    const splitTransferAmount = sellingPrice - (splitTunaiAmount || 0);
    
    try {
        const auditDocRef = await addDocumentNonBlocking(collection(firestore, 'ppobTransactions'), {
            date: now,
            serviceName: 'Token Listrik',
            destination: values.customerName,
            description: `Token ${values.denomination} an. ${values.customerName}`,
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
        
        if (!auditDocRef) throw new Error("Gagal membuat catatan audit.");
        const auditId = auditDocRef.id;

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
            if (currentSourcePPOBBalance < costPrice) throw new Error(`Saldo ${selectedPPOBAccount.label} tidak mencukupi.`);
            
            transaction.update(sourcePPOBAccountRef, { balance: currentSourcePPOBBalance - costPrice });
            const debitTxRef = doc(collection(sourcePPOBAccountRef, 'transactions'));
            transaction.set(debitTxRef, {
                kasAccountId: selectedPPOBAccount.id, type: 'debit', name: `Beli Token Listrik ${values.denomination}`, account: values.customerName, date: nowISO, amount: costPrice, balanceBefore: currentSourcePPOBBalance, balanceAfter: currentSourcePPOBBalance - costPrice, category: 'ppob_purchase', deviceName, auditId
            });
            
            switch (paymentMethod) {
                case 'Tunai':
                    if (!laciAccountRef || !laciDoc || !laciDoc.exists()) throw new Error("Akun Laci tidak ditemukan.");
                    const currentLaciBalance = laciDoc.data().balance;
                    transaction.update(laciAccountRef, { balance: currentLaciBalance + sellingPrice });
                    const creditTunaiRef = doc(collection(laciAccountRef, 'transactions'));
                    transaction.set(creditTunaiRef, {
                         kasAccountId: laciAccount.id, type: 'credit', name: `Bayar Token ${values.denomination}`, account: values.customerName, date: nowISO, amount: sellingPrice, balanceBefore: currentLaciBalance, balanceAfter: currentLaciBalance + sellingPrice, category: 'customer_payment_ppob', deviceName, auditId
                    });
                    break;
                case 'Transfer':
                    if (!paymentAccRef || !paymentDoc || !paymentDoc.exists()) throw new Error("Akun penerima pembayaran tidak valid.");
                    const currentPaymentBalance = paymentDoc.data().balance;
                    transaction.update(paymentAccRef, { balance: currentPaymentBalance + sellingPrice });
                    const creditTransferRef = doc(collection(paymentAccRef, 'transactions'));
                    transaction.set(creditTransferRef, {
                        kasAccountId: paymentTransferAccount!.id, type: 'credit', name: `Bayar Token ${values.denomination}`, account: values.customerName, date: nowISO, amount: sellingPrice, balanceBefore: currentPaymentBalance, balanceAfter: currentPaymentBalance + sellingPrice, category: 'customer_payment_ppob', deviceName, auditId
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
                         kasAccountId: laciAccount.id, type: 'credit', name: `Bayar Tunai Token`, account: values.customerName, date: nowISO, amount: splitTunaiAmount, balanceBefore: currentLaciSplitBalance, balanceAfter: currentLaciSplitBalance + splitTunaiAmount, category: 'customer_payment_ppob', deviceName, auditId
                    });

                    const currentPaymentSplitBalance = paymentDoc.data().balance;
                    transaction.update(paymentAccRef, { balance: currentPaymentSplitBalance + splitTransferAmount });
                    const creditSplitTransferRef = doc(collection(paymentAccRef, 'transactions'));
                    transaction.set(creditSplitTransferRef, {
                        kasAccountId: paymentTransferAccount!.id, type: 'credit', name: `Bayar Transfer Token`, account: values.customerName, date: nowISO, amount: splitTransferAmount, balanceBefore: currentPaymentSplitBalance, balanceAfter: currentPaymentSplitBalance + splitTransferAmount, category: 'customer_payment_ppob', deviceName, auditId
                    });
                    break;
            }
        });
    } catch (error: any) {
        console.error("Error saving PPOB Token Listrik transaction: ", error);
        throw error;
    } finally {
        setIsSaving(false);
    }
  }, [firestore, kasAccounts, selectedPPOBAccount, toast]);
  
  const handleDenomClick = (denom: string) => {
    form.setValue('denomination', denom, { shouldValidate: true });
    setIsManualDenom(false);
  }
  
  const handleResetDenom = () => {
    form.setValue('denomination', '', { shouldValidate: true });
    form.setValue('costPrice', undefined);
    form.setValue('sellingPrice', undefined);
  }

  const handleManualClick = () => {
    handleResetDenom();
    setIsManualDenom(true);
  }

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
                        <FormLabel>Nama Pemilik Meteran</FormLabel>
                        <FormControl><Input placeholder="Masukkan nama..." {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}/>
                
                <FormField control={form.control} name="denomination" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Pilih Denominasi Token</FormLabel>
                        {field.value && !isManualDenom ? (
                             <div className="flex items-center gap-2">
                                <Button type="button" className="flex-1" disabled>Rp {parseInt(field.value, 10).toLocaleString('id-ID')}</Button>
                                <Button type="button" variant="outline" onClick={handleResetDenom}>Ganti</Button>
                             </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                {availableDenominations.map(denom => (
                                    <Button key={denom} type="button" variant='outline' onClick={() => handleDenomClick(denom)}>
                                        {parseInt(denom, 10).toLocaleString('id-ID')}
                                    </Button>
                                ))}
                                <Button type="button" variant={isManualDenom ? 'default' : 'outline'} onClick={handleManualClick}>
                                    Manual
                                </Button>
                            </div>
                        )}

                        {isManualDenom && (
                             <FormControl className="mt-2">
                                <Input 
                                    placeholder="Masukkan nominal, cth: 20000" 
                                    onChange={(e) => field.onChange(e.target.value)}
                                    type="tel"
                                    autoFocus
                                />
                             </FormControl>
                        )}
                        <FormMessage />
                    </FormItem>
                )}/>

                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="costPrice" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Harga Modal</FormLabel>
                            <FormControl><Input type="tel" placeholder="Rp 0" {...field} value={formatToRupiah(field.value)} onChange={(e) => field.onChange(parseRupiah(e.target.value))} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>
                    <FormField control={form.control} name="sellingPrice" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Harga Jual</FormLabel>
                            <FormControl><Input type="tel" placeholder="Rp 0" {...field} value={formatToRupiah(field.value)} onChange={(e) => field.onChange(parseRupiah(e.target.value))} /></FormControl>
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
                        <FormItem>
                        <FormLabel>Akun Penerima Bayaran</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Pilih akun penerima" /></SelectTrigger></FormControl>
                            <SelectContent>{kasAccounts?.map(acc => (<SelectItem key={acc.id} value={acc.id}>{acc.label}</SelectItem>))}</SelectContent>
                        </Select>
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
                            <FormItem>
                            <FormLabel>Akun Penerima Sisa Bayaran (Transfer)</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Pilih akun penerima" /></SelectTrigger></FormControl>
                                <SelectContent>{kasAccounts?.map(acc => (<SelectItem key={acc.id} value={acc.id}>{acc.label}</SelectItem>))}</SelectContent>
                            </Select>
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
