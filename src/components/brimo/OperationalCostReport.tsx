
"use client";

import { useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs, orderBy, where, Timestamp } from 'firebase/firestore';
import type { Settlement, Transaction } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ArrowLeft } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfDay, endOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '../ui/card';
import type { KasAccount } from '@/lib/data';

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

            // 2. Fetch 'operational_fee' or 'operational' from transactions
            if (kasAccounts) {
                 for (const account of kasAccounts) {
                    // Query only by date to avoid composite index requirement
                    const transQuery = query(
                        collection(firestore, 'kasAccounts', account.id, 'transactions'),
                         ...(dateFrom ? [where('date', '>=', dateFrom.toDate().toISOString())] : []),
                         ...(dateTo ? [where('date', '<=', dateTo.toDate().toISOString())] : [])
                    );
                    const transSnapshot = await getDocs(transQuery);
                    
                    // Filter by category on the client side
                    transSnapshot.forEach(docSnap => {
                        const data = docSnap.data() as Transaction;
                        if (data.category === 'operational' || data.category === 'operational_fee') {
                            combinedCosts.push({
                                id: `trx-${docSnap.id}`,
                                date: new Date(data.date),
                                description: data.name,
                                amount: data.amount,
                                source: `Akun ${account.label}`
                            });
                        }
                    })
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
    
    fetchCosts();
  }, [firestore, dateRange, kasAccounts]);
  
  const totalCost = costs.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="h-full flex flex-col bg-background">
        <header className="p-4 flex items-center gap-4 border-b sticky top-0 bg-background z-10">
            <Button variant="ghost" size="icon" onClick={onDone}>
                <ArrowLeft />
            </Button>
            <h1 className="text-lg font-semibold">Laporan Biaya Operasional</h1>
        </header>

        <div className="p-4 space-y-4">
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
        </div>
      
        <div className="flex-1 overflow-auto px-4">
            {isLoading ? (
                <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            ) : costs.length === 0 ? (
                <Card>
                    <CardContent className="pt-6 text-center text-muted-foreground">
                        Tidak ada biaya operasional untuk tanggal ini.
                    </CardContent>
                </Card>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[40px]">No</TableHead>
                            <TableHead>Tanggal</TableHead>
                            <TableHead>Deskripsi Biaya</TableHead>
                            <TableHead>Sumber</TableHead>
                            <TableHead className="text-right">Jumlah</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {costs.map((cost, index) => (
                            <TableRow key={cost.id}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell>{format(cost.date, 'dd/MM/yy HH:mm')}</TableCell>
                                <TableCell>{cost.description}</TableCell>
                                <TableCell>{cost.source}</TableCell>
                                <TableCell className="text-right">{formatToRupiah(cost.amount)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="font-bold text-lg bg-muted">
                            <TableCell colSpan={4}>Total Biaya Operasional</TableCell>
                            <TableCell className="text-right text-destructive">{formatToRupiah(totalCost)}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            )}
        </div>
    </div>
  );
}
