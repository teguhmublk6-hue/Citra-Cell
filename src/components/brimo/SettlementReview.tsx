
"use client";

import type { SettlementFormValues } from "@/lib/types";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, doc, runTransaction, addDoc } from "firebase/firestore";
import type { KasAccount } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Terminal } from "lucide-react";
import { Separator } from "../ui/separator";

interface SettlementReviewProps {
    formData: SettlementFormValues;
    onConfirm: () => void;
    onBack: () => void;
}

const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const num = Number(String(value).replace(/[^0-9]/g, ''));
    if (isNaN(num)) return 'Rp 0';
    return `Rp ${num.toLocaleString('id-ID')}`;
};

const MDR_RATE = 0.0015; // 0.15%

export default function SettlementReview({ formData, onConfirm, onBack }: SettlementReviewProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
    const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

    const sourceAccount = kasAccounts?.find(acc => acc.id === formData.sourceMerchantAccountId);
    const destinationAccount = kasAccounts?.find(acc => acc.id === sourceAccount?.settlementDestinationAccountId);

    const grossAmount = sourceAccount?.balance || 0;
    const mdrFee = Math.round(grossAmount * MDR_RATE);
    const netAmount = grossAmount - mdrFee;

    const handleSaveTransaction = async () => {
        if (!firestore || !sourceAccount || !destinationAccount) {
            toast({ variant: "destructive", title: "Error", description: "Database atau akun sumber/tujuan tidak ditemukan." });
            return;
        }

        if (sourceAccount.balance <= 0) {
            toast({ variant: "destructive", title: "Saldo Kosong", description: "Tidak ada saldo untuk di-settle." });
            return;
        }

        setIsSaving(true);
        toast({ title: "Memproses...", description: "Menyimpan transaksi settlement." });

        const now = new Date();
        const nowISO = now.toISOString();
        const deviceName = localStorage.getItem('brimoDeviceName') || 'Unknown Device';
        
        try {
            await runTransaction(firestore, async (transaction) => {
                const sourceAccountRef = doc(firestore, 'kasAccounts', sourceAccount.id);
                const destAccountRef = doc(firestore, 'kasAccounts', destinationAccount.id);
                
                const [sourceDoc, destDoc] = await Promise.all([
                    transaction.get(sourceAccountRef),
                    transaction.get(destAccountRef),
                ]);

                if (!sourceDoc.exists() || !destDoc.exists()) {
                    throw new Error("Akun sumber atau tujuan tidak ditemukan.");
                }

                const currentSourceBalance = sourceDoc.data().balance;
                const currentDestBalance = destDoc.data().balance;

                // --- WRITES ---
                // 1. Reset source merchant account balance
                transaction.update(sourceAccountRef, { balance: 0 });

                // 2. Add net amount to destination account
                transaction.update(destAccountRef, { balance: currentDestBalance + netAmount });

                // 3. Create debit transaction for gross amount from merchant
                const debitTrxRef = doc(collection(sourceAccountRef, 'transactions'));
                transaction.set(debitTrxRef, {
                    kasAccountId: sourceAccount.id, type: 'debit', name: `Settlement ke ${destinationAccount.label}`, account: 'Internal', date: nowISO, amount: grossAmount, balanceBefore: currentSourceBalance, balanceAfter: 0, category: 'settlement_debit', deviceName
                });
                
                // 4. Create credit transaction for net amount to destination
                const creditTrxRef = doc(collection(destAccountRef, 'transactions'));
                transaction.set(creditTrxRef, {
                    kasAccountId: destinationAccount.id, type: 'credit', name: `Settlement dari ${sourceAccount.label}`, account: 'Internal', date: nowISO, amount: netAmount, balanceBefore: currentDestBalance, balanceAfter: currentDestBalance + netAmount, category: 'settlement_credit', deviceName
                });
            });

            await addDoc(collection(firestore, 'settlements'), {
                date: now,
                sourceMerchantAccountId: sourceAccount.id,
                destinationAccountId: destinationAccount.id,
                grossAmount,
                mdrFee,
                netAmount,
                deviceName
            });

            toast({ title: "Sukses", description: "Settlement berhasil diproses." });
            onConfirm();

        } catch (error: any) {
            console.error("Error processing settlement: ", error);
            toast({ variant: "destructive", title: "Error", description: error.message || "Gagal memproses settlement." });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-6 pt-4 pb-6">
                    <div className="space-y-2">
                        <h4 className="font-semibold text-lg">Detail Settlement</h4>
                        <div className="text-sm space-y-1 text-muted-foreground">
                            <p>Dari Akun Merchant: <strong>{sourceAccount?.label}</strong></p>
                            <p>Ke Akun Tujuan: <strong>{destinationAccount?.label}</strong></p>
                        </div>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                         <h4 className="font-semibold text-lg">Rincian Finansial</h4>
                        <div className="flex justify-between items-center"><p>Total Saldo (Gross)</p><p>{formatToRupiah(grossAmount)}</p></div>
                        <div className="flex justify-between items-center"><p>Biaya MDR (0.15%)</p><p className="text-red-500">- {formatToRupiah(mdrFee)}</p></div>
                        <Separator />
                        <div className="flex justify-between items-center font-bold text-base"><p>Dana Bersih Diterima</p><p>{formatToRupiah(netAmount)}</p></div>
                    </div>

                    <Alert>
                        <Terminal className="h-4 w-4" />
                        <AlertTitle>Siklus Akun Kas</AlertTitle>
                        <AlertDescription>
                            <ul className="list-disc pl-5 space-y-1 mt-2">
                               <li>Saldo <strong>{sourceAccount?.label}</strong> akan menjadi <span className="font-semibold">{formatToRupiah(0)}</span>.</li>
                               <li>Saldo <strong>{destinationAccount?.label}</strong> akan bertambah bersih sebesar <span className="font-semibold text-green-500">{formatToRupiah(netAmount)}</span>.</li>
                               <li>Biaya MDR dicatat sebagai biaya operasional dan tidak memotong saldo akun kas.</li>
                            </ul>
                        </AlertDescription>
                    </Alert>

                </div>
            </ScrollArea>
             <div className="flex gap-2 pt-0 pb-4 border-t border-border -mx-6 px-6 pt-4">
                <Button type="button" variant="outline" onClick={onBack} className="w-full" disabled={isSaving}>
                    Kembali
                </Button>
                <Button type="button" onClick={handleSaveTransaction} className="w-full" disabled={isSaving}>
                    {isSaving ? "Menyimpan..." : "Konfirmasi Settlement"}
                </Button>
            </div>
        </div>
    );
}
