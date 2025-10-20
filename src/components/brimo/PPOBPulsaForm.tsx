
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
import type { PPOBPulsaFormValues } from '@/lib/types';
import { PPOBPulsaFormSchema } from '@/lib/types';
import { Card, CardContent } from '../ui/card';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface PPOBPulsaFormProps {
  onReview: (data: PPOBPulsaFormValues) => void;
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

const denominations = ["5.000", "10.000", "15.000", "20.000", "25.000", "30.000", "40.000", "50.000", "75.000", "100.000", "150.000", "200.000"];

const providers = [
    { name: 'Telkomsel', prefixes: ['0811', '0812', '0813', '0821', '0822', '0852', '0853', '0823', '0851'] },
    { name: 'Indosat', prefixes: ['0814', '0815', '0816', '0855', '0856', '0857', '0858'] },
    { name: 'XL', prefixes: ['0817', '0818', '0819', '0859', '0877', '0878'] },
    { name: 'Axis', prefixes: ['0838', '0831', '0832', '0833'] },
    { name: 'Tri', prefixes: ['0895', '0896', '0897', '0898', '0899'] },
    { name: 'Smartfren', prefixes: ['0881', '0882', '0883', '0884', '0885', '0886', '0887', '0888', '0889'] },
];

export default function PPOBPulsaForm({ onReview, onDone }: PPOBPulsaFormProps) {
  const firestore = useFirestore();
  const [currentStep, setCurrentStep] = useState(1);
  const [detectedProvider, setDetectedProvider] = useState<string | null>(null);
  
  const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

  const refinedSchema = PPOBPulsaFormSchema.superRefine((data, ctx) => {
    if (data.paymentMethod === 'Transfer' && !data.paymentToKasTransferAccountId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Akun penerima bayaran harus dipilih.', path: ['paymentToKasTransferAccountId'] });
    }
    if (data.paymentMethod === 'Split') {
        if (!data.splitTunaiAmount || data.splitTunaiAmount <= 0) {
             ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Jumlah tunai harus diisi.', path: ['splitTunaiAmount'] });
        }
        if (!data.paymentToKasTransferAccountId) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Akun penerima sisa bayaran harus dipilih.', path: ['paymentToKasTransferAccountId'] });
        }
    }
  });

  const form = useForm<PPOBPulsaFormValues>({
    resolver: zodResolver(refinedSchema),
    defaultValues: {
        sourcePPOBAccountId: '',
        phoneNumber: '',
        denomination: '',
        costPrice: undefined,
        sellingPrice: undefined,
        paymentMethod: undefined,
        paymentToKasTransferAccountId: '',
        splitTunaiAmount: undefined,
    },
  });

  const paymentMethod = form.watch('paymentMethod');
  const phoneNumber = form.watch('phoneNumber');

  useEffect(() => {
    const prefix = phoneNumber.substring(0, 4);
    const foundProvider = providers.find(p => p.prefixes.includes(prefix));
    setDetectedProvider(foundProvider ? foundProvider.name : null);
  }, [phoneNumber]);

  const ppobAccounts = useMemo(() => kasAccounts?.filter(acc => acc.type === 'PPOB'), [kasAccounts]);

  const onSubmit = (values: PPOBPulsaFormValues) => { onReview(values); };
  
  const selectedPPOBAccount = ppobAccounts?.find(acc => acc.id === form.watch('sourcePPOBAccountId'));

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
                        <Card key={acc.id} onClick={() => { form.setValue('sourcePPOBAccountId', acc.id); setCurrentStep(2); }} className="cursor-pointer hover:ring-2 hover:ring-primary transition">
                            <CardContent className="p-4 text-center">
                                <p className="font-semibold">{acc.label}</p>
                                <p className="text-sm text-muted-foreground">{formatToRupiah(acc.balance)}</p>
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
                
                <FormField control={form.control} name="denomination" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Pilih Denominasi Pulsa</FormLabel>
                        <div className="grid grid-cols-3 gap-2">
                            {denominations.map(denom => (
                                <Button key={denom} type="button" variant={field.value === denom ? 'default' : 'outline'} onClick={() => field.onChange(denom)}>
                                    {denom}
                                </Button>
                            ))}
                        </div>
                        <FormMessage />
                    </FormItem>
                )}/>

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
          <Button type="button" variant="outline" onClick={onDone} className="w-full">Batal</Button>
          <Button type="submit" className="w-full" disabled={currentStep !== 2}>Review</Button>
        </div>
      </form>
    </Form>
  );
}
