
"use client";

import { useState, useEffect } from 'react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { KasAccount, Transaction } from '@/lib/data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Send, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TransactionHistoryProps {
  account: KasAccount;
  onDone: () => void;
}

type TransactionWithId = Transaction & { id: string };

export default function TransactionHistory({ account, onDone }: TransactionHistoryProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  
  const transactionsCollection = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(
      collection(firestore, 'users', user.uid, 'kasAccounts', account.id, 'transactions'),
      orderBy('date', 'desc')
    );
  }, [firestore, user?.uid, account.id]);
  
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
            <p className="text-sm text-muted-foreground">Tidak ada riwayat mutasi untuk akun ini.</p>
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
