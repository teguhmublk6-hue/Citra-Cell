
"use client";

import HomeContent from '@/components/brimo/home-content';
import LoadingOverlay from '@/components/brimo/LoadingOverlay';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { KasAccount } from '@/lib/data';
import { collection } from 'firebase/firestore';
import { useState, useCallback } from 'react';

export default function BrimoUI() {
  const firestore = useFirestore();
  const [revalidationKey, setRevalidationKey] = useState(0);

  const revalidateData = useCallback(() => {
    setRevalidationKey(prev => prev + 1);
  }, []);

  const kasAccountsCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    console.log(`Re-fetching kasAccounts with key: ${revalidationKey}`);
    return collection(firestore, 'kasAccounts');
  }, [firestore, revalidationKey]);

  const { isLoading: isAccountsLoading } = useCollection<KasAccount>(kasAccountsCollection);

  return (
    <div className="bg-background min-h-screen max-w-md mx-auto font-body text-foreground relative">
      <LoadingOverlay isLoading={isAccountsLoading} />
      <main className="pb-28">
        <HomeContent 
          revalidateData={revalidateData} 
        />
      </main>
    </div>
  );
}
