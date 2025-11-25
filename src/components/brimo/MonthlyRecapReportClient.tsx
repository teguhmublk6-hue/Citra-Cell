"use client";

import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, getDocs, Timestamp, setDoc } from 'firebase/firestore';
import type { DailyReport, Transaction, MonthlyRecap as MonthlyRecapType } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, RotateCw, Save } from 'lucide-react';
import { addDays, subDays, startOfDay, endOfDay, format, getMonth, getYear, isWithinInterval } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';

interface MonthlyRecapReportClientProps {
  onDone: () => void;
}

const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '') return '';
    const num = Number(String(value).replace(/[^0-9]/g, ''));
    if (isNaN(num)) return '';
    return `Rp ${num.toLocaleString('id-ID')}`;
};

const parseRupiah = (value: string | undefined | null): number => {
    if (!value) return 0;
    return Number(String(value).replace(/[^0-9]/g, ''));
}

export default function MonthlyRecapReportClient({ onDone }: MonthlyRecapReportClientProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [recapData, setRecapData] = useState<Partial<MonthlyRecapType>>({
    grossProfit: 0,
    expenditures: 0,
    rentalCost: 70000,
    compensation: 10000,
    wages: 100000,
    notes: ''
  });
  const [docId, setDocId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isToday = startOfDay(currentDate).getTime() === startOfDay(new Date()).getTime();

  useEffect(() => {
    const loadDataForDate = async () => {
      if (!firestore) return;
      setIsLoading(true);

      const dateStr = format(currentDate, 'yyyy-MM-dd');
      
      // 1. Fetch existing recap data
      const recapQuery = query(collection(firestore, 'monthlyRecaps'), where('date', '==', dateStr));
      const recapSnapshot = await getDocs(recapQuery);

      if (!recapSnapshot.empty) {
        const existingData = recapSnapshot.docs[0].data() as MonthlyRecapType;
        setRecapData(existingData);
        setDocId(recapSnapshot.docs[0].id);
      } else {
        // Reset and fetch auto-filled data if no recap exists
        setDocId(null);
        let grossProfit = 0;
        let expenditures = 0;

        // 2. Fetch Daily Report for Gross Profit
        const reportDateStart = startOfDay(currentDate);
        const reportDateEnd = endOfDay(currentDate);
        const dailyReportQuery = query(
          collection(firestore, 'dailyReports'),
          where('date', '>=', Timestamp.fromDate(reportDateStart)),
          where('date', '<=', Timestamp.fromDate(reportDateEnd))
        );
        const dailyReportSnapshot = await getDocs(dailyReportQuery);

        if (!dailyReportSnapshot.empty) {
          const report = dailyReportSnapshot.docs[0].data() as DailyReport;
          grossProfit = report.totalGrossProfit || 0;
        }

        // 3. Fetch Operational Costs for Expenditures
        const transactionsQuery = query(
            collection(firestore, 'transactions'), 
            where('category', 'in', ['operational', 'operational_fee', 'transfer_fee']),
            where('date', '>=', reportDateStart.toISOString()),
            where('date', '<=', reportDateEnd.toISOString())
        );
        const transactionsSnapshot = await getDocs(transactionsQuery);
        transactionsSnapshot.forEach(doc => {
            expenditures += (doc.data() as Transaction).amount;
        });

        setRecapData({
          grossProfit,
          expenditures,
          rentalCost: 70000,
          compensation: 10000,
          wages: 100000,
          notes: ''
        });
      }
      setIsLoading(false);
    };

    loadDataForDate();
  }, [currentDate, firestore]);

  const handleInputChange = (field: keyof MonthlyRecapType, value: string | number) => {
    setRecapData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveRecap = async () => {
    if (!firestore) return;
    setIsLoading(true);

    const dataToSave = {
      date: format(currentDate, 'yyyy-MM-dd'),
      grossProfit: recapData.grossProfit || 0,
      expenditures: recapData.expenditures || 0,
      rentalCost: recapData.rentalCost || 0,
      compensation: recapData.compensation || 0,
      wages: recapData.wages || 0,
      notes: recapData.notes || '',
    };
    
    try {
        const docRef = doc(firestore, 'monthlyRecaps', docId || format(currentDate, 'yyyy-MM-dd'));
        await setDoc(docRef, dataToSave, { merge: true });
        setDocId(docRef.id);
        toast({ title: "Sukses", description: "Rekap berhasil disimpan." });
    } catch (error) {
        console.error("Error saving recap:", error);
        toast({ variant: "destructive", title: "Error", description: "Gagal menyimpan rekap." });
    } finally {
        setIsLoading(false);
    }
  };
  
  const getPeriodTitle = () => {
    const dayOfMonth = currentDate.getDate();
    let targetMonthDate = currentDate;

    if (dayOfMonth < 25) {
      targetMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    } else {
      targetMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    }
    return `REKAPAN OMSET BULAN ${format(targetMonthDate, 'MMMM yyyy', { locale: idLocale }).toUpperCase()}`;
  };

  const netProfit = (recapData.grossProfit || 0) - ((recapData.expenditures || 0) + (recapData.rentalCost || 0) + (recapData.compensation || 0) + (recapData.wages || 0));
  const revenue = netProfit / 2;
  const isLabaKotorZero = !recapData.grossProfit || recapData.grossProfit === 0;

  const renderContent = () => {
      if (isLoading) {
          return (
            <div className="space-y-4 p-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
          );
      }

      return (
        <div className="p-4 space-y-4">
            <Card>
                <CardContent className="p-4 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Laba Kotor (Otomatis/Edit)</label>
                        <div className="flex items-center gap-2">
                            <Input value={formatToRupiah(recapData.grossProfit)} onChange={e => handleInputChange('grossProfit', parseRupiah(e.target.value))} />
                             <Button variant="outline" size="icon"><RotateCw className="h-4 w-4" /></Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {isLabaKotorZero && (
                <Alert>
                    <AlertTitle>Laba Kotor Kosong</AlertTitle>
                    <AlertDescription>
                        Silakan isi Laba Kotor terlebih dahulu untuk memulai perhitungan. Data otomatis akan terisi jika Laporan Harian v5.0 sudah dibuat.
                    </AlertDescription>
                </Alert>
            )}

            <fieldset disabled={isLabaKotorZero} className="space-y-4 disabled:opacity-50">
                <Card>
                    <CardContent className="p-4 space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Pengeluaran (Otomatis)</label>
                            <Input value={formatToRupiah(recapData.expenditures)} readOnly disabled />
                        </div>
                         <div className="space-y-2">
                            <label className="text-sm font-medium">Biaya Sewa</label>
                            <Input value={formatToRupiah(recapData.rentalCost)} onChange={e => handleInputChange('rentalCost', parseRupiah(e.target.value))} />
                        </div>
                         <div className="space-y-2">
                            <label className="text-sm font-medium">Kompensasi</label>
                            <Input value={formatToRupiah(recapData.compensation)} onChange={e => handleInputChange('compensation', parseRupiah(e.target.value))} />
                        </div>
                         <div className="space-y-2">
                            <label className="text-sm font-medium">Gaji</label>
                            <Input value={formatToRupiah(recapData.wages)} onChange={e => handleInputChange('wages', parseRupiah(e.target.value))} />
                        </div>
                    </CardContent>
                </Card>

                 <Card>
                    <CardContent className="p-4 space-y-3">
                         <div className="flex justify-between items-center text-lg">
                            <span className="font-semibold">Laba Bersih</span>
                            <span className="font-bold">{formatToRupiah(netProfit)}</span>
                        </div>
                         <div className="flex justify-between items-center text-lg">
                            <span className="font-semibold">Pendapatan</span>
                            <span className="font-bold text-green-500">{formatToRupiah(revenue)}</span>
                        </div>
                    </CardContent>
                </Card>
                 <div className="space-y-2">
                    <label className="text-sm font-medium">Catatan</label>
                    <Input placeholder="Tambah catatan..." value={recapData.notes || ''} onChange={e => handleInputChange('notes', e.target.value)} />
                </div>
            </fieldset>
        </div>
      )
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="p-4 flex flex-col gap-4 border-b sticky top-0 bg-background z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onDone}>
            <ArrowLeft />
          </Button>
          <div className="flex-1">
            <h1 className="text-base font-semibold uppercase">{getPeriodTitle()}</h1>
          </div>
          <Button variant="outline" size="sm" disabled><Download className="h-4 w-4 mr-2" /> PDF</Button>
        </div>
        <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(subDays(currentDate, 1))}>
                <ChevronLeft />
            </Button>
            <div className="text-center">
                <p className="font-semibold">{format(currentDate, "EEEE", { locale: idLocale })}</p>
                <p className="text-sm text-muted-foreground">{format(currentDate, "dd MMMM yyyy", { locale: idLocale })}</p>
            </div>
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 1))} disabled={isToday}>
                <ChevronRight />
            </Button>
        </div>
      </header>
      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>
      <div className="p-4 border-t">
        <Button className="w-full" onClick={handleSaveRecap} disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {docId ? "Simpan Perubahan" : "Simpan Rekap Hari Ini"}
        </Button>
      </div>
    </div>
  );
}
