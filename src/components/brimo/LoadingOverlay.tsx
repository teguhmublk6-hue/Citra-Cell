
'use client';

import { Loader } from 'lucide-react';

interface LoadingOverlayProps {
  isLoading: boolean;
}

export default function LoadingOverlay({ isLoading }: LoadingOverlayProps) {
  if (!isLoading) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[200]">
      <div className="flex flex-col items-center gap-4">
        <Loader className="animate-spin text-white" size={48} />
        <p className="text-white/80 text-lg font-medium">Sinkronisasi data...</p>
      </div>
    </div>
  );
}
