"use client"

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

const CombinedReportClient = dynamic(() => import('./CombinedReportClient'), {
  ssr: false,
  loading: () => (
      <div className="p-4 space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <div className="space-y-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
        </div>
      </div>
  ),
})

export default function CombinedReport({ onDone }: { onDone: () => void }) {
  return <CombinedReportClient onDone={onDone} />
}
