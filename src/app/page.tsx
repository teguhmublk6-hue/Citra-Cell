"use client";

import { useState } from 'react';
import { FileText, Bell, Settings, QrCode } from 'lucide-react';

import Header from '@/components/brimo/header';
import BalanceCard from '@/components/brimo/balance-card';
import HomeContent from '@/components/brimo/home-content';
import SettingsContent from '@/components/brimo/settings-content';
import BottomNav from '@/components/brimo/bottom-nav';
import PlaceholderContent from '@/components/brimo/placeholder-content';

export type ActiveTab = 'home' | 'mutasi' | 'qris' | 'inbox' | 'settings';

export default function BrimoUI() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <HomeContent />;
      case 'settings':
        return <SettingsContent />;
      case 'mutasi':
        return <PlaceholderContent icon={FileText} title="Halaman Mutasi" />;
      case 'qris':
        return <PlaceholderContent icon={QrCode} title="Halaman QRIS" />;
      case 'inbox':
        return <PlaceholderContent icon={Bell} title="Halaman Inbox" />;
      default:
        return <HomeContent />;
    }
  };

  return (
    <div className="bg-background min-h-screen max-w-md mx-auto font-body text-foreground relative">
      <Header />
      <main className="pb-28">
        <div className="p-4 -mt-16">
          <BalanceCard />
        </div>
        {renderContent()}
      </main>
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
