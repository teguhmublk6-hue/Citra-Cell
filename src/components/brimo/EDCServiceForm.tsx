
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
import type { EDCServiceFormValues, EDCService } from "@/lib/types";
import { EDCServiceFormSchema } from "@/lib/types";
import Image from "next/image";
import { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { startOfDay } from "date-fns";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";

interface EDCServiceFormProps {
  onTransactionComplete: (promise: Promise<any>) => void;
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

const normalizeString = (str: string) => {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export default function EDCServiceForm({ onTransactionComplete, onDone }: EDCServiceFormProps) {
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

  const onSubmit = (values: EDCServiceFormValues) => {
    const transactionPromise = proceedWithTransaction(values);
    onTransactionComplete(transactionPromise);
  };

  const proceedWithTransaction = useCallback(async (values: EDCServiceFormValues, force = false): Promise<any> => {
    if (!firestore || !kasAccounts) {
      toast({ variant: "destructive", title: "Error", description: "Database tidak tersedia." });
      throw new Error("Database tidak tersedia.");
    }
    
    if (!force) {
        const transactionsRef = collection(firestore, 'edcServices');
        const todayStart = startOfDay(new Date());
        const q = query(transactionsRef, where('date', '>=', todayStart));

        try {
            const querySnapshot = await getDocs(q);
            const todaysTransactions = querySnapshot.docs.map(doc => doc.data() as EDCService);
            const normalizedNewName = normalizeString(values.customerName);

            const isDuplicate = todaysTransactions.some(trx => 
                normalizeString(trx.customerName) === normalizedNewName &&
                trx.machineUsed === values.machineUsed &&
                trx.serviceFee === values.serviceFee
            );

            if (isDuplicate) {
              return Promise.reject({ duplicate: true, onConfirm: () => proceedWithTransaction(values, true) });
            }
        } catch (error) {
            console.error("Error checking for duplicates:", error);
        }
    }
    
    const laciAccount = kasAccounts.find(acc => acc.label === "Laci");
    if (!laciAccount) {
      toast({ variant: "destructive", title: "Akun Laci Tidak Ditemukan", description: "Pastikan akun kas 'Laci' dengan tipe 'Tunai' sudah dibuat." });
      throw new Error("Akun Laci tidak ditemukan.");
    }

    const now = new Date();
    const deviceName = localStorage.getItem("brimoDeviceName") || "Unknown Device";

    try {
      const auditDocRef = await addDocumentNonBlocking(collection(firestore, "edcServices"), {
        date: now,
        customerName: values.customerName,
        machineUsed: values.machineUsed,
        serviceFee: values.serviceFee,
        paymentToKasTunaiAccountId: laciAccount.id,
        deviceName,
      });
      
      if (!auditDocRef) throw new Error("Gagal membuat catatan audit.");
      const auditId = auditDocRef.id;
      const nowISO = now.toISOString();

      await runTransaction(firestore, async (transaction) => {
        const laciAccountRef = doc(firestore, 'kasAccounts', laciAccount.id);
        const laciAccountDoc = await transaction.get(laciAccountRef);

        if (!laciAccountDoc.exists()) {
          throw new Error("Akun Laci tidak ditemukan di database.");
        }

        const currentLaciBalance = laciAccountDoc.data().balance;
        const newLaciBalance = currentLaciBalance + values.serviceFee;

        transaction.update(laciAccountRef, { balance: newLaciBalance });

        const creditTrxRef = doc(collection(laciAccountRef, 'transactions'));
        transaction.set(creditTrxRef, {
          kasAccountId: laciAccount.id, type: 'credit', name: `Jasa EDC a/n ${values.customerName}`, account: 'Pelanggan', date: nowISO, amount: values.serviceFee, balanceBefore: currentLaciBalance, balanceAfter: newLaciBalance, category: 'edc_service', deviceName, auditId
        });
      });

    } catch (error: any) {
      console.error("Error saving EDC service transaction: ", error);
      throw error;
    }
  }, [firestore, kasAccounts]);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 flex flex-col h-full"
      >
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="relative w-full h-32 rounded-lg overflow-hidden mb-4">
              <Image 
                src="https://img.idxchannel.com/media/700/images/idx/2025/01/03/ambil_Uang_di_Mesin_EDC_Ada_Biaya_Admin.jpg"
                alt="EDC Service Banner"
                fill
                className="object-cover"
                data-ai-hint="EDC machine"
              />
          </div>
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
                      type="tel"
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
