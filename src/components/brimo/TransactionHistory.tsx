
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where, getDocs } from 'firebase/firestore';
import type { KasAccount, Transaction } from '@/lib/data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfDay, endOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Separator } from '../ui/separator';
import { useToast } from '@/hooks/use-toast';

interface TransactionHistoryProps {
  account: KasAccount;
  onDone: () => void;
}

type TransactionWithId = Transaction & { id: string };

type GroupedTransaction = {
    isGroup: true;
    mainTransaction: TransactionWithId;
    feeTransaction: TransactionWithId | null;
    totalAmount: number;
    date: string;
    type: 'credit' | 'debit';
};

type DisplayItem = TransactionWithId | GroupedTransaction;

const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const num = Number(String(value).replace(/[^0-9]/g, ''));
    if (isNaN(num)) return 'Rp 0';
    return `Rp ${num.toLocaleString('id-ID')}`;
};

export default function TransactionHistory({ account, onDone }: TransactionHistoryProps) {
  const firestore = useFirestore();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [transactions, setTransactions] = useState<TransactionWithId[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!firestore || !account) return;
      setIsLoading(true);

      try {
        let fetchedTransactions: TransactionWithId[] = [];

        if (account.id === 'tunai-gabungan') {
          // Fetch from all 'Tunai' accounts
          const tunaiAccounts = kasAccounts?.filter(acc => acc.type === 'Tunai') || [];
          for (const tunaiAccount of tunaiAccounts) {
            const transactionsRef = collection(firestore, 'kasAccounts', tunaiAccount.id, 'transactions');
            const constraints = [];
            if (dateRange?.from) constraints.push(where('date', '>=', startOfDay(dateRange.from).toISOString()));
            if (dateRange?.to) constraints.push(where('date', '<=', endOfDay(dateRange.to).toISOString()));
            
            const q = query(transactionsRef, ...constraints);
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(doc => {
              fetchedTransactions.push({ id: doc.id, ...(doc.data() as Transaction) });
            });
          }
        } else {
          // Fetch from a single specified account
          const transactionsRef = collection(firestore, 'kasAccounts', account.id, 'transactions');
          const constraints = [];
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

    if (kasAccounts) {
        fetchTransactions();
    }
  }, [firestore, account, dateRange, kasAccounts, toast]);

  const displayItems = useMemo((): DisplayItem[] => {
    const groupedByAuditId = new Map<string, TransactionWithId[]>();
    const singles: TransactionWithId[] = [];

    for (const trx of transactions) {
        if (trx.auditId && (trx.category === 'transfer' || trx.category === 'operational_fee' || trx.category?.startsWith('settlement'))) {
            if (!groupedByAuditId.has(trx.auditId)) {
                groupedByAuditId.set(trx.auditId, []);
            }
            groupedByAuditId.get(trx.auditId)!.push(trx);
        } else {
            singles.push(trx);
        }
    }

    const processedGroups: GroupedTransaction[] = [];
    groupedByAuditId.forEach((trxsInGroup) => {
        const transferTrx = trxsInGroup.find(t => t.category === 'transfer' || t.category?.startsWith('settlement'));
        const feeTrx = trxsInGroup.find(t => t.category === 'operational_fee');

        if (transferTrx) {
            let totalAmount = transferTrx.amount;
            if (feeTrx) {
              // This logic calculates the total change for the specific account in the group
              if (transferTrx.kasAccountId === feeTrx.kasAccountId) {
                totalAmount = transferTrx.amount + feeTrx.amount;
              }
            }

            processedGroups.push({
                isGroup: true,
                mainTransaction: transferTrx,
                feeTransaction: feeTrx || null,
                totalAmount: totalAmount, // This might need adjustment based on context
                date: transferTrx.date,
                type: transferTrx.type,
            });
        }
    });

    const allItems: DisplayItem[] = [...singles, ...processedGroups];
    allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return allItems;
  }, [transactions]);


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

  const renderTransactionItem = (trx: TransactionWithId) => (
      <div key={trx.id} className="py-4">
          <div className="flex justify-between items-start mb-2">
              <p className="font-semibold text-sm flex-1 pr-4">{trx.name}</p>
              <p className={cn(
                  'font-bold text-sm whitespace-nowrap',
                  trx.type === 'credit' ? 'text-green-500' : 'text-foreground'
              )}>
                  {trx.type === 'credit' ? '+' : '-'} {formatToRupiah(trx.amount)}
              </p>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            {account.id === 'tunai-gabungan' && `(${getAccountLabel(trx.kasAccountId)}) • `}
            {formatDateTime(trx.date)}
          </p>
          
          {trx.balanceBefore !== undefined && trx.balanceAfter !== undefined && (
             <div className="flex items-center justify-between text-xs bg-card-foreground/5 p-3 rounded-md">
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

  const renderGroupedItem = (group: GroupedTransaction) => {
      const { mainTransaction, feeTransaction } = group;
      const isSourceAccountView = account.id === mainTransaction.kasAccountId;

      let displayAmount = 0;
      let rincian;

      if (isSourceAccountView) {
        // --- LOGIC FOR SOURCE ACCOUNT ---
        displayAmount = mainTransaction.amount + (feeTransaction?.amount || 0);
        rincian = (
          <>
            <div className="flex justify-between">
              <p>Pokok Transfer</p>
              <p className="font-medium">{formatToRupiah(mainTransaction.amount)}</p>
            </div>
            {feeTransaction && (
              <div className="flex justify-between">
                <p>Biaya Admin</p>
                <p className="font-medium">{formatToRupiah(feeTransaction.amount)}</p>
              </div>
            )}
          </>
        );
      } else {
        // --- LOGIC FOR DESTINATION ACCOUNT ---
        const isFeeDeductedFromDestination = feeTransaction?.type === 'debit';
        displayAmount = mainTransaction.amount - (isFeeDeductedFromDestination ? (feeTransaction?.amount || 0) : 0);
        rincian = (
          <>
            <div className="flex justify-between">
                <p>Pokok Masuk</p>
                <p className="font-medium">{formatToRupiah(mainTransaction.amount)}</p>
            </div>
            {feeTransaction && isFeeDeductedFromDestination && (
                <div className="flex justify-between text-red-500">
                    <p>Potongan Biaya Admin</p>
                    <p className="font-medium">- {formatToRupiah(feeTransaction.amount)}</p>
                </div>
            )}
          </>
        );
      }
      
      return (
        <div key={mainTransaction.auditId} className="py-4">
          <div className="flex justify-between items-start mb-2">
            <p className="font-semibold text-sm flex-1 pr-4">{mainTransaction.name}</p>
            <p className={cn(
                'font-bold text-sm whitespace-nowrap',
                mainTransaction.type === 'credit' ? 'text-green-500' : 'text-foreground'
            )}>
              {mainTransaction.type === 'credit' ? '+' : '-'} {formatToRupiah(displayAmount)}
            </p>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
              {account.id === 'tunai-gabungan' && `(${getAccountLabel(mainTransaction.kasAccountId)}) • `}
              {formatDateTime(mainTransaction.date)}
          </p>
          
          <div className="bg-card-foreground/5 p-3 rounded-md space-y-2 text-xs">
              {rincian}
          </div>

          {mainTransaction.balanceBefore !== undefined && mainTransaction.balanceAfter !== undefined && (
             <div className="flex items-center justify-between text-xs bg-card-foreground/5 p-3 rounded-md mt-2">
                <div className="text-center">
                    <p className="text-muted-foreground">Saldo Awal</p>
                    <p className="font-medium">{formatToRupiah(mainTransaction.balanceBefore)}</p>
                </div>
                <ArrowRight size={16} className="text-muted-foreground" />
                <div className="text-center">
                    <p className="text-muted-foreground">Saldo Akhir</p>
                    <p className="font-medium">{formatToRupiah(mainTransaction.balanceAfter)}</p>
                </div>
            </div>
          )}
           <Separator className="mt-4" />
        </div>
      );
  };

  return (
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
        {!isLoading && (!displayItems || displayItems.length === 0) && (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <CalendarIcon size={48} strokeWidth={1} className="text-muted-foreground mb-4" />
            <p className="font-semibold">Belum Ada Transaksi</p>
            <p className="text-sm text-muted-foreground">Tidak ada riwayat mutasi untuk rentang tanggal yang dipilih.</p>
          </div>
        )}
        {!isLoading && displayItems && displayItems.length > 0 && (
          <div className="flex flex-col">
            {displayItems.map((item) => {
                if ('isGroup' in item && item.isGroup) {
                    return renderGroupedItem(item);
                } else {
                    return renderTransactionItem(item as TransactionWithId);
                }
            })}
          </div>
        )}
      </ScrollArea>
      <div className="mt-4">
        <Button variant="outline" className="w-full" onClick={onDone}>Tutup</Button>
      </div>
    </div>
  );
}
