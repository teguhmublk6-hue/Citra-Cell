
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

  const isLoadingData = isLoading || (kasAccounts === undefined);

  return (
    <div className="h-full flex flex-col pt-4">
      <ScrollArea className="flex-1 -mx-6">
        <div className="px-6">
          {isLoadingData && (
            <div className="space-y-2">
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
        </div>
        {!isLoadingData && reports && reports.length > 0 && (
          <div className="w-full overflow-x-auto px-6">
            <Table className="min-w-max whitespace-nowrap">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px] px-2 text-center">No</TableHead>
                  <TableHead className="px-2">Akun Kas</TableHead>
                  <TableHead className="px-2">Bank/Tujuan</TableHead>
                  <TableHead className="px-2">Nama</TableHead>
                  <TableHead className="text-right px-2">Nominal</TableHead>
                  <TableHead className="text-right px-2">Admin Bank</TableHead>
                  <TableHead className="text-right px-2">Jasa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report, index) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium px-2 text-center">{reports.length - index}</TableCell>
                    <TableCell className="px-2">{getAccountLabel(report.sourceKasAccountId)}</TableCell>
                    <TableCell className="px-2">{report.destinationBankName}</TableCell>
                    <TableCell className="px-2">{report.destinationAccountName}</TableCell>
                    <TableCell className="text-right px-2">{formatToRupiah(report.transferAmount)}</TableCell>
                    <TableCell className="text-right text-red-500 px-2">{formatToRupiah(report.bankAdminFee)}</TableCell>
                    <TableCell className="text-right text-green-500 px-2">{formatToRupiah(report.serviceFee)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </ScrollArea>
      <div className="mt-4 px-6 pb-4">
        <Button variant="outline" className="w-full" onClick={onDone}>Tutup</Button>
      </div>
    </div>
  );
}
