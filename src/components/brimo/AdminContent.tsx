

"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight, FileText, MessageSquareQuote, DollarSign, Trash2, Tags, Briefcase, TrendingUp, UserCheck, BookOpenCheck, Combine, BookCopy } from 'lucide-react';

interface AdminContentProps {
  onProfitLossReportClick: () => void;
  onOperationalCostReportClick: () => void;
  onCapitalAdditionReportClick: () => void;
  onShiftReconciliationClick: () => void;
  onShiftReconciliationReportClick: () => void;
  onSetMotivationClick: () => void;
  onManageKasAccountsClick: () => void;
  onManagePPOBPricingClick: () => void;
  onResetReportsClick: () => void;
  onResetAllAccountsClick: () => void;
  onDailyReportClick: () => void;
  onDailyReportHistoryClick: () => void;
  onCombinedReportClick: () => void;
  onMonthlyRecapReportClick: () => void;
}

export default function AdminContent({ onProfitLossReportClick, onOperationalCostReportClick, onCapitalAdditionReportClick, onShiftReconciliationClick, onShiftReconciliationReportClick, onSetMotivationClick, onManageKasAccountsClick, onManagePPOBPricingClick, onResetReportsClick, onResetAllAccountsClick, onDailyReportClick, onDailyReportHistoryClick, onCombinedReportClick, onMonthlyRecapReportClick }: AdminContentProps) {
  return (
    <div className="px-4 py-4">
      <div className="space-y-2">
           <button
              onClick={onCombinedReportClick}
              className="flex items-center justify-between p-4 bg-primary/10 text-primary rounded-xl w-full hover:bg-primary/20 transition-colors"
          >
              <div className="flex items-center gap-4">
                <Combine size={20} />
                <span className="font-medium">Unduh Laporan Gabungan</span>
              </div>
              <ChevronRight size={20} />
          </button>
           <button 
              onClick={onDailyReportClick}
              className="flex items-center justify-between p-4 bg-card-foreground/5 rounded-xl w-full hover:bg-card-foreground/10 transition-colors"
          >
              <div className="flex items-center gap-4">
                <BookOpenCheck size={20} className="text-muted-foreground" />
                <span className="font-medium">Buat Laporan Harian v5.0</span>
              </div>
              <ChevronRight size={20} className="text-muted-foreground" />
          </button>
          <button 
              onClick={onDailyReportHistoryClick}
              className="flex items-center justify-between p-4 bg-card-foreground/5 rounded-xl w-full hover:bg-card-foreground/10 transition-colors"
          >
              <div className="flex items-center gap-4">
                <FileText size={20} className="text-muted-foreground" />
                <span className="font-medium">Riwayat Laporan Harian</span>
              </div>
              <ChevronRight size={20} className="text-muted-foreground" />
          </button>
           <button 
              onClick={onMonthlyRecapReportClick}
              className="flex items-center justify-between p-4 bg-card-foreground/5 rounded-xl w-full hover:bg-card-foreground/10 transition-colors"
          >
              <div className="flex items-center gap-4">
                <BookCopy size={20} className="text-muted-foreground" />
                <span className="font-medium">Rekap Bulanan</span>
              </div>
              <ChevronRight size={20} className="text-muted-foreground" />
          </button>
           <button 
              onClick={onShiftReconciliationClick}
              className="flex items-center justify-between p-4 bg-card-foreground/5 rounded-xl w-full hover:bg-card-foreground/10 transition-colors"
          >
              <div className="flex items-center gap-4">
                <UserCheck size={20} className="text-muted-foreground" />
                <span className="font-medium">Lakukan Rekonsiliasi Shift</span>
              </div>
              <ChevronRight size={20} className="text-muted-foreground" />
          </button>
           <button 
              onClick={onShiftReconciliationReportClick}
              className="flex items-center justify-between p-4 bg-card-foreground/5 rounded-xl w-full hover:bg-card-foreground/10 transition-colors"
          >
              <div className="flex items-center gap-4">
                <FileText size={20} className="text-muted-foreground" />
                <span className="font-medium">Laporan Rekonsiliasi Shift</span>
              </div>
              <ChevronRight size={20} className="text-muted-foreground" />
          </button>
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
              onClick={onOperationalCostReportClick}
              className="flex items-center justify-between p-4 bg-card-foreground/5 rounded-xl w-full hover:bg-card-foreground/10 transition-colors"
          >
              <div className="flex items-center gap-4">
                <Briefcase size={20} className="text-muted-foreground" />
                <span className="font-medium">Laporan Biaya Operasional</span>
              </div>
              <ChevronRight size={20} className="text-muted-foreground" />
          </button>
          <button 
              onClick={onCapitalAdditionReportClick}
              className="flex items-center justify-between p-4 bg-card-foreground/5 rounded-xl w-full hover:bg-card-foreground/10 transition-colors"
          >
              <div className="flex items-center gap-4">
                <TrendingUp size={20} className="text-muted-foreground" />
                <span className="font-medium">Laporan Penambahan Saldo</span>
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
          <button 
              onClick={onManagePPOBPricingClick}
              className="flex items-center justify-between p-4 bg-card-foreground/5 rounded-xl w-full hover:bg-card-foreground/10 transition-colors"
          >
              <div className="flex items-center gap-4">
                <Tags size={20} className="text-muted-foreground" />
                <span className="font-medium">Kelola Harga Pulsa</span>
              </div>
              <ChevronRight size={20} className="text-muted-foreground" />
          </button>
          <button 
              onClick={onResetReportsClick}
              className="flex items-center justify-between p-4 bg-destructive/10 text-destructive rounded-xl w-full hover:bg-destructive/20 transition-colors"
          >
              <div className="flex items-center gap-4">
                <Trash2 size={20} />
                <span className="font-medium">Reset Riwayat Laporan</span>
              </div>
              <ChevronRight size={20} />
          </button>
           <button 
              onClick={onResetAllAccountsClick}
              className="flex items-center justify-between p-4 bg-destructive/10 text-destructive rounded-xl w-full hover:bg-destructive/20 transition-colors"
          >
              <div className="flex items-center gap-4">
                <Trash2 size={20} />
                <span className="font-medium">Reset Semua Akun Kas</span>
              </div>
              <ChevronRight size={20} />
          </button>
      </div>
    </div>
  );
}
