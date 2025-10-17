"use client";

import { FileText, Send, ChevronRight } from 'lucide-react';
import { recentTransactions } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function RecentTransactions() {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-lg">Transaksi Terakhir</CardTitle>
          </div>
          <Button variant="link" className="text-primary pr-0">Lihat Semua</Button>
        </div>
      </CardHeader>
      <CardContent>
        {recentTransactions.length > 0 ? (
          <div className="space-y-4">
            {recentTransactions.map((trx, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${trx.type === 'credit' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    <Send size={18} strokeWidth={2} className={trx.type === 'credit' ? 'text-green-500 -rotate-45' : 'text-red-500 rotate-[135deg]'} />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{trx.name}</p>
                    <p className="text-xs text-muted-foreground">{trx.account} • {trx.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 cursor-pointer">
                  <p className={`font-semibold text-sm ${trx.type === 'credit' ? 'text-green-500' : 'text-red-500'}`}>
                    {trx.amount}
                  </p>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center">
            <FileText size={48} strokeWidth={1} className="mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground text-sm">Belum ada transaksi</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
