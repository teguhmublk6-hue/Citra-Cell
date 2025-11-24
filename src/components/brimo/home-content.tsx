

"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import QuickServices from './quick-services';
import BottomNav from './bottom-nav';
import AdminContent from './AdminContent';
import SettingsContent from './settings-content';
import { ArrowRightLeft, TrendingUp, TrendingDown, RotateCw, Banknote, ArrowLeft } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, writeBatch, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import type { KasAccount as KasAccountType, CurrentShiftStatus, DailyReport as DailyReportType, Transaction } from '@/lib/data';
import { Wallet, Building2, Zap, Smartphone, ShoppingBag, ChevronRight, CreditCard, IdCard, GraduationCap, Lightbulb, BookText, Home, FileText, HeartPulse, Plus, Calculator, Wifi, Phone, PhoneCall, UserCheck } from 'lucide-react';
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
import type { CustomerEmoneyTopUpFormValues, CustomerKJPWithdrawalFormValues, CustomerTopUpFormValues, CustomerTransferFormValues, CustomerVAPaymentFormValues, CustomerWithdrawalFormValues, EDCServiceFormValues, SettlementFormValues, MotivationFormValues, PPOBPulsaFormValues, PPOBTokenListrikFormValues, PPOBPaketDataFormValues, PPOBPlnPostpaidFormValues, PPOBPdamFormValues, PPOBBpjsFormValues, PPOBWifiFormValues, PPOBPaketTelponFormValues, ShiftReconciliationFormValues } from '@/lib/types';
import BookkeepingReport from './BookkeepingReport';
import AdminPasscodeDialog from './AdminPasscodeDialog';
import CustomerWithdrawalForm from './CustomerWithdrawalForm';
import ProfitLossReport from './ProfitLossReport';
import CustomerTopUpForm from './CustomerTopUpForm';
import CustomerVAPaymentForm from './CustomerVAPaymentForm';
import EDCServiceForm from './EDCServiceForm';
import CustomerEmoneyTopUpForm from './CustomerEmoneyTopUpForm';
import SettlementForm from './SettlementForm';
import { Button } from '../ui/button';
import CustomerKJPWithdrawalForm from './CustomerKJPWithdrawalForm';
import MotivationCard from './MotivationCard';
import SetMotivationForm from './SetMotivationForm';
import KasManagement from './KasManagement';
import DeleteAllKasAccountsDialog from './DeleteAllKasAccountsDialog';
import DeleteAllReportsDialog from './DeleteAllReportsDialog';
import { useToast } from '@/hooks/use-toast';
import PPOBPulsaForm from './PPOBPulsaForm';
import PPOBPaketDataForm from './PPOBPaketDataForm';
import PPOBPricingManager from './PPOBPricingManager';
import PPOBReport from './PPOBReport';
import PPOBTokenListrikForm from './PPOBTokenListrikForm';
import PPOBPlnPostpaidForm from './PPOBPlnPostpaidForm';
import PPOBPdamForm from './PPOBPdamForm';
import RepeatTransactionDialog from './RepeatTransactionDialog';
import AccountsContent from './AccountsContent';
import PendingSettlements from './PendingSettlements';
import OperationalCostReport from './OperationalCostReport';
import ReportsContent from './ReportsContent';
import CapitalAdditionReport from './CapitalAdditionReport';
import PPOBBpjsForm from './PPOBBpjsForm';
import PPOBWifiForm from './PPOBWifiForm';
import PPOBPaketTelponForm from './PPOBPaketTelponForm';
import ShiftReconciliationForm from './ShiftReconciliationForm';
import StartShiftScreen from './StartShiftScreen';
import ShiftReconciliationReport from './ShiftReconciliationReport';
import DailyReport from './DailyReport';
import DailyReportHistory from './DailyReportHistory';
import DailyReportDetail from './DailyReportDetail';
import CombinedReport from './CombinedReport';
import FloatingBackButton from './FloatingBackButton';


export const iconMap: { [key: string]: React.ElementType } = {
  'Tunai': Wallet,
  'Bank': Building2,
  'PPOB': Zap,
  'E-Wallet': Smartphone,
  'Merchant': ShoppingBag,
  'default': Wallet,
};

export type ActiveTab = 'home' | 'laporan' | 'mutasi' | 'accounts' | 'admin';
type ActiveSheet = null | 'history' | 'transfer' | 'addCapital' | 'withdraw' | 'customerTransfer' | 'customerWithdrawal' | 'customerTopUp' | 'customerVAPayment' | 'EDCService' | 'customerEmoneyTopUp' | 'customerKJP' | 'settlement' | 'setMotivation' | 'manageKasAccounts' | 'managePPOBPricing' | 'ppobPulsa' | 'ppobTokenListrik' | 'ppobPaketData' | 'ppobPlnPostpaid' | 'ppobPdam' | 'ppobBpjs' | 'ppobWifi' | 'operationalCostReport' | 'deleteAllKasAccounts' | 'ppobPaketTelpon' | 'shiftReconciliation';
type FormSheet = 'customerTransfer' | 'customerWithdrawal' | 'customerTopUp' | 'customerVAPayment' | 'EDCService' | 'customerEmoneyTopUp' | 'customerKJP' | 'settlement' | 'ppobPulsa' | 'ppobTokenListrik' | 'ppobPaketData' | 'ppobPlnPostpaid' | 'ppobPdam' | 'ppobBpjs' | 'ppobWifi' | 'ppobPaketTelpon' | 'shiftReconciliation';


interface HomeContentProps {
  revalidateData: () => void;
  isSyncing: boolean;
}

export default function HomeContent({ revalidateData, isSyncing }: HomeContentProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [isRepeatDialogOpen, setIsRepeatDialogOpen] = useState(false);
  const [lastCompletedSheet, setLastCompletedSheet] = useState<FormSheet | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<KasAccountType | null>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>()
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isAdminAccessGranted, setIsAdminAccessGranted] = useState(false);
  const [isPasscodeDialogOpen, setIsPasscodeDialogOpen] = useState(false);
  const [isBrilinkReportVisible, setIsBrilinkReportVisible] = useState(false);
  const [isPpobReportVisible, setIsPpobReportVisible] = useState(false);
  const [isProfitLossReportVisible, setIsProfitLossReportVisible] = useState(false);
  const [isOperationalCostReportVisible, setIsOperationalCostReportVisible] = useState(false);
  const [isCapitalAdditionReportVisible, setIsCapitalAdditionReportVisible] = useState(false);
  const [isShiftReconciliationReportVisible, setIsShiftReconciliationReportVisible] = useState(false);
  const [isDailyReportVisible, setIsDailyReportVisible] = useState(false);
  const [isDailyReportHistoryVisible, setIsDailyReportHistoryVisible] = useState(false);
  const [selectedDailyReport, setSelectedDailyReport] = useState<DailyReportType | null>(null);
  const [isCombinedReportVisible, setIsCombinedReportVisible] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isDeleteReportsDialogOpen, setIsDeleteReportsDialogOpen] = useState(false);
  const [isDeleteAllAccountsDialogOpen, setIsDeleteAllAccountsDialogOpen] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const adminTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const firestore = useFirestore();

  const shiftStatusDocRef = useMemoFirebase(() => doc(firestore, 'appConfig', 'currentShiftStatus'), [firestore]);
  const { data: shiftStatus, isLoading: isShiftLoading } = useDoc<CurrentShiftStatus>(shiftStatusDocRef);

  const kasAccountsCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'kasAccounts');
  }, [firestore]);

  const { data: kasAccounts } = useCollection<KasAccountType>(kasAccountsCollection);

  useEffect(() => {
    const storedName = localStorage.getItem('brimoDeviceName') || '';
    setDeviceName(storedName);
    
    const handleStorageChange = () => {
        const updatedName = localStorage.getItem('brimoDeviceName') || '';
        setDeviceName(updatedName);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

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

  const plugin = useRef(
    Autoplay({ delay: 5000, stopOnInteraction: true })
  );
  
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
    setIsHistoryVisible(true);
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
  
  const handleQuickServiceClick = (serviceId: ServiceType) => {
    if (serviceId === 'customerTransfer') {
      setActiveSheet('customerTransfer');
    } else if (serviceId === 'withdraw') {
      setActiveSheet('customerWithdrawal');
    } else if (serviceId === 'topUp') {
      setActiveSheet('customerTopUp');
    } else if (serviceId === 'customerVAPayment') {
      setActiveSheet('customerVAPayment');
    } else if (serviceId === 'EDCService') {
      setActiveSheet('EDCService');
    } else if (serviceId === 'Emoney') {
      setActiveSheet('customerEmoneyTopUp');
    } else if (serviceId === 'KJP') {
      setActiveSheet('customerKJP');
    } else if (serviceId === 'Pulsa') {
      setActiveSheet('ppobPulsa');
    } else if (serviceId === 'Token Listrik') {
        setActiveSheet('ppobTokenListrik');
    } else if (serviceId === 'Data') {
        setActiveSheet('ppobPaketData');
    } else if (serviceId === 'PLN') {
        setActiveSheet('ppobPlnPostpaid');
    } else if (serviceId === 'PDAM') {
        setActiveSheet('ppobPdam');
    } else if (serviceId === 'BPJS') {
        setActiveSheet('ppobBpjs');
    } else if (serviceId === 'Wifi') {
        setActiveSheet('ppobWifi');
    } else if (serviceId === 'Paket Telpon') {
        setActiveSheet('ppobPaketTelpon');
    }
  }
  
  const handleSettlementClick = (account: KasAccountType) => {
    setSelectedAccount(account);
    setActiveSheet('settlement');
  }

  const handleTransactionComplete = () => {
    revalidateData();
    let formSheet: FormSheet | null = activeSheet as FormSheet;
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
    setActiveSheet(null); 
    setTimeout(() => {
        setActiveSheet(lastCompletedSheet);
    }, 100); 
  };
  
  const closeAllSheets = () => {
    setActiveSheet(null);
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
  
  const handleShiftReconciliationClick = () => {
    setActiveSheet('shiftReconciliation');
  };
  
  const handleDailyReportClick = () => {
    setIsDailyReportVisible(true);
  };

  const handleDailyReportHistoryClick = () => {
    setIsDailyReportHistoryVisible(true);
  };

  const handleViewDailyReportDetail = (report: DailyReportType) => {
    setSelectedDailyReport(report);
    setIsDailyReportHistoryVisible(false); // Hide history to show detail
  };

  const handleCombinedReportClick = () => {
    setIsCombinedReportVisible(true);
  };

  const handleShiftReconciliationReportClick = () => {
    setIsShiftReconciliationReportVisible(true);
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
  
  const handleResetAllAccountsClick = () => {
    setActiveSheet('deleteAllKasAccounts');
  }

  const handleEndShift = async () => {
    await setDoc(shiftStatusDocRef, { isActive: false }, { merge: true });
    setActiveTab('home');
    setIsSettingsVisible(false);
    toast({ title: 'Shift Berakhir', description: 'Anda telah mengakhiri shift. Silakan mulai shift baru.' });
  };

  const confirmResetDailyReports = async () => {
    if (!firestore) {
      toast({ variant: "destructive", title: "Error", description: "Database tidak tersedia." });
      return;
    }
    toast({ title: "Memproses...", description: "Menghapus riwayat laporan harian." });

    const batch = writeBatch(firestore);
    try {
        const querySnapshot = await getDocs(collection(firestore, 'dailyReports'));
        querySnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        const settingsRef = doc(firestore, 'appConfig', 'dailyReportSettings');
        batch.set(settingsRef, { lastFinalLiability: 0 }, { merge: true });
        
        await batch.commit();

        toast({ title: "Sukses", description: "Semua riwayat laporan harian telah dihapus." });
        setIsDailyReportHistoryVisible(false); // Close the history view
        revalidateData();
    } catch (error) {
        console.error("Error resetting daily reports:", error);
        toast({ variant: "destructive", title: "Gagal", description: "Terjadi kesalahan saat mereset laporan harian." });
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
            const accountRef = collection(firestore, 'kasAccounts');
            batch.update(doc(accountRef, account.id), { balance: 0 });

            const transactionsRef = collection(firestore, 'kasAccounts', account.id, 'transactions');
            const transactionsSnapshot = await getDocs(transactionsRef);
            transactionsSnapshot.forEach(transactionDoc => {
                batch.delete(transactionDoc.ref);
            });
        }
        await batch.commit();
        toast({ title: "Sukses", description: "Semua akun kas telah direset ke saldo 0 dan riwayatnya dihapus." });
        revalidateData();
        handleEndShift();
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
    setIsSettingsVisible(true);
  }

  const handlePasscodeSuccess = () => {
    sessionStorage.setItem('brimoAdminAccess', 'true');
    setIsAdminAccessGranted(true);
    setActiveTab('admin');
    setIsPasscodeDialogOpen(false);
  };
  
  const handleShiftStart = async (operatorName: string, initialCapital: number) => {
    if (!firestore || !kasAccounts) {
      toast({ variant: 'destructive', title: 'Error', description: 'Database tidak tersedia.' });
      return;
    }
    const laciAccount = kasAccounts.find(acc => acc.label === 'Laci' && acc.type === 'Tunai');
    if (!laciAccount) {
      toast({ variant: 'destructive', title: 'Akun Laci Tidak Ditemukan', description: 'Buat akun kas "Laci" dengan tipe "Tunai".' });
      return;
    }
  
    try {
      const batch = writeBatch(firestore);
  
      const shiftStatusRef = doc(firestore, 'appConfig', 'currentShiftStatus');
      batch.set(shiftStatusRef, {
        isActive: true,
        operatorName: operatorName,
        startTime: new Date().toISOString()
      }, { merge: true });
  
      const laciRef = doc(firestore, 'kasAccounts', laciAccount.id);
      batch.update(laciRef, { balance: initialCapital });
  
      const transactionRef = doc(collection(laciRef, 'transactions'));
      batch.set(transactionRef, {
        kasAccountId: laciAccount.id,
        type: 'credit',
        name: 'Modal Awal Shift',
        account: 'Internal',
        date: new Date().toISOString(),
        amount: initialCapital,
        balanceBefore: 0, 
        balanceAfter: initialCapital,
        category: 'capital',
        deviceName: deviceName,
      });
  
      await batch.commit();
  
      toast({
        title: 'Shift Dimulai',
        description: `Selamat bekerja, ${operatorName}! Modal awal ${initialCapital.toLocaleString('id-ID')} dicatat.`,
      });
  
    } catch (error) {
      console.error("Error starting shift:", error);
      toast({ variant: 'destructive', title: 'Gagal Memulai Shift', description: 'Terjadi kesalahan.' });
    }
  };
  
  
  if (isShiftLoading) {
    return <div className="fixed inset-0 bg-background" />;
  }

  if (!shiftStatus?.isActive) {
      return <StartShiftScreen onShiftStart={handleShiftStart} />;
  }

    if (isHistoryVisible && selectedAccount) {
        return (
          <div className="h-screen w-full flex flex-col">
            <header className="p-4 flex items-center gap-4 border-b">
                <Button variant="ghost" size="icon" onClick={() => setIsHistoryVisible(false)}>
                    <ArrowLeft />
                </Button>
                <h1 className="text-lg font-semibold">{`Riwayat Mutasi: ${selectedAccount.label}`}</h1>
            </header>
            <TransactionHistory account={selectedAccount} onDone={() => setIsHistoryVisible(false)} />
          </div>
        );
    }

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

    if (isShiftReconciliationReportVisible) {
        return <ShiftReconciliationReport onDone={() => setIsShiftReconciliationReportVisible(false)} />;
    }

    if (isDailyReportVisible) {
        return <DailyReport onDone={() => setIsDailyReportVisible(false)} />;
    }

    if (isDailyReportHistoryVisible) {
        return <DailyReportHistory onDone={() => setIsDailyReportHistoryVisible(false)} onViewReport={handleViewDailyReportDetail} onResetAll={confirmResetDailyReports}/>;
    }

    if (selectedDailyReport) {
        return <DailyReportDetail report={selectedDailyReport} onDone={() => setSelectedDailyReport(null)} />;
    }

    if (isCombinedReportVisible) {
        return <CombinedReport onDone={() => setIsCombinedReportVisible(false)} />;
    }
    
    if (isSettingsVisible) {
        return <SettingsContent onBack={() => setIsSettingsVisible(false)} />;
    }

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <>
            <Header 
              onSync={revalidateData} 
              isSyncing={isSyncing} 
              deviceName={deviceName}
              shiftStatus={shiftStatus}
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
                    onEndShift={handleEndShift}
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
                onShiftReconciliationClick={handleShiftReconciliationClick}
                onShiftReconciliationReportClick={handleShiftReconciliationReportClick}
                onSetMotivationClick={handleSetMotivationClick} 
                onManageKasAccountsClick={handleManageKasAccountsClick} 
                onManagePPOBPricingClick={handleManagePPOBPricingClick} 
                onResetReportsClick={handleResetReportsClick}
                onResetAllAccountsClick={handleResetAllAccountsClick}
                onDailyReportClick={handleDailyReportClick}
                onDailyReportHistoryClick={handleDailyReportHistoryClick}
                onCombinedReportClick={handleCombinedReportClick}
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

      {(activeSheet !== null || isBrilinkReportVisible || isPpobReportVisible || isProfitLossReportVisible || isOperationalCostReportVisible || isCapitalAdditionReportVisible || isShiftReconciliationReportVisible || isDailyReportVisible || isDailyReportHistoryVisible || selectedDailyReport || isCombinedReportVisible) && <FloatingBackButton />}

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
        onConfirm={confirmResetDailyReports}
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
                  {activeSheet === 'transfer' && 'Pindah Saldo'}
                  {activeSheet === 'addCapital' && 'Tambah Modal'}
                  {activeSheet === 'withdraw' && 'Tarik Saldo Pribadi'}
                  {activeSheet === 'customerTransfer' && 'Transfer Pelanggan'}
                  {activeSheet === 'customerWithdrawal' && 'Tarik Tunai Pelanggan'}
                  {activeSheet === 'customerTopUp' && 'Top Up E-Wallet'}
                  {activeSheet === 'customerEmoneyTopUp' && 'Top Up E-Money'}
                  {activeSheet === 'customerKJP' && 'Tarik Tunai KJP'}
                  {activeSheet === 'settlement' && `Settlement: ${selectedAccount?.label}`}
                  {activeSheet === 'setMotivation' && 'Atur Motivasi Harian'}
                  {activeSheet === 'manageKasAccounts' && 'Manajemen Akun Kas'}
                  {activeSheet === 'managePPOBPricing' && 'Kelola Harga PPOB'}
                  {activeSheet === 'ppobPulsa' && 'Transaksi Pulsa'}
                  {activeSheet === 'ppobTokenListrik' && 'Transaksi Token Listrik'}
                  {activeSheet === 'ppobPaketData' && 'Transaksi Paket Data'}
                  {activeSheet === 'ppobPlnPostpaid' && 'Bayar Tagihan PLN'}
                  {activeSheet === 'ppobPdam' && 'Bayar Tagihan PDAM'}
                  {activeSheet === 'ppobBpjs' && 'Bayar Tagihan BPJS'}
                  {activeSheet === 'ppobWifi' && 'Bayar Tagihan Wifi'}
                  {activeSheet === 'ppobPaketTelpon' && 'Transaksi Paket Telpon'}
                  {activeSheet === 'operationalCostReport' && 'Laporan Biaya Operasional'}
                  {activeSheet === 'deleteAllKasAccounts' && 'Reset Semua Akun Kas'}
                  {activeSheet === 'shiftReconciliation' && 'Rekonsiliasi Shift'}
                </SheetTitle>
            </SheetHeader>
            {activeSheet === 'transfer' && <TransferBalanceForm onDone={closeAllSheets} />}
            {activeSheet === 'addCapital' && <AddCapitalForm onDone={closeAllSheets} />}
            {activeSheet === 'withdraw' && <WithdrawBalanceForm onDone={closeAllSheets} />}
            
            {activeSheet === 'customerTransfer' && <CustomerTransferForm onTransactionComplete={handleTransactionComplete} onDone={closeAllSheets} />}
            
            {activeSheet === 'customerWithdrawal' && <CustomerWithdrawalForm onTransactionComplete={handleTransactionComplete} onDone={closeAllSheets} />}

            {activeSheet === 'customerTopUp' && <CustomerTopUpForm onTransactionComplete={handleTransactionComplete} onDone={closeAllSheets} />}
            
            {activeSheet === 'customerEmoneyTopUp' && <CustomerEmoneyTopUpForm onTransactionComplete={handleTransactionComplete} onDone={closeAllSheets} />}

            {activeSheet === 'customerVAPayment' && <CustomerVAPaymentForm onTransactionComplete={handleTransactionComplete} onDone={closeAllSheets} />}
            
            {activeSheet === 'EDCService' && <EDCServiceForm onDone={closeAllSheets} />}
            
            {activeSheet === 'settlement' && selectedAccount && <SettlementForm account={selectedAccount} onReview={() => {}} onDone={closeAllSheets} />}

            {activeSheet === 'customerKJP' && <CustomerKJPWithdrawalForm onTransactionComplete={handleTransactionComplete} onDone={closeAllSheets} />}
            
            {activeSheet === 'setMotivation' && <SetMotivationForm onDone={closeAllSheets} />}
            {activeSheet === 'manageKasAccounts' && <KasManagement onResetAll={handleResetAllAccountsClick} />}
            {activeSheet === 'managePPOBPricing' && <PPOBPricingManager onDone={closeAllSheets} />}
            
            {activeSheet === 'ppobPulsa' && <PPOBPulsaForm onTransactionComplete={handleTransactionComplete} onDone={closeAllSheets} />}

            {activeSheet === 'ppobTokenListrik' && <PPOBTokenListrikForm onTransactionComplete={handleTransactionComplete} onDone={closeAllSheets} />}
            
            {activeSheet === 'ppobPaketData' && <PPOBPaketDataForm onTransactionComplete={handleTransactionComplete} onDone={closeAllSheets} />}
            
            {activeSheet === 'ppobPlnPostpaid' && <PPOBPlnPostpaidForm onTransactionComplete={handleTransactionComplete} onDone={closeAllSheets} />}

            {activeSheet === 'ppobPdam' && <PPOBPdamForm onTransactionComplete={handleTransactionComplete} onDone={closeAllSheets} />}
            
            {activeSheet === 'ppobBpjs' && <PPOBBpjsForm onTransactionComplete={handleTransactionComplete} onDone={closeAllSheets} />}
            
            {activeSheet === 'ppobWifi' && <PPOBWifiForm onTransactionComplete={handleTransactionComplete} onDone={closeAllSheets} />}
            
            {activeSheet === 'ppobPaketTelpon' && <PPOBPaketTelponForm onTransactionComplete={handleTransactionComplete} onDone={closeAllSheets} />}


            {activeSheet === 'operationalCostReport' && <OperationalCostReport onDone={closeAllSheets} />}
            {activeSheet === 'shiftReconciliation' && <ShiftReconciliationForm onDone={closeAllSheets} />}
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
