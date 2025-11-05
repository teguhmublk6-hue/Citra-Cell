
"use client";

import { useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs, orderBy, where, Timestamp } from 'firebase/firestore';
import type { ShiftReconciliation } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ArrowLeft } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfDay, endOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ShiftReconciliationReportProps {
  onDone: () => void;
}

const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const num = Number(String(value).replace(/[^0-9]/g, ''));
    if (isNaN(num)) return 'Rp 0';
    return `Rp ${num.toLocaleString('id-ID')}`;
};

export default function ShiftReconciliationReport({ onDone }: ShiftReconciliationReportProps) {
  const firestore = useFirestore();
  const [reports, setReports] = useState<ShiftReconciliation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfDay(new Date()), to: endOfDay(new Date()) });

  useEffect(() => {
    const fetchReports = async () => {
        if (!firestore) return;
        setIsLoading(true);

        try {
            const dateFrom = dateRange?.from ? Timestamp.fromDate(startOfDay(dateRange.from)) : null;
            const dateTo = dateRange?.to ? Timestamp.fromDate(endOfDay(dateRange.to)) : null;

            const q = query(
                collection(firestore, 'shiftReconciliations'),
                ...(dateFrom ? [where('date', '>=', dateFrom)] : []),
                ...(dateTo ? [where('date', '<=', dateTo)] : []),
                orderBy('date', 'desc')
            );

            const querySnapshot = await getDocs(q);
            const fetchedReports = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: (doc.data().date as Timestamp).toDate(),
            })) as ShiftReconciliation[];
            
            setReports(fetchedReports);

        } catch (error) {
            console.error("Error fetching shift reconciliations: ", error);
        } finally {
            setIsLoading(false);
        }
    };
    
    fetchReports();
  }, [firestore, dateRange]);
  

  return (
    <div className="h-full flex flex-col bg-background">
        <header className="p-4 space-y-4 border-b bg-background z-20">
             <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onDone}>
                    <ArrowLeft />
                </Button>
                <h1 className="text-lg font-semibold">Laporan Rekonsiliasi Shift</h1>
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
                </div>
            ) : reports.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                    <CalendarIcon size={48} strokeWidth={1} className="text-muted-foreground mb-4" />
                    <p className="font-semibold">Belum Ada Laporan</p>
                    <p className="text-sm text-muted-foreground">Tidak ada rekonsiliasi untuk rentang tanggal yang dipilih.</p>
                </div>
            ) : (
                <Table className="text-sm whitespace-nowrap">
                    <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                            <TableHead className="w-[40px] sticky left-0 bg-background z-20 py-2">No</TableHead>
                            <TableHead className="sticky left-[40px] bg-background z-20 py-2">Tanggal</TableHead>
                            <TableHead>Operator</TableHead>
                            <TableHead className="text-right">Modal Awal</TableHead>
                            <TableHead className="text-right">Kas Masuk</TableHead>
                            <TableHead className="text-right">Total Seharusnya</TableHead>
                            <TableHead className="text-right">Total Fisik</TableHead>
                            <TableHead className="text-right">Selisih</TableHead>
                            <TableHead>Catatan</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reports.map((item, index) => (
                            <TableRow key={item.id} className={cn(item.difference !== 0 && 'bg-destructive/10')}>
                                <TableCell className="sticky left-0 bg-background z-10 py-2">{index + 1}</TableCell>
                                <TableCell className="sticky left-[40px] bg-background z-10 py-2">{format(item.date, 'dd/MM/yy HH:mm')}</TableCell>
                                <TableCell>{item.operatorName}</TableCell>
                                <TableCell className="text-right">{formatToRupiah(item.initialCapital)}</TableCell>
                                <TableCell className="text-right">{formatToRupiah(item.appCashIn + item.voucherCashIn)}</TableCell>
                                <TableCell className="text-right">{formatToRupiah(item.expectedTotalCash)}</TableCell>
                                <TableCell className="text-right">{formatToRupiah(item.actualPhysicalCash)}</TableCell>
                                <TableCell className={cn("text-right font-bold", item.difference !== 0 ? 'text-destructive' : 'text-green-500')}>
                                    {formatToRupiah(item.difference)}
                                </TableCell>
                                <TableCell>{item.notes}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </div>
    </div>
  );
}
