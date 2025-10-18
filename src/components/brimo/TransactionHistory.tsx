
"use client";

import { useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
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

interface TransactionHistoryProps {
  account: KasAccount;
  onDone: () => void;
}

type TransactionWithId = Transaction & { id: string };

const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const num = Number(String(value).replace(/[^0-9]/g, ''));
    if (isNaN(num)) return 'Rp 0';
    return `Rp ${num.toLocaleString('id-ID')}`;
};

export default function TransactionHistory({ account, onDone }: TransactionHistoryProps) {
  const firestore = useFirestore();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const transactionsCollection = useMemoFirebase(() => {
    const constraints = [orderBy('date', 'desc')];
    if (dateRange?.from) {
      constraints.push(where('date', '>=', startOfDay(dateRange.from).toISOString()));
    }
    if (dateRange?.to) {
      constraints.push(where('date', '<=', endOfDay(dateRange.to).toISOString()));
    }
    
    return query(
      collection(firestore, 'kasAccounts', account.id, 'transactions'),
      ...constraints
    );
  }, [firestore, account.id, dateRange]);
  
  const { data: transactions, isLoading } = useCollection<TransactionWithId>(transactionsCollection);

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
            {transactions.map((trx) => (
              <div key={trx.id} className="py-4">
                <div className="flex justify-between items-center mb-2">
                    <p className="font-semibold text-sm">{trx.name}</p>
                    <p className={cn(
                        'font-bold text-sm',
                        trx.type === 'credit' ? 'text-green-500' : 'text-foreground'
                    )}>
                        {trx.type === 'credit' ? '+' : '-'} {formatToRupiah(trx.amount)}
                    </p>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{formatDateTime(trx.date)}</p>
                
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
                 <Separator className="mt-4" />
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
