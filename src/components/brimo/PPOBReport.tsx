
"use client";

import { useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs, orderBy, where, Timestamp } from 'firebase/firestore';
import type { PPOBTransaction } from '@/lib/types';
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

const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const num = Number(String(value).replace(/[^0-9]/g, ''));
    if (isNaN(num)) return 'Rp 0';
    return `Rp ${num.toLocaleString('id-ID')}`;
};

export default function PPOBReport({ onDone }: PPOBReportProps) {
  const firestore = useFirestore();
  const [reports, setReports] = useState<PPOBTransaction[]>([]);
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

            const q = query(
                collection(firestore, 'ppobTransactions'),
                ...(dateFrom ? [where('date', '>=', dateFrom)] : []),
                ...(dateTo ? [where('date', '<=', dateTo)] : []),
                orderBy('date', 'desc')
            );
            
            const snapshot = await getDocs(q);
            const fetchedReports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PPOBTransaction));
            
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
    return acc;
  }, { costPrice: 0, sellingPrice: 0 });

  return (
    <div className="h-full flex flex-col bg-background">
        <header className="p-4 flex items-center gap-4 border-b sticky top-0 bg-background z-10">
            <Button variant="ghost" size="icon" onClick={onDone}>
                <ArrowLeft />
            </Button>
            <h1 className="text-lg font-semibold">Laporan Transaksi PPOB</h1>
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
      
        <div className="flex-1 overflow-auto px-4">
            {isLoading ? (
                <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            ) : reports.length === 0 ? (
                <Card>
                    <CardContent className="pt-6 text-center text-muted-foreground">
                        Tidak ada transaksi PPOB untuk tanggal ini.
                    </CardContent>
                </Card>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[40px]">No</TableHead>
                            <TableHead>Layanan</TableHead>
                            <TableHead>Akun PPOB</TableHead>
                            <TableHead>Tujuan</TableHead>
                            <TableHead>Deskripsi</TableHead>
                            <TableHead className="text-right">Harga Modal</TableHead>
                            <TableHead className="text-right">Harga Jual</TableHead>
                            <TableHead>Oleh</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reports.map((report, index) => (
                            <TableRow key={report.id}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell>{report.serviceName}</TableCell>
                                <TableCell>{getAccountLabel(report.sourcePPOBAccountId)}</TableCell>
                                <TableCell>{report.destination}</TableCell>
                                <TableCell>
                                    {report.serviceName === 'Token Listrik' ? 'Token Listrik' : report.description}
                                </TableCell>
                                <TableCell className="text-right">{formatToRupiah(report.costPrice)}</TableCell>
                                <TableCell className="text-right">{formatToRupiah(report.sellingPrice)}</TableCell>
                                <TableCell>{report.deviceName}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="font-bold bg-muted/50">
                            <TableCell colSpan={5}>Total</TableCell>
                            <TableCell className="text-right">{formatToRupiah(totals.costPrice)}</TableCell>
                            <TableCell className="text-right">{formatToRupiah(totals.sellingPrice)}</TableCell>
                            <TableCell></TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            )}
        </div>
    </div>
  );
}
