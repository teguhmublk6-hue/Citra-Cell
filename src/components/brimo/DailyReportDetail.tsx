"use client"

import dynamic from 'next/dynamic';
import type { DailyReport as DailyReportType } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';

const DailyReportDetailClient = dynamic(
  () => import('./DailyReportDetailClient'),
  { 
    ssr: false,
    loading: () => <DailyReportDetailSkeleton />,
  }
);

interface DailyReportDetailProps {
  report: DailyReportType;
  onDone: () => void;
}

export default function DailyReportDetail({ report, onDone }: DailyReportDetailProps) {
  return <DailyReportDetailClient report={report} onDone={onDone} />;
}

const DailyReportDetailSkeleton = () => (
    <div className="h-full flex flex-col bg-background">
      <header className="p-4 flex items-center gap-4 border-b">
        <Skeleton className="h-10 w-10" />
        <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-24" />
      </header>
      <div className="flex-1 overflow-auto p-6 space-y-8">
        <div className="space-y-4">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-px w-full" />
        <div className="space-y-4">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-px w-full" />
        <div className="space-y-4">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
)
