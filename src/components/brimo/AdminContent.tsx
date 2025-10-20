
"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight, FileText, MessageSquareQuote, DollarSign } from 'lucide-react';

interface AdminContentProps {
  onProfitLossReportClick: () => void;
  onSetMotivationClick: () => void;
  onManageKasAccountsClick: () => void;
}

export default function AdminContent({ onProfitLossReportClick, onSetMotivationClick, onManageKasAccountsClick }: AdminContentProps) {
  return (
    <div className="px-4 py-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Menu Admin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
            <button 
                onClick={onProfitLossReportClick}
                className="flex items-center justify-between p-4 bg-card-foreground/5 rounded-xl w-full hover:bg-card-foreground/10 transition-colors"
            >
                <div className="flex items-center gap-4">
                  <FileText size={20} className="text-muted-foreground" />
                  <span className="font-medium">Laporan Laba/Rugi Harian</span>
                </div>
                <ChevronRight size={20} className="text-muted-foreground" />
            </button>
             <button 
                onClick={onSetMotivationClick}
                className="flex items-center justify-between p-4 bg-card-foreground/5 rounded-xl w-full hover:bg-card-foreground/10 transition-colors"
            >
                <div className="flex items-center gap-4">
                  <MessageSquareQuote size={20} className="text-muted-foreground" />
                  <span className="font-medium">Set Motivasi Harian</span>
                </div>
                <ChevronRight size={20} className="text-muted-foreground" />
            </button>
            <button 
                onClick={onManageKasAccountsClick}
                className="flex items-center justify-between p-4 bg-card-foreground/5 rounded-xl w-full hover:bg-card-foreground/10 transition-colors"
            >
                <div className="flex items-center gap-4">
                  <DollarSign size={20} className="text-muted-foreground" />
                  <span className="font-medium">Manajemen Akun Kas</span>
                </div>
                <ChevronRight size={20} className="text-muted-foreground" />
            </button>
        </CardContent>
      </Card>
    </div>
  );
}
