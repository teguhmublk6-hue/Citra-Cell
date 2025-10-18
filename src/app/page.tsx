
"use client";

import HomeContent from '@/components/brimo/home-content';

export default function BrimoUI() {
  return (
    <div className="bg-background min-h-screen max-w-md mx-auto font-body text-foreground relative">
      <main className="pb-28">
        <HomeContent />
      </main>
    </div>
  );
}
