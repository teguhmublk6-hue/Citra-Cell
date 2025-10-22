
"use client";

import { useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs, orderBy, where, Timestamp } from 'firebase/firestore';
import type { CustomerTransfer, CustomerWithdrawal, CustomerTopUp, CustomerEmoneyTopUp, CustomerVAPayment, EDCService, CustomerKJPWithdrawal } from '@/lib/types';
import type { KasAccount } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ArrowLeft, Send, Wallet } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfDay, endOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { Card, CardContent } from '../ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface BookkeepingReportProps {
  onDone: () => void;
}

type ReportItem = 
    | (CustomerTransfer & { id: string; transactionType: 'Transfer' }) 
    | (CustomerWithdrawal & { id: string; transactionType: 'Tarik Tunai' }) 
    | (CustomerTopUp & { id: string; transactionType: 'Top Up' })
    | (CustomerKJPWithdrawal & { id: string; transactionType: 'Tarik Tunai KJP' });


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
            ];

            const [transfersSnapshot, withdrawalsSnapshot, topUpsSnapshot, kjpWithdrawalsSnapshot] = await Promise.all(queries);

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

            combinedReports.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            setReports(combinedReports);

        } catch (error) {
            console.error("Error fetching bookkeeping reports: ", error);
        } finally {
            setIsLoading(false);
        }
    };
    
    fetchReports();
  }, [firestore, dateRange]);


  const getAccountLabel = (accountId?: string) => {
    if (!accountId) return 'N/A';
    return kasAccounts?.find(acc => acc.id === accountId)?.label || accountId;
  };
  
  const totalProfit = reports.reduce((sum, report) => {
    if (report.transactionType === 'Transfer') {
        return sum + report.netProfit;
    }
    if (report.transactionType === 'Tarik Tunai' || report.transactionType === 'Top Up' || report.transactionType === 'Tarik Tunai KJP') {
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
                <h1 className="text-lg font-semibold">Laporan Transaksi BRILink</h1>
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
                               ) : null}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </div>
    </div>
  );
}
