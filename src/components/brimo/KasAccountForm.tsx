
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import type { KasAccount } from '@/lib/data';
import { accountTypes } from '@/lib/data';
import { setDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

const numberPreprocessor = (val: unknown) => (val === "" || val === undefined || val === null) ? undefined : Number(String(val).replace(/[^0-9]/g, ""));

const formSchema = z.object({
  label: z.string().min(1, 'Nama akun harus diisi'),
  type: z.string().min(1, 'Jenis akun harus dipilih'),
  balance: z.preprocess(
    numberPreprocessor,
    z.number({ invalid_type_error: "Saldo harus angka" }).min(0, 'Saldo tidak boleh negatif')
  ),
  minimumBalance: z.preprocess(
    numberPreprocessor,
    z.number({ invalid_type_error: "Saldo minimal harus angka" }).min(0, 'Saldo minimal tidak boleh negatif').optional()
  ),
});

interface KasAccountFormProps {
  account: KasAccount | null;
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


export default function KasAccountForm({ account, onDone }: KasAccountFormProps) {
  const firestore = useFirestore();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      label: account?.label || '',
      type: account?.type || '',
      balance: account?.balance || undefined,
      minimumBalance: account?.minimumBalance || undefined,
    },
  });

  useEffect(() => {
    if (account) {
        form.reset({
            label: account.label,
            type: account.type,
            balance: account.balance,
            minimumBalance: account.minimumBalance,
        });
    }
  }, [account, form])

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const selectedType = accountTypes.find(t => t.value === values.type);
    const accountData = {
      label: values.label,
      type: values.type,
      balance: values.balance,
      minimumBalance: values.minimumBalance || 0,
      color: selectedType?.color || 'bg-gray-500',
    };

    if (account) {
      // Update
      const docRef = doc(firestore, 'kasAccounts', account.id);
      setDocumentNonBlocking(docRef, accountData, { merge: true });
    } else {
      // Create
      const collectionRef = collection(firestore, 'kasAccounts');
      addDocumentNonBlocking(collectionRef, accountData);
    }
    onDone();
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex flex-col h-full">
        <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 pt-4 pb-6">
                <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Nama Akun Kas</FormLabel>
                    <FormControl>
                        <Input placeholder="cth: Dompet Utama" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Jenis Akun Kas</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Pilih jenis akun" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {accountTypes.map(type => (
                            <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="balance"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Saldo Awal</FormLabel>
                    <FormControl>
                        <Input
                        type="text"
                        placeholder="Rp 0"
                        {...field}
                        value={formatToRupiah(field.value)}
                        onChange={(e) => {
                            const parsedValue = parseRupiah(e.target.value);
                            field.onChange(parsedValue);
                            e.target.value = formatToRupiah(parsedValue) || '';
                        }}
                        onBlur={(e) => {
                            const formatted = formatToRupiah(e.target.value);
                            e.target.value = formatted === "Rp 0" ? "" : formatted;
                            field.onBlur();
                        }}
                        onFocus={(e) => {
                            if (e.target.value === "Rp 0") {
                                e.target.value = "";
                            }
                        }}
                        />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="minimumBalance"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Saldo Minimal</FormLabel>
                    <FormControl>
                        <Input 
                        type="text"
                        placeholder="Rp 0"
                        {...field}
                        value={formatToRupiah(field.value)}
                        onChange={(e) => {
                            const parsedValue = parseRupiah(e.target.value);
                            field.onChange(parsedValue);
                            e.target.value = formatToRupiah(parsedValue) || '';
                        }}
                        onBlur={(e) => {
                            const formatted = formatToRupiah(e.target.value);
                            e.target.value = formatted === "Rp 0" ? "" : formatted;
                            field.onBlur();
                        }}
                        onFocus={(e) => {
                            if (e.target.value === "Rp 0") {
                                e.target.value = "";
                            }
                        }}
                        />
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
                Simpan
            </Button>
        </div>
      </form>
    </Form>
  );
}
