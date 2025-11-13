"use client"

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

<<<<<<< HEAD
const OperationalCostReportClient = dynamic(() => import('./OperationalCostReportClient'), {
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
import type { Settlement, Transaction } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ArrowLeft, Download, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfDay, endOfDay } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '../ui/card';
import type { KasAccount } from '@/lib/data';
import jsPDF from 'jspdf';
// Do not import html2canvas directly at the top

interface OperationalCostReportProps {
  onDone: () => void;
}

type CostItem = {
    id: string;
    date: Date;
    description: string;
    amount: number;
    source: string;
};

const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const num = Number(String(value).replace(/[^0-9]/g, ''));
    if (isNaN(num)) return 'Rp 0';
    return `Rp ${num.toLocaleString('id-ID')}`;
};

export default function OperationalCostReport({ onDone }: OperationalCostReportProps) {
  const firestore = useFirestore();
  const [costs, setCosts] = useState<CostItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfDay(new Date()), to: endOfDay(new Date()) });
  const [isDownloading, setIsDownloading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

  const getAccountLabel = (accountId?: string) => {
    if (!accountId) return 'N/A';
    return kasAccounts?.find(acc => acc.id === accountId)?.label || accountId;
  };

  useEffect(() => {
    const fetchCosts = async () => {
        if (!firestore) return;
        setIsLoading(true);

        try {
            const dateFrom = dateRange?.from ? Timestamp.fromDate(startOfDay(dateRange.from)) : null;
            const dateTo = dateRange?.to ? Timestamp.fromDate(endOfDay(dateRange.to)) : null;

            const combinedCosts: CostItem[] = [];

            // 1. Fetch Settlement MDR fees
            const settlementsQuery = query(
                collection(firestore, 'settlements'),
                ...(dateFrom ? [where('date', '>=', dateFrom)] : []),
                ...(dateTo ? [where('date', '<=', dateTo)] : [])
            );
            const settlementsSnapshot = await getDocs(settlementsQuery);
            settlementsSnapshot.forEach(docSnap => {
                const data = docSnap.data() as Settlement;
                if (data.mdrFee > 0) {
                    combinedCosts.push({
                        id: `settlement-${docSnap.id}`,
                        date: (data.date as unknown as Timestamp).toDate(),
                        description: `Biaya MDR Settlement dari ${getAccountLabel(data.sourceMerchantAccountId)}`,
                        amount: data.mdrFee,
                        source: 'Settlement'
                    });
                }
            });

            // 2. Fetch 'operational' and other fee categories from transactions
            if (kasAccounts) {
                 const feeCategories = ['operational', 'operational_fee', 'transfer_fee'];
                 for (const account of kasAccounts) {
                    const transQuery = query(
                        collection(firestore, 'kasAccounts', account.id, 'transactions'),
                         where('category', 'in', feeCategories),
                         ...(dateFrom ? [where('date', '>=', dateFrom.toDate().toISOString())] : []),
                         ...(dateTo ? [where('date', '<=', dateTo.toDate().toISOString())] : [])
                    );
                    const transSnapshot = await getDocs(transQuery);
                    
                    transSnapshot.forEach(docSnap => {
                        const data = docSnap.data() as Transaction;
                        combinedCosts.push({
                            id: `trx-${docSnap.id}`,
                            date: new Date(data.date),
                            description: data.name,
                            amount: data.amount,
                            source: `Akun ${account.label}`
                        });
                    });
                 }
            }


            combinedCosts.sort((a, b) => b.date.getTime() - a.date.getTime());
            setCosts(combinedCosts);

        } catch (error) {
            console.error("Error fetching operational costs: ", error);
        } finally {
            setIsLoading(false);
        }
    };
    
    if (kasAccounts) {
      fetchCosts();
    }
  }, [firestore, dateRange, kasAccounts]);

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setIsDownloading(true);

    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(reportRef.current, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [canvas.width, canvas.height]
    });
    
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    const dateFrom = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : 'start';
    const dateTo = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : 'end';
    pdf.save(`Laporan-Biaya-Operasional-${dateFrom}_${dateTo}.pdf`);

    setIsDownloading(false);
  };
  
  const totalCost = costs.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="h-full flex flex-col bg-background">
        <header className="p-4 space-y-4 border-b bg-background z-20">
             <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onDone}>
                    <ArrowLeft />
                </Button>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold">Laporan Biaya Operasional</h1>
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
                    </div>
                ) : costs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                        <CalendarIcon size={48} strokeWidth={1} className="text-muted-foreground mb-4" />
                        <p className="font-semibold">Belum Ada Laporan</p>
                        <p className="text-sm text-muted-foreground">Tidak ada biaya operasional untuk rentang tanggal yang dipilih.</p>
                    </div>
                ) : (
                    <Table className="text-sm whitespace-nowrap">
                        <TableHeader className="sticky top-0 bg-background z-10">
                            <TableRow>
                                <TableHead className="w-[40px] sticky left-0 bg-background z-20 py-2">No</TableHead>
                                <TableHead className="sticky left-[40px] bg-background z-20 py-2">Tanggal</TableHead>
                                <TableHead className="py-2">Deskripsi Biaya</TableHead>
                                <TableHead className="py-2">Sumber</TableHead>
                                <TableHead className="text-right py-2">Jumlah</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {costs.map((cost, index) => (
                                <TableRow key={cost.id}>
                                    <TableCell className="sticky left-0 bg-background z-10 py-2">{index + 1}</TableCell>
                                    <TableCell className="sticky left-[40px] bg-background z-10 py-2">{format(cost.date, 'dd/MM/yy HH:mm')}</TableCell>
                                    <TableCell className="py-2">{cost.description}</TableCell>
                                    <TableCell className="py-2">{cost.source}</TableCell>
                                    <TableCell className="text-right py-2">{formatToRupiah(cost.amount)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
                 {!isLoading && costs.length > 0 && (
                    <div className="border-t bg-muted/50 p-4 mt-4">
                        <div className="flex justify-between items-center">
                            <p className="text-lg font-bold">Total Biaya Operasional</p>
                            <p className="text-xl font-bold text-destructive">{formatToRupiah(totalCost)}</p>
                        </div>
                    </div>
                )}
            </div>
>>>>>>> 47270179c625b8a38256d185cfef579e9c896adf
        </div>
      </div>
  ),
})

export default function OperationalCostReport({ onDone }: { onDone: () => void }) {
  return <OperationalCostReportClient onDone={onDone} />
}
