
"use client";

import { useState } from 'react';
import { Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { KasAccount } from '@/lib/data';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';

interface BalanceCardProps {
  balanceType: 'non-tunai' | 'tunai';
}

export default function BalanceCard({ balanceType }: BalanceCardProps) {
  const [showBalance, setShowBalance] = useState(true);
  const firestore = useFirestore();

  const kasAccountsCollection = useMemoFirebase(() => {
    return collection(firestore, 'kasAccounts');
  }, [firestore]);

  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

  const totalBalance = kasAccounts?.filter(acc => {
    if (balanceType === 'non-tunai') {
      return acc.type !== 'Tunai';
    }
    return acc.type === 'Tunai';
  }).reduce((sum, acc) => sum + acc.balance, 0) ?? 0;

  const accountsWithLowBalance = kasAccounts?.filter(acc => acc.balance < acc.minimumBalance) ?? [];
  const needsTopUp = accountsWithLowBalance.length > 0 && balanceType === 'non-tunai';
  
  const title = balanceType === 'non-tunai' ? 'Total Saldo' : 'Saldo Tunai';
  const subtitle = balanceType === 'non-tunai' ? 'Non-Tunai' : 'Uang Fisik';

  return (
    <div className="bg-card/80 backdrop-blur-md rounded-2xl p-5 text-card-foreground shadow-lg border border-border/20">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">{title}</p>
            </div>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
            {needsTopUp && (
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-9 h-9 rounded-full text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-500">
                            <AlertTriangle className="h-5 w-5 animate-ring-and-pulse" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                        <div className="grid gap-4">
                        <div className="space-y-2">
                            <h4 className="font-medium leading-none">Saldo di Bawah Minimum</h4>
                            <p className="text-sm text-muted-foreground">
                            Beberapa akun Anda perlu segera diisi ulang.
                            </p>
                        </div>
                        <div className="grid gap-2">
                            {accountsWithLowBalance.map((account) => (
                                <div key={account.id}>
                                    <div className="grid grid-cols-[1fr_auto] items-center gap-4">
                                        <div className='truncate'>
                                            <p className="font-semibold text-sm truncate">{account.label}</p>
                                            <p className="text-xs text-red-500">
                                                Rp{account.balance.toLocaleString('id-ID')} / min. Rp{account.minimumBalance.toLocaleString('id-ID')}
                                            </p>
                                        </div>
                                        <Button size="sm" variant="outline">Top Up</Button>
                                    </div>
                                    <Separator className="my-2" />
                                </div>
                            ))}
                        </div>
                        </div>
                    </PopoverContent>
                </Popover>
            )}
            <Button
            onClick={() => setShowBalance(!showBalance)}
            variant="ghost"
            size="icon"
            className="w-9 h-9 rounded-full"
            >
            {showBalance ? <Eye size={18} /> : <EyeOff size={18} />}
            <span className="sr-only">Toggle balance visibility</span>
            </Button>
        </div>
      </div>
      <p className="text-3xl font-bold tracking-tight">
        {showBalance
          ? `Rp ${totalBalance.toLocaleString('id-ID')}`
          : 'Rp •••••••'}
      </p>
    </div>
  );
}

    