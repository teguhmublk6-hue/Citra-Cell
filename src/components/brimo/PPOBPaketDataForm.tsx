
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, runTransaction, addDoc } from 'firebase/firestore';
import type { KasAccount } from '@/lib/data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { useState, useEffect, useMemo } from 'react';
import type { PPOBPaketDataFormValues } from '@/lib/types';
import { PPOBPaketDataFormSchema } from '@/lib/types';
import { Card, CardContent } from '../ui/card';
import Image from 'next/image';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface PPOBPaketDataFormProps {
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

const providers = [
    { name: 'Telkomsel', prefixes: ['0811', '0812', '0813', '0821', '0822', '0852', '0853', '0823', '0851'] },
    { name: 'Indosat', prefixes: ['0814', '0815', '0816', '0855', '0856', '0857', '0858'] },
    { name: 'XL', prefixes: ['0817', '0818', '0819', '0859', '0877', '0878'] },
    { name: 'Axis', prefixes: ['0838', '0831', '0832', '0833'] },
    { name: 'Tri', prefixes: ['0895', '0896', '0897', '0898', '0899'] },
    { name: 'Smartfren', prefixes: ['0881', '0882', '0883', '0884', '0885', '0886', '0887', '0888', '0889'] },
];

export default function PPOBPaketDataForm({ onTransactionComplete, onDone }: PPOBPaketDataFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [detectedProvider, setDetectedProvider] = useState<string | null>(null);
  const [isManualPackage, setIsManualPackage] = useState(false);
  const [packagePopoverOpen, setPackagePopoverOpen] = useState(false);
  
  const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);
  
  const pricingDocRef = useMemoFirebase(() => doc(firestore, 'appConfig', 'ppobPricing'), [firestore]);
  const { data: ppobPricingData } = useDoc<{ data: any }>(pricingDocRef);


  const refinedSchema = PPOBPaketDataFormSchema.superRefine((data, ctx) => {
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

  const form = useForm<PPOBPaketDataFormValues>({
    resolver: zodResolver(refinedSchema),
    defaultValues: {
        sourcePPOBAccountId: '',
        phoneNumber: '',
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
  const phoneNumber = form.watch('phoneNumber');
  const packageName = form.watch('packageName');

  const selectedPPOBAccount = useMemo(() => kasAccounts?.find(acc => acc.id === sourcePPOBAccountId), [kasAccounts, sourcePPOBAccountId]);

  useEffect(() => {
    const prefix = phoneNumber.substring(0, 4);
    const foundProvider = providers.find(p => p.prefixes.includes(prefix));
    setDetectedProvider(foundProvider ? foundProvider.name : null);
    form.setValue('packageName', ''); // Reset package when number changes
  }, [phoneNumber, form]);

  const availablePackages = useMemo(() => {
    if (detectedProvider && ppobPricingData) {
      const providerPricing = ppobPricingData.data?.['Paket Data']?.[detectedProvider];
      if (providerPricing) {
        return Object.keys(providerPricing);
      }
    }
    return [];
  }, [detectedProvider, ppobPricingData]);

  useEffect(() => {
    if (detectedProvider && packageName && ppobPricingData && !isManualPackage) {
      const pricing = ppobPricingData.data?.['Paket Data']?.[detectedProvider];
      const packagePrice = pricing ? pricing[packageName] : null;

      if (packagePrice) {
        form.setValue('costPrice', packagePrice.costPrice);
        form.setValue('sellingPrice', packagePrice.sellingPrice);
      } else {
        form.setValue('costPrice', undefined);
        form.setValue('sellingPrice', undefined);
      }
    }
  }, [detectedProvider, packageName, form, ppobPricingData, isManualPackage]);

  const ppobAccounts = useMemo(() => kasAccounts?.filter(acc => acc.type === 'PPOB'), [kasAccounts]);

  const onSubmit = async (values: PPOBPaketDataFormValues) => {
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

    toast({ title: "Memproses...", description: "Menyimpan transaksi paket data." });

    const now = new Date();
    const nowISO = now.toISOString();
    const deviceName = localStorage.getItem('brimoDeviceName') || 'Unknown Device';
    const profit = sellingPrice - costPrice;
    const splitTransferAmount = sellingPrice - (splitTunaiAmount || 0);
    
    try {
        const auditDocRef = await addDoc(collection(firestore, 'ppobTransactions'), {
            date: now,
            serviceName: 'Paket Data',
            destination: values.phoneNumber,
            description: values.packageName,
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
                kasAccountId: sourcePPOBAccount.id, type: 'debit', name: `Beli Paket Data`, account: values.phoneNumber, date: nowISO, amount: costPrice, balanceBefore: currentSourcePPOBBalance, balanceAfter: currentSourcePPOBBalance - costPrice, category: 'ppob_purchase', deviceName, auditId
            });
            
            switch (paymentMethod) {
                case 'Tunai':
                    if (!laciAccountRef || !laciDoc || !laciDoc.exists()) throw new Error("Akun Laci tidak ditemukan.");
                    const currentLaciBalance = laciDoc.data().balance;
                    transaction.update(laciAccountRef, { balance: currentLaciBalance + sellingPrice });
                    const creditTunaiRef = doc(collection(laciAccountRef, 'transactions'));
                    transaction.set(creditTunaiRef, {
                         kasAccountId: laciAccount.id, type: 'credit', name: `Bayar Paket Data`, account: values.phoneNumber, date: nowISO, amount: sellingPrice, balanceBefore: currentLaciBalance, balanceAfter: currentLaciBalance + sellingPrice, category: 'customer_payment_ppob', deviceName, auditId
                    });
                    break;
                case 'Transfer':
                    if (!paymentAccRef || !paymentDoc || !paymentDoc.exists()) throw new Error("Akun penerima pembayaran tidak valid.");
                    const currentPaymentBalance = paymentDoc.data().balance;
                    transaction.update(paymentAccRef, { balance: currentPaymentBalance + sellingPrice });
                    const creditTransferRef = doc(collection(paymentAccRef, 'transactions'));
                    transaction.set(creditTransferRef, {
                        kasAccountId: paymentTransferAccount!.id, type: 'credit', name: `Bayar Paket Data`, account: values.phoneNumber, date: nowISO, amount: sellingPrice, balanceBefore: currentPaymentBalance, balanceAfter: currentPaymentBalance + sellingPrice, category: 'customer_payment_ppob', deviceName, auditId
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
                         kasAccountId: laciAccount.id, type: 'credit', name: `Bayar Tunai Paket Data`, account: values.phoneNumber, date: nowISO, amount: splitTunaiAmount, balanceBefore: currentLaciSplitBalance, balanceAfter: currentLaciSplitBalance + splitTunaiAmount, category: 'customer_payment_ppob', deviceName, auditId
                    });

                    const currentPaymentSplitBalance = paymentDoc.data().balance;
                    transaction.update(paymentAccRef, { balance: currentPaymentSplitBalance + splitTransferAmount });
                    const creditSplitTransferRef = doc(collection(paymentAccRef, 'transactions'));
                    transaction.set(creditSplitTransferRef, {
                        kasAccountId: paymentTransferAccount!.id, type: 'credit', name: `Bayar Transfer Paket Data`, account: values.phoneNumber, date: nowISO, amount: splitTransferAmount, balanceBefore: currentPaymentSplitBalance, balanceAfter: currentPaymentSplitBalance + splitTransferAmount, category: 'customer_payment_ppob', deviceName, auditId
                    });
                    break;
            }
        });

        toast({ title: "Sukses", description: "Transaksi Paket Data berhasil disimpan." });
        onTransactionComplete();

    } catch (error: any) {
        console.error("Error saving PPOB Paket Data transaction: ", error);
        toast({ variant: "destructive", title: "Error", description: error.message || "Gagal menyimpan transaksi." });
    } finally {
        setIsSaving(false);
    }
  };
  
  const handlePackageSelect = (pkg: string) => {
    form.setValue('packageName', pkg, { shouldValidate: true });
    setIsManualPackage(false);
    setPackagePopoverOpen(false);
  }
  
  const handleResetPackage = () => {
    form.setValue('packageName', '', { shouldValidate: true });
    form.setValue('costPrice', undefined);
    form.setValue('sellingPrice', undefined);
  }

  const handleManualClick = () => {
    handleResetPackage();
    setIsManualPackage(true);
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
                <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Nomor HP Pelanggan</FormLabel>
                        <FormControl><Input placeholder="08..." {...field} type="tel" /></FormControl>
                        {detectedProvider && <p className="text-xs text-muted-foreground pt-1">Provider terdeteksi: <strong>{detectedProvider}</strong></p>}
                        <FormMessage />
                    </FormItem>
                )}/>
                
                <FormField
                  control={form.control}
                  name="packageName"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Pilih Paket Data</FormLabel>
                        <div className="flex gap-2">
                            <Popover open={packagePopoverOpen} onOpenChange={setPackagePopoverOpen}>
                                <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn(
                                        "w-full justify-between h-10",
                                        !field.value && "text-muted-foreground"
                                    )}
                                    disabled={isManualPackage}
                                    >
                                    {field.value
                                        ? availablePackages.find((pkg) => pkg === field.value) || "Pilih paket..."
                                        : "Pilih paket..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[--radix-popover-content-available-height] p-0">
                                <Command>
                                    <CommandInput placeholder="Cari nama paket..." />
                                    <CommandEmpty>Paket tidak ditemukan.</CommandEmpty>
                                    <CommandGroup>
                                    <ScrollArea className="h-72">
                                    {availablePackages.map((pkg) => (
                                        <CommandItem
                                            value={pkg}
                                            key={pkg}
                                            onSelect={() => handlePackageSelect(pkg)}
                                        >
                                            <Check className={cn("mr-2 h-4 w-4", pkg === field.value ? "opacity-100" : "opacity-0")} />
                                            {pkg}
                                        </CommandItem>
                                    ))}
                                    </ScrollArea>
                                    </CommandGroup>
                                </Command>
                                </PopoverContent>
                            </Popover>
                            <Button type="button" variant={isManualPackage ? 'default' : 'outline'} onClick={() => setIsManualPackage(!isManualPackage)}>
                                Manual
                            </Button>
                        </div>
                        {isManualPackage && (
                             <FormControl className="mt-2">
                                <Input 
                                    placeholder="Masukkan nama paket..." 
                                    {...field}
                                    type="text"
                                    autoFocus
                                />
                             </FormControl>
                        )}
                      <FormMessage />
                    </FormItem>
                  )}
                />


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
                                <FormControl><Input type="text" placeholder="Rp 0" {...field} value={formatToRupiah(field.value)} onChange={(e) => field.onChange(parseRupiah(e.target.value))} /></FormControl>
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
