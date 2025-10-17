"use client";

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { kasAccounts } from '@/lib/data';
import { Button } from '@/components/ui/button';

export default function BalanceCard() {
  const [showBalance, setShowBalance] = useState(true);

  const totalBalance = kasAccounts.reduce((sum, acc) => sum + acc.balance, 0);

  return (
    <div className="bg-card/80 backdrop-blur-md rounded-2xl p-5 text-card-foreground shadow-lg border border-border/20">
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Total Saldo</p>
          <p className="text-xs text-muted-foreground">Semua Akun</p>
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
