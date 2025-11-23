

"use client";

import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs, orderBy, where, Timestamp, doc, writeBatch, deleteDoc } from 'firebase/firestore';
import type { KasAccount, Transaction } from '@/lib/data';
import type { PPOBTransaction, PPOBPlnPostpaid, PPOBPdam, PPOBBpjs, PPOBWifi } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ArrowRight, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfDay, endOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Separator } from '../ui/separator';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import DeleteTransactionDialog from './DeleteTransactionDialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import EditTransactionNameForm from './EditTransactionNameForm';


interface TransactionHistoryProps {
  account: KasAccount;
  onDone: () => void;
}

type TransactionWithId = Transaction & { id: string };

type AuditData = PPOBTransaction | PPOBPlnPostpaid | PPOBPdam | PPOBBpjs | PPOBWifi;

const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const num = Number(String(value).replace(/[^0-9]/g, ''));
    if (isNaN(num)) return 'Rp 0';
    return `Rp ${num.toLocaleString('id-ID')}`;
};

const getCollectionNameFromCategory = (category?: string): string | null => {
    if (!category) return null;

    const categoryMap: Record<string, string> = {
        'transfer': 'internalTransfers', 'operational_fee': 'internalTransfers', 'settlement_debit': 'settlements', 'settlement_credit': 'settlements',
        'customer_transfer_debit': 'customerTransfers', 'customer_transfer_fee': 'customerTransfers', 'customer_payment_transfer': 'customerTransfers',
        'customer_withdrawal_credit': 'customerWithdrawals', 'customer_withdrawal_debit': 'customerWithdrawals', 'service_fee_income': 'customerWithdrawals',
        'customer_topup_debit': 'customerTopUps', 'customer_payment_topup': 'customerTopUps',
        'customer_emoney_topup_debit': 'customerEmoneyTopUps', 'customer_payment_emoney': 'customerEmoneyTopUps',
        'customer_va_payment_debit': 'customerVAPayments', 'customer_va_payment_fee': 'customerVAPayments', 'customer_payment_va': 'customerVAPayments',
        'customer_kjp_withdrawal_credit': 'customerKJPWithdrawals', 'customer_kjp_withdrawal_debit': 'customerKJPWithdrawals',
        'edc_service': 'edcServices',
        'ppob_purchase': 'ppobTransactions', 'customer_payment_ppob': 'ppobTransactions',
        'ppob_pln_postpaid': 'ppobPlnPostpaid', 'ppob_pln_postpaid_cashback': 'ppobPlnPostpaid', 'ppob_pln_postpaid_payment': 'ppobPlnPostpaid',
        'ppob_pdam_payment': 'ppobPdam', 'ppob_pdam_cashback': 'ppobPdam',
        'ppob_bpjs_payment': 'ppobBpjs', 'ppob_bpjs_cashback': 'ppobBpjs',
        'ppob_wifi_payment': 'ppobWifi', 'ppob_wifi_cashback': 'ppobWifi',
    };
    
    return categoryMap[category] || null;
};


export default function TransactionHistory({ account, onDone }: TransactionHistoryProps) {
  const firestore = useFirestore();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [transactions, setTransactions] = useState<TransactionWithId[]>([]);
  const [auditDetails, setAuditDetails] = useState<Map<string, AuditData>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [transactionToDelete, setTransactionToDelete] = useState<TransactionWithId | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<TransactionWithId | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);
  
  const fetchAuditDetails = async (transactionsToAudit: TransactionWithId[]) => {
      if (!firestore) return new Map();
  
      const auditIds = transactionsToAudit.map(trx => trx.auditId).filter((id): id is string => !!id);
      if (auditIds.length === 0) return new Map();
  
      const detailsMap = new Map<string, AuditData>();
      const collectionsToQuery = ['ppobTransactions', 'ppobPlnPostpaid', 'ppobPdam', 'ppobBpjs', 'ppobWifi'];
  
      for (const collectionName of collectionsToQuery) {
          // Firestore 'in' query is limited to 30 items. We might need to chunk this for very large auditId arrays.
          // For now, assuming it's within limits for a typical date range.
          const q = query(collection(firestore, collectionName), where('__name__', 'in', auditIds));
          const querySnapshot = await getDocs(q);
          querySnapshot.forEach(doc => {
              detailsMap.set(doc.id, doc.data() as AuditData);
          });
      }
      return detailsMap;
  };

  const fetchTransactions = async () => {
      if (!firestore || !account || !kasAccounts) return;
      setIsLoading(true);

      try {
        let fetchedTransactions: TransactionWithId[] = [];
        const accountsToFetchFrom = account.id === 'tunai-gabungan'
            ? kasAccounts.filter(acc => acc.type === 'Tunai') || []
            : [account];

        for (const acc of accountsToFetchFrom) {
            const transactionsRef = collection(firestore, 'kasAccounts', acc.id, 'transactions');
            const constraints = [orderBy('date', 'desc')];
            if (dateRange?.from) constraints.push(where('date', '>=', startOfDay(dateRange.from).toISOString()));
            if (dateRange?.to) constraints.push(where('date', '<=', endOfDay(dateRange.to).toISOString()));
            
            const q = query(transactionsRef, ...constraints);
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(doc => {
              fetchedTransactions.push({ id: doc.id, ...(doc.data() as Transaction) });
            });
        }
        
        fetchedTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setTransactions(fetchedTransactions);

        if (account.type === 'PPOB') {
            const details = await fetchAuditDetails(fetchedTransactions);
            setAuditDetails(details);
        }

      } catch (error) {
        console.error("Error fetching transaction history: ", error);
        toast({
          variant: "destructive",
          title: "Gagal Memuat Transaksi",
          description: "Terjadi kesalahan saat mengambil data riwayat mutasi.",
        });
      } finally {
        setIsLoading(false);
      }
    };

  useEffect(() => {
    if (kasAccounts) {
        fetchTransactions();
    }
  }, [firestore, account, dateRange, kasAccounts]);
  
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

        if (auditId) {
            const auditCollectionName = getCollectionNameFromCategory(category);
            if (auditCollectionName) {
                const auditDocRef = doc(firestore, auditCollectionName, auditId);
                batch.delete(auditDocRef);
            } else {
                console.warn(`No audit collection mapping for category: ${category}. Audit doc may not be deleted.`);
            }
        } else {
             console.warn("Transaction does not have an auditId. Only the transaction itself will be deleted.");
        }

        let allRelatedTrxRefs = [];
        let balanceChanges = new Map<string, number>(); 
        
        if (auditId) {
            for (const acc of kasAccounts) {
                const trxQuery = query(
                    collection(firestore, 'kasAccounts', acc.id, 'transactions'),
                    where('auditId', '==', auditId)
                );
                const querySnapshot = await getDocs(trxQuery);
                querySnapshot.forEach(docSnap => {
                    allRelatedTrxRefs.push(docSnap.ref);
                    const trxData = docSnap.data() as Transaction;
                    const changeToRevert = trxData.type === 'credit' ? -trxData.amount : trxData.amount;
                    
                    const currentChange = balanceChanges.get(acc.id) || 0;
                    balanceChanges.set(acc.id, currentChange + changeToRevert);
                });
            }
        }
        
        if (allRelatedTrxRefs.length === 0) {
             const { kasAccountId, type, amount } = transactionToDelete;
             const trxRef = doc(firestore, 'kasAccounts', kasAccountId, 'transactions', transactionToDelete.id);
             allRelatedTrxRefs.push(trxRef);
             const changeToRevert = type === 'credit' ? -amount : amount;
             balanceChanges.set(kasAccountId, changeToRevert);
        }
        
        allRelatedTrxRefs.forEach(ref => batch.delete(ref));
        
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
        fetchTransactions(); 
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
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  const getAccountLabel = (id: string) => kasAccounts?.find(acc => acc.id === id)?.label || 'Tidak diketahui';

  const renderPPOBDetails = (trx: TransactionWithId) => {
    if (account.type !== 'PPOB' || !trx.auditId) return null;

    const detail = auditDetails.get(trx.auditId);
    if (!detail) return null;

    let serviceName = '';
    let destination = '';

    if ('serviceName' in detail) {
        serviceName = detail.serviceName;
        destination = detail.destination;
    } else if ('billAmount' in detail) { // Handle bill payments
        if (trx.category?.includes('pln')) serviceName = 'PLN Pascabayar';
        else if (trx.category?.includes('pdam')) serviceName = 'PDAM';
        else if (trx.category?.includes('bpjs')) serviceName = 'BPJS';
        else if (trx.category?.includes('wifi')) serviceName = 'Wifi';
        destination = detail.customerName;
    }

    if (!serviceName && !destination) return null;

    return (
        <div className="text-xs text-muted-foreground mt-1 pl-1 border-l-2 border-muted ml-1">
            <p className="pl-2">Layanan: <strong>{serviceName}</strong></p>
            <p className="pl-2">Tujuan: <strong>{destination}</strong></p>
        </div>
    );
  }

  const renderTransactionItem = (trx: TransactionWithId) => (
      <div key={trx.id} className="py-4">
          <div className="flex justify-between items-start mb-2">
              <p className="font-semibold text-sm flex-1 pr-4">{trx.name}</p>
              <div className="flex items-center gap-1">
                <p className={cn(
                    'font-bold text-sm whitespace-nowrap',
                    trx.type === 'credit' ? 'text-green-500' : 'text-foreground'
                )}>
                    {trx.type === 'credit' ? '+' : '-'} {formatToRupiah(trx.amount)}
                </p>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
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
          </div>
          <p className="text-xs text-muted-foreground mb-1">
            {account.id === 'tunai-gabungan' && `(${getAccountLabel(trx.kasAccountId)}) • `}
            {formatDateTime(trx.date)}
          </p>
          {renderPPOBDetails(trx)}
          
          {trx.balanceBefore !== undefined && trx.balanceAfter !== undefined && (
             <div className="flex items-center justify-between text-xs bg-card-foreground/5 p-3 rounded-md mt-3">
                <div className="text-center">
                    <p className="text-muted-foreground">Saldo Awal</p>
                    <p className="font-medium">{formatToRupiah(trx.balanceBefore)}</p>
                </div>
                <ArrowRight size={16} className="text-muted-foreground" />
                <div className="text-center">
                    <p className="text-muted-foreground">Saldo Akhir</p>
                    <p className="font-medium">{formatToRupiah(trx.balanceAfter)}</p>
                </div>
            </div>
          )}
           <Separator className="mt-4" />
        </div>
  );

  return (
    <>
    <div className="h-full flex flex-col pt-4">
      <div className="px-1 mb-4">
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
      </div>

      <ScrollArea className="flex-1 -mx-6 px-6">
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
        {!isLoading && (!transactions || transactions.length === 0) && (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <CalendarIcon size={48} strokeWidth={1} className="text-muted-foreground mb-4" />
            <p className="font-semibold">Belum Ada Transaksi</p>
            <p className="text-sm text-muted-foreground">Tidak ada riwayat mutasi untuk rentang tanggal yang dipilih.</p>
          </div>
        )}
        {!isLoading && transactions && transactions.length > 0 && (
          <div className="flex flex-col">
            {transactions.map(renderTransactionItem)}
          </div>
        )}
      </ScrollArea>
      <div className="mt-4">
        <Button variant="outline" className="w-full" onClick={onDone}>Tutup</Button>
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


    