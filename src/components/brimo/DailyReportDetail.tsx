"use client";

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { DailyReport as DailyReportType } from '@/lib/data';
<<<<<<< HEAD

const DailyReportDetailClient = dynamic(() => import('./DailyReportDetailClient'), {
  ssr: false,
  loading: () => (
      <div className="p-4 space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="space-y-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
=======
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Separator } from '../ui/separator';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import jsPDF from 'jspdf';
// Do not import html2canvas directly at the top

interface DailyReportDetailProps {
  report: DailyReportType;
  onDone: () => void;
}

const formatToRupiah = (value: number | string | undefined | null): string => {
  if (value === null || value === undefined || value === '' || isNaN(Number(value))) return 'Rp 0';
  const num = Number(value);
  const isNegative = num < 0;
  const formattedNum = Math.abs(num).toLocaleString('id-ID');
  return `${isNegative ? '-Rp ' : 'Rp '}${formattedNum}`;
};

export default function DailyReportDetail({ report, onDone }: DailyReportDetailProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

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
    const reportDate = (report.date as any).toDate ? (report.date as any).toDate() : new Date(report.date);
    pdf.save(`Laporan-Harian-${format(reportDate, "yyyy-MM-dd")}.pdf`);

    setIsDownloading(false);
  };

  const groupedAccounts = useMemo(() => {
    if (!report.accountSnapshots) return {};

    const groups = report.accountSnapshots.reduce((acc, account) => {
        const type = account.type || 'Lainnya';
        if (!acc[type]) {
            acc[type] = [];
        }
        acc[type].push(account);
        return acc;
    }, {} as Record<string, { label: string; balance: number; type: string; }[]>);
    
    return groups;
  }, [report.accountSnapshots]);

  const accountTypes = useMemo(() => {
      const order: (keyof typeof groupedAccounts)[] = ['Bank', 'E-Wallet', 'Merchant', 'PPOB', 'Tunai'];
      const dynamicTypes = Object.keys(groupedAccounts).filter(type => !order.includes(type));
      
      const allSortedTypes = order.concat(dynamicTypes.sort()).filter(type => groupedAccounts[type]);
      
      return allSortedTypes;
  }, [groupedAccounts]);

  const renderSectionA = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-primary">A. Saldo Akun</h2>
        <div className="space-y-4 text-sm">
          {accountTypes.map(type => (
            <div key={type}>
              <h3 className="font-semibold text-muted-foreground mb-2">{type}</h3>
              <div className="space-y-2">
                {groupedAccounts[type].map(acc => (
                  <div key={acc.label} className="flex justify-between">
                    <span>{acc.label}</span>
                    <span className="font-medium">{formatToRupiah(acc.balance)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-4 pt-4 border-t font-bold flex justify-between text-base">
            <span>TOTAL SALDO AKUN (Saat Laporan)</span>
            <span>{formatToRupiah(report.totalAccountBalance)}</span>
          </div>
>>>>>>> 47270179c625b8a38256d185cfef579e9c896adf
        </div>
      </div>
  ),
});

export default function DailyReportDetail({ report, onDone }: { report: DailyReportType, onDone: () => void }) {
  return <DailyReportDetailClient report={report} onDone={onDone} />;
}
