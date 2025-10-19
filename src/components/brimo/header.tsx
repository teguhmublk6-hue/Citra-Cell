
"use client";

import { BookText, Check, FileText, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { Input } from '../ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';

interface HeaderProps {
    onSync: () => void;
    isSyncing: boolean;
    onReportClick: () => void;
}

export default function Header({ onSync, isSyncing, onReportClick }: HeaderProps) {
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    const storedName = localStorage.getItem('brimoDeviceName');
    if (storedName) {
      setDeviceName(storedName);
      setInputValue(storedName);
    } else {
      setIsEditing(true);
    }

    const handleStorageChange = () => {
        const newName = localStorage.getItem('brimoDeviceName') || '';
        setDeviceName(newName);
        setInputValue(newName);
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
        window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleSave = () => {
    if (inputValue.trim()) {
      const newName = inputValue.trim();
      localStorage.setItem('brimoDeviceName', newName);
      setDeviceName(newName);
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  return (
    <header className="bg-gradient-to-br from-primary to-orange-500 text-primary-foreground p-4 pt-8 h-40 rounded-b-3xl">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm opacity-90">Selamat datang,</p>
          {isEditing && !deviceName ? (
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nama Perangkat..."
                className="h-8 text-black"
                autoFocus
              />
              <Button onClick={handleSave} size="icon" className="h-8 w-8 bg-green-500 hover:bg-green-600">
                <Check size={16} />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-xl font-semibold">{deviceName || 'Pengguna Brimo'}</p>
            </div>
          )}
        </div>
        <div className="flex gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="bg-white/10 hover:bg-white/20 rounded-full text-primary-foreground">
                        <BookText size={20} />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onReportClick}>
                        <FileText className="mr-2 h-4 w-4" />
                        <span>Laporan Pembukuan</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
          <Button variant="ghost" size="icon" className="bg-white/10 hover:bg-white/20 rounded-full text-primary-foreground" onClick={onSync} disabled={isSyncing}>
            <RotateCw size={20} className={isSyncing ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>
    </header>
  );
}
