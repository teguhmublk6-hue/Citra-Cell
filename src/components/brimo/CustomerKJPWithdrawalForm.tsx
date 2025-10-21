
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEffect } from 'react';
import type { CustomerKJPWithdrawalFormValues } from '@/lib/types';
import { CustomerKJPWithdrawalFormSchema } from '@/lib/types';
import Image from 'next/image';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';

interface CustomerKJPWithdrawalFormProps {
  onReview: (data: CustomerKJPWithdrawalFormValues) => void;
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


export default function CustomerKJPWithdrawalForm({ onReview, onDone }: CustomerKJPWithdrawalFormProps) {

  const form = useForm<CustomerKJPWithdrawalFormValues>({
    resolver: zodResolver(CustomerKJPWithdrawalFormSchema),
    defaultValues: {
        customerName: '',
        withdrawalAmount: undefined,
        serviceFee: undefined,
        feePaymentMethod: undefined,
    },
  });

  const withdrawalAmount = form.watch('withdrawalAmount');

  useEffect(() => {
    if (withdrawalAmount !== undefined) {
      const fee = calculateServiceFee(withdrawalAmount);
      form.setValue('serviceFee', fee, { shouldValidate: true });
    }
  }, [withdrawalAmount, form]);
  
  const onSubmit = (values: CustomerKJPWithdrawalFormValues) => {
    onReview(values);
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
