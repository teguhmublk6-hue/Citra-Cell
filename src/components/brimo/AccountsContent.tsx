
"use client";

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { KasAccount as KasAccountType } from '@/lib/data';
import { iconMap } from './home-content';
import { Button } from '../ui/button';
import { Banknote, ChevronRight, Settings, UserCog } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';

interface AccountsContentProps {
    onAccountClick: (account: KasAccountType) => void;
    onSettlementClick: (account: KasAccountType) => void;
    onAdminClick: () => void;
    onSettingsClick: () => void;
}

export default function AccountsContent({ onAccountClick, onSettlementClick, onAdminClick, onSettingsClick }: AccountsContentProps) {
    const firestore = useFirestore();
    const [showSettlementShortcut, setShowSettlementShortcut] = useState(false);

    useEffect(() => {
        const checkTime = () => {
            const currentHour = new Date().getHours();
            if (currentHour >= 21) {
                setShowSettlementShortcut(true);
            } else {
                setShowSettlementShortcut(false);
            }
        };
        checkTime();
        // Check every minute
        const interval = setInterval(checkTime, 60000);
        return () => clearInterval(interval);
    }, []);

    const kasAccountsCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'kasAccounts');
    }, [firestore]);

    const { data: kasAccounts } = useCollection<KasAccountType>(kasAccountsCollection);
    
    const groupedAccounts = useMemo(() => {
        if (!kasAccounts) return {};
        
        const groups = kasAccounts.reduce((acc, account) => {
            const type = account.type || 'Lainnya';
            if (!acc[type]) {
                acc[type] = [];
            }
            acc[type].push(account);
            return acc;
        }, {} as Record<string, KasAccountType[]>);

        // Handle the virtual tunai account
        if (groups['Tunai']) {
            const tunaiAccounts = groups['Tunai'];
            const totalBalance = tunaiAccounts.reduce((sum, acc) => sum + acc.balance, 0);
            const virtualTunaiAccount: KasAccountType = {
              id: 'tunai-gabungan',
              label: 'Semua Akun Tunai',
              type: 'Tunai',
              balance: totalBalance,
              minimumBalance: 0, // Not applicable for virtual account
              color: 'bg-green-500',
            };
            groups['Tunai'] = [virtualTunaiAccount];
        }

        return groups;

    }, [kasAccounts]);

    const accountTypes = useMemo(() => {
        const order: (keyof typeof groupedAccounts)[] = ['Bank', 'E-Wallet', 'Merchant', 'PPOB', 'Tunai'];
        const dynamicTypes = Object.keys(groupedAccounts).filter(type => !order.includes(type));
        
        const allSortedTypes = order.concat(dynamicTypes.sort()).filter(type => groupedAccounts[type]);
        
        return allSortedTypes;
    }, [groupedAccounts]);

    return (
        <div className="py-4 px-4 pb-28 h-full flex flex-col">
            <h1 className="text-2xl font-bold mb-4">Akun & Pengaturan</h1>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <button onClick={onAdminClick} className="flex flex-col items-center justify-center p-4 bg-card-foreground/5 rounded-xl w-full hover:bg-card-foreground/10 transition-colors gap-2">
                    <UserCog size={24} className="text-muted-foreground" />
                    <span className="font-medium text-sm">Menu Admin</span>
                </button>
                 <button onClick={onSettingsClick} className="flex flex-col items-center justify-center p-4 bg-card-foreground/5 rounded-xl w-full hover:bg-card-foreground/10 transition-colors gap-2">
                    <Settings size={24} className="text-muted-foreground" />
                    <span className="font-medium text-sm">Pengaturan</span>
                </button>
            </div>


            {kasAccounts && accountTypes.length > 0 ? (
                <div className="flex flex-col flex-1">
                    <div className="space-y-6">
                        {accountTypes.map((type) => (
                            <div key={type}>
                                <h2 className="text-base font-semibold text-muted-foreground mb-3">{type}</h2>
                                <div className="space-y-3">
                                {groupedAccounts[type]?.map((account) => {
                                    const Icon = iconMap[account.type] || iconMap['default'];
                                    const isVirtualTunai = account.id === 'tunai-gabungan';
                                    const canSettle = showSettlementShortcut && account.type === 'Merchant' && account.balance > 0;
                                    
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
                                                {canSettle && !isVirtualTunai ? (
                                                     <Button 
                                                        size="sm" 
                                                        variant="outline" 
                                                        onClick={() => onSettlementClick(account)} 
                                                        className="flex items-center gap-2 animate-ring-and-pulse ring-2 ring-yellow-500 text-yellow-500 hover:text-yellow-600"
                                                    >
                                                        <Banknote size={14} />
                                                        <span>Settlement</span>
                                                    </Button>
                                                ) : account.type === 'Merchant' && !isVirtualTunai ? (
                                                    <Button size="sm" variant="outline" onClick={() => onSettlementClick(account)} className="flex items-center gap-2">
                                                        <Banknote size={14} />
                                                        <span>Settlement</span>
                                                    </Button>
                                                ) : null}
                                                <button onClick={() => onAccountClick(account)} className="p-2">
                                                    <ChevronRight size={18} className="text-muted-foreground" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-muted-foreground">Tidak ada akun kas.</p>
                </div>
            )}
        </div>
    )
}
