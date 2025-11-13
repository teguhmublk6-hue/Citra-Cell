
"use client";

import { useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs, where, Timestamp, orderBy } from 'firebase/firestore';
import type { DailyReport, Transaction, Settlement } from '@/lib/types';
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

interface CombinedReportClientProps {
  onDone: () => void;
}

interface ReportData {
    dailyReport: DailyReport | null;
    brilinkProfit: number;
    ppobProfit: number;
    capitalAdditions: { date: Date, description: string, account: string, amount: number }[];
    operationalCosts: { date: Date, description: string, amount: number }[];
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
            const brilinkCollections = ['customerTransfers', 'customerWithdrawals', 'customerTopUps', 'customerEmoneyTopUps', 'customerVAPayments', 'edcServices', 'customerKJPWithdrawals'];
            const ppobCollections = ['ppobTransactions', 'ppobPlnPostpaid', 'ppobPdam', 'ppobBpjs', 'ppobWifi', 'ppobPaketTelpon'];
            
            let brilinkProfit = 0;
            let ppobProfit = 0;

            for (const col of brilinkCollections) {
                const q = query(collection(firestore, col), where('date', '>=', tsFrom), where('date', '<=', tsTo));
                const snapshot = await getDocs(q);
                snapshot.forEach(doc => { brilinkProfit += (doc.data().netProfit ?? doc.data().serviceFee ?? 0); });
            }
            for (const col of ppobCollections) {
                const q = query(collection(firestore, col), where('date', '>=', tsFrom), where('date', '<=', tsTo));
                const snapshot = await getDocs(q);
                snapshot.forEach(doc => { ppobProfit += (doc.data().profit ?? doc.data().netProfit ?? 0); });
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

            // 4. Operational Costs
            let operationalCosts: ReportData['operationalCosts'] = [];
            const feeCategories = ['operational', 'operational_fee', 'transfer_fee'];
            const settlementsQuery = query(collection(firestore, 'settlements'), where('date', '>=', tsFrom), where('date', '<=', tsTo));
            const settlementsSnapshot = await getDocs(settlementsQuery);
            settlementsSnapshot.forEach(docSnap => {
                const data = docSnap.data() as Settlement;
                if (data.mdrFee > 0) {
                    operationalCosts.push({ date: (data.date as any).toDate(), description: `Biaya MDR Settlement dari ${getAccountLabel(data.sourceMerchantAccountId)}`, amount: data.mdrFee });
                }
            });
            for (const account of kasAccounts) {
                const transQuery = query(collection(firestore, 'kasAccounts', account.id, 'transactions'), where('category', 'in', feeCategories), where('date', '>=', dateFrom.toISOString()), where('date', '<=', dateTo.toISOString()));
                const transSnapshot = await getDocs(transQuery);
                transSnapshot.forEach(docSnap => {
                    const trx = docSnap.data() as Transaction;
                    operationalCosts.push({ date: new Date(trx.date), description: trx.name, amount: trx.amount });
                });
            }
            
            setReportData({ dailyReport, brilinkProfit, ppobProfit, capitalAdditions, operationalCosts });
        } catch (error) {
            console.error("Error fetching combined report data:", error);
        } finally {
            setIsLoading(false);
        }
    };
    
    fetchAllData();
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

    const addReportTitle = (title: string, startY: number): number => {
        doc.setFontSize(18);
        doc.text(title, 14, startY);
        doc.setFontSize(10);
        doc.text(dateTitle, 14, startY + 7);
        return startY + 15;
    };
    
    const addGridSection = (title: string, head: any[], body: any[], startY: number, columnStyles?: any): number => {
        doc.setFontSize(12);
        doc.text(title, 14, startY);
        autoTable(doc, { head, body, startY: startY + 2, theme: 'grid', headStyles: { fillColor: '#f1f5f9', textColor: '#000', fontSize: 9 }, styles: { fontSize: 9 }, columnStyles: columnStyles || { 1: { halign: 'right' } } });
        return (doc as any).lastAutoTable.finalY + 8;
    };

    // --- 1. Daily Report V5 ---
    try {
        finalY = addReportTitle('Laporan Harian V5', 22);
        if (reportData.dailyReport) {
            const report = reportData.dailyReport;
            const sectionA_Body = report.accountSnapshots.map(acc => [acc.label, formatToRupiah(acc.balance)]);
            finalY = addGridSection('A. Saldo Akun', [['Akun', 'Saldo']], sectionA_Body, finalY);
            autoTable(doc, { body: [[{ content: 'TOTAL', styles: { fontStyle: 'bold' } }, { content: formatToRupiah(report.totalAccountBalance), styles: { fontStyle: 'bold', halign: 'right' } }]], startY: (doc as any).lastAutoTable.finalY, theme: 'grid', styles: {fontSize: 9} });
            finalY = (doc as any).lastAutoTable.finalY + 8;
        } else {
            doc.setFontSize(10);
            doc.text("Tidak ada data Laporan Harian V5 untuk tanggal ini.", 14, finalY);
            finalY += 10;
        }

    } catch (e) { console.error("Error generating Daily Report V5 part:", e); }


    // --- 2. Profit/Loss Report ---
    doc.addPage();
    try {
        finalY = addReportTitle('Laporan Laba/Rugi', 22);
        const { brilinkProfit, ppobProfit } = reportData;

        autoTable(doc, {
            head: [['Deskripsi', 'Total Laba']],
            body: [
                ['BRILink', formatToRupiah(brilinkProfit)],
                ['PPOB', formatToRupiah(ppobProfit)],
                [{ content: 'TOTAL LABA KOTOR', styles: { fontStyle: 'bold' } }, { content: formatToRupiah(brilinkProfit + ppobProfit), styles: { fontStyle: 'bold' } }]
            ],
            startY: finalY,
            theme: 'grid',
            styles: {fontSize: 9},
            columnStyles: { 1: { halign: 'right' } }
        });
        finalY = (doc as any).lastAutoTable.finalY + 8;
    } catch (e) { console.error("Error generating P/L Report part:", e); }
    
    // --- 3. Capital Addition Report ---
    doc.addPage();
    try {
        finalY = addReportTitle('Laporan Penambahan Saldo', 22);
        const { capitalAdditions } = reportData;
        let capitalBody: any[] = capitalAdditions.length > 0 ? capitalAdditions.map(trx => [format(trx.date, 'dd/MM HH:mm'), trx.description, trx.account, formatToRupiah(trx.amount)]) : [['Tidak ada data', '', '', '']];
        
        finalY = addGridSection('Penambahan Saldo', [['Tanggal', 'Deskripsi', 'Ke Akun', 'Jumlah']], capitalBody, finalY, { 3: { halign: 'right' } });
        const totalCapitalAdditions = capitalAdditions.reduce((sum, trx) => sum + trx.amount, 0);
        autoTable(doc, { body: [[{ content: 'TOTAL', colSpan: 3, styles: { fontStyle: 'bold' } }, { content: formatToRupiah(totalCapitalAdditions), styles: { fontStyle: 'bold', halign: 'right' } }]], startY: (doc as any).lastAutoTable.finalY, theme: 'grid', styles: {fontSize: 9} });
        finalY = (doc as any).lastAutoTable.finalY + 8;

    } catch (e) { console.error("Error generating Capital Addition Report part:", e); }

    // --- 4. Operational Cost Report ---
    doc.addPage();
    try {
        finalY = addReportTitle('Laporan Biaya Operasional', 22);
        const { operationalCosts } = reportData;
        let costBody: any[] = operationalCosts.length > 0 ? operationalCosts.map(trx => [format(trx.date, 'dd/MM HH:mm'), trx.description, formatToRupiah(trx.amount)]) : [['Tidak ada data', '', '']];

        finalY = addGridSection('Biaya Operasional', [['Tanggal', 'Deskripsi', 'Jumlah']], costBody, finalY, { 2: { halign: 'right' } });
        const totalCosts = operationalCosts.reduce((sum, trx) => sum + trx.amount, 0);
        autoTable(doc, { body: [[{ content: 'TOTAL BIAYA', colSpan: 2, styles: { fontStyle: 'bold' } }, { content: formatToRupiah(totalCosts), styles: { fontStyle: 'bold', halign: 'right' } }]], startY: (doc as any).lastAutoTable.finalY, theme: 'grid', styles: {fontSize: 9} });
        finalY = (doc as any).lastAutoTable.finalY + 8;
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
  
  const totalGrossProfit = (reportData?.brilinkProfit || 0) + (reportData?.ppobProfit || 0) + (reportData?.dailyReport?.posGrossProfit || 0);
  const totalOperationalCosts = reportData?.operationalCosts.reduce((sum, item) => sum + item.amount, 0) || 0;
  const netProfit = totalGrossProfit - totalOperationalCosts;

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
                <Card>
                    <CardHeader><CardTitle className="text-base">Laporan Harian V5</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        {reportData.dailyReport ? (
                            <Table>
                                <TableBody>
                                    <TableRow><TableCell>Total Saldo Akun</TableCell><TableCell className="text-right">{formatToRupiah(reportData.dailyReport.totalAccountBalance)}</TableCell></TableRow>
                                    <TableRow><TableCell>Liabilitas Final (Untuk Besok)</TableCell><TableCell className="text-right">{formatToRupiah(reportData.dailyReport.finalLiabilityForNextDay)}</TableCell></TableRow>
                                    <TableRow><TableCell>Total Aset Lancar</TableCell><TableCell className="text-right">{formatToRupiah(reportData.dailyReport.totalCurrentAssets)}</TableCell></TableRow>
                                    <TableRow><TableCell>Total Kas Fisik</TableCell><TableCell className="text-right">{formatToRupiah(reportData.dailyReport.totalPhysicalCash)}</TableCell></TableRow>
                                </TableBody>
                            </Table>
                        ) : <p className="text-sm text-muted-foreground text-center py-4">Tidak ada data Laporan Harian V5.</p>}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-base">Laporan Laba/Rugi</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between"><span>Laba BRILink</span><span>{formatToRupiah(reportData.brilinkProfit)}</span></div>
                        <div className="flex justify-between"><span>Laba PPOB</span><span>{formatToRupiah(reportData.ppobProfit)}</span></div>
                        <div className="flex justify-between"><span>Laba POS (Manual)</span><span>{formatToRupiah(reportData.dailyReport?.posGrossProfit)}</span></div>
                        <Separator className="my-2"/>
                        <div className="flex justify-between font-bold"><span>Total Laba Kotor</span><span>{formatToRupiah(totalGrossProfit)}</span></div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-base">Laporan Biaya Operasional</CardTitle></CardHeader>
                     <CardContent>
                        {reportData.operationalCosts.length > 0 ? (
                            <ul className="space-y-2 text-sm">
                                {reportData.operationalCosts.map((item, i) => <li key={i} className="flex justify-between"><span>{item.description}</span><span className="text-destructive">- {formatToRupiah(item.amount)}</span></li>)}
                            </ul>
                        ) : <p className="text-sm text-muted-foreground text-center py-4">Tidak ada biaya operasional.</p>}
                        <Separator className="my-2"/>
                        <div className="flex justify-between font-bold"><span>Total Biaya</span><span className="text-destructive">{formatToRupiah(totalOperationalCosts)}</span></div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-base">Ringkasan Laba Bersih</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between"><span>Total Laba Kotor</span><span>{formatToRupiah(totalGrossProfit)}</span></div>
                        <div className="flex justify-between text-destructive"><span>Total Biaya Operasional</span><span>- {formatToRupiah(totalOperationalCosts)}</span></div>
                        <Separator className="my-2"/>
                        <div className="flex justify-between font-bold text-base"><span>Total Laba Bersih</span><span className={cn(netProfit < 0 ? "text-destructive" : "text-green-500")}>{formatToRupiah(netProfit)}</span></div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-base">Laporan Penambahan Modal</CardTitle></CardHeader>
                    <CardContent>
                        {reportData.capitalAdditions.length > 0 ? (
                            <ul className="space-y-2 text-sm">
                                {reportData.capitalAdditions.map((item, i) => <li key={i} className="flex justify-between"><span>{item.description} ({item.account})</span><span>{formatToRupiah(item.amount)}</span></li>)}
                            </ul>
                        ) : <p className="text-sm text-muted-foreground text-center py-4">Tidak ada penambahan modal.</p>}
                        <Separator className="my-2"/>
                        <div className="flex justify-between font-bold"><span>Total Tambah Modal</span><span>{formatToRupiah(reportData.capitalAdditions.reduce((s, i) => s + i.amount, 0))}</span></div>
                    </CardContent>
                </Card>
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
