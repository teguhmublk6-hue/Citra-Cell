"use client";

import { FileText, Send, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collectionGroup, query, orderBy, limit } from 'firebase/firestore';
import type { Transaction } from '@/lib/data';

export default function RecentTransactions() {
  const firestore = useFirestore();
  const { user } = useUser();

  const transactionsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collectionGroup(firestore, 'transactions'),
      orderBy('date', 'desc'),
      limit(4)
    );
  }, [firestore, user]);

  const { data: recentTransactions, isLoading } = useCollection<Transaction>(transactionsQuery);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-lg">Transaksi Terakhir</CardTitle>
          </div>
          <Button variant="link" className="text-primary pr-0">Lihat Semua</Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-muted-foreground text-sm">Memuat transaksi...</p>}
        {!isLoading && (!recentTransactions || recentTransactions.length === 0) ? (
          <div className="py-8 text-center">
            <FileText size={48} strokeWidth={1} className="mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground text-sm">Belum ada transaksi</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recentTransactions?.map((trx) => (
              <div key={trx.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${trx.type === 'credit' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    <Send size={18} strokeWidth={2} className={trx.type === 'credit' ? 'text-green-500 -rotate-45' : 'text-red-500 rotate-[135deg]'} />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{trx.name}</p>
                    <p className="text-xs text-muted-foreground">{trx.account} • {new Date(trx.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 cursor-pointer">
                  <p className={`font-semibold text-sm ${trx.type === 'credit' ? 'text-green-500' : ''}`}>
                    {trx.type === 'credit' ? '+' : '-'} Rp {trx.amount.toLocaleString('id-ID')}
                  </p>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
