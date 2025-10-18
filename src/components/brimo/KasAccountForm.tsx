"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useUser, addDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import type { KasAccount } from '@/lib/data';
import { accountTypes } from '@/lib/data';

const formSchema = z.object({
  label: z.string().min(1, 'Nama akun harus diisi'),
  type: z.string().min(1, 'Jenis akun harus dipilih'),
  balance: z.preprocess(
    (val) => (val === "" ? undefined : Number(String(val).replace(/[^0-9]/g, ""))),
    z.number({ invalid_type_error: "Saldo harus angka" }).min(0, 'Saldo tidak boleh negatif')
  ),
});

interface KasAccountFormProps {
  account: KasAccount | null;
  onDone: () => void;
}

export default function KasAccountForm({ account, onDone }: KasAccountFormProps) {
  const firestore = useFirestore();
  const { user } = useUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      label: account?.label || '',
      type: account?.label || '',
      balance: account?.balance || 0,
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!user) return;

    const selectedType = accountTypes.find(t => t.value === values.type);
    const accountData = {
      userId: user.uid,
      label: values.label,
      balance: values.balance,
      color: selectedType?.color || 'bg-gray-500',
    };

    if (account) {
      // Update
      const docRef = doc(firestore, 'users', user.uid, 'kasAccounts', account.id);
      setDocumentNonBlocking(docRef, accountData, { merge: true });
    } else {
      // Create
      const collectionRef = collection(firestore, 'users', user.uid, 'kasAccounts');
      addDocumentNonBlocking(collectionRef, accountData);
    }
    onDone();
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex flex-col h-full">
        <div className="flex-1 space-y-4">
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
                        onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9]/g, "");
                            field.onChange(Number(value));
                            e.target.value = `Rp ${Number(value).toLocaleString('id-ID')}`;
                        }}
                        onBlur={(e) => {
                            const value = e.target.value.replace(/[^0-9]/g, "");
                            field.onChange(Number(value));
                            e.target.value = `Rp ${Number(value).toLocaleString('id-ID')}`;
                        }}
                         value={`Rp ${Number(field.value || 0).toLocaleString('id-ID')}`}
                    />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
        <div className="flex gap-2">
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
