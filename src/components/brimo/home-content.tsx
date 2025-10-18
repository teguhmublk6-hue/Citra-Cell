
"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import QuickServices from './quick-services';
import RecentTransactions from './recent-transactions';
import BottomNav from './bottom-nav';
import PlaceholderContent from './placeholder-content';
import SettingsContent from './settings-content';
import { FileText, QrCode, Bell, Receipt, Plus, ArrowRightLeft } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs, orderBy, CollectionReference, DocumentData } from 'firebase/firestore';
import type { KasAccount as KasAccountType, Transaction } from '@/lib/data';
import { Wallet, Building2, Zap, Smartphone, ShoppingBag, ChevronRight } from 'lucide-react';
import Header from './header';
import BalanceCard from './balance-card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import TransactionHistory from './TransactionHistory';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { cn } from '@/lib/utils';
import Autoplay from 'embla-carousel-autoplay';
import { ScrollArea } from '../ui/scroll-area';
import GlobalTransactionHistory from './GlobalTransactionHistory';


const iconMap: { [key: string]: React.ElementType } = {
  'Tunai': Wallet,
  'Bank': Building2,
  'PPOB': Zap,
  'E-Wallet': Smartphone,
  'Merchant': ShoppingBag,
  'default': Wallet,
};

export type ActiveTab = 'home' | 'mutasi' | 'qris' | 'inbox' | 'settings';
type ActiveSheet = null | 'history';

interface HomeContentProps {
  revalidateData: () => void;
  isAccountsLoading: boolean;
}

export default function HomeContent({ revalidateData, isAccountsLoading }: HomeContentProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [selectedAccount, setSelectedAccount] = useState<KasAccountType | null>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>()
  const [currentSlide, setCurrentSlide] = useState(0)
  
  const firestore = useFirestore();

  const plugin = useRef(
    Autoplay({ delay: 2000, stopOnInteraction: true })
  );

  const kasAccountsCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'kasAccounts');
  }, [firestore]);

  const { data: kasAccounts } = useCollection<KasAccountType>(kasAccountsCollection);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (kasAccounts === null) return;
      
      let allTransactions: Transaction[] = [];
      if (kasAccounts.length > 0) {
        for (const account of kasAccounts) {
          const transactionsRef = collection(firestore, 'kasAccounts', account.id, 'transactions');
          const q = query(transactionsRef, orderBy('date', 'desc'));
          const querySnapshot = await getDocs(q);
          querySnapshot.forEach((doc) => {
            allTransactions.push({ ...(doc.data() as Transaction), id: doc.id });
          });
        }
      }
      allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(allTransactions);
    };

    fetchTransactions();
  }, [firestore, kasAccounts]);


  useEffect(() => {
    if (!carouselApi) return;

    setCurrentSlide(carouselApi.selectedScrollSnap());

    const onSelect = () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
    };

    carouselApi.on("select", onSelect);
    return () => carouselApi.off("select", onSelect);
  }, [carouselApi]);

  const handleAccountClick = (account: KasAccountType) => {
    setSelectedAccount(account);
    setActiveSheet('history');
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <>
            <Header onSync={revalidateData} isSyncing={isAccountsLoading} />
            <div className="px-4 -mt-16">
              <Carousel 
                setApi={setCarouselApi}
                plugins={[plugin.current]}
                onMouseEnter={plugin.current.stop}
                onMouseLeave={plugin.current.reset}
              >
                <CarouselContent>
                  <CarouselItem>
                    <BalanceCard balanceType="non-tunai" />
                  </CarouselItem>
                  <CarouselItem>
                    <BalanceCard balanceType="tunai" />
                  </CarouselItem>
                </CarouselContent>
              </Carousel>
              <div className="flex items-center justify-center space-x-2 py-2">
                {[0, 1].map((index) => (
                  <button
                    key={index}
                    onClick={() => carouselApi?.scrollTo(index)}
                    className={cn(
                      "h-2 w-2 rounded-full transition-colors",
                      index === currentSlide ? "bg-primary" : "bg-muted"
                    )}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
            </div>
            </div>
            <div className="flex flex-col gap-4 px-4">
                <Sheet open={!!activeSheet} onOpenChange={(isOpen) => !isOpen && setActiveSheet(null)}>
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1" className="border-none">
                      <div className="p-3 bg-card/80 backdrop-blur-md rounded-2xl shadow-lg border border-border/20 flex items-center justify-between gap-2 data-[state=open]:rounded-b-none">
                        <AccordionTrigger className="flex-1 p-0 justify-start">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm">Saldo akun</p>
                          </div>
                        </AccordionTrigger>
                      </div>

                      <AccordionContent className="p-0">
                        <ScrollArea className="h-[280px]">
                            <div className="flex flex-col gap-0 rounded-b-2xl overflow-hidden border border-t-0 border-border/20 shadow-lg">
                            {kasAccounts?.filter(account => account.type !== 'Tunai').map((account) => {
                                const Icon = iconMap[account.type] || iconMap['default'];
                                return (
                                <button key={account.id} onClick={() => handleAccountClick(account)} className="w-full text-left p-3 bg-card/80 backdrop-blur-md flex items-center justify-between gap-4 border-t border-border/10 hover:bg-muted/50 transition-colors">
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
                                </button>
                                );
                            })}
                            </div>
                        </ScrollArea>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  <SheetContent side="bottom" className="max-w-md mx-auto rounded-t-2xl h-[90vh]">
                      <SheetHeader>
                          <SheetTitle>
                            {activeSheet === 'history' && `Riwayat Mutasi: ${selectedAccount?.label}`}
                          </SheetTitle>
                      </SheetHeader>
                      {activeSheet === 'history' && selectedAccount && <TransactionHistory account={selectedAccount} onDone={() => setActiveSheet(null)} />}
                  </SheetContent>
                </Sheet>
                <QuickServices />
                <RecentTransactions />
            </div>
          </>
        );
      case 'settings':
        return <SettingsContent />;
      case 'mutasi':
        return <GlobalTransactionHistory />;
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
