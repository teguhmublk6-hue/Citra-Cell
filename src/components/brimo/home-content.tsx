
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import QuickServices from './quick-services';
import BottomNav from './bottom-nav';
import AdminContent from './AdminContent';
import SettingsContent from './settings-content';
import { ArrowRightLeft, TrendingUp, TrendingDown, RotateCw } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import TransactionHistory from './TransactionHistory';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { cn } from '@/lib/utils';
import Autoplay from 'embla-carousel-autoplay';
import { ScrollArea } from '../ui/scroll-area';
import GlobalTransactionHistory from './GlobalTransactionHistory';
import TransferBalanceForm from './TransferBalanceForm';
import AddCapitalForm from './AddCapitalForm';
import WithdrawBalanceForm from './WithdrawBalanceForm';
import CustomerTransferForm from './CustomerTransferForm';
import CustomerTransferReview from './CustomerTransferReview';
import type { CustomerTransferFormValues, CustomerWithdrawalFormValues } from '@/lib/types';
import BookkeepingReport from './BookkeepingReport';
import AdminPasscodeDialog from './AdminPasscodeDialog';
import CustomerWithdrawalForm from './CustomerWithdrawalForm';
import CustomerWithdrawalReview from './CustomerWithdrawalReview';
import ProfitLossReport from './ProfitLossReport';


const iconMap: { [key: string]: React.ElementType } = {
  'Tunai': Wallet,
  'Bank': Building2,
  'PPOB': Zap,
  'E-Wallet': Smartphone,
  'Merchant': ShoppingBag,
  'default': Wallet,
};

export type ActiveTab = 'home' | 'mutasi' | 'admin' | 'settings';
type ActiveSheet = null | 'history' | 'transfer' | 'addCapital' | 'withdraw' | 'customerTransfer' | 'customerTransferReview' | 'customerWithdrawal' | 'customerWithdrawalReview';

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
  const [reviewData, setReviewData] = useState<CustomerTransferFormValues | CustomerWithdrawalFormValues | null>(null);
  const [isAdminAccessGranted, setIsAdminAccessGranted] = useState(false);
  const [isPasscodeDialogOpen, setIsPasscodeDialogOpen] = useState(false);
  const [isReportVisible, setIsReportVisible] = useState(false);
  const [isProfitLossReportVisible, setIsProfitLossReportVisible] = useState(false);
  const adminTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const hasAccess = sessionStorage.getItem('brimoAdminAccess') === 'true';
    setIsAdminAccessGranted(hasAccess);
  }, []);
  
  useEffect(() => {
    if (adminTimeoutRef.current) {
        clearTimeout(adminTimeoutRef.current);
    }

    if (isAdminAccessGranted && activeTab !== 'admin') {
        adminTimeoutRef.current = setTimeout(() => {
            setIsAdminAccessGranted(false);
            sessionStorage.removeItem('brimoAdminAccess');
        }, 10000); // 10 seconds
    }

    return () => {
        if (adminTimeoutRef.current) {
            clearTimeout(adminTimeoutRef.current);
        }
    };
  }, [activeTab, isAdminAccessGranted]);

  const firestore = useFirestore();

  const plugin = useRef(
    Autoplay({ delay: 2000, stopOnInteraction: true })
  );

  const kasAccountsCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'kasAccounts');
  }, [firestore]);

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

  const handleAccountClick = (account: KasAccountType) => {
    setSelectedAccount(account);
    setActiveSheet('history');
  }

  const handleMutationMenuClick = (sheet: ActiveSheet) => {
    const mutationMenuTrigger = document.getElementById('mutation-menu-trigger');
    if (mutationMenuTrigger) {
      mutationMenuTrigger.click(); 
    }
    
    setTimeout(() => {
      setActiveSheet(sheet);
    }, 150);
  }
  
  const handleQuickServiceClick = (service: 'customerTransfer' | 'withdraw') => {
    if (service === 'customerTransfer') {
      setActiveSheet('customerTransfer');
    } else if (service === 'withdraw') {
      setActiveSheet('customerWithdrawal');
    }
  }

  const handleReview = (data: CustomerTransferFormValues | CustomerWithdrawalFormValues) => {
    setReviewData(data);
    if ('destinationBank' in data) {
      setActiveSheet('customerTransferReview');
    } else {
      setActiveSheet('customerWithdrawalReview');
    }
  }

  const closeAllSheets = () => {
    setActiveSheet(null);
    setReviewData(null);
    revalidateData();
  }

  const handleReportClick = () => {
    setIsReportVisible(true);
  }

  const handleProfitLossReportClick = () => {
    setIsProfitLossReportVisible(true);
  }

  const handleTabChange = (tab: ActiveTab) => {
    if (tab === 'admin' && !isAdminAccessGranted) {
      setIsPasscodeDialogOpen(true);
    } else {
      setActiveTab(tab);
    }
  };

  const handlePasscodeSuccess = () => {
    sessionStorage.setItem('brimoAdminAccess', 'true');
    setIsAdminAccessGranted(true);
    setActiveTab('admin');
    setIsPasscodeDialogOpen(false);
  };

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

  if (isReportVisible) {
    return <BookkeepingReport onDone={() => setIsReportVisible(false)} />;
  }

  if (isProfitLossReportVisible) {
    return <ProfitLossReport onDone={() => setIsProfitLossReportVisible(false)} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <>
            <Header onSync={revalidateData} isSyncing={isAccountsLoading} onReportClick={handleReportClick} />
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
                    <div role="button" tabIndex={0} onClick={() => virtualTunaiAccount && handleAccountClick(virtualTunaiAccount)} className="w-full text-left cursor-pointer">
                      <BalanceCard 
                        balanceType="tunai" 
                      />
                    </div>
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
            <div className="flex flex-col gap-4 px-4 pb-28">
                <Sheet open={activeSheet === 'history'} onOpenChange={(isOpen) => !isOpen && setActiveSheet(null)}>
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

                <Sheet open={!!activeSheet && activeSheet !== 'history'} onOpenChange={(isOpen) => !isOpen && closeAllSheets()}>
                  <SheetContent side="bottom" className="max-w-md mx-auto rounded-t-2xl h-[90vh]">
                      <SheetHeader>
                          <SheetTitle>
                            {activeSheet === 'transfer' && 'Pindah Saldo'}
                            {activeSheet === 'addCapital' && 'Tambah Modal'}
                            {activeSheet === 'withdraw' && 'Tarik Saldo Pribadi'}
                            {activeSheet === 'customerTransfer' && 'Transfer Pelanggan'}
                            {activeSheet === 'customerTransferReview' && 'Review Transaksi Transfer'}
                            {activeSheet === 'customerWithdrawal' && 'Tarik Tunai Pelanggan'}
                            {activeSheet === 'customerWithdrawalReview' && 'Review Tarik Tunai'}
                          </SheetTitle>
                      </SheetHeader>
                      {activeSheet === 'transfer' && <TransferBalanceForm onDone={closeAllSheets} />}
                      {activeSheet === 'addCapital' && <AddCapitalForm onDone={closeAllSheets} />}
                      {activeSheet === 'withdraw' && <WithdrawBalanceForm onDone={closeAllSheets} />}
                      {activeSheet === 'customerTransfer' && <CustomerTransferForm onReview={handleReview} onDone={closeAllSheets} />}
                      {activeSheet === 'customerTransferReview' && reviewData && 'destinationBank' in reviewData && <CustomerTransferReview formData={reviewData} onConfirm={closeAllSheets} onBack={() => setActiveSheet('customerTransfer')} />}
                      {activeSheet === 'customerWithdrawal' && <CustomerWithdrawalForm onReview={handleReview} onDone={closeAllSheets} />}
                      {activeSheet === 'customerWithdrawalReview' && reviewData && 'customerBankSource' in reviewData && <CustomerWithdrawalReview formData={reviewData} onConfirm={closeAllSheets} onBack={() => setActiveSheet('customerWithdrawal')} />}
                  </SheetContent>
                </Sheet>

                <QuickServices onServiceClick={handleQuickServiceClick} />
            </div>
          </>
        );
      case 'settings':
        return <SettingsContent />;
      case 'mutasi':
        return <GlobalTransactionHistory />;
      case 'admin':
        return isAdminAccessGranted ? <AdminContent onProfitLossReportClick={handleProfitLossReportClick} /> : null;
      default:
        return <div className="px-4"><QuickServices onServiceClick={handleQuickServiceClick}/></div>;
    }
  };

  return (
    <>
      {renderContent()}
      <AdminPasscodeDialog
        isOpen={isPasscodeDialogOpen}
        onClose={() => setIsPasscodeDialogOpen(false)}
        onSuccess={handlePasscodeSuccess}
      />
      <BottomNav activeTab={activeTab} setActiveTab={handleTabChange}>
         <Sheet>
            <SheetTrigger asChild>
                <button id="mutation-menu-trigger" className="h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center -mt-4 shadow-lg shadow-primary/40 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                    <RotateCw size={28} />
                </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-w-md mx-auto rounded-t-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
                <SheetHeader className="mb-4">
                    <SheetTitle>Menu Mutasi</SheetTitle>
                </SheetHeader>
                <div className="grid grid-cols-3 gap-4 text-center">
                    <button onClick={() => handleMutationMenuClick('transfer')} className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-muted">
                        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center text-muted-foreground">
                            <ArrowRightLeft size={24} />
                        </div>
                        <span className="text-sm font-medium">Pindah Saldo</span>
                    </button>
                    <button onClick={() => handleMutationMenuClick('addCapital')} className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-muted">
                        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center text-muted-foreground">
                            <TrendingUp size={24} />
                        </div>
                        <span className="text-sm font-medium">Tambah Modal</span>
                    </button>
                    <button onClick={() => handleMutationMenuClick('withdraw')} className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-muted">
                        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center text-muted-foreground">
                            <TrendingDown size={24} />
                        </div>
                        <span className="text-sm font-medium">Tarik Pribadi</span>
                    </button>
                </div>
            </SheetContent>
         </Sheet>
      </BottomNav>
    </>
  );
}

    