
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import HomeContent from '@/components/brimo/home-content';
import { useUser } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';

function LoadingSkeleton() {
  return (
    <div className="bg-background min-h-screen max-w-md mx-auto font-body text-foreground relative animate-pulse">
      <div className="bg-gray-300/20 h-40 rounded-b-3xl p-4 pt-8">
        <Skeleton className="h-8 w-3/4 mb-2" />
        <Skeleton className="h-6 w-1/2" />
      </div>
      <main className="pb-28">
        <div className="p-4 -mt-16">
          <Skeleton className="h-[108px] w-full rounded-2xl" />
        </div>
        <div className="px-4 space-y-4">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </main>
      <Skeleton className="fixed bottom-0 left-0 right-0 max-w-md mx-auto h-[72px]" />
    </div>
  );
}


export default function BrimoUI() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [isUserLoading, user, router]);

  if (isUserLoading || !user) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="bg-background min-h-screen max-w-md mx-auto font-body text-foreground relative">
      <main className="pb-28">
        <HomeContent />
      </main>
    </div>
  );
}
