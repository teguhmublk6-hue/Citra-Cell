
"use client";

import { useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs, orderBy, where, Timestamp } from 'firebase/firestore';
import type { KasAccount, Transaction } from '@/lib/data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfDay, endOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Separator } from '../ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

type TransactionWithId = Transaction & { id: string, accountLabel?: string };

const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const num = Number(String(value).replace(/[^0-9]/g, ''));
    if (isNaN(num)) return 'Rp 0';
    return `Rp ${num.toLocaleString('id-ID')}`;
};

export default function GlobalTransactionHistory() {
  const firestore = useFirestore();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [transactions, setTransactions] = useState<TransactionWithId[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const kasAccountsCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'kasAccounts');
  }, [firestore]);
  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!kasAccounts) {
        setIsLoading(false);
        return;
      };

      setIsLoading(true);
      let allTransactions: TransactionWithId[] = [];
      try {
        for (const account of kasAccounts) {
          const transactionsRef = collection(firestore, 'kasAccounts', account.id, 'transactions');
          
          const constraints = [];
          if (dateRange?.from) {
            constraints.push(where('date', '>=', Timestamp.fromDate(startOfDay(dateRange.from))));
          }
          if (dateRange?.to) {
            constraints.push(where('date', '<=', Timestamp.fromDate(endOfDay(dateRange.to))));
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
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, [firestore, kasAccounts, dateRange]);

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
              <div key={trx.id} className="p-3 bg-card rounded-lg border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${trx.type === 'credit' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                        {trx.type === 'credit' ? (
                        <ArrowDownLeft size={18} strokeWidth={2} className="text-green-500" />
                        ) : (
                        <ArrowUpRight size={18} strokeWidth={2} className="text-red-500" />
                        )}
                    </div>
                    <div className="flex-1 truncate">
                        <p className="font-semibold text-sm truncate">{trx.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {trx.type === 'credit' ? `ke ${trx.accountLabel}` : `dari ${trx.accountLabel}`} • {formatDateTime(trx.date)}
                        </p>
                    </div>
                  </div>
                  <p className={cn(
                      'font-bold text-sm text-right',
                      trx.type === 'credit' ? 'text-green-500' : 'text-foreground'
                  )}>
                      {trx.type === 'credit' ? '+' : '-'} {formatToRupiah(trx.amount)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

    
