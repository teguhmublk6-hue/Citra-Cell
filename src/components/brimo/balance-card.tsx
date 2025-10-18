"use client";

import { useState } from 'react';
import { Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { KasAccount } from '@/lib/data';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function BalanceCard() {
  const [showBalance, setShowBalance] = useState(true);
  const firestore = useFirestore();
  const { user } = useUser();

  const kasAccountsCollection = useMemoFirebase(() => {
    if (!user?.uid) return null; // Wait for user
    return collection(firestore, 'users', user.uid, 'kasAccounts');
  }, [firestore, user?.uid]);

  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

  const totalBalance = kasAccounts?.reduce((sum, acc) => sum + acc.balance, 0) ?? 0;
  const needsTopUp = kasAccounts?.some(acc => acc.balance < acc.minimumBalance) ?? false;

  return (
    <div className="bg-card/80 backdrop-blur-md rounded-2xl p-5 text-card-foreground shadow-lg border border-border/20">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">Total Saldo</p>
              {needsTopUp && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Ada saldo di bawah minimum!</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Semua Akun</p>
          </div>
        </div>
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
      <p className="text-3xl font-bold tracking-tight">
        {showBalance
          ? `Rp ${totalBalance.toLocaleString('id-ID')}`
          : 'Rp •••••••'}
      </p>
    </div>
  );
}
