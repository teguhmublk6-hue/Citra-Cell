

"use client";

import { useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { DailyReport } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpenCheck } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { Card, CardContent } from '../ui/card';

interface DailyReportHistoryProps {
  onDone: () => void;
  onViewReport: (report: DailyReport) => void;
}

const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '' || isNaN(Number(value))) return 'Rp 0';
    const num = Number(value);
    const isNegative = num < 0;
    const formattedNum = Math.abs(num).toLocaleString('id-ID');
    return `${isNegative ? '-Rp ' : 'Rp '}${formattedNum}`;
};

export default function DailyReportHistory({ onDone, onViewReport }: DailyReportHistoryProps) {
  const firestore = useFirestore();
  const dailyReportsCollection = useMemoFirebase(() => query(collection(firestore, 'dailyReports'), orderBy('date', 'desc')), [firestore]);
  const { data: reports, isLoading } = useCollection<DailyReport>(dailyReportsCollection);

  return (
    <div className="h-full flex flex-col bg-background">
        <header className="p-4 flex items-center gap-4 border-b">
            <Button variant="ghost" size="icon" onClick={onDone}>
                <ArrowLeft />
            </Button>
            <h1 className="text-lg font-semibold">Riwayat Laporan Harian</h1>
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
                                    {format(new Date(report.date.seconds * 1000), "EEEE, dd MMMM yyyy", { locale: idLocale })}
                                </h3>
                                <div className="text-sm space-y-2 text-muted-foreground">
                                    <div className="flex justify-between">
                                        <span>Laba Bersih:</span>
                                        <span className={cn("font-semibold", report.netProfit < 0 ? "text-destructive" : "text-green-500")}>
                                            {formatToRupiah(report.netProfit)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Akumulasi Liquid:</span>
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
                        <p className="text-sm text-muted-foreground">Buat laporan harian pertama Anda.</p>
                    </div>
                )}
            </div>
        </ScrollArea>
    </div>
  );
}

