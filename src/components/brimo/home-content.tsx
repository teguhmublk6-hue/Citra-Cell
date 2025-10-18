
"use client";

import { useState } from 'react';
import QuickServices from './quick-services';
import RecentTransactions from './recent-transactions';
import BottomNav from './bottom-nav';
import PlaceholderContent from './placeholder-content';
import SettingsContent from './settings-content';
import { FileText, QrCode, Bell } from 'lucide-react';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { KasAccount as KasAccountType } from '@/lib/data';
import { Wallet, Building2, Zap, Smartphone, ShoppingBag, ChevronRight } from 'lucide-react';
import Header from './header';
import BalanceCard from './balance-card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const iconMap: { [key: string]: React.ElementType } = {
  'Tunai': Wallet,
  'Bank': Building2,
  'PPOB': Zap,
  'E-Wallet': Smartphone,
  'Merchant': ShoppingBag,
  'default': Wallet,
};

export type ActiveTab = 'home' | 'mutasi' | 'qris' | 'inbox' | 'settings';

export default function HomeContent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  
  const firestore = useFirestore();
  const { user } = useUser();

  const kasAccountsCollection = useMemoFirebase(() => {
    if (!user?.uid) return null; // Wait for user
    return collection(firestore, 'users', user.uid, 'kasAccounts');
  }, [firestore, user?.uid]);

  const { data: kasAccounts } = useCollection<KasAccountType>(kasAccountsCollection);

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <>
            <Header />
            <div className="p-4 -mt-16">
                <BalanceCard />
            </div>
            <div className="flex flex-col gap-4 px-4">
                <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
                  <AccordionItem value="item-1" className="border-none">
                    <AccordionTrigger className="p-3 bg-card/80 backdrop-blur-md rounded-2xl shadow-lg border border-border/20 flex items-center justify-between gap-4 data-[state=open]:rounded-b-none">
                      <p className="font-semibold text-sm">Kas Terintegrasi</p>
                    </AccordionTrigger>
                    <AccordionContent className="p-0">
                      <div className="flex flex-col gap-0 rounded-b-2xl overflow-hidden border border-t-0 border-border/20 shadow-lg">
                        {kasAccounts?.map((account) => {
                            const Icon = iconMap[account.label] || iconMap['default'];
                            return (
                            <div key={account.id} className="p-3 bg-card/80 backdrop-blur-md flex items-center justify-between gap-4 border-t border-border/10">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${account.color}`}>
                                        <Icon size={20} className="text-white" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm">{account.label}</p>
                                        <p className="text-muted-foreground text-xs">Rp{account.balance.toLocaleString('id-ID')}</p>
                                    </div>
                                </div>
                                <ChevronRight size={18} className="text-muted-foreground" />
                            </div>
                            );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
                <QuickServices />
                <RecentTransactions />
            </div>
          </>
        );
      case 'settings':
        return <SettingsContent />;
      case 'mutasi':
        return <PlaceholderContent icon={FileText} title="Halaman Mutasi" />;
      case 'qris':
        return <PlaceholderContent icon={QrCode} title="Halaman QRIS" />;
      case 'inbox':
        return <PlaceholderContent icon={Bell} title="Halaman Inbox" />;
      default:
        return <div className="px-4"><QuickServices /><RecentTransactions /></div>;
    }
  };

  return (
    <>
      {renderContent()}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </>
  );
}
