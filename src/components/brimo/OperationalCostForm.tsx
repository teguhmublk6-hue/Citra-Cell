
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import type { KasAccount } from '@/lib/data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '../ui/command';

const numberPreprocessor = (val: unknown) => (val === "" || val === undefined || val === null) ? undefined : Number(String(val).replace(/[^0-9]/g, ""));

const formSchema = z.object({
  sourceAccountId: z.string().min(1, 'Akun sumber harus dipilih'),
  amount: z.preprocess(
    numberPreprocessor,
    z.number({ invalid_type_error: "Jumlah harus angka" }).positive('Jumlah harus lebih dari 0')
  ),
  purpose: z.string().min(1, 'Keperluan harus diisi'),
});

interface OperationalCostFormProps {
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

export default function OperationalCostForm({ onDone }: OperationalCostFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sourceAccountId: '',
      amount: undefined,
      purpose: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!firestore || !kasAccounts) {
        toast({ variant: "destructive", title: "Gagal", description: "Database tidak tersedia." });
        return;
    }
    
    setIsSaving(true);

    const sourceAccount = kasAccounts.find(acc => acc.id === values.sourceAccountId);

    if (!sourceAccount) {
      toast({ variant: "destructive", title: "Gagal", description: "Akun sumber tidak ditemukan." });
      setIsSaving(false);
      return;
    }
    
    if (sourceAccount.balance < values.amount) {
      form.setError('amount', { type: 'manual', message: 'Saldo tidak mencukupi.' });
      setIsSaving(false);
      return;
    }

    try {
        const batch = writeBatch(firestore);
        const deviceName = localStorage.getItem('brimoDeviceName') || 'Unknown Device';

        const sourceDocRef = doc(firestore, 'kasAccounts', sourceAccount.id);
        const sourceTransactionRef = doc(collection(sourceDocRef, 'transactions'));
        const now = new Date().toISOString();

        batch.update(sourceDocRef, { balance: sourceAccount.balance - values.amount });
        
        batch.set(sourceTransactionRef, {
            kasAccountId: sourceAccount.id,
            type: 'debit',
            name: values.purpose,
            account: 'Biaya Operasional',
            date: now,
            amount: values.amount,
            balanceBefore: sourceAccount.balance,
            balanceAfter: sourceAccount.balance - values.amount,
            category: 'operational',
            deviceName: deviceName
        });
        
        await batch.commit();

        toast({ title: "Sukses", description: "Biaya operasional berhasil dicatat." });
        onDone();
    } catch (error) {
        console.error("Error adding operational cost: ", error);
        toast({ variant: "destructive", title: "Error", description: "Terjadi kesalahan saat mencatat biaya." });
    } finally {
        setIsSaving(false);
    }
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex flex-col h-full">
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 pt-4 pb-6">
            <FormField
              control={form.control}
              name="sourceAccountId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Asal Akun</FormLabel>
                   <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
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
                          {kasAccounts?.map((acc) => (
                            <CommandItem
                              value={acc.label}
                              key={acc.id}
                              onSelect={() => {
                                form.setValue("sourceAccountId", acc.id)
                                setPopoverOpen(false)
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
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nominal</FormLabel>
                  <FormControl>
                      <Input
                      type="text"
                      placeholder="Rp 0"
                      {...field}
                      value={formatToRupiah(field.value)}
                      onChange={(e) => {
                          field.onChange(parseRupiah(e.target.value));
                      }}
                      />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Keperluan</FormLabel>
                  <FormControl>
                    <Input placeholder="cth: Bayar uang sampah" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </ScrollArea>
        <div className="flex gap-2 pt-0 pb-4 border-t border-border -mx-6 px-6 pt-4">
          <Button type="button" variant="outline" onClick={onDone} className="w-full" disabled={isSaving}>
            Batal
          </Button>
          <Button type="submit" className="w-full" disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSaving ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
