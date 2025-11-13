
"use client";

import { useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs, where, Timestamp, orderBy, doc } from 'firebase/firestore';
import type { DailyReport, Transaction, Settlement, PPOBTransaction, PPOBPlnPostpaid, PPOBPdam, PPOBBpjs, PPOBWifi, CustomerTransfer, CustomerWithdrawal, CustomerTopUp, CustomerEmoneyTopUp, CustomerVAPayment, EDCService, CustomerKJPWithdrawal } from '@/lib/types';
import type { KasAccount } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ArrowLeft, Download, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfDay, endOfDay } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '../ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';

interface CombinedReportClientProps {
  onDone: () => void;
}

type BrilinkProfitItem = (CustomerTransfer | CustomerWithdrawal | CustomerTopUp | CustomerEmoneyTopUp | CustomerVAPayment | EDCService | CustomerKJPWithdrawal) & { id: string; transactionType: string; };
type PpobProfitItem = (PPOBTransaction | PPOBPlnPostpaid | PPOBPdam | PPOBBpjs | PPOBWifi) & { id: string; };

interface ReportData {
    dailyReport: DailyReport | null;
    brilinkProfitItems: BrilinkProfitItem[];
    ppobProfitItems: PpobProfitItem[];
    capitalAdditions: { date: Date, description: string, account: string, amount: number }[];
    operationalCosts: { date: Date, description: string, amount: number, source: string }[];
}

const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '' || isNaN(Number(value))) return 'Rp 0';
    const num = Number(String(value).replace(/[^0-9-]/g, ''));
    const isNegative = num < 0;
    return `${isNegative ? '-Rp ' : 'Rp '}${Math.abs(num).toLocaleString('id-ID')}`;
};

export default function CombinedReportClient({ onDone }: CombinedReportClientProps) {
  const firestore = useFirestore();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfDay(new Date()), to: endOfDay(new Date()) });
  const [isDownloading, setIsDownloading] = useState(false);

  const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);
  
  const getAccountLabel = (accountId?: string) => {
    if (!accountId || !kasAccounts) return 'N/A';
    return kasAccounts.find(acc => acc.id === accountId)?.label || accountId;
  };
  
  useEffect(() => {
    const fetchAllData = async () => {
        if (!firestore || !dateRange?.from || !kasAccounts) return;
        setIsLoading(true);
        setReportData(null);

        const dateFrom = startOfDay(dateRange.from);
        const dateTo = endOfDay(dateRange.to || dateRange.from);
        const tsFrom = Timestamp.fromDate(dateFrom);
        const tsTo = Timestamp.fromDate(dateTo);
        
        try {
            // 1. Daily Report
            const dailyReportQuery = query(collection(firestore, "dailyReports"), where('date', '>=', tsFrom), where('date', '<=', tsTo), orderBy('date', 'desc'));
            const dailyReportSnapshot = await getDocs(dailyReportQuery);
            const dailyReport: DailyReport | null = dailyReportSnapshot.empty ? null : dailyReportSnapshot.docs[0].data() as DailyReport;

            // 2. Profit/Loss Data
            const brilinkCollections = [
                { name: 'customerTransfers', type: 'Transfer' }, 
                { name: 'customerWithdrawals', type: 'Tarik Tunai' }, 
                { name: 'customerTopUps', type: 'Top Up' }, 
                { name: 'customerEmoneyTopUps', type: 'Top Up E-Money' }, 
                { name: 'customerVAPayments', type: 'VA Payment' }, 
                { name: 'edcServices', type: 'Layanan EDC' }, 
                { name: 'customerKJPWithdrawals', type: 'Tarik Tunai KJP' }
            ];
            const ppobCollections = ['ppobTransactions', 'ppobPlnPostpaid', 'ppobPdam', 'ppobBpjs', 'ppobWifi'];
            
            let brilinkProfitItems: BrilinkProfitItem[] = [];
            let ppobProfitItems: PpobProfitItem[] = [];

            for (const colInfo of brilinkCollections) {
                const q = query(collection(firestore, colInfo.name), where('date', '>=', tsFrom), where('date', '<=', tsTo));
                const snapshot = await getDocs(q);
                snapshot.forEach(doc => { 
                    brilinkProfitItems.push({ ...doc.data(), id: doc.id, transactionType: colInfo.type } as BrilinkProfitItem);
                });
            }

            for (const col of ppobCollections) {
                const q = query(collection(firestore, col), where('date', '>=', tsFrom), where('date', '<=', tsTo));
                const snapshot = await getDocs(q);
                snapshot.forEach(doc => { 
                    ppobProfitItems.push({ ...doc.data(), id: doc.id } as PpobProfitItem);
                });
            }

            // 3. Capital Additions
            let capitalAdditions: ReportData['capitalAdditions'] = [];
            for (const account of kasAccounts) {
                const transQuery = query(collection(firestore, 'kasAccounts', account.id, 'transactions'), where('category', '==', 'capital'), where('date', '>=', dateFrom.toISOString()), where('date', '<=', dateTo.toISOString()));
                const transSnapshot = await getDocs(transQuery);
                transSnapshot.forEach(docSnap => {
                    const trx = docSnap.data() as Transaction;
                    if (trx.type === 'credit') {
                        capitalAdditions.push({ date: new Date(trx.date), description: trx.name, account: account.label, amount: trx.amount });
                    }
                });
            }
            capitalAdditions.sort((a,b) => b.date.getTime() - a.date.getTime());


            // 4. Operational Costs
            let operationalCosts: ReportData['operationalCosts'] = [];
            const feeCategories = ['operational', 'operational_fee', 'transfer_fee'];
            const settlementsQuery = query(collection(firestore, 'settlements'), where('date', '>=', tsFrom), where('date', '<=', tsTo));
            const settlementsSnapshot = await getDocs(settlementsQuery);
            settlementsSnapshot.forEach(docSnap => {
                const data = docSnap.data() as Settlement;
                if (data.mdrFee > 0) {
                    operationalCosts.push({ date: (data.date as any).toDate(), description: `Biaya MDR Settlement dari ${getAccountLabel(data.sourceMerchantAccountId)}`, amount: data.mdrFee, source: 'Settlement' });
                }
            });
            for (const account of kasAccounts) {
                const transQuery = query(collection(firestore, 'kasAccounts', account.id, 'transactions'), where('category', 'in', feeCategories), where('date', '>=', dateFrom.toISOString()), where('date', '<=', dateTo.toISOString()));
                const transSnapshot = await getDocs(transQuery);
                transSnapshot.forEach(docSnap => {
                    const trx = docSnap.data() as Transaction;
                    operationalCosts.push({ date: new Date(trx.date), description: trx.name, amount: trx.amount, source: `Akun ${account.label}` });
                });
            }
            operationalCosts.sort((a, b) => b.date.getTime() - a.date.getTime());
            
            setReportData({ dailyReport, brilinkProfitItems, ppobProfitItems, capitalAdditions, operationalCosts });
        } catch (error) {
            console.error("Error fetching combined report data:", error);
        } finally {
            setIsLoading(false);
        }
    };
    
    if (kasAccounts) {
      fetchAllData();
    }
  }, [firestore, dateRange, kasAccounts]);


  const handleDownloadPDF = async () => {
    if (!reportData) return;
    setIsDownloading(true);

    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();
    const dateFrom = startOfDay(dateRange!.from!);
    const dateTitle = format(dateFrom, "EEEE, dd MMMM yyyy", { locale: idLocale });
    let finalY = 0;

    const addReportTitle = (title: string): number => {
        doc.setFontSize(18);
        doc.text(title, 14, 22);
        doc.setFontSize(10);
        doc.text(dateTitle, 14, 29);
        return 37;
    };
    
    const addGridSection = (title: string, head: any[], body: any[], startY: number, columnStyles?: any, showHead: boolean = true): number => {
        doc.setFontSize(12);
        doc.text(title, 14, startY);
        autoTable(doc, { head: showHead ? head : [], body, startY: startY + 2, theme: 'grid', headStyles: { fillColor: '#f1f5f9', textColor: '#000', fontSize: 9 }, styles: { fontSize: 9 }, columnStyles: columnStyles || { 1: { halign: 'right' } } });
        return (doc as any).lastAutoTable.finalY + 8;
    };

    // --- 1. Daily Report V5 ---
    try {
        finalY = addReportTitle('Laporan Harian V5');
        if (reportData.dailyReport) {
            const report = reportData.dailyReport;
            const sectionA_Body = report.accountSnapshots.map(acc => [acc.label, formatToRupiah(acc.balance)]);
            finalY = addGridSection('A. Saldo Akun', [['Akun', 'Saldo']], sectionA_Body, finalY);
            autoTable(doc, { body: [[{ content: 'TOTAL', styles: { fontStyle: 'bold' } }, { content: formatToRupiah(report.totalAccountBalance), styles: { fontStyle: 'bold', halign: 'right' } }]], startY: (doc as any).lastAutoTable.finalY, theme: 'grid', styles: {fontSize: 9} });
            finalY = (doc as any).lastAutoTable.finalY + 8;

            const sectionB_Body = [['Saldo Laporan Kemarin', formatToRupiah(report.openingBalanceRotation)], ['Penambahan Modal', formatToRupiah(report.capitalAdditionToday)], [{ content: "LIABILITAS (Kewajiban A)", styles: { fontStyle: 'bold' } }, { content: formatToRupiah(report.liabilityBeforePayment), styles: { fontStyle: 'bold' } }], ['Dana Dibayar A ke B', formatToRupiah(report.paymentToPartyB)], [{ content: "LIABILITAS Setelah Bayar", styles: { fontStyle: 'bold' } }, { content: formatToRupiah(report.liabilityAfterPayment), styles: { fontStyle: 'bold' } }]];
            finalY = addGridSection('B. Rotasi Saldo', [], sectionB_Body, finalY, { 1: { halign: 'right' } }, false);
            
            const sectionC_Body = [...(report.spendingItems?.map(item => [item.description, formatToRupiah(item.amount)]) || [['- Tidak ada -', '']]), [{ content: 'Total Pembelanjaan', styles: { fontStyle: 'bold' } }, { content: formatToRupiah(report.manualSpending), styles: { fontStyle: 'bold' } }]];
            finalY = addGridSection('C. Pembelanjaan', [['Deskripsi', 'Jumlah']], sectionC_Body, finalY);
            autoTable(doc, { body: [[{ content: 'LIABILITAS FINAL (Untuk Besok)', styles: { fontStyle: 'bold', fillColor: '#fef2f2', textColor: '#ef4444' } }, { content: formatToRupiah(report.finalLiabilityForNextDay), styles: { fontStyle: 'bold', fillColor: '#fef2f2', textColor: '#ef4444' } }]], startY: (doc as any).lastAutoTable.finalY, theme: 'grid', styles: {fontSize: 9} });
            finalY = (doc as any).lastAutoTable.finalY + 8;
            
            const sectionD_Body = [['Aset Aksesoris', formatToRupiah(report.assetAccessories)], ['Aset Perdana', formatToRupiah(report.assetSIMCards)], ['Aset Voucher', formatToRupiah(report.assetVouchers)], [{content: 'TOTAL ASET LANCAR', styles: {fontStyle: 'bold'}}, {content: formatToRupiah(report.totalCurrentAssets), styles: {fontStyle: 'bold'}}]];
            finalY = addGridSection('D. Aset Lancar', [], sectionD_Body, finalY, { 1: { halign: 'right' } }, false);

            const sectionE_Body = [['Laba Kotor BRILink', formatToRupiah(report.grossProfitBrilink)], ['Laba Kotor PPOB', formatToRupiah(report.grossProfitPPOB)], ['Laba Kotor POS', formatToRupiah(report.posGrossProfit)], [{content: 'TOTAL LABA KOTOR', styles: {fontStyle: 'bold'}}, {content: formatToRupiah(report.totalGrossProfit), styles: {fontStyle: 'bold'}}]];
            finalY = addGridSection('E. Laba', [], sectionE_Body, finalY, { 1: { halign: 'right' } }, false);

            const sectionF_Body = [['Kas Laci Kecil', formatToRupiah(report.cashInDrawer)],['Kas Brankas', formatToRupiah(report.cashInSafe)],[{content: 'Total Kas Fisik', styles: {fontStyle: 'bold'}}, {content: formatToRupiah(report.totalPhysicalCash), styles: {fontStyle: 'bold'}}],['Total Saldo Akun', formatToRupiah(report.totalAccountBalance)],['LIABILITAS FINAL', formatToRupiah(report.finalLiabilityForNextDay)],[{content: 'Total Laba Kotor', styles: {textColor: '#ef4444'}}, {content: `- ${formatToRupiah(report.totalGrossProfit)}`, styles: {textColor: '#ef4444'}}],[{content: 'Potongan Non Profit', styles: {textColor: '#ef4444'}}, {content: `- ${formatToRupiah(report.operationalNonProfit)}`, styles: {textColor: '#ef4444'}}],[{content: 'TOTAL KESELURUHAN', styles: {fontStyle: 'bold', textColor: '#22c55e'}}, {content: formatToRupiah(report.grandTotalBalance), styles: {fontStyle: 'bold', textColor: '#22c55e'}}],['Aset Lancar', formatToRupiah(report.totalCurrentAssets)],[{content: 'TOTAL KEKAYAAN', styles: {fontStyle: 'bold'}}, {content: formatToRupiah(report.liquidAccumulation), styles: {fontStyle: 'bold'}}]];
            finalY = addGridSection('F. Timbangan (Neraca)', [], sectionF_Body, finalY, { 1: { halign: 'right' } }, false);
            
            const sectionG_Body = [['Total Biaya Operasional', formatToRupiah(report.operationalCosts)], [{content: 'LABA BERSIH (NETT PROFIT)', styles: {fontStyle: 'bold'}}, {content: formatToRupiah(report.netProfit), styles: {fontStyle: 'bold'}}]];
            finalY = addGridSection('G. Biaya Operasional', [], sectionG_Body, finalY, { 1: { halign: 'right' } }, false);

        } else {
            doc.setFontSize(10); doc.text("Tidak ada data Laporan Harian V5 untuk tanggal ini.", 14, finalY); finalY += 10;
        }

    } catch (e) { console.error("Error generating Daily Report V5 part:", e); }


    // --- 2. Profit/Loss Report ---
    doc.addPage();
    try {
        finalY = addReportTitle('Laporan Laba/Rugi');
        const brilinkBody = reportData.brilinkProfitItems.map(item => {
            const profit = 'netProfit' in item ? item.netProfit : item.serviceFee;
            return [item.transactionType, ('destinationAccountName' in item ? item.destinationAccountName : item.customerName), formatToRupiah(profit)];
        });
        const ppobBody = reportData.ppobProfitItems.map(item => {
            const profit = 'profit' in item ? item.profit : item.netProfit;
            const destination = 'destination' in item ? item.destination : item.customerName;
            return [('serviceName' in item ? item.serviceName : 'PPOB'), destination, formatToRupiah(profit)];
        });
        
        finalY = addGridSection('BRILink', [['Layanan', 'Nama', 'Laba']], brilinkBody, finalY, { 2: { halign: 'right' } });
        finalY = addGridSection('PPOB', [['Layanan', 'Tujuan', 'Laba']], ppobBody, finalY, { 2: { halign: 'right' } });
    } catch (e) { console.error("Error generating P/L Report part:", e); }
    
    // --- 3. Capital Addition Report ---
    doc.addPage();
    try {
        finalY = addReportTitle('Laporan Penambahan Saldo');
        let capitalBody: any[] = reportData.capitalAdditions.length > 0 ? reportData.capitalAdditions.map(trx => [format(trx.date, 'dd/MM HH:mm'), trx.description, trx.account, formatToRupiah(trx.amount)]) : [['Tidak ada data', '', '', '']];
        finalY = addGridSection('', [['Tanggal', 'Deskripsi', 'Ke Akun', 'Jumlah']], capitalBody, finalY, { 3: { halign: 'right' } });
    } catch (e) { console.error("Error generating Capital Addition Report part:", e); }

    // --- 4. Operational Cost Report ---
    doc.addPage();
    try {
        finalY = addReportTitle('Laporan Biaya Operasional');
        let costBody: any[] = reportData.operationalCosts.length > 0 ? reportData.operationalCosts.map(trx => [format(trx.date, 'dd/MM HH:mm'), trx.description, trx.source, formatToRupiah(trx.amount)]) : [['Tidak ada data', '', '', '']];
        finalY = addGridSection('', [['Tanggal', 'Deskripsi', 'Sumber', 'Jumlah']], costBody, finalY, { 3: { halign: 'right' } });
    } catch (e) { console.error("Error generating OpCost Report part:", e); }


    // --- Finalize PDF ---
    const pdfOutput = doc.output('datauristring');
    const pdfWindow = window.open();
    if (pdfWindow) {
        pdfWindow.document.write(`<iframe width='100%' height='100%' src='${pdfOutput}'></iframe>`);
    } else {
        alert('Gagal membuka jendela baru. Mohon izinkan pop-up untuk situs ini.');
    }

    setIsDownloading(false);
  };
  
  const totalGrossProfit = (reportData?.brilinkProfitItems.reduce((s, i) => s + ('netProfit' in i ? i.netProfit : i.serviceFee), 0) || 0) + (reportData?.ppobProfitItems.reduce((s, i) => s + ('profit' in i ? i.profit : i.netProfit), 0) || 0);
  const totalOperationalCosts = reportData?.operationalCosts.reduce((sum, item) => sum + item.amount, 0) || 0;
  const netProfit = totalGrossProfit - totalOperationalCosts;
  const totalCapitalAdditions = reportData?.capitalAdditions.reduce((s, i) => s + i.amount, 0) || 0;

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="p-4 space-y-4 border-b">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onDone}>
            <ArrowLeft />
          </Button>
          <h1 className="text-lg font-semibold flex-1">Laporan Gabungan</h1>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button id="date" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to && dateRange.from !== dateRange.to ? (
                  <>
                    {format(dateRange.from, "d MMMM yyyy", { locale: idLocale })} - {format(dateRange.to, "d MMMM yyyy", { locale: idLocale })}
                  </>
                ) : (
                  format(dateRange.from, "d MMMM yyyy", { locale: idLocale })
                )
              ) : (
                <span>Pilih rentang tanggal</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={1}
            />
          </PopoverContent>
        </Popover>
      </header>
      <ScrollArea className="flex-1 p-4">
        {isLoading && (
            <div className="space-y-4">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
        )}
        {!isLoading && reportData && (
            <div className="space-y-6">
                 <Accordion type="multiple" defaultValue={['daily-report', 'profit-loss']}>
                    <AccordionItem value="daily-report">
                        <AccordionTrigger className="text-lg font-bold">Laporan Harian V5</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-4">
                            {reportData.dailyReport ? (
                                <>
                                  <Table>
                                    <TableHeader><TableRow><TableHead>Akun</TableHead><TableHead className="text-right">Saldo</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                      {reportData.dailyReport.accountSnapshots.map(acc => <TableRow key={acc.label}><TableCell>{acc.label}</TableCell><TableCell className="text-right">{formatToRupiah(acc.balance)}</TableCell></TableRow>)}
                                    </TableBody>
                                    <TableFooter><TableRow><TableCell className="font-bold">TOTAL</TableCell><TableCell className="text-right font-bold">{formatToRupiah(reportData.dailyReport.totalAccountBalance)}</TableCell></TableRow></TableFooter>
                                  </Table>
                                  <p className="text-sm"><span className="text-muted-foreground">Liabilitas Final (Untuk Besok):</span> <span className="font-bold">{formatToRupiah(reportData.dailyReport.finalLiabilityForNextDay)}</span></p>
                                </>
                            ) : <p className="text-sm text-muted-foreground text-center py-4">Tidak ada data Laporan Harian V5.</p>}
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="profit-loss">
                        <AccordionTrigger className="text-lg font-bold">Laporan Laba/Rugi</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-4">
                            <h3 className="font-semibold">BRILink</h3>
                             <Table>
                                <TableHeader><TableRow><TableHead>Layanan</TableHead><TableHead className="text-right">Laba</TableHead></TableRow></TableHeader>
                                <TableBody>
                                  {reportData.brilinkProfitItems.map(item => <TableRow key={item.id}><TableCell>{item.transactionType}</TableCell><TableCell className="text-right">{formatToRupiah('netProfit' in item ? item.netProfit : item.serviceFee)}</TableCell></TableRow>)}
                                </TableBody>
                            </Table>
                             <h3 className="font-semibold mt-4">PPOB</h3>
                             <Table>
                                <TableHeader><TableRow><TableHead>Layanan</TableHead><TableHead className="text-right">Laba</TableHead></TableRow></TableHeader>
                                <TableBody>
                                   {reportData.ppobProfitItems.map(item => <TableRow key={item.id}><TableCell>{'serviceName' in item ? item.serviceName : 'PPOB'}</TableCell><TableCell className="text-right">{formatToRupiah('profit' in item ? item.profit : item.netProfit)}</TableCell></TableRow>)}
                                </TableBody>
                            </Table>
                             <div className="flex justify-between font-bold text-base border-t pt-2 mt-2"><span>Total Laba Kotor</span><span>{formatToRupiah(totalGrossProfit)}</span></div>
                        </AccordionContent>
                    </AccordionItem>
                     <AccordionItem value="operational-cost">
                        <AccordionTrigger className="text-lg font-bold">Laporan Biaya Operasional</AccordionTrigger>
                         <AccordionContent className="space-y-2 pt-4">
                           {reportData.operationalCosts.length > 0 ? (
                                <Table>
                                    <TableHeader><TableRow><TableHead>Deskripsi</TableHead><TableHead className="text-right">Jumlah</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                    {reportData.operationalCosts.map((item, i) => <TableRow key={i}><TableCell>{item.description}</TableCell><TableCell className="text-right text-destructive">- {formatToRupiah(item.amount)}</TableCell></TableRow>)}
                                    </TableBody>
                                    <TableFooter><TableRow><TableCell className="font-bold">Total Biaya</TableCell><TableCell className="text-right font-bold text-destructive">{formatToRupiah(totalOperationalCosts)}</TableCell></TableRow></TableFooter>
                                </Table>
                           ) : <p className="text-sm text-muted-foreground text-center py-4">Tidak ada biaya operasional.</p>}
                         </AccordionContent>
                    </AccordionItem>
                     <AccordionItem value="net-profit-summary">
                        <AccordionTrigger className="text-lg font-bold">Ringkasan Laba Bersih</AccordionTrigger>
                        <AccordionContent className="space-y-2 text-sm pt-4">
                            <div className="flex justify-between"><span>Total Laba Kotor</span><span>{formatToRupiah(totalGrossProfit)}</span></div>
                            <div className="flex justify-between text-destructive"><span>Total Biaya Operasional</span><span>- {formatToRupiah(totalOperationalCosts)}</span></div>
                            <Separator className="my-2"/>
                            <div className="flex justify-between font-bold text-base"><span>Total Laba Bersih</span><span className={cn(netProfit < 0 ? "text-destructive" : "text-green-500")}>{formatToRupiah(netProfit)}</span></div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="capital-addition">
                        <AccordionTrigger className="text-lg font-bold">Laporan Penambahan Modal</AccordionTrigger>
                        <AccordionContent className="pt-4">
                           {reportData.capitalAdditions.length > 0 ? (
                                <Table>
                                    <TableHeader><TableRow><TableHead>Deskripsi</TableHead><TableHead>Ke Akun</TableHead><TableHead className="text-right">Jumlah</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                    {reportData.capitalAdditions.map((item, i) => <TableRow key={i}><TableCell>{item.description}</TableCell><TableCell>{item.account}</TableCell><TableCell className="text-right">{formatToRupiah(item.amount)}</TableCell></TableRow>)}
                                    </TableBody>
                                    <TableFooter><TableRow><TableCell colSpan={2} className="font-bold">Total Tambah Modal</TableCell><TableCell className="text-right font-bold">{formatToRupiah(totalCapitalAdditions)}</TableCell></TableRow></TableFooter>
                                </Table>
                           ) : <p className="text-sm text-muted-foreground text-center py-4">Tidak ada penambahan modal.</p>}
                        </AccordionContent>
                    </AccordionItem>
                 </Accordion>
            </div>
        )}
         {!isLoading && !reportData && (
             <div className="text-center py-20 text-muted-foreground">
                 <p>Pilih tanggal untuk melihat laporan gabungan.</p>
             </div>
         )}
      </ScrollArea>
      <footer className="p-4 border-t">
        <Button className="w-full" onClick={handleDownloadPDF} disabled={isDownloading || isLoading || !reportData}>
          {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {isDownloading ? 'Menyiapkan PDF...' : 'Unduh Laporan Gabungan'}
        </Button>
      </footer>
    </div>
  );
}
