"use client";

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { DailyReport as DailyReportType } from '@/lib/data';

const DailyReportDetailClient = dynamic(() => import('./DailyReportDetailClient'), {
  ssr: false,
  loading: () => (
      <div className="p-4 space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="space-y-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
        </div>
      </div>
  ),
});

export default function DailyReportDetail({ report, onDone }: { report: DailyReportType, onDone: () => void }) {
  return <DailyReportDetailClient report={report} onDone={onDone} />;
}
