
"use client";

import type { CustomerWithdrawalFormValues } from "@/lib/types";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, doc, runTransaction, addDoc, query, where, getDocs, type DocumentReference } from "firebase/firestore";
import type { KasAccount } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Terminal } from "lucide-react";
import { Separator } from "../ui/separator";

interface CustomerWithdrawalReviewProps {
    formData: CustomerWithdrawalFormValues;
    onConfirm: () => void;
    onBack: () => void;
}

const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const num = Number(String(value).replace(/[^0-9]/g, ''));
    if (isNaN(num)) return 'Rp 0';
    return `Rp ${num.toLocaleString('id-ID')}`;
};

export default function CustomerWithdrawalReview({ formData, onConfirm, onBack }: CustomerWithdrawalReviewProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
    const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

    const destinationAccount = kasAccounts?.find(acc => acc.id === formData.destinationAccountId);
    const tunaiAccount = kasAccounts?.find(acc => acc.label === 'Laci');

    const {
        withdrawalAmount,
        serviceFee,
    } = formData;

    const totalTransferFromCustomer = withdrawalAmount + serviceFee;

    const handleSaveTransaction = async () => {
        if (!firestore || !destinationAccount || !kasAccounts) {
            toast({ variant: "destructive", title: "Error", description: "Database atau akun tidak ditemukan." });
            return;
        }

        const laciAccountName = 'Laci';
        const laciAccount = kasAccounts.find(acc => acc.label === laciAccountName);

        if (!laciAccount) {
            toast({ variant: "destructive", title: "Akun Laci Tidak Ditemukan", description: `Silakan buat akun kas dengan nama "${laciAccountName}" dan jenis "Tunai".` });
            return;
        }

        if (laciAccount.balance < withdrawalAmount) {
            toast({ variant: "destructive", title: "Saldo Laci Tidak Cukup", description: `Saldo ${laciAccount.label} tidak mencukupi untuk penarikan ini.` });
            return;
        }

        setIsSaving(true);
        toast({ title: "Memproses...", description: "Menyimpan transaksi tarik tunai." });
        
        const now = new Date();
        const nowISO = now.toISOString();
        const deviceName = localStorage.getItem('brimoDeviceName') || 'Unknown Device';

        try {
            await runTransaction(firestore, async (transaction) => {
                
                // --- PHASE 1: READS ---
                const destAccountRef = doc(firestore, 'kasAccounts', destinationAccount.id);
                const laciAccountRef = doc(firestore, 'kasAccounts', laciAccount.id);
                
                const [destAccountDoc, laciAccountDoc] = await Promise.all([
                    transaction.get(destAccountRef),
                    transaction.get(laciAccountRef)
                ]);

                if (!destAccountDoc.exists()) throw new Error("Akun tujuan tidak ditemukan.");
                if (!laciAccountDoc.exists()) throw new Error("Akun Laci tidak ditemukan.");

                const currentDestBalance = destAccountDoc.data().balance;
                const currentLaciBalance = laciAccountDoc.data().balance;

                if (currentLaciBalance < withdrawalAmount) {
                    throw new Error(`Saldo ${laciAccount.label} tidak mencukupi.`);
                }

                // --- PHASE 2: WRITES ---
                // 1. Credit Destination Account
                const newDestBalance = currentDestBalance + totalTransferFromCustomer;
                transaction.update(destAccountRef, { balance: newDestBalance });
                const creditTrxRef = doc(collection(destAccountRef, 'transactions'));
                transaction.set(creditTrxRef, {
                    kasAccountId: destinationAccount.id,
                    type: 'credit',
                    name: `Trf Masuk Tarik Tunai a/n ${formData.customerName}`,
                    account: formData.customerBankSource,
                    date: nowISO,
                    amount: totalTransferFromCustomer,
                    balanceBefore: currentDestBalance,
                    balanceAfter: newDestBalance,
                    category: 'customer_withdrawal_credit',
                    deviceName
                });

                // 2. Debit Laci (Tunai) Account
                const newLaciBalance = currentLaciBalance - withdrawalAmount;
                transaction.update(laciAccountRef, { balance: newLaciBalance });
                const debitTrxRef = doc(collection(laciAccountRef, 'transactions'));
                transaction.set(debitTrxRef, {
                    kasAccountId: laciAccount.id,
                    type: 'debit',
                    name: `Tarik Tunai a/n ${formData.customerName}`,
                    account: 'Pelanggan',
                    date: nowISO,
                    amount: withdrawalAmount,
                    balanceBefore: currentLaciBalance,
                    balanceAfter: newLaciBalance,
                    category: 'customer_withdrawal_debit',
                    deviceName
                });
            });

            // --- PHASE 3: AUDIT LOG (after transaction) ---
            await addDoc(collection(firestore, 'customerWithdrawals'), {
                date: now, // Use Date object here
                customerName: formData.customerName,
                customerBankSource: formData.customerBankSource,
                withdrawalAmount: formData.withdrawalAmount,
                serviceFee: formData.serviceFee,
                totalTransfer: totalTransferFromCustomer,
                destinationKasAccountId: formData.destinationAccountId,
                sourceKasTunaiAccountId: laciAccount!.id,
                deviceName: deviceName
            });

            toast({ title: "Sukses", description: "Transaksi tarik tunai berhasil disimpan." });
            onConfirm();

        } catch (error: any) {
            console.error("Error saving withdrawal transaction: ", error);
            toast({ variant: "destructive", title: "Error", description: error.message || "Gagal menyimpan transaksi." });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-6 pt-4 pb-6">
                    {/* Customer & Amount Details */}
                    <div className="space-y-2">
                        <h4 className="font-semibold text-lg">Detail Penarikan</h4>
                        <div className="text-sm space-y-1 text-muted-foreground">
                            <p>Pelanggan: <strong>{formData.customerName}</strong></p>
                            <p>Sumber Dana: <strong>{formData.customerBankSource}</strong></p>
                            <p>Uang Tunai Diberikan: <strong className="text-lg">{formatToRupiah(withdrawalAmount)}</strong></p>
                        </div>
                    </div>
                    <Separator />
                    {/* Financials */}
                    <div className="space-y-2">
                         <h4 className="font-semibold text-lg">Rincian Finansial</h4>
                        <div className="flex justify-between items-center"><p>Nominal Penarikan</p><p>{formatToRupiah(withdrawalAmount)}</p></div>
                        <div className="flex justify-between items-center"><p>Biaya Jasa (Laba)</p><p>{formatToRupiah(serviceFee)}</p></div>
                        <Separator />
                        <div className="flex justify-between items-center font-bold text-base"><p>Total Transfer dari Pelanggan</p><p>{formatToRupiah(totalTransferFromCustomer)}</p></div>
                    </div>
                     <Separator />
                     {/* Account Cycle Details */}
                    <div className="space-y-2">
                        <h4 className="font-semibold text-lg">Siklus Akun Kas</h4>
                        <div className="text-sm text-muted-foreground">
                            <p>Saldo akan masuk ke akun <strong>{destinationAccount?.label}</strong>.</p>
                            <p>Uang tunai diambil dari akun <strong>{tunaiAccount?.label || 'Laci'}</strong>.</p>
                        </div>
                    </div>

                    <Alert>
                        <Terminal className="h-4 w-4" />
                        <AlertTitle>Perubahan Saldo</AlertTitle>
                        <AlertDescription>
                            <ul className="list-disc pl-5 space-y-1 mt-2">
                               <li>Saldo <strong>{destinationAccount?.label}</strong> akan bertambah <span className="font-semibold text-green-500">{formatToRupiah(totalTransferFromCustomer)}</span>.</li>
                               <li>Saldo <strong>{tunaiAccount?.label || 'Laci'}</strong> akan berkurang <span className="font-semibold text-red-500">{formatToRupiah(withdrawalAmount)}</span>.</li>
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
                    {isSaving ? "Menyimpan..." : "Simpan Transaksi"}
                </Button>
            </div>
        </div>
    );
}
    