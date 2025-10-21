
import { navItems } from '@/lib/data';
import type { ActiveTab } from './home-content';
import React from 'react';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  children?: React.ReactNode;
}

export default function BottomNav({ activeTab, setActiveTab, children }: BottomNavProps) {
  // Show only the 4 main tabs
  const orderedNavIds: ActiveTab[] = ['home', 'laporan', 'mutasi', 'accounts'];
  const orderedNavItems = orderedNavIds.map(id => navItems.find(item => item.id === id)).filter(Boolean) as (typeof navItems);

  const middleIndex = 2;

  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-card/90 backdrop-blur-lg border-t border-border/80 z-50">
      <div className="flex justify-around items-center h-[70px] px-2 pt-1">
        {orderedNavItems.slice(0, middleIndex).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
                `flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors duration-200 rounded-lg relative`,
                activeTab === tab.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
            aria-current={activeTab === tab.id}
            aria-label={tab.label}
          >
             {activeTab === tab.id && <div className="absolute top-0 h-1 w-8 bg-primary rounded-full" />}
            <tab.icon size={22} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
            <span className="text-xs font-medium">{tab.label}</span>
          </button>
        ))}

        <div className="w-16 flex justify-center -mt-8">
            {children}
        </div>

        {orderedNavItems.slice(middleIndex).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
                `flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors duration-200 rounded-lg relative`,
                activeTab === tab.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
            aria-current={activeTab === tab.id}
            aria-label={tab.label}
          >
             {activeTab === tab.id && <div className="absolute top-0 h-1 w-8 bg-primary rounded-full" />}
            <tab.icon size={22} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
            <span className="text-xs font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
