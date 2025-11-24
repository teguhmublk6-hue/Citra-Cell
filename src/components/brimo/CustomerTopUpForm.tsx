
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, runTransaction, addDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { startOfDay } from 'date-fns';
import type { KasAccount } from '@/lib/data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { useState, useEffect, useMemo, useCallback } from 'react';
import type { CustomerTopUpFormValues, CustomerTopUp } from '@/lib/types';
import { CustomerTopUpFormSchema } from '@/lib/types';
import { Card, CardContent } from '../ui/card';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '../ui/command';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';


interface CustomerTopUpFormProps {
  onTransactionComplete: (transactionPromise: () => Promise<any>) => void;
  onDone: () => void;
}

const ewallets = [
    { name: 'DANA', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Logo_dana_blue.svg/1024px-Logo_dana_blue.svg.png', hint: 'dana logo' },
    { name: 'OVO', icon: 'https://upload.wikimedia.org/wikipedia/commons/e/eb/Logo_ovo_purple.svg', hint: 'ovo logo' },
    { name: 'GoPay', icon: 'https://upload.wikimedia.org/wikipedia/commons/8/86/Gopay_logo.svg', hint: 'gopay logo' },
    { name: 'ShopeePay', icon: 'https://tokpee.co/blog/wp-content/uploads/2025/03/Begini-Cara-Membagikan-Kode-QR-ShopeePay-Biar-Uang-Langsung-Masuk.webp', hint: 'shopeepay logo' },
    { name: 'LinkAja', icon: 'https://crm.linkaja.id/img/linkaja.png', hint: 'linkaja logo' },
]

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

const calculateServiceFee = (amount: number): number => {
    if (amount >= 10000 && amount <= 299000) return 3000;
    if (amount >= 300000 && amount <= 999000) return 5000;
    if (amount >= 1000000 && amount <= 1999000) return 7000;
    if (amount >= 2000000 && amount <= 3499000) return 10000;
    if (amount >= 3500000 && amount <= 5999000) return 15000;
    if (amount >= 6000000 && amount <= 7999000) return 20000;
    if (amount >= 8000000 && amount <= 10000000) return 25000;
    return 0; // Default fee if no range matches
};


export default function CustomerTopUpForm({ onTransactionComplete, onDone }: CustomerTopUpFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [sourcePopoverOpen, setSourcePopoverOpen] = useState(false);
  const [paymentPopoverOpen, setPaymentPopoverOpen] = useState(false);
  
  const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);
  
  const refinedSchema = CustomerTopUpFormSchema.superRefine((data, ctx) => {
    if (data.paymentMethod === 'Transfer' && !data.paymentToKasTransferAccountId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Akun penerima bayaran harus dipilih.', path: ['paymentToKasTransferAccountId'] });
    }
    if (data.paymentMethod === 'Split') {
        const totalPayment = data.topUpAmount + data.serviceFee;
        if (!data.splitTunaiAmount || data.splitTunaiAmount <= 0) {
             ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Jumlah tunai harus diisi dan lebih dari 0.', path: ['splitTunaiAmount'] });
        } else if (data.splitTunaiAmount >= totalPayment) {
             ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Jumlah tunai harus lebih kecil dari total bayar.', path: ['splitTunaiAmount'] });
        }
        if (!data.paymentToKasTransferAccountId) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Akun penerima sisa bayaran harus dipilih.', path: ['paymentToKasTransferAccountId'] });
        }
    }
  });

  const form = useForm<CustomerTopUpFormValues>({
    resolver: zodResolver(refinedSchema),
    defaultValues: {
        sourceAccountId: '',
        destinationEwallet: '',
        customerName: '',
        topUpAmount: undefined,
        serviceFee: undefined,
        paymentMethod: 'Tunai',
        paymentToKasTransferAccountId: '',
        splitTunaiAmount: undefined,
    },
  });

  const paymentMethod = form.watch('paymentMethod');
  const topUpAmount = form.watch('topUpAmount');

  useEffect(() => {
    if (topUpAmount !== undefined) {
      const fee = calculateServiceFee(topUpAmount);
      form.setValue('serviceFee', fee, { shouldValidate: true });
    }
  }, [topUpAmount, form]);

  const sourceKasAccounts = useMemo(() => {
    if (!kasAccounts) return [];
    const filtered = kasAccounts.filter(acc => ['Bank', 'E-Wallet'].includes(acc.type));
    return filtered.sort((a, b) => {
        if (a.type === 'E-Wallet' && b.type !== 'E-Wallet') return -1;
        if (a.type !== 'E-Wallet' && b.type === 'E-Wallet') return 1;
        return a.label.localeCompare(b.label);
    });
  }, [kasAccounts]);

  const onSubmit = (values: CustomerTopUpFormValues) => {
    onTransactionComplete(() => proceedWithTransaction(values));
  };
  
  const proceedWithTransaction = useCallback(async (values: CustomerTopUpFormValues, force = false): Promise<any> => {
    if (!firestore || !kasAccounts) {
      toast({ variant: "destructive", title: "Error", description: "Database tidak tersedia." });
      throw new Error("Database tidak tersedia.");
    }

    if (!force) {
        const todayStart = startOfDay(new Date());
        const q = query(collection(firestore, "customerTopUps"), where("date", ">=", Timestamp.fromDate(todayStart)));
        
        try {
            const querySnapshot = await getDocs(q);
            const todaysTransactions = querySnapshot.docs.map(doc => doc.data() as CustomerTopUp);
            const normalizedNewName = normalizeString(values.customerName);
            const isDuplicate = todaysTransactions.some(trx => 
                trx.sourceKasAccountId === values.sourceAccountId &&
                normalizeString(trx.customerName) === normalizedNewName &&
                trx.topUpAmount === values.topUpAmount
            );
            if (isDuplicate) {
                return Promise.reject({ duplicate: true, onConfirm: () => proceedWithTransaction(values, true) });
            }
        } catch (error) {
            console.error("Error checking for duplicates:", error);
            // Non-fatal, proceed with transaction
        }
    }
    
    const sourceAccount = kasAccounts.find(acc => acc.id === values.sourceAccountId);
    const paymentTransferAccount = kasAccounts.find(acc => acc.id === values.paymentToKasTransferAccountId);
    const laciAccount = kasAccounts.find(acc => acc.label === "Laci");

    if (!sourceAccount) {
        toast({ variant: "destructive", title: "Error", description: "Akun sumber tidak ditemukan." });
        throw new Error("Akun sumber tidak ditemukan.");
    }
    if (!laciAccount && (values.paymentMethod === 'Tunai' || values.paymentMethod === 'Split')) {
        toast({ variant: "destructive", title: "Akun Laci Tidak Ditemukan", description: "Pastikan akun kas 'Laci' dengan tipe 'Tunai' sudah dibuat." });
        throw new Error("Akun Laci tidak ditemukan.");
    }
    if (sourceAccount.balance < values.topUpAmount) {
        toast({ variant: "destructive", title: "Saldo Tidak Cukup", description: `Saldo ${sourceAccount.label} tidak mencukupi untuk melakukan top up.` });
        throw new Error(`Saldo ${sourceAccount.label} tidak mencukupi.`);
    }

    const now = new Date();
    const deviceName = localStorage.getItem('brimoDeviceName') || 'Unknown Device';
    const totalPaymentByCustomer = values.topUpAmount + values.serviceFee;
    const splitTransferAmount = totalPaymentByCustomer - (values.splitTunaiAmount || 0);
    
    try {
        const auditDocRef = await addDocumentNonBlocking(collection(firestore, 'customerTopUps'), {
            date: now,
            sourceKasAccountId: values.sourceAccountId,
            destinationEwallet: values.destinationEwallet,
            customerName: values.customerName,
            topUpAmount: values.topUpAmount,
            serviceFee: values.serviceFee,
            paymentMethod: values.paymentMethod,
            paymentToKasTunaiAmount: values.paymentMethod === 'Tunai' ? totalPaymentByCustomer : (values.paymentMethod === 'Split' ? values.splitTunaiAmount : 0),
            paymentToKasTransferAccountId: values.paymentMethod === 'Transfer' || values.paymentMethod === 'Split' ? values.paymentToKasTransferAccountId : null,
            paymentToKasTransferAmount: values.paymentMethod === 'Transfer' ? totalPaymentByCustomer : (values.paymentMethod === 'Split' ? splitTransferAmount : 0),
            deviceName
        });

        if (!auditDocRef) throw new Error("Gagal membuat catatan audit.");
        const auditId = auditDocRef.id;
        const nowISO = now.toISOString();

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
            if (currentSourceBalance < values.topUpAmount) throw new Error(`Saldo ${sourceAccount.label} tidak mencukupi.`);

            transaction.update(sourceAccountRef, { balance: currentSourceBalance - values.topUpAmount });
            const debitTxRef = doc(collection(sourceAccountRef, 'transactions'));
            transaction.set(debitTxRef, { kasAccountId: sourceAccount.id, type: 'debit', name: `Top Up ${values.destinationEwallet} an. ${values.customerName}`, account: values.destinationEwallet, date: nowISO, amount: values.topUpAmount, balanceBefore: currentSourceBalance, balanceAfter: currentSourceBalance - values.topUpAmount, category: 'customer_topup_debit', deviceName, auditId });
            
            switch (values.paymentMethod) {
                case 'Tunai':
                    if (!laciAccountRef || !laciDoc || !laciDoc.exists()) throw new Error("Akun Laci tidak ditemukan.");
                    const currentLaciBalance = laciDoc.data().balance;
                    transaction.update(laciAccountRef, { balance: currentLaciBalance + totalPaymentByCustomer });
                    const creditTunaiRef = doc(collection(laciAccountRef, 'transactions'));
                    transaction.set(creditTunaiRef, { kasAccountId: laciAccount.id, type: 'credit', name: `Bayar Top Up an. ${values.customerName}`, account: 'Pelanggan', date: nowISO, amount: totalPaymentByCustomer, balanceBefore: currentLaciBalance, balanceAfter: currentLaciBalance + totalPaymentByCustomer, category: 'customer_payment', deviceName, auditId });
                    break;
                case 'Transfer':
                    if (!paymentAccRef || !paymentDoc || !paymentDoc.exists()) throw new Error("Akun penerima pembayaran tidak valid.");
                    const currentPaymentBalance = paymentDoc.data().balance;
                    transaction.update(paymentAccRef, { balance: currentPaymentBalance + totalPaymentByCustomer });
                    const creditTransferRef = doc(collection(paymentAccRef, 'transactions'));
                    transaction.set(creditTransferRef, { kasAccountId: paymentTransferAccount!.id, type: 'credit', name: `Bayar Top Up an. ${values.customerName}`, account: 'Pelanggan', date: nowISO, amount: totalPaymentByCustomer, balanceBefore: currentPaymentBalance, balanceAfter: currentPaymentBalance + totalPaymentByCustomer, category: 'customer_payment', deviceName, auditId });
                    break;
                case 'Split':
                    if (!laciAccountRef || !laciDoc || !laciDoc.exists()) throw new Error("Akun Laci tidak ditemukan.");
                    if (!paymentAccRef || !paymentDoc || !paymentDoc.exists()) throw new Error("Akun penerima pembayaran split tidak valid.");
                    if (!values.splitTunaiAmount) throw new Error("Jumlah tunai split tidak valid.");
                    
                    const currentLaciSplitBalance = laciDoc.data().balance;
                    transaction.update(laciAccountRef, { balance: currentLaciSplitBalance + values.splitTunaiAmount });
                    const creditSplitTunaiRef = doc(collection(laciAccountRef, 'transactions'));
                    transaction.set(creditSplitTunaiRef, { kasAccountId: laciAccount.id, type: 'credit', name: `Bayar Tunai Top Up an. ${values.customerName}`, account: 'Pelanggan', date: nowISO, amount: values.splitTunaiAmount, balanceBefore: currentLaciSplitBalance, balanceAfter: currentLaciSplitBalance + values.splitTunaiAmount, category: 'customer_payment', deviceName, auditId });

                    const currentPaymentSplitBalance = paymentDoc.data().balance;
                    transaction.update(paymentAccRef, { balance: currentPaymentSplitBalance + splitTransferAmount });
                    const creditSplitTransferRef = doc(collection(paymentAccRef, 'transactions'));
                    transaction.set(creditSplitTransferRef, { kasAccountId: paymentTransferAccount!.id, type: 'credit', name: `Bayar Transfer Top Up an. ${values.customerName}`, account: 'Pelanggan', date: nowISO, amount: splitTransferAmount, balanceBefore: currentPaymentSplitBalance, balanceAfter: currentPaymentSplitBalance + splitTransferAmount, category: 'customer_payment', deviceName, auditId });
                    break;
            }
        });
    } catch (error: any) {
        console.error("Error saving top up transaction: ", error);
        throw error;
    }
  }, [firestore, kasAccounts, toast]);
  
  return (
    <>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex flex-col h-full">
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 pt-4 pb-6">

            {/* E-wallet Destination */}
            <FormField
              control={form.control}
              name="destinationEwallet"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pilih E-Wallet Tujuan</FormLabel>
                  {!field.value ? (
                    <div className="grid grid-cols-3 gap-2">
                      {ewallets.map((wallet) => (
                        <Card key={wallet.name} onClick={() => field.onChange(wallet.name)} className={cn("cursor-pointer bg-white")}>
                          <CardContent className="p-2 flex items-center justify-center aspect-[2/1]">
                            <div className="relative w-full h-full"><Image src={wallet.icon} alt={wallet.name} fill style={{ objectFit: 'contain' }} data-ai-hint={wallet.hint} /></div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Card className="ring-2 ring-primary bg-white">
                        <CardContent className="p-2 flex items-center justify-center aspect-[2/1]">
                           <div className="relative w-full h-full"><Image src={ewallets.find(w => w.name === field.value)?.icon || ''} alt={field.value} fill style={{ objectFit: 'contain' }} data-ai-hint={ewallets.find(w => w.name === field.value)?.hint} /></div>
                        </CardContent>
                      </Card>
                      <Button variant="link" onClick={() => field.onChange('')} className="p-0 h-auto">Ganti Pilihan</Button>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="sourceAccountId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Sumber Dana Top Up</FormLabel>
                   <Popover open={sourcePopoverOpen} onOpenChange={setSourcePopoverOpen}>
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
                            ? sourceKasAccounts?.find(
                                (acc) => acc.id === field.value
                              )?.label
                            : "Pilih akun sumber"}
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
                          {sourceKasAccounts?.map((acc) => (
                            <CommandItem
                              value={acc.label}
                              key={acc.id}
                              onSelect={() => {
                                form.setValue("sourceAccountId", acc.id)
                                setSourcePopoverOpen(false)
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
            
            <FormField control={form.control} name="customerName" render={({ field }) => (
                <FormItem>
                    <FormLabel>Nama Pelanggan</FormLabel>
                    <FormControl><Input placeholder="Masukkan nama" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
            )}/>

            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="topUpAmount" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Nominal Top Up</FormLabel>
                        <FormControl><Input type="tel" placeholder="Rp 0" {...field} value={formatToRupiah(field.value)} onChange={(e) => field.onChange(parseRupiah(e.target.value))} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}/>
                <FormField control={form.control} name="serviceFee" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Biaya Jasa</FormLabel>
                        <FormControl><Input type="tel" placeholder="Rp 0" {...field} value={formatToRupiah(field.value)} onChange={(e) => field.onChange(parseRupiah(e.target.value))} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}/>
            </div>

            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem className="space-y-3">
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
              )}
            />

            {paymentMethod === 'Transfer' && (
                 <FormField
                    control={form.control}
                    name="paymentToKasTransferAccountId"
                    render={({ field }) => (
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
                    <FormField
                        control={form.control}
                        name="paymentToKasTransferAccountId"
                        render={({ field }) => (
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
                        )}
                    />
                </div>
            )}

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
    </>
  );
}

    
