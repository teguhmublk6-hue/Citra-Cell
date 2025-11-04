
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface StartShiftScreenProps {
  onShiftStart: (operatorName: string, initialCapital: number) => void;
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


export default function StartShiftScreen({ onShiftStart }: StartShiftScreenProps) {
  const [operatorName, setOperatorName] = useState('');
  const [initialCapital, setInitialCapital] = useState<number | undefined>(undefined);
  const { toast } = useToast();

  const handleStartShift = () => {
    const trimmedName = operatorName.trim();
    if (!trimmedName) {
      toast({
        variant: 'destructive',
        title: 'Nama Kosong',
        description: 'Silakan masukkan nama operator.',
      });
      return;
    }
    if (initialCapital === undefined || isNaN(initialCapital)) {
      toast({
        variant: 'destructive',
        title: 'Modal Awal Kosong',
        description: 'Silakan masukkan jumlah modal awal di laci.',
      });
      return;
    }
    onShiftStart(trimmedName, initialCapital);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (e.currentTarget.id === 'operatorName') {
        document.getElementById('initialCapital')?.focus();
      } else {
        handleStartShift();
      }
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Mulai Shift Baru</CardTitle>
          <CardDescription>Masukkan nama dan modal awal di laci.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              id="operatorName"
              placeholder="Nama Anda"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10 text-base"
              autoFocus
            />
          </div>
          <div className="relative">
            <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              id="initialCapital"
              placeholder="Modal Awal Shift"
              type="text"
              value={formatToRupiah(initialCapital)}
              onChange={(e) => setInitialCapital(parseRupiah(e.target.value))}
              onKeyDown={handleKeyDown}
              className="pl-10 text-base"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={handleStartShift}>
            Mulai Shift
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
