
"use client";

import { useState, useEffect, useRef } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs, orderBy, where, Timestamp } from 'firebase/firestore';
import type { Transaction } from '@/lib/data';
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
import type { KasAccount } from '@/lib/data';

interface CapitalAdditionReportClientProps {
  onDone: () => void;
}

type CapitalItem = {
    id: string;
    date: Date;
    description: string;
    amount: number;
    destinationAccount: string;
};

const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const num = Number(String(value).replace(/[^0-9]/g, ''));
    if (isNaN(num)) return 'Rp 0';
    return `Rp ${num.toLocaleString('id-ID')}`;
};

export default function CapitalAdditionReportClient({ onDone }: CapitalAdditionReportClientProps) {
  const firestore = useFirestore();
  const [additions, setAdditions] = useState<CapitalItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfDay(new Date()), to: endOfDay(new Date()) });
  const [isDownloading, setIsDownloading] = useState(false);

  const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

  const getAccountLabel = (accountId?: string) => {
    if (!accountId) return 'N/A';
    return kasAccounts?.find(acc => acc.id === accountId)?.label || accountId;
  };

  useEffect(() => {
    const fetchAdditions = async () => {
        if (!firestore || !kasAccounts) return;
        setIsLoading(true);

        try {
            const dateFrom = dateRange?.from ? startOfDay(dateRange.from).toISOString() : null;
            const dateTo = dateRange?.to ? endOfDay(dateRange.to).toISOString() : null;

            const combinedAdditions: CapitalItem[] = [];

            for (const account of kasAccounts) {
                const transQuery = query(
                    collection(firestore, 'kasAccounts', account.id, 'transactions'),
                    where('category', '==', 'capital'),
                    ...(dateFrom ? [where('date', '>=', dateFrom)] : []),
                    ...(dateTo ? [where('date', '<=', dateTo)] : [])
                );
                const transSnapshot = await getDocs(transQuery);
                
                transSnapshot.forEach(docSnap => {
                    const data = docSnap.data() as Transaction;
                    if (data.type === 'credit') {
                      combinedAdditions.push({
                          id: `trx-${docSnap.id}`,
                          date: new Date(data.date),
                          description: data.name,
                          amount: data.amount,
                          destinationAccount: account.label
                      });
                    }
                });
            }

            combinedAdditions.sort((a, b) => b.date.getTime() - a.date.getTime());
            setAdditions(combinedAdditions);

        } catch (error) {
            console.error("Error fetching capital additions: ", error);
        } finally {
            setIsLoading(false);
        }
    };
    
    if (kasAccounts) {
      fetchAdditions();
    }
  }, [firestore, dateRange, kasAccounts]);

  const handleDownloadPDF = async () => {
    if (additions.length === 0) return;
    setIsDownloading(true);

    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();

    const dateFrom = dateRange?.from ? format(dateRange.from, "d MMMM yyyy", { locale: idLocale }) : '';
    const dateTo = dateRange?.to ? format(dateRange.to, "d MMMM yyyy", { locale: idLocale }) : dateFrom;
    const dateTitle = dateRange?.from ? (dateFrom === dateTo ? dateFrom : `${dateFrom} - ${dateTo}`) : 'Semua Waktu';
    
    doc.setFontSize(16);
    doc.text('Laporan Penambahan Saldo', 14, 15);
    doc.setFontSize(10);
    doc.text(dateTitle, 14, 22);
  
    const tableData = additions.map((item, index) => [
        index + 1,
        format(item.date, 'dd/MM/yy HH:mm'),
        item.description,
        item.destinationAccount,
        formatToRupiah(item.amount),
    ]);

    autoTable(doc, {
        head: [['No', 'Tanggal', 'Deskripsi', 'Masuk Ke Akun', 'Jumlah']],
        body: tableData,
        startY: 30,
        theme: 'grid',
        headStyles: { fillColor: [22, 160, 133] },
        styles: { fontSize: 8 },
        columnStyles: {
            4: { halign: 'right' }
        },
        didDrawPage: (data) => {
            const finalY = data.cursor?.y || 0;
            doc.setFontSize(10);
            doc.text('Total Penambahan Saldo:', 14, finalY + 10);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(formatToRupiah(totalAddition), (doc as any).internal.pageSize.getWidth() - 14, finalY + 10, { align: 'right' });
        }
    });
  
    const pdfOutput = doc.output('datauristring');
    const pdfWindow = window.open();
    if (pdfWindow) {
        pdfWindow.document.write(`<iframe width='100%' height='100%' src='${pdfOutput}'></iframe>`);
    } else {
        alert('Gagal membuka jendela baru. Mohon izinkan pop-up untuk situs ini.');
    }
    setIsDownloading(false);
  };
  
  const totalAddition = additions.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="h-full flex flex-col bg-background">
        <header className="p-4 space-y-4 border-b bg-background z-20">
             <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onDone}>
                    <ArrowLeft />
                </Button>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold">Laporan Penambahan Saldo</h1>
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
            <div className="bg-background p-4">
            {isLoading ? (
                <div className="px-4 space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            ) : additions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                    <CalendarIcon size={48} strokeWidth={1} className="text-muted-foreground mb-4" />
                    <p className="font-semibold">Belum Ada Laporan</p>
                    <p className="text-sm text-muted-foreground">Tidak ada penambahan saldo untuk rentang tanggal yang dipilih.</p>
                </div>
            ) : (
                <Table className="text-sm whitespace-nowrap">
                    <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                            <TableHead className="w-[40px] sticky left-0 bg-background z-20 py-2">No</TableHead>
                            <TableHead className="sticky left-[40px] bg-background z-20 py-2">Tanggal</TableHead>
                            <TableHead className="py-2">Deskripsi</TableHead>
                            <TableHead className="py-2">Masuk Ke Akun</TableHead>
                            <TableHead className="text-right py-2">Jumlah</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {additions.map((item, index) => (
                            <TableRow key={item.id}>
                                <TableCell className="sticky left-0 bg-background z-10 py-2">{index + 1}</TableCell>
                                <TableCell className="sticky left-[40px] bg-background z-10 py-2">{format(item.date, 'dd/MM/yy HH:mm')}</TableCell>
                                <TableCell className="py-2">{item.description}</TableCell>
                                <TableCell className="py-2">{item.destinationAccount}</TableCell>
                                <TableCell className="text-right py-2">{formatToRupiah(item.amount)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="font-bold bg-muted/50">
                            <TableCell colSpan={4}>Total Penambahan Saldo</TableCell>
                            <TableCell className="text-right py-2">{formatToRupiah(totalAddition)}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            )}
            </div>
        </div>
    </div>
  );
}
