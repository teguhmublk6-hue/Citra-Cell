
"use client";

import { useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs, where, Timestamp, orderBy, doc } from 'firebase/firestore';
import type { DailyReport, Transaction, Settlement, PPOBTransaction, PPOBPlnPostpaid, PPOBPdam, PPOBBpjs, PPOBWifi, CustomerTransfer, CustomerWithdrawal, CustomerTopUp, CustomerEmoneyTopUp, CustomerVAPayment, EDCService, CustomerKJPWithdrawal, PPOBPaketTelpon } from '@/lib/types';
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';

interface CombinedReportClientProps {
  onDone: () => void;
}

type BrilinkProfitItem = (CustomerTransfer | CustomerWithdrawal | CustomerTopUp | CustomerEmoneyTopUp | CustomerVAPayment | EDCService | CustomerKJPWithdrawal) & { id: string; transactionType: string; };
type PpobProfitItem = (PPOBTransaction | PPOBPlnPostpaid | PPOBPdam | PPOBBpjs | PPOBWifi | PPOBPaketTelpon) & { id: string; };

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
            const ppobCollections = ['ppobTransactions', 'ppobPlnPostpaid', 'ppobPdam', 'ppobBpjs', 'ppobWifi', 'ppobPaketTelpon'];
            
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

    const doc = new jsPDF({ orientation: 'landscape' });
    const dateFrom = startOfDay(dateRange!.from!);
    const dateTitle = format(dateFrom, "EEEE, dd MMMM yyyy", { locale: idLocale });
    let finalY = 0;
    
    const pageMargin = 7;
    const reportDate = format(new Date(), "d MMM yyyy, HH:mm:ss");

    const addFooter = () => {
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Hal ${i} dari ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 7, { align: 'center' });
            doc.text(`Dibuat: ${reportDate}`, doc.internal.pageSize.width - pageMargin, doc.internal.pageSize.height - 7, { align: 'right' });
        }
    };

    const addReportTitle = (title: string, startY: number): number => {
        doc.setFontSize(16);
        doc.text(title, doc.internal.pageSize.width / 2, startY, { align: 'center' });
        doc.setFontSize(10);
        doc.text(dateTitle, doc.internal.pageSize.width / 2, startY + 7, { align: 'center' });
        return startY + 14;
    };
    
    const addGridSection = (title: string, head: any[], body: any[], startY: number, options?: any): number => {
        doc.setFontSize(12);
        doc.text(title, pageMargin, startY);
        autoTable(doc, { 
            head, body, startY: startY + 2, theme: 'grid', 
            headStyles: { fillColor: '#f1f5f9', textColor: '#000', fontSize: 8 }, 
            styles: { fontSize: 8, cellPadding: 1.5, ...options?.styles },
            columnStyles: options?.columnStyles,
            margin: { left: pageMargin, right: pageMargin }
        });
        return (doc as any).lastAutoTable.finalY + 8;
    };

    // --- PAGE 1: DAILY REPORT V7 ---
    finalY = addReportTitle('DAILY REPORT V7.0 - FINAL VERSION', 15);
    if (reportData.dailyReport) {
        const report = reportData.dailyReport;
        const sectionA_Body = report.accountSnapshots.map((acc, index) => [index + 1, acc.label, formatToRupiah(acc.balance)]);
        finalY = addGridSection('A. Saldo Akun', [['No', 'Akun', 'Saldo']], sectionA_Body, finalY, { columnStyles: { 0: { cellWidth: 10 }, 2: { halign: 'right' } } });
        // ... (Add other sections B to G similarly)
    } else {
        doc.setFontSize(10); doc.text("Tidak ada data Laporan Harian V7 untuk tanggal ini.", pageMargin, finalY); finalY += 10;
    }

    // --- PAGE 2: PROFIT/LOSS REPORT ---
    doc.addPage('landscape');
    finalY = addReportTitle('Laporan Laba/Rugi', 15);
    
    const brilinkBody = reportData.brilinkProfitItems.map((item, index) => {
        const profit = 'netProfit' in item ? item.netProfit : item.serviceFee;
        const nominal = 'transferAmount' in item ? item.transferAmount : ('withdrawalAmount' in item ? item.withdrawalAmount : ('topUpAmount' in item ? item.topUpAmount : ('paymentAmount' in item ? item.paymentAmount : 0)));
        const bankAdminFee = 'bankAdminFee' in item ? item.bankAdminFee : ('adminFee' in item ? item.adminFee : 0);
        const destinationName = 'destinationAccountName' in item ? item.destinationAccountName : item.customerName;
        const destinationBank = 'destinationBankName' in item ? item.destinationBankName : ('customerBankSource' in item ? item.customerBankSource : ('destinationEwallet' in item ? item.destinationEwallet : 'N/A'));
        return [index + 1, item.transactionType, destinationName, destinationBank, formatToRupiah(nominal), formatToRupiah(bankAdminFee), formatToRupiah(item.serviceFee), formatToRupiah(profit)];
    });
    const brilinkTotals = reportData.brilinkProfitItems.reduce((acc, item) => {
        acc.nominal += 'transferAmount' in item ? item.transferAmount : ('withdrawalAmount' in item ? item.withdrawalAmount : ('topUpAmount' in item ? item.topUpAmount : ('paymentAmount' in item ? item.paymentAmount : 0)));
        acc.admin += 'bankAdminFee' in item ? item.bankAdminFee : ('adminFee' in item ? item.adminFee : 0);
        acc.jasa += item.serviceFee;
        acc.laba += 'netProfit' in item ? item.netProfit : item.serviceFee;
        return acc;
    }, { nominal: 0, admin: 0, jasa: 0, laba: 0 });
    brilinkBody.push([{ content: 'TOTAL', colSpan: 4, styles: { fontStyle: 'bold', halign: 'center' } }, formatToRupiah(brilinkTotals.nominal), formatToRupiah(brilinkTotals.admin), formatToRupiah(brilinkTotals.jasa), { content: formatToRupiah(brilinkTotals.laba), styles: { fontStyle: 'bold' } }]);
    finalY = addGridSection('BRILink', [['No', 'Layanan', 'Nama', 'Bank/Tujuan', 'Nominal', 'Admin', 'Jasa', 'Laba']], brilinkBody, finalY, { 
        styles: { fontSize: 7, cellPadding: 1 },
        columnStyles: { 0: { cellWidth: 8 }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } }
    });

    const ppobBody = reportData.ppobProfitItems.map((item, index) => {
        const profit = 'profit' in item ? item.profit : item.netProfit;
        const cost = 'costPrice' in item ? item.costPrice : item.billAmount;
        const sell = 'sellingPrice' in item ? item.sellingPrice : item.totalAmount;
        const cashback = 'cashback' in item ? item.cashback || 0 : 0;
        return [index + 1, 'serviceName' in item ? item.serviceName : 'N/A', 'destination' in item ? item.destination : ('customerName' in item ? item.customerName : 'N/A'), formatToRupiah(cost), formatToRupiah(sell), formatToRupiah(cashback), formatToRupiah(profit)];
    });
    const ppobTotals = reportData.ppobProfitItems.reduce((acc, item) => {
        acc.cost += 'costPrice' in item ? item.costPrice : item.billAmount;
        acc.sell += 'sellingPrice' in item ? item.sellingPrice : item.totalAmount;
        acc.cashback += 'cashback' in item ? item.cashback || 0 : 0;
        acc.profit += 'profit' in item ? item.profit : item.netProfit;
        return acc;
    }, { cost: 0, sell: 0, cashback: 0, profit: 0 });
    ppobBody.push([{ content: 'TOTAL', colSpan: 3, styles: { fontStyle: 'bold', halign: 'center' } }, formatToRupiah(ppobTotals.cost), formatToRupiah(ppobTotals.sell), formatToRupiah(ppobTotals.cashback), { content: formatToRupiah(ppobTotals.profit), styles: { fontStyle: 'bold' } }]);
    finalY = addGridSection('PPOB', [['No', 'Layanan', 'Tujuan', 'Modal', 'Jual', 'Cashback', 'Laba']], ppobBody, finalY, { 
        styles: { fontSize: 7, cellPadding: 1 },
        columnStyles: { 0: { cellWidth: 8 }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } }
    });
    
    // --- PAGE 3: OPERATIONAL COSTS ---
    if (reportData.operationalCosts.length > 0) {
        doc.addPage('landscape');
        finalY = addReportTitle('Laporan Biaya Operasional', 15);
        const opCostBody = reportData.operationalCosts.map((item, index) => [index + 1, format(item.date, 'dd/MM/yy HH:mm'), item.description, item.source, formatToRupiah(item.amount)]);
        const totalOpCost = reportData.operationalCosts.reduce((sum, item) => sum + item.amount, 0);
        opCostBody.push([{ content: 'Total Biaya Operasional', colSpan: 4, styles: { fontStyle: 'bold', halign: 'center' } }, { content: formatToRupiah(totalOpCost), styles: { fontStyle: 'bold' } }]);
        finalY = addGridSection('', [['No', 'Tanggal', 'Deskripsi Biaya', 'Sumber', 'Jumlah']], opCostBody, finalY, { columnStyles: { 0: { cellWidth: 10 }, 4: { halign: 'right' } } });
    }

    // --- PAGE 4: CAPITAL ADDITIONS ---
    if (reportData.capitalAdditions.length > 0) {
        doc.addPage('landscape');
        finalY = addReportTitle('Laporan Penambahan Modal', 15);
        const capAddBody = reportData.capitalAdditions.map((item, index) => [index + 1, format(item.date, 'dd/MM/yy HH:mm'), item.description, item.account, formatToRupiah(item.amount)]);
        const totalCapAdd = reportData.capitalAdditions.reduce((sum, item) => sum + item.amount, 0);
        capAddBody.push([{ content: 'Total Penambahan Saldo', colSpan: 4, styles: { fontStyle: 'bold', halign: 'center' } }, { content: formatToRupiah(totalCapAdd), styles: { fontStyle: 'bold' } }]);
        finalY = addGridSection('', [['No', 'Tanggal', 'Deskripsi', 'Masuk Ke Akun', 'Jumlah']], capAddBody, finalY, { columnStyles: { 0: { cellWidth: 10 }, 4: { halign: 'right' } } });
    }
    
    addFooter();
    const fileName = `Laporan-Gabungan-${format(dateFrom, "ddMMyy")}.pdf`;
    doc.save(fileName);
    
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
                 <Accordion type="multiple" defaultValue={['daily-report', 'profit-loss', 'operational-cost', 'capital-addition']} className="w-full">
                    <AccordionItem value="daily-report">
                        <AccordionTrigger className="text-lg font-bold">DAILY REPORT V7.0 - FINAL VERSION</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-4">
                            {reportData.dailyReport ? (
                                <>
                                  <div className="text-sm space-y-2">
                                    <h3 className="font-semibold text-muted-foreground">A. Saldo Akun</h3>
                                    {reportData.dailyReport.accountSnapshots.map((acc, i) => <div key={i} className="flex justify-between"><span className="pl-2">{acc.label}</span><span>{formatToRupiah(acc.balance)}</span></div>)}
                                    <div className="font-bold flex justify-between border-t pt-2"><span className="pl-2">TOTAL</span><span>{formatToRupiah(reportData.dailyReport.totalAccountBalance)}</span></div>
                                  </div>
                                </>
                            ) : <p className="text-sm text-muted-foreground text-center py-4">Tidak ada data Laporan Harian V7.</p>}
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="profit-loss">
                        <AccordionTrigger className="text-lg font-bold">Laporan Laba/Rugi</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-4">
                            <h3 className="font-semibold">BRILink</h3>
                             <div className="text-sm space-y-2">
                                {reportData.brilinkProfitItems.map(item => <div key={item.id} className="flex justify-between"><span className="pl-2">{item.transactionType}</span><span>{formatToRupiah('netProfit' in item ? item.netProfit : item.serviceFee)}</span></div>)}
                             </div>
                             <h3 className="font-semibold mt-4">PPOB</h3>
                             <div className="text-sm space-y-2">
                                {reportData.ppobProfitItems.map(item => <div key={item.id} className="flex justify-between"><span className="pl-2">{'serviceName' in item ? item.serviceName : 'PPOB'}</span><span>{formatToRupiah('profit' in item ? item.profit : item.netProfit)}</span></div>)}
                             </div>
                             <div className="flex justify-between font-bold text-base border-t pt-2 mt-2"><span>Total Laba Kotor</span><span>{formatToRupiah(totalGrossProfit)}</span></div>
                        </AccordionContent>
                    </AccordionItem>
                     <AccordionItem value="operational-cost">
                        <AccordionTrigger className="text-lg font-bold">Laporan Biaya Operasional</AccordionTrigger>
                         <AccordionContent className="space-y-2 pt-4">
                           {reportData.operationalCosts.length > 0 ? (
                                <div className="text-sm space-y-2">
                                    {reportData.operationalCosts.map((item, i) => <div key={i} className="flex justify-between"><span className="pl-2">{item.description}</span><span className="text-destructive">- {formatToRupiah(item.amount)}</span></div>)}
                                    <div className="font-bold flex justify-between border-t pt-2"><span className="pl-2">Total Biaya</span><span className="text-destructive">{formatToRupiah(totalOperationalCosts)}</span></div>
                                </div>
                           ) : <p className="text-sm text-muted-foreground text-center py-4">Tidak ada biaya operasional.</p>}
                         </AccordionContent>
                    </AccordionItem>
                     <AccordionItem value="net-profit-summary">
                        <AccordionTrigger className="text-lg font-bold">Ringkasan Laba Bersih</AccordionTrigger>
                        <AccordionContent className="space-y-2 text-sm pt-4">
                            <div className="flex justify-between"><span>Total Laba Kotor</span><span>{formatToRupiah(totalGrossProfit)}</span></div>
                            <div className="flex justify-between text-destructive"><span>Total Biaya Operasional</span><span>- {formatToRupiah(totalOperationalCosts)}</span></div>
                            <div className="flex justify-between font-bold text-base border-t pt-2 mt-2"><span>Total Laba Bersih</span><span className={cn(netProfit < 0 ? "text-destructive" : "text-green-500")}>{formatToRupiah(netProfit)}</span></div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="capital-addition">
                        <AccordionTrigger className="text-lg font-bold">Laporan Penambahan Modal</AccordionTrigger>
                        <AccordionContent className="pt-4">
                           {reportData.capitalAdditions.length > 0 ? (
                                <div className="text-sm space-y-2">
                                    {reportData.capitalAdditions.map((item, i) => <div key={i} className="flex justify-between"><span className="pl-2">{item.description}</span><span>{formatToRupiah(item.amount)}</span></div>)}
                                    <div className="font-bold flex justify-between border-t pt-2"><span className="pl-2">Total Tambah Modal</span><span>{formatToRupiah(totalCapitalAdditions)}</span></div>
                                </div>
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

    