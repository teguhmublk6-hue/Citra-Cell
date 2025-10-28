
"use client";

import { BookText, Check, FileText, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { Input } from '../ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';

interface HeaderProps {
    onSync: () => void;
    isSyncing: boolean;
}

export default function Header({ onSync, isSyncing }: HeaderProps) {
  const [deviceName, setDeviceName] = useState<string | null>(null);

  useEffect(() => {
    const storedName = localStorage.getItem('brimoDeviceName');
    setDeviceName(storedName);

    const handleStorageChange = () => {
        const newName = localStorage.getItem('brimoDeviceName') || '';
        setDeviceName(newName);
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
        window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return (
    <header className="bg-gradient-to-br from-primary to-orange-500 text-primary-foreground p-4 pt-8 h-40 rounded-b-3xl">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm opacity-90">Selamat bekerja,</p>
            <div className="flex items-center gap-2">
              <p className="text-xl font-semibold">{deviceName || 'Operator'}</p>
            </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="bg-white/10 hover:bg-white/20 rounded-full text-primary-foreground" onClick={onSync} disabled={isSyncing}>
            <RotateCw size={20} className={isSyncing ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>
    </header>
  );
}
