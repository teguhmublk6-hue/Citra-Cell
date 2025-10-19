
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Transaction } from '@/lib/data';

const formSchema = z.object({
  name: z.string().min(1, 'Nama transaksi harus diisi'),
});

type TransactionWithId = Transaction & { id: string };

interface EditTransactionNameFormProps {
  transaction: TransactionWithId;
  onDone: () => void;
}

export default function EditTransactionNameForm({ transaction, onDone }: EditTransactionNameFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: transaction.name || '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!firestore) return;

    const transactionRef = doc(firestore, 'kasAccounts', transaction.kasAccountId, 'transactions', transaction.id);

    try {
      await updateDoc(transactionRef, {
        name: values.name,
      });
      toast({ title: 'Sukses', description: 'Nama transaksi berhasil diperbarui.' });
      onDone();
    } catch (error) {
      console.error("Error updating transaction name: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Gagal memperbarui nama transaksi.' });
    }
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex flex-col h-full pt-4">
        <div className="flex-1">
            <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Nama Transaksi Baru</FormLabel>
                <FormControl>
                    <Input placeholder="cth: Bayar listrik bulan lalu" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
        <div className="flex gap-2 pb-4">
          <Button type="button" variant="outline" onClick={onDone} className="w-full">
            Batal
          </Button>
          <Button type="submit" className="w-full">
            Simpan Perubahan
          </Button>
        </div>
      </form>
    </Form>
  );
}
