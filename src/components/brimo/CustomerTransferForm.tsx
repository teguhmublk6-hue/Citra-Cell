
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
import type { KasAccount, Transaction } from '@/lib/data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import bankData from '@/lib/banks.json';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CustomerTransferFormValues, CustomerTransfer } from '@/lib/types';
import DuplicateTransactionDialog from './DuplicateTransactionDialog';


const numberPreprocessor = (val: unknown) => (val === "" || val === undefined || val === null) ? undefined : Number(String(val).replace(/[^0-9]/g, ""));

const baseSchema = z.object({
  sourceAccountId: z.string().min(1, 'Akun kas asal harus dipilih'),
  destinationBank: z.string().min(1, 'Bank tujuan harus dipilih'),
  destinationAccountName: z.string().min(1, 'Nama pemilik rekening harus diisi'),
  transferAmount: z.preprocess(numberPreprocessor, z.number({ invalid_type_error: "Nominal harus angka" }).positive('Nominal transfer harus lebih dari 0')),
  bankAdminFee: z.preprocess(numberPreprocessor, z.number({ invalid_type_error: "Biaya harus angka" }).min(0, 'Biaya admin tidak boleh negatif').optional().default(0)),
  serviceFee: z.preprocess(numberPreprocessor, z.number({ invalid_type_error: "Biaya harus angka" }).min(0, 'Biaya jasa tidak boleh negatif')),
  paymentMethod: z.enum(['Tunai', 'Transfer', 'Split'], { required_error: 'Metode pembayaran harus dipilih' }),
  paymentToKasTransferAccountId: z.string().optional(),
  splitTunaiAmount: z.preprocess(numberPreprocessor, z.number().optional()),
});

// Create a refined schema that applies conditional validation
const refinedSchema = baseSchema.superRefine((data, ctx) => {
    if (data.paymentMethod === 'Transfer' && !data.paymentToKasTransferAccountId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Akun penerima bayaran harus dipilih.',
            path: ['paymentToKasTransferAccountId'],
        });
    }
    if (data.paymentMethod === 'Split') {
        const totalPayment = data.transferAmount + data.serviceFee;
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


interface CustomerTransferFormProps {
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


const sourceToBankMap: Record<string, string> = {
  'BRILink': 'Bank BRI',
  'BRIMo': 'Bank BRI',
  'myBCA': 'Bank BCA',
  'BNI Agen': 'Bank BNI',
  'Wondr by BNI': 'Bank BNI',
  'Byond': 'Bank Syariah Indonesia (BSI)',
  'BSI Smart Agen': 'Bank Syariah Indonesia (BSI)',
  'Mandiri Agen': 'Bank Mandiri',
  'Livin by Mandiri': 'Bank Mandiri',
  'JakOne': 'BPD DKI Jakarta',
  'Seabank': 'SeaBank'
};


export default function CustomerTransferForm({ onTransactionComplete, onDone }: CustomerTransferFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [bankPopoverOpen, setBankPopoverOpen] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [sourcePopoverOpen, setSourcePopoverOpen] = useState(false);
  const [paymentPopoverOpen, setPaymentPopoverOpen] = useState(false);
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const [formData, setFormData] = useState<CustomerTransferFormValues | null>(null);

  
  const inputRefs = {
    destinationAccountName: useRef<HTMLInputElement>(null),
    transferAmount: useRef<HTMLInputElement>(null),
    serviceFee: useRef<HTMLInputElement>(null),
    bankAdminFee: useRef<HTMLInputElement>(null),
    splitTunaiAmount: useRef<HTMLInputElement>(null),
  };

  const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);
  
  const sourceKasAccounts = useMemo(() => {
    if (!kasAccounts) return [];
    const filtered = kasAccounts.filter(acc => ['Bank', 'E-Wallet'].includes(acc.type));
    return filtered.sort((a, b) => {
        if (a.type === 'Bank' && b.type !== 'Bank') return -1;
        if (a.type !== 'Bank' && b.type === 'Bank') return 1;
        return a.label.localeCompare(b.label);
    });
  }, [kasAccounts]);

  const form = useForm<CustomerTransferFormValues>({
    resolver: zodResolver(refinedSchema),
    defaultValues: {
        sourceAccountId: '',
        destinationBank: '',
        destinationAccountName: '',
        transferAmount: undefined,
        bankAdminFee: 0,
        serviceFee: undefined,
        paymentMethod: 'Tunai',
        paymentToKasTransferAccountId: '',
        splitTunaiAmount: undefined,
    },
  });
  
  // Automatically open the source account selection popover on mount
  useEffect(() => {
    const timer = setTimeout(() => setSourcePopoverOpen(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const paymentMethod = form.watch('paymentMethod');
  const transferAmount = form.watch('transferAmount');
  const sourceAccountId = form.watch('sourceAccountId');

  // Autofill destination bank 
  useEffect(() => {
    const selectedSourceAccount = kasAccounts?.find(acc => acc.id === sourceAccountId);
    if (selectedSourceAccount) {
      const mappedBank = sourceToBankMap[selectedSourceAccount.label];
      if (mappedBank) {
        form.setValue('destinationBank', mappedBank, { shouldValidate: true });
        setSourcePopoverOpen(false); // Close the popover
        setBankPopoverOpen(false);   // Ensure bank popover is also closed
      }
    }
  }, [sourceAccountId, kasAccounts, form]);
  
  // New useEffect to handle focusing after popover closes.
  useEffect(() => {
    if (!sourcePopoverOpen && sourceAccountId) {
      const timer = setTimeout(() => {
        inputRefs.destinationAccountName.current?.focus();
      }, 100); // A small delay ensures the input is rendered and visible.
      return () => clearTimeout(timer);
    }
  }, [sourcePopoverOpen, sourceAccountId]);


  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, nextFieldRef?: React.RefObject<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextFieldRef?.current) {
        nextFieldRef.current.focus();
      }
    }
  };

  const onSubmit = async (values: CustomerTransferFormValues) => {
    if (!firestore) return;
    setIsSaving(true);
    setFormData(values);

    // Check for duplicates
    const today = new Date();
    const startOfToday = startOfDay(today);

    const q = query(
      collection(firestore, "customerTransfers"),
      where("sourceKasAccountId", "==", values.sourceAccountId),
      where("destinationAccountName", "==", values.destinationAccountName),
      where("transferAmount", "==", values.transferAmount),
      where("date", ">=", Timestamp.fromDate(startOfToday))
    );

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      setIsDuplicateDialogOpen(true);
      setIsSaving(false);
    } else {
      await proceedWithTransaction(values);
    }
  };
  
  const proceedWithTransaction = async (values: CustomerTransferFormValues) => {
    setIsSaving(true);
    if (!firestore || !kasAccounts) {
      toast({ variant: "destructive", title: "Error", description: "Database tidak tersedia." });
      setIsSaving(false);
      return;
    }
    
    const sourceAccount = kasAccounts.find(acc => acc.id === values.sourceAccountId);
    const paymentTransferAccount = kasAccounts.find(acc => acc.id === values.paymentToKasTransferAccountId);
    const laciAccount = kasAccounts.find(acc => acc.label === "Laci");

    if (!sourceAccount) {
      toast({ variant: "destructive", title: "Error", description: "Akun sumber tidak ditemukan." });
      setIsSaving(false);
      return;
    }
    if (!laciAccount && (values.paymentMethod === 'Tunai' || values.paymentMethod === 'Split')) {
        toast({ variant: "destructive", title: "Akun Laci Tidak Ditemukan", description: "Pastikan akun kas 'Laci' dengan tipe 'Tunai' sudah dibuat." });
        setIsSaving(false);
        return;
    }

    const totalDebitFromSource = values.transferAmount + (values.bankAdminFee || 0);

    if (sourceAccount.balance < totalDebitFromSource) {
      toast({ variant: "destructive", title: "Saldo Tidak Cukup", description: `Saldo ${sourceAccount.label} tidak mencukupi untuk melakukan transfer ini.` });
      setIsSaving(false);
      return;
    }

    toast({ title: "Memproses...", description: "Menyimpan transaksi transfer." });

    const now = new Date();
    const nowISO = now.toISOString();
    const deviceName = localStorage.getItem('brimoDeviceName') || 'Unknown Device';
    const totalPaymentByCustomer = values.transferAmount + values.serviceFee;
    const netProfit = values.serviceFee - (values.bankAdminFee || 0);
    const splitTransferAmount = totalPaymentByCustomer - (values.splitTunaiAmount || 0);
    
    try {
        const auditDocRef = await addDoc(collection(firestore, 'customerTransfers'), {
            date: now,
            sourceKasAccountId: values.sourceAccountId,
            destinationBankName: values.destinationBank,
            destinationAccountName: values.destinationAccountName,
            transferAmount: values.transferAmount,
            bankAdminFee: values.bankAdminFee || 0,
            serviceFee: values.serviceFee,
            netProfit,
            paymentMethod: values.paymentMethod,
            paymentToKasTunaiAmount: values.paymentMethod === 'Tunai' ? totalPaymentByCustomer : (values.paymentMethod === 'Split' ? values.splitTunaiAmount : 0),
            paymentToKasTransferAccountId: values.paymentMethod === 'Transfer' || values.paymentMethod === 'Split' ? values.paymentToKasTransferAccountId : null,
            paymentToKasTransferAmount: values.paymentMethod === 'Transfer' ? totalPaymentByCustomer : (values.paymentMethod === 'Split' ? splitTransferAmount : 0),
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
            if (currentSourceBalance < totalDebitFromSource) throw new Error(`Saldo ${sourceAccount.label} tidak mencukupi.`);
            
            transaction.update(sourceAccountRef, { balance: currentSourceBalance - totalDebitFromSource });

            const debitPrincipalRef = doc(collection(sourceAccountRef, 'transactions'));
            transaction.set(debitPrincipalRef, { kasAccountId: sourceAccount.id, type: 'debit', name: `Trf an. ${values.destinationAccountName}`, account: values.destinationBank, date: nowISO, amount: values.transferAmount, balanceBefore: currentSourceBalance, balanceAfter: currentSourceBalance - totalDebitFromSource, category: 'customer_transfer_debit', deviceName, auditId });

            if (values.bankAdminFee && values.bankAdminFee > 0) {
                const debitFeeRef = doc(collection(sourceAccountRef, 'transactions'));
                transaction.set(debitFeeRef, { kasAccountId: sourceAccount.id, type: 'debit', name: `Biaya Admin Trf an. ${values.destinationAccountName}`, account: 'Biaya Bank', date: nowISO, amount: values.bankAdminFee, balanceBefore: currentSourceBalance - values.transferAmount, balanceAfter: currentSourceBalance - totalDebitFromSource, category: 'customer_transfer_fee', deviceName, auditId });
            }
            
            switch (values.paymentMethod) {
                case 'Tunai':
                    if (!laciAccountRef || !laciDoc || !laciDoc.exists()) throw new Error("Akun Laci tidak ditemukan.");
                    const currentLaciBalance = laciDoc.data().balance;
                    transaction.update(laciAccountRef, { balance: currentLaciBalance + totalPaymentByCustomer });
                    const creditTunaiRef = doc(collection(laciAccountRef, 'transactions'));
                    transaction.set(creditTunaiRef, { kasAccountId: laciAccount!.id, type: 'credit', name: `Bayar Trf an. ${values.destinationAccountName}`, account: 'Pelanggan', date: nowISO, amount: totalPaymentByCustomer, balanceBefore: currentLaciBalance, balanceAfter: currentLaciBalance + totalPaymentByCustomer, category: 'customer_payment', deviceName, auditId });
                    break;
                case 'Transfer':
                    if (!paymentAccRef || !paymentDoc || !paymentDoc.exists()) throw new Error("Akun penerima pembayaran tidak valid.");
                    const currentPaymentBalance = paymentDoc.data().balance;
                    transaction.update(paymentAccRef, { balance: currentPaymentBalance + totalPaymentByCustomer });
                    const creditTransferRef = doc(collection(paymentAccRef, 'transactions'));
                    transaction.set(creditTransferRef, { kasAccountId: paymentTransferAccount!.id, type: 'credit', name: `Bayar Trf an. ${values.destinationAccountName}`, account: 'Pelanggan', date: nowISO, amount: totalPaymentByCustomer, balanceBefore: currentPaymentBalance, balanceAfter: currentPaymentBalance + totalPaymentByCustomer, category: 'customer_payment', deviceName, auditId });
                    break;
                case 'Split':
                    if (!laciAccountRef || !laciDoc || !laciDoc.exists()) throw new Error("Akun Laci tidak ditemukan.");
                    if (!paymentAccRef || !paymentDoc || !paymentDoc.exists()) throw new Error("Akun penerima pembayaran split tidak valid.");
                    if (!values.splitTunaiAmount) throw new Error("Jumlah tunai split tidak valid.");
                    
                    const currentLaciSplitBalance = laciDoc.data().balance;
                    transaction.update(laciAccountRef, { balance: currentLaciSplitBalance + values.splitTunaiAmount });
                    const creditSplitTunaiRef = doc(collection(laciAccountRef, 'transactions'));
                    transaction.set(creditSplitTunaiRef, { kasAccountId: laciAccount!.id, type: 'credit', name: `Bayar Tunai Trf an. ${values.destinationAccountName}`, account: 'Pelanggan', date: nowISO, amount: values.splitTunaiAmount, balanceBefore: currentLaciSplitBalance, balanceAfter: currentLaciSplitBalance + values.splitTunaiAmount, category: 'customer_payment', deviceName, auditId });

                    const currentPaymentSplitBalance = paymentDoc.data().balance;
                    transaction.update(paymentAccRef, { balance: currentPaymentSplitBalance + splitTransferAmount });
                    const creditSplitTransferRef = doc(collection(paymentAccRef, 'transactions'));
                    transaction.set(creditSplitTransferRef, { kasAccountId: paymentTransferAccount!.id, type: 'credit', name: `Bayar Transfer Trf an. ${values.destinationAccountName}`, account: 'Pelanggan', date: nowISO, amount: splitTransferAmount, balanceBefore: currentPaymentSplitBalance, balanceAfter: currentPaymentSplitBalance + splitTransferAmount, category: 'customer_payment', deviceName, auditId });
                    break;
            }
        });

        onTransactionComplete();

    } catch (error: any) {
      console.error("Error saving transaction:", error);
      toast({ variant: "destructive", title: "Error", description: error.message || "Gagal menyimpan transaksi." });
    } finally {
      setIsSaving(false);
      setIsDuplicateDialogOpen(false);
    }
  };
  
  return (
    <>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex flex-col h-full">
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 pt-4 pb-6">
            
            <FormField
              control={form.control}
              name="sourceAccountId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Akun Kas Asal (Pengirim)</FormLabel>
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
                            : "Pilih akun pengirim"}
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

            <FormField
                control={form.control}
                name="destinationBank"
                render={({ field }) => (
                <FormItem className="flex flex-col">
                    <FormLabel>Bank Tujuan</FormLabel>
                    <Popover open={bankPopoverOpen} onOpenChange={setBankPopoverOpen}>
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
                            ? bankData.find((bank) => bank.name === field.value)?.name || field.value
                            : "Pilih bank"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                        </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[--radix-popover-content-available-height] p-0">
                        <Command>
                        <CommandInput 
                            placeholder="Cari bank..." 
                            value={bankSearch}
                            onValueChange={setBankSearch}
                        />
                        <CommandEmpty>
                            <button
                                type="button"
                                className="w-full text-left p-2 text-sm hover:bg-accent"
                                onClick={() => {
                                    form.setValue("destinationBank", bankSearch);
                                    setBankPopoverOpen(false);
                                    setBankSearch("");
                                    inputRefs.destinationAccountName.current?.focus();
                                }}
                            >
                                Gunakan "{bankSearch}"
                            </button>
                        </CommandEmpty>
                        <CommandGroup>
                            <ScrollArea className="h-72">
                            {bankData.map((bank) => (
                                <CommandItem
                                value={bank.name}
                                key={bank.name}
                                onSelect={() => {
                                    form.setValue("destinationBank", bank.name)
                                    setBankPopoverOpen(false)
                                    setBankSearch("")
                                    inputRefs.destinationAccountName.current?.focus();
                                }}
                                >
                                <Check
                                    className={cn(
                                    "mr-2 h-4 w-4",
                                    bank.name === field.value ? "opacity-100" : "opacity-0"
                                    )}
                                />
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
            
            <FormField control={form.control} name="destinationAccountName" render={({ field }) => (
                <FormItem>
                    <FormLabel>Nama Pemilik Rekening</FormLabel>
                    <FormControl>
                        <Input
                            ref={inputRefs.destinationAccountName}
                            placeholder="Masukkan nama" 
                            {...field}
                            onKeyDown={(e) => handleKeyDown(e, inputRefs.transferAmount)}
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}/>

            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="transferAmount" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Nominal Transfer</FormLabel>
                        <FormControl>
                            <Input
                                ref={inputRefs.transferAmount}
                                type="text" 
                                placeholder="Rp 0" 
                                {...field} 
                                value={formatToRupiah(field.value)} 
                                onChange={(e) => field.onChange(parseRupiah(e.target.value))}
                                onKeyDown={(e) => handleKeyDown(e, inputRefs.serviceFee)}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}/>
                <FormField control={form.control} name="serviceFee" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Biaya Jasa (Laba)</FormLabel>
                        <FormControl>
                             <Input
                                ref={inputRefs.serviceFee}
                                type="text" 
                                placeholder="Rp 0" 
                                {...field} 
                                value={formatToRupiah(field.value)} 
                                onChange={(e) => field.onChange(parseRupiah(e.target.value))}
                                onKeyDown={(e) => handleKeyDown(e, inputRefs.bankAdminFee)}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}/>
            </div>
             <FormField control={form.control} name="bankAdminFee" render={({ field }) => (
                <FormItem>
                    <FormLabel>Biaya Admin Bank</FormLabel>
                    <FormControl>
                        <Input
                            ref={inputRefs.bankAdminFee}
                            type="text" 
                            placeholder="Rp 0 (Opsional)" 
                            {...field} 
                            value={formatToRupiah(field.value)} 
                            onChange={(e) => field.onChange(parseRupiah(e.target.value))} 
                            onKeyDown={(e) => handleKeyDown(e)}
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}/>

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
                            <FormControl>
                                <Input
                                    ref={inputRefs.splitTunaiAmount}
                                    type="text" 
                                    placeholder="Rp 0" 
                                    {...field} 
                                    value={formatToRupiah(field.value)} 
                                    onChange={(e) => field.onChange(parseRupiah(e.target.value))} 
                                    onKeyDown={(e) => handleKeyDown(e)}
                                />
                            </FormControl>
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
    <DuplicateTransactionDialog 
        isOpen={isDuplicateDialogOpen}
        onConfirm={() => {
            if(formData) {
                proceedWithTransaction(formData);
            }
        }}
        onCancel={() => {
            setIsDuplicateDialogOpen(false);
            onDone();
        }}
    />
    </>
  );
}

