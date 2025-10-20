
"use client";

import { useState, useEffect } from 'react';
import { ChevronRight, Bell, User, DollarSign, Settings, Pencil, Check, Smartphone as SmartphoneIcon, Sun, Moon, Laptop } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import KasManagement from './KasManagement';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

export default function SettingsContent() {
  const { theme, setTheme } = useTheme();
  const [deviceName, setDeviceName] = useState('');
  const [isEditingDeviceName, setIsEditingDeviceName] = useState(false);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    const storedName = localStorage.getItem('brimoDeviceName') || '';
    setDeviceName(storedName);
    setInputValue(storedName);
  }, []);

  const handleDeviceNameSave = () => {
    if (inputValue.trim()) {
      const newName = inputValue.trim();
      localStorage.setItem('brimoDeviceName', newName);
      setDeviceName(newName);
      setIsEditingDeviceName(false);
      // Optional: force a re-render or reload if the header needs to update immediately
      window.dispatchEvent(new Event('storage'));
    }
  };

  const handleDeviceNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleDeviceNameSave();
    }
  };
  
  const settingsItems = [
    { icon: User, label: 'Profil Akun' },
    { icon: Bell, label: 'Notifikasi' },
  ];

  return (
    <div className="px-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pengaturan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl text-white shadow-lg">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Settings size={24} />
              </div>
              <div>
                <p className="font-semibold">Firebase Database</p>
                <p className="text-xs opacity-90">Online & Shared</p>
              </div>
            </div>
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </div>
          </div>

          <div className="p-4 bg-card-foreground/5 rounded-xl w-full">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Sun className="text-muted-foreground" />
                    <span className="font-medium">Mode Tampilan</span>
                </div>
                <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                    <Button variant={theme === 'light' ? 'default' : 'ghost'} size="sm" onClick={() => setTheme('light')} className={cn(theme === 'light' && 'bg-background text-foreground shadow-sm')}>
                        <Sun size={16} />
                    </Button>
                    <Button variant={theme === 'dark' ? 'default' : 'ghost'} size="sm" onClick={() => setTheme('dark')} className={cn(theme === 'dark' && 'bg-background text-foreground shadow-sm')}>
                        <Moon size={16} />
                    </Button>
                     <Button variant={theme === 'system' ? 'default' : 'ghost'} size="sm" onClick={() => setTheme('system')} className={cn(theme === 'system' && 'bg-background text-foreground shadow-sm')}>
                        <Laptop size={16} />
                    </Button>
                </div>
            </div>
          </div>
          
          <Sheet>
            <SheetTrigger asChild>
              <button className="flex items-center justify-between p-4 bg-card-foreground/5 rounded-xl w-full hover:bg-card-foreground/10 transition-colors">
                <div className="flex items-center gap-4">
                  <DollarSign size={20} className="text-muted-foreground" />
                  <span className="font-medium">Manajemen Akun Kas</span>
                </div>
                <ChevronRight size={20} className="text-muted-foreground" />
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-w-md mx-auto rounded-t-2xl h-[90vh]">
                <SheetHeader>
                    <SheetTitle>Manajemen Akun Kas</SheetTitle>
                </SheetHeader>
                <KasManagement />
            </SheetContent>
          </Sheet>

          <div className="p-4 bg-card-foreground/5 rounded-xl w-full">
            {isEditingDeviceName ? (
              <div className="flex items-center gap-2">
                <SmartphoneIcon size={20} className="text-muted-foreground" />
                <Input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleDeviceNameKeyDown}
                  className="h-9 flex-1"
                  autoFocus
                />
                <Button onClick={handleDeviceNameSave} size="icon" className="h-9 w-9 bg-green-500 hover:bg-green-600">
                  <Check size={18} />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <SmartphoneIcon size={20} className="text-muted-foreground" />
                  <div>
                    <p className="font-medium">Nama Perangkat</p>
                    <p className="text-sm text-muted-foreground">{deviceName || 'Belum diatur'}</p>
                  </div>
                </div>
                <Button onClick={() => setIsEditingDeviceName(true)} variant="ghost" size="icon">
                  <Pencil size={16} />
                </Button>
              </div>
            )}
          </div>

          {settingsItems.map((item, idx) => (
            <button key={idx} className="flex items-center justify-between p-4 bg-card-foreground/5 rounded-xl w-full hover:bg-card-foreground/10 transition-colors">
              <div className="flex items-center gap-4">
                <item.icon size={20} className="text-muted-foreground" />
                <span className="font-medium">{item.label}</span>
              </div>
              <ChevronRight size={20} className="text-muted-foreground" />
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
