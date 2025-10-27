
"use client";

import { useForm, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { KasAccount } from '@/lib/data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { useState, useEffect, useMemo, useRef } from 'react';
import type { PPOBBpjsFormValues } from '@/lib/types';
import { PPOBBpjsFormSchema } from '@/lib/types';
import { Card, CardContent } from '../ui/card';
import Image from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface PPOBBpjsFormProps {
  onReview: (data: PPOBBpjsFormValues) => void;
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


export default function PPOBBpjsForm({ onReview, onDone }: PPOBBpjsFormProps) {
  const firestore = useFirestore();
  const [currentStep, setCurrentStep] = useState(1);
  
  const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

  const form = useForm<PPOBBpjsFormValues>({
    resolver: zodResolver(PPOBBpjsFormSchema),
    defaultValues: {
        sourcePPOBAccountId: '',
        customerName: '',
        billAmount: undefined,
        totalAmount: undefined,
        cashback: 0,
        paymentMethod: undefined,
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


  const onSubmit = (values: PPOBBpjsFormValues) => { onReview(values); };
  
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
                                    type="text" placeholder="Rp 0" {...field}
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
                                    type="text" placeholder="Rp 0" {...field}
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
                                    type="text" placeholder="Rp 0" {...field}
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
          <Button type="button" variant="outline" onClick={onDone} className="w-full">Batal</Button>
          <Button type="submit" className="w-full" disabled={currentStep !== 2}>Review</Button>
        </div>
      </form>
    </Form>
  );
}
