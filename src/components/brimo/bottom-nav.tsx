
import { navItems } from '@/lib/data';
import type { ActiveTab } from './home-content';
import { Plus } from 'lucide-react';
import React from 'react';

interface BottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  children?: React.ReactNode;
}

export default function BottomNav({ activeTab, setActiveTab, children }: BottomNavProps) {
  const navItemsToShow = navItems.filter(item => item.id !== 'qris');
  const middleIndex = Math.floor(navItemsToShow.length / 2);

  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-card/90 backdrop-blur-lg border-t border-border/80 z-50">
      <div className="flex justify-around items-center h-[72px]">
        {navItemsToShow.slice(0, middleIndex).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors duration-200 rounded-lg relative ${
              activeTab === tab.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-current={activeTab === tab.id}
            aria-label={tab.label}
          >
             {activeTab === tab.id && <div className="absolute top-0 h-1 w-8 bg-primary rounded-full" />}
            <tab.icon size={24} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
            <span className="text-xs font-medium">
              {tab.label}
            </span>
          </button>
        ))}

        <div className="w-16 flex justify-center">
            {children}
        </div>

        {navItemsToShow.slice(middleIndex).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors duration-200 rounded-lg relative ${
              activeTab === tab.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-current={activeTab === tab.id}
            aria-label={tab.label}
          >
             {activeTab === tab.id && <div className="absolute top-0 h-1 w-8 bg-primary rounded-full" />}
            <tab.icon size={24} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
            <span className="text-xs font-medium">
              {tab.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

    