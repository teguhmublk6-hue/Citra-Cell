
"use client";

import { useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs, orderBy, where, Timestamp } from 'firebase/firestore';
import type { CustomerTransfer, CustomerWithdrawal } from '@/lib/types';
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

interface BookkeepingReportProps {
  onDone: () => void;
}

type ReportItem = (CustomerTransfer & { id: string; transactionType: 'Transfer' }) | (CustomerWithdrawal & { id: string; transactionType: 'Tarik Tunai' });

const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const num = Number(String(value).replace(/[^0-9]/g, ''));
    if (isNaN(num)) return 'Rp 0';
    return `Rp ${num.toLocaleString('id-ID')}`;
};

const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
            const transfersQuery = query(
                collection(firestore, 'customerTransfers'),
                ...(dateRange?.from ? [where('date', '>=', Timestamp.fromDate(startOfDay(dateRange.from)))] : []),
                ...(dateRange?.to ? [where('date', '<=', Timestamp.fromDate(endOfDay(dateRange.to)))] : [])
            );

            const withdrawalsQuery = query(
                collection(firestore, 'customerWithdrawals'),
                ...(dateRange?.from ? [where('date', '>=', Timestamp.fromDate(startOfDay(dateRange.from)))] : []),
                ...(dateRange?.to ? [where('date', '<=', Timestamp.fromDate(endOfDay(dateRange.to)))] : [])
            );

            const [transfersSnapshot, withdrawalsSnapshot] = await Promise.all([
                getDocs(transfersQuery),
                getDocs(withdrawalsQuery)
            ]);

            const combinedReports: ReportItem[] = [];

            transfersSnapshot.forEach((doc) => {
                combinedReports.push({ id: doc.id, ...(doc.data() as CustomerTransfer), transactionType: 'Transfer' });
            });

            withdrawalsSnapshot.forEach((doc) => {
                combinedReports.push({ id: doc.id, ...(doc.data() as CustomerWithdrawal), transactionType: 'Tarik Tunai' });
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
    if (report.transactionType === 'Tarik Tunai') {
        return sum + report.serviceFee;
    }
    return sum;
  }, 0);

  return (
    <div className="h-full flex flex-col bg-background">
        <header className="p-4 flex items-center gap-4 border-b sticky top-0 bg-background z-10">
            <Button variant="ghost" size="icon" onClick={onDone}>
                <ArrowLeft />
            </Button>
            <h1 className="text-lg font-semibold">Laporan BRILink</h1>
        </header>

        <div className="p-4 space-y-4">
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
            <Card>
                <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Total Laba Bersih</p>
                    <p className="text-2xl font-bold">{formatToRupiah(totalProfit)}</p>
                </CardContent>
            </Card>
        </div>
      
        <ScrollArea className="flex-1 px-4">
            {isLoading && (
            <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
            </div>
            )}
            {!isLoading && reports.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                    <CalendarIcon size={48} strokeWidth={1} className="text-muted-foreground mb-4" />
                    <p className="font-semibold">Belum Ada Laporan</p>
                    <p className="text-sm text-muted-foreground">Tidak ada transaksi untuk rentang tanggal yang dipilih.</p>
                </div>
            )}
            {!isLoading && reports.length > 0 && (
                <div className="space-y-3 pb-4">
                    {reports.map((report) => (
                        <Card key={report.id}>
                            <CardContent className="p-3">
                                {report.transactionType === 'Transfer' && (
                                    <div className="flex items-start gap-3">
                                        <div className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center bg-blue-500/10">
                                            <Send size={16} className="text-blue-500" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <p className="font-semibold">Transfer: {report.destinationAccountName}</p>
                                                <p className="font-bold text-green-500">{formatToRupiah(report.netProfit)}</p>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {formatToRupiah(report.transferAmount)} (Jasa: {formatToRupiah(report.serviceFee)})
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {getAccountLabel(report.sourceKasAccountId)} → {report.destinationBankName}
                                            </p>
                                            <p className="text-xs text-muted-foreground/80 mt-1">{formatDateTime(report.date)} oleh {report.deviceName}</p>
                                        </div>
                                    </div>
                                )}
                                {report.transactionType === 'Tarik Tunai' && (
                                    <div className="flex items-start gap-3">
                                        <div className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center bg-gray-500/10">
                                            <Wallet size={16} className="text-gray-500" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <p className="font-semibold">Tarik Tunai: {report.customerName}</p>
                                                <p className="font-bold text-green-500">{formatToRupiah(report.serviceFee)}</p>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {formatToRupiah(report.withdrawalAmount)} (Total: {formatToRupiah(report.totalTransfer)})
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {report.customerBankSource} → {getAccountLabel(report.destinationKasAccountId)}
                                            </p>
                                            <p className="text-xs text-muted-foreground/80 mt-1">{formatDateTime(report.date)} oleh {report.deviceName}</p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </ScrollArea>
    </div>
  );
}
