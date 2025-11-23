
"use client";

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DailyReport as DailyReportType } from '@/lib/data';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Separator } from '../ui/separator';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface DailyReportDetailClientProps {
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

export default function DailyReportDetailClient({ report, onDone }: DailyReportDetailClientProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleDownloadPDF = async () => {
    if (!report) return;
    setIsDownloading(true);

    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();
    let finalY = 14; 

    // === HEADER ===
    const reportDate = (report.date as any).toDate ? (report.date as any).toDate() : new Date(report.date);
    const dateTitle = format(reportDate, "EEEE, dd MMMM yyyy", { locale: idLocale });
    doc.setFontSize(16);
    doc.text('Detail Laporan Harian', 14, finalY);
    finalY += 8;
    doc.setFontSize(10);
    doc.text(dateTitle, 14, finalY);
    finalY += 10;

    const addSection = (title: string, body: any[], startY: number): number => {
        doc.setFontSize(12);
        doc.text(title, 14, startY);
        autoTable(doc, {
            body: body,
            startY: startY + 2,
            theme: 'plain',
            styles: { fontSize: 10 },
            columnStyles: { 1: { halign: 'right' } }
        });
        return (doc as any).lastAutoTable.finalY + 8;
    };
    
    const addGridSection = (title: string, head: any[], body: any[], startY: number): number => {
        doc.setFontSize(12);
        doc.text(title, 14, startY);
        autoTable(doc, {
            head: head,
            body: body,
            startY: startY + 2,
            theme: 'grid',
            headStyles: { fillColor: [241, 245, 249], textColor: [0,0,0], fontSize: 9 },
            styles: { fontSize: 10 },
            columnStyles: { 1: { halign: 'right' } }
        });
        return (doc as any).lastAutoTable.finalY + 8;
    };

    // A. Saldo Akun
    const sectionA_Body = [
        ...report.accountSnapshots.map(acc => [acc.label, formatToRupiah(acc.balance)]),
    ];
    finalY = addGridSection('A. Saldo Akun', [['Akun', 'Saldo']], sectionA_Body, finalY);
    autoTable(doc, {
      body: [[{ content: 'TOTAL SALDO AKUN', styles: { fontStyle: 'bold' } }, { content: formatToRupiah(report.totalAccountBalance), styles: { fontStyle: 'bold', halign: 'right' } }]],
      startY: (doc as any).lastAutoTable.finalY,
      theme: 'grid',
      styles: { fontSize: 10 }
    });
    finalY = (doc as any).lastAutoTable.finalY + 8;


    // B. Rotasi Saldo
    const sectionB_Body = [
        ['Saldo Laporan Kemarin', formatToRupiah(report.openingBalanceRotation)],
        [{content: 'Permintaan Penambahan Modal', styles: {textColor: '#ef4444'}}, {content: `- ${formatToRupiah(report.capitalAdditionToday)}`, styles: {textColor: '#ef4444'}}],
        [{ content: report.liabilityBeforePayment < 0 ? "LIABILITAS (Kewajiban A)" : "Piutang Pihak A", styles: { fontStyle: 'bold' } }, { content: formatToRupiah(report.liabilityBeforePayment), styles: { fontStyle: 'bold' } }],
        ['Dana Dibayar A ke B', formatToRupiah(report.paymentToPartyB)],
        [{ content: report.liabilityAfterPayment < 0 ? "LIABILITAS Setelah Bayar" : "Piutang Pihak A Setelah Bayar", styles: { fontStyle: 'bold' } }, { content: formatToRupiah(report.liabilityAfterPayment), styles: { fontStyle: 'bold' } }],
    ];
    finalY = addSection('B. Rotasi Saldo', sectionB_Body, finalY);

    // C. Pembelanjaan
    const spendingBody = report.spendingItems?.length > 0
      ? report.spendingItems.map(item => [item.description, formatToRupiah(item.amount)])
      : [['- Tidak ada pembelanjaan -', '']];
    const sectionC_Body = [
        ...spendingBody,
        [{ content: 'Total Pembelanjaan', styles: { fontStyle: 'bold' } }, { content: formatToRupiah(report.manualSpending), styles: { fontStyle: 'bold' } }],
        [{ content: 'LIABILITAS FINAL (Untuk Besok)', styles: { fontStyle: 'bold', fillColor: '#fef2f2', textColor: '#ef4444' } }, { content: formatToRupiah(report.finalLiabilityForNextDay), styles: { fontStyle: 'bold', fillColor: '#fef2f2', textColor: '#ef4444' } }],
    ];
    finalY = addGridSection('C. Pembelanjaan', [['Deskripsi', 'Jumlah']], sectionC_Body, finalY);

    // D. Aset Lancar
    const sectionD_Body = [
        ['Aset Aksesoris', formatToRupiah(report.assetAccessories)], 
        ['Aset Perdana', formatToRupiah(report.assetSIMCards)], 
        ['Aset Voucher', formatToRupiah(report.assetVouchers)], 
        [{content: 'TOTAL ASET LANCAR', styles: {fontStyle: 'bold'}}, {content: formatToRupiah(report.totalCurrentAssets), styles: {fontStyle: 'bold'}}]
    ];
    finalY = addSection('D. Aset Lancar (Inventaris)', sectionD_Body, finalY);

    // E. Laba
    const sectionE_Body = [
        ['Laba Kotor BRILink', formatToRupiah(report.grossProfitBrilink)], 
        ['Laba Kotor PPOB', formatToRupiah(report.grossProfitPPOB)], 
        ['Laba Kotor POS', formatToRupiah(report.posGrossProfit)], 
        [{content: 'TOTAL LABA KOTOR', styles: {fontStyle: 'bold'}}, {content: formatToRupiah(report.totalGrossProfit), styles: {fontStyle: 'bold'}}]
    ];
    finalY = addSection('E. Laba', sectionE_Body, finalY);
    
    // F. Timbangan
     const sectionF_Body = [
        ['Kas Laci Kecil', formatToRupiah(report.cashInDrawer)],
        ['Kas Brankas', formatToRupiah(report.cashInSafe)],
        [{content: 'Total Kas Fisik', styles: {fontStyle: 'bold'}}, {content: formatToRupiah(report.totalPhysicalCash), styles: {fontStyle: 'bold'}}],
        ['Total Saldo Akun', formatToRupiah(report.totalAccountBalance)],
        ['LIABILITAS FINAL', formatToRupiah(report.finalLiabilityForNextDay)],
        [{content: 'Total Laba Kotor', styles: {textColor: '#ef4444'}}, {content: `- ${formatToRupiah(report.totalGrossProfit)}`, styles: {textColor: '#ef4444'}}],
        [{content: 'TOTAL KESELURUHAN', styles: {fontStyle: 'bold', textColor: '#22c55e'}}, {content: formatToRupiah(report.grandTotalBalance), styles: {fontStyle: 'bold', textColor: '#22c55e'}}],
        ['Aset Lancar', formatToRupiah(report.totalCurrentAssets)],
        [{content: 'TOTAL KEKAYAAN', styles: {fontStyle: 'bold'}}, {content: formatToRupiah(report.liquidAccumulation), styles: {fontStyle: 'bold'}}],
    ];
    finalY = addSection('F. Timbangan (Neraca)', sectionF_Body, finalY);

    // G. Biaya Operasional
    const sectionG_Body = [
        ['Total Biaya Operasional', formatToRupiah(report.operationalCosts)], 
        [{content: 'LABA BERSIH (NETT PROFIT)', styles: {fontStyle: 'bold'}}, {content: formatToRupiah(report.netProfit), styles: {fontStyle: 'bold'}}]
    ];
    finalY = addSection('G. Biaya Operasional', sectionG_Body, finalY);

    const pdfOutput = doc.output('datauristring');
    const pdfWindow = window.open();
    if (pdfWindow) {
        pdfWindow.document.write(`<iframe width='100%' height='100%' src='${pdfOutput}'></iframe>`);
    } else {
        alert('Gagal membuka jendela baru. Mohon izinkan pop-up untuk situs ini.');
    }

    setIsDownloading(false);
  };

  const groupedAccounts = useMemo(() => {
    if (!report.accountSnapshots) return {};

    const groups = report.accountSnapshots.reduce((acc, account) => {
        const type = account.type || 'Lainnya';
        if (!acc[type]) {
            acc[type] = [];
        }
        acc[type].push(account);
        return acc;
    }, {} as Record<string, { label: string; balance: number; type: string; }[]>);
    
    return groups;
  }, [report.accountSnapshots]);

  const accountTypes = useMemo(() => {
      const order: (keyof typeof groupedAccounts)[] = ['Bank', 'E-Wallet', 'Merchant', 'PPOB', 'Tunai'];
      const dynamicTypes = Object.keys(groupedAccounts).filter(type => !order.includes(type));
      
      const allSortedTypes = order.concat(dynamicTypes.sort()).filter(type => groupedAccounts[type]);
      
      return allSortedTypes;
  }, [groupedAccounts]);

  const renderSectionA = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-primary">A. Saldo Akun</h2>
        <div className="space-y-4 text-sm">
          {accountTypes.map(type => (
            <div key={type}>
              <h3 className="font-semibold text-muted-foreground mb-2">{type}</h3>
              <div className="space-y-2">
                {groupedAccounts[type].map(acc => (
                  <div key={acc.label} className="flex justify-between">
                    <span>{acc.label}</span>
                    <span className="font-medium">{formatToRupiah(acc.balance)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-4 pt-4 border-t font-bold flex justify-between text-base">
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
                <div className="flex justify-between items-center text-destructive">
                    <span className="text-destructive">Penambahan Modal</span>
                    <span>- {formatToRupiah(report.capitalAdditionToday)}</span>
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
  
  const renderSectionE = () => (
    <div className="space-y-4">
        <h2 className="text-lg font-bold text-primary">E. Laba</h2>
        <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center"><span>Laba Kotor BRILink</span> <span className="font-medium">{formatToRupiah(report.grossProfitBrilink)}</span></div>
            <div className="flex justify-between items-center"><span>Laba Kotor PPOB</span> <span className="font-medium">{formatToRupiah(report.grossProfitPPOB)}</span></div>
            <div className="flex justify-between items-center"><span>Laba Kotor POS</span> <span className="font-medium">{formatToRupiah(report.posGrossProfit)}</span></div>
             <div className="flex justify-between items-center font-bold border-t pt-2"><span>TOTAL LABA KOTOR</span> <span>{formatToRupiah(report.totalGrossProfit)}</span></div>
        </div>
    </div>
  );

  const renderSectionG = () => (
    <div className="space-y-4">
        <h2 className="text-lg font-bold text-primary">G. Biaya Operasional</h2>
        <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center"><span>Total Biaya Operasional</span> <span className="font-medium text-destructive">{formatToRupiah(report.operationalCosts)}</span></div>
            <div className="flex justify-between items-center font-bold border-t pt-2 mt-4"><span>LABA BERSIH (NETT PROFIT)</span> <span className={cn(report.netProfit < 0 && "text-destructive")}>{formatToRupiah(report.netProfit)}</span></div>
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
            <div className="flex justify-between text-destructive"><span>Total Laba Kotor</span> <span className="font-medium">- {formatToRupiah(report.totalGrossProfit)}</span></div>
            
            <div className="flex justify-between font-bold border-t pt-2 text-green-500"><span>TOTAL KESELURUHAN</span> <span>{formatToRupiah(report.grandTotalBalance)}</span></div>
             <div className="flex justify-between mt-4"><span>Aset Lancar</span> <span className="font-medium">{formatToRupiah(report.totalCurrentAssets)}</span></div>
             <div className="flex justify-between font-bold border-t pt-2"><span>TOTAL KEKAYAAN</span> <span className={cn(report.liquidAccumulation < 0 && "text-destructive")}>{formatToRupiah(report.liquidAccumulation)}</span></div>
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
            <p className="text-sm text-muted-foreground">{format((report.date as any).toDate ? (report.date as any).toDate() : new Date(report.date), "EEEE, dd MMMM yyyy", { locale: idLocale })}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={isDownloading}>
            {isDownloading ? <Loader2 size={16} className="mr-2 animate-spin"/> : <Download size={16} className="mr-2"/>}
            {isDownloading ? 'Mengunduh...' : 'Unduh PDF'}
        </Button>
      </header>
      <ScrollArea className="flex-1">
        <div ref={reportRef} className="p-6 bg-background space-y-8">
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
        </div>
      </ScrollArea>
    </div>
  );
}

    