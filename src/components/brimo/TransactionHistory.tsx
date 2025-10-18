
"use client";

import { useState } from 'react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import type { KasAccount, Transaction } from '@/lib/data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Send, FileText, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfDay, endOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';

interface TransactionHistoryProps {
  account: KasAccount;
  onDone: () => void;
}

type TransactionWithId = Transaction & { id: string };

export default function TransactionHistory({ account, onDone }: TransactionHistoryProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const transactionsCollection = useMemoFirebase(() => {
    if (!user?.uid) return null;
    
    const constraints = [orderBy('date', 'desc')];
    if (dateRange?.from) {
      constraints.push(where('date', '>=', startOfDay(dateRange.from).toISOString()));
    }
    if (dateRange?.to) {
      constraints.push(where('date', '<=', endOfDay(dateRange.to).toISOString()));
    }
    
    return query(
      collection(firestore, 'users', user.uid, 'kasAccounts', account.id, 'transactions'),
      ...constraints
    );
  }, [firestore, user?.uid, account.id, dateRange]);
  
  const { data: transactions, isLoading } = useCollection<TransactionWithId>(transactionsCollection);

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
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
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}
        {!isLoading && (!transactions || transactions.length === 0) && (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <FileText size={48} strokeWidth={1} className="text-muted-foreground mb-4" />
            <p className="font-semibold">Belum Ada Transaksi</p>
            <p className="text-sm text-muted-foreground">Tidak ada riwayat mutasi untuk akun ini atau rentang tanggal yang dipilih.</p>
          </div>
        )}
        {!isLoading && transactions && transactions.length > 0 && (
          <div className="space-y-4">
            {transactions.map((trx) => (
              <div key={trx.id} className="flex items-center justify-between p-3 bg-card-foreground/5 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    trx.type === 'credit' ? 'bg-green-500/10' : 'bg-red-500/10'
                  )}>
                    <Send size={18} strokeWidth={2} className={cn(
                      trx.type === 'credit' ? 'text-green-500 -rotate-45' : 'text-red-500 rotate-[135deg]'
                    )} />
                  </div>
                  <div className="truncate">
                    <p className="font-medium text-sm truncate">{trx.name}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(trx.date)}</p>
                  </div>
                </div>
                <p className={cn(
                  'font-semibold text-sm whitespace-nowrap',
                  trx.type === 'credit' ? 'text-green-500' : 'text-foreground'
                )}>
                  {trx.type === 'credit' ? '+' : '-'} Rp {trx.amount.toLocaleString('id-ID')}
                </p>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
      <div className="mt-4">
        <Button variant="outline" className="w-full" onClick={onDone}>Tutup</Button>
      </div>
    </div>
  );
}
