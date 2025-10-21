
"use client";

import { ChevronRight, FileText, Briefcase, BookUser, Tags, MessageSquareQuote, DollarSign, Trash2 } from 'lucide-react';

interface ReportsContentProps {
  onBrilinkReportClick: () => void;
  onPpobReportClick: () => void;
}

export default function ReportsContent({ onBrilinkReportClick, onPpobReportClick }: ReportsContentProps) {
  return (
    <div className="h-full flex flex-col">
        <header className="p-4 flex items-center gap-4 border-b">
            <h1 className="text-lg font-semibold">Laporan</h1>
        </header>
        <div className="flex-1 overflow-auto p-4">
            <div className="space-y-2">
                <button 
                    onClick={onBrilinkReportClick}
                    className="flex items-center justify-between p-4 bg-card-foreground/5 rounded-xl w-full hover:bg-card-foreground/10 transition-colors"
                >
                    <div className="flex items-center gap-4">
                        <BookUser size={20} className="text-muted-foreground" />
                        <span className="font-medium">Pembukuan Harian (BRILink)</span>
                    </div>
                    <ChevronRight size={20} className="text-muted-foreground" />
                </button>
                <button 
                    onClick={onPpobReportClick}
                    className="flex items-center justify-between p-4 bg-card-foreground/5 rounded-xl w-full hover:bg-card-foreground/10 transition-colors"
                >
                    <div className="flex items-center gap-4">
                        <Tags size={20} className="text-muted-foreground" />
                        <span className="font-medium">Transaksi PPOB</span>
                    </div>
                    <ChevronRight size={20} className="text-muted-foreground" />
                </button>
            </div>
        </div>
    </div>
  );
}
