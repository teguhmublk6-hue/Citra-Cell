
"use client";

import { useEffect } from 'react';
import HomeContent from '@/components/brimo/home-content';
import { useAuth } from '@/firebase';
import { signInAnonymously } from 'firebase/auth';


export default function BrimoUI() {
  const auth = useAuth();
  
  useEffect(() => {
    // Sign in anonymously if no user is present.
    if (!auth.currentUser) {
        signInAnonymously(auth).catch((error) => {
            console.error("Anonymous sign-in failed:", error);
        });
    }
  }, [auth]);


  return (
    <div className="bg-background min-h-screen max-w-md mx-auto font-body text-foreground relative">
      <main className="pb-28">
        <HomeContent />
      </main>
    </div>
  );
}
