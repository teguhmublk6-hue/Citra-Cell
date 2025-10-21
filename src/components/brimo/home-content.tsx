
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import QuickServices from './quick-services';
import BottomNav from './bottom-nav';
import AdminContent from './AdminContent';
import SettingsContent from './settings-content';
import { ArrowRightLeft, TrendingUp, TrendingDown, RotateCw, Banknote } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, writeBatch, getDocs } from 'firebase/firestore';
import type { KasAccount as KasAccountType } from '@/lib/data';
import { Wallet, Building2, Zap, Smartphone, ShoppingBag, ChevronRight, CreditCard, IdCard, GraduationCap, Lightbulb } from 'lucide-react';
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
import type { CustomerEmoneyTopUpFormValues, CustomerKJPWithdrawalFormValues, CustomerTopUpFormValues, CustomerTransferFormValues, CustomerVAPaymentFormValues, CustomerWithdrawalFormValues, EDCServiceFormValues, SettlementFormValues, MotivationFormValues, PPOBPulsaFormValues, PPOBTokenListrikFormValues } from '@/lib/types';
import BookkeepingReport from './BookkeepingReport';
import AdminPasscodeDialog from './AdminPasscodeDialog';
import CustomerWithdrawalForm from './CustomerWithdrawalForm';
import CustomerWithdrawalReview from './CustomerWithdrawalReview';
import ProfitLossReport from './ProfitLossReport';
import CustomerTopUpForm from './CustomerTopUpForm';
import CustomerTopUpReview from './CustomerTopUpReview';
import CustomerVAPaymentForm from './CustomerVAPaymentForm';
import CustomerVAPaymentReview from './CustomerVAPaymentReview';
import EDCServiceForm from './EDCServiceForm';
import CustomerEmoneyTopUpForm from './CustomerEmoneyTopUpForm';
import CustomerEmoneyTopUpReview from './CustomerEmoneyTopUpReview';
import SettlementForm from './SettlementForm';
import SettlementReview from './SettlementReview';
import { Button } from '../ui/button';
import CustomerKJPWithdrawalForm from './CustomerKJPWithdrawalForm';
import CustomerKJPWithdrawalReview from './CustomerKJPWithdrawalReview';
import MotivationCard from './MotivationCard';
import SetMotivationForm from './SetMotivationForm';
import KasManagement from './KasManagement';
import DeleteAllReportsDialog from './DeleteAllReportsDialog';
import { useToast } from '@/hooks/use-toast';
import PPOBPulsaForm from './PPOBPulsaForm';
import PPOBPulsaReview from './PPOBPulsaReview';
import PPOBPricingManager from './PPOBPricingManager';
import PPOBReport from './PPOBReport';
import PPOBTokenListrikForm from './PPOBTokenListrikForm';
import PPOBTokenListrikReview from './PPOBTokenListrikReview';
import RepeatTransactionDialog from './RepeatTransactionDialog';
import AccountsContent from './AccountsContent';


export const iconMap: { [key: string]: React.ElementType } = {
  'Tunai': Wallet,
  'Bank': Building2,
  'PPOB': Zap,
  'E-Wallet': Smartphone,
  'Merchant': ShoppingBag,
  'default': Wallet,
};

export type ActiveTab = 'home' | 'mutasi' | 'accounts' | 'admin' | 'settings';
type ActiveSheet = null | 'history' | 'transfer' | 'addCapital' | 'withdraw' | 'customerTransfer' | 'customerTransferReview' | 'customerWithdrawal' | 'customerWithdrawalReview' | 'customerTopUp' | 'customerTopUpReview' | 'customerVAPayment' | 'customerVAPaymentReview' | 'EDCService' | 'customerEmoneyTopUp' | 'customerEmoneyTopUpReview' | 'customerKJP' | 'customerKJPReview' | 'settlement' | 'settlementReview' | 'setMotivation' | 'manageKasAccounts' | 'managePPOBPricing' | 'ppobPulsa' | 'ppobPulsaReview' | 'ppobTokenListrik' | 'ppobTokenListrikReview';

interface HomeContentProps {
  revalidateData: () => void;
}

export default function HomeContent({ revalidateData }: HomeContentProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [isRepeatDialogOpen, setIsRepeatDialogOpen] = useState(false);
  const [lastCompletedSheet, setLastCompletedSheet] = useState<ActiveSheet>(null);
  const [selectedAccount, setSelectedAccount] = useState<KasAccountType | null>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>()
  const [currentSlide, setCurrentSlide] = useState(0)
  const [reviewData, setReviewData] = useState<CustomerTransferFormValues | CustomerWithdrawalFormValues | CustomerTopUpFormValues | CustomerVAPaymentFormValues | EDCServiceFormValues | CustomerEmoneyTopUpFormValues | SettlementFormValues | CustomerKJPWithdrawalFormValues | MotivationFormValues | PPOBPulsaFormValues | PPOBTokenListrikFormValues | null>(null);
  const [isAdminAccessGranted, setIsAdminAccessGranted] = useState(false);
  const [isPasscodeDialogOpen, setIsPasscodeDialogOpen] = useState(false);
  const [isBrilinkReportVisible, setIsBrilinkReportVisible] = useState(false);
  const [isPpobReportVisible, setIsPpobReportVisible] = useState(false);
  const [isProfitLossReportVisible, setIsProfitLossReportVisible] = useState(false);
  const [isDeleteReportsDialogOpen, setIsDeleteReportsDialogOpen] = useState(false);
  const adminTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

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
    Autoplay({ delay: 5000, stopOnInteraction: true })
  );

  const kasAccountsCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'kasAccounts');
  }, [firestore]);

  const { data: kasAccounts, isLoading: isAccountsLoading } = useCollection<KasAccountType>(kasAccountsCollection);
  
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
  
  const handleQuickServiceClick = (service: 'customerTransfer' | 'withdraw' | 'topUp' | 'customerVAPayment' | 'EDCService' | 'Emoney' | 'KJP' | 'Pulsa' | 'Token Listrik') => {
    if (service === 'customerTransfer') {
      setActiveSheet('customerTransfer');
    } else if (service === 'withdraw') {
      setActiveSheet('customerWithdrawal');
    } else if (service === 'topUp') {
      setActiveSheet('customerTopUp');
    } else if (service === 'customerVAPayment') {
      setActiveSheet('customerVAPayment');
    } else if (service === 'EDCService') {
      setActiveSheet('EDCService');
    } else if (service === 'Emoney') {
      setActiveSheet('customerEmoneyTopUp');
    } else if (service === 'KJP') {
      setActiveSheet('customerKJP');
    } else if (service === 'Pulsa') {
      setActiveSheet('ppobPulsa');
    } else if (service === 'Token Listrik') {
        setActiveSheet('ppobTokenListrik');
    }
  }

  const handleReview = (data: CustomerTransferFormValues | CustomerWithdrawalFormValues | CustomerTopUpFormValues | CustomerVAPaymentFormValues | EDCServiceFormValues | CustomerEmoneyTopUpFormValues | SettlementFormValues | CustomerKJPWithdrawalFormValues | PPOBPulsaFormValues | PPOBTokenListrikFormValues) => {
    setReviewData(data);
    if ('destinationBank' in data) {
        setActiveSheet('customerTransferReview');
    } else if ('customerBankSource' in data) {
        setActiveSheet('customerWithdrawalReview');
    } else if ('destinationEwallet' in data) {
        setActiveSheet('customerTopUpReview');
    } else if ('serviceProvider' in data) {
        setActiveSheet('customerVAPaymentReview');
    } else if ('destinationEmoney' in data) {
        setActiveSheet('customerEmoneyTopUpReview');
    } else if ('sourceMerchantAccountId' in data) {
        setActiveSheet('settlementReview');
    } else if ('phoneNumber' in data) {
        setActiveSheet('ppobPulsaReview');
    } else if ('costPrice' in data && 'customerName' in data && 'denomination' in data && !('phoneNumber' in data)) { // Token Listrik has these, but not phone
        setActiveSheet('ppobTokenListrikReview');
    } else if ('withdrawalAmount' in data && 'customerName' in data && !('customerBankSource' in data)) { // KJP has these, but not bank source
        setActiveSheet('customerKJPReview');
    }
  }
  
  const handleSettlementClick = (account: KasAccountType) => {
    setSelectedAccount(account);
    setActiveSheet('settlement');
  }

  const handleTransactionComplete = () => {
    revalidateData();
    const reviewSheet = activeSheet;
    let formSheet: ActiveSheet | null = null;
    
    if (reviewSheet === 'customerTransferReview') formSheet = 'customerTransfer';
    else if (reviewSheet === 'customerWithdrawalReview') formSheet = 'customerWithdrawal';
    else if (reviewSheet === 'customerTopUpReview') formSheet = 'customerTopUp';
    else if (reviewSheet === 'customerEmoneyTopUpReview') formSheet = 'customerEmoneyTopUp';
    else if (reviewSheet === 'customerVAPaymentReview') formSheet = 'customerVAPayment';
    else if (reviewSheet === 'ppobPulsaReview') formSheet = 'ppobPulsa';
    else if (reviewSheet === 'ppobTokenListrikReview') formSheet = 'ppobTokenListrik';
    else if (reviewSheet === 'customerKJPReview') formSheet = 'customerKJP';
    else if (reviewSheet === 'settlementReview') formSheet = 'settlement';
    
    if (formSheet) {
      setLastCompletedSheet(formSheet);
      setIsRepeatDialogOpen(true);
    } else {
      closeAllSheets();
    }
  }

  const handleRepeatNo = () => {
    setIsRepeatDialogOpen(false);
    setActiveSheet(null);
    setReviewData(null);
    setLastCompletedSheet(null);
  };

  const handleRepeatYes = () => {
    setIsRepeatDialogOpen(false);
    setReviewData(null);
    setActiveSheet(lastCompletedSheet); 
  };
  
  const closeAllSheets = () => {
    setActiveSheet(null);
    setReviewData(null);
    revalidateData();
  }

  const handleBrilinkReportClick = () => {
    setIsBrilinkReportVisible(true);
  }
  
  const handlePpobReportClick = () => {
    setIsPpobReportVisible(true);
  }

  const handleProfitLossReportClick = () => {
    setIsProfitLossReportVisible(true);
  }

  const handleSetMotivationClick = () => {
    setActiveSheet('setMotivation');
  }
  
  const handleManageKasAccountsClick = () => {
    setActiveSheet('manageKasAccounts');
  }
  
  const handleManagePPOBPricingClick = () => {
    setActiveSheet('managePPOBPricing');
  }

  const handleResetReportsClick = () => {
    setIsDeleteReportsDialogOpen(true);
  };

  const confirmResetReports = async () => {
    if (!firestore) {
        toast({ variant: "destructive", title: "Error", description: "Database tidak tersedia." });
        return;
    }
    toast({ title: "Memproses...", description: "Menghapus semua riwayat laporan." });

    const reportCollections = [
        "customerTransfers",
        "customerWithdrawals",
        "customerTopUps",
        "customerEmoneyTopUps",
        "customerVAPayments",
        "edcServices",
        "customerKJPWithdrawals",
        "settlements",
        "ppobTransactions"
    ];

    try {
        const batch = writeBatch(firestore);
        for (const collectionName of reportCollections) {
            const querySnapshot = await getDocs(collection(firestore, collectionName));
            querySnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
        }
        await batch.commit();
        toast({ title: "Sukses", description: "Semua riwayat laporan telah dihapus." });
    } catch (error) {
        console.error("Error resetting reports:", error);
        toast({ variant: "destructive", title: "Gagal", description: "Terjadi kesalahan saat menghapus laporan." });
    } finally {
        setIsDeleteReportsDialogOpen(false);
    }
  };

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

  if (isBrilinkReportVisible) {
    return <BookkeepingReport onDone={() => setIsBrilinkReportVisible(false)} />;
  }

  if (isPpobReportVisible) {
    return <PPOBReport onDone={() => setIsPpobReportVisible(false)} />;
  }

  if (isProfitLossReportVisible) {
    return <ProfitLossReport onDone={() => setIsProfitLossReportVisible(false)} />;
  }

  const isKJPReview = activeSheet === 'customerKJPReview' && reviewData && 'withdrawalAmount' in reviewData && !('customerBankSource' in reviewData);
  const isTokenReview = activeSheet === 'ppobTokenListrikReview' && reviewData && 'costPrice' in reviewData && 'customerName' in reviewData && !('phoneNumber' in reviewData);
  const isPulsaReview = activeSheet === 'ppobPulsaReview' && reviewData && 'phoneNumber' in reviewData;
  const isEmoneyReview = activeSheet === 'customerEmoneyTopUpReview' && reviewData && 'destinationEmoney' in reviewData;
  const isEwalletReview = activeSheet === 'customerTopUpReview' && reviewData && 'destinationEwallet' in reviewData;
  const isVAReview = activeSheet === 'customerVAPaymentReview' && reviewData && 'serviceProvider' in reviewData;
  const isWithdrawalReview = activeSheet === 'customerWithdrawalReview' && reviewData && 'customerBankSource' in reviewData;
  const isTransferReview = activeSheet === 'customerTransferReview' && reviewData && 'destinationBank' in reviewData;
  const isSettlementReview = activeSheet === 'settlementReview' && reviewData && 'sourceMerchantAccountId' in reviewData;

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <>
            <Header 
              onSync={revalidateData} 
              isSyncing={isAccountsLoading} 
              onBrilinkReportClick={handleBrilinkReportClick}
              onPpobReportClick={handlePpobReportClick}
            />
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
                     <BalanceCard 
                        balanceType="tunai" 
                      />
                  </CarouselItem>
                   <CarouselItem>
                    <MotivationCard />
                  </CarouselItem>
                </CarouselContent>
              </Carousel>
              <div className="flex items-center justify-center space-x-2 py-2">
                {[0, 1, 2].map((index) => (
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
                <QuickServices onServiceClick={handleQuickServiceClick} />
            </div>
          </>
        );
      case 'settings':
        return <SettingsContent />;
      case 'mutasi':
        return <GlobalTransactionHistory />;
      case 'accounts':
        return <AccountsContent onAccountClick={handleAccountClick} onSettlementClick={handleSettlementClick} />;
      case 'admin':
        return isAdminAccessGranted ? <AdminContent onProfitLossReportClick={handleProfitLossReportClick} onSetMotivationClick={handleSetMotivationClick} onManageKasAccountsClick={handleManageKasAccountsClick} onManagePPOBPricingClick={handleManagePPOBPricingClick} onResetReportsClick={handleResetReportsClick}/> : null;
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
      
      <RepeatTransactionDialog
        isOpen={isRepeatDialogOpen}
        onNo={handleRepeatNo}
        onYes={handleRepeatYes}
      />

      <DeleteAllReportsDialog 
        isOpen={isDeleteReportsDialogOpen}
        onClose={() => setIsDeleteReportsDialogOpen(false)}
        onConfirm={confirmResetReports}
      />

      <Sheet open={!!activeSheet} onOpenChange={(isOpen) => !isOpen && closeAllSheets()}>
        <SheetContent side="bottom" className="max-w-md mx-auto rounded-t-2xl h-[90vh]">
            <SheetHeader>
                <SheetTitle>
                  {activeSheet === 'history' && `Riwayat Mutasi: ${selectedAccount?.label}`}
                  {activeSheet === 'transfer' && 'Pindah Saldo'}
                  {activeSheet === 'addCapital' && 'Tambah Modal'}
                  {activeSheet === 'withdraw' && 'Tarik Saldo Pribadi'}
                  {activeSheet === 'customerTransfer' && 'Transfer Pelanggan'}
                  {activeSheet === 'customerTransferReview' && 'Review Transaksi Transfer'}
                  {activeSheet === 'customerWithdrawal' && 'Tarik Tunai Pelanggan'}
                  {activeSheet === 'customerWithdrawalReview' && 'Review Tarik Tunai'}
                  {activeSheet === 'customerTopUp' && 'Top Up E-Wallet'}
                  {activeSheet === 'customerTopUpReview' && 'Review Top Up E-Wallet'}
                  {activeSheet === 'customerEmoneyTopUp' && 'Top Up E-Money'}
                  {activeSheet === 'customerEmoneyTopUpReview' && 'Review Top Up E-Money'}
                  {activeSheet === 'customerVAPayment' && 'Pembayaran VA Pelanggan'}
                  {activeSheet === 'customerVAPaymentReview' && 'Review Pembayaran VA'}
                  {activeSheet === 'EDCService' && 'Layanan EDC'}
                  {activeSheet === 'customerKJP' && 'Tarik Tunai KJP'}
                  {activeSheet === 'customerKJPReview' && 'Review Tarik Tunai KJP'}
                  {activeSheet === 'settlement' && `Settlement: ${selectedAccount?.label}`}
                  {activeSheet === 'settlementReview' && 'Review Settlement'}
                  {activeSheet === 'setMotivation' && 'Atur Motivasi Harian'}
                  {activeSheet === 'manageKasAccounts' && 'Manajemen Akun Kas'}
                  {activeSheet === 'managePPOBPricing' && 'Kelola Harga Pulsa'}
                  {activeSheet === 'ppobPulsa' && 'Transaksi Pulsa'}
                  {activeSheet === 'ppobPulsaReview' && 'Review Transaksi Pulsa'}
                  {activeSheet === 'ppobTokenListrik' && 'Transaksi Token Listrik'}
                  {activeSheet === 'ppobTokenListrikReview' && 'Review Transaksi Token Listrik'}
                </SheetTitle>
            </SheetHeader>
            {activeSheet === 'history' && selectedAccount && <TransactionHistory account={selectedAccount} onDone={() => setActiveSheet(null)} />}
            {activeSheet === 'transfer' && <TransferBalanceForm onDone={closeAllSheets} />}
            {activeSheet === 'addCapital' && <AddCapitalForm onDone={closeAllSheets} />}
            {activeSheet === 'withdraw' && <WithdrawBalanceForm onDone={closeAllSheets} />}
            
            {activeSheet === 'customerTransfer' && <CustomerTransferForm onReview={handleReview} onDone={closeAllSheets} />}
            {isTransferReview && <CustomerTransferReview formData={reviewData as CustomerTransferFormValues} onConfirm={handleTransactionComplete} onBack={() => setActiveSheet('customerTransfer')} />}
            
            {activeSheet === 'customerWithdrawal' && <CustomerWithdrawalForm onReview={handleReview} onDone={closeAllSheets} />}
            {isWithdrawalReview && <CustomerWithdrawalReview formData={reviewData as CustomerWithdrawalFormValues} onConfirm={handleTransactionComplete} onBack={() => setActiveSheet('customerWithdrawal')} />}

            {activeSheet === 'customerTopUp' && <CustomerTopUpForm onReview={handleReview} onDone={closeAllSheets} />}
            {isEwalletReview && <CustomerTopUpReview formData={reviewData as CustomerTopUpFormValues} onConfirm={handleTransactionComplete} onBack={() => setActiveSheet('customerTopUp')} />}
            
            {activeSheet === 'customerEmoneyTopUp' && <CustomerEmoneyTopUpForm onReview={handleReview} onDone={closeAllSheets} />}
            {isEmoneyReview && <CustomerEmoneyTopUpReview formData={reviewData as CustomerEmoneyTopUpFormValues} onConfirm={handleTransactionComplete} onBack={() => setActiveSheet('customerEmoneyTopUp')} />}

            {activeSheet === 'customerVAPayment' && <CustomerVAPaymentForm onReview={handleReview} onDone={closeAllSheets} />}
            {isVAReview && <CustomerVAPaymentReview formData={reviewData as CustomerVAPaymentFormValues} onConfirm={handleTransactionComplete} onBack={() => setActiveSheet('customerVAPayment')} />}
            
            {activeSheet === 'EDCService' && <EDCServiceForm onDone={closeAllSheets} />}
            
            {activeSheet === 'settlement' && selectedAccount && <SettlementForm account={selectedAccount} onReview={handleReview} onDone={closeAllSheets} />}
            {isSettlementReview && <SettlementReview formData={reviewData as SettlementFormValues} onConfirm={handleTransactionComplete} onBack={() => setActiveSheet('settlement')} />}

            {activeSheet === 'customerKJP' && <CustomerKJPWithdrawalForm onReview={handleReview} onDone={closeAllSheets} />}
            {isKJPReview && <CustomerKJPWithdrawalReview formData={reviewData as CustomerKJPWithdrawalFormValues} onConfirm={handleTransactionComplete} onBack={() => setActiveSheet('customerKJP')} />}
            
            {activeSheet === 'setMotivation' && <SetMotivationForm onDone={closeAllSheets} />}
            {activeSheet === 'manageKasAccounts' && <KasManagement />}
            {activeSheet === 'managePPOBPricing' && <PPOBPricingManager onDone={closeAllSheets} />}
            
            {activeSheet === 'ppobPulsa' && <PPOBPulsaForm onReview={handleReview} onDone={closeAllSheets} />}
            {isPulsaReview && <PPOBPulsaReview formData={reviewData as PPOBPulsaFormValues} onConfirm={handleTransactionComplete} onBack={() => setActiveSheet('ppobPulsa')} />}

            {activeSheet === 'ppobTokenListrik' && <PPOBTokenListrikForm onReview={handleReview} onDone={closeAllSheets} />}
            {isTokenReview && <PPOBTokenListrikReview formData={reviewData as PPOBTokenListrikFormValues} onConfirm={handleTransactionComplete} onBack={() => setActiveSheet('ppobTokenListrik')} />}
        </SheetContent>
      </Sheet>

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
