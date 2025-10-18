
"use client";

import { FileText, ArrowDownLeft, ArrowUpRight, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import type { Transaction, KasAccount } from '@/lib/data';
import { useEffect, useState } from 'react';

type TransactionWithId = Transaction & { id: string };

export default function RecentTransactions() {
  const firestore = useFirestore();
  const [recentTransactions, setRecentTransactions] = useState<TransactionWithId[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const kasAccountsCollection = useMemoFirebase(() => {
    return collection(firestore, 'kasAccounts');
  }, [firestore]);

  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (kasAccounts === null) {
        // kasAccounts are still loading, wait.
        return
      }

      setIsLoading(true);
      let allTransactions: TransactionWithId[] = [];
      
      try {
        if (kasAccounts.length > 0) {
            for (const account of kasAccounts) {
                const transactionsRef = collection(firestore, 'kasAccounts', account.id, 'transactions');
                const q = query(transactionsRef, orderBy('date', 'desc'));
                const querySnapshot = await getDocs(q);
                querySnapshot.forEach((doc) => {
                    allTransactions.push({ ...(doc.data() as Transaction), id: doc.id });
                });
            }
        }

        allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        setRecentTransactions(allTransactions.slice(0, 4));
      } catch (error) {
        console.error("Error fetching transactions: ", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, [kasAccounts, firestore]);


  return (
    <Card className="bg-card/80 backdrop-blur-md border-border/20 shadow-lg">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-lg">Transaksi Terakhir</CardTitle>
          </div>
          <Button variant="link" className="text-primary pr-0">Lihat Semua</Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm py-8 text-center">Memuat transaksi...</p>
        ) : !recentTransactions || recentTransactions.length === 0 ? (
          <div className="py-8 text-center">
            <FileText size={48} strokeWidth={1} className="mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground text-sm">Belum ada transaksi</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recentTransactions.map((trx) => (
              <div key={trx.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${trx.type === 'credit' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    {trx.type === 'credit' ? (
                      <ArrowDownLeft size={18} strokeWidth={2} className="text-green-500" />
                    ) : (
                      <ArrowUpRight size={18} strokeWidth={2} className="text-red-500" />
                    )}
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
