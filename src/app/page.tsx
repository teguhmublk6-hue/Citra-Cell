
"use client";

import HomeContent from '@/components/brimo/home-content';
import LoadingOverlay from '@/components/brimo/LoadingOverlay';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { KasAccount } from '@/lib/data';
import { collection } from 'firebase/firestore';
import { useState, useCallback, useEffect } from 'react';

export default function BrimoUI() {
  const firestore = useFirestore();
  const [revalidationKey, setRevalidationKey] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const revalidateData = useCallback(() => {
    setIsSyncing(true);
    setRevalidationKey(prev => prev + 1);
  }, []);

  const kasAccountsCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'kasAccounts');
  }, [firestore, revalidationKey]);

  const { data: kasAccounts, isLoading: isAccountsLoading } = useCollection<KasAccount>(kasAccountsCollection);
  
  useEffect(() => {
    // If we were syncing, and the accounts data is no longer loading, we are done.
    if (isSyncing && !isAccountsLoading) {
      // Use a small timeout to ensure the animation is visible for a minimum duration
      const timer = setTimeout(() => {
        setIsSyncing(false);
      }, 500); // 500ms minimum display time
      return () => clearTimeout(timer);
    }
  }, [isSyncing, isAccountsLoading]);


  return (
    <div className="bg-background min-h-screen max-w-md mx-auto font-body text-foreground relative">
      <LoadingOverlay isLoading={isAccountsLoading && revalidationKey === 0} />
      <main className="pb-28">
        <HomeContent 
          revalidateData={revalidateData} 
          isSyncing={isSyncing}
        />
      </main>
    </div>
  );
}
