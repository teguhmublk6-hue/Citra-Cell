import { quickServices } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function QuickServices() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">BRILink</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 text-center">
          {quickServices.map((service, idx) => (
            <button
              key={idx}
              className="flex flex-col items-center gap-2 group"
              aria-label={service.label}
            >
              <div className={`${service.color} w-14 h-14 rounded-2xl flex items-center justify-center text-white group-hover:scale-105 transition-transform shadow-lg`}>
                <service.icon size={28} strokeWidth={1.5} />
              </div>
              <span className="text-xs text-muted-foreground font-medium text-center leading-tight mt-1">{service.label}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
