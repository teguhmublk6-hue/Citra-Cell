
"use client";

import type { PPOBPaketDataFormValues } from "@/lib/types";
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

interface PPOBPaketDataReviewProps {
    formData: PPOBPaketDataFormValues;
    onConfirm: () => void;
    onBack: () => void;
}

const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const num = Number(String(value).replace(/[^0-9]/g, ''));
    if (isNaN(num)) return 'Rp 0';
    return `Rp ${num.toLocaleString('id-ID')}`;
};

export default function PPOBPaketDataReview({ formData, onConfirm, onBack }: PPOBPaketDataReviewProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
    const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

    const sourcePPOBAccount = kasAccounts?.find(acc => acc.id === formData.sourcePPOBAccountId);
    const paymentTransferAccount = kasAccounts?.find(acc => acc.id === formData.paymentToKasTransferAccountId);
    const laciAccount = kasAccounts?.find(acc => acc.label === "Laci");

    const {
        costPrice,
        sellingPrice,
        paymentMethod,
        splitTunaiAmount
    } = formData;

    const profit = sellingPrice - costPrice;
    const splitTransferAmount = sellingPrice - (splitTunaiAmount || 0);

    const handleSaveTransaction = async () => {
        if (!firestore || !sourcePPOBAccount || !kasAccounts) {
            toast({ variant: "destructive", title: "Error", description: "Database atau akun tidak ditemukan." });
            return;
        }

        if (!laciAccount && (paymentMethod === 'Tunai' || paymentMethod === 'Split')) {
            toast({ variant: "destructive", title: "Akun Laci Tidak Ditemukan", description: "Pastikan akun kas 'Laci' dengan tipe 'Tunai' sudah dibuat." });
            return;
        }
        
        if (sourcePPOBAccount.balance < costPrice) {
            toast({ variant: "destructive", title: "Deposit Tidak Cukup", description: `Deposit ${sourcePPOBAccount.label} tidak mencukupi.` });
            return;
        }

        setIsSaving(true);
        toast({ title: "Memproses...", description: "Menyimpan transaksi paket data." });

        const now = new Date();
        const nowISO = now.toISOString();
        const deviceName = localStorage.getItem('brimoDeviceName') || 'Unknown Device';
        
        try {
            const auditDocRef = await addDoc(collection(firestore, 'ppobTransactions'), {
                date: now,
                serviceName: 'Paket Data',
                destination: formData.phoneNumber,
                description: formData.packageName,
                costPrice: formData.costPrice,
                sellingPrice: formData.sellingPrice,
                profit,
                sourcePPOBAccountId: formData.sourcePPOBAccountId,
                paymentMethod: formData.paymentMethod,
                paymentToKasTunaiAmount: paymentMethod === 'Tunai' ? sellingPrice : (paymentMethod === 'Split' ? splitTunaiAmount : 0),
                paymentToKasTransferAccountId: paymentMethod === 'Transfer' || paymentMethod === 'Split' ? formData.paymentToKasTransferAccountId : null,
                paymentToKasTransferAmount: paymentMethod === 'Transfer' ? sellingPrice : (paymentMethod === 'Split' ? splitTransferAmount : 0),
                deviceName
            });
            const auditId = auditDocRef.id;

            await runTransaction(firestore, async (transaction) => {
                const sourcePPOBAccountRef = doc(firestore, 'kasAccounts', sourcePPOBAccount.id);
                const laciAccountRef = laciAccount ? doc(firestore, 'kasAccounts', laciAccount.id) : null;
                const paymentAccRef = paymentTransferAccount ? doc(firestore, 'kasAccounts', paymentTransferAccount.id) : null;

                const [sourceDoc, laciDoc, paymentDoc] = await Promise.all([
                    transaction.get(sourcePPOBAccountRef),
                    laciAccountRef ? transaction.get(laciAccountRef) : Promise.resolve(null),
                    paymentAccRef ? transaction.get(paymentAccRef) : Promise.resolve(null),
                ]);

                if (!sourceDoc.exists()) throw new Error("Akun sumber PPOB tidak ditemukan.");
                
                const currentSourcePPOBBalance = sourceDoc.data().balance;
                if (currentSourcePPOBBalance < costPrice) throw new Error(`Saldo ${sourcePPOBAccount.label} tidak mencukupi.`);
                
                transaction.update(sourcePPOBAccountRef, { balance: currentSourcePPOBBalance - costPrice });
                const debitTxRef = doc(collection(sourcePPOBAccountRef, 'transactions'));
                transaction.set(debitTxRef, {
                    kasAccountId: sourcePPOBAccount.id, type: 'debit', name: `Beli Paket Data`, account: formData.phoneNumber, date: nowISO, amount: costPrice, balanceBefore: currentSourcePPOBBalance, balanceAfter: currentSourcePPOBBalance - costPrice, category: 'ppob_purchase', deviceName, auditId
                });
                
                switch (paymentMethod) {
                    case 'Tunai':
                        if (!laciAccountRef || !laciDoc || !laciDoc.exists()) throw new Error("Akun Laci tidak ditemukan.");
                        const currentLaciBalance = laciDoc.data().balance;
                        transaction.update(laciAccountRef, { balance: currentLaciBalance + sellingPrice });
                        const creditTunaiRef = doc(collection(laciAccountRef, 'transactions'));
                        transaction.set(creditTunaiRef, {
                             kasAccountId: laciAccount.id, type: 'credit', name: `Bayar Paket Data`, account: formData.phoneNumber, date: nowISO, amount: sellingPrice, balanceBefore: currentLaciBalance, balanceAfter: currentLaciBalance + sellingPrice, category: 'customer_payment_ppob', deviceName, auditId
                        });
                        break;
                    case 'Transfer':
                        if (!paymentAccRef || !paymentDoc || !paymentDoc.exists()) throw new Error("Akun penerima pembayaran tidak valid.");
                        const currentPaymentBalance = paymentDoc.data().balance;
                        transaction.update(paymentAccRef, { balance: currentPaymentBalance + sellingPrice });
                        const creditTransferRef = doc(collection(paymentAccRef, 'transactions'));
                        transaction.set(creditTransferRef, {
                            kasAccountId: paymentTransferAccount!.id, type: 'credit', name: `Bayar Paket Data`, account: formData.phoneNumber, date: nowISO, amount: sellingPrice, balanceBefore: currentPaymentBalance, balanceAfter: currentPaymentBalance + sellingPrice, category: 'customer_payment_ppob', deviceName, auditId
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
                             kasAccountId: laciAccount.id, type: 'credit', name: `Bayar Tunai Paket Data`, account: formData.phoneNumber, date: nowISO, amount: splitTunaiAmount, balanceBefore: currentLaciSplitBalance, balanceAfter: currentLaciSplitBalance + splitTunaiAmount, category: 'customer_payment_ppob', deviceName, auditId
                        });

                        const currentPaymentSplitBalance = paymentDoc.data().balance;
                        transaction.update(paymentAccRef, { balance: currentPaymentSplitBalance + splitTransferAmount });
                        const creditSplitTransferRef = doc(collection(paymentAccRef, 'transactions'));
                        transaction.set(creditSplitTransferRef, {
                            kasAccountId: paymentTransferAccount!.id, type: 'credit', name: `Bayar Transfer Paket Data`, account: formData.phoneNumber, date: nowISO, amount: splitTransferAmount, balanceBefore: currentPaymentSplitBalance, balanceAfter: currentPaymentSplitBalance + splitTransferAmount, category: 'customer_payment_ppob', deviceName, auditId
                        });
                        break;
                }
            });

            toast({ title: "Sukses", description: "Transaksi Paket Data berhasil disimpan." });
            onConfirm();

        } catch (error: any) {
            console.error("Error saving PPOB Paket Data transaction: ", error);
            toast({ variant: "destructive", title: "Error", description: error.message || "Gagal menyimpan transaksi." });
        } finally {
            setIsSaving(false);
        }
    };

    const renderPaymentDetails = () => {
        switch (paymentMethod) {
            case 'Tunai':
                return <p>Dibayar penuh <strong>{formatToRupiah(sellingPrice)}</strong> ke akun <strong>Laci</strong> (Tunai).</p>;
            case 'Transfer':
                return <p>Dibayar penuh <strong>{formatToRupiah(sellingPrice)}</strong> ke akun <strong>{paymentTransferAccount?.label}</strong>.</p>;
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
                    <div className="space-y-2">
                        <h4 className="font-semibold text-lg">Detail Transaksi Paket Data</h4>
                        <div className="text-sm space-y-1 text-muted-foreground">
                            <p>Nomor Tujuan: <strong>{formData.phoneNumber}</strong></p>
                            <p>Paket: <strong>{formData.packageName}</strong></p>
                            <p>Sumber Deposit: <strong>{sourcePPOBAccount?.label}</strong></p>
                        </div>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                         <h4 className="font-semibold text-lg">Rincian Finansial</h4>
                        <div className="flex justify-between items-center"><p>Harga Jual</p><p>{formatToRupiah(sellingPrice)}</p></div>
                        <div className="flex justify-between items-center"><p>Harga Modal</p><p className="text-red-500">- {formatToRupiah(costPrice)}</p></div>
                        <Separator />
                        <div className="flex justify-between items-center font-bold text-green-500 text-base"><p>Laba</p><p>{formatToRupiah(profit)}</p></div>
                    </div>
                     <Separator />
                    <div className="space-y-2">
                        <h4 className="font-semibold text-lg">Detail Pembayaran Pelanggan</h4>
                        <div className="text-sm text-muted-foreground">{renderPaymentDetails()}</div>
                    </div>

                    <Alert>
                        <Terminal className="h-4 w-4" />
                        <AlertTitle>Siklus Akun Kas</AlertTitle>
                        <AlertDescription>
                            <ul className="list-disc pl-5 space-y-1 mt-2">
                               <li>Saldo <strong>{sourcePPOBAccount?.label}</strong> akan berkurang <span className="font-semibold text-red-500">{formatToRupiah(costPrice)}</span>.</li>
                                {paymentMethod === 'Tunai' && <li>Saldo <strong>Laci (Tunai)</strong> akan bertambah <span className="font-semibold text-green-500">{formatToRupiah(sellingPrice)}</span>.</li>}
                                {paymentMethod === 'Transfer' && <li>Saldo <strong>{paymentTransferAccount?.label}</strong> akan bertambah <span className="font-semibold text-green-500">{formatToRupiah(sellingPrice)}</span>.</li>}
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

    

    