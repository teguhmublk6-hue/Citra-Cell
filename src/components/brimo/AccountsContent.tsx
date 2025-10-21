
"use client";

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { KasAccount as KasAccountType } from '@/lib/data';
import { iconMap } from './home-content';
import { Button } from '../ui/button';
import { Banknote, ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import { ScrollArea } from '../ui/scroll-area';

interface AccountsContentProps {
    onAccountClick: (account: KasAccountType) => void;
    onSettlementClick: (account: KasAccountType) => void;
}

export default function AccountsContent({ onAccountClick, onSettlementClick }: AccountsContentProps) {
    const firestore = useFirestore();

    const kasAccountsCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'kasAccounts');
    }, [firestore]);

    const { data: kasAccounts } = useCollection<KasAccountType>(kasAccountsCollection);
    
    const virtualTunaiAccount = useMemo<KasAccountType | null>(() => {
        if (!kasAccounts) return null;
        const tunaiAccounts = kasAccounts.filter(acc => acc.type === 'Tunai');
        const totalBalance = tunaiAccounts.reduce((sum, acc) => sum + acc.balance, 0);
        return {
          id: 'tunai-gabungan',
          label: 'Semua Akun Tunai',
          type: 'Tunai',
          balance: totalBalance,
          minimumBalance: 0,
          color: 'bg-green-500',
        };
      }, [kasAccounts]);

    return (
        <div className="py-4 px-4 pb-28">
            <h1 className="text-2xl font-bold mb-4">Saldo Akun</h1>
            <ScrollArea className="h-[calc(100vh-150px)]">
                <div className="space-y-3">
                    {kasAccounts?.filter(account => account.type !== 'Tunai').map((account) => {
                        const Icon = iconMap[account.type] || iconMap['default'];
                        return (
                        <div key={account.id} className="w-full text-left p-3 bg-card rounded-lg border flex items-center justify-between gap-4">
                            <button onClick={() => onAccountClick(account)} className="flex-1 flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${account.color}`}>
                                    {account.iconUrl ? <img src={account.iconUrl} alt={account.label} className="h-6 w-6 object-cover" /> : <Icon size={20} className="text-white" />}
                                </div>
                                <div>
                                    <p className="font-semibold text-sm">{account.label}</p>
                                    <p className="text-muted-foreground text-xs">Rp{account.balance.toLocaleString('id-ID')}</p>
                                </div>
                            </button>
                            <div className="flex items-center">
                                {account.type === 'Merchant' && (
                                <Button size="sm" variant="outline" onClick={() => onSettlementClick(account)} className="flex items-center gap-2">
                                    <Banknote size={14} />
                                    <span>Settlement</span>
                                </Button>
                                )}
                                <button onClick={() => onAccountClick(account)} className="p-2">
                                <ChevronRight size={18} className="text-muted-foreground" />
                                </button>
                            </div>
                        </div>
                        );
                    })}
                     {virtualTunaiAccount && (
                        <div key={virtualTunaiAccount.id} onClick={() => onAccountClick(virtualTunaiAccount)} className="w-full text-left p-3 bg-card rounded-lg border flex items-center justify-between gap-4 cursor-pointer">
                            <div className="flex-1 flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${virtualTunaiAccount.color}`}>
                                    <iconMap.Tunai size={20} className="text-white" />
                                </div>
                                <div>
                                    <p className="font-semibold text-sm">{virtualTunaiAccount.label}</p>
                                    <p className="text-muted-foreground text-xs">Rp{virtualTunaiAccount.balance.toLocaleString('id-ID')}</p>
                                </div>
                            </div>
                            <div className="flex items-center">
                                <ChevronRight size={18} className="text-muted-foreground" />
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}
