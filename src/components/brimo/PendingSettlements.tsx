
"use client";

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { KasAccount as KasAccountType } from '@/lib/data';
import { iconMap } from './home-content';
import { Button } from '../ui/button';
import { Banknote, ChevronRight, ShoppingBag } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface PendingSettlementsProps {
    onSettlementClick: (account: KasAccountType) => void;
}

export default function PendingSettlements({ onSettlementClick }: PendingSettlementsProps) {
    const firestore = useFirestore();
    const [showSettlementShortcut, setShowSettlementShortcut] = useState(false);

    useEffect(() => {
        const checkTime = () => {
            const currentHour = new Date().getHours();
            if (currentHour >= 23) {
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
    
    const merchantAccountsToSettle = useMemo(() => {
        if (!kasAccounts) return [];
        return kasAccounts.filter(acc => acc.type === 'Merchant' && acc.balance > 0);
    }, [kasAccounts]);

    if (!showSettlementShortcut || merchantAccountsToSettle.length === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <ShoppingBag size={20} className="text-primary"/>
                    Perlu Settlement
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {merchantAccountsToSettle.map((account) => {
                    const Icon = iconMap[account.type] || iconMap['default'];
                    
                    return (
                        <div key={account.id} className="w-full text-left p-3 bg-background rounded-lg border flex items-center justify-between gap-4">
                            <div className="flex-1 flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${account.color}`}>
                                    {account.iconUrl ? <img src={account.iconUrl} alt={account.label} className="h-6 w-6 object-cover" /> : <Icon size={20} className="text-white" />}
                                </div>
                                <div>
                                    <p className="font-semibold text-sm">{account.label}</p>
                                    <p className="text-muted-foreground text-xs">Rp{account.balance.toLocaleString('id-ID')}</p>
                                </div>
                            </div>
                            <div className="flex items-center">
                                 <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => onSettlementClick(account)} 
                                    className="flex items-center gap-2 animate-ring-and-pulse ring-2 ring-yellow-500 text-yellow-500 hover:text-yellow-600"
                                >
                                    <Banknote size={14} />
                                    <span>Settlement</span>
                                </Button>
                                <button onClick={() => onSettlementClick(account)} className="p-2 -mr-2">
                                    <ChevronRight size={18} className="text-muted-foreground" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    )
}
