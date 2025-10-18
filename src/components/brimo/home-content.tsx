
"use client";

import { useState, useEffect, useMemo } from 'react';
import QuickServices from './quick-services';
import RecentTransactions from './recent-transactions';
import BottomNav from './bottom-nav';
import PlaceholderContent from './placeholder-content';
import SettingsContent from './settings-content';
import { FileText, QrCode, Bell, ArrowRightLeft, Receipt } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import AddCapitalForm from './AddCapitalForm';
import TransferBalanceForm from './TransferBalanceForm';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { cn } from '@/lib/utils';

const iconMap: { [key: string]: React.ElementType } = {
  'Tunai': Wallet,
  'Bank': Building2,
  'PPOB': Zap,
  'E-Wallet': Smartphone,
  'Merchant': ShoppingBag,
  'default': Wallet,
};

export type ActiveTab = 'home' | 'mutasi' | 'qris' | 'inbox' | 'settings';
type ActiveSheet = null | 'addCapital' | 'transferBalance';

export default function HomeContent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>()
  const [currentSlide, setCurrentSlide] = useState(0)
  
  const firestore = useFirestore();
  const { user } = useUser();

  const kasAccountsCollection = useMemoFirebase(() => {
    if (!user?.uid) return null; // Wait for user
    return collection(firestore, 'users', user.uid, 'kasAccounts');
  }, [firestore, user?.uid]);

  const { data: kasAccounts } = useCollection<KasAccountType>(kasAccountsCollection);

  useEffect(() => {
    if (!carouselApi) return;

    setCurrentSlide(carouselApi.selectedScrollSnap());

    const onSelect = () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
    };

    carouselApi.on("select", onSelect);
    return () => carouselApi.off("select", onSelect);
  }, [carouselApi]);

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <>
            <Header />
            <div className="px-4 -mt-16">
              <Carousel setApi={setCarouselApi}>
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
                  <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
                    <AccordionItem value="item-1" className="border-none">
                      <div className="p-3 bg-card/80 backdrop-blur-md rounded-2xl shadow-lg border border-border/20 flex items-center justify-between gap-2 data-[state=open]:rounded-b-none">
                        <AccordionTrigger className="flex-1 p-0 justify-start">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm">Kas Terintegrasi</p>
                          </div>
                        </AccordionTrigger>

                        <div className="flex items-center">
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full">
                                <Receipt size={16} />
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full">
                                    <ArrowRightLeft size={16} />
                                </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => setActiveSheet('addCapital')}>
                                    Tambah Modal
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setActiveSheet('transferBalance')}>
                                    Pindah Saldo
                                </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                      </div>

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
                  <SheetContent side="bottom" className="max-w-md mx-auto rounded-t-2xl h-[90vh]">
                      <SheetHeader>
                          <SheetTitle>
                            {activeSheet === 'addCapital' && 'Tambah Modal Saldo Kas'}
                            {activeSheet === 'transferBalance' && 'Pindah Saldo Antar Kas'}
                          </SheetTitle>
                      </SheetHeader>
                      {activeSheet === 'addCapital' && <AddCapitalForm accounts={kasAccounts || []} onDone={() => setActiveSheet(null)} />}
                      {activeSheet === 'transferBalance' && <TransferBalanceForm accounts={kasAccounts || []} onDone={() => setActiveSheet(null)} />}
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
