"use client"

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

<<<<<<< HEAD
const BookkeepingReportClient = dynamic(() => import('./BookkeepingReportClient'), {
  ssr: false,
  loading: () => (
      <div className="p-4 space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
=======
import { useState, useEffect, useRef } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs, orderBy, where, Timestamp } from 'firebase/firestore';
import type { CustomerTransfer, CustomerWithdrawal, CustomerTopUp, CustomerEmoneyTopUp, CustomerVAPayment, EDCService, CustomerKJPWithdrawal, PPOBBpjs } from '@/lib/types';
import type { KasAccount } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ArrowLeft, Send, Wallet, Download, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfDay, endOfDay } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { Card, CardContent } from '../ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import jsPDF from 'jspdf';
// Do not import html2canvas directly at the top

interface BookkeepingReportProps {
  onDone: () => void;
}

type ReportItem = 
    | (CustomerTransfer & { id: string; transactionType: 'Transfer' }) 
    | (CustomerWithdrawal & { id: string; transactionType: 'Tarik Tunai' }) 
    | (CustomerTopUp & { id: string; transactionType: 'Top Up' })
    | (CustomerKJPWithdrawal & { id: string; transactionType: 'Tarik Tunai KJP' })
    | (CustomerVAPayment & { id: string; transactionType: 'VA Payment' })
    | (CustomerEmoneyTopUp & { id: string; transactionType: 'Top Up E-Money' })
    | (EDCService & { id: string; transactionType: 'Layanan EDC' })
    | (PPOBBpjs & { id: string; transactionType: 'BPJS' });


const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const num = Number(String(value).replace(/[^0-9]/g, ''));
    if (isNaN(num)) return 'Rp 0';
    return `Rp ${num.toLocaleString('id-ID')}`;
};

export default function BookkeepingReport({ onDone }: BookkeepingReportProps) {
  const firestore = useFirestore();
  const [reports, setReports] = useState<ReportItem[]>([]);
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

            const queries = [
                getDocs(query(collection(firestore, 'customerTransfers'), ...(dateFrom ? [where('date', '>=', dateFrom)] : []), ...(dateTo ? [where('date', '<=', dateTo)] : []))),
                getDocs(query(collection(firestore, 'customerWithdrawals'), ...(dateFrom ? [where('date', '>=', dateFrom)] : []), ...(dateTo ? [where('date', '<=', dateTo)] : []))),
                getDocs(query(collection(firestore, 'customerTopUps'), ...(dateFrom ? [where('date', '>=', dateFrom)] : []), ...(dateTo ? [where('date', '<=', dateTo)] : []))),
                getDocs(query(collection(firestore, 'customerKJPWithdrawals'), ...(dateFrom ? [where('date', '>=', dateFrom)] : []), ...(dateTo ? [where('date', '<=', dateTo)] : []))),
                getDocs(query(collection(firestore, 'customerVAPayments'), ...(dateFrom ? [where('date', '>=', dateFrom)] : []), ...(dateTo ? [where('date', '<=', dateTo)] : []))),
                getDocs(query(collection(firestore, 'customerEmoneyTopUps'), ...(dateFrom ? [where('date', '>=', dateFrom)] : []), ...(dateTo ? [where('date', '<=', dateTo)] : []))),
                getDocs(query(collection(firestore, 'edcServices'), ...(dateFrom ? [where('date', '>=', dateFrom)] : []), ...(dateTo ? [where('date', '<=', dateTo)] : []))),
                getDocs(query(collection(firestore, 'ppobBpjs'), ...(dateFrom ? [where('date', '>=', dateFrom)] : []), ...(dateTo ? [where('date', '<=', dateTo)] : []))),
            ];

            const [
                transfersSnapshot, 
                withdrawalsSnapshot, 
                topUpsSnapshot, 
                kjpWithdrawalsSnapshot,
                vaPaymentsSnapshot,
                emoneyTopUpsSnapshot,
                edcServicesSnapshot,
                bpjsSnapshot,
            ] = await Promise.all(queries);

            const combinedReports: ReportItem[] = [];

            transfersSnapshot.forEach((doc) => {
                const data = doc.data();
                combinedReports.push({ 
                    id: doc.id, 
                    ...data,
                    date: (data.date as Timestamp).toDate(),
                    transactionType: 'Transfer' 
                } as any);
            });

            withdrawalsSnapshot.forEach((doc) => {
                const data = doc.data();
                combinedReports.push({ 
                    id: doc.id, 
                    ...data,
                    date: (data.date as Timestamp).toDate(),
                    transactionType: 'Tarik Tunai' 
                } as any);
            });

            topUpsSnapshot.forEach((doc) => {
                const data = doc.data();
                combinedReports.push({
                    id: doc.id,
                    ...data,
                    date: (data.date as Timestamp).toDate(),
                    transactionType: 'Top Up'
                } as any);
            });

            kjpWithdrawalsSnapshot.forEach((doc) => {
                const data = doc.data();
                combinedReports.push({
                    id: doc.id,
                    ...data,
                    date: (data.date as Timestamp).toDate(),
                    transactionType: 'Tarik Tunai KJP'
                } as any);
            });

            vaPaymentsSnapshot.forEach((doc) => {
                const data = doc.data();
                combinedReports.push({
                    id: doc.id,
                    ...data,
                    date: (data.date as Timestamp).toDate(),
                    transactionType: 'VA Payment'
                } as any);
            });
            
            emoneyTopUpsSnapshot.forEach((doc) => {
                const data = doc.data();
                combinedReports.push({
                    id: doc.id,
                    ...data,
                    date: (data.date as Timestamp).toDate(),
                    transactionType: 'Top Up E-Money'
                } as any);
            });

            edcServicesSnapshot.forEach((doc) => {
                const data = doc.data();
                combinedReports.push({
                    id: doc.id,
                    ...data,
                    date: (data.date as Timestamp).toDate(),
                    transactionType: 'Layanan EDC'
                } as any);
            });

            bpjsSnapshot.forEach((doc) => {
                const data = doc.data();
                combinedReports.push({
                    id: doc.id,
                    ...data,
                    date: (data.date as Timestamp).toDate(),
                    transactionType: 'BPJS'
                } as any);
            });

            combinedReports.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            setReports(combinedReports);

        } catch (error) {
            console.error("Error fetching bookkeeping reports: ", error);
        } finally {
            setIsLoading(false);
        }
    };
    
    if (kasAccounts) {
        fetchReports();
    }
  }, [firestore, dateRange, kasAccounts]);

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setIsDownloading(true);

    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(reportRef.current, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [canvas.width, canvas.height]
    });
    
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    const dateFrom = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : 'start';
    const dateTo = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : 'end';
    pdf.save(`Laporan-Pembukuan-${dateFrom}_${dateTo}.pdf`);

    setIsDownloading(false);
  };


  const getAccountLabel = (accountId?: string) => {
    if (!accountId) return 'N/A';
    return kasAccounts?.find(acc => acc.id === accountId)?.label || accountId;
  };
  
  const totalProfit = reports.reduce((sum, report) => {
    if (report.transactionType === 'Transfer' || report.transactionType === 'VA Payment') {
        return sum + report.netProfit;
    }
    if (report.transactionType === 'BPJS') {
        return sum + report.netProfit;
    }
    if (report.transactionType === 'Tarik Tunai' || report.transactionType === 'Top Up' || report.transactionType === 'Tarik Tunai KJP' || report.transactionType === 'Layanan EDC' || report.transactionType === 'Top Up E-Money') {
        return sum + report.serviceFee;
    }
    return sum;
  }, 0);

  return (
    <div className="h-full flex flex-col bg-background">
        <header className="p-4 space-y-4 border-b bg-background z-20">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onDone}>
                    <ArrowLeft />
                </Button>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold">Laporan Transaksi BRILink</h1>
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
            <div ref={reportRef} className="bg-background p-4">
            {isLoading ? (
            <div className="px-4 space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
            ) : reports.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                    <CalendarIcon size={48} strokeWidth={1} className="text-muted-foreground mb-4" />
                    <p className="font-semibold">Belum Ada Laporan</p>
                    <p className="text-sm text-muted-foreground">Tidak ada transaksi untuk rentang tanggal yang dipilih.</p>
                </div>
            ) : (
                <Table className="text-[11px] whitespace-nowrap">
                    <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                            <TableHead className="sticky left-0 bg-background z-20 w-[40px] py-2">No</TableHead>
                            <TableHead className="sticky left-[40px] bg-background z-20 py-2">Deskripsi</TableHead>
                            <TableHead className="py-2">Akun Kas</TableHead>
                            <TableHead className="py-2">Bank/Tujuan</TableHead>
                            <TableHead className="py-2">Nama</TableHead>
                            <TableHead className="text-right py-2">Nominal</TableHead>
                            <TableHead className="py-2">Oleh</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reports.map((report, index) => (
                            <TableRow key={report.id}>
                                <TableCell className="sticky left-0 bg-background z-10 py-2">{index + 1}</TableCell>
                                {report.transactionType === 'Transfer' ? (
                                    <>
                                        <TableCell className="sticky left-[40px] bg-background z-10 py-2">{report.transactionType}</TableCell>
                                        <TableCell className="py-2">{getAccountLabel(report.sourceKasAccountId)}</TableCell>
                                        <TableCell className="py-2">{report.destinationBankName}</TableCell>
                                        <TableCell className="py-2">{report.destinationAccountName}</TableCell>
                                        <TableCell className="text-right py-2">{formatToRupiah(report.transferAmount)}</TableCell>
                                        <TableCell className="py-2">{report.deviceName}</TableCell>
                                    </>
                                ) : report.transactionType === 'Tarik Tunai' ? (
                                    <>
                                        <TableCell className="sticky left-[40px] bg-background z-10 py-2">{report.transactionType}</TableCell>
                                        <TableCell className="py-2">{getAccountLabel(report.destinationKasAccountId)}</TableCell>
                                        <TableCell className="py-2">{report.customerBankSource}</TableCell>
                                        <TableCell className="py-2">{report.customerName}</TableCell>
                                        <TableCell className="text-right py-2">{formatToRupiah(report.withdrawalAmount)}</TableCell>
                                        <TableCell className="py-2">{report.deviceName}</TableCell>
                                    </>
                                ) : report.transactionType === 'Top Up' ? (
                                    <>
                                        <TableCell className="sticky left-[40px] bg-background z-10 py-2">{report.transactionType}</TableCell>
                                        <TableCell className="py-2">{getAccountLabel(report.sourceKasAccountId)}</TableCell>
                                        <TableCell className="py-2">{report.destinationEwallet}</TableCell>
                                        <TableCell className="py-2">{report.customerName}</TableCell>
                                        <TableCell className="text-right py-2">{formatToRupiah(report.topUpAmount)}</TableCell>
                                        <TableCell className="py-2">{report.deviceName}</TableCell>
                                    </>
                               ) : report.transactionType === 'Tarik Tunai KJP' ? (
                                    <>
                                       <TableCell className="sticky left-[40px] bg-background z-10 py-2">{report.transactionType}</TableCell>
                                       <TableCell className="py-2">{getAccountLabel(report.destinationMerchantAccountId)}</TableCell>
                                       <TableCell className="py-2">Bank DKI</TableCell>
                                       <TableCell className="py-2">{report.customerName}</TableCell>
                                       <TableCell className="text-right py-2">{formatToRupiah(report.withdrawalAmount)}</TableCell>
                                       <TableCell className="py-2">{report.deviceName}</TableCell>
                                   </>
                               ) : report.transactionType === 'VA Payment' ? (
                                    <>
                                       <TableCell className="sticky left-[40px] bg-background z-10 py-2">{report.transactionType}</TableCell>
                                       <TableCell className="py-2">{getAccountLabel(report.sourceKasAccountId)}</TableCell>
                                       <TableCell className="py-2">{report.serviceProvider}</TableCell>
                                       <TableCell className="py-2">{report.recipientName}</TableCell>
                                       <TableCell className="text-right py-2">{formatToRupiah(report.paymentAmount)}</TableCell>
                                       <TableCell className="py-2">{report.deviceName}</TableCell>
                                   </>
                               ) : report.transactionType === 'Layanan EDC' ? (
                                    <>
                                       <TableCell className="sticky left-[40px] bg-background z-10 py-2">{report.transactionType}</TableCell>
                                       <TableCell className="py-2">{getAccountLabel(report.paymentToKasTunaiAccountId)}</TableCell>
                                       <TableCell className="py-2">{report.machineUsed}</TableCell>
                                       <TableCell className="py-2">{report.customerName}</TableCell>
                                       <TableCell className="text-right py-2">{formatToRupiah(report.serviceFee)}</TableCell>
                                       <TableCell className="py-2">{report.deviceName}</TableCell>
                                   </>
                               ) : report.transactionType === 'Top Up E-Money' ? (
                                    <>
                                       <TableCell className="sticky left-[40px] bg-background z-10 py-2">{report.transactionType}</TableCell>
                                       <TableCell className="py-2">{getAccountLabel(report.sourceKasAccountId)}</TableCell>
                                       <TableCell className="py-2">{report.destinationEmoney}</TableCell>
                                       <TableCell className="py-2">N/A</TableCell>
                                       <TableCell className="text-right py-2">{formatToRupiah(report.topUpAmount)}</TableCell>
                                       <TableCell className="py-2">{report.deviceName}</TableCell>
                                   </>
                               ) : report.transactionType === 'BPJS' ? (
                                <>
                                   <TableCell className="sticky left-[40px] bg-background z-10 py-2">{report.transactionType}</TableCell>
                                   <TableCell className="py-2">{getAccountLabel(report.sourcePPOBAccountId)}</TableCell>
                                   <TableCell className="py-2">BPJS Kesehatan</TableCell>
                                   <TableCell className="py-2">{report.customerName}</TableCell>
                                   <TableCell className="text-right py-2">{formatToRupiah(report.totalAmount)}</TableCell>
                                   <TableCell className="py-2">{report.deviceName}</TableCell>
                                </>
                               ) : null}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
            </div>
>>>>>>> 47270179c625b8a38256d185cfef579e9c896adf
        </div>
      </div>
  ),
})

export default function BookkeepingReport({ onDone }: { onDone: () => void }) {
  return <BookkeepingReportClient onDone={onDone} />
}
