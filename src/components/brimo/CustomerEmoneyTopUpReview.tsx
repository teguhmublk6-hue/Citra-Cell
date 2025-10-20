
"use client";

import type { CustomerEmoneyTopUpFormValues } from "@/lib/types";
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

interface CustomerEmoneyTopUpReviewProps {
    formData: CustomerEmoneyTopUpFormValues;
    onConfirm: () => void;
    onBack: () => void;
}

const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const num = Number(String(value).replace(/[^0-9]/g, ''));
    if (isNaN(num)) return 'Rp 0';
    return `Rp ${num.toLocaleString('id-ID')}`;
};

export default function CustomerEmoneyTopUpReview({ formData, onConfirm, onBack }: CustomerEmoneyTopUpReviewProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
    const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

    const sourceAccount = kasAccounts?.find(acc => acc.id === formData.sourceAccountId);
    const paymentTransferAccount = kasAccounts?.find(acc => acc.id === formData.paymentToKasTransferAccountId);

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
            await runTransaction(firestore, async (transaction) => {
                const laciAccountName = 'Laci';
                
                const sourceAccountRef = doc(firestore, 'kasAccounts', sourceAccount.id);
                
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

                const docsToRead = [sourceAccountRef];
                if (laciAccountRef) docsToRead.push(laciAccountRef);
                if (paymentAccRef) docsToRead.push(paymentAccRef);
                
                const allDocs = await Promise.all(docsToRead.map(ref => transaction.get(ref)));
                
                const sourceAccountDoc = allDocs.find(d => d.ref.path === sourceAccountRef.path);
                const laciAccountDoc = laciAccountRef ? allDocs.find(d => d.ref.path === laciAccountRef!.path) : undefined;
                const paymentAccDoc = paymentAccRef ? allDocs.find(d => d.ref.path === paymentAccRef!.path) : undefined;

                if (!sourceAccountDoc || !sourceAccountDoc.exists()) {
                    throw new Error("Akun sumber tidak ditemukan.");
                }
                 const currentSourceBalance = sourceAccountDoc.data().balance;
                if (currentSourceBalance < topUpAmount) {
                    throw new Error(`Saldo ${sourceAccount.label} tidak mencukupi.`);
                }
                
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
                    if(!paymentAccDoc || !paymentAccDoc.exists()) {
                        throw new Error("Akun penerima pembayaran transfer tidak ditemukan.");
                    }
                    currentPaymentAccBalance = paymentAccDoc.data().balance;
                }

                if (!laciAccountDoc || !laciAccountDoc.exists()) {
                    transaction.set(finalLaciAccountRef, { label: laciAccountName, type: 'Tunai', balance: 0, minimumBalance: 0, color: 'bg-green-500' });
                }

                transaction.update(sourceAccountRef, { balance: currentSourceBalance - topUpAmount });

                const debitTxRef = doc(collection(sourceAccountRef, 'transactions'));
                transaction.set(debitTxRef, {
                    kasAccountId: sourceAccount.id, type: 'debit', name: `Top Up ${formData.destinationEmoney}`, account: formData.destinationEmoney, date: nowISO, amount: topUpAmount, balanceBefore: currentSourceBalance, balanceAfter: currentSourceBalance - topUpAmount, category: 'customer_emoney_topup_debit', deviceName
                });
                
                switch (paymentMethod) {
                    case 'Tunai':
                        transaction.update(finalLaciAccountRef, { balance: currentLaciBalance + totalPaymentByCustomer });
                        const creditTunaiRef = doc(collection(finalLaciAccountRef, 'transactions'));
                        transaction.set(creditTunaiRef, {
                             kasAccountId: laciAccountId, type: 'credit', name: `Bayar Top Up E-Money`, account: 'Pelanggan', date: nowISO, amount: totalPaymentByCustomer, balanceBefore: currentLaciBalance, balanceAfter: currentLaciBalance + totalPaymentByCustomer, category: 'customer_payment', deviceName
                        });
                        break;
                    case 'Transfer':
                        if (!paymentAccRef) throw new Error("Referensi akun pembayaran tidak valid.");
                        transaction.update(paymentAccRef, { balance: currentPaymentAccBalance + totalPaymentByCustomer });
                        const creditTransferRef = doc(collection(paymentAccRef, 'transactions'));
                        transaction.set(creditTransferRef, {
                            kasAccountId: paymentTransferAccount!.id, type: 'credit', name: `Bayar Top Up E-Money`, account: 'Pelanggan', date: nowISO, amount: totalPaymentByCustomer, balanceBefore: currentPaymentAccBalance, balanceAfter: currentPaymentAccBalance + totalPaymentByCustomer, category: 'customer_payment', deviceName
                        });
                        break;
                    case 'Split':
                        if (!splitTunaiAmount || !paymentAccRef) throw new Error("Data pembayaran split tidak lengkap");
                        transaction.update(finalLaciAccountRef, { balance: currentLaciBalance + splitTunaiAmount });
                        const creditSplitTunaiRef = doc(collection(finalLaciAccountRef, 'transactions'));
                        transaction.set(creditSplitTunaiRef, {
                             kasAccountId: laciAccountId, type: 'credit', name: `Bayar Tunai E-Money`, account: 'Pelanggan', date: nowISO, amount: splitTunaiAmount, balanceBefore: currentLaciBalance, balanceAfter: currentLaciBalance + splitTunaiAmount, category: 'customer_payment', deviceName
                        });

                        transaction.update(paymentAccRef, { balance: currentPaymentAccBalance + splitTransferAmount });
                        const creditSplitTransferRef = doc(collection(paymentAccRef, 'transactions'));
                        transaction.set(creditSplitTransferRef, {
                            kasAccountId: paymentTransferAccount!.id, type: 'credit', name: `Bayar Transfer E-Money`, account: 'Pelanggan', date: nowISO, amount: splitTransferAmount, balanceBefore: currentPaymentAccBalance, balanceAfter: currentPaymentAccBalance + splitTransferAmount, category: 'customer_payment', deviceName
                        });
                        break;
                }
            });

            await addDoc(collection(firestore, 'customerEmoneyTopUps'), {
                date: now,
                sourceKasAccountId: formData.sourceAccountId,
                destinationEmoney: formData.destinationEmoney,
                topUpAmount: formData.topUpAmount,
                serviceFee: formData.serviceFee,
                paymentMethod: formData.paymentMethod,
                paymentToKasTunaiAmount: paymentMethod === 'Tunai' ? totalPaymentByCustomer : (paymentMethod === 'Split' ? splitTunaiAmount : 0),
                paymentToKasTransferAccountId: paymentMethod === 'Transfer' || paymentMethod === 'Split' ? formData.paymentToKasTransferAccountId : null,
                paymentToKasTransferAmount: paymentMethod === 'Transfer' ? totalPaymentByCustomer : (paymentMethod === 'Split' ? splitTransferAmount : 0),
                deviceName
            });

            toast({ title: "Sukses", description: "Transaksi Top Up E-Money berhasil disimpan." });
            onConfirm();

        } catch (error: any) {
            console.error("Error saving e-money top up transaction: ", error);
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
                    <div className="space-y-2">
                        <h4 className="font-semibold text-lg">Detail Top Up E-Money</h4>
                        <div className="text-sm space-y-1 text-muted-foreground">
                            <p>Tujuan: <strong>{formData.destinationEmoney}</strong></p>
                            <p>Sumber Dana: <strong>{sourceAccount?.label}</strong></p>
                        </div>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                         <h4 className="font-semibold text-lg">Rincian Finansial</h4>
                        <div className="flex justify-between items-center"><p>Nominal Top Up</p><p>{formatToRupiah(topUpAmount)}</p></div>
                        <div className="flex justify-between items-center"><p>Biaya Jasa (Laba)</p><p>{formatToRupiah(serviceFee)}</p></div>
                        <Separator />
                        <div className="flex justify-between items-center font-bold text-base"><p>Total Bayar Pelanggan</p><p>{formatToRupiah(totalPaymentByCustomer)}</p></div>
                    </div>
                     <Separator />
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
