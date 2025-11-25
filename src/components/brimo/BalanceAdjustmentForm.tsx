
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useFirestore } from '@/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import type { KasAccount } from '@/lib/data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';

const numberPreprocessor = (val: unknown) => (val === "" || val === undefined || val === null) ? undefined : Number(String(val).replace(/[^0-9]/g, ""));

const formSchema = z.object({
  actualBalance: z.preprocess(
    numberPreprocessor,
    z.number({ required_error: "Saldo aktual harus diisi", invalid_type_error: "Jumlah harus angka" }).min(0, "Saldo tidak boleh negatif")
  ),
  reason: z.string().optional(),
});

interface BalanceAdjustmentFormProps {
  account: KasAccount;
  onDone: () => void;
  onBack: () => void;
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

export default function BalanceAdjustmentForm({ account, onDone, onBack }: BalanceAdjustmentFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      actualBalance: undefined,
      reason: '',
    },
  });

  const actualBalance = form.watch('actualBalance');
  const appBalance = account.balance;
  const difference = actualBalance !== undefined ? actualBalance - appBalance : 0;

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!firestore || difference === 0) {
      if (difference === 0) {
        toast({ title: "Tidak Ada Perubahan", description: "Saldo aplikasi sudah sesuai dengan saldo aktual." });
        onDone();
      }
      return;
    }
    
    setIsSaving(true);

    try {
        const batch = writeBatch(firestore);
        const deviceName = localStorage.getItem('brimoDeviceName') || 'Unknown Device';

        const accountRef = doc(firestore, 'kasAccounts', account.id);
        const transactionRef = doc(collection(accountRef, 'transactions'));
        const now = new Date().toISOString();

        batch.update(accountRef, { balance: values.actualBalance });
        
        batch.set(transactionRef, {
            kasAccountId: account.id,
            type: difference > 0 ? 'credit' : 'debit',
            name: values.reason || 'Penyesuaian Saldo',
            account: 'Audit',
            date: now,
            amount: Math.abs(difference),
            balanceBefore: appBalance,
            balanceAfter: values.actualBalance,
            category: 'adjustment',
            deviceName: deviceName
        });
        
        await batch.commit();

        toast({ title: "Sukses", description: "Saldo akun berhasil disesuaikan." });
        onDone();
    } catch (error) {
        console.error("Error adjusting balance: ", error);
        toast({ variant: "destructive", title: "Error", description: "Terjadi kesalahan saat menyesuaikan saldo." });
    } finally {
        setIsSaving(false);
    }
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex flex-col h-full">
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 pt-4 pb-6">
            <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Saldo di Aplikasi</p>
                <p className="text-2xl font-bold">{formatToRupiah(appBalance)}</p>
            </div>
            
            <FormField
              control={form.control}
              name="actualBalance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Saldo Aktual di Bank/Fisik</FormLabel>
                  <FormControl>
                      <Input
                      type="tel"
                      placeholder="Rp 0"
                      {...field}
                      value={formatToRupiah(field.value)}
                      onChange={(e) => field.onChange(parseRupiah(e.target.value))}
                      autoFocus
                      />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alasan Penyesuaian (Opsional)</FormLabel>
                  <FormControl>
                    <Input placeholder="cth: Selisih biaya admin bank" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {actualBalance !== undefined && (
                <Alert variant={difference === 0 ? "default" : (difference > 0 ? "default" : "destructive")} className={difference === 0 ? "border-green-500" : ""}>
                    <AlertTitle>Hasil Pencocokan</AlertTitle>
                    <AlertDescription>
                        {difference === 0 ? "Saldo sudah cocok." : `Terdapat selisih ${formatToRupiah(difference)}. Transaksi penyesuaian akan dibuat.`}
                    </AlertDescription>
                </Alert>
            )}

          </div>
        </ScrollArea>
        <div className="flex gap-2 pt-4 pb-4 border-t -mx-6 px-6">
          <Button type="button" variant="outline" onClick={onBack} className="w-full" disabled={isSaving}>
            Kembali
          </Button>
          <Button type="submit" className="w-full" disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSaving ? "Menyimpan..." : "Simpan Penyesuaian"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
