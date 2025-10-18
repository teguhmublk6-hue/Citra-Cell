import { Bell, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Header() {
  return (
    <header className="bg-gradient-to-br from-orange-500 to-orange-600 text-primary-foreground p-4 pt-8 h-40 rounded-b-3xl">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm opacity-90">Selamat datang,</p>
          <p className="text-xl font-semibold">Pengguna Brimo</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="bg-white/10 hover:bg-white/20 rounded-full text-primary-foreground">
            <Bell size={20} />
          </Button>
          <Button variant="ghost" size="icon" className="bg-white/10 hover:bg-white/20 rounded-full text-primary-foreground">
            <User size={20} />
          </Button>
        </div>
      </div>
    </header>
  );
}
