
"use client";

import { useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs, orderBy, where, Timestamp } from 'firebase/firestore';
import type { PPOBTransaction, PPOBPlnPostpaid, PPOBPdam, PPOBBpjs, PPOBWifi } from '@/lib/types';
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
import { Card, CardContent } from '../ui/card';

interface PPOBReportProps {
  onDone: () => void;
}

type MergedPPOBReportItem = {
    id: string;
    date: Date;
    serviceName: string;
    destination: string;
    description: string;
    costPrice: number;
    sellingPrice: number;
    profit: number;
    sourcePPOBAccountId?: string;
    deviceName: string;
}

const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const num = Number(String(value).replace(/[^0-9]/g, ''));
    if (isNaN(num)) return 'Rp 0';
    return `Rp ${num.toLocaleString('id-ID')}`;
};

export default function PPOBReport({ onDone }: PPOBReportProps) {
  const firestore = useFirestore();
  const [reports, setReports] = useState<MergedPPOBReportItem[]>([]);
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
                getDocs(query(collection(firestore, 'ppobTransactions'), ...(dateFrom ? [where('date', '>=', dateFrom)] : []), ...(dateTo ? [where('date', '<=', dateTo)] : []))),
                getDocs(query(collection(firestore, 'ppobPlnPostpaid'), ...(dateFrom ? [where('date', '>=', dateFrom)] : []), ...(dateTo ? [where('date', '<=', dateTo)] : []))),
                getDocs(query(collection(firestore, 'ppobPdam'), ...(dateFrom ? [where('date', '>=', dateFrom)] : []), ...(dateTo ? [where('date', '<=', dateTo)] : []))),
                getDocs(query(collection(firestore, 'ppobBpjs'), ...(dateFrom ? [where('date', '>=', dateFrom)] : []), ...(dateTo ? [where('date', '<=', dateTo)] : []))),
                getDocs(query(collection(firestore, 'ppobWifi'), ...(dateFrom ? [where('date', '>=', dateFrom)] : []), ...(dateTo ? [where('date', '<=', dateTo)] : []))),
            ];
            
            const [ppobSnapshot, plnPostpaidSnapshot, pdamSnapshot, bpjsSnapshot, wifiSnapshot] = await Promise.all(queries);

            const fetchedReports: MergedPPOBReportItem[] = [];

            ppobSnapshot.forEach(doc => {
                const data = doc.data() as PPOBTransaction;
                fetchedReports.push({ 
                    id: doc.id, 
                    ...data,
                    date: (data.date as any).toDate()
                });
            });

            plnPostpaidSnapshot.forEach(doc => {
                const data = doc.data() as PPOBPlnPostpaid;
                fetchedReports.push({
                    id: doc.id,
                    date: (data.date as any).toDate(),
                    serviceName: 'PLN Pascabayar',
                    destination: data.customerName,
                    description: `Tagihan an. ${data.customerName}`,
                    costPrice: data.billAmount,
                    sellingPrice: data.totalAmount,
                    profit: data.netProfit,
                    sourcePPOBAccountId: data.sourcePPOBAccountId,
                    deviceName: data.deviceName
                });
            });

            pdamSnapshot.forEach(doc => {
                const data = doc.data() as PPOBPdam;
                fetchedReports.push({
                    id: doc.id,
                    date: (data.date as any).toDate(),
                    serviceName: 'PDAM',
                    destination: data.customerName,
                    description: `Tagihan an. ${data.customerName}`,
                    costPrice: data.billAmount,
                    sellingPrice: data.totalAmount,
                    profit: data.netProfit,
                    sourcePPOBAccountId: data.sourcePPOBAccountId,
                    deviceName: data.deviceName
                });
            });

            bpjsSnapshot.forEach(doc => {
                const data = doc.data() as PPOBBpjs;
                fetchedReports.push({
                    id: doc.id,
                    date: (data.date as any).toDate(),
                    serviceName: 'BPJS',
                    destination: data.customerName,
                    description: `Tagihan an. ${data.customerName}`,
                    costPrice: data.billAmount,
                    sellingPrice: data.totalAmount,
                    profit: data.netProfit,
                    sourcePPOBAccountId: data.sourcePPOBAccountId,
                    deviceName: data.deviceName
                });
            });

            wifiSnapshot.forEach(doc => {
                const data = doc.data() as PPOBWifi;
                fetchedReports.push({
                    id: doc.id,
                    date: (data.date as any).toDate(),
                    serviceName: 'Wifi',
                    destination: data.customerName,
                    description: `Tagihan an. ${data.customerName}`,
                    costPrice: data.billAmount,
                    sellingPrice: data.totalAmount,
                    profit: data.netProfit,
                    sourcePPOBAccountId: data.sourcePPOBAccountId,
                    deviceName: data.deviceName
                });
            });
            
            fetchedReports.sort((a, b) => b.date.getTime() - a.date.getTime());
            
            setReports(fetchedReports);

        } catch (error) {
            console.error("Error fetching PPOB reports: ", error);
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
    acc.costPrice += report.costPrice;
    acc.sellingPrice += report.sellingPrice;
    acc.profit += report.profit;
    return acc;
  }, { costPrice: 0, sellingPrice: 0, profit: 0 });
  
  const parseDenomination = (description: string) => {
    const match = description.match(/\d+/);
    return match ? parseInt(match[0], 10).toLocaleString('id-ID') : description;
  };


  return (
    <div className="h-full flex flex-col bg-background">
        <header className="p-4 space-y-4 border-b bg-background z-20">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onDone}>
                    <ArrowLeft />
                </Button>
                <h1 className="text-lg font-semibold">Laporan Transaksi PPOB</h1>
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
                <div className="p-4 space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            ) : reports.length === 0 ? (
                <Card className="m-4">
                    <CardContent className="pt-6 text-center text-muted-foreground">
                        Tidak ada transaksi PPOB untuk tanggal ini.
                    </CardContent>
                </Card>
            ) : (
                <Table className="text-[11px] whitespace-nowrap">
                    <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                            <TableHead className="sticky left-0 bg-background z-20 w-[50px] py-2">No</TableHead>
                            <TableHead className="sticky left-[50px] bg-background z-20 py-2">Layanan</TableHead>
                            <TableHead className="py-2">Akun PPOB</TableHead>
                            <TableHead className="py-2">Tujuan</TableHead>
                            <TableHead className="text-right py-2">Harga Modal</TableHead>
                            <TableHead className="text-right py-2">Harga Jual</TableHead>
                            <TableHead className="py-2">Oleh</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reports.map((report, index) => (
                            <TableRow key={report.id}>
                                <TableCell className="sticky left-0 bg-background z-10 py-2">{index + 1}</TableCell>
                                <TableCell className="sticky left-[50px] bg-background z-10 py-2">{report.serviceName}</TableCell>
                                <TableCell className="py-2">{getAccountLabel(report.sourcePPOBAccountId)}</TableCell>
                                <TableCell className="py-2">{report.destination}</TableCell>
                                <TableCell className="text-right py-2">{formatToRupiah(report.costPrice)}</TableCell>
                                <TableCell className="text-right py-2">{formatToRupiah(report.sellingPrice)}</TableCell>
                                <TableCell className="py-2">{report.deviceName}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="font-bold bg-muted/50">
                            <TableCell colSpan={4}>Total</TableCell>
                            <TableCell className="text-right py-2">{formatToRupiah(totals.costPrice)}</TableCell>
                            <TableCell className="text-right py-2">{formatToRupiah(totals.sellingPrice)}</TableCell>
                            <TableCell></TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            )}
        </div>
    </div>
  );
}
