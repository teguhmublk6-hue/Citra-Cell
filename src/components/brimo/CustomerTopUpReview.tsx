
"use client";

import type { CustomerTopUpFormValues } from "@/lib/types";
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

interface CustomerTopUpReviewProps {
    formData: CustomerTopUpFormValues;
    onConfirm: () => void;
    onBack: () => void;
}

const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const num = Number(String(value).replace(/[^0-9]/g, ''));
    if (isNaN(num)) return 'Rp 0';
    return `Rp ${num.toLocaleString('id-ID')}`;
};

export default function CustomerTopUpReview({ formData, onConfirm, onBack }: CustomerTopUpReviewProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
    const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

    const sourceAccount = kasAccounts?.find(acc => acc.id === formData.sourceAccountId);
    const paymentTransferAccount = kasAccounts?.find(acc => acc.id === formData.paymentToKasTransferAccountId);
    const laciAccount = kasAccounts?.find(acc => acc.label === "Laci");

    const {
        topUpAmount,
        serviceFee,
        paymentMethod,
        splitTunaiAmount
    } = formData;

    const totalPaymentByCustomer = topUpAmount + serviceFee;
    const splitTransferAmount = totalPaymentByCustomer - (splitTunaiAmount || 0);

    const handleSaveTransaction = async () => {
        if (!firestore || !sourceAccount || !kasAccounts) {
            toast({ variant: "destructive", title: "Error", description: "Database atau akun tidak ditemukan." });
            return;
        }

        if (!laciAccount && (paymentMethod === 'Tunai' || paymentMethod === 'Split')) {
            toast({ variant: "destructive", title: "Akun Laci Tidak Ditemukan", description: "Pastikan akun kas 'Laci' dengan tipe 'Tunai' sudah dibuat." });
            return;
        }
        
        if (sourceAccount.balance < topUpAmount) {
            toast({ variant: "destructive", title: "Saldo Tidak Cukup", description: `Saldo ${sourceAccount.label} tidak mencukupi untuk melakukan top up.` });
            return;
        }

        setIsSaving(true);
        toast({ title: "Memproses...", description: "Menyimpan transaksi top up." });

        const now = new Date();
        const nowISO = now.toISOString();
        const deviceName = localStorage.getItem('brimoDeviceName') || 'Unknown Device';
        
        try {
            const auditDocRef = await addDoc(collection(firestore, 'customerTopUps'), {
                date: now,
                sourceKasAccountId: formData.sourceAccountId,
                destinationEwallet: formData.destinationEwallet,
                customerName: formData.customerName,
                topUpAmount: formData.topUpAmount,
                serviceFee: formData.serviceFee,
                paymentMethod: formData.paymentMethod,
                paymentToKasTunaiAmount: paymentMethod === 'Tunai' ? totalPaymentByCustomer : (paymentMethod === 'Split' ? splitTunaiAmount : 0),
                paymentToKasTransferAccountId: paymentMethod === 'Transfer' || paymentMethod === 'Split' ? formData.paymentToKasTransferAccountId : null,
                paymentToKasTransferAmount: paymentMethod === 'Transfer' ? totalPaymentByCustomer : (paymentMethod === 'Split' ? splitTransferAmount : 0),
                deviceName
            });
            const auditId = auditDocRef.id;

            await runTransaction(firestore, async (transaction) => {
                const sourceAccountRef = doc(firestore, 'kasAccounts', sourceAccount.id);
                const laciAccountRef = laciAccount ? doc(firestore, 'kasAccounts', laciAccount.id) : null;
                const paymentAccRef = paymentTransferAccount ? doc(firestore, 'kasAccounts', paymentTransferAccount.id) : null;

                const [sourceDoc, laciDoc, paymentDoc] = await Promise.all([
                    transaction.get(sourceAccountRef),
                    laciAccountRef ? transaction.get(laciAccountRef) : Promise.resolve(null),
                    paymentAccRef ? transaction.get(paymentAccRef) : Promise.resolve(null),
                ]);

                if (!sourceDoc.exists()) throw new Error("Akun sumber tidak ditemukan.");
                
                const currentSourceBalance = sourceDoc.data().balance;
                if (currentSourceBalance < topUpAmount) {
                    throw new Error(`Saldo ${sourceAccount.label} tidak mencukupi.`);
                }

                transaction.update(sourceAccountRef, { balance: currentSourceBalance - topUpAmount });
                const debitTxRef = doc(collection(sourceAccountRef, 'transactions'));
                transaction.set(debitTxRef, {
                    kasAccountId: sourceAccount.id, type: 'debit', name: `Top Up ${formData.destinationEwallet} an. ${formData.customerName}`, account: formData.destinationEwallet, date: nowISO, amount: topUpAmount, balanceBefore: currentSourceBalance, balanceAfter: currentSourceBalance - topUpAmount, category: 'customer_topup_debit', deviceName, auditId
                });
                
                switch (paymentMethod) {
                    case 'Tunai':
                        if (!laciAccountRef || !laciDoc || !laciDoc.exists()) throw new Error("Akun Laci tidak ditemukan.");
                        const currentLaciBalance = laciDoc.data().balance;
                        transaction.update(laciAccountRef, { balance: currentLaciBalance + totalPaymentByCustomer });
                        const creditTunaiRef = doc(collection(laciAccountRef, 'transactions'));
                        transaction.set(creditTunaiRef, {
                             kasAccountId: laciAccount.id, type: 'credit', name: `Bayar Top Up an. ${formData.customerName}`, account: 'Pelanggan', date: nowISO, amount: totalPaymentByCustomer, balanceBefore: currentLaciBalance, balanceAfter: currentLaciBalance + totalPaymentByCustomer, category: 'customer_payment_topup', deviceName, auditId
                        });
                        break;
                    case 'Transfer':
                        if (!paymentAccRef || !paymentDoc || !paymentDoc.exists()) throw new Error("Akun penerima pembayaran tidak valid.");
                        const currentPaymentBalance = paymentDoc.data().balance;
                        transaction.update(paymentAccRef, { balance: currentPaymentBalance + totalPaymentByCustomer });
                        const creditTransferRef = doc(collection(paymentAccRef, 'transactions'));
                        transaction.set(creditTransferRef, {
                            kasAccountId: paymentTransferAccount!.id, type: 'credit', name: `Bayar Top Up an. ${formData.customerName}`, account: 'Pelanggan', date: nowISO, amount: totalPaymentByCustomer, balanceBefore: currentPaymentBalance, balanceAfter: currentPaymentBalance + totalPaymentByCustomer, category: 'customer_payment_topup', deviceName, auditId
                        });
                        break;
                    case 'Split':
                        if (!laciAccountRef || !laciDoc || !laciDoc.exists()) throw new Error("Akun Laci tidak ditemukan.");
                        if (!paymentAccRef || !paymentDoc || !paymentDoc.exists()) throw new Error("Akun penerima pembayaran split tidak valid.");
                        if (!splitTunaiAmount) throw new Error("Jumlah tunai split tidak valid.");
                        
                        const currentLaciSplitBalance = laciDoc.data().balance;
                        transaction.update(laciAccountRef, { balance: currentLaciSplitBalance + splitTunaiAmount });
                        const creditSplitTunaiRef = doc(collection(laciAccountRef, 'transactions'));
                        transaction.set(creditSplitTunaiRef, {
                             kasAccountId: laciAccount.id, type: 'credit', name: `Bayar Tunai Top Up an. ${formData.customerName}`, account: 'Pelanggan', date: nowISO, amount: splitTunaiAmount, balanceBefore: currentLaciSplitBalance, balanceAfter: currentLaciSplitBalance + splitTunaiAmount, category: 'customer_payment_topup', deviceName, auditId
                        });

                        const currentPaymentSplitBalance = paymentDoc.data().balance;
                        transaction.update(paymentAccRef, { balance: currentPaymentSplitBalance + splitTransferAmount });
                        const creditSplitTransferRef = doc(collection(paymentAccRef, 'transactions'));
                        transaction.set(creditSplitTransferRef, {
                            kasAccountId: paymentTransferAccount!.id, type: 'credit', name: `Bayar Transfer Top Up an. ${formData.customerName}`, account: 'Pelanggan', date: nowISO, amount: splitTransferAmount, balanceBefore: currentPaymentSplitBalance, balanceAfter: currentPaymentSplitBalance + splitTransferAmount, category: 'customer_payment_topup', deviceName, auditId
                        });
                        break;
                }
            });

            toast({ title: "Sukses", description: "Transaksi Top Up berhasil disimpan." });
            onConfirm();

        } catch (error: any) {
            console.error("Error saving top up transaction: ", error);
            toast({ variant: "destructive", title: "Error", description: error.message || "Gagal menyimpan transaksi." });
        } finally {
            setIsSaving(false);
        }
    };

    const renderPaymentDetails = () => {
        switch (paymentMethod) {
            case 'Tunai':
                return <p>Dibayar penuh <strong>{formatToRupiah(totalPaymentByCustomer)}</strong> ke akun <strong>Laci</strong> (Tunai).</p>;
            case 'Transfer':
                return <p>Dibayar penuh <strong>{formatToRupiah(totalPaymentByCustomer)}</strong> ke akun <strong>{paymentTransferAccount?.label}</strong>.</p>;
            case 'Split':
                return <p>Dibayar <strong>{formatToRupiah(splitTunaiAmount)}</strong> ke <strong>Laci</strong> (Tunai) dan <strong>{formatToRupiah(splitTransferAmount)}</strong> ke <strong>{paymentTransferAccount?.label}</strong>.</p>;
            default:
                return null;
        }
    }

    return (
        <div className="flex flex-col h-full">
            <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-6 pt-4 pb-6">
                    {/* TopUp Details */}
                    <div className="space-y-2">
                        <h4 className="font-semibold text-lg">Detail Top Up</h4>
                        <div className="text-sm space-y-1 text-muted-foreground">
                            <p>Tujuan: <strong>{formData.destinationEwallet}</strong></p>
                            <p>Pelanggan: <strong>{formData.customerName}</strong></p>
                            <p>Sumber Dana: <strong>{sourceAccount?.label}</strong></p>
                        </div>
                    </div>
                    <Separator />
                    {/* Financials */}
                    <div className="space-y-2">
                         <h4 className="font-semibold text-lg">Rincian Finansial</h4>
                        <div className="flex justify-between items-center"><p>Nominal Top Up</p><p>{formatToRupiah(topUpAmount)}</p></div>
                        <div className="flex justify-between items-center"><p>Biaya Jasa</p><p>{formatToRupiah(serviceFee)}</p></div>
                        <Separator />
                        <div className="flex justify-between items-center font-bold text-base"><p>Total Bayar Pelanggan</p><p>{formatToRupiah(totalPaymentByCustomer)}</p></div>
                    </div>
                     <Separator />
                     {/* Payment Details */}
                    <div className="space-y-2">
                        <h4 className="font-semibold text-lg">Detail Pembayaran</h4>
                        <div className="text-sm text-muted-foreground">{renderPaymentDetails()}</div>
                    </div>

                    <Alert>
                        <Terminal className="h-4 w-4" />
                        <AlertTitle>Siklus Akun Kas</AlertTitle>
                        <AlertDescription>
                            <ul className="list-disc pl-5 space-y-1 mt-2">
                               <li>Saldo <strong>{sourceAccount?.label}</strong> akan berkurang <span className="font-semibold text-red-500">{formatToRupiah(topUpAmount)}</span>.</li>
                                {paymentMethod === 'Tunai' && <li>Saldo <strong>Laci (Tunai)</strong> akan bertambah <span className="font-semibold text-green-500">{formatToRupiah(totalPaymentByCustomer)}</span>.</li>}
                                {paymentMethod === 'Transfer' && <li>Saldo <strong>{paymentTransferAccount?.label}</strong> akan bertambah <span className="font-semibold text-green-500">{formatToRupiah(totalPaymentByCustomer)}</span>.</li>}
                                {paymentMethod === 'Split' && (
                                    <>
                                        <li>Saldo <strong>Laci (Tunai)</strong> akan bertambah <span className="font-semibold text-green-500">{formatToRupiah(splitTunaiAmount)}</span>.</li>
                                        <li>Saldo <strong>{paymentTransferAccount?.label}</strong> akan bertambah <span className="font-semibold text-green-500">{formatToRupiah(splitTransferAmount)}</span>.</li>
                                    </>
                                )}
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

    
