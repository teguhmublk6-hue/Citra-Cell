"use client";

import { useState } from 'react';
import { FileText, Send, ChevronRight, Sparkles } from 'lucide-react';
import { recentTransactions } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getTransactionSummary } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

export default function RecentTransactions() {
  const [summary, setSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSummarize = async () => {
    setIsLoading(true);
    setSummary('');
    const result = await getTransactionSummary();
    if (result && 'summary' in result) {
      setSummary(result.summary);
    } else if (result && 'error' in result) {
      toast({
        variant: "destructive",
        title: "Error",
        description: result.error,
      });
    }
    setIsLoading(false);
  };

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
        
        <div className="mt-6">
          <Button onClick={handleSummarize} disabled={isLoading} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                Meringkas...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles size={16} />
                Ringkas dengan AI
              </span>
            )}
          </Button>

          {isLoading && (
            <div className="mt-4 space-y-2">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          )}

          {summary && !isLoading && (
            <Alert className="mt-4 bg-primary/5 border-primary/20">
              <Sparkles className="h-4 w-4 text-primary" />
              <AlertTitle className="font-semibold text-primary">Ringkasan AI</AlertTitle>
              <AlertDescription className="text-foreground/80">
                {summary}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
