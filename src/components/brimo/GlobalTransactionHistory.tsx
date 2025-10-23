
"use client";

import { useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs, orderBy, where, Timestamp, doc, writeBatch, deleteDoc } from 'firebase/firestore';
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
    
    if (category.startsWith('ppob_pln_postpaid')) return 'ppobPlnPostpaid';
    if (category.startsWith('ppob_pdam')) return 'ppobPdam';
    if (category.startsWith('ppob_')) return 'ppobTransactions';
    if (category.startsWith('customer_transfer')) return 'customerTransfers';
    if (category.startsWith('customer_withdrawal')) return 'customerWithdrawals';
    if (category.startsWith('customer_topup')) return 'customerTopUps';
    if (category.startsWith('customer_emoney_topup')) return 'customerEmoneyTopUps';
    if (category.startsWith('customer_va_payment')) return 'customerVAPayments';
    if (category.startsWith('edc_service')) return 'edcServices';
    if (category.startsWith('settlement')) return 'settlements';
    if (category.startsWith('customer_kjp_withdrawal')) return 'customerKJPWithdrawals';
    if (category.startsWith('transfer')) return 'internalTransfers';
    
    return null;
}


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
    if (!kasAccounts) {
      if (firestore) setIsLoading(false);
      return;
    };

    setIsLoading(true);
    let allTransactions: TransactionWithId[] = [];
    try {
      for (const account of kasAccounts) {
        const transactionsRef = collection(firestore, 'kasAccounts', account.id, 'transactions');
        
        const constraints = [];
        if (dateRange?.from) {
          constraints.push(where('date', '>=', startOfDay(dateRange.from).toISOString()));
        }
        if (dateRange?.to) {
          constraints.push(where('date', '<=', endOfDay(dateRange.to).toISOString()));
        }

        const q = query(transactionsRef, ...constraints);

        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
          allTransactions.push({ 
            ...(doc.data() as Transaction), 
            id: doc.id,
            accountLabel: account.label
          });
        });
      }
      allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(allTransactions);
    } catch (error) {
      console.error("Error fetching transactions: ", error);
      toast({ variant: "destructive", title: "Error", description: "Gagal memuat riwayat transaksi." });
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

    if (!auditId) {
        toast({ variant: "destructive", title: "Gagal", description: "Transaksi ini tidak memiliki ID audit untuk dihapus secara aman." });
        setIsDeleteOpen(false);
        setTransactionToDelete(null);
        return;
    }

    try {
        const batch = writeBatch(firestore);

        // --- 1. Delete the main audit log entry ---
        const auditCollectionName = getCollectionNameFromCategory(category);
        if (auditCollectionName) {
            const auditDocRef = doc(firestore, auditCollectionName, auditId);
            batch.delete(auditDocRef);
        } else {
            console.warn(`No audit collection mapping found for category: ${category}`);
        }

        // --- 2. Find and delete all related kas transactions using auditId ---
        let allRelatedTrxRefs = [];
        let balanceChanges = new Map<string, number>(); // kasAccountId -> total change
        
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
        
        if (allRelatedTrxRefs.length === 0) {
             console.warn("Could not find any kas transactions with auditId:", auditId);
             // Fallback for safety, though it shouldn't be needed with the new logic
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


      <ScrollArea className="flex-1 mt-4">
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
          <div className="space-y-2">
            {transactions.map((trx) => (
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
                        <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
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
            ))}
          </div>
        )}
      </ScrollArea>
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
    </div>
  );
}
