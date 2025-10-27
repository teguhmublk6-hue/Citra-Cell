
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import QuickServices from './quick-services';
import BottomNav from './bottom-nav';
import AdminContent from './AdminContent';
import SettingsContent from './settings-content';
import { ArrowRightLeft, TrendingUp, TrendingDown, RotateCw, Banknote, ArrowLeft } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, writeBatch, getDocs } from 'firebase/firestore';
import type { KasAccount as KasAccountType } from '@/lib/data';
import { Wallet, Building2, Zap, Smartphone, ShoppingBag, ChevronRight, CreditCard, IdCard, GraduationCap, Lightbulb, BookText, Home, FileText, HeartPulse } from 'lucide-react';
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
import type { CustomerEmoneyTopUpFormValues, CustomerKJPWithdrawalFormValues, CustomerTopUpFormValues, CustomerTransferFormValues, CustomerVAPaymentFormValues, CustomerWithdrawalFormValues, EDCServiceFormValues, SettlementFormValues, MotivationFormValues, PPOBPulsaFormValues, PPOBTokenListrikFormValues, PPOBPaketDataFormValues, PPOBPlnPostpaidFormValues, PPOBPdamFormValues, PPOBBpjsFormValues } from '@/lib/types';
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
import DeleteAllKasAccountsDialog from './DeleteAllKasAccountsDialog';
import DeleteAllReportsDialog from './DeleteAllReportsDialog';
import { useToast } from '@/hooks/use-toast';
import PPOBPulsaForm from './PPOBPulsaForm';
import PPOBPulsaReview from './PPOBPulsaReview';
import PPOBPaketDataForm from './PPOBPaketDataForm';
import PPOBPaketDataReview from './PPOBPaketDataReview';
import PPOBPricingManager from './PPOBPricingManager';
import PPOBReport from './PPOBReport';
import PPOBTokenListrikForm from './PPOBTokenListrikForm';
import PPOBTokenListrikReview from './PPOBTokenListrikReview';
import PPOBPlnPostpaidForm from './PPOBPlnPostpaidForm';
import PPOBPlnPostpaidReview from './PPOBPlnPostpaidReview';
import PPOBPdamForm from './PPOBPdamForm';
import PPOBPdamReview from './PPOBPdamReview';
import RepeatTransactionDialog from './RepeatTransactionDialog';
import AccountsContent from './AccountsContent';
import PendingSettlements from './PendingSettlements';
import OperationalCostReport from './OperationalCostReport';
import ReportsContent from './ReportsContent';
import CapitalAdditionReport from './CapitalAdditionReport';
import PPOBBpjsForm from './PPOBBpjsForm';
import PPOBBpjsReview from './PPOBBpjsReview';


export const iconMap: { [key: string]: React.ElementType } = {
  'Tunai': Wallet,
  'Bank': Building2,
  'PPOB': Zap,
  'E-Wallet': Smartphone,
  'Merchant': ShoppingBag,
  'default': Wallet,
};

export type ActiveTab = 'home' | 'laporan' | 'mutasi' | 'accounts' | 'admin';
type ActiveSheet = null | 'history' | 'transfer' | 'addCapital' | 'withdraw' | 'customerTransfer' | 'customerTransferReview' | 'customerWithdrawal' | 'customerWithdrawalReview' | 'customerTopUp' | 'customerTopUpReview' | 'customerVAPayment' | 'customerVAPaymentReview' | 'EDCService' | 'customerEmoneyTopUp' | 'customerEmoneyTopUpReview' | 'customerKJP' | 'customerKJPReview' | 'settlement' | 'settlementReview' | 'setMotivation' | 'manageKasAccounts' | 'managePPOBPricing' | 'ppobPulsa' | 'ppobPulsaReview' | 'ppobTokenListrik' | 'ppobTokenListrikReview' | 'ppobPaketData' | 'ppobPaketDataReview' | 'ppobPlnPostpaid' | 'ppobPlnPostpaidReview' | 'ppobPdam' | 'ppobPdamReview' | 'ppobBpjs' | 'ppobBpjsReview' | 'operationalCostReport' | 'settings' | 'deleteAllKasAccounts';
type FormSheet = 'customerTransfer' | 'customerWithdrawal' | 'customerTopUp' | 'customerVAPayment' | 'EDCService' | 'customerEmoneyTopUp' | 'customerKJP' | 'settlement' | 'ppobPulsa' | 'ppobTokenListrik' | 'ppobPaketData' | 'ppobPlnPostpaid' | 'ppobPdam' | 'ppobBpjs';


interface HomeContentProps {
  revalidateData: () => void;
  isSyncing: boolean;
}

export default function HomeContent({ revalidateData, isSyncing }: HomeContentProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [isRepeatDialogOpen, setIsRepeatDialogOpen] = useState(false);
  const [lastCompletedSheet, setLastCompletedSheet] = useState<FormSheet | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<KasAccountType | null>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>()
  const [currentSlide, setCurrentSlide] = useState(0)
  const [reviewData, setReviewData] = useState<CustomerTransferFormValues | CustomerWithdrawalFormValues | CustomerTopUpFormValues | CustomerVAPaymentFormValues | EDCServiceFormValues | CustomerEmoneyTopUpFormValues | SettlementFormValues | CustomerKJPWithdrawalFormValues | MotivationFormValues | PPOBPulsaFormValues | PPOBTokenListrikFormValues | PPOBPaketDataFormValues | PPOBPlnPostpaidFormValues | PPOBPdamFormValues | PPOBBpjsFormValues | null>(null);
  const [isAdminAccessGranted, setIsAdminAccessGranted] = useState(false);
  const [isPasscodeDialogOpen, setIsPasscodeDialogOpen] = useState(false);
  const [isBrilinkReportVisible, setIsBrilinkReportVisible] = useState(false);
  const [isPpobReportVisible, setIsPpobReportVisible] = useState(false);
  const [isProfitLossReportVisible, setIsProfitLossReportVisible] = useState(false);
  const [isOperationalCostReportVisible, setIsOperationalCostReportVisible] = useState(false);
  const [isCapitalAdditionReportVisible, setIsCapitalAdditionReportVisible] = useState(false);
  const [isDeleteReportsDialogOpen, setIsDeleteReportsDialogOpen] = useState(false);
  const [isDeleteAllAccountsDialogOpen, setIsDeleteAllAccountsDialogOpen] = useState(false);
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
        }, 30000); // 30 seconds
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
  
  const handleQuickServiceClick = (service: 'customerTransfer' | 'withdraw' | 'topUp' | 'customerVAPayment' | 'EDCService' | 'Emoney' | 'KJP' | 'Pulsa' | 'Token Listrik' | 'Data' | 'PLN' | 'PDAM' | 'BPJS') => {
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
    } else if (service === 'Data') {
        setActiveSheet('ppobPaketData');
    } else if (service === 'PLN') {
        setActiveSheet('ppobPlnPostpaid');
    } else if (service === 'PDAM') {
        setActiveSheet('ppobPdam');
    } else if (service === 'BPJS') {
        setActiveSheet('ppobBpjs');
    }
  }

  const handleReview = (data: CustomerTransferFormValues | CustomerWithdrawalFormValues | CustomerTopUpFormValues | CustomerVAPaymentFormValues | EDCServiceFormValues | CustomerEmoneyTopUpFormValues | SettlementFormValues | CustomerKJPWithdrawalFormValues | PPOBPulsaFormValues | PPOBTokenListrikFormValues | PPOBPaketDataFormValues | PPOBPlnPostpaidFormValues | PPOBPdamFormValues | PPOBBpjsFormValues) => {
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
    } else if ('phoneNumber' in data && 'packageName' in data) { // Paket Data
        setActiveSheet('ppobPaketDataReview');
    } else if ('phoneNumber' in data) { // Pulsa
        setActiveSheet('ppobPulsaReview');
    } else if (activeSheet === 'ppobPlnPostpaid') {
        setActiveSheet('ppobPlnPostpaidReview');
    } else if (activeSheet === 'ppobPdam') {
        setActiveSheet('ppobPdamReview');
    } else if (activeSheet === 'ppobBpjs') {
        setActiveSheet('ppobBpjsReview');
    } else if ('costPrice' in data && 'customerName' in data && !('phoneNumber' in data)) { // Token Listrik
        setActiveSheet('ppobTokenListrikReview');
    } else if ('withdrawalAmount' in data && 'customerName' in data && !('customerBankSource' in data)) { // KJP
        setActiveSheet('customerKJPReview');
    }
  }
  
  const handleSettlementClick = (account: KasAccountType) => {
    setSelectedAccount(account);
    setActiveSheet('settlement');
  }

  const handleTransactionComplete = () => {
    revalidateData();
    let formSheet: FormSheet | null = null;
    
    // Determine which form was just completed
    if (activeSheet === 'customerTransferReview') formSheet = 'customerTransfer';
    else if (activeSheet === 'customerWithdrawalReview') formSheet = 'customerWithdrawal';
    else if (activeSheet === 'customerTopUpReview') formSheet = 'customerTopUp';
    else if (activeSheet === 'customerEmoneyTopUpReview') formSheet = 'customerEmoneyTopUp';
    else if (activeSheet === 'customerVAPaymentReview') formSheet = 'customerVAPayment';
    else if (activeSheet === 'ppobPulsaReview') formSheet = 'ppobPulsa';
    else if (activeSheet === 'ppobTokenListrikReview') formSheet = 'ppobTokenListrik';
    else if (activeSheet === 'ppobPaketDataReview') formSheet = 'ppobPaketData';
    else if (activeSheet === 'ppobPlnPostpaidReview') formSheet = 'ppobPlnPostpaid';
    else if (activeSheet === 'ppobPdamReview') formSheet = 'ppobPdam';
    else if (activeSheet === 'ppobBpjsReview') formSheet = 'ppobBpjs';
    else if (activeSheet === 'customerKJPReview') formSheet = 'customerKJP';
    else if (activeSheet === 'settlementReview') formSheet = 'settlement';
    
    setLastCompletedSheet(formSheet);
    setIsRepeatDialogOpen(true);
  }

  const handleRepeatNo = () => {
    setIsRepeatDialogOpen(false);
    setLastCompletedSheet(null);
    closeAllSheets();
  };

  const handleRepeatYes = () => {
    setIsRepeatDialogOpen(false);
    // Close the sheet completely, then reopen the correct form.
    // This ensures the form component is unmounted and remounted with a fresh state.
    setActiveSheet(null); 
    setReviewData(null);
    setTimeout(() => {
        setActiveSheet(lastCompletedSheet);
    }, 100); // A small delay to ensure the sheet has time to close
  };
  
  const closeAllSheets = () => {
    setActiveSheet(null);
    setReviewData(null);
    revalidateData();
  }
  
  const handleProfitLossReportClick = () => {
    setIsProfitLossReportVisible(true);
  }

  const handleOperationalCostReportClick = () => {
    setIsOperationalCostReportVisible(true);
  }

  const handleCapitalAdditionReportClick = () => {
    setIsCapitalAdditionReportVisible(true);
  };

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
  
  const handleResetAllAccountsClick = () => {
    setActiveSheet('deleteAllKasAccounts');
  }

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
        "ppobTransactions",
        "ppobPlnPostpaid",
        "ppobPdam",
        "ppobBpjs",
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
  
  const confirmResetAllAccounts = async () => {
    if (!firestore || !kasAccounts) {
        toast({ variant: "destructive", title: "Error", description: "Database atau akun kas tidak tersedia." });
        return;
    }

    toast({ title: "Memproses...", description: "Mereset semua akun kas." });

    try {
        const batch = writeBatch(firestore);
        for (const account of kasAccounts) {
            // 1. Reset balance to 0
            const accountRef = collection(firestore, 'kasAccounts');
            batch.update(doc(accountRef, account.id), { balance: 0 });

            // 2. Delete all transactions in subcollection
            const transactionsRef = collection(firestore, 'kasAccounts', account.id, 'transactions');
            const transactionsSnapshot = await getDocs(transactionsRef);
            transactionsSnapshot.forEach(transactionDoc => {
                batch.delete(transactionDoc.ref);
            });
        }
        await batch.commit();
        toast({ title: "Sukses", description: "Semua akun kas telah direset ke saldo 0 dan riwayatnya dihapus." });
        revalidateData();
    } catch (error) {
        console.error("Error resetting all accounts:", error);
        toast({ variant: "destructive", title: "Gagal", description: "Terjadi kesalahan saat mereset akun." });
    } finally {
        setActiveSheet(null);
    }
};


  const handleAdminClick = () => {
     if (!isAdminAccessGranted) {
      setIsPasscodeDialogOpen(true);
    } else {
      setActiveTab('admin');
    }
  }

  const handleSettingsClick = () => {
    setActiveSheet('settings');
  }

  const handlePasscodeSuccess = () => {
    sessionStorage.setItem('brimoAdminAccess', 'true');
    setIsAdminAccessGranted(true);
    setActiveTab('admin');
    setIsPasscodeDialogOpen(false);
  };
  
    if (isBrilinkReportVisible) {
        return <BookkeepingReport onDone={() => setIsBrilinkReportVisible(false)} />;
    }
    
    if (isPpobReportVisible) {
        return <PPOBReport onDone={() => setIsPpobReportVisible(false)} />;
    }
  
    if (isProfitLossReportVisible) {
        return <ProfitLossReport onDone={() => setIsProfitLossReportVisible(false)} />;
    }

    if (isOperationalCostReportVisible) {
        return <OperationalCostReport onDone={() => setIsOperationalCostReportVisible(false)} />;
    }

    if (isCapitalAdditionReportVisible) {
        return <CapitalAdditionReport onDone={() => setIsCapitalAdditionReportVisible(false)} />;
    }

  const isKJPReview = activeSheet === 'customerKJPReview' && reviewData && 'withdrawalAmount' in reviewData && !('customerBankSource' in reviewData);
  const isTokenReview = activeSheet === 'ppobTokenListrikReview' && reviewData && 'costPrice' in reviewData && 'customerName' in reviewData && !('phoneNumber' in reviewData);
  const isPulsaReview = activeSheet === 'ppobPulsaReview' && reviewData && 'phoneNumber' in reviewData && !('packageName' in reviewData);
  const isPaketDataReview = activeSheet === 'ppobPaketDataReview' && reviewData && 'packageName' in reviewData;
  const isPlnPostpaidReview = activeSheet === 'ppobPlnPostpaidReview' && reviewData && 'billAmount' in reviewData && 'totalAmount' in reviewData && (reviewData as any).serviceName !== 'PDAM';
  const isPdamReview = activeSheet === 'ppobPdamReview' && reviewData && 'billAmount' in reviewData && 'totalAmount' in reviewData;
  const isBpjsReview = activeSheet === 'ppobBpjsReview' && reviewData && 'billAmount' in reviewData && 'totalAmount' in reviewData;
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
              isSyncing={isSyncing} 
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
                <PendingSettlements onSettlementClick={handleSettlementClick} />
            </div>
          </>
        );
      case 'laporan':
        return <ReportsContent 
                    onBrilinkReportClick={() => setIsBrilinkReportVisible(true)} 
                    onPpobReportClick={() => setIsPpobReportVisible(true)} 
                />;
      case 'mutasi':
        return <GlobalTransactionHistory />;
      case 'accounts':
        return <AccountsContent 
                    onAccountClick={handleAccountClick} 
                    onSettlementClick={handleSettlementClick}
                    onAdminClick={handleAdminClick}
                    onSettingsClick={handleSettingsClick}
                />;
      case 'admin':
        return (
          <div className="h-full flex flex-col">
            <header className="p-4 flex items-center gap-4 border-b">
                <Button variant="ghost" size="icon" onClick={() => setActiveTab('accounts')}>
                    <ArrowLeft />
                </Button>
                <h1 className="text-lg font-semibold">Menu Admin</h1>
            </header>
            <div className="flex-1 overflow-auto">
              <AdminContent 
                onProfitLossReportClick={handleProfitLossReportClick} 
                onOperationalCostReportClick={handleOperationalCostReportClick} 
                onCapitalAdditionReportClick={handleCapitalAdditionReportClick}
                onSetMotivationClick={handleSetMotivationClick} 
                onManageKasAccountsClick={handleManageKasAccountsClick} 
                onManagePPOBPricingClick={handleManagePPOBPricingClick} 
                onResetReportsClick={handleResetReportsClick}
                onResetAllAccountsClick={handleResetAllAccountsClick}
              />
            </div>
          </div>
        )
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
      
      <DeleteAllKasAccountsDialog 
        isOpen={activeSheet === 'deleteAllKasAccounts'} 
        onClose={closeAllSheets} 
        onConfirm={confirmResetAllAccounts} 
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
                  {activeSheet === 'managePPOBPricing' && 'Kelola Harga PPOB'}
                  {activeSheet === 'ppobPulsa' && 'Transaksi Pulsa'}
                  {activeSheet === 'ppobPulsaReview' && 'Review Transaksi Pulsa'}
                  {activeSheet === 'ppobTokenListrik' && 'Transaksi Token Listrik'}
                  {activeSheet === 'ppobTokenListrikReview' && 'Review Transaksi Token Listrik'}
                  {activeSheet === 'ppobPaketData' && 'Transaksi Paket Data'}
                  {activeSheet === 'ppobPaketDataReview' && 'Review Transaksi Paket Data'}
                  {activeSheet === 'ppobPlnPostpaid' && 'Bayar Tagihan PLN'}
                  {activeSheet === 'ppobPlnPostpaidReview' && 'Review Tagihan PLN'}
                  {activeSheet === 'ppobPdam' && 'Bayar Tagihan PDAM'}
                  {activeSheet === 'ppobPdamReview' && 'Review Tagihan PDAM'}
                  {activeSheet === 'ppobBpjs' && 'Bayar Tagihan BPJS'}
                  {activeSheet === 'ppobBpjsReview' && 'Review Tagihan BPJS'}
                  {activeSheet === 'operationalCostReport' && 'Laporan Biaya Operasional'}
                  {activeSheet === 'settings' && 'Pengaturan'}
                  {activeSheet === 'deleteAllKasAccounts' && 'Reset Semua Akun Kas'}
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
            {activeSheet === 'manageKasAccounts' && <KasManagement onResetAll={handleResetAllAccountsClick} />}
            {activeSheet === 'managePPOBPricing' && <PPOBPricingManager onDone={closeAllSheets} />}
            
            {activeSheet === 'ppobPulsa' && <PPOBPulsaForm onReview={handleReview} onDone={closeAllSheets} />}
            {isPulsaReview && <PPOBPulsaReview formData={reviewData as PPOBPulsaFormValues} onConfirm={handleTransactionComplete} onBack={() => setActiveSheet('ppobPulsa')} />}

            {activeSheet === 'ppobTokenListrik' && <PPOBTokenListrikForm onReview={handleReview} onDone={closeAllSheets} />}
            {isTokenReview && <PPOBTokenListrikReview formData={reviewData as PPOBTokenListrikFormValues} onConfirm={handleTransactionComplete} onBack={() => setActiveSheet('ppobTokenListrik')} />}
            
            {activeSheet === 'ppobPaketData' && <PPOBPaketDataForm onReview={handleReview} onDone={closeAllSheets} />}
            {isPaketDataReview && <PPOBPaketDataReview formData={reviewData as PPOBPaketDataFormValues} onConfirm={handleTransactionComplete} onBack={() => setActiveSheet('ppobPaketData')} />}
            
            {activeSheet === 'ppobPlnPostpaid' && <PPOBPlnPostpaidForm onReview={handleReview} onDone={closeAllSheets} />}
            {isPlnPostpaidReview && <PPOBPlnPostpaidReview formData={reviewData as PPOBPlnPostpaidFormValues} onConfirm={handleTransactionComplete} onBack={() => setActiveSheet('ppobPlnPostpaid')} />}

            {activeSheet === 'ppobPdam' && <PPOBPdamForm onReview={handleReview} onDone={closeAllSheets} />}
            {isPdamReview && <PPOBPdamReview formData={reviewData as PPOBPdamFormValues} onConfirm={handleTransactionComplete} onBack={() => setActiveSheet('ppobPdam')} />}
            
            {activeSheet === 'ppobBpjs' && <PPOBBpjsForm onReview={handleReview} onDone={closeAllSheets} />}
            {isBpjsReview && <PPOBBpjsReview formData={reviewData as PPOBBpjsFormValues} onConfirm={handleTransactionComplete} onBack={() => setActiveSheet('ppobBpjs')} />}

            {activeSheet === 'operationalCostReport' && <OperationalCostReport onDone={closeAllSheets} />}
            {activeSheet === 'settings' && <SettingsContent />}
        </SheetContent>
      </Sheet>

      {activeTab !== 'admin' && !isProfitLossReportVisible && !isOperationalCostReportVisible && !isCapitalAdditionReportVisible && (
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab}>
          <Sheet>
              <SheetTrigger asChild>
                  <button id="mutation-menu-trigger" className="h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/40 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
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
      )}
    </>
  );
}
