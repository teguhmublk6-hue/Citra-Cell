
"use client";

import HomeContent from '@/components/brimo/home-content';
import LoadingOverlay from '@/components/brimo/LoadingOverlay';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { KasAccount } from '@/lib/data';
import { collection } from 'firebase/firestore';

export default function BrimoUI() {
  const firestore = useFirestore();

  const kasAccountsCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'kasAccounts');
  }, [firestore]);

  const { isLoading: isAccountsLoading } = useCollection<KasAccount>(kasAccountsCollection);

  return (
    <div className="bg-background min-h-screen max-w-md mx-auto font-body text-foreground relative">
      <LoadingOverlay isLoading={isAccountsLoading} />
      <main className="pb-28">
        <HomeContent />
      </main>
    </div>
  );
}
