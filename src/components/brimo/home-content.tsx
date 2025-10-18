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
import { Wallet, Building2, Zap, Smartphone, ShoppingBag } from 'lucide-react';
import Header from './header';
import BalanceCard from './balance-card';

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
                <div className="mt-4">
                    <div className="grid grid-cols-2 gap-4">
                    {kasAccounts?.map((account) => {
                        const Icon = iconMap[account.label] || iconMap['default'];
                        return (
                        <div key={account.id} className={`p-4 rounded-2xl shadow-md flex items-center gap-4 ${account.color}`}>
                            <div className="bg-white/20 p-2 rounded-full">
                                <Icon size={20} className="text-white" />
                            </div>
                            <div>
                            <p className="text-white font-semibold">{account.label}</p>
                            <p className="text-white/80 text-sm">Rp{account.balance.toLocaleString('id-ID')}</p>
                            </div>
                        </div>
                        );
                    })}
                    </div>
                </div>
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
