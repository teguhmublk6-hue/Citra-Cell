
"use client";

import { useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs, where, Timestamp, orderBy } from 'firebase/firestore';
import type { DailyReport, Transaction, Settlement, CustomerTransfer, CustomerWithdrawal, CustomerTopUp, CustomerEmoneyTopUp, CustomerVAPayment, EDCService, CustomerKJPWithdrawal, PPOBTransaction, PPOBPlnPostpaid, PPOBPdam, PPOBBpjs, PPOBWifi } from '@/lib/types';
import type { KasAccount } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ArrowLeft, Download, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfDay, endOfDay } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';

interface CombinedReportClientProps {
  onDone: () => void;
}

const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '' || isNaN(Number(value))) return 'Rp 0';
    const num = Number(String(value).replace(/[^0-9-]/g, ''));
    const isNegative = num < 0;
    return `${isNegative ? '-' : ''}Rp ${Math.abs(num).toLocaleString('id-ID')}`;
};

export default function CombinedReportClient({ onDone }: CombinedReportClientProps) {
  const firestore = useFirestore();
  const [isLoading, setIsLoading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfDay(new Date()), to: endOfDay(new Date()) });
  const [isDownloading, setIsDownloading] = useState(false);

  const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

  const handleDownloadPDF = async () => {
    if (!firestore || !dateRange?.from) return;
    setIsDownloading(true);

    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();
    const dateFrom = startOfDay(dateRange.from);
    const dateTo = endOfDay(dateRange.to || dateRange.from);
    const dateTitle = format(dateFrom, "EEEE, dd MMMM yyyy", { locale: idLocale });

    let finalY = 22;
    
    // Helper to add title
    const addReportTitle = (title: string, startY: number) => {
        doc.setFontSize(18);
        doc.text(title, 14, startY);
        doc.setFontSize(10);
        doc.text(dateTitle, 14, startY + 7);
        return startY + 15;
    };

    // --- 1. Daily Report V5 ---
    try {
        finalY = addReportTitle('Laporan Harian V5', 22);
        const dailyReportQuery = query(
            collection(firestore, "dailyReports"),
            where('date', '>=', Timestamp.fromDate(dateFrom)),
            where('date', '<=', Timestamp.fromDate(dateTo)),
            orderBy('date', 'desc')
        );
        const dailyReportSnapshot = await getDocs(dailyReportQuery);
        
        if (!dailyReportSnapshot.empty) {
            const report = dailyReportSnapshot.docs[0].data() as DailyReport;
            // The logic from DailyReportDetailClient's PDF generation
            const addGridSection = (title: string, head: any[], body: any[], startY: number): number => {
                doc.setFontSize(12);
                doc.text(title, 14, startY);
                autoTable(doc, { head, body, startY: startY + 2, theme: 'grid', headStyles: { fillColor: '#f1f5f9', textColor: '#000' }, styles: { fontSize: 9 } });
                return (doc as any).lastAutoTable.finalY + 4;
            };

            const sectionA_Body = report.accountSnapshots.map(acc => [acc.label, formatToRupiah(acc.balance)]);
            finalY = addGridSection('A. Saldo Akun', [['Akun', 'Saldo']], sectionA_Body, finalY);
            // ... (add all other sections A-G for the daily report here)
        } else {
            doc.setFontSize(10);
            doc.text("Tidak ada data Laporan Harian V5 untuk tanggal ini.", 14, finalY);
            finalY += 10;
        }

    } catch (e) { console.error("Error generating Daily Report V5 part:", e); }


    // --- 2. Profit/Loss Report ---
    doc.addPage();
    try {
        finalY = addReportTitle('Laporan Laba/Rugi', 22);
        // ... (insert data fetching and table generation for Profit/Loss here)
        doc.text("Data Laporan Laba/Rugi akan ditampilkan di sini.", 14, finalY);
        finalY += 10;

    } catch (e) { console.error("Error generating P/L Report part:", e); }
    
    // --- 3. Capital Addition Report ---
    doc.addPage();
    try {
        finalY = addReportTitle('Laporan Penambahan Saldo', 22);
        // ... (insert data fetching and table generation for Capital Additions here)
        doc.text("Data Laporan Penambahan Saldo akan ditampilkan di sini.", 14, finalY);
        finalY += 10;

    } catch (e) { console.error("Error generating Capital Addition Report part:", e); }

    // --- Finalize PDF ---
    const pdfOutput = doc.output('datauristring');
    const pdfWindow = window.open();
    if (pdfWindow) {
        pdfWindow.document.write(`<iframe width='100%' height='100%' src='${pdfOutput}'></iframe>`);
    } else {
        alert('Gagal membuka jendela baru. Mohon izinkan pop-up untuk situs ini.');
    }

    setIsDownloading(false);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="p-4 space-y-4 border-b">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onDone}>
            <ArrowLeft />
          </Button>
          <h1 className="text-lg font-semibold flex-1">Unduh Laporan Gabungan</h1>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button id="date" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
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
      <ScrollArea className="flex-1 p-4">
        <p className="text-sm text-muted-foreground mb-4">Fitur ini akan menggabungkan beberapa laporan penting ke dalam satu file PDF untuk rentang tanggal yang Anda pilih.</p>
        <ul className="list-disc list-inside space-y-2 text-sm">
            <li>Laporan Harian V5</li>
            <li>Laporan Laba/Rugi</li>
            <li>Laporan Penambahan Saldo</li>
            <li>Laporan Biaya Operasional</li>
        </ul>
      </ScrollArea>
      <footer className="p-4 border-t">
        <Button className="w-full" onClick={handleDownloadPDF} disabled={isDownloading}>
          {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {isDownloading ? 'Menyiapkan Laporan...' : 'Unduh Laporan Gabungan'}
        </Button>
      </footer>
    </div>
  );
}
