
"use client";

import { useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs, orderBy, where, Timestamp } from 'firebase/firestore';
import type { CustomerTransfer, CustomerWithdrawal, CustomerTopUp, CustomerVAPayment } from '@/lib/types';
import type { KasAccount } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ArrowLeft } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfDay, endOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface ProfitLossReportProps {
  onDone: () => void;
}

type ReportItem = 
    | (CustomerTransfer & { id: string; transactionType: 'Transfer' }) 
    | (CustomerWithdrawal & { id: string; transactionType: 'Tarik Tunai' }) 
    | (CustomerTopUp & { id: string; transactionType: 'Top Up' })
    | (CustomerVAPayment & { id: string; transactionType: 'VA Payment' });


const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const num = Number(String(value).replace(/[^0-9]/g, ''));
    if (isNaN(num)) return 'Rp 0';
    return `Rp ${num.toLocaleString('id-ID')}`;
};

export default function ProfitLossReport({ onDone }: ProfitLossReportProps) {
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
                getDocs(query(collection(firestore, 'customerVAPayments'), ...(dateFrom ? [where('date', '>=', dateFrom)] : []), ...(dateTo ? [where('date', '<=', dateTo)] : [])))
            ];
            
            const [transfersSnapshot, withdrawalsSnapshot, topUpsSnapshot, vaPaymentsSnapshot] = await Promise.all(queries);

            const combinedReports: ReportItem[] = [];

            transfersSnapshot.forEach((doc) => {
                const data = doc.data();
                combinedReports.push({ 
                    id: doc.id, 
                    ...(data as CustomerTransfer),
                    date: (data.date as Timestamp).toDate(),
                    transactionType: 'Transfer' 
                });
            });

            withdrawalsSnapshot.forEach((doc) => {
                const data = doc.data();
                combinedReports.push({ 
                    id: doc.id, 
                    ...(data as CustomerWithdrawal),
                    date: (data.date as Timestamp).toDate(),
                    transactionType: 'Tarik Tunai' 
                });
            });

            topUpsSnapshot.forEach((doc) => {
                const data = doc.data();
                combinedReports.push({
                    id: doc.id,
                    ...(data as CustomerTopUp),
                    date: (data.date as Timestamp).toDate(),
                    transactionType: 'Top Up'
                });
            });

            vaPaymentsSnapshot.forEach((doc) => {
                const data = doc.data();
                combinedReports.push({
                    id: doc.id,
                    ...(data as CustomerVAPayment),
                    date: (data.date as Timestamp).toDate(),
                    transactionType: 'VA Payment'
                });
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
  
  const totals = reports.reduce((acc, report) => {
    if (report.transactionType === 'Transfer') {
        acc.nominal += report.transferAmount;
        acc.adminBank += report.bankAdminFee;
        acc.jasa += report.serviceFee;
        acc.labaRugi += report.netProfit;
    } else if (report.transactionType === 'Tarik Tunai') {
        acc.nominal += report.withdrawalAmount;
        acc.jasa += report.serviceFee;
        acc.labaRugi += report.serviceFee;
    } else if (report.transactionType === 'Top Up') {
        acc.nominal += report.topUpAmount;
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

  return (
    <div className="h-full flex flex-col bg-background">
        <header className="p-4 flex items-center gap-4 border-b sticky top-0 bg-background z-10">
            <Button variant="ghost" size="icon" onClick={onDone}>
                <ArrowLeft />
            </Button>
            <h1 className="text-lg font-semibold">Laporan Laba/Rugi Harian</h1>
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
      
        <div className="flex-1 overflow-auto px-4 space-y-6">
            <div>
                <h2 className="text-lg font-semibold mb-2">A. BRILink</h2>
                {isLoading && (
                <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
                )}
                {!isLoading && reports.length === 0 && (
                    <Card>
                        <CardContent className="pt-6 text-center text-muted-foreground">
                            Tidak ada transaksi BRILink untuk tanggal ini.
                        </CardContent>
                    </Card>
                )}
                {!isLoading && reports.length > 0 && (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40px]">No</TableHead>
                                <TableHead>Layanan</TableHead>
                                <TableHead>Akun Kas</TableHead>
                                <TableHead>Bank/Tujuan</TableHead>
                                <TableHead>Nama</TableHead>
                                <TableHead className="text-right">Nominal</TableHead>
                                <TableHead className="text-right">Admin Bank</TableHead>
                                <TableHead className="text-right">Jasa</TableHead>
                                <TableHead className="text-right">Laba/Rugi</TableHead>
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
                                            <TableCell className="text-right">{formatToRupiah(report.serviceFee)}</TableCell>
                                            <TableCell className="text-right font-semibold text-green-500">{formatToRupiah(report.netProfit)}</TableCell>
                                            <TableCell>{report.deviceName}</TableCell>
                                        </>
                                    ) : report.transactionType === 'Tarik Tunai' ? (
                                        <>
                                            <TableCell>Tarik Tunai</TableCell>
                                            <TableCell>{getAccountLabel(report.destinationKasAccountId)}</TableCell>
                                            <TableCell>{report.customerBankSource}</TableCell>
                                            <TableCell>{report.customerName}</TableCell>
                                            <TableCell className="text-right">{formatToRupiah(report.withdrawalAmount)}</TableCell>
                                            <TableCell className="text-right">Rp 0</TableCell>
                                            <TableCell className="text-right">{formatToRupiah(report.serviceFee)}</TableCell>
                                            <TableCell className="text-right font-semibold text-green-500">{formatToRupiah(report.serviceFee)}</TableCell>
                                            <TableCell>{report.deviceName}</TableCell>
                                        </>
                                    ) : report.transactionType === 'Top Up' ? (
                                        <>
                                            <TableCell>Top Up</TableCell>
                                            <TableCell>{getAccountLabel(report.sourceKasAccountId)}</TableCell>
                                            <TableCell>{report.destinationEwallet}</TableCell>
                                            <TableCell>{report.customerName}</TableCell>
                                            <TableCell className="text-right">{formatToRupiah(report.topUpAmount)}</TableCell>
                                            <TableCell className="text-right">Rp 0</TableCell>
                                            <TableCell className="text-right">{formatToRupiah(report.serviceFee)}</TableCell>
                                            <TableCell className="text-right font-semibold text-green-500">{formatToRupiah(report.serviceFee)}</TableCell>
                                            <TableCell>{report.deviceName}</TableCell>
                                        </>
                                    ) : report.transactionType === 'VA Payment' ? (
                                        <>
                                            <TableCell>VA Payment</TableCell>
                                            <TableCell>{getAccountLabel(report.sourceKasAccountId)}</TableCell>
                                            <TableCell>{report.serviceProvider}</TableCell>
                                            <TableCell>{report.recipientName}</TableCell>
                                            <TableCell className="text-right">{formatToRupiah(report.paymentAmount)}</TableCell>
                                            <TableCell className="text-right">{formatToRupiah(report.adminFee)}</TableCell>
                                            <TableCell className="text-right">{formatToRupiah(report.serviceFee)}</TableCell>
                                            <TableCell className="text-right font-semibold text-green-500">{formatToRupiah(report.netProfit)}</TableCell>
                                            <TableCell>{report.deviceName}</TableCell>
                                        </>
                                    ) : null}
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="font-bold bg-muted/50">
                                <TableCell colSpan={5}>Total</TableCell>
                                <TableCell className="text-right">{formatToRupiah(totals.nominal)}</TableCell>
                                <TableCell className="text-right">{formatToRupiah(totals.adminBank)}</TableCell>
                                <TableCell className="text-right">{formatToRupiah(totals.jasa)}</TableCell>
                                <TableCell className="text-right">{formatToRupiah(totals.labaRugi)}</TableCell>
                                <TableCell></TableCell>
                            </TableRow>
                            <TableRow className="font-bold text-lg bg-muted">
                                <TableCell colSpan={8}>Total Laba Bersih</TableCell>
                                <TableCell colSpan={2} className="text-right text-green-600">{formatToRupiah(totals.labaRugi)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                )}
            </div>

            <div>
                <h2 className="text-lg font-semibold mb-2">B. PPOB</h2>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[40px]">No.</TableHead>
                            <TableHead>Nama Layanan</TableHead>
                            <TableHead>Akun Kas</TableHead>
                            <TableHead>Tujuan</TableHead>
                            <TableHead>Deskripsi</TableHead>
                            <TableHead className="text-right">Harga Modal</TableHead>
                            <TableHead className="text-right">Harga Jual</TableHead>
                            <TableHead className="text-right">Laba/Rugi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground pt-8">
                                Belum ada transaksi PPOB untuk tanggal ini.
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        </div>
    </div>
  );
}
