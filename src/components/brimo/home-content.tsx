
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


const iconMap: { [key: string]: React.ElementType } = {
  'Tunai': Wallet,
  'Bank': Building2,
  'PPOB': Zap,
  'E-Wallet': Smartphone,
  'Merchant': ShoppingBag,
  'default': Wallet,
};

export type ActiveTab = 'home' | 'mutasi' | 'admin' | 'settings';
type ActiveSheet = null | 'history' | 'transfer' | 'addCapital' | 'withdraw' | 'customerTransfer' | 'customerTransferReview' | 'customerWithdrawal' | 'customerWithdrawalReview' | 'customerTopUp' | 'customerTopUpReview' | 'customerVAPayment' | 'customerVAPaymentReview' | 'EDCService' | 'customerEmoneyTopUp' | 'customerEmoneyTopUpReview' | 'customerKJP' | 'customerKJPReview' | 'settlement' | 'settlementReview' | 'setMotivation' | 'manageKasAccounts' | 'managePPOBPricing' | 'ppobPulsa' | 'ppobPulsaReview' | 'ppobTokenListrik' | 'ppobTokenListrikReview';

interface HomeContentProps {
  revalidateData: () => void;
}

export default function HomeContent({ revalidateData }: HomeContentProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
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
    } else if ('meterNumber' in data) {
        setActiveSheet('ppobTokenListrikReview');
    } else if ('withdrawalAmount' in data && !('customerBankSource' in data)) {
        setActiveSheet('customerKJPReview');
    }
  }
  
  const handleSettlementClick = (account: KasAccountType) => {
    setSelectedAccount(account);
    setActiveSheet('settlement');
  }

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
                    <div role="button" tabIndex={0} onClick={() => virtualTunaiAccount && handleAccountClick(virtualTunaiAccount)} className="w-full text-left cursor-pointer">
                      <BalanceCard 
                        balanceType="tunai" 
                      />
                    </div>
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
                                <div key={account.id} className="w-full text-left p-3 bg-card/80 backdrop-blur-md flex items-center justify-between gap-4 border-t border-border/10">
                                    <button onClick={() => handleAccountClick(account)} className="flex-1 flex items-center gap-3">
                                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${account.color}`}>
                                          {account.iconUrl ? <img src={account.iconUrl} alt={account.label} className="h-6 w-6 object-contain" /> : <Icon size={20} className="text-white" />}
                                      </div>
                                      <div>
                                          <p className="font-semibold text-sm">{account.label}</p>
                                          <p className="text-muted-foreground text-xs">Rp{account.balance.toLocaleString('id-ID')}</p>
                                      </div>
                                    </button>
                                    <div className="flex items-center">
                                      {account.type === 'Merchant' && (
                                        <Button size="sm" variant="outline" onClick={() => handleSettlementClick(account)} className="flex items-center gap-2">
                                          <Banknote size={14} />
                                          <span>Settlement</span>
                                        </Button>
                                      )}
                                      <button onClick={() => handleAccountClick(account)} className="p-2">
                                        <ChevronRight size={18} className="text-muted-foreground" />
                                      </button>
                                    </div>
                                </div>
                                );
                            })}
                            </div>
                        </ScrollArea>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                <QuickServices onServiceClick={handleQuickServiceClick} />
            </div>
          </>
        );
      case 'settings':
        return <SettingsContent />;
      case 'mutasi':
        return <GlobalTransactionHistory />;
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
            {activeSheet === 'customerTransferReview' && reviewData && 'destinationBank' in reviewData && <CustomerTransferReview formData={reviewData} onConfirm={closeAllSheets} onBack={() => setActiveSheet('customerTransfer')} />}
            {activeSheet === 'customerWithdrawal' && <CustomerWithdrawalForm onReview={handleReview} onDone={closeAllSheets} />}
            {activeSheet === 'customerWithdrawalReview' && reviewData && 'customerBankSource' in reviewData && <CustomerWithdrawalReview formData={reviewData} onConfirm={closeAllSheets} onBack={() => setActiveSheet('customerWithdrawal')} />}
            {activeSheet === 'customerTopUp' && <CustomerTopUpForm onReview={handleReview} onDone={closeAllSheets} />}
            {activeSheet === 'customerTopUpReview' && reviewData && 'destinationEwallet' in reviewData && <CustomerTopUpReview formData={reviewData} onConfirm={closeAllSheets} onBack={() => setActiveSheet('customerTopUp')} />}
            {activeSheet === 'customerEmoneyTopUp' && <CustomerEmoneyTopUpForm onReview={handleReview} onDone={closeAllSheets} />}
            {activeSheet === 'customerEmoneyTopUpReview' && reviewData && 'destinationEmoney' in reviewData && <CustomerEmoneyTopUpReview formData={reviewData} onConfirm={closeAllSheets} onBack={() => setActiveSheet('customerEmoneyTopUp')} />}
            {activeSheet === 'customerVAPayment' && <CustomerVAPaymentForm onReview={handleReview} onDone={closeAllSheets} />}
            {activeSheet === 'customerVAPaymentReview' && reviewData && 'serviceProvider' in reviewData && <CustomerVAPaymentReview formData={reviewData} onConfirm={closeAllSheets} onBack={() => setActiveSheet('customerVAPayment')} />}
            {activeSheet === 'EDCService' && <EDCServiceForm onDone={closeAllSheets} />}
            {activeSheet === 'settlement' && selectedAccount && <SettlementForm account={selectedAccount} onReview={handleReview} onDone={closeAllSheets} />}
            {activeSheet === 'settlementReview' && reviewData && 'sourceMerchantAccountId' in reviewData && <SettlementReview formData={reviewData} onConfirm={closeAllSheets} onBack={() => setActiveSheet('settlement')} />}
            {activeSheet === 'customerKJP' && <CustomerKJPWithdrawalForm onReview={handleReview} onDone={closeAllSheets} />}
            {activeSheet === 'customerKJPReview' && reviewData && !('sourceMerchantAccountId' in reviewData) && !('serviceProvider' in reviewData) && !('destinationEmoney' in reviewData) && !('destinationEwallet' in reviewData) && !('customerBankSource' in reviewData) && !('destinationBank' in reviewData) && ('withdrawalAmount' in reviewData) && <CustomerKJPWithdrawalReview formData={reviewData as CustomerKJPWithdrawalFormValues} onConfirm={closeAllSheets} onBack={() => setActiveSheet('customerKJP')} />}
            {activeSheet === 'setMotivation' && <SetMotivationForm onDone={closeAllSheets} />}
            {activeSheet === 'manageKasAccounts' && <KasManagement />}
            {activeSheet === 'managePPOBPricing' && <PPOBPricingManager onDone={closeAllSheets} />}
            {activeSheet === 'ppobPulsa' && <PPOBPulsaForm onReview={handleReview} onDone={closeAllSheets} />}
            {activeSheet === 'ppobPulsaReview' && reviewData && 'phoneNumber' in reviewData && <PPOBPulsaReview formData={reviewData as PPOBPulsaFormValues} onConfirm={closeAllSheets} onBack={() => setActiveSheet('ppobPulsa')} />}
            {activeSheet === 'ppobTokenListrik' && <PPOBTokenListrikForm onReview={handleReview} onDone={closeAllSheets} />}
            {activeSheet === 'ppobTokenListrikReview' && reviewData && 'meterNumber' in reviewData && <PPOBTokenListrikReview formData={reviewData as PPOBTokenListrikFormValues} onConfirm={closeAllSheets} onBack={() => setActiveSheet('ppobTokenListrik')} />}
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

    