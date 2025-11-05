
"use client";

import { useState, useEffect } from 'react';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';
import { startOfDay, endOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { KasAccount, Transaction } from '@/lib/data';

interface DailyReportProps {
  onDone: () => void;
}

const formatToRupiah = (value: number | string | undefined | null): string => {
  if (value === null || value === undefined || value === '') return 'Rp 0';
  const num = Number(String(value).replace(/[^0-9]/g, ''));
  if (isNaN(num)) return 'Rp 0';
  return `Rp ${num.toLocaleString('id-ID')}`;
};

export default function DailyReport({ onDone }: DailyReportProps) {
  const firestore = useFirestore();
  const [isLoading, setIsLoading] = useState(true);

  // SECTION A: Saldo Akun
  const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
  const { data: kasAccounts, isLoading: isLoadingAccounts } = useCollection<KasAccount>(kasAccountsCollection);
  
  const totalAccountBalance = kasAccounts?.reduce((sum, acc) => sum + acc.balance, 0) ?? 0;

  // Fetch other data points... (Will be implemented in next steps)

  useEffect(() => {
    if (!isLoadingAccounts) {
      setIsLoading(false);
    }
  }, [isLoadingAccounts]);

  const renderSectionA = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-primary">A. Saldo Akun</h2>
      {isLoadingAccounts ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {kasAccounts?.map(acc => (
            <div key={acc.id} className="flex justify-between">
              <span>{acc.label}</span>
              <span className="font-medium">{formatToRupiah(acc.balance)}</span>
            </div>
          ))}
          <div className="col-span-2 mt-2 pt-2 border-t font-bold flex justify-between text-base">
            <span>TOTAL</span>
            <span>{formatToRupiah(totalAccountBalance)}</span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-background">
      <ScrollArea className="flex-1 px-6">
        <div className="space-y-8 py-6">
          {renderSectionA()}
          {/* Other sections will be rendered here */}
        </div>
      </ScrollArea>
      <div className="p-4 border-t">
        <Button onClick={onDone} variant="outline" className="w-full">Tutup</Button>
      </div>
    </div>
  );
}
