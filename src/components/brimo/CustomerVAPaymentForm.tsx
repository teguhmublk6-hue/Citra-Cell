
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
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import vaProviderData from '@/lib/va-providers.json';
import { useState, useEffect, useMemo } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CustomerVAPaymentFormValues } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';


const numberPreprocessor = (val: unknown) => (val === "" || val === undefined || val === null) ? undefined : Number(String(val).replace(/[^0-9]/g, ""));

const baseSchema = z.object({
  sourceAccountId: z.string().min(1, 'Akun kas asal harus dipilih'),
  serviceProvider: z.string().min(1, 'Penyedia layanan harus dipilih'),
  recipientName: z.string().min(1, 'Nama pada tagihan harus diisi'),
  paymentAmount: z.preprocess(numberPreprocessor, z.number({ invalid_type_error: "Nominal harus angka" }).positive('Nominal pembayaran harus lebih dari 0')),
  adminFee: z.preprocess(numberPreprocessor, z.number({ invalid_type_error: "Biaya harus angka" }).min(0, 'Biaya admin tidak boleh negatif').optional().default(0)),
  serviceFee: z.preprocess(numberPreprocessor, z.number({ invalid_type_error: "Biaya harus angka" }).min(0, 'Biaya jasa tidak boleh negatif')),
  paymentMethod: z.enum(['Tunai', 'Transfer', 'Split'], { required_error: 'Metode pembayaran harus dipilih' }),
  paymentToKasTransferAccountId: z.string().optional(),
  splitTunaiAmount: z.preprocess(numberPreprocessor, z.number().optional()),
});

// Create a refined schema that applies conditional validation
const refinedSchema = baseSchema.superRefine((data, ctx) => {
    // For 'Transfer' method, paymentToKasTransferAccountId is required
    if (data.paymentMethod === 'Transfer' && !data.paymentToKasTransferAccountId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Akun penerima bayaran harus dipilih.',
            path: ['paymentToKasTransferAccountId'],
        });
    }

    // For 'Split' method, both splitTunaiAmount and paymentToKasTransferAccountId are required
    if (data.paymentMethod === 'Split') {
        const totalPayment = data.paymentAmount + data.serviceFee;
        
        if (!data.splitTunaiAmount || data.splitTunaiAmount <= 0) {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Jumlah tunai harus diisi dan lebih dari 0.',
                path: ['splitTunaiAmount'],
            });
        } else if (data.splitTunaiAmount >= totalPayment) {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Jumlah tunai harus lebih kecil dari total bayar.',
                path: ['splitTunaiAmount'],
            });
        }
        
        if (!data.paymentToKasTransferAccountId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Akun penerima sisa bayaran harus dipilih.',
                path: ['paymentToKasTransferAccountId'],
            });
        }
    }
});


interface CustomerVAPaymentFormProps {
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
    if (amount >= 10000 && amount <= 39000) return 3000;
    if (amount >= 40000 && amount <= 999000) return 5000;
    if (amount >= 1000000 && amount <= 1999000) return 7000;
    if (amount >= 2000000 && amount <= 3499000) return 10000;
    if (amount >= 3500000 && amount <= 5999000) return 15000;
    if (amount >= 6000000 && amount <= 7999000) return 20000;
    if (amount >= 8000000 && amount <= 10000000) return 25000;
    return 0;
};


export default function CustomerVAPaymentForm({ onTransactionComplete, onDone }: CustomerVAPaymentFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [providerPopoverOpen, setProviderPopoverOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");

  
  const kasAccountsCollection = useMemoFirebase(() => {
    return collection(firestore, 'kasAccounts');
  }, [firestore]);

  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);
  
  const sourceKasAccounts = useMemo(() => {
      return kasAccounts?.filter(acc => ['Bank', 'E-Wallet'].includes(acc.type));
  }, [kasAccounts]);

  const form = useForm<CustomerVAPaymentFormValues>({
    resolver: zodResolver(refinedSchema),
    defaultValues: {
        sourceAccountId: '',
        serviceProvider: '',
        recipientName: '',
        paymentAmount: undefined,
        adminFee: 0,
        serviceFee: undefined,
        paymentMethod: 'Tunai',
        paymentToKasTransferAccountId: '',
        splitTunaiAmount: undefined,
    },
  });

  const paymentMethod = form.watch('paymentMethod');
  const paymentAmount = form.watch('paymentAmount');

  useEffect(() => {
    if (paymentAmount !== undefined) {
      const fee = calculateServiceFee(paymentAmount);
      form.setValue('serviceFee', fee, { shouldValidate: true });
    }
  }, [paymentAmount, form]);

  const onSubmit = async (values: CustomerVAPaymentFormValues) => {
    setIsSaving(true);
    
    if (!firestore || !kasAccounts) {
      toast({ variant: "destructive", title: "Error", description: "Database atau akun tidak ditemukan." });
      setIsSaving(false);
      return;
    }
    
    const sourceAccount = kasAccounts.find(acc => acc.id === values.sourceAccountId);
    const paymentTransferAccount = kasAccounts.find(acc => acc.id === values.paymentToKasTransferAccountId);
    const laciAccount = kasAccounts.find(acc => acc.label === "Laci");
    const { paymentAmount, serviceFee, adminFee, paymentMethod, splitTunaiAmount } = values;
    const totalPaymentByCustomer = paymentAmount + serviceFee;
    const totalDebitFromSource = paymentAmount + (adminFee || 0);
    const netProfit = serviceFee - (adminFee || 0);
    const splitTransferAmount = totalPaymentByCustomer - (splitTunaiAmount || 0);

    if (!sourceAccount) {
      toast({ variant: "destructive", title: "Error", description: "Akun sumber tidak ditemukan." });
      setIsSaving(false);
      return;
    }
    if (!laciAccount && (paymentMethod === 'Tunai' || paymentMethod === 'Split')) {
        toast({ variant: "destructive", title: "Akun Laci Tidak Ditemukan", description: "Pastikan akun kas 'Laci' dengan tipe 'Tunai' sudah dibuat." });
        setIsSaving(false);
        return;
    }

    if (sourceAccount.balance < totalDebitFromSource) {
        toast({ variant: "destructive", title: "Saldo Tidak Cukup", description: `Saldo ${sourceAccount.label} tidak mencukupi untuk pembayaran ini.` });
        setIsSaving(false);
        return;
    }

    toast({ title: "Memproses...", description: "Menyimpan transaksi pembayaran VA." });

    const now = new Date();
    const nowISO = now.toISOString();
    const deviceName = localStorage.getItem('brimoDeviceName') || 'Unknown Device';
    
    try {
        const auditDocRef = await addDoc(collection(firestore, 'customerVAPayments'), {
            date: now,
            sourceKasAccountId: values.sourceAccountId,
            serviceProvider: values.serviceProvider,
            recipientName: values.recipientName,
            paymentAmount: values.paymentAmount,
            adminFee: values.adminFee || 0,
            serviceFee: values.serviceFee,
            netProfit,
            paymentMethod: values.paymentMethod,
            paymentToKasTunaiAmount: paymentMethod === 'Tunai' ? totalPaymentByCustomer : (paymentMethod === 'Split' ? splitTunaiAmount : 0),
            paymentToKasTransferAccountId: paymentMethod === 'Transfer' || paymentMethod === 'Split' ? values.paymentToKasTransferAccountId : null,
            paymentToKasTransferAmount: paymentMethod === 'Transfer' ? totalPaymentByCustomer : (paymentMethod === 'Split' ? splitTransferAmount : 0),
            deviceName
        });
        const auditId = auditDocRef.id;

        await runTransaction(firestore, async (transaction) => {
            const sourceAccountRef = doc(firestore, 'kasAccounts', sourceAccount.id);
            const laciAccountRef = laciAccount ? doc(firestore, 'kasAccounts', laciAccount.id) : null;
            const paymentAccRef = paymentTransferAccount ? doc(firestore, 'kasAccounts', paymentTransferAccount.id) : null;

            const [sourceDoc, laciDoc, paymentDoc] = await Promise.all([
                transaction.get(sourceAccountRef),
                laciAccountRef ? transaction.get(laciAccountRef) : Promise.resolve(null),
                paymentAccRef ? transaction.get(paymentAccRef) : Promise.resolve(null),
            ]);

            if (!sourceDoc.exists()) throw new Error("Akun sumber tidak ditemukan.");
            
            const currentSourceBalance = sourceDoc.data().balance;
            if (currentSourceBalance < totalDebitFromSource) {
                throw new Error(`Saldo ${sourceAccount.label} tidak mencukupi.`);
            }
            
            transaction.update(sourceAccountRef, { balance: currentSourceBalance - totalDebitFromSource });

            const debitPrincipalRef = doc(collection(sourceAccountRef, 'transactions'));
            transaction.set(debitPrincipalRef, {
                kasAccountId: sourceAccount.id, type: 'debit', name: `Bayar VA ${values.serviceProvider} an. ${values.recipientName}`, account: values.serviceProvider, date: nowISO, amount: paymentAmount, balanceBefore: currentSourceBalance, balanceAfter: currentSourceBalance - totalDebitFromSource, category: 'customer_va_payment_debit', deviceName, auditId
            });

            if (adminFee && adminFee > 0) {
                const debitFeeRef = doc(collection(sourceAccountRef, 'transactions'));
                transaction.set(debitFeeRef, {
                    kasAccountId: sourceAccount.id, type: 'debit', name: `Biaya Admin VA an. ${values.recipientName}`, account: 'Biaya VA', date: nowISO, amount: adminFee, balanceBefore: currentSourceBalance - paymentAmount, balanceAfter: currentSourceBalance - totalDebitFromSource, category: 'customer_va_payment_fee', deviceName, auditId
                });
            }
            
            switch (paymentMethod) {
                case 'Tunai':
                     if (!laciAccountRef || !laciDoc || !laciDoc.exists()) throw new Error("Akun Laci tidak ditemukan.");
                    const currentLaciBalance = laciDoc.data().balance;
                    transaction.update(laciAccountRef, { balance: currentLaciBalance + totalPaymentByCustomer });
                    const creditTunaiRef = doc(collection(laciAccountRef, 'transactions'));
                    transaction.set(creditTunaiRef, {
                         kasAccountId: laciAccount.id, type: 'credit', name: `Bayar VA an. ${values.recipientName}`, account: 'Pelanggan', date: nowISO, amount: totalPaymentByCustomer, balanceBefore: currentLaciBalance, balanceAfter: currentLaciBalance + totalPaymentByCustomer, category: 'customer_payment', deviceName, auditId
                    });
                    break;
                case 'Transfer':
                    if (!paymentAccRef || !paymentDoc || !paymentDoc.exists()) throw new Error("Akun penerima pembayaran tidak valid.");
                    const currentPaymentBalance = paymentDoc.data().balance;
                    transaction.update(paymentAccRef, { balance: currentPaymentBalance + totalPaymentByCustomer });
                    const creditTransferRef = doc(collection(paymentAccRef, 'transactions'));
                    transaction.set(creditTransferRef, {
                        kasAccountId: paymentTransferAccount!.id, type: 'credit', name: `Bayar VA an. ${values.recipientName}`, account: 'Pelanggan', date: nowISO, amount: totalPaymentByCustomer, balanceBefore: currentPaymentBalance, balanceAfter: currentPaymentBalance + totalPaymentByCustomer, category: 'customer_payment', deviceName, auditId
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
                         kasAccountId: laciAccount.id, type: 'credit', name: `Bayar Tunai VA an. ${values.recipientName}`, account: 'Pelanggan', date: nowISO, amount: splitTunaiAmount, balanceBefore: currentLaciSplitBalance, balanceAfter: currentLaciSplitBalance + splitTunaiAmount, category: 'customer_payment', deviceName, auditId
                    });

                    const currentPaymentSplitBalance = paymentDoc.data().balance;
                    transaction.update(paymentAccRef, { balance: currentPaymentSplitBalance + splitTransferAmount });
                    const creditSplitTransferRef = doc(collection(paymentAccRef, 'transactions'));
                    transaction.set(creditSplitTransferRef, {
                        kasAccountId: paymentTransferAccount!.id, type: 'credit', name: `Bayar Transfer VA an. ${values.recipientName}`, account: 'Pelanggan', date: nowISO, amount: splitTransferAmount, balanceBefore: currentPaymentSplitBalance, balanceAfter: currentPaymentSplitBalance + splitTransferAmount, category: 'customer_payment', deviceName, auditId
                    });
                    break;
            }
        });

        toast({ title: "Sukses", description: "Transaksi berhasil disimpan." });
        onTransactionComplete();

    } catch (error: any) {
        console.error("Error saving VA payment:", error);
        toast({ variant: "destructive", title: "Error", description: error.message || "Gagal menyimpan transaksi." });
    } finally {
        setIsSaving(false);
    }
  };

  const filteredProviders = vaProviderData.filter(provider =>
    provider.name.toLowerCase().includes(searchKeyword.toLowerCase())
  );
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex flex-col h-full">
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 pt-4 pb-6">
            
            {/* Akun Kas Asal */}
            <FormField
              control={form.control}
              name="sourceAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Akun Kas Asal (Pembayar)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih akun pembayar" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {sourceKasAccounts?.map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.label} ({formatToRupiah(acc.balance)})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Penyedia Layanan */}
            <FormField
                control={form.control}
                name="serviceProvider"
                render={({ field }) => (
                <FormItem className="flex flex-col">
                    <FormLabel>Penyedia Layanan</FormLabel>
                    <Popover open={providerPopoverOpen} onOpenChange={setProviderPopoverOpen}>
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
                            {field.value || "Pilih penyedia layanan"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                        </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[--radix-popover-content-available-height] p-0">
                        <Command>
                            <CommandInput 
                                placeholder="Cari penyedia..." 
                                value={searchKeyword} 
                                onValueChange={setSearchKeyword}
                            />
                            <ScrollArea className="h-72">
                                <CommandEmpty>
                                    <div 
                                        className="p-2 text-sm cursor-pointer hover:bg-accent"
                                        onClick={() => {
                                            form.setValue("serviceProvider", searchKeyword, { shouldValidate: true });
                                            setProviderPopoverOpen(false);
                                        }}
                                    >
                                        Gunakan: "{searchKeyword}"
                                    </div>
                                </CommandEmpty>
                                <CommandGroup>
                                    {filteredProviders.map((provider) => (
                                        <CommandItem
                                        value={provider.name}
                                        key={provider.name}
                                        onSelect={() => {
                                            form.setValue("serviceProvider", provider.name, { shouldValidate: true })
                                            setProviderPopoverOpen(false)
                                            setSearchKeyword("")
                                        }}
                                        >
                                        <Check
                                            className={cn(
                                            "mr-2 h-4 w-4",
                                            provider.name === field.value ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {provider.name}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </ScrollArea>
                        </Command>
                    </PopoverContent>
                    </Popover>
                    <FormMessage />
                </FormItem>
                )}
            />
            
            {/* Nama Pada Tagihan */}
            <FormField control={form.control} name="recipientName" render={({ field }) => (
                <FormItem>
                    <FormLabel>Nama Pada Tagihan</FormLabel>
                    <FormControl>
                        <Input placeholder="Masukkan nama" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}/>

            {/* Nominal & Biaya */}
            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="paymentAmount" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Nominal Pembayaran</FormLabel>
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
             <FormField control={form.control} name="adminFee" render={({ field }) => (
                <FormItem>
                    <FormLabel>Biaya Admin Penyedia</FormLabel>
                    <FormControl><Input type="text" placeholder="Rp 0 (Opsional)" {...field} value={formatToRupiah(field.value)} onChange={(e) => field.onChange(parseRupiah(e.target.value))} /></FormControl>
                    <FormMessage />
                </FormItem>
            )}/>

            {/* Metode Pembayaran */}
            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Metode Pembayaran Pelanggan</FormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl><RadioGroupItem value="Tunai" /></FormControl>
                        <FormLabel className="font-normal">Tunai</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl><RadioGroupItem value="Transfer" /></FormControl>
                        <FormLabel className="font-normal">Transfer</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl><RadioGroupItem value="Split" /></FormControl>
                        <FormLabel className="font-normal">Split Bill</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Conditional Fields */}
            {paymentMethod === 'Transfer' && (
                 <FormField
                    control={form.control}
                    name="paymentToKasTransferAccountId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Akun Penerima Bayaran</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Pilih akun penerima" />
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
                    <FormField
                        control={form.control}
                        name="paymentToKasTransferAccountId"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Akun Penerima Sisa Bayaran (Transfer)</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih akun penerima" />
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
                </div>
            )}

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
