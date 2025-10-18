
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface PlaceholderContentProps {
  icon: LucideIcon;
  title: string;
}

export default function PlaceholderContent({ icon: Icon, title }: PlaceholderContentProps) {
  return (
    <div className="h-full flex items-center justify-center">
      <Card className="w-full mx-4">
        <CardContent className="py-16 text-center">
          <Icon size={40} strokeWidth={1.5} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{title}</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Fitur ini sedang dalam pengembangan.</p>
        </CardContent>
      </Card>
    </div>
  );
}

    