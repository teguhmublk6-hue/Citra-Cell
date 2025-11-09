

"use client";

import { useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where, Timestamp, getDocs, writeBatch } from 'firebase/firestore';
import type { DailyReport } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpenCheck, Calendar as CalendarIcon, FileText, RotateCw, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfDay, endOfDay } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { Card, CardContent } from '../ui/card';
import DeleteAllReportsDialog from './DeleteAllReportsDialog';
import { useToast } from '@/hooks/use-toast';

interface DailyReportHistoryProps {
  onDone: () => void;
  onViewReport: (report: DailyReport) => void;
  onResetAll: () => void;
}

const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '' || isNaN(Number(value))) return 'Rp 0';
    const num = Number(value);
    const isNegative = num < 0;
    const formattedNum = Math.abs(num).toLocaleString('id-ID');
    return `${isNegative ? '-Rp ' : 'Rp '}${formattedNum}`;
};

export default function DailyReportHistory({ onDone, onViewReport, onResetAll }: DailyReportHistoryProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  
  const dailyReportsCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    const constraints = [orderBy('date', 'desc')];
    if (dateRange?.from) {
      constraints.push(where('date', '>=', Timestamp.fromDate(startOfDay(dateRange.from))));
    }
    if (dateRange?.to) {
      constraints.push(where('date', '<=', Timestamp.fromDate(endOfDay(dateRange.to))));
    }
    return query(collection(firestore, 'dailyReports'), ...constraints);
  }, [firestore, dateRange]);

  const { data: fetchedReports, isLoading: isLoadingReports, error } = useCollection<DailyReport>(dailyReportsCollection);

  useEffect(() => {
    if (fetchedReports) {
      setReports(fetchedReports);
    }
    setIsLoading(isLoadingReports);
  }, [fetchedReports, isLoadingReports]);

  return (
    <>
    <div className="h-full flex flex-col bg-background">
        <header className="p-4 space-y-4 border-b">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onDone}>
                    <ArrowLeft />
                </Button>
                <h1 className="text-lg font-semibold flex-1">Riwayat Laporan Harian</h1>
                <Button variant="destructive" size="sm" onClick={() => setIsResetDialogOpen(true)}>
                  <Trash2 size={16} className="mr-2"/>
                  Reset
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
                        <span>Filter berdasarkan tanggal</span>
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

        <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
                {isLoading ? (
                    <>
                        <Skeleton className="h-32 w-full" />
                        <Skeleton className="h-32 w-full" />
                        <Skeleton className="h-32 w-full" />
                    </>
                ) : reports && reports.length > 0 ? (
                    reports.map(report => (
                        <Card key={report.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onViewReport(report)}>
                            <CardContent className="p-4">
                                <h3 className="font-bold text-lg mb-2">
                                    {format((report.date as any).toDate ? (report.date as any).toDate() : new Date(report.date), "EEEE, dd MMMM yyyy", { locale: idLocale })}
                                </h3>
                                <div className="text-sm space-y-2 text-muted-foreground">
                                    <div className="flex justify-between">
                                        <span>Laba Bersih:</span>
                                        <span className={cn("font-semibold", report.netProfit < 0 ? "text-destructive" : "text-green-500")}>
                                            {formatToRupiah(report.netProfit)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Total Kekayaan:</span>
                                        <span className={cn("font-semibold", report.liquidAccumulation < 0 ? "text-destructive" : "text-foreground")}>
                                            {formatToRupiah(report.liquidAccumulation)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Liabilitas Final:</span>
                                        <span className={cn("font-semibold", report.finalLiabilityForNextDay < 0 ? "text-destructive" : "text-foreground")}>
                                            {formatToRupiah(report.finalLiabilityForNextDay)}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                        <BookOpenCheck size={48} strokeWidth={1} className="text-muted-foreground mb-4" />
                        <p className="font-semibold">Belum Ada Riwayat Laporan</p>
                        <p className="text-sm text-muted-foreground">Tidak ada laporan untuk rentang tanggal yang dipilih.</p>
                    </div>
                )}
            </div>
        </ScrollArea>
    </div>
    <DeleteAllReportsDialog
      isOpen={isResetDialogOpen}
      onClose={() => setIsResetDialogOpen(false)}
      onConfirm={onResetAll}
      title="Reset Riwayat Laporan Harian?"
      description="Tindakan ini akan menghapus SEMUA riwayat laporan harian v5.0 secara permanen. Ini tidak dapat diurungkan."
      confirmationKeyword="HAPUS LAPORAN HARIAN"
    />
    </>
  );
}


