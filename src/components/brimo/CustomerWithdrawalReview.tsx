
"use client";

import type { CustomerWithdrawalFormValues } from "@/lib/types";
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
    const laciAccount = kasAccounts?.find(acc => acc.label === 'Laci');

    const {
        withdrawalAmount,
        serviceFee,
        feePaymentMethod,
    } = formData;

    const cashGivenToCustomer = feePaymentMethod === 'Dipotong' ? withdrawalAmount - serviceFee : withdrawalAmount;
    const totalTransferFromCustomer = withdrawalAmount;

    const handleSaveTransaction = async () => {
        if (!firestore || !destinationAccount || !kasAccounts) {
            toast({ variant: "destructive", title: "Error", description: "Database atau akun tidak ditemukan." });
            return;
        }

        if (!laciAccount) {
            toast({ variant: "destructive", title: "Akun Laci Tidak Ditemukan", description: `Silakan buat akun kas dengan nama "Laci" dan jenis "Tunai".` });
            return;
        }

        if (laciAccount.balance < cashGivenToCustomer) {
            toast({ variant: "destructive", title: "Saldo Laci Tidak Cukup", description: `Saldo ${laciAccount.label} tidak mencukupi untuk memberikan uang tunai.` });
            return;
        }

        setIsSaving(true);
        toast({ title: "Memproses...", description: "Menyimpan transaksi tarik tunai." });
        
        const now = new Date();
        const nowISO = now.toISOString();
        const deviceName = localStorage.getItem('brimoDeviceName') || 'Unknown Device';

        try {
            const auditDocRef = await addDoc(collection(firestore, 'customerWithdrawals'), {
                date: now,
                customerName: formData.customerName,
                customerBankSource: formData.customerBankSource,
                withdrawalAmount: formData.withdrawalAmount,
                serviceFee: formData.serviceFee,
                feePaymentMethod: formData.feePaymentMethod,
                destinationKasAccountId: formData.destinationAccountId,
                sourceKasTunaiAccountId: laciAccount!.id,
                deviceName: deviceName
            });
            const auditId = auditDocRef.id;
            
            await runTransaction(firestore, async (transaction) => {
                
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

                if (currentLaciBalance < cashGivenToCustomer) {
                    throw new Error(`Saldo ${laciAccount.label} tidak mencukupi.`);
                }
                
                // 1. Credit Destination Account with the customer's transfer
                const newDestBalance = currentDestBalance + totalTransferFromCustomer;
                transaction.update(destAccountRef, { balance: newDestBalance });
                const creditTrxRef = doc(collection(destAccountRef, 'transactions'));
                transaction.set(creditTrxRef, {
                    kasAccountId: destinationAccount.id, type: 'credit', name: `Trf Masuk Tarik Tunai a/n ${formData.customerName}`, account: formData.customerBankSource, date: nowISO, amount: totalTransferFromCustomer, balanceBefore: currentDestBalance, balanceAfter: newDestBalance, category: 'customer_withdrawal_credit', deviceName, auditId
                });

                // 2. Handle Laci (Cash) Account based on fee payment method
                if (feePaymentMethod === 'Tunai') {
                    const balanceAfterDebit = currentLaciBalance - withdrawalAmount;
                    const finalLaciBalance = balanceAfterDebit + serviceFee;

                    transaction.update(laciAccountRef, { balance: finalLaciBalance });
                    
                    const debitTrxRef = doc(collection(laciAccountRef, 'transactions'));
                    transaction.set(debitTrxRef, {
                        kasAccountId: laciAccount.id, type: 'debit', name: `Tarik Tunai a/n ${formData.customerName}`, account: 'Pelanggan', date: nowISO, amount: withdrawalAmount, balanceBefore: currentLaciBalance, balanceAfter: balanceAfterDebit, category: 'customer_withdrawal_debit', deviceName, auditId
                    });

                    const feeTrxRef = doc(collection(laciAccountRef, 'transactions'));
                     transaction.set(feeTrxRef, {
                        kasAccountId: laciAccount.id, type: 'credit', name: `Biaya Jasa Tarik Tunai`, account: 'Pendapatan Jasa', date: nowISO, amount: serviceFee, balanceBefore: balanceAfterDebit, balanceAfter: finalLaciBalance, category: 'service_fee_income', deviceName, auditId
                    });

                } else { // 'Dipotong'
                    const newLaciBalance = currentLaciBalance - cashGivenToCustomer;
                    transaction.update(laciAccountRef, { balance: newLaciBalance });

                    const debitTrxRef = doc(collection(laciAccountRef, 'transactions'));
                    transaction.set(debitTrxRef, {
                        kasAccountId: laciAccount.id, type: 'debit', name: `Tarik Tunai a/n ${formData.customerName} (Fee Dipotong)`, account: 'Pelanggan', date: nowISO, amount: cashGivenToCustomer, balanceBefore: currentLaciBalance, balanceAfter: newLaciBalance, category: 'customer_withdrawal_debit', deviceName, auditId
                    });
                }
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
    
    const renderFeePaymentDetails = () => {
        if (feePaymentMethod === 'Dipotong') {
            return "Biaya jasa dipotong dari uang tunai yang diberikan ke pelanggan.";
        }
        return "Pelanggan membayar biaya jasa secara tunai terpisah.";
    }

    const renderLaciBalanceChange = () => {
        if (feePaymentMethod === 'Tunai') {
            return <>
                <li>Saldo <strong>{laciAccount?.label || 'Laci'}</strong> berkurang <span className="font-semibold text-red-500">{formatToRupiah(withdrawalAmount)}</span> (diberikan ke pelanggan).</li>
                <li>Saldo <strong>{laciAccount?.label || 'Laci'}</strong> bertambah <span className="font-semibold text-green-500">{formatToRupiah(serviceFee)}</span> (dari biaya jasa tunai).</li>
            </>
        }
        return <li>Saldo <strong>{laciAccount?.label || 'Laci'}</strong> akan berkurang <span className="font-semibold text-red-500">{formatToRupiah(cashGivenToCustomer)}</span>.</li>
    }


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
                            <p>Uang Tunai Diberikan: <strong className="text-lg">{formatToRupiah(cashGivenToCustomer)}</strong></p>
                        </div>
                    </div>
                    <Separator />
                    {/* Financials */}
                    <div className="space-y-2">
                         <h4 className="font-semibold text-lg">Rincian Finansial</h4>
                        <div className="flex justify-between items-center"><p>Nominal Penarikan</p><p>{formatToRupiah(withdrawalAmount)}</p></div>
                        <div className="flex justify-between items-center"><p>Biaya Jasa (Laba)</p><p>{formatToRupiah(serviceFee)}</p></div>
                        <Separator />
                        <div className="flex justify-between items-center font-bold text-base"><p>Total Transfer ke Rekening BRILink</p><p>{formatToRupiah(totalTransferFromCustomer)}</p></div>
                    </div>
                     <Separator />
                     {/* Account Cycle Details */}
                    <div className="space-y-2">
                        <h4 className="font-semibold text-lg">Siklus Akun Kas</h4>
                        <div className="text-sm text-muted-foreground">
                            <p>Dana akan masuk ke akun <strong>{destinationAccount?.label}</strong>.</p>
                            <p>Uang tunai diambil dari akun <strong>{laciAccount?.label || 'Laci'}</strong>.</p>
                            <p>{renderFeePaymentDetails()}</p>
                        </div>
                    </div>

                    <Alert>
                        <Terminal className="h-4 w-4" />
                        <AlertTitle>Perubahan Saldo</AlertTitle>
                        <AlertDescription>
                            <ul className="list-disc pl-5 space-y-1 mt-2">
                               <li>Saldo <strong>{destinationAccount?.label}</strong> akan bertambah <span className="font-semibold text-green-500">{formatToRupiah(totalTransferFromCustomer)}</span>.</li>
                               {renderLaciBalanceChange()}
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

    