
"use client";

import { useState, useEffect, useRef } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs, orderBy, where, Timestamp } from 'firebase/firestore';
import type { CustomerTransfer, CustomerWithdrawal, CustomerTopUp, CustomerEmoneyTopUp, CustomerVAPayment, EDCService, CustomerKJPWithdrawal, PPOBTransaction, PPOBPlnPostpaid, PPOBPdam, PPOBBpjs, PPOBWifi } from '@/lib/types';
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
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface ProfitLossReportProps {
  onDone: () => void;
}

type BrilinkReportItem = 
    | (CustomerTransfer & { id: string; transactionType: 'Transfer' }) 
    | (CustomerWithdrawal & { id: string; transactionType: 'Tarik Tunai' }) 
    | (CustomerTopUp & { id: string; transactionType: 'Top Up' })
    | (CustomerEmoneyTopUp & { id: string; transactionType: 'Top Up E-Money' })
    | (CustomerVAPayment & { id: string; transactionType: 'VA Payment' })
    | (EDCService & { id: string; transactionType: 'Layanan EDC' })
    | (CustomerKJPWithdrawal & { id: string; transactionType: 'Tarik Tunai KJP'});

type PpobBillReportItem = 
    | (PPOBPlnPostpaid & { id: string; serviceName: 'PLN Pascabayar' })
    | (PPOBPdam & { id: string; serviceName: 'PDAM' })
    | (PPOBBpjs & { id: string; serviceName: 'BPJS' })
    | (PPOBWifi & { id: string; serviceName: 'Wifi' });


const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '' || isNaN(Number(value))) return 'Rp 0';
    const num = Number(String(value).replace(/[^0-9-]/g, ''));
    const isNegative = num < 0;
    return `${isNegative ? '-' : ''}Rp ${Math.abs(num).toLocaleString('id-ID')}`;
};

export default function ProfitLossReport({ onDone }: ProfitLossReportProps) {
  const firestore = useFirestore();
  const [brilinkReports, setBrilinkReports] = useState<BrilinkReportItem[]>([]);
  const [ppobReports, setPpobReports] = useState<(PPOBTransaction & {id: string})[]>([]);
  const [ppobBillReports, setPpobBillReports] = useState<PpobBillReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfDay(new Date()), to: endOfDay(new Date()) });
  const [isDownloading, setIsDownloading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const kasAccountsCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'kasAccounts');
  }, [firestore]);
  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

  useEffect(() => {
    const fetchReports = async () => {
        if (!firestore) return;
        setIsLoading(true);

        try {
            const dateFrom = dateRange?.from ? Timestamp.fromDate(startOfDay(dateRange.from)) : null;
            const dateTo = dateRange?.to ? Timestamp.fromDate(endOfDay(dateRange.to)) : null;

            const brilinkQueries = [
                getDocs(query(collection(firestore, 'customerTransfers'), ...(dateFrom ? [where('date', '>=', dateFrom)] : []), ...(dateTo ? [where('date', '<=', dateTo)] : []))),
                getDocs(query(collection(firestore, 'customerWithdrawals'), ...(dateFrom ? [where('date', '>=', dateFrom)] : []), ...(dateTo ? [where('date', '<=', dateTo)] : []))),
                getDocs(query(collection(firestore, 'customerTopUps'), ...(dateFrom ? [where('date', '>=', dateFrom)] : []), ...(dateTo ? [where('date', '<=', dateTo)] : []))),
                getDocs(query(collection(firestore, 'customerEmoneyTopUps'), ...(dateFrom ? [where('date', '>=', dateFrom)] : []), ...(dateTo ? [where('date', '<=', dateTo)] : []))),
                getDocs(query(collection(firestore, 'customerVAPayments'), ...(dateFrom ? [where('date', '>=', dateFrom)] : []), ...(dateTo ? [where('date', '<=', dateTo)] : []))),
                getDocs(query(collection(firestore, 'edcServices'), ...(dateFrom ? [where('date', '>=', dateFrom)] : []), ...(dateTo ? [where('date', '<=', dateTo)] : []))),
                getDocs(query(collection(firestore, 'customerKJPWithdrawals'), ...(dateFrom ? [where('date', '>=', dateFrom)] : []), ...(dateTo ? [where('date', '<=', dateTo)] : []))),
            ];

            const ppobQuery = getDocs(query(collection(firestore, 'ppobTransactions'), ...(dateFrom ? [where('date', '>=', dateFrom)] : []), ...(dateTo ? [where('date', '<=', dateTo)] : []), orderBy('date', 'desc')));
            const ppobPlnPostpaidQuery = getDocs(query(collection(firestore, 'ppobPlnPostpaid'), ...(dateFrom ? [where('date', '>=', dateFrom)] : []), ...(dateTo ? [where('date', '<=', dateTo)] : []), orderBy('date', 'desc')));
            const ppobPdamQuery = getDocs(query(collection(firestore, 'ppobPdam'), ...(dateFrom ? [where('date', '>=', dateFrom)] : []), ...(dateTo ? [where('date', '<=', dateTo)] : []), orderBy('date', 'desc')));
            const ppobBpjsQuery = getDocs(query(collection(firestore, 'ppobBpjs'), ...(dateFrom ? [where('date', '>=', dateFrom)] : []), ...(dateTo ? [where('date', '<=', dateTo)] : []), orderBy('date', 'desc')));
            const ppobWifiQuery = getDocs(query(collection(firestore, 'ppobWifi'), ...(dateFrom ? [where('date', '>=', dateFrom)] : []), ...(dateTo ? [where('date', '<=', dateTo)] : []), orderBy('date', 'desc')));
            
            const [
                transfersSnapshot, 
                withdrawalsSnapshot, 
                topUpsSnapshot, 
                emoneyTopUpsSnapshot, 
                vaPaymentsSnapshot, 
                edcServicesSnapshot, 
                kjpWithdrawalsSnapshot,
                ppobSnapshot,
                ppobPlnPostpaidSnapshot,
                ppobPdamSnapshot,
                ppobBpjsSnapshot,
                ppobWifiSnapshot,
            ] = await Promise.all([...brilinkQueries, ppobQuery, ppobPlnPostpaidQuery, ppobPdamQuery, ppobBpjsQuery, ppobWifiQuery]);

            const combinedBrilinkReports: BrilinkReportItem[] = [];

            transfersSnapshot.forEach((doc) => combinedBrilinkReports.push({ id: doc.id, ...(doc.data() as CustomerTransfer), date: (doc.data().date as Timestamp).toDate(), transactionType: 'Transfer' }));
            withdrawalsSnapshot.forEach((doc) => combinedBrilinkReports.push({ id: doc.id, ...(doc.data() as CustomerWithdrawal), date: (doc.data().date as Timestamp).toDate(), transactionType: 'Tarik Tunai' }));
            topUpsSnapshot.forEach((doc) => combinedBrilinkReports.push({ id: doc.id, ...(doc.data() as CustomerTopUp), date: (doc.data().date as Timestamp).toDate(), transactionType: 'Top Up' }));
            emoneyTopUpsSnapshot.forEach((doc) => combinedBrilinkReports.push({ id: doc.id, ...(doc.data() as CustomerEmoneyTopUp), date: (doc.data().date as Timestamp).toDate(), transactionType: 'Top Up E-Money' }));
            vaPaymentsSnapshot.forEach((doc) => combinedBrilinkReports.push({ id: doc.id, ...(doc.data() as CustomerVAPayment), date: (doc.data().date as Timestamp).toDate(), transactionType: 'VA Payment' }));
            edcServicesSnapshot.forEach((doc) => combinedBrilinkReports.push({ id: doc.id, ...(doc.data() as EDCService), date: (doc.data().date as Timestamp).toDate(), transactionType: 'Layanan EDC' }));
            kjpWithdrawalsSnapshot.forEach((doc) => combinedBrilinkReports.push({ id: doc.id, ...(doc.data() as CustomerKJPWithdrawal), date: (doc.data().date as Timestamp).toDate(), transactionType: 'Tarik Tunai KJP' }));

            combinedBrilinkReports.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            const fetchedPpobReports = ppobSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PPOBTransaction & {id: string}));
            const fetchedPpobBillReports: PpobBillReportItem[] = [];
            ppobPlnPostpaidSnapshot.forEach(doc => fetchedPpobBillReports.push({ id: doc.id, ...(doc.data() as PPOBPlnPostpaid), serviceName: 'PLN Pascabayar' }));
            ppobPdamSnapshot.forEach(doc => fetchedPpobBillReports.push({ id: doc.id, ...(doc.data() as PPOBPdam), serviceName: 'PDAM' }));
            ppobBpjsSnapshot.forEach(doc => fetchedPpobBillReports.push({ id: doc.id, ...(doc.data() as PPOBBpjs), serviceName: 'BPJS' }));
            ppobWifiSnapshot.forEach(doc => fetchedPpobBillReports.push({ id: doc.id, ...(doc.data() as PPOBWifi), serviceName: 'Wifi' }));
            fetchedPpobBillReports.sort((a, b) => (b.date as any).toDate().getTime() - (a.date as any).toDate().getTime());

            setBrilinkReports(combinedBrilinkReports);
            setPpobReports(fetchedPpobReports);
            setPpobBillReports(fetchedPpobBillReports);

        } catch (error) {
            console.error("Error fetching profit/loss reports: ", error);
        } finally {
            setIsLoading(false);
        }
    };
    
    fetchReports();
  }, [firestore, dateRange]);

  const handleDownloadPDF = async () => {
    setIsDownloading(true);

    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const dateFrom = dateRange?.from ? format(dateRange.from, "d MMMM yyyy", { locale: idLocale }) : '';
    const dateTo = dateRange?.to ? format(dateRange.to, "d MMMM yyyy", { locale: idLocale }) : '';
    const dateTitle = dateRange?.from && dateRange?.to ? (dateFrom === dateTo ? dateFrom : `${dateFrom} - ${dateTo}`) : 'Semua Waktu';
    
    doc.setFontSize(16);
    doc.text('Laporan Laba/Rugi Harian', 14, 22);
    doc.setFontSize(10);
    doc.text(dateTitle, 14, 28);

    let lastY = 35;
    const tableOptions = {
        startY: lastY,
        theme: 'grid' as const,
        styles: { fontSize: 5, cellPadding: 1, overflow: 'linebreak' },
        headStyles: { fillColor: [0, 82, 155] as [number, number, number] },
        margin: { left: 2.5, right: 2.5 }
    };
    
    if (brilinkReports.length > 0) {
        (doc as any).autoTable({
            ...tableOptions,
            html: '#brilink-table',
            headStyles: { fillColor: [0, 82, 155] },
        });
        lastY = (doc as any).lastAutoTable.finalY;
    }

    if (ppobReports.length > 0 || ppobBillReports.length > 0) {
        (doc as any).autoTable({
            ...tableOptions,
            html: '#ppob-table',
            startY: lastY + 10,
            headStyles: { fillColor: [246, 131, 34] },
        });
        lastY = (doc as any).lastAutoTable.finalY;
    }

    doc.setFontSize(12);
    doc.text('Total Laba Bersih Keseluruhan', 14, lastY + 20);
    doc.setFontSize(16);
    doc.setTextColor(brilinkTotals.labaRugi + totalPpobProfit >= 0 ? 'green' : 'red');
    doc.text(formatToRupiah(brilinkTotals.labaRugi + totalPpobProfit), 14, lastY + 28);

    const pdfFilename = `Laporan-Laba-Rugi-${dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : 'all'}.pdf`;
    doc.save(pdfFilename);

    setIsDownloading(false);
  };

  const getAccountLabel = (accountId?: string) => {
    if (!accountId) return 'N/A';
    return kasAccounts?.find(acc => acc.id === accountId)?.label || accountId;
  };
  
  const brilinkTotals = brilinkReports.reduce((acc, report) => {
    if (report.transactionType === 'Transfer') {
        acc.nominal += report.transferAmount;
        acc.adminBank += report.bankAdminFee;
        acc.jasa += report.serviceFee;
        acc.labaRugi += report.netProfit;
    } else if (report.transactionType === 'Tarik Tunai' || report.transactionType === 'Top Up' || report.transactionType === 'Top Up E-Money' || report.transactionType === 'Layanan EDC' || report.transactionType === 'Tarik Tunai KJP') {
        acc.nominal += 'withdrawalAmount' in report ? report.withdrawalAmount : ('topUpAmount' in report ? report.topUpAmount : 0);
        acc.jasa += report.serviceFee;
        acc.labaRugi += report.serviceFee;
    } else if (report.transactionType === 'VA Payment') {
        acc.nominal += report.paymentAmount;
        acc.adminBank += report.adminFee;
        acc.jasa += report.serviceFee;
        acc.labaRugi += report.netProfit;
    }
    return acc;
  }, { nominal: 0, adminBank: 0, jasa: 0, labaRugi: 0 });

  const ppobTotals = ppobReports.reduce((acc, report) => {
    acc.costPrice += report.costPrice;
    acc.sellingPrice += report.sellingPrice;
    acc.profit += report.profit;
    return acc;
  }, { costPrice: 0, sellingPrice: 0, profit: 0 });
  
  const ppobBillTotals = ppobBillReports.reduce((acc, report) => {
    acc.costPrice += report.billAmount;
    acc.sellingPrice += report.totalAmount;
    acc.profit += report.netProfit;
    acc.cashback += report.cashback || 0;
    return acc;
  }, { costPrice: 0, sellingPrice: 0, profit: 0, cashback: 0 });
  
  const totalPpobProfit = ppobTotals.profit + ppobBillTotals.profit;

  const totalNetProfit = brilinkTotals.labaRugi + totalPpobProfit;
  
  const getBrilinkBankInfo = (report: BrilinkReportItem) => {
    switch (report.transactionType) {
        case 'Transfer':
            return report.destinationBankName;
        case 'Tarik Tunai':
            return report.customerBankSource;
        case 'Top Up':
            return report.destinationEwallet;
        case 'Top Up E-Money':
            return report.destinationEmoney;
        case 'VA Payment':
            return report.serviceProvider;
        case 'Layanan EDC':
            return report.machineUsed;
        case 'Tarik Tunai KJP':
            return 'Bank DKI';
        default:
            return '-';
    }
  }


  return (
    <div className="h-full flex flex-col bg-background">
        <header className="p-4 space-y-4 border-b sticky top-0 bg-background z-30">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onDone}>
                    <ArrowLeft />
                </Button>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold">Laporan Laba/Rugi Harian</h1>
                     {dateRange?.from && (
                        <p className="text-xs text-muted-foreground">
                            {format(dateRange.from, "d MMMM yyyy", { locale: idLocale })}
                            {dateRange.to && ` - ${format(dateRange.to, "d MMMM yyyy", { locale: idLocale })}`}
                        </p>
                    )}
                </div>
                <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={isDownloading}>
                    {isDownloading ? <Loader2 size={16} className="mr-2 animate-spin"/> : <Download size={16} className="mr-2"/>}
                    PDF
                </Button>
            </div>
             <Popover>
                <PopoverTrigger asChild>
                    <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateRange && "text-muted-foreground"
                    )}
                    >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                        dateRange.to ? (
                        <>
                            {format(dateRange.from, "LLL dd, y")} -{" "}
                            {format(dateRange.to, "LLL dd, y")}
                        </>
                        ) : (
                        format(dateRange.from, "LLL dd, y")
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

        <div className="flex-1 overflow-auto">
          <div ref={reportRef} className="p-4 space-y-6 bg-background">
            <div>
                <h2 className="text-lg font-semibold mb-2">A. BRILink</h2>
                <div className="relative w-full overflow-x-auto">
                    {isLoading ? (
                        <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
                    ) : brilinkReports.length === 0 ? (
                        <Card><CardContent className="pt-6 text-center text-muted-foreground">Tidak ada transaksi BRILink untuk tanggal ini.</CardContent></Card>
                    ) : (
                        <Table id="brilink-table" className="text-[11px] whitespace-nowrap">
                            <TableHeader className="sticky top-0 bg-background z-10">
                                <TableRow>
                                    <TableHead className="py-2">No</TableHead>
                                    <TableHead className="py-2">Deskripsi</TableHead>
                                    <TableHead className="py-2">Nama</TableHead>
                                    <TableHead className="py-2">Bank/Tujuan</TableHead>
                                    <TableHead className="text-right py-2">Nominal</TableHead>
                                    <TableHead className="text-right py-2">Admin Bank</TableHead>
                                    <TableHead className="text-right py-2">Jasa</TableHead>
                                    <TableHead className="text-right py-2">Laba/Rugi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {brilinkReports.map((report, index) => {
                                    const labaRugi = 'netProfit' in report ? report.netProfit : report.serviceFee;
                                    return (
                                        <TableRow key={report.id}>
                                            <TableCell className="py-2">{index + 1}</TableCell>
                                            <TableCell className="py-2">{report.transactionType}</TableCell>
                                            <TableCell className="py-2">{'destinationAccountName' in report ? report.destinationAccountName : report.customerName}</TableCell>
                                            <TableCell className="py-2">{getBrilinkBankInfo(report)}</TableCell>
                                            <TableCell className="text-right py-2">{formatToRupiah('transferAmount' in report ? report.transferAmount : ('withdrawalAmount' in report ? report.withdrawalAmount : ('topUpAmount' in report ? report.topUpAmount : ('paymentAmount' in report ? report.paymentAmount : 0))))}</TableCell>
                                            <TableCell className="text-right py-2">{formatToRupiah('bankAdminFee' in report ? report.bankAdminFee : ('adminFee' in report ? report.adminFee : 0))}</TableCell>
                                            <TableCell className="text-right py-2">{formatToRupiah(report.serviceFee)}</TableCell>
                                            <TableCell className={cn("text-right font-semibold py-2", labaRugi < 0 ? "text-destructive" : "text-green-500")}>
                                                {formatToRupiah(labaRugi)}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                            <TableFooter>
                                <TableRow className="font-bold bg-muted/50">
                                    <TableCell colSpan={4}>Total</TableCell>
                                    <TableCell className="text-right py-2">{formatToRupiah(brilinkTotals.nominal)}</TableCell>
                                    <TableCell className="text-right py-2">{formatToRupiah(brilinkTotals.adminBank)}</TableCell>
                                    <TableCell className="text-right py-2">{formatToRupiah(brilinkTotals.jasa)}</TableCell>
                                    <TableCell className={cn("text-right py-2", brilinkTotals.labaRugi < 0 ? "text-destructive" : "text-green-500")}>
                                        {formatToRupiah(brilinkTotals.labaRugi)}
                                    </TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    )}
                </div>
            </div>

            <div>
                <h2 className="text-lg font-semibold mb-2">B. PPOB</h2>
                <div className="relative w-full overflow-x-auto">
                    {isLoading ? (
                        <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-12 w-full" /></div>
                    ) : (ppobReports.length === 0 && ppobBillReports.length === 0) ? (
                        <Card><CardContent className="pt-6 text-center text-muted-foreground">Tidak ada transaksi PPOB untuk tanggal ini.</CardContent></Card>
                    ) : (
                    <Table id="ppob-table" className="text-[11px] whitespace-nowrap">
                        <TableHeader className="sticky top-0 bg-background z-10">
                            <TableRow>
                                <TableHead className="w-[40px] py-2">No.</TableHead>
                                <TableHead className="py-2">Layanan</TableHead>
                                <TableHead className="py-2">Tujuan</TableHead>
                                <TableHead className="py-2">Akun PPOB</TableHead>
                                <TableHead className="text-right py-2">Harga Modal</TableHead>
                                <TableHead className="text-right py-2">Harga Jual</TableHead>
                                <TableHead className="text-right py-2">Cashback</TableHead>
                                <TableHead className="text-right py-2">Laba/Rugi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {ppobReports.map((report, index) => (
                                <TableRow key={report.id}>
                                    <TableCell className="py-2">{index + 1}</TableCell>
                                    <TableCell className="py-2">{report.serviceName}</TableCell>
                                    <TableCell className="py-2">{report.destination}</TableCell>
                                    <TableCell className="py-2">{getAccountLabel(report.sourcePPOBAccountId)}</TableCell>
                                    <TableCell className="text-right py-2">{formatToRupiah(report.costPrice)}</TableCell>
                                    <TableCell className="text-right py-2">{formatToRupiah(report.sellingPrice)}</TableCell>
                                    <TableCell className="text-right py-2">{formatToRupiah(0)}</TableCell>
                                    <TableCell className={cn("text-right font-semibold py-2", report.profit < 0 ? "text-destructive" : "text-green-500")}>
                                        {formatToRupiah(report.profit)}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {ppobBillReports.map((report, index) => (
                            <TableRow key={report.id}>
                                    <TableCell className="py-2">{ppobReports.length + index + 1}</TableCell>
                                    <TableCell className="py-2">{report.serviceName}</TableCell>
                                    <TableCell className="py-2">{report.customerName}</TableCell>
                                    <TableCell className="py-2">{getAccountLabel(report.sourcePPOBAccountId)}</TableCell>
                                    <TableCell className="text-right py-2">{formatToRupiah(report.billAmount)}</TableCell>
                                    <TableCell className="text-right py-2">{formatToRupiah(report.totalAmount)}</TableCell>
                                    <TableCell className="text-right py-2">{formatToRupiah(report.cashback)}</TableCell>
                                    <TableCell className={cn("text-right font-semibold py-2", report.netProfit < 0 ? "text-destructive" : "text-green-500")}>
                                        {formatToRupiah(report.netProfit)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="font-bold bg-muted/50">
                                <TableCell colSpan={4}>Total</TableCell>
                                <TableCell className="text-right py-2">{formatToRupiah(ppobTotals.costPrice + ppobBillTotals.costPrice)}</TableCell>
                                <TableCell className="text-right py-2">{formatToRupiah(ppobTotals.sellingPrice + ppobBillTotals.sellingPrice)}</TableCell>
                                <TableCell className="text-right py-2">{formatToRupiah(ppobBillTotals.cashback)}</TableCell>
                                <TableCell className={cn("text-right py-2", totalPpobProfit < 0 ? "text-destructive" : "text-green-500")}>
                                    {formatToRupiah(totalPpobProfit)}
                                </TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                    )}
                </div>
            </div>
            <Card id="totals-card" className="my-6">
                <CardHeader>
                    <CardTitle>Total Laba Bersih Keseluruhan</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className={cn("text-3xl font-bold", totalNetProfit < 0 ? "text-destructive" : "text-green-500")}>
                        {formatToRupiah(totalNetProfit)}
                    </p>
                    <p className="text-sm text-muted-foreground">({formatToRupiah(brilinkTotals.labaRugi)} dari BRILink + {formatToRupiah(totalPpobProfit)} dari PPOB)</p>
                </CardContent>
            </Card>
          </div>
        </div>
    </div>
  );
    



    