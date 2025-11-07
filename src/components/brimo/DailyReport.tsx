
"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, Timestamp, doc, addDoc, setDoc } from 'firebase/firestore';
import { startOfDay, endOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { KasAccount, Transaction } from '@/lib/data';
import type { CustomerTransfer, CustomerWithdrawal, CustomerTopUp, CustomerEmoneyTopUp, CustomerVAPayment, EDCService, CustomerKJPWithdrawal, PPOBTransaction, Settlement, PPOBPlnPostpaid, PPOBPdam, PPOBBpjs, PPOBWifi } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Separator } from '../ui/separator';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface DailyReportProps {
  onDone: () => void;
}

type SpendingItem = {
  id: number;
  description: string;
  amount: number;
};

const formatToRupiah = (value: number | string | undefined | null): string => {
  if (value === null || value === undefined || value === '' || isNaN(Number(value))) return 'Rp 0';
  const num = Number(value);
  const isNegative = num < 0;
  const formattedNum = Math.abs(num).toLocaleString('id-ID');
  return `${isNegative ? '-Rp ' : 'Rp '}${formattedNum}`;
};

const parseRupiah = (value: string | undefined | null): number => {
    if (!value) return 0;
    const sanitized = value.toString().replace(/[^0-9-]/g, '');
    if (sanitized === '' || sanitized === '-') return 0;
    return Number(sanitized);
};


export default function DailyReport({ onDone }: DailyReportProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  // --- MANUAL INPUTS ---
  const [openingBalanceInput, setOpeningBalanceInput] = useState<string>('');
  const [posGrossProfitInput, setPosGrossProfitInput] = useState<string>('');
  const [paymentToPartyBInput, setPaymentToPartyBInput] = useState<string>('');
  const [spendingItems, setSpendingItems] = useState<SpendingItem[]>([{ id: Date.now(), description: '', amount: 0 }]);
  const [assetAccessoriesInput, setAssetAccessoriesInput] = useState<string>('');
  const [assetSIMCardsInput, setAssetSIMCardsInput] = useState<string>('');
  const [assetVouchersInput, setAssetVouchersInput] = useState<string>('');
  const [cashInDrawerInput, setCashInDrawerInput] = useState<string>('');
  const [cashInSafeInput, setCashInSafeInput] = useState<string>('');

  // --- DERIVED FROM MANUAL INPUTS ---
  const openingBalance = parseRupiah(openingBalanceInput);
  const posGrossProfit = parseRupiah(posGrossProfitInput);
  const paymentToPartyB = parseRupiah(paymentToPartyBInput);
  const totalManualSpending = spendingItems.reduce((sum, item) => sum + item.amount, 0);
  const assetAccessories = parseRupiah(assetAccessoriesInput);
  const assetSIMCards = parseRupiah(assetSIMCardsInput);
  const assetVouchers = parseRupiah(assetVouchersInput);
  const cashInDrawer = parseRupiah(cashInDrawerInput);
  const cashInSafe = parseRupiah(cashInSafeInput);


  // --- AUTOMATIC DATA ---
  const [capitalAdditionToday, setCapitalAdditionToday] = useState(0);
  const [grossProfitBrilink, setGrossProfitBrilink] = useState(0);
  const [grossProfitPPOB, setGrossProfitPPOB] = useState(0);
  const [operationalCosts, setOperationalCosts] = useState(0);

  // SECTION A: Saldo Akun
  const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
  const { data: kasAccounts, isLoading: isLoadingAccounts } = useCollection<KasAccount>(kasAccountsCollection);
  
  const accountsForReport = useMemo(() => {
    return kasAccounts?.filter(acc => acc.label.toLowerCase() !== 'laci') ?? [];
  }, [kasAccounts]);

  const totalAccountBalance = accountsForReport.reduce((sum, acc) => sum + acc.balance, 0) ?? 0;

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      if (!firestore) return;
      setIsLoading(true);

      const todayStart = startOfDay(new Date());
      const todayEnd = endOfDay(new Date());
      const dateFrom = Timestamp.fromDate(todayStart);
      const dateTo = Timestamp.fromDate(todayEnd);

      let totalCapital = 0;
      let totalBrilinkProfit = 0;
      let totalPPOBProfit = 0;
      let totalOpsCost = 0;

      // Fetch last report's final liability
      const settingsRef = doc(firestore, 'appConfig', 'dailyReportSettings');
      const settingsSnap = await getDocs(query(collection(firestore, 'appConfig'), where('id', '==', 'dailyReportSettings')));
      if (!settingsSnap.empty) {
        const lastLiability = settingsSnap.docs[0].data().lastFinalLiability || 0;
        setOpeningBalanceInput(String(lastLiability));
      }


      // 1. Fetch Capital Additions & Operational Costs from Transactions
      if (kasAccounts) {
        for (const account of kasAccounts) {
          const transQuery = query(
            collection(firestore, 'kasAccounts', account.id, 'transactions'),
            where('date', '>=', todayStart.toISOString()),
            where('date', '<=', todayEnd.toISOString())
          );
          const transSnapshot = await getDocs(transQuery);
          transSnapshot.forEach(docSnap => {
            const trx = docSnap.data() as Transaction;
            if (trx.category === 'capital' && trx.type === 'credit') {
              totalCapital += trx.amount;
            }
            if (['operational', 'operational_fee', 'transfer_fee'].includes(trx.category || '')) {
              totalOpsCost += trx.amount;
            }
          });
        }
      }
      setCapitalAdditionToday(totalCapital);

      // 2. Fetch Profits & Costs from Audit Collections
      const brilinkCollections = ['customerTransfers', 'customerWithdrawals', 'customerTopUps', 'customerEmoneyTopUps', 'customerVAPayments', 'edcServices', 'customerKJPWithdrawals'];
      const ppobCollections = ['ppobTransactions', 'ppobPlnPostpaid', 'ppobPdam', 'ppobBpjs', 'ppobWifi', 'ppobPaketTelpon'];

      for (const col of brilinkCollections) {
          const q = query(collection(firestore, col), where('date', '>=', dateFrom), where('date', '<=', dateTo));
          const snapshot = await getDocs(q);
          snapshot.forEach(doc => {
              const data = doc.data();
              totalBrilinkProfit += (data.netProfit ?? data.serviceFee ?? 0);
          });
      }
       const settlementQuery = query(collection(firestore, 'settlements'), where('date', '>=', dateFrom), where('date', '<=', dateTo));
       const settlementSnapshot = await getDocs(settlementQuery);
       settlementSnapshot.forEach(doc => {
           const data = doc.data() as Settlement;
           totalOpsCost += data.mdrFee;
       });

      setGrossProfitBrilink(totalBrilinkProfit);

      for (const col of ppobCollections) {
          const q = query(collection(firestore, col), where('date', '>=', dateFrom), where('date', '<=', dateTo));
          const snapshot = await getDocs(q);
          snapshot.forEach(doc => {
              const data = doc.data();
              totalPPOBProfit += (data.profit ?? data.netProfit ?? 0);
          });
      }
      setGrossProfitPPOB(totalPPOBProfit);
      setOperationalCosts(totalOpsCost);
      
      setIsLoading(false);
    };

    if (!isLoadingAccounts) {
      fetchData();
    }
  }, [firestore, kasAccounts, isLoadingAccounts]);

  const handleSpendingChange = (id: number, field: 'description' | 'amount', value: string) => {
    setSpendingItems(
        produce(draft => {
            const item = draft.find(item => item.id === id);
            if (item) {
                if (field === 'description') {
                    item.description = value;
                } else {
                    item[field] = parseRupiah(value);
                }
            }
        })
    );
  };
  
  const addSpendingItem = () => {
    setSpendingItems(items => [...items, { id: Date.now(), description: '', amount: 0 }]);
  };

  const removeSpendingItem = (id: number) => {
    if (spendingItems.length <= 1) return;
    setSpendingItems(items => items.filter(item => item.id !== id));
  };

  // Derived Calculations
  const liabilityBeforePayment = openingBalance - capitalAdditionToday;
  const liabilityAfterPayment = liabilityBeforePayment + paymentToPartyB;
  const finalLiabilityForNextDay = liabilityAfterPayment - totalManualSpending;
  const totalCurrentAssets = assetAccessories + assetSIMCards + assetVouchers;
  const totalGrossProfit = grossProfitBrilink + grossProfitPPOB + posGrossProfit;
  const netProfit = totalGrossProfit - operationalCosts;
  const totalPhysicalCash = cashInDrawer + cashInSafe;
  const grandTotalBalance = totalPhysicalCash + totalAccountBalance + finalLiabilityForNextDay;
  const liquidAccumulation = grandTotalBalance - totalCurrentAssets;
  
  const handleSaveReport = async () => {
    if (!firestore) return;
    toast({ title: 'Menyimpan...', description: 'Laporan harian sedang disimpan.' });

    try {
        const accountSnapshots = accountsForReport.map(acc => ({
            label: acc.label,
            balance: acc.balance,
            type: acc.type,
        }));

        const reportData = {
            date: new Date(),
            accountSnapshots,
            totalAccountBalance,
            openingBalanceRotation: openingBalance,
            capitalAdditionToday,
            liabilityBeforePayment,
            paymentToPartyB,
            liabilityAfterPayment,
            manualSpending: totalManualSpending,
            finalLiabilityForNextDay,
            assetAccessories,
            assetSIMCards,
            assetVouchers,
            totalCurrentAssets,
            grossProfitBrilink,
            grossProfitPPOB,
            posGrossProfit,
            totalGrossProfit,
            operationalCosts,
            netProfit,
            cashInDrawer,
            cashInSafe,
            totalPhysicalCash,
            grandTotalBalance,
            liquidAccumulation,
            spendingItems: spendingItems.filter(item => item.description || item.amount),
        };

        await addDoc(collection(firestore, 'dailyReports'), reportData);
        
        const settingsRef = doc(firestore, 'appConfig', 'dailyReportSettings');
        await setDoc(settingsRef, { 
            lastFinalLiability: finalLiabilityForNextDay,
            lastReportDate: new Date()
        }, { merge: true });

        toast({ title: 'Sukses!', description: 'Laporan harian berhasil disimpan.' });
        onDone();
    } catch (error) {
        console.error("Error saving daily report: ", error);
        toast({ variant: 'destructive', title: 'Gagal Menyimpan', description: 'Terjadi kesalahan saat menyimpan laporan.' });
    }
  };


  const renderSectionA = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-primary">A. Saldo Akun</h2>
      {isLoadingAccounts ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="space-y-2 text-sm">
          {accountsForReport.map(acc => (
            <div key={acc.id} className="flex justify-between">
              <span>{acc.label}</span>
              <span className="font-medium">{formatToRupiah(acc.balance)}</span>
            </div>
          ))}
          <div className="col-span-2 mt-2 pt-2 border-t font-bold flex justify-between text-base">
            <span>TOTAL SALDO AKUN</span>
            <span>{formatToRupiah(totalAccountBalance)}</span>
          </div>
        </div>
      )}
    </div>
  );
  
    const renderSectionB = () => {
    const liabilityLabel = liabilityBeforePayment < 0 ? "LIABILITAS (Kewajiban A)" : "Piutang Pihak A";
    const liabilityAfterLabel = liabilityAfterPayment < 0 ? "LIABILITAS Setelah Bayar" : "Piutang Pihak A Setelah Bayar";
    
    return (
        <div className="space-y-4">
            <h2 className="text-lg font-bold text-primary">B. Rotasi Saldo</h2>
            <div className="space-y-3 text-sm">
                <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Saldo Laporan Kemarin (Hutang/Piutang)</label>
                    <Input 
                        type="text"
                        value={openingBalanceInput}
                        onFocus={e => e.target.select()}
                        onBlur={e => setOpeningBalanceInput(formatToRupiah(parseRupiah(e.target.value)))}
                        onChange={e => setOpeningBalanceInput(e.target.value)}
                        className="text-base"
                    />
                </div>
                <div className="flex justify-between items-center">
                    <span>Permintaan Penambahan Modal ke Pihak B</span>
                    <span className="font-medium">{formatToRupiah(capitalAdditionToday)}</span>
                </div>
                <div className="flex justify-between items-center font-bold">
                    <span>{liabilityLabel}</span>
                    <span className={cn(liabilityBeforePayment < 0 && "text-destructive")}>{formatToRupiah(liabilityBeforePayment)}</span>
                </div>
                <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Dana Dibayar A ke B (Manual)</label>
                     <Input 
                        type="text" 
                        value={paymentToPartyBInput} 
                        onFocus={e => e.target.select()}
                        onBlur={e => setPaymentToPartyBInput(formatToRupiah(parseRupiah(e.target.value)))}
                        onChange={e => setPaymentToPartyBInput(e.target.value)}
                        className="text-base"
                     />
                </div>
                <div className="flex justify-between items-center font-bold">
                    <span>{liabilityAfterLabel}</span>
                    <span className={cn(liabilityAfterPayment < 0 && "text-destructive")}>{formatToRupiah(liabilityAfterPayment)}</span>
                </div>
            </div>
        </div>
    );
 };


  const renderSectionC = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-primary">C. Pembelanjaan</h2>
      <div className="space-y-3">
        {spendingItems.map((item, index) => (
          <div key={item.id} className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              {index === 0 && <label className="text-xs text-muted-foreground">Deskripsi Pembelanjaan</label>}
              <Input
                type="text"
                placeholder="cth: Beli stok voucher"
                value={item.description}
                onChange={(e) => handleSpendingChange(item.id, 'description', e.target.value)}
              />
            </div>
            <div className="w-40 space-y-1">
              {index === 0 && <label className="text-xs text-muted-foreground">Jumlah</label>}
               <Input
                type="text"
                value={item.amount === 0 ? '' : item.amount.toString()}
                onChange={(e) => handleSpendingChange(item.id, 'amount', e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder="Rp 0"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeSpendingItem(item.id)}
              className="text-destructive hover:bg-destructive/10 shrink-0"
              disabled={spendingItems.length <= 1}
            >
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addSpendingItem}>
          <Plus size={16} className="mr-2" /> Tambah Pembelanjaan
        </Button>
        <Alert>
          <AlertTitle className={cn(finalLiabilityForNextDay < 0 && "text-destructive")}>LIABILITAS FINAL (Untuk Besok)</AlertTitle>
          <AlertDescription className={cn("text-lg font-bold", finalLiabilityForNextDay < 0 && "text-destructive")}>{formatToRupiah(finalLiabilityForNextDay)}</AlertDescription>
        </Alert>
      </div>
    </div>
  );


  const renderSectionD = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-primary">D. Aset Lancar (Inventaris)</h2>
      <div className="space-y-2">
        <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Nilai Aset Aksesoris</label>
            <Input type="text" value={assetAccessoriesInput} onChange={(e) => setAssetAccessoriesInput(e.target.value)} onFocus={(e) => e.target.select()} onBlur={e => setAssetAccessoriesInput(formatToRupiah(parseRupiah(e.target.value)))} className="text-base" />
        </div>
        <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Nilai Aset Perdana</label>
            <Input type="text" value={assetSIMCardsInput} onChange={(e) => setAssetSIMCardsInput(e.target.value)} onFocus={(e) => e.target.select()} onBlur={e => setAssetSIMCardsInput(formatToRupiah(parseRupiah(e.target.value)))} className="text-base" />
        </div>
        <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Nilai Aset Voucher</label>
            <Input type="text" value={assetVouchersInput} onChange={(e) => setAssetVouchersInput(e.target.value)} onFocus={(e) => e.target.select()} onBlur={e => setAssetVouchersInput(formatToRupiah(parseRupiah(e.target.value)))} className="text-base" />
        </div>
      </div>
       <div className="mt-2 pt-2 border-t font-bold flex justify-between text-base">
            <span>TOTAL ASET LANCAR</span>
            <span>{formatToRupiah(totalCurrentAssets)}</span>
        </div>
    </div>
  );
  
  const renderSectionE = () => (
    <div className="space-y-4">
        <h2 className="text-lg font-bold text-primary">E. Laba</h2>
        <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center"><span>Laba Kotor BRILink</span> <span className="font-medium">{formatToRupiah(grossProfitBrilink)}</span></div>
            <div className="flex justify-between items-center"><span>Laba Kotor PPOB</span> <span className="font-medium">{formatToRupiah(grossProfitPPOB)}</span></div>
            <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Laba Kotor POS (Manual)</label>
                <Input type="text" value={posGrossProfitInput} onChange={(e) => setPosGrossProfitInput(e.target.value)} onFocus={(e) => e.target.select()} onBlur={e => setPosGrossProfitInput(formatToRupiah(parseRupiah(e.target.value)))} className="text-base" />
            </div>
             <div className="flex justify-between items-center font-bold border-t pt-2"><span>TOTAL LABA KOTOR</span> <span>{formatToRupiah(totalGrossProfit)}</span></div>
        </div>
    </div>
  );
  
  const renderSectionG = () => (
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-primary">G. Biaya Operasional</h2>
        <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center"><span>Total Biaya Operasional (Otomatis)</span> <span className="font-medium text-destructive">{formatToRupiah(operationalCosts)}</span></div>
             <div className="flex justify-between items-center font-bold border-t pt-2 mt-4"><span>LABA BERSIH (NETT PROFIT)</span> <span className={cn(netProfit < 0 && "text-destructive")}>{formatToRupiah(netProfit)}</span></div>
        </div>
    </div>
  );
  
  const renderSectionF = () => (
     <div className="space-y-4">
        <h2 className="text-lg font-bold text-primary">F. Timbangan (Neraca)</h2>
        <div className="space-y-2">
            <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Kas Laci Kecil (Manual)</label>
                <Input type="text" value={cashInDrawerInput} onChange={(e) => setCashInDrawerInput(e.target.value)} onFocus={(e) => e.target.select()} onBlur={e => setCashInDrawerInput(formatToRupiah(parseRupiah(e.target.value)))} className="text-base" />
            </div>
            <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Kas Brankas (Manual)</label>
                <Input type="text" value={cashInSafeInput} onChange={(e) => setCashInSafeInput(e.target.value)} onFocus={(e) => e.target.select()} onBlur={e => setCashInSafeInput(formatToRupiah(parseRupiah(e.target.value)))} className="text-base" />
            </div>
        </div>
        <div className="space-y-3 text-sm mt-4">
            <div className="flex justify-between"><span>Total Kas Fisik</span> <span className="font-medium">{formatToRupiah(totalPhysicalCash)}</span></div>
            <div className="flex justify-between"><span>Total Saldo Akun</span> <span className="font-medium">{formatToRupiah(totalAccountBalance)}</span></div>
            <div className="flex justify-between"><span>LIABILITAS FINAL</span> <span className={cn("font-medium", finalLiabilityForNextDay < 0 && "text-destructive")}>{formatToRupiah(finalLiabilityForNextDay)}</span></div>
            <div className="flex justify-between font-bold border-t pt-2"><span>TOTAL KESELURUHAN</span> <span>{formatToRupiah(grandTotalBalance)}</span></div>
             <div className="flex justify-between mt-4"><span>Aset Lancar</span> <span className="font-medium">{formatToRupiah(totalCurrentAssets)}</span></div>
             <div className="flex justify-between font-bold border-t pt-2 text-green-500"><span>AKUMULASI SALDO LIQUID</span> <span className={cn(liquidAccumulation < 0 && "text-destructive")}>{formatToRupiah(liquidAccumulation)}</span></div>
        </div>
    </div>
  )


  return (
    <div className="h-full flex flex-col bg-background">
      <header className="p-4 flex items-center gap-4 border-b">
        <Button variant="ghost" size="icon" onClick={onDone}>
            <ArrowLeft />
        </Button>
        <h1 className="text-lg font-semibold">Laporan Harian v5.0</h1>
      </header>
      <ScrollArea className="flex-1 px-6">
        <div className="space-y-8 py-6">
          {isLoading ? <Skeleton className="h-96 w-full" /> : (
            <>
              {renderSectionA()}
              <Separator />
              {renderSectionB()}
              <Separator />
              {renderSectionC()}
              <Separator />
              {renderSectionD()}
              <Separator />
              {renderSectionE()}
              <Separator />
              {renderSectionF()}
              <Separator />
              {renderSectionG()}
            </>
          )}
        </div>
      </ScrollArea>
      <div className="p-4 border-t flex gap-2">
        <Button onClick={onDone} variant="outline" className="w-full">Tutup</Button>
        <Button onClick={handleSaveReport} className="w-full">Simpan Laporan</Button>
      </div>
    </div>
  );
}
