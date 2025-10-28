
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, addDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';
import type { KasAccount, Transaction } from '@/lib/data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Loader2 } from 'lucide-react';
import type { ShiftReconciliationFormValues } from '@/lib/types';
import { ShiftReconciliationFormSchema } from '@/lib/types';
import { useEffect, useState } from 'react';
import { startOfDay, endOfDay } from 'date-fns';

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

export default function ShiftReconciliationForm({ onDone }: { onDone: () => void }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [appCashIn, setAppCashIn] = useState<number | null>(null);
  const [isLoadingCash, setIsLoadingCash] = useState(true);

  const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

  useEffect(() => {
    const calculateAppCashIn = async () => {
      if (!firestore || !kasAccounts) return;
      setIsLoadingCash(true);

      const laciAccount = kasAccounts.find(acc => acc.label === "Laci");
      if (!laciAccount) {
        toast({ variant: 'destructive', title: 'Error', description: 'Akun kas "Laci" tidak ditemukan.' });
        setIsLoadingCash(false);
        return;
      }

      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();

      const transactionsRef = collection(firestore, 'kasAccounts', laciAccount.id, 'transactions');
      const q = query(
        transactionsRef,
        where('date', '>=', todayStart),
        where('date', '<=', todayEnd)
      );

      let totalCashIn = 0;
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach(doc => {
        const trx = doc.data() as Transaction;
        if (trx.type === 'credit') {
            totalCashIn += trx.amount;
        }
      });

      setAppCashIn(totalCashIn);
      setIsLoadingCash(false);
    };

    if (kasAccounts) {
      calculateAppCashIn();
    }
  }, [firestore, kasAccounts, toast]);

  const form = useForm<ShiftReconciliationFormValues>({
    resolver: zodResolver(ShiftReconciliationFormSchema),
    defaultValues: {
      operatorName: '',
      voucherCashIn: undefined,
      actualPhysicalCash: undefined,
      notes: '',
    },
  });

  const voucherCashIn = form.watch('voucherCashIn') || 0;
  const actualPhysicalCash = form.watch('actualPhysicalCash') || 0;
  const expectedTotalCash = (appCashIn || 0) + voucherCashIn;
  const difference = expectedTotalCash - actualPhysicalCash;

  const onSubmit = async (values: ShiftReconciliationFormValues) => {
    if (!firestore || appCashIn === null) return;
    
    const deviceName = localStorage.getItem('brimoDeviceName') || 'Unknown Device';
    
    try {
        await addDoc(collection(firestore, 'shiftReconciliations'), {
            date: new Date(),
            operatorName: values.operatorName,
            appCashIn: appCashIn,
            voucherCashIn: values.voucherCashIn,
            expectedTotalCash: expectedTotalCash,
            actualPhysicalCash: values.actualPhysicalCash,
            difference: difference,
            notes: values.notes || '',
            deviceName,
        });

        toast({ title: 'Sukses', description: 'Data rekonsiliasi shift berhasil disimpan.' });
        onDone();
    } catch (error) {
        console.error("Error saving shift reconciliation: ", error);
        toast({ variant: "destructive", title: "Error", description: "Gagal menyimpan data." });
    }
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex flex-col h-full">
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 pt-4 pb-6">
            <FormField control={form.control} name="operatorName" render={({ field }) => (
                <FormItem>
                    <FormLabel>Nama Operator Shift</FormLabel>
                    <FormControl><Input placeholder="Masukkan nama Anda" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
            )}/>
            
            <FormItem>
                <FormLabel>Total Uang Tunai dari Aplikasi Ini</FormLabel>
                {isLoadingCash ? (
                    <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Menghitung...</div>
                ) : (
                    <Input value={formatToRupiah(appCashIn)} readOnly disabled />
                )}
            </FormItem>

            <FormField control={form.control} name="voucherCashIn" render={({ field }) => (
                <FormItem>
                    <FormLabel>Total Uang Tunai dari POS Voucher</FormLabel>
                    <FormControl><Input type="text" placeholder="Rp 0" {...field} value={formatToRupiah(field.value)} onChange={(e) => field.onChange(parseRupiah(e.target.value))} /></FormControl>
                    <FormMessage />
                </FormItem>
            )}/>
            
            <FormField control={form.control} name="actualPhysicalCash" render={({ field }) => (
                <FormItem>
                    <FormLabel>Total Uang Fisik Aktual di Laci</FormLabel>
                    <FormControl><Input type="text" placeholder="Rp 0" {...field} value={formatToRupiah(field.value)} onChange={(e) => field.onChange(parseRupiah(e.target.value))} /></FormControl>
                    <FormMessage />
                </FormItem>
            )}/>

             <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                    <FormLabel>Catatan (Opsional)</FormLabel>
                    <FormControl><Input placeholder="cth: Selisih untuk bayar parkir" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
            )}/>

            <Alert variant={difference !== 0 ? (difference > 0 ? 'destructive' : 'default') : 'default'} className={difference === 0 ? 'border-green-500' : ''}>
                <AlertTitle>Hasil Rekonsiliasi</AlertTitle>
                <AlertDescription>
                    <div className="space-y-1 mt-2">
                        <div className="flex justify-between"><span>Total Seharusnya:</span> <strong>{formatToRupiah(expectedTotalCash)}</strong></div>
                        <div className="flex justify-between"><span>Uang Fisik:</span> <strong>{formatToRupiah(actualPhysicalCash)}</strong></div>
                        <div className={`flex justify-between font-bold ${difference !== 0 ? 'text-destructive' : 'text-green-500'}`}><span>Selisih:</span> <strong>{formatToRupiah(difference)}</strong></div>
                    </div>
                </AlertDescription>
            </Alert>
          </div>
        </ScrollArea>
        <div className="flex gap-2 pt-4 pb-4 border-t -mx-6 px-6">
          <Button type="button" variant="outline" onClick={onDone} className="w-full">
            Batal
          </Button>
          <Button type="submit" className="w-full">
            Simpan Rekonsiliasi
          </Button>
        </div>
      </form>
    </Form>
  );
}
