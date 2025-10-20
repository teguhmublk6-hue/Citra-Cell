
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import type { SettlementFormValues } from '@/lib/types';
import { SettlementFormSchema } from '@/lib/types';
import type { KasAccount } from '@/lib/data';
import { useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Banknote, Info } from 'lucide-react';


interface SettlementFormProps {
  account: KasAccount;
  onReview: (data: SettlementFormValues) => void;
  onDone: () => void;
}

const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '') return '';
    const num = Number(String(value).replace(/[^0-9]/g, ''));
    if (isNaN(num)) return '';
    return `Rp ${num.toLocaleString('id-ID')}`;
};

export default function SettlementForm({ account, onReview, onDone }: SettlementFormProps) {
  const { toast } = useToast();

  const form = useForm<SettlementFormValues>({
    resolver: zodResolver(SettlementFormSchema),
    defaultValues: {
      sourceMerchantAccountId: account.id,
    },
  });

  useEffect(() => {
    if (!account.settlementDestinationAccountId) {
        toast({
            variant: "destructive",
            title: "Tujuan Settlement Belum Diatur",
            description: `Harap atur 'Akun Tujuan Settlement' untuk akun ${account.label} di menu Manajemen Akun Kas.`,
            duration: 5000,
        });
        onDone();
    }
    if (account.balance <= 0) {
        toast({
            variant: "destructive",
            title: "Saldo Kosong",
            description: `Saldo akun ${account.label} adalah nol. Tidak ada yang bisa di-settle.`,
            duration: 5000,
        });
        onDone();
    }
  }, [account, onDone, toast]);

  const onSubmit = (values: SettlementFormValues) => {
    onReview(values);
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex flex-col h-full">
        <div className="flex-1 -mx-6 px-6 pt-4 pb-6">
            <Alert>
                <Banknote className="h-4 w-4" />
                <AlertTitle>Konfirmasi Proses Settlement</AlertTitle>
                <AlertDescription>
                    Anda akan melakukan settlement untuk akun <strong>{account.label}</strong> dengan saldo saat ini sebesar <strong>{formatToRupiah(account.balance)}</strong>.
                    <br/><br/>
                    Seluruh saldo akan dipindahkan ke akun tujuan yang telah ditentukan, setelah dipotong biaya MDR.
                </AlertDescription>
            </Alert>
        </div>
        <div className="flex gap-2 pt-0 pb-4 border-t border-border -mx-6 px-6 pt-4">
          <Button type="button" variant="outline" onClick={onDone} className="w-full">
            Batal
          </Button>
          <Button type="submit" className="w-full">
            Lanjutkan ke Review
          </Button>
        </div>
      </form>
    </Form>
  );
}
