
"use client";

import { useState, useEffect } from 'react';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, Timestamp, doc } from 'firebase/firestore';
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

interface DailyReportProps {
  onDone: () => void;
}

type SpendingItem = {
  id: number;
  description: string;
  amount: number;
};


const formatToRupiah = (value: number | string | undefined | null): string => {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(String(value).replace(/[^0-9-]/g, ''));
  if (isNaN(num)) return '';
  const isNegative = num < 0;
  const formattedNum = Math.abs(num).toLocaleString('id-ID');
  return `${isNegative ? '- Rp ' : 'Rp '}${formattedNum}`;
};

const parseRupiah = (value: string | undefined | null): number => {
    if (value === null || value === undefined || value === '') return 0;
    const sanitized = String(value).replace(/[Rp.\s]/g, '');
    const number = parseInt(sanitized, 10);
    return isNaN(number) ? 0 : number;
}

export default function DailyReport({ onDone }: DailyReportProps) {
  const firestore = useFirestore();
  const [isLoading, setIsLoading] = useState(true);

  // --- MANUAL INPUTS ---
  const [openingBalance, setOpeningBalance] = useState(0);
  const [posGrossProfit, setPosGrossProfit] = useState(0);
  const [paymentToPartyB, setPaymentToPartyB] = useState(0);
  const [spendingItems, setSpendingItems] = useState<SpendingItem[]>([{ id: Date.now(), description: '', amount: 0 }]);
  const [assetAccessories, setAssetAccessories] = useState(0);
  const [assetSIMCards, setAssetSIMCards] = useState(0);
  const [assetVouchers, setAssetVouchers] = useState(0);
  const [cashInDrawer, setCashInDrawer] = useState(0);
  const [cashInSafe, setCashInSafe] = useState(0);

  // --- AUTOMATIC DATA ---
  const [capitalAdditionToday, setCapitalAdditionToday] = useState(0);
  const [grossProfitBrilink, setGrossProfitBrilink] = useState(0);
  const [grossProfitPPOB, setGrossProfitPPOB] = useState(0);
  const [operationalCosts, setOperationalCosts] = useState(0);

  // SECTION A: Saldo Akun
  const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
  const { data: kasAccounts, isLoading: isLoadingAccounts } = useCollection<KasAccount>(kasAccountsCollection);
  
  const totalAccountBalance = kasAccounts?.reduce((sum, acc) => sum + acc.balance, 0) ?? 0;

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

  const handleSpendingChange = (id: number, field: 'description' | 'amount', value: string | number) => {
    setSpendingItems(items => items.map(item => item.id === id ? { ...item, [field]: field === 'amount' ? parseRupiah(value as string) : value } : item));
  };
  const addSpendingItem = () => {
    setSpendingItems(items => [...items, { id: Date.now(), description: '', amount: 0 }]);
  };
  const removeSpendingItem = (id: number) => {
    setSpendingItems(items => items.filter(item => item.id !== id));
  };

  // Derived Calculations
    const liabilityBeforePayment = openingBalance >= 0 
    ? (openingBalance - capitalAdditionToday) 
    : (openingBalance - capitalAdditionToday);
  const liabilityAfterPayment = liabilityBeforePayment + paymentToPartyB;
  const totalManualSpending = spendingItems.reduce((sum, item) => sum + item.amount, 0);
  const finalLiabilityForNextDay = liabilityAfterPayment - totalManualSpending;
  const totalCurrentAssets = assetAccessories + assetSIMCards + assetVouchers;
  const totalGrossProfit = grossProfitBrilink + grossProfitPPOB + posGrossProfit;
  const netProfit = totalGrossProfit - operationalCosts;
  const totalPhysicalCash = cashInDrawer + cashInSafe;
  const grandTotalBalance = totalPhysicalCash + totalAccountBalance + finalLiabilityForNextDay;
  const liquidAccumulation = grandTotalBalance - totalCurrentAssets;


  const renderSectionA = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-primary">A. Saldo Akun</h2>
      {isLoadingAccounts ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {kasAccounts?.map(acc => (
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
            <Input type="text" placeholder="Rp 0" value={formatToRupiah(openingBalance)} onChange={(e) => setOpeningBalance(parseRupiah(e.target.value))} />
            </div>
            <div className="flex justify-between items-center">
            <span>Permintaan Penambahan Modal ke Pihak B</span>
            <span className="font-medium">{formatToRupiah(capitalAdditionToday)}</span>
            </div>
            <div className="flex justify-between items-center font-bold">
            <span>{liabilityLabel}</span>
            <span>{formatToRupiah(liabilityBeforePayment)}</span>
            </div>
            <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Dana Dibayar A ke B (Manual)</label>
            <Input type="text" placeholder="Rp 0" value={formatToRupiah(paymentToPartyB)} onChange={(e) => setPaymentToPartyB(parseRupiah(e.target.value))} />
            </div>
            <div className="flex justify-between items-center font-bold">
            <span>{liabilityAfterLabel}</span>
            <span>{formatToRupiah(liabilityAfterPayment)}</span>
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
              <label className="text-xs text-muted-foreground">Deskripsi Pembelanjaan #{index + 1}</label>
              <Input
                type="text"
                placeholder="cth: Beli stok voucher"
                value={item.description}
                onChange={(e) => handleSpendingChange(item.id, 'description', e.target.value)}
              />
            </div>
            <div className="w-40 space-y-1">
              <label className="text-xs text-muted-foreground">Jumlah</label>
              <Input
                type="text"
                placeholder="Rp 0"
                value={formatToRupiah(item.amount)}
                onChange={(e) => handleSpendingChange(item.id, 'amount', e.target.value)}
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
          <AlertTitle>LIABILITAS FINAL (Untuk Besok)</AlertTitle>
          <AlertDescription className="text-lg font-bold">{formatToRupiah(finalLiabilityForNextDay)}</AlertDescription>
        </Alert>
      </div>
    </div>
  );


  const renderSectionD = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-primary">D. Aset Lancar (Inventaris)</h2>
      <div className="space-y-2">
        <div className="space-y-1"><label className="text-xs text-muted-foreground">Nilai Aset Aksesoris</label><Input type="text" placeholder="Rp 0" value={formatToRupiah(assetAccessories)} onChange={(e) => setAssetAccessories(parseRupiah(e.target.value))} /></div>
        <div className="space-y-1"><label className="text-xs text-muted-foreground">Nilai Aset Perdana</label><Input type="text" placeholder="Rp 0" value={formatToRupiah(assetSIMCards)} onChange={(e) => setAssetSIMCards(parseRupiah(e.target.value))} /></div>
        <div className="space-y-1"><label className="text-xs text-muted-foreground">Nilai Aset Voucher</label><Input type="text" placeholder="Rp 0" value={formatToRupiah(assetVouchers)} onChange={(e) => setAssetVouchers(parseRupiah(e.target.value))} /></div>
      </div>
       <div className="mt-2 pt-2 border-t font-bold flex justify-between text-base">
            <span>TOTAL ASET LANCAR</span>
            <span>{formatToRupiah(totalCurrentAssets)}</span>
        </div>
    </div>
  );
  
  const renderSectionE_H = () => (
    <div className="space-y-4">
        <h2 className="text-lg font-bold text-primary">E & H. Laba & Biaya</h2>
        <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center"><span>Laba Kotor BRILink</span> <span className="font-medium">{formatToRupiah(grossProfitBrilink)}</span></div>
            <div className="flex justify-between items-center"><span>Laba Kotor PPOB</span> <span className="font-medium">{formatToRupiah(grossProfitPPOB)}</span></div>
            <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Laba Kotor POS (Manual)</label>
                <Input type="text" placeholder="Rp 0" value={formatToRupiah(posGrossProfit)} onChange={(e) => setPosGrossProfit(parseRupiah(e.target.value))} />
            </div>
             <div className="flex justify-between items-center font-bold border-t pt-2"><span>TOTAL LABA KOTOR</span> <span>{formatToRupiah(totalGrossProfit)}</span></div>

            <div className="flex justify-between items-center"><span>Biaya Operasional</span> <span className="font-medium text-red-500">{formatToRupiah(operationalCosts)}</span></div>
            <div className="flex justify-between items-center font-bold border-t pt-2"><span>LABA BERSIH (NETT PROFIT)</span> <span>{formatToRupiah(netProfit)}</span></div>
        </div>
    </div>
  );
  
  const renderSectionF = () => (
     <div className="space-y-4">
        <h2 className="text-lg font-bold text-primary">F. Timbangan (Neraca)</h2>
        <div className="space-y-2">
            <div className="space-y-1"><label className="text-xs text-muted-foreground">Kas Laci Kecil (Manual)</label><Input type="text" placeholder="Rp 0" value={formatToRupiah(cashInDrawer)} onChange={(e) => setCashInDrawer(parseRupiah(e.target.value))} /></div>
            <div className="space-y-1"><label className="text-xs text-muted-foreground">Kas Brankas (Manual)</label><Input type="text" placeholder="Rp 0" value={formatToRupiah(cashInSafe)} onChange={(e) => setCashInSafe(parseRupiah(e.target.value))} /></div>
        </div>
        <div className="space-y-3 text-sm mt-4">
            <div className="flex justify-between"><span>Total Kas Fisik</span> <span className="font-medium">{formatToRupiah(totalPhysicalCash)}</span></div>
            <div className="flex justify-between"><span>Total Saldo Akun</span> <span className="font-medium">{formatToRupiah(totalAccountBalance)}</span></div>
            <div className="flex justify-between"><span>LIABILITAS FINAL</span> <span className="font-medium">{formatToRupiah(finalLiabilityForNextDay)}</span></div>
            <div className="flex justify-between font-bold border-t pt-2"><span>TOTAL KESELURUHAN</span> <span>{formatToRupiah(grandTotalBalance)}</span></div>
             <div className="flex justify-between mt-4"><span>Aset Lancar</span> <span className="font-medium">{formatToRupiah(totalCurrentAssets)}</span></div>
             <div className="flex justify-between font-bold border-t pt-2 text-green-500"><span>AKUMULASI SALDO LIQUID</span> <span>{formatToRupiah(liquidAccumulation)}</span></div>
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
              {renderSectionE_H()}
              <Separator />
              {renderSectionF()}
            </>
          )}
        </div>
      </ScrollArea>
      <div className="p-4 border-t flex gap-2">
        <Button onClick={onDone} variant="outline" className="w-full">Tutup</Button>
        <Button onClick={() => {}} className="w-full">Simpan Laporan</Button>
      </div>
    </div>
  );
}
