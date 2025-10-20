
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { KasAccount } from '@/lib/data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { useState, useEffect, useMemo } from 'react';
import type { CustomerTopUpFormValues } from '@/lib/types';
import { CustomerTopUpFormSchema } from '@/lib/types';
import { Card, CardContent } from '../ui/card';
import { cn } from '@/lib/utils';
import Image from 'next/image';


interface CustomerTopUpFormProps {
  onReview: (data: CustomerTopUpFormValues) => void;
  onDone: () => void;
}

const ewallets = [
    { name: 'DANA', icon: 'https://cdn.antaranews.com/cache/1200x800/2022/04/17/DANA-Logo.jpg', hint: 'dana logo' },
    { name: 'OVO', icon: 'https://upload.wikimedia.org/wikipedia/commons/e/eb/Logo_ovo_purple.svg', hint: 'ovo logo' },
    { name: 'GoPay', icon: 'https://upload.wikimedia.org/wikipedia/commons/8/86/Gopay_logo.svg', hint: 'gopay logo' },
    { name: 'ShopeePay', icon: 'https://tokpee.co/blog/wp-content/uploads/2025/03/Begini-Cara-Membagikan-Kode-QR-ShopeePay-Biar-Uang-Langsung-Masuk.webp', hint: 'shopeepay logo' },
    { name: 'LinkAja', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/LinkAja.svg/2560px-LinkAja.svg.png', hint: 'linkaja logo' },
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


export default function CustomerTopUpForm({ onReview, onDone }: CustomerTopUpFormProps) {
  const firestore = useFirestore();
  
  const kasAccountsCollection = useMemoFirebase(() => {
    return collection(firestore, 'kasAccounts');
  }, [firestore]);

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
        paymentMethod: undefined,
        paymentToKasTransferAccountId: '',
        splitTunaiAmount: undefined,
    },
  });

  const paymentMethod = form.watch('paymentMethod');
  const topUpAmount = form.watch('topUpAmount');
  const selectedEwallet = form.watch('destinationEwallet');

  useEffect(() => {
    if (topUpAmount !== undefined) {
      const fee = calculateServiceFee(topUpAmount);
      form.setValue('serviceFee', fee, { shouldValidate: true });
    }
  }, [topUpAmount, form]);

  const sourceKasAccounts = useMemo(() => {
      return kasAccounts?.filter(acc => ['Bank', 'E-Wallet'].includes(acc.type));
  }, [kasAccounts]);

  const onSubmit = (values: CustomerTopUpFormValues) => {
    onReview(values);
  };
  
  return (
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
                   <div className="grid grid-cols-3 gap-2">
                        {ewallets.map(wallet => (
                            <Card 
                                key={wallet.name}
                                onClick={() => field.onChange(wallet.name)}
                                className={cn("cursor-pointer", field.value === wallet.name && "ring-2 ring-primary")}
                            >
                                <CardContent className="p-2 flex items-center justify-center aspect-[2/1]">
                                    <div className="relative w-full h-full">
                                        <Image src={wallet.icon} alt={wallet.name} fill style={{ objectFit: 'contain' }} data-ai-hint={wallet.hint} />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Akun Kas Asal */}
            <FormField
              control={form.control}
              name="sourceAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sumber Dana Top Up</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih akun sumber" />
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
            
            {/* Nama Pelanggan */}
            <FormField control={form.control} name="customerName" render={({ field }) => (
                <FormItem>
                    <FormLabel>Nama Pelanggan</FormLabel>
                    <FormControl>
                        <Input placeholder="Masukkan nama" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}/>

            {/* Nominal & Biaya */}
            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="topUpAmount" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Nominal Top Up</FormLabel>
                        <FormControl><Input type="text" placeholder="Rp 0" {...field} value={formatToRupiah(field.value)} onChange={(e) => field.onChange(parseRupiah(e.target.value))} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}/>
                <FormField control={form.control} name="serviceFee" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Biaya Jasa</FormLabel>
                        <FormControl><Input type="text" placeholder="Rp 0" {...field} value={formatToRupiah(field.value)} onChange={(e) => field.onChange(parseRupiah(e.target.value))} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}/>
            </div>

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
          <Button type="button" variant="outline" onClick={onDone} className="w-full">
            Batal
          </Button>
          <Button type="submit" className="w-full">
            Review
          </Button>
        </div>
      </form>
    </Form>
  );
}

    