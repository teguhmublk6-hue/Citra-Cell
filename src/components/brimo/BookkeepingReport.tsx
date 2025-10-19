
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
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
        </div>
      
        <div className="flex-1 overflow-auto">
            {isLoading && (
            <div className="px-4 space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
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
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]">No</TableHead>
                            <TableHead>Layanan</TableHead>
                            <TableHead>Akun Kas</TableHead>
                            <TableHead>Bank/Tujuan</TableHead>
                            <TableHead>Nama</TableHead>
                            <TableHead className="text-right">Nominal</TableHead>
                            <TableHead className="text-right">Admin Bank</TableHead>
                            <TableHead className="text-right">Jasa</TableHead>
                            <TableHead>Oleh</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reports.map((report, index) => (
                            <TableRow key={report.id}>
                                <TableCell>{index + 1}</TableCell>
                                {report.transactionType === 'Transfer' ? (
                                    <>
                                        <TableCell>Transfer</TableCell>
                                        <TableCell>{getAccountLabel(report.sourceKasAccountId)}</TableCell>
                                        <TableCell>{report.destinationBankName}</TableCell>
                                        <TableCell>{report.destinationAccountName}</TableCell>
                                        <TableCell className="text-right">{formatToRupiah(report.transferAmount)}</TableCell>
                                        <TableCell className="text-right">{formatToRupiah(report.bankAdminFee)}</TableCell>
                                        <TableCell className="text-right font-semibold text-green-500">{formatToRupiah(report.netProfit)}</TableCell>
                                        <TableCell>{report.deviceName}</TableCell>
                                    </>
                                ) : (
                                    <>
                                        <TableCell>Tarik Tunai</TableCell>
                                        <TableCell>{getAccountLabel(report.destinationKasAccountId)}</TableCell>
                                        <TableCell>{report.customerBankSource}</TableCell>
                                        <TableCell>{report.customerName}</TableCell>
                                        <TableCell className="text-right">{formatToRupiah(report.withdrawalAmount)}</TableCell>
                                        <TableCell className="text-right">Rp 0</TableCell>
                                        <TableCell className="text-right font-semibold text-green-500">{formatToRupiah(report.serviceFee)}</TableCell>
                                        <TableCell>{report.deviceName}</TableCell>
                                    </>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </div>
    </div>
  );
}
    