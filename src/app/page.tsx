"use client";

import { useEffect } from 'react';
import Header from '@/components/brimo/header';
import BalanceCard from '@/components/brimo/balance-card';
import HomeContent from '@/components/brimo/home-content';
import { useAuth } from '@/firebase';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';


export default function BrimoUI() {
  const auth = useAuth();

  useEffect(() => {
    initiateAnonymousSignIn(auth);
  }, [auth]);


  return (
    <div className="bg-background min-h-screen max-w-md mx-auto font-body text-foreground relative">
      <Header />
      <main className="pb-28">
        <div className="p-4 -mt-16">
          <BalanceCard />
        </div>
        <HomeContent />
      </main>
    </div>
  );
}
