
"use client";

import type { PPOBBpjsFormValues } from "@/lib/types";
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

interface PPOBBpjsReviewProps {
    formData: PPOBBpjsFormValues;
    onConfirm: () => void;
    onBack: () => void;
}

const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const num = Number(String(value).replace(/[^0-9]/g, ''));
    if (isNaN(num)) return 'Rp 0';
    return `Rp ${num.toLocaleString('id-ID')}`;
};

export default function PPOBBpjsReview({ formData, onConfirm, onBack }: PPOBBpjsReviewProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
    const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

    const sourcePPOBAccount = kasAccounts?.find(acc => acc.id === formData.sourcePPOBAccountId);
    const paymentTransferAccount = kasAccounts?.find(acc => acc.id === formData.paymentToKasTransferAccountId);

    const {
        billAmount,
        totalAmount,
        cashback,
        paymentMethod,
        splitTunaiAmount
    } = formData;

    const netProfit = (totalAmount - billAmount) + (cashback || 0);
    const splitTransferAmount = totalAmount - (splitTunaiAmount || 0);

    const handleSaveTransaction = async () => {
        if (!firestore || !sourcePPOBAccount || !kasAccounts) {
            toast({ variant: "destructive", title: "Error", description: "Database atau akun tidak ditemukan." });
            return;
        }

        if (sourcePPOBAccount.balance < billAmount) {
            toast({ variant: "destructive", title: "Deposit Tidak Cukup", description: `Deposit ${sourcePPOBAccount.label} tidak mencukupi.` });
            return;
        }

        setIsSaving(true);
        toast({ title: "Memproses...", description: "Menyimpan transaksi BPJS." });

        const now = new Date();
        const nowISO = now.toISOString();
        const deviceName = localStorage.getItem('brimoDeviceName') || 'Unknown Device';
        
        try {
            const auditDocRef = await addDoc(collection(firestore, 'ppobBpjs'), {
                date: now,
                customerName: formData.customerName,
                billAmount: formData.billAmount,
                totalAmount: formData.totalAmount,
                cashback: formData.cashback || 0,
                netProfit,
                sourcePPOBAccountId: formData.sourcePPOBAccountId,
                paymentMethod: formData.paymentMethod,
                paymentToKasTunaiAmount: paymentMethod === 'Tunai' ? totalAmount : (paymentMethod === 'Split' ? splitTunaiAmount : 0),
                paymentToKasTransferAccountId: paymentMethod === 'Transfer' || paymentMethod === 'Split' ? formData.paymentToKasTransferAccountId : null,
                paymentToKasTransferAmount: paymentMethod === 'Transfer' ? totalAmount : (paymentMethod === 'Split' ? splitTransferAmount : 0),
                deviceName
            });
            const auditId = auditDocRef.id;

            await runTransaction(firestore, async (transaction) => {
                const laciAccountName = 'Laci';
                
                const sourcePPOBAccountRef = doc(firestore, 'kasAccounts', sourcePPOBAccount.id);
                
                let laciAccountRef: DocumentReference | null = null;
                const laciQuery = query(collection(firestore, 'kasAccounts'), where("label", "==", laciAccountName));
                const laciSnapshot = await getDocs(laciQuery);
                if (!laciSnapshot.empty) {
                    laciAccountRef = laciSnapshot.docs[0].ref;
                }

                let paymentAccRef: DocumentReference | null = null;
                if ((paymentMethod === 'Transfer' || paymentMethod === 'Split') && paymentTransferAccount) {
                    paymentAccRef = doc(firestore, 'kasAccounts', paymentTransferAccount.id);
                }

                const docsToRead = [sourcePPOBAccountRef];
                if (laciAccountRef) docsToRead.push(laciAccountRef);
                if (paymentAccRef) docsToRead.push(paymentAccRef);
                
                const allDocs = await Promise.all(docsToRead.map(ref => transaction.get(ref)));
                
                const sourcePPOBAccountDoc = allDocs.find(d => d.ref.path === sourcePPOBAccountRef.path);
                const laciAccountDoc = laciAccountRef ? allDocs.find(d => d.ref.path === laciAccountRef!.path) : undefined;
                const paymentAccDoc = paymentAccRef ? allDocs.find(d => d.ref.path === paymentAccRef!.path) : undefined;

                if (!sourcePPOBAccountDoc || !sourcePPOBAccountDoc.exists()) throw new Error("Akun sumber PPOB tidak ditemukan.");
                
                const currentSourcePPOBBalance = sourcePPOBAccountDoc.data().balance;
                if (currentSourcePPOBBalance < billAmount) throw new Error(`Saldo ${sourcePPOBAccount.label} tidak mencukupi.`);
                
                let currentLaciBalance = 0;
                let finalLaciAccountRef: DocumentReference;

                if (laciAccountDoc && laciAccountDoc.exists()) {
                    currentLaciBalance = laciAccountDoc.data()?.balance || 0;
                    finalLaciAccountRef = laciAccountDoc.ref;
                } else {
                    finalLaciAccountRef = doc(collection(firestore, 'kasAccounts'));
                }
                const laciAccountId = finalLaciAccountRef.id;

                let currentPaymentAccBalance = 0;
                if ((paymentMethod === 'Transfer' || paymentMethod === 'Split')) {
                    if(!paymentAccDoc || !paymentAccDoc.exists()) throw new Error("Akun penerima pembayaran transfer tidak ditemukan.");
                    currentPaymentAccBalance = paymentAccDoc.data().balance;
                }
                
                if (!laciAccountDoc || !laciAccountDoc.exists()) {
                    transaction.set(finalLaciAccountRef, { label: laciAccountName, type: 'Tunai', balance: 0, minimumBalance: 0, color: 'bg-green-500' });
                }

                const balanceAfterDebit = currentSourcePPOBBalance - billAmount;
                const finalSourceBalance = cashback ? balanceAfterDebit + cashback : balanceAfterDebit;
                transaction.update(sourcePPOBAccountRef, { balance: finalSourceBalance });

                const debitTxRef = doc(collection(sourcePPOBAccountRef, 'transactions'));
                transaction.set(debitTxRef, {
                    kasAccountId: sourcePPOBAccount.id, type: 'debit', name: `Bayar Tagihan BPJS`, account: formData.customerName, date: nowISO, amount: billAmount, balanceBefore: currentSourcePPOBBalance, balanceAfter: balanceAfterDebit, category: 'ppob_bpjs_payment', deviceName, auditId
                });

                if (cashback && cashback > 0) {
                     const cashbackTxRef = doc(collection(sourcePPOBAccountRef, 'transactions'));
                     transaction.set(cashbackTxRef, {
                        kasAccountId: sourcePPOBAccount.id, type: 'credit', name: `Cashback Tagihan BPJS`, account: sourcePPOBAccount.label, date: nowISO, amount: cashback, balanceBefore: balanceAfterDebit, balanceAfter: finalSourceBalance, category: 'ppob_bpjs_cashback', deviceName, auditId
                     });
                }
                
                switch (paymentMethod) {
                    case 'Tunai':
                        transaction.update(finalLaciAccountRef, { balance: currentLaciBalance + totalAmount });
                        const creditTunaiRef = doc(collection(finalLaciAccountRef, 'transactions'));
                        transaction.set(creditTunaiRef, {
                             kasAccountId: laciAccountId, type: 'credit', name: `Bayar Tagihan BPJS`, account: formData.customerName, date: nowISO, amount: totalAmount, balanceBefore: currentLaciBalance, balanceAfter: currentLaciBalance + totalAmount, category: 'ppob_bpjs_payment', deviceName, auditId
                        });
                        break;
                    case 'Transfer':
                        if (!paymentAccRef) throw new Error("Referensi akun pembayaran tidak valid.");
                        transaction.update(paymentAccRef, { balance: currentPaymentAccBalance + totalAmount });
                        const creditTransferRef = doc(collection(paymentAccRef, 'transactions'));
                        transaction.set(creditTransferRef, {
                            kasAccountId: paymentTransferAccount!.id, type: 'credit', name: `Bayar Tagihan BPJS`, account: formData.customerName, date: nowISO, amount: totalAmount, balanceBefore: currentPaymentAccBalance, balanceAfter: currentPaymentAccBalance + totalAmount, category: 'ppob_bpjs_payment', deviceName, auditId
                        });
                        break;
                    case 'Split':
                        if (!splitTunaiAmount || !paymentAccRef) throw new Error("Data pembayaran split tidak lengkap");
                        transaction.update(finalLaciAccountRef, { balance: currentLaciBalance + splitTunaiAmount });
                        const creditSplitTunaiRef = doc(collection(finalLaciAccountRef, 'transactions'));
                        transaction.set(creditSplitTunaiRef, {
                             kasAccountId: laciAccountId, type: 'credit', name: `Bayar Tunai Tagihan BPJS`, account: formData.customerName, date: nowISO, amount: splitTunaiAmount, balanceBefore: currentLaciBalance, balanceAfter: currentLaciBalance + splitTunaiAmount, category: 'ppob_bpjs_payment', deviceName, auditId
                        });

                        transaction.update(paymentAccRef, { balance: currentPaymentAccBalance + splitTransferAmount });
                        const creditSplitTransferRef = doc(collection(paymentAccRef, 'transactions'));
                        transaction.set(creditSplitTransferRef, {
                            kasAccountId: paymentTransferAccount!.id, type: 'credit', name: `Bayar Transfer Tagihan BPJS`, account: formData.customerName, date: nowISO, amount: splitTransferAmount, balanceBefore: currentPaymentAccBalance, balanceAfter: currentPaymentAccBalance + splitTransferAmount, category: 'ppob_bpjs_payment', deviceName, auditId
                        });
                        break;
                }
            });

            toast({ title: "Sukses", description: "Transaksi BPJS berhasil disimpan." });
            onConfirm();

        } catch (error: any) {
            console.error("Error saving PPOB BPJS transaction: ", error);
            toast({ variant: "destructive", title: "Error", description: error.message || "Gagal menyimpan transaksi." });
        } finally {
            setIsSaving(false);
        }
    };

    const renderPaymentDetails = () => {
        switch (paymentMethod) {
            case 'Tunai':
                return <p>Dibayar penuh <strong>{formatToRupiah(totalAmount)}</strong> ke akun <strong>Laci</strong> (Tunai).</p>;
            case 'Transfer':
                return <p>Dibayar penuh <strong>{formatToRupiah(totalAmount)}</strong> ke akun <strong>{paymentTransferAccount?.label}</strong>.</p>;
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
                        <h4 className="font-semibold text-lg">Detail Tagihan BPJS</h4>
                        <div className="text-sm space-y-1 text-muted-foreground">
                            <p>Nama Pelanggan: <strong>{formData.customerName}</strong></p>
                            <p>Sumber Deposit: <strong>{sourcePPOBAccount?.label}</strong></p>
                        </div>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                         <h4 className="font-semibold text-lg">Rincian Finansial</h4>
                        <div className="flex justify-between items-center"><p>Total Tagihan (Jual)</p><p>{formatToRupiah(totalAmount)}</p></div>
                        <div className="flex justify-between items-center"><p>Jumlah Tagihan (Modal)</p><p className="text-red-500">- {formatToRupiah(billAmount)}</p></div>
                        {cashback && cashback > 0 && <div className="flex justify-between items-center"><p>Cashback</p><p className="text-green-500">+ {formatToRupiah(cashback)}</p></div>}
                        <Separator />
                        <div className="flex justify-between items-center font-bold text-green-500 text-base"><p>Laba</p><p>{formatToRupiah(netProfit)}</p></div>
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
                               <li>Saldo <strong>{sourcePPOBAccount?.label}</strong> akan berkurang sebesar <span className="font-semibold text-red-500">{formatToRupiah(billAmount)}</span>.</li>
                               {cashback && cashback > 0 && <li>Saldo <strong>{sourcePPOBAccount?.label}</strong> akan bertambah (cashback) sebesar <span className="font-semibold text-green-500">{formatToRupiah(cashback)}</span>.</li>}
                                {paymentMethod === 'Tunai' && <li>Saldo <strong>Laci (Tunai)</strong> akan bertambah <span className="font-semibold text-green-500">{formatToRupiah(totalAmount)}</span>.</li>}
                                {paymentMethod === 'Transfer' && <li>Saldo <strong>{paymentTransferAccount?.label}</strong> akan bertambah <span className="font-semibold text-green-500">{formatToRupiah(totalAmount)}</span>.</li>}
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
