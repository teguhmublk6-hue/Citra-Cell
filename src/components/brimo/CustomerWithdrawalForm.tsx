
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
import bankData from '@/lib/banks.json';
import { useState, useEffect, useMemo } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CustomerWithdrawalFormValues } from '@/lib/types';
import { CustomerWithdrawalFormSchema } from '@/lib/types';


interface CustomerWithdrawalFormProps {
  onReview: (data: CustomerWithdrawalFormValues) => void;
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
    if (amount >= 1000 && amount <= 49000) return 3000;
    if (amount >= 50000 && amount <= 999000) return 5000;
    if (amount >= 1000000 && amount <= 1999000) return 7000;
    if (amount >= 2000000 && amount <= 3499000) return 10000;
    if (amount >= 3500000 && amount <= 5999000) return 15000;
    if (amount >= 6000000 && amount <= 7999000) return 20000;
    if (amount >= 8000000 && amount <= 10000000) return 25000;
    return 0;
};


export default function CustomerWithdrawalForm({ onReview, onDone }: CustomerWithdrawalFormProps) {
  const firestore = useFirestore();
  const [bankPopoverOpen, setBankPopoverOpen] = useState(false);

  
  const kasAccountsCollection = useMemoFirebase(() => {
    return collection(firestore, 'kasAccounts');
  }, [firestore]);

  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

  const form = useForm<CustomerWithdrawalFormValues>({
    resolver: zodResolver(CustomerWithdrawalFormSchema),
    defaultValues: {
        customerBankSource: '',
        customerName: '',
        withdrawalAmount: undefined,
        serviceFee: undefined,
        destinationAccountId: '',
    },
  });

  const withdrawalAmount = form.watch('withdrawalAmount');

  useEffect(() => {
    if (withdrawalAmount !== undefined) {
      const fee = calculateServiceFee(withdrawalAmount);
      form.setValue('serviceFee', fee, { shouldValidate: true });
    }
  }, [withdrawalAmount, form]);
  
  const destinationKasAccounts = useMemo(() => {
      return kasAccounts?.filter(acc => ['Bank', 'E-Wallet', 'Merchant'].includes(acc.type));
  }, [kasAccounts])

  const onSubmit = (values: CustomerWithdrawalFormValues) => {
    onReview(values);
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex flex-col h-full">
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 pt-4 pb-6">
            
            {/* Bank/E-wallet Pelanggan */}
            <FormField
                control={form.control}
                name="customerBankSource"
                render={({ field }) => (
                <FormItem className="flex flex-col">
                    <FormLabel>Bank/E-wallet Pelanggan</FormLabel>
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
                            ? bankData.find((bank) => bank.name === field.value)?.name
                            : "Pilih bank/e-wallet"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                        </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[--radix-popover-content-available-height] p-0">
                        <Command>
                        <CommandInput placeholder="Cari bank..." />
                        <CommandEmpty>Bank tidak ditemukan.</CommandEmpty>
                        <CommandGroup>
                            <ScrollArea className="h-72">
                            {bankData.map((bank) => (
                                <CommandItem
                                value={bank.name}
                                key={bank.name}
                                onSelect={() => {
                                    form.setValue("customerBankSource", bank.name)
                                    setBankPopoverOpen(false)
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
            
            {/* Nama Penarik Tunai */}
            <FormField control={form.control} name="customerName" render={({ field }) => (
                <FormItem>
                    <FormLabel>Nama Penarik Tunai</FormLabel>
                    <FormControl>
                        <Input placeholder="Masukkan nama pelanggan" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}/>

            {/* Nominal & Biaya */}
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

            {/* Akun Kas Tujuan */}
            <FormField
              control={form.control}
              name="destinationAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Saldo Masuk Ke Akun</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih akun penerima" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {destinationKasAccounts?.map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.label} ({formatToRupiah(acc.balance)})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

    
