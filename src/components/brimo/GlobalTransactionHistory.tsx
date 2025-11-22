

"use client";

import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs, orderBy, where, Timestamp, doc, writeBatch, deleteDoc, collectionGroup } from 'firebase/firestore';
import type { KasAccount, Transaction } from '@/lib/data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ArrowDownLeft, ArrowUpRight, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfDay, endOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import DeleteTransactionDialog from './DeleteTransactionDialog';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import EditTransactionNameForm from './EditTransactionNameForm';


type TransactionWithId = Transaction & { id: string, accountLabel?: string };

const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const num = Number(String(value).replace(/[^0-9]/g, ''));
    if (isNaN(num)) return 'Rp 0';
    return `Rp ${num.toLocaleString('id-ID')}`;
};

const getCollectionNameFromCategory = (category?: string): string | null => {
    if (!category) return null;

    const categoryMap: Record<string, string> = {
        // --- Internal & Operational ---
        'transfer': 'internalTransfers',
        'operational_fee': 'internalTransfers',
        'settlement_debit': 'settlements',
        'settlement_credit': 'settlements',

        // --- Customer Transfer ---
        'customer_transfer_debit': 'customerTransfers',
        'customer_transfer_fee': 'customerTransfers',
        'customer_payment_transfer': 'customerTransfers',

        // --- Customer Withdrawal ---
        'customer_withdrawal_credit': 'customerWithdrawals',
        'customer_withdrawal_debit': 'customerWithdrawals',
        'service_fee_income': 'customerWithdrawals',

        // --- Customer TopUp (E-Wallet) ---
        'customer_topup_debit': 'customerTopUps',
        'customer_payment_topup': 'customerTopUps',

        // --- Customer TopUp (E-Money) ---
        'customer_emoney_topup_debit': 'customerEmoneyTopUps',
        'customer_payment_emoney': 'customerEmoneyTopUps',

        // --- Customer VA Payment ---
        'customer_va_payment_debit': 'customerVAPayments',
        'customer_va_payment_fee': 'customerVAPayments',
        'customer_payment_va': 'customerVAPayments',

        // --- Customer KJP Withdrawal ---
        'customer_kjp_withdrawal_credit': 'customerKJPWithdrawals',
        'customer_kjp_withdrawal_debit': 'customerKJPWithdrawals',

        // --- EDC Service ---
        'edc_service': 'edcServices',

        // --- PPOB Generic ---
        'ppob_purchase': 'ppobTransactions',
        'customer_payment_ppob': 'ppobTransactions', // Pulsa, Paket Data, Token Listrik, Paket Telpon

        // --- PPOB Bills ---
        'ppob_pln_postpaid': 'ppobPlnPostpaid',
        'ppob_pln_postpaid_cashback': 'ppobPlnPostpaid',
        'ppob_pln_postpaid_payment': 'ppobPlnPostpaid',
        
        'ppob_pdam_payment': 'ppobPdam',
        'ppob_pdam_cashback': 'ppobPdam',

        'ppob_bpjs_payment': 'ppobBpjs',
        'ppob_bpjs_cashback': 'ppobBpjs',

        'ppob_wifi_payment': 'ppobWifi',
        'ppob_wifi_cashback': 'ppobWifi',
    };
    
    return categoryMap[category] || null;
};


export default function GlobalTransactionHistory() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [transactions, setTransactions] = useState<TransactionWithId[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [transactionToDelete, setTransactionToDelete] = useState<TransactionWithId | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<TransactionWithId | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  const kasAccountsCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'kasAccounts');
  }, [firestore]);
  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

  const fetchTransactions = async () => {
    if (!firestore || !kasAccounts) {
      if (firestore) setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let allTransactions: TransactionWithId[] = [];
    try {
        const transactionsGroupRef = collectionGroup(firestore, 'transactions');
        
        const constraints = [];
        if (dateRange?.from) {
          constraints.push(where('date', '>=', startOfDay(dateRange.from).toISOString()));
        }
        if (dateRange?.to) {
          constraints.push(where('date', '<=', endOfDay(dateRange.to).toISOString()));
        }

        const q = query(transactionsGroupRef, ...constraints);

        const querySnapshot = await getDocs(q);
        const accountLabelMap = new Map(kasAccounts.map(acc => [acc.id, acc.label]));

        querySnapshot.forEach((doc) => {
          const accountId = doc.ref.parent.parent?.id;
          const accountLabel = accountId ? accountLabelMap.get(accountId) : 'Unknown';
          allTransactions.push({ 
            ...(doc.data() as Transaction), 
            id: doc.id,
            kasAccountId: accountId || '', // ensure kasAccountId is present
            accountLabel: accountLabel
          });
        });
      
      allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(allTransactions);

    } catch (error) {
      console.error("Error fetching transactions: ", error);
      if (error instanceof Error && error.message.includes("requires an index")) {
          toast({ variant: "destructive", title: "Indeks Diperlukan", description: "Mohon tunggu beberapa saat hingga indeks database selesai dibuat." });
      } else {
          toast({ variant: "destructive", title: "Error", description: "Gagal memuat riwayat transaksi." });
      }
    } finally {
      setIsLoading(false);
    }
  };


  useEffect(() => {
    fetchTransactions();
  }, [firestore, kasAccounts, dateRange]);

  const handleDeleteClick = (trx: TransactionWithId) => {
    setTransactionToDelete(trx);
    setIsDeleteOpen(true);
  };

  const handleEditClick = (trx: TransactionWithId) => {
    setTransactionToEdit(trx);
    setIsEditOpen(true);
  }

  const handleDeleteTransaction = async () => {
    if (!transactionToDelete || !firestore || !kasAccounts) return;

    toast({ title: "Memproses...", description: "Mencari & menghapus transaksi terkait." });

    const { auditId, category } = transactionToDelete;

    try {
        const batch = writeBatch(firestore);

        // --- 1. Delete the main audit log entry if auditId exists ---
        if (auditId) {
            const auditCollectionName = getCollectionNameFromCategory(category);
            if (auditCollectionName) {
                const auditDocRef = doc(firestore, auditCollectionName, auditId);
                batch.delete(auditDocRef);
            } else {
                console.warn(`No audit collection mapping found for category: ${category}. Audit doc may not be deleted.`);
            }
        } else {
             console.warn("Transaction does not have an auditId. Only the transaction itself will be deleted.");
        }


        // --- 2. Find and delete all related kas transactions using auditId, or just the single one if no auditId ---
        let allRelatedTrxRefs = [];
        let balanceChanges = new Map<string, number>(); // kasAccountId -> total change
        
        if (auditId) {
            for (const account of kasAccounts) {
                const trxQuery = query(
                    collection(firestore, 'kasAccounts', account.id, 'transactions'),
                    where('auditId', '==', auditId)
                );
                const querySnapshot = await getDocs(trxQuery);
                querySnapshot.forEach(docSnap => {
                    allRelatedTrxRefs.push(docSnap.ref);
                    const trxData = docSnap.data() as Transaction;
                    const changeToRevert = trxData.type === 'credit' ? -trxData.amount : trxData.amount;
                    
                    const currentChange = balanceChanges.get(account.id) || 0;
                    balanceChanges.set(account.id, currentChange + changeToRevert);
                });
            }
        }
        
        // Fallback for transactions without auditId or if search fails to find related ones
        if (allRelatedTrxRefs.length === 0) {
             const { kasAccountId, type, amount } = transactionToDelete;
             const trxRef = doc(firestore, 'kasAccounts', kasAccountId, 'transactions', transactionToDelete.id);
             allRelatedTrxRefs.push(trxRef);
             const changeToRevert = type === 'credit' ? -amount : amount;
             balanceChanges.set(kasAccountId, changeToRevert);
        }
        
        allRelatedTrxRefs.forEach(ref => batch.delete(ref));
        
        // --- 3. Revert balances for all affected accounts ---
        for (const [accountId, change] of balanceChanges.entries()) {
            const accountData = kasAccounts.find(acc => acc.id === accountId);
            if (accountData) {
                const accountRef = doc(firestore, 'kasAccounts', accountId);
                const newBalance = accountData.balance + change;
                batch.update(accountRef, { balance: newBalance });
            }
        }
        
        await batch.commit();

        toast({ title: "Berhasil", description: "Transaksi telah dihapus dari riwayat dan laporan." });
        fetchTransactions(); // Re-fetch to update the UI
    } catch (error: any) {
        console.error("Error deleting transaction: ", error);
        toast({ variant: "destructive", title: "Gagal", description: error.message || "Terjadi kesalahan saat menghapus transaksi." });
    } finally {
        setIsDeleteOpen(false);
        setTransactionToDelete(null);
    }
  };


  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
    <div className="h-full flex flex-col pt-4 px-4">
      <Card>
        <CardHeader>
            <CardTitle>Riwayat Transaksi</CardTitle>
        </CardHeader>
        <CardContent>
            <Popover>
            <PopoverTrigger asChild>
                <Button
                id="date"
                variant={"outline"}
                className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                )}
                >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                    dateRange.to ? (
                    <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                    </>
                    ) : (
                    format(dateRange.from, "LLL dd, y")
                    )
                ) : (
                    <span>Pilih rentang tanggal</span>
                )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={1}
                />
            </PopoverContent>
            </Popover>
        </CardContent>
      </Card>

      <div className="flex-1 mt-4 overflow-auto pb-4">
          <div className="space-y-2">
            {isLoading && (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            )}
            {!isLoading && (!transactions || transactions.length === 0) && (
              <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                <CalendarIcon size={48} strokeWidth={1} className="text-muted-foreground mb-4" />
                <p className="font-semibold">Belum Ada Transaksi</p>
                <p className="text-sm text-muted-foreground">Tidak ada riwayat untuk rentang tanggal yang dipilih.</p>
              </div>
            )}
            {!isLoading && transactions && transactions.length > 0 && (
                transactions.map((trx) => (
                <div key={trx.id} className="p-3 bg-card rounded-lg border flex items-start gap-3">
                    <div className={`w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center ${trx.type === 'credit' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                        {trx.type === 'credit' ? (
                        <ArrowDownLeft size={16} strokeWidth={2.5} className="text-green-500" />
                        ) : (
                        <ArrowUpRight size={16} strokeWidth={2.5} className="text-red-500" />
                        )}
                    </div>
                    <div className="flex-1 flex flex-col min-w-0">
                        <div className="flex justify-between items-start">
                            <p className="font-semibold text-sm flex-1 pr-2">{trx.name}</p>
                            <p className={cn(
                                'font-bold text-sm text-right whitespace-nowrap',
                                trx.type === 'credit' ? 'text-green-500' : 'text-foreground'
                            )}>
                                {trx.type === 'credit' ? '+' : '-'} {formatToRupiah(trx.amount)}
                            </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                        {trx.type === 'credit' ? `ke ${trx.accountLabel}` : `dari ${trx.accountLabel}`} • {formatDateTime(trx.date)}
                        </p>
                        {trx.deviceName && <p className="text-xs text-muted-foreground/80 mt-0.5">Oleh: {trx.deviceName}</p>}
                    </div>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 flex-shrink-0">
                                <MoreVertical size={16} />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleEditClick(trx)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                <span>Ubah Nama</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteClick(trx)} className="text-red-500 focus:text-red-500">
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Hapus</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                ))
            )}
          </div>
       </div>
    </div>

    <DeleteTransactionDialog
      isOpen={isDeleteOpen}
      onClose={() => setIsDeleteOpen(false)}
      onConfirm={handleDeleteTransaction}
      transactionName={transactionToDelete?.name}
    />
    <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent side="bottom" className="max-w-md mx-auto rounded-t-2xl h-[90vh]">
            <SheetHeader>
                <SheetTitle>Ubah Nama Transaksi</SheetTitle>
            </SheetHeader>
            {transactionToEdit && (
                <EditTransactionNameForm 
                    transaction={transactionToEdit}
                    onDone={() => {
                        setIsEditOpen(false);
                        fetchTransactions();
                    }}
                />
            )}
        </SheetContent>
    </Sheet>
    </>
  );
}


    


