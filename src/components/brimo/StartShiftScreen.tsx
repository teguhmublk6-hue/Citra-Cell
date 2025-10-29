
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface StartShiftScreenProps {
  onShiftStart: (operatorName: string) => void;
}

export default function StartShiftScreen({ onShiftStart }: StartShiftScreenProps) {
  const [operatorName, setOperatorName] = useState('');
  const { toast } = useToast();

  const handleStartShift = () => {
    const trimmedName = operatorName.trim();
    if (trimmedName) {
      onShiftStart(trimmedName);
    } else {
      toast({
        variant: 'destructive',
        title: 'Nama Kosong',
        description: 'Silakan masukkan nama operator untuk memulai shift.',
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleStartShift();
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Mulai Shift Baru</CardTitle>
          <CardDescription>Masukkan nama Anda untuk memulai sesi global.</CardDescription>
        </CardHeader>
        <CardContent>
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

    