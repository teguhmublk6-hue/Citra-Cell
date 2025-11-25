
"use client";

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { KasAccount } from '@/lib/data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { iconMap } from './home-content';
import { Skeleton } from '../ui/skeleton';

interface AccountSelectionFormProps {
  onAccountSelect: (accountId: string) => void;
  onDone: () => void;
}

export default function AccountSelectionForm({ onAccountSelect, onDone }: AccountSelectionFormProps) {
  const firestore = useFirestore();
  const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
  const { data: kasAccounts, isLoading } = useCollection<KasAccount>(kasAccountsCollection);

  const groupedAccounts = useMemo(() => {
    if (!kasAccounts) return {};
    const sortedAccounts = [...kasAccounts].sort((a, b) => a.label.localeCompare(b.label));

    return sortedAccounts.reduce((acc, account) => {
        const type = account.type || 'Lainnya';
        if (!acc[type]) {
            acc[type] = [];
        }
        acc[type].push(account);
        return acc;
    }, {} as Record<string, KasAccount[]>);

  }, [kasAccounts]);

  const accountTypes = useMemo(() => {
      const order: (keyof typeof groupedAccounts)[] = ['Bank', 'E-Wallet', 'Merchant', 'PPOB', 'Tunai'];
      const dynamicTypes = Object.keys(groupedAccounts).filter(type => !order.includes(type));
      return order.concat(dynamicTypes.sort()).filter(type => groupedAccounts[type]);
  }, [groupedAccounts]);


  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 -mx-6 px-6">
        <div className="space-y-4 pt-4 pb-6">
            <p className="text-sm text-muted-foreground">Pilih akun yang saldonya ingin Anda sesuaikan.</p>
            {isLoading && (
                <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                </div>
            )}
            <div className="space-y-6">
            {accountTypes.map((type) => (
                <div key={type}>
                    <h2 className="text-base font-semibold text-muted-foreground mb-3">{type}</h2>
                    <div className="space-y-3">
                        {groupedAccounts[type]?.map((account) => {
                            const Icon = iconMap[account.type] || iconMap['default'];
                            return (
                                <button
                                    key={account.id}
                                    onClick={() => onAccountSelect(account.id)}
                                    className="w-full text-left p-3 bg-card rounded-lg border flex items-center gap-4 hover:bg-muted transition-colors"
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${account.color}`}>
                                        {account.iconUrl ? <img src={account.iconUrl} alt={account.label} className="h-6 w-6 object-cover" /> : <Icon size={20} className="text-white" />}
                                    </div>
                                    <div>
                                        <p className="font-semibold">{account.label}</p>
                                        <p className="text-muted-foreground text-sm">Rp{account.balance.toLocaleString('id-ID')}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
            </div>
        </div>
      </ScrollArea>
      <div className="flex gap-2 pt-4 pb-4 border-t -mx-6 px-6">
        <Button type="button" variant="outline" onClick={onDone} className="w-full">
          Batal
        </Button>
      </div>
    </div>
  );
}
