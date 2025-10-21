
"use client";

import type { CustomerKJPWithdrawalFormValues } from "@/lib/types";
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

interface CustomerKJPWithdrawalReviewProps {
    formData: CustomerKJPWithdrawalFormValues;
    onConfirm: () => void;
    onBack: () => void;
}

const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const num = Number(String(value).replace(/[^0-9]/g, ''));
    if (isNaN(num)) return 'Rp 0';
    return `Rp ${num.toLocaleString('id-ID')}`;
};

export default function CustomerKJPWithdrawalReview({ formData, onConfirm, onBack }: CustomerKJPWithdrawalReviewProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
    const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

    const laciAccount = kasAccounts?.find(acc => acc.label === 'Laci');
    const agenDKIAccount = kasAccounts?.find(acc => acc.label === 'Agen DKI');

    const {
        withdrawalAmount,
        serviceFee,
        feePaymentMethod
    } = formData;

    const totalReceivedByMerchant = withdrawalAmount;
    const cashGivenToCustomer = feePaymentMethod === 'Dipotong' ? withdrawalAmount - serviceFee : withdrawalAmount;

    const handleSaveTransaction = async () => {
        if (!firestore || !kasAccounts) {
            toast({ variant: "destructive", title: "Error", description: "Database tidak tersedia." });
            return;
        }
        
        if (!laciAccount) {
            toast({ variant: "destructive", title: "Akun Laci Tidak Ditemukan", description: "Pastikan akun kas 'Laci' dengan tipe 'Tunai' sudah dibuat." });
            return;
        }

        if (!agenDKIAccount) {
            toast({ variant: "destructive", title: "Akun Agen DKI Tidak Ditemukan", description: "Pastikan akun kas 'Agen DKI' dengan tipe 'Merchant' sudah dibuat." });
            return;
        }

        if (laciAccount.balance < cashGivenToCustomer) {
            toast({ variant: "destructive", title: "Saldo Laci Tidak Cukup", description: `Saldo ${laciAccount.label} tidak mencukupi untuk penarikan ini.` });
            return;
        }

        setIsSaving(true);
        toast({ title: "Memproses...", description: "Menyimpan transaksi tarik tunai KJP." });
        
        const now = new Date();
        const nowISO = now.toISOString();
        const deviceName = localStorage.getItem('brimoDeviceName') || 'Unknown Device';

        try {
            await runTransaction(firestore, async (transaction) => {
                
                const laciAccountRef = doc(firestore, 'kasAccounts', laciAccount.id);
                const agenDKIAccountRef = doc(firestore, 'kasAccounts', agenDKIAccount.id);
                
                const [laciAccountDoc, agenDKIAccountDoc] = await Promise.all([
                    transaction.get(laciAccountRef),
                    transaction.get(agenDKIAccountRef)
                ]);

                if (!laciAccountDoc.exists()) throw new Error("Akun Laci tidak ditemukan.");
                if (!agenDKIAccountDoc.exists()) throw new Error("Akun Agen DKI tidak ditemukan.");

                const currentLaciBalance = laciAccountDoc.data().balance;
                const currentAgenDKIBalance = agenDKIAccountDoc.data().balance;

                if (currentLaciBalance < cashGivenToCustomer) {
                    throw new Error(`Saldo ${laciAccount.label} tidak mencukupi.`);
                }
                
                // 1. Credit Agen DKI (Merchant) Account
                const newAgenDKIBalance = currentAgenDKIBalance + totalReceivedByMerchant;
                transaction.update(agenDKIAccountRef, { balance: newAgenDKIBalance });
                const creditTrxRef = doc(collection(agenDKIAccountRef, 'transactions'));
                transaction.set(creditTrxRef, {
                    kasAccountId: agenDKIAccount.id,
                    type: 'credit',
                    name: `Penerimaan KJP a/n ${formData.customerName}`,
                    account: 'Pelanggan KJP',
                    date: nowISO,
                    amount: totalReceivedByMerchant,
                    balanceBefore: currentAgenDKIBalance,
                    balanceAfter: newAgenDKIBalance,
                    category: 'customer_kjp_withdrawal_credit',
                    deviceName
                });

                // 2. Handle Laci (Cash) Account
                if (feePaymentMethod === 'Tunai') {
                    // Two separate transactions for clarity
                    const balanceAfterDebit = currentLaciBalance - withdrawalAmount;
                    const finalLaciBalance = balanceAfterDebit + serviceFee;

                    transaction.update(laciAccountRef, { balance: finalLaciBalance });
                    
                    const debitTrxRef = doc(collection(laciAccountRef, 'transactions'));
                    transaction.set(debitTrxRef, {
                        kasAccountId: laciAccount.id, type: 'debit', name: `Tarik Tunai KJP a/n ${formData.customerName}`, account: 'Pelanggan KJP', date: nowISO, amount: withdrawalAmount, balanceBefore: currentLaciBalance, balanceAfter: balanceAfterDebit, category: 'customer_kjp_withdrawal_debit', deviceName
                    });

                    const feeTrxRef = doc(collection(laciAccountRef, 'transactions'));
                    transaction.set(feeTrxRef, {
                        kasAccountId: laciAccount.id, type: 'credit', name: `Biaya Jasa KJP a/n ${formData.customerName}`, account: 'Pendapatan Jasa', date: nowISO, amount: serviceFee, balanceBefore: balanceAfterDebit, balanceAfter: finalLaciBalance, category: 'service_fee_income', deviceName
                    });

                } else { // 'Dipotong'
                    const newLaciBalance = currentLaciBalance - cashGivenToCustomer;
                    transaction.update(laciAccountRef, { balance: newLaciBalance });

                    const debitTrxRef = doc(collection(laciAccountRef, 'transactions'));
                    transaction.set(debitTrxRef, {
                        kasAccountId: laciAccount.id, type: 'debit', name: `Tarik Tunai KJP a/n ${formData.customerName} (Fee Dipotong)`, account: 'Pelanggan KJP', date: nowISO, amount: cashGivenToCustomer, balanceBefore: currentLaciBalance, balanceAfter: newLaciBalance, category: 'customer_kjp_withdrawal_debit', deviceName
                    });
                }
            });

            // --- AUDIT LOG ---
            await addDoc(collection(firestore, 'customerKJPWithdrawals'), {
                date: now,
                customerName: formData.customerName,
                withdrawalAmount: formData.withdrawalAmount,
                serviceFee: formData.serviceFee,
                feePaymentMethod: formData.feePaymentMethod,
                destinationMerchantAccountId: agenDKIAccount.id,
                sourceKasTunaiAccountId: laciAccount.id,
                deviceName: deviceName
            });

            toast({ title: "Sukses", description: "Transaksi tarik tunai KJP berhasil disimpan." });
            onConfirm();

        } catch (error: any) {
            console.error("Error saving KJP withdrawal transaction: ", error);
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
                    <div className="space-y-2">
                        <h4 className="font-semibold text-lg">Review Tarik Tunai KJP</h4>
                        <div className="text-sm space-y-1 text-muted-foreground">
                            <p>Pelanggan: <strong>{formData.customerName}</strong></p>
                            <p>Uang Tunai Diberikan: <strong className="text-lg">{formatToRupiah(cashGivenToCustomer)}</strong></p>
                        </div>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                         <h4 className="font-semibold text-lg">Rincian Finansial</h4>
                        <div className="flex justify-between items-center"><p>Nominal Penarikan</p><p>{formatToRupiah(withdrawalAmount)}</p></div>
                        <div className="flex justify-between items-center"><p>Biaya Jasa (Laba)</p><p>{formatToRupiah(serviceFee)}</p></div>
                        <Separator />
                        <div className="flex justify-between items-center font-bold text-base"><p>Total Dana Diterima Merchant</p><p>{formatToRupiah(totalReceivedByMerchant)}</p></div>
                    </div>
                     <Separator />
                     <div className="space-y-2">
                        <h4 className="font-semibold text-lg">Siklus Akun Kas</h4>
                        <div className="text-sm text-muted-foreground">
                            <p>Dana dari KJP akan masuk ke akun <strong>{agenDKIAccount?.label || 'Agen DKI'}</strong>.</p>
                            <p>Uang tunai diambil dari akun <strong>{laciAccount?.label || 'Laci'}</strong>.</p>
                            <p>{renderFeePaymentDetails()}</p>
                        </div>
                    </div>

                    <Alert>
                        <Terminal className="h-4 w-4" />
                        <AlertTitle>Perubahan Saldo</AlertTitle>
                        <AlertDescription>
                            <ul className="list-disc pl-5 space-y-1 mt-2">
                               <li>Saldo <strong>{agenDKIAccount?.label || 'Agen DKI'}</strong> akan bertambah <span className="font-semibold text-green-500">{formatToRupiah(totalReceivedByMerchant)}</span>.</li>
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
