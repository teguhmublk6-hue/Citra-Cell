import { ChevronRight, Bell, User, DollarSign, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SettingsContent() {
  const settingsItems = [
    { icon: User, label: 'Profil Akun' },
    { icon: DollarSign, label: 'Kas Terintegrasi' },
    { icon: Bell, label: 'Notifikasi' },
  ];

  return (
    <div className="px-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pengaturan Akun</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl text-white shadow-lg">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Settings size={24} />
              </div>
              <div>
                <p className="font-semibold">Firebase Database</p>
                <p className="text-xs opacity-90">Online & Tersinkronisasi</p>
              </div>
            </div>
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </div>
          </div>
          
          {settingsItems.map((item, idx) => (
            <button key={idx} className="flex items-center justify-between p-4 bg-card-foreground/5 rounded-xl w-full hover:bg-card-foreground/10 transition-colors">
              <div className="flex items-center gap-4">
                <item.icon size={20} className="text-muted-foreground" />
                <span className="font-medium">{item.label}</span>
              </div>
              <ChevronRight size={20} className="text-muted-foreground" />
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
