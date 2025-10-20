
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc, runTransaction, addDoc, query, where, getDocs } from "firebase/firestore";
import type { KasAccount } from "@/lib/data";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import type { EDCServiceFormValues } from "@/lib/types";
import { EDCServiceFormSchema } from "@/lib/types";

interface EDCServiceFormProps {
  onDone: () => void;
}

const formatToRupiah = (value: number | string | undefined | null): string => {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(String(value).replace(/[^0-9]/g, ""));
  if (isNaN(num)) return "";
  return `Rp ${num.toLocaleString("id-ID")}`;
};

const parseRupiah = (value: string | undefined | null): number => {
  if (!value) return 0;
  return Number(String(value).replace(/[^0-9]/g, ""));
};

export default function EDCServiceForm({ onDone }: EDCServiceFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

  const form = useForm<EDCServiceFormValues>({
    resolver: zodResolver(EDCServiceFormSchema),
    defaultValues: {
      customerName: "",
      machineUsed: "",
      serviceFee: 5000,
    },
  });

  const onSubmit = async (values: EDCServiceFormValues) => {
    if (!firestore || !kasAccounts) {
      toast({ variant: "destructive", title: "Error", description: "Database tidak tersedia." });
      return;
    }
    
    const laciAccount = kasAccounts.find(acc => acc.label === "Laci");
    if (!laciAccount) {
      toast({ variant: "destructive", title: "Akun Laci Tidak Ditemukan", description: "Pastikan akun kas 'Laci' dengan tipe 'Tunai' sudah dibuat." });
      return;
    }

    toast({ title: "Memproses...", description: "Menyimpan transaksi Layanan EDC." });

    const now = new Date();
    const nowISO = now.toISOString();
    const deviceName = localStorage.getItem("brimoDeviceName") || "Unknown Device";

    try {
      await runTransaction(firestore, async (transaction) => {
        const laciAccountRef = doc(firestore, 'kasAccounts', laciAccount.id);
        const laciAccountDoc = await transaction.get(laciAccountRef);

        if (!laciAccountDoc.exists()) {
          throw new Error("Akun Laci tidak ditemukan di database.");
        }

        const currentLaciBalance = laciAccountDoc.data().balance;
        const newLaciBalance = currentLaciBalance + values.serviceFee;

        // 1. Update Laci's balance
        transaction.update(laciAccountRef, { balance: newLaciBalance });

        // 2. Create credit transaction in Laci
        const creditTrxRef = doc(collection(laciAccountRef, 'transactions'));
        transaction.set(creditTrxRef, {
          kasAccountId: laciAccount.id,
          type: 'credit',
          name: `Jasa EDC a/n ${values.customerName}`,
          account: 'Pelanggan',
          date: nowISO,
          amount: values.serviceFee,
          balanceBefore: currentLaciBalance,
          balanceAfter: newLaciBalance,
          category: 'edc_service',
          deviceName,
        });
      });

      // --- AUDIT LOG ---
      await addDoc(collection(firestore, "edcServices"), {
        date: now,
        customerName: values.customerName,
        machineUsed: values.machineUsed,
        serviceFee: values.serviceFee,
        paymentToKasTunaiAccountId: laciAccount.id,
        deviceName,
      });

      toast({ title: "Sukses", description: "Layanan EDC berhasil dicatat." });
      onDone();

    } catch (error: any) {
      console.error("Error saving EDC service transaction: ", error);
      toast({ variant: "destructive", title: "Error", description: error.message || "Gagal menyimpan transaksi." });
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 flex flex-col h-full"
      >
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 pt-4 pb-6">
            <FormField
              control={form.control}
              name="customerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Peminjam</FormLabel>
                  <FormControl>
                    <Input placeholder="Masukkan nama pelanggan" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="machineUsed"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mesin yang Digunakan</FormLabel>
                  <FormControl>
                    <Input placeholder="cth: EDC BRI" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="serviceFee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Biaya Jasa</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="Rp 0"
                      {...field}
                      value={formatToRupiah(field.value)}
                      onChange={(e) => field.onChange(parseRupiah(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </ScrollArea>
        <div className="flex gap-2 pt-0 pb-4 border-t border-border -mx-6 px-6 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onDone}
            className="w-full"
          >
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
