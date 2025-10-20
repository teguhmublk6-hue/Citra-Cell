
"use client";

import { Quote } from 'lucide-react';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { AppConfig } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';

export default function MotivationCard() {
  const firestore = useFirestore();

  const motivationDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'appConfig', 'motivation');
  }, [firestore]);

  const { data: motivationData, isLoading } = useDoc<AppConfig>(motivationDocRef);

  return (
    <div className="bg-card/80 backdrop-blur-md rounded-2xl p-5 text-card-foreground shadow-lg border border-border/20 w-full text-left relative h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Quote size={16} className="text-muted-foreground" />
          <p className="text-sm font-semibold text-muted-foreground">Kutipan Hari Ini</p>
        </div>
        {isLoading ? (
            <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
            </div>
        ) : (
            <p className="text-base font-medium italic">
                "{motivationData?.motivationQuote || 'Teruslah berusaha, karena setiap langkah kecil membawamu lebih dekat ke tujuan.'}"
            </p>
        )}
      </div>
       <div className="text-xs text-right text-muted-foreground/50 mt-4">
          - {isLoading ? <Skeleton className="h-3 w-24 inline-block" /> : (motivationData?.motivationAuthor || 'BRILink Manager')}
      </div>
    </div>
  );
}
