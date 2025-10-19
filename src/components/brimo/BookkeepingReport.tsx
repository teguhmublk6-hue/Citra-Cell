
"use client";

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { CustomerTransfer } from '@/lib/types';
import type { KasAccount } from '@/lib/data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { BookText } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";


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

  const kasAccountsCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'kasAccounts');
  }, [firestore]);
  const { data: kasAccounts } = useCollection<KasAccount>(kasAccountsCollection);

  const customerTransfersCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'customerTransfers'), orderBy('date', 'desc'));
  }, [firestore]);
  
  const { data: reports, isLoading } = useCollection<CustomerTransferWithId>(customerTransfersCollection);

  const getAccountLabel = (accountId: string) => {
    return kasAccounts?.find(acc => acc.id === accountId)?.label || accountId;
  }

  const formatDateTime = (isoString: string) => {
    if (!isoString) return 'Tanggal tidak valid';
    return new Date(isoString).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isLoadingData = isLoading || (kasAccounts === undefined);

  return (
    <div className="h-full flex flex-col pt-4">
      <ScrollArea className="flex-1 -mx-6 px-1">
        {isLoadingData && (
          <div className="space-y-2 px-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}
        {!isLoadingData && (!reports || reports.length === 0) && (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <BookText size={48} strokeWidth={1} className="text-muted-foreground mb-4" />
            <p className="font-semibold">Belum Ada Laporan</p>
            <p className="text-sm text-muted-foreground">Belum ada transaksi transfer pelanggan yang tercatat.</p>
          </div>
        )}
        {!isLoadingData && reports && reports.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">#</TableHead>
                <TableHead>Detail Transaksi</TableHead>
                <TableHead className="text-right">Jasa</TableHead>
                <TableHead className="text-right">Admin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report, index) => (
                <TableRow key={report.id}>
                  <TableCell className="font-medium">{reports.length - index}</TableCell>
                  <TableCell>
                    <div className="font-medium truncate">
                      {getAccountLabel(report.sourceKasAccountId)} ke {report.destinationBankName}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatToRupiah(report.transferAmount)} a/n {report.destinationAccountName}
                    </div>
                     <div className="text-xs text-muted-foreground mt-1">{formatDateTime(report.date)}</div>
                  </TableCell>
                  <TableCell className="text-right text-green-500">{formatToRupiah(report.serviceFee)}</TableCell>
                  <TableCell className="text-right text-red-500">{formatToRupiah(report.bankAdminFee)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ScrollArea>
      <div className="mt-4 px-6">
        <Button variant="outline" className="w-full" onClick={onDone}>Tutup</Button>
      </div>
    </div>
  );
}
