
"use client";

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { CustomerTransfer } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Separator } from '../ui/separator';
import { BookText } from 'lucide-react';

interface BookkeepingReportProps {
  onDone: () => void;
}

type CustomerTransferWithId = CustomerTransfer & { id: string };

const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '') return 'Rp 0';
    const num = Number(String(value).replace(/[^0-9]/g, ''));
    if (isNaN(num)) return 'Rp 0';
    return `Rp ${num.toLocaleString('id-ID')}`;
};

export default function BookkeepingReport({ onDone }: BookkeepingReportProps) {
  const firestore = useFirestore();

  const customerTransfersCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'customerTransfers'), orderBy('date', 'desc'));
  }, [firestore]);
  
  const { data: reports, isLoading } = useCollection<CustomerTransferWithId>(customerTransfersCollection);

  const formatDateTime = (isoString: string) => {
    if (!isoString) return 'Tanggal tidak valid';
    return new Date(isoString).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="h-full flex flex-col pt-4">
      <ScrollArea className="flex-1 -mx-6 px-6">
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
        {!isLoading && (!reports || reports.length === 0) && (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <BookText size={48} strokeWidth={1} className="text-muted-foreground mb-4" />
            <p className="font-semibold">Belum Ada Laporan</p>
            <p className="text-sm text-muted-foreground">Belum ada transaksi transfer pelanggan yang tercatat.</p>
          </div>
        )}
        {!isLoading && reports && reports.length > 0 && (
          <div className="flex flex-col">
            {reports.map((report, index) => (
              <div key={report.id} className="py-4">
                <p className="text-sm text-muted-foreground mb-2">{formatDateTime(report.date)}</p>
                <div className="text-sm space-y-1">
                    <p><strong>#{reports.length - index}:</strong> Transaksi dari akun <strong>{report.sourceKasAccountId}</strong> ke <strong>{report.destinationBankName}</strong> sebesar <strong>{formatToRupiah(report.transferAmount)}</strong> a/n <strong>{report.destinationAccountName}</strong>.</p>
                    <p>Biaya admin: {formatToRupiah(report.bankAdminFee)}, Jasa: {formatToRupiah(report.serviceFee)}.</p>
                </div>
                 <Separator className="mt-4" />
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
      <div className="mt-4">
        <Button variant="outline" className="w-full" onClick={onDone}>Tutup</Button>
      </div>
    </div>
  );
}
