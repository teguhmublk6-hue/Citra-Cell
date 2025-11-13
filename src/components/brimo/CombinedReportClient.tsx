
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

    const doc = new jsPDF({ orientation: 'landscape' });
    const dateFrom = startOfDay(dateRange!.from!);
    const dateTitle = format(dateFrom, "EEEE, dd MMMM yyyy", { locale: idLocale });
    let finalY = 0;
    
    const pageMargin = 7; // Approx 0.27 inches
    const reportDate = format(new Date(), "d MMM yyyy, HH:mm:ss");

    // Helper to add footer
    const addFooter = () => {
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(
                `Hal ${i} dari ${pageCount}`,
                doc.internal.pageSize.getWidth() / 2,
                doc.internal.pageSize.getHeight() - 7,
                { align: 'center' }
            );
            doc.text(
                `Dibuat: ${reportDate}`,
                doc.internal.pageSize.getWidth() - pageMargin,
                doc.internal.pageSize.getHeight() - 7,
                { align: 'right' }
            );
        }
    };

    const addReportTitle = (title: string): number => {
        doc.setFontSize(16);
        doc.text(title, doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
        doc.setFontSize(10);
        doc.text(dateTitle, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });
        return 28;
    };
    
    const addGridSection = (title: string, head: any[], body: any[], startY: number, options?: any): number => {
        doc.setFontSize(12);
        doc.text(title, pageMargin, startY);
        autoTable(doc, { 
            head, 
            body, 
            startY: startY + 2, 
            theme: 'grid', 
            headStyles: { fillColor: '#f1f5f9', textColor: '#000', fontSize: 8 }, 
            styles: { fontSize: 8, cellPadding: 1.5, ...options?.styles },
            columnStyles: options?.columnStyles,
            margin: { left: pageMargin, right: pageMargin }
        });
        return (doc as any).lastAutoTable.finalY + 8;
    };

    // --- 1. Daily Report V7 ---
    try {
        finalY = addReportTitle('DAILY REPORT V7.0 - FINAL VERSION');
        if (reportData.dailyReport) {
            const report = reportData.dailyReport;
            const sectionA_Body = report.accountSnapshots.map((acc, index) => [index + 1, acc.label, formatToRupiah(acc.balance)]);
            finalY = addGridSection('A. Saldo Akun', [['No', 'Akun', 'Saldo']], sectionA_Body, finalY, { columnStyles: { 0: { cellWidth: 10 }, 2: { halign: 'right' } } });
            autoTable(doc, { 
                body: [[{ content: 'TOTAL', colSpan: 2, styles: { fontStyle: 'bold' } }, { content: formatToRupiah(report.totalAccountBalance), styles: { fontStyle: 'bold', halign: 'right' } }]], 
                startY: (doc as any).lastAutoTable.finalY, theme: 'grid', styles: {fontSize: 8},
                margin: { left: pageMargin, right: pageMargin }
            });
            finalY = (doc as any).lastAutoTable.finalY + 10;
        } else {
            doc.setFontSize(10); doc.text("Tidak ada data Laporan Harian V7 untuk tanggal ini.", pageMargin, finalY); finalY += 10;
        }
    } catch (e) { console.error("Error generating Daily Report V7 part:", e); }


    // --- 2. Profit/Loss Report ---
    doc.addPage('landscape');
    try {
        finalY = addReportTitle('Laporan Laba/Rugi');
        
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

        brilinkBody.push([
            { content: 'TOTAL', colSpan: 4, styles: { fontStyle: 'bold', halign: 'left' } },
            { content: formatToRupiah(brilinkTotals.nominal), styles: { fontStyle: 'bold' } },
            { content: formatToRupiah(brilinkTotals.admin), styles: { fontStyle: 'bold' } },
            { content: formatToRupiah(brilinkTotals.jasa), styles: { fontStyle: 'bold' } },
            { content: formatToRupiah(brilinkTotals.laba), styles: { fontStyle: 'bold' } }
        ]);
        
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

        ppobBody.push([
            { content: 'TOTAL', colSpan: 3, styles: { fontStyle: 'bold', halign: 'left' } },
            { content: formatToRupiah(ppobTotals.cost), styles: { fontStyle: 'bold' } },
            { content: formatToRupiah(ppobTotals.sell), styles: { fontStyle: 'bold' } },
            { content: formatToRupiah(ppobTotals.cashback), styles: { fontStyle: 'bold' } },
            { content: formatToRupiah(ppobTotals.profit), styles: { fontStyle: 'bold' } }
        ]);

        finalY = addGridSection('PPOB', [['No', 'Layanan', 'Tujuan', 'Modal', 'Jual', 'Cashback', 'Laba']], ppobBody, finalY, { 
            styles: { fontSize: 7, cellPadding: 1 },
            columnStyles: { 0: { cellWidth: 8 }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } }
        });

    } catch (e) { console.error("Error generating P/L Report part:", e); }
    
    // --- Finalize PDF ---
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
                 <Accordion type="multiple" defaultValue={['daily-report', 'profit-loss']}>
                    <AccordionItem value="daily-report">
                        <AccordionTrigger className="text-lg font-bold">DAILY REPORT V7.0 - FINAL VERSION</AccordionTrigger>
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
                            ) : <p className="text-sm text-muted-foreground text-center py-4">Tidak ada data Laporan Harian V7.</p>}
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
