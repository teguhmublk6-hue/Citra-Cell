
"use client";

import type { CustomerTransferFormValues } from "@/lib/types";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, doc, writeBatch, runTransaction, getDocs, query, where, addDoc } from "firebase/firestore";
import type { KasAccount } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Terminal } from "lucide-react";
import { Separator } from "../ui/separator";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";


interface CustomerTransferReviewProps {
    formData: CustomerTransferFormValues;
    onConfirm: () => void;
    onBack: () => void;
}

const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const num = Number(String(value).replace(/[^0-9]/g, ''));
    if (isNaN(num)) return 'Rp 0';
    return `Rp ${num.toLocaleString('id-ID')}`;
};

export default function CustomerTransferReview({ formData, onConfirm, onBack }: CustomerTransferReviewProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
    const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

    const sourceAccount = kasAccounts?.find(acc => acc.id === formData.sourceAccountId);
    const paymentTransferAccount = kasAccounts?.find(acc => acc.id === formData.paymentToKasTransferAccountId);

    const {
        transferAmount,
        serviceFee,
        bankAdminFee,
        paymentMethod,
        splitTunaiAmount
    } = formData;

    const totalPaymentByCustomer = transferAmount + serviceFee;
    const totalDebitFromSource = transferAmount + (bankAdminFee || 0);
    const netProfit = serviceFee - (bankAdminFee || 0);
    const splitTransferAmount = totalPaymentByCustomer - (splitTunaiAmount || 0);

    const handleSaveTransaction = async () => {
        if (!firestore || !sourceAccount || !kasAccounts) {
            toast({ variant: "destructive", title: "Error", description: "Database atau akun tidak ditemukan." });
            return;
        }

        if (sourceAccount.balance < totalDebitFromSource) {
            toast({ variant: "destructive", title: "Saldo Tidak Cukup", description: `Saldo ${sourceAccount.label} tidak mencukupi untuk melakukan transfer ini.` });
            return;
        }

        setIsSaving(true);
        toast({ title: "Memproses...", description: "Menyimpan transaksi transfer." });

        try {
            const deviceName = localStorage.getItem('brimoDeviceName') || 'Unknown Device';
            const now = new Date().toISOString();
            const laciAccountName = 'Laci';
            
            // This transaction will only handle the balance updates and subcollection transactions
            await runTransaction(firestore, async (transaction) => {
                const kasAccountQuery = query(collection(firestore, 'kasAccounts'), where("label", "==", laciAccountName));
                const kasAccountSnapshot = await getDocs(kasAccountQuery);

                let laciAccount: KasAccount;
                if (kasAccountSnapshot.empty) {
                    const newLaciRef = doc(collection(firestore, 'kasAccounts'));
                    const newLaciData: Omit<KasAccount, 'id'> = { label: laciAccountName, type: 'Tunai', balance: 0, minimumBalance: 0, color: 'bg-green-500' };
                    transaction.set(newLaciRef, newLaciData);
                    laciAccount = { ...newLaciData, id: newLaciRef.id };
                } else {
                    const doc = kasAccountSnapshot.docs[0];
                    laciAccount = { ...(doc.data() as KasAccount), id: doc.id };
                }
                
                const laciAccountRef = doc(firestore, 'kasAccounts', laciAccount.id);
                const currentLaciDoc = await transaction.get(laciAccountRef);
                const currentLaciBalance = currentLaciDoc.data()?.balance || 0;

                // 2. Debit Source Account
                const sourceAccountRef = doc(firestore, 'kasAccounts', sourceAccount.id);
                const currentSourceDoc = await transaction.get(sourceAccountRef);
                const currentSourceBalance = currentSourceDoc.data()?.balance || 0;
                transaction.update(sourceAccountRef, { balance: currentSourceBalance - totalDebitFromSource });

                // Create debit transactions for source account
                const debitPrincipalRef = doc(collection(sourceAccountRef, 'transactions'));
                transaction.set(debitPrincipalRef, {
                    kasAccountId: sourceAccount.id, type: 'debit', name: `Trf an. ${formData.destinationAccountName}`, account: formData.destinationBank, date: now, amount: transferAmount, balanceBefore: currentSourceBalance, balanceAfter: currentSourceBalance - totalDebitFromSource, category: 'customer_transfer_debit', deviceName
                });

                if (bankAdminFee && bankAdminFee > 0) {
                    const debitFeeRef = doc(collection(sourceAccountRef, 'transactions'));
                    transaction.set(debitFeeRef, {
                        kasAccountId: sourceAccount.id, type: 'debit', name: `Biaya Admin Trf an. ${formData.destinationAccountName}`, account: 'Biaya Bank', date: now, amount: bankAdminFee, balanceBefore: currentSourceBalance - transferAmount, balanceAfter: currentSourceBalance - totalDebitFromSource, category: 'customer_transfer_fee', deviceName
                    });
                }
                
                // 3. Handle Customer Payment (Inflow)
                switch (paymentMethod) {
                    case 'Tunai':
                        transaction.update(laciAccountRef, { balance: currentLaciBalance + totalPaymentByCustomer });
                        const creditTunaiRef = doc(collection(laciAccountRef, 'transactions'));
                        transaction.set(creditTunaiRef, {
                             kasAccountId: laciAccount.id, type: 'credit', name: `Bayar Trf an. ${formData.destinationAccountName}`, account: 'Pelanggan', date: now, amount: totalPaymentByCustomer, balanceBefore: currentLaciBalance, balanceAfter: currentLaciBalance + totalPaymentByCustomer, category: 'customer_payment', deviceName
                        });
                        break;
                    case 'Transfer':
                        if (!paymentTransferAccount) throw new Error("Akun penerima transfer tidak ditemukan");
                        const paymentAccRef = doc(firestore, 'kasAccounts', paymentTransferAccount.id);
                        const currentPaymentAccDoc = await transaction.get(paymentAccRef);
                        const currentPaymentAccBalance = currentPaymentAccDoc.data()?.balance || 0;

                        transaction.update(paymentAccRef, { balance: currentPaymentAccBalance + totalPaymentByCustomer });
                        const creditTransferRef = doc(collection(paymentAccRef, 'transactions'));
                        transaction.set(creditTransferRef, {
                            kasAccountId: paymentTransferAccount.id, type: 'credit', name: `Bayar Trf an. ${formData.destinationAccountName}`, account: 'Pelanggan', date: now, amount: totalPaymentByCustomer, balanceBefore: currentPaymentAccBalance, balanceAfter: currentPaymentAccBalance + totalPaymentByCustomer, category: 'customer_payment', deviceName
                        });
                        break;
                    case 'Split':
                        if (!splitTunaiAmount || !paymentTransferAccount) throw new Error("Data pembayaran split tidak lengkap");
                        // Laci update
                        transaction.update(laciAccountRef, { balance: currentLaciBalance + splitTunaiAmount });
                        const creditSplitTunaiRef = doc(collection(laciAccountRef, 'transactions'));
                        transaction.set(creditSplitTunaiRef, {
                             kasAccountId: laciAccount.id, type: 'credit', name: `Bayar Tunai Trf an. ${formData.destinationAccountName}`, account: 'Pelanggan', date: now, amount: splitTunaiAmount, balanceBefore: currentLaciBalance, balanceAfter: currentLaciBalance + splitTunaiAmount, category: 'customer_payment', deviceName
                        });

                        // Transfer account update
                        const splitPaymentAccRef = doc(firestore, 'kasAccounts', paymentTransferAccount.id);
                        const currentSplitPaymentAccDoc = await transaction.get(splitPaymentAccRef);
                        const currentSplitPaymentAccBalance = currentSplitPaymentAccDoc.data()?.balance || 0;

                        transaction.update(splitPaymentAccRef, { balance: currentSplitPaymentAccBalance + splitTransferAmount });
                        const creditSplitTransferRef = doc(collection(splitPaymentAccRef, 'transactions'));
                        transaction.set(creditSplitTransferRef, {
                            kasAccountId: paymentTransferAccount.id, type: 'credit', name: `Bayar Transfer Trf an. ${formData.destinationAccountName}`, account: 'Pelanggan', date: now, amount: splitTransferAmount, balanceBefore: currentSplitPaymentAccBalance, balanceAfter: currentSplitPaymentAccBalance + splitTransferAmount, category: 'customer_payment', deviceName
                        });
                        break;
                }
            });

            // After the transaction is successful, create the audit log using addDoc
            const auditLogCollectionRef = collection(firestore, 'customerTransfers');
            const auditLogData = {
                date: now,
                sourceKasAccountId: formData.sourceAccountId,
                destinationBankName: formData.destinationBank,
                destinationAccountName: formData.destinationAccountName,
                transferAmount: formData.transferAmount,
                bankAdminFee: formData.bankAdminFee || 0,
                serviceFee: formData.serviceFee,
                netProfit,
                paymentMethod: formData.paymentMethod,
                paymentToKasTunaiAmount: paymentMethod === 'Tunai' ? totalPaymentByCustomer : (paymentMethod === 'Split' ? splitTunaiAmount : 0),
                paymentToKasTransferAccountId: paymentMethod === 'Transfer' || paymentMethod === 'Split' ? formData.paymentToKasTransferAccountId : null,
                paymentToKasTransferAmount: paymentMethod === 'Transfer' ? totalPaymentByCustomer : (paymentMethod === 'Split' ? splitTransferAmount : 0),
                deviceName
            };
            
            await addDoc(auditLogCollectionRef, auditLogData).catch(error => {
                // If even the audit log fails, we need to report it.
                // This indicates a deeper permission issue on the customerTransfers collection.
                 const permissionError = new FirestorePermissionError({
                    path: 'customerTransfers',
                    operation: 'create', // Explicitly 'create' because we are using addDoc
                    requestResourceData: auditLogData
                });
                errorEmitter.emit('permission-error', permissionError);
                // We throw to make sure the final success toast isn't shown
                throw permissionError;
            });

            toast({ title: "Sukses", description: "Transaksi berhasil disimpan." });
            onConfirm();
        } catch (error: any) {
            // This will now catch errors from the transaction OR the addDoc call.
            // If the error is not already a FirestorePermissionError, we create one for consistency.
            if (!(error instanceof FirestorePermissionError)) {
                 const permissionError = new FirestorePermissionError({
                    path: 'customerTransfers_transaction', // Generic path for transaction failure
                    operation: 'write',
                    requestResourceData: { 
                        error: error.message,
                        formData,
                        summary: { totalDebitFromSource, totalPaymentByCustomer, netProfit }
                    }
                });
                errorEmitter.emit('permission-error', permissionError);
            }
            // If it was already a permission error, it would have been emitted, so no need to re-emit.
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
                    {/* Transfer Details */}
                    <div className="space-y-2">
                        <h4 className="font-semibold text-lg">Detail Transfer</h4>
                        <div className="text-sm space-y-1 text-muted-foreground">
                            <p>Ke: <strong>{formData.destinationBank}</strong> a/n <strong>{formData.destinationAccountName}</strong></p>
                            <p>Dari Akun Kas: <strong>{sourceAccount?.label}</strong></p>
                        </div>
                    </div>
                    <Separator />
                    {/* Financials */}
                    <div className="space-y-2">
                         <h4 className="font-semibold text-lg">Rincian Finansial</h4>
                        <div className="flex justify-between items-center"><p>Nominal Transfer</p><p>{formatToRupiah(transferAmount)}</p></div>
                        <div className="flex justify-between items-center"><p>Biaya Jasa (Laba Kotor)</p><p>{formatToRupiah(serviceFee)}</p></div>
                        <div className="flex justify-between items-center"><p>Biaya Admin Bank</p><p className="text-red-500">- {formatToRupiah(bankAdminFee)}</p></div>
                        <Separator />
                        <div className="flex justify-between items-center font-bold text-base"><p>Total Bayar Pelanggan</p><p>{formatToRupiah(totalPaymentByCustomer)}</p></div>
                         <div className="flex justify-between items-center font-bold text-green-500"><p>Estimasi Laba Bersih</p><p>{formatToRupiah(netProfit)}</p></div>
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
                               <li>Saldo <strong>{sourceAccount?.label}</strong> akan berkurang <span className="font-semibold text-red-500">{formatToRupiah(totalDebitFromSource)}</span>.</li>
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

    
