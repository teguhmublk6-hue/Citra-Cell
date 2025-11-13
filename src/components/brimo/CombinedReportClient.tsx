
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
    return `${isNegative ? '-Rp ' : 'Rp '}${Math.abs(num).toLocaleString('id-ID')}`;
};

export default function CombinedReportClient({ onDone }: CombinedReportClientProps) {
  const firestore = useFirestore();
  const [isLoading, setIsLoading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfDay(new Date()), to: endOfDay(new Date()) });
  const [isDownloading, setIsDownloading] = useState(false);

  const kasAccountsCollection = useMemoFirebase(() => collection(firestore, 'kasAccounts'), [firestore]);
  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);
  
  const getAccountLabel = (accountId?: string) => {
    if (!accountId) return 'N/A';
    return kasAccounts?.find(acc => acc.id === accountId)?.label || accountId;
  };

  const handleDownloadPDF = async () => {
    if (!firestore || !dateRange?.from || !kasAccounts) return;
    setIsDownloading(true);

    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();
    const dateFrom = startOfDay(dateRange.from);
    const dateTo = endOfDay(dateRange.to || dateRange.from);
    const dateTitle = format(dateFrom, "EEEE, dd MMMM yyyy", { locale: idLocale });
    let finalY = 0;

    const addReportTitle = (title: string, startY: number): number => {
        doc.setFontSize(18);
        doc.text(title, 14, startY);
        doc.setFontSize(10);
        doc.text(dateTitle, 14, startY + 7);
        return startY + 15;
    };
    
    const addGridSection = (title: string, head: any[], body: any[], startY: number): number => {
        doc.setFontSize(12);
        doc.text(title, 14, startY);
        autoTable(doc, { head, body, startY: startY + 2, theme: 'grid', headStyles: { fillColor: '#f1f5f9', textColor: '#000', fontSize: 9 }, styles: { fontSize: 10 }, columnStyles: { 1: { halign: 'right' } } });
        return (doc as any).lastAutoTable.finalY + 8;
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
            const sectionA_Body = report.accountSnapshots.map(acc => [acc.label, formatToRupiah(acc.balance)]);
            finalY = addGridSection('A. Saldo Akun', [['Akun', 'Saldo']], sectionA_Body, finalY);
            autoTable(doc, { body: [[{ content: 'TOTAL', styles: { fontStyle: 'bold' } }, { content: formatToRupiah(report.totalAccountBalance), styles: { fontStyle: 'bold', halign: 'right' } }]], startY: (doc as any).lastAutoTable.finalY, theme: 'grid' });
            finalY = (doc as any).lastAutoTable.finalY + 8;
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
        const brilinkCollections = ['customerTransfers', 'customerWithdrawals', 'customerTopUps', 'customerEmoneyTopUps', 'customerVAPayments', 'edcServices', 'customerKJPWithdrawals'];
        const ppobCollections = ['ppobTransactions', 'ppobPlnPostpaid', 'ppobPdam', 'ppobBpjs', 'ppobWifi'];
        
        let totalBrilinkProfit = 0;
        let totalPPOBProfit = 0;

        for (const col of brilinkCollections) {
            const q = query(collection(firestore, col), where('date', '>=', Timestamp.fromDate(dateFrom)), where('date', '<=', Timestamp.fromDate(dateTo)));
            const snapshot = await getDocs(q);
            snapshot.forEach(doc => { totalBrilinkProfit += (doc.data().netProfit ?? doc.data().serviceFee ?? 0); });
        }
        for (const col of ppobCollections) {
            const q = query(collection(firestore, col), where('date', '>=', Timestamp.fromDate(dateFrom)), where('date', '<=', Timestamp.fromDate(dateTo)));
            const snapshot = await getDocs(q);
            snapshot.forEach(doc => { totalPPOBProfit += (doc.data().profit ?? doc.data().netProfit ?? 0); });
        }

        autoTable(doc, {
            head: [['Deskripsi', 'Total Laba']],
            body: [
                ['BRILink', formatToRupiah(totalBrilinkProfit)],
                ['PPOB', formatToRupiah(totalPPOBProfit)],
                [{ content: 'TOTAL LABA KOTOR', styles: { fontStyle: 'bold' } }, { content: formatToRupiah(totalBrilinkProfit + totalPPOBProfit), styles: { fontStyle: 'bold' } }]
            ],
            startY: finalY,
            theme: 'grid',
            columnStyles: { 1: { halign: 'right' } }
        });
        finalY = (doc as any).lastAutoTable.finalY + 8;
    } catch (e) { console.error("Error generating P/L Report part:", e); }
    
    // --- 3. Capital Addition Report ---
    doc.addPage();
    try {
        finalY = addReportTitle('Laporan Penambahan Saldo', 22);
        let capitalAdditions = 0;
        let capitalBody: any[] = [];

        for (const account of kasAccounts) {
            const transQuery = query(collection(firestore, 'kasAccounts', account.id, 'transactions'), where('category', '==', 'capital'), where('date', '>=', dateFrom.toISOString()), where('date', '<=', dateTo.toISOString()));
            const transSnapshot = await getDocs(transQuery);
            transSnapshot.forEach(docSnap => {
                const trx = docSnap.data() as Transaction;
                if (trx.type === 'credit') {
                    capitalAdditions += trx.amount;
                    capitalBody.push([format(new Date(trx.date), 'dd/MM HH:mm'), trx.name, account.label, formatToRupiah(trx.amount)]);
                }
            });
        }
        autoTable(doc, {
            head: [['Tanggal', 'Deskripsi', 'Ke Akun', 'Jumlah']],
            body: capitalBody,
            startY: finalY,
            theme: 'grid',
            columnStyles: { 3: { halign: 'right' } }
        });
        autoTable(doc, { body: [[{ content: 'TOTAL', colSpan: 3, styles: { fontStyle: 'bold' } }, { content: formatToRupiah(capitalAdditions), styles: { fontStyle: 'bold', halign: 'right' } }]], startY: (doc as any).lastAutoTable.finalY, theme: 'grid' });
        finalY = (doc as any).lastAutoTable.finalY + 8;

    } catch (e) { console.error("Error generating Capital Addition Report part:", e); }

    // --- 4. Operational Cost Report ---
    doc.addPage();
    try {
        finalY = addReportTitle('Laporan Biaya Operasional', 22);
        let totalCosts = 0;
        let costBody: any[] = [];
        const feeCategories = ['operational', 'operational_fee', 'transfer_fee'];

        const settlementsQuery = query(collection(firestore, 'settlements'), where('date', '>=', Timestamp.fromDate(dateFrom)), where('date', '<=', Timestamp.fromDate(dateTo)));
        const settlementsSnapshot = await getDocs(settlementsQuery);
        settlementsSnapshot.forEach(docSnap => {
            const data = docSnap.data() as Settlement;
            if (data.mdrFee > 0) {
                totalCosts += data.mdrFee;
                costBody.push([format((data.date as any).toDate(), 'dd/MM HH:mm'), `Biaya MDR Settlement dari ${getAccountLabel(data.sourceMerchantAccountId)}`, formatToRupiah(data.mdrFee)]);
            }
        });
        for (const account of kasAccounts) {
            const transQuery = query(collection(firestore, 'kasAccounts', account.id, 'transactions'), where('category', 'in', feeCategories), where('date', '>=', dateFrom.toISOString()), where('date', '<=', dateTo.toISOString()));
            const transSnapshot = await getDocs(transQuery);
            transSnapshot.forEach(docSnap => {
                const trx = docSnap.data() as Transaction;
                totalCosts += trx.amount;
                costBody.push([format(new Date(trx.date), 'dd/MM HH:mm'), trx.name, formatToRupiah(trx.amount)]);
            });
        }
        autoTable(doc, {
            head: [['Tanggal', 'Deskripsi', 'Jumlah']],
            body: costBody,
            startY: finalY,
            theme: 'grid',
            columnStyles: { 2: { halign: 'right' } }
        });
         autoTable(doc, { body: [[{ content: 'TOTAL BIAYA', colSpan: 2, styles: { fontStyle: 'bold' } }, { content: formatToRupiah(totalCosts), styles: { fontStyle: 'bold', halign: 'right' } }]], startY: (doc as any).lastAutoTable.finalY, theme: 'grid' });
        finalY = (doc as any).lastAutoTable.finalY + 8;
    } catch (e) { console.error("Error generating OpCost Report part:", e); }


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
