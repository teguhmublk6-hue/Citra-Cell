
"use client";

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { DailyReport as DailyReportType } from '@/lib/data';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Separator } from '../ui/separator';
import { ArrowLeft, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, Timestamp, doc } from 'firebase/firestore';
import type { KasAccount } from '@/lib/data';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface DailyReportDetailProps {
  report: DailyReportType;
  onDone: () => void;
}

const formatToRupiah = (value: number | string | undefined | null): string => {
  if (value === null || value === undefined || value === '' || isNaN(Number(value))) return 'Rp 0';
  const num = Number(value);
  const isNegative = num < 0;
  const formattedNum = Math.abs(num).toLocaleString('id-ID');
  return `${isNegative ? '-Rp ' : 'Rp '}${formattedNum}`;
};

export default function DailyReportDetail({ report, onDone }: DailyReportDetailProps) {
  const [kasAccounts, setKasAccounts] = useState<KasAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const firestore = useFirestore();

  useEffect(() => {
    // This effect is to fetch kas account names, since the report doesn't store them.
    // In a real app, you might consider storing account names in the report for historical accuracy.
    const fetchKasAccounts = async () => {
      if (!firestore) return;
      const kasAccountsRef = collection(firestore, 'kasAccounts');
      const snapshot = await getDocs(kasAccountsRef);
      const accounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as KasAccount[];
      setKasAccounts(accounts);
      setIsLoading(false);
    };
    fetchKasAccounts();
  }, [firestore]);


  const renderSectionA = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-primary">A. Saldo Akun</h2>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <p>This section cannot be reproduced accurately from historical data without saving account snapshots.</p>
        <div className="col-span-2 mt-2 pt-2 border-t font-bold flex justify-between text-base">
          <span>TOTAL SALDO AKUN (Saat Laporan)</span>
          <span>{formatToRupiah(report.totalAccountBalance)}</span>
        </div>
      </div>
    </div>
  );
  
    const renderSectionB = () => {
    const liabilityLabel = report.liabilityBeforePayment < 0 ? "LIABILITAS (Kewajiban A)" : "Piutang Pihak A";
    const liabilityAfterLabel = report.liabilityAfterPayment < 0 ? "LIABILITAS Setelah Bayar" : "Piutang Pihak A Setelah Bayar";
    
    return (
        <div className="space-y-4">
            <h2 className="text-lg font-bold text-primary">B. Rotasi Saldo</h2>
            <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Saldo Laporan Kemarin</span>
                    <span>{formatToRupiah(report.openingBalanceRotation)}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Permintaan Penambahan Modal</span>
                    <span>{formatToRupiah(report.capitalAdditionToday)}</span>
                </div>
                <div className="flex justify-between items-center font-bold">
                    <span>{liabilityLabel}</span>
                    <span className={cn(report.liabilityBeforePayment < 0 && "text-destructive")}>{formatToRupiah(report.liabilityBeforePayment)}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Dana Dibayar A ke B</span>
                     <span>{formatToRupiah(report.paymentToPartyB)}</span>
                </div>
                <div className="flex justify-between items-center font-bold">
                    <span>{liabilityAfterLabel}</span>
                    <span className={cn(report.liabilityAfterPayment < 0 && "text-destructive")}>{formatToRupiah(report.liabilityAfterPayment)}</span>
                </div>
            </div>
        </div>
    );
 };


  const renderSectionC = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-primary">C. Pembelanjaan</h2>
      <div className="space-y-3 text-sm">
        {report.spendingItems?.map((item, index) => (
          <div key={index} className="flex justify-between">
            <span>{item.description || 'Tanpa Deskripsi'}</span>
            <span>{formatToRupiah(item.amount)}</span>
          </div>
        ))}
         <div className="font-bold flex justify-between border-t pt-2">
            <span>Total Pembelanjaan</span>
            <span>{formatToRupiah(report.manualSpending)}</span>
        </div>
        <Alert>
          <AlertTitle className={cn(report.finalLiabilityForNextDay < 0 && "text-destructive")}>LIABILITAS FINAL (Untuk Besok)</AlertTitle>
          <AlertDescription className={cn("text-lg font-bold", report.finalLiabilityForNextDay < 0 && "text-destructive")}>{formatToRupiah(report.finalLiabilityForNextDay)}</AlertDescription>
        </Alert>
      </div>
    </div>
  );


  const renderSectionD = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-primary">D. Aset Lancar (Inventaris)</h2>
      <div className="space-y-2 text-sm">
         <div className="flex justify-between"><span>Aset Aksesoris</span><span>{formatToRupiah(report.assetAccessories)}</span></div>
         <div className="flex justify-between"><span>Aset Perdana</span><span>{formatToRupiah(report.assetSIMCards)}</span></div>
         <div className="flex justify-between"><span>Aset Voucher</span><span>{formatToRupiah(report.assetVouchers)}</span></div>
      </div>
       <div className="mt-2 pt-2 border-t font-bold flex justify-between text-base">
            <span>TOTAL ASET LANCAR</span>
            <span>{formatToRupiah(report.totalCurrentAssets)}</span>
        </div>
    </div>
  );
  
  const renderSectionE_H = () => (
    <div className="space-y-4">
        <h2 className="text-lg font-bold text-primary">E & H. Laba & Biaya</h2>
        <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center"><span>Laba Kotor BRILink</span> <span className="font-medium">{formatToRupiah(report.grossProfitBrilink)}</span></div>
            <div className="flex justify-between items-center"><span>Laba Kotor PPOB</span> <span className="font-medium">{formatToRupiah(report.grossProfitPPOB)}</span></div>
            <div className="flex justify-between items-center"><span>Laba Kotor POS</span> <span className="font-medium">{formatToRupiah(report.posGrossProfit)}</span></div>
             <div className="flex justify-between items-center font-bold border-t pt-2"><span>TOTAL LABA KOTOR</span> <span>{formatToRupiah(report.totalGrossProfit)}</span></div>

            <div className="flex justify-between items-center"><span>Biaya Operasional</span> <span className="font-medium text-destructive">{formatToRupiah(report.operationalCosts)}</span></div>
            <div className="flex justify-between items-center font-bold border-t pt-2"><span>LABA BERSIH (NETT PROFIT)</span> <span className={cn(report.netProfit < 0 && "text-destructive")}>{formatToRupiah(report.netProfit)}</span></div>
        </div>
    </div>
  );
  
  const renderSectionF = () => (
     <div className="space-y-4">
        <h2 className="text-lg font-bold text-primary">F. Timbangan (Neraca)</h2>
        <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Kas Laci Kecil</span><span>{formatToRupiah(report.cashInDrawer)}</span></div>
            <div className="flex justify-between"><span>Kas Brankas</span><span>{formatToRupiah(report.cashInSafe)}</span></div>
        </div>
        <div className="space-y-3 text-sm mt-4">
            <div className="flex justify-between"><span>Total Kas Fisik</span> <span className="font-medium">{formatToRupiah(report.totalPhysicalCash)}</span></div>
            <div className="flex justify-between"><span>Total Saldo Akun</span> <span className="font-medium">{formatToRupiah(report.totalAccountBalance)}</span></div>
            <div className="flex justify-between"><span>LIABILITAS FINAL</span> <span className={cn("font-medium", report.finalLiabilityForNextDay < 0 && "text-destructive")}>{formatToRupiah(report.finalLiabilityForNextDay)}</span></div>
            <div className="flex justify-between font-bold border-t pt-2"><span>TOTAL KESELURUHAN</span> <span>{formatToRupiah(report.grandTotalBalance)}</span></div>
             <div className="flex justify-between mt-4"><span>Aset Lancar</span> <span className="font-medium">{formatToRupiah(report.totalCurrentAssets)}</span></div>
             <div className="flex justify-between font-bold border-t pt-2 text-green-500"><span>AKUMULASI SALDO LIQUID</span> <span className={cn(report.liquidAccumulation < 0 && "text-destructive")}>{formatToRupiah(report.liquidAccumulation)}</span></div>
        </div>
    </div>
  )


  return (
    <div className="h-full flex flex-col bg-background">
      <header className="p-4 flex items-center gap-4 border-b">
        <Button variant="ghost" size="icon" onClick={onDone}>
            <ArrowLeft />
        </Button>
        <div className="flex-1">
            <h1 className="text-lg font-semibold">Detail Laporan Harian</h1>
            <p className="text-sm text-muted-foreground">{format(new Date(report.date.seconds * 1000), "EEEE, dd MMMM yyyy", { locale: idLocale })}</p>
        </div>
        <Button variant="outline" size="sm" disabled>
            <Download size={16} className="mr-2"/>
            Unduh PDF
        </Button>
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
    </div>
  );
}
