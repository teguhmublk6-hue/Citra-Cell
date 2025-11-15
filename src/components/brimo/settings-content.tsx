
"use client";

import { useState, useEffect } from 'react';
import { ChevronRight, Bell, User, DollarSign, Settings, Pencil, Check, Smartphone as SmartphoneIcon, LogOut, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface SettingsContentProps {
    onBack: () => void;
}

export default function SettingsContent({ onBack }: SettingsContentProps) {
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
    <>
    <div className="h-full flex flex-col">
        <header className="p-4 flex items-center gap-4 border-b">
            <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft />
            </Button>
            <h1 className="text-lg font-semibold">Pengaturan</h1>
        </header>
        <div className="flex-1 overflow-auto p-4">
            <Card>
                <CardContent className="pt-6 space-y-3">
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
                            <p className="font-medium">Nama Operator</p>
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
    </div>
    </>
  );
}
