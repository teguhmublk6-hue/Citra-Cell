import type { LucideIcon } from 'lucide-react';
import { Wallet, Building2, Zap, Smartphone, ShoppingBag, Send, CreditCard, Gift, FileText, QrCode, Bell, Settings, Home, MoreHorizontal, Phone, Wifi, Lightbulb, Droplets, HeartPulse } from 'lucide-react';

export type KasAccount = {
  id: string;
  label: string;
  balance: number;
  color: string;
};

export const kasAccounts: KasAccount[] = [
  { id: 'tunai', label: 'Tunai', balance: 125000, color: 'bg-green-500' },
  { id: 'bank', label: 'Bank', balance: 2500000, color: 'bg-blue-500' },
  { id: 'ppob', label: 'PPOB', balance: 50000, color: 'bg-yellow-500' },
  { id: 'ewallet', label: 'E-Wallet', balance: 375000, color: 'bg-purple-500' },
  { id: 'merchant', label: 'Merchant', balance: 0, color: 'bg-orange-500' },
];

export type QuickService = {
  icon: LucideIcon;
  label: string;
  color: string;
}

export const quickServices: QuickService[] = [
  { icon: Send, label: 'Transfer', color: 'bg-blue-500' },
  { icon: Wallet, label: 'Tarik Tunai', color: 'bg-green-500' },
  { icon: Smartphone, label: 'Top Up', color: 'bg-purple-500' },
  { icon: CreditCard, label: 'VA Payment', color: 'bg-orange-500' },
  { icon: Gift, label: 'KJP', color: 'bg-pink-500' },
  { icon: MoreHorizontal, label: 'Lainnya', color: 'bg-gray-400' },
];

export const ppobServices: QuickService[] = [
    { icon: Phone, label: 'Pulsa', color: 'bg-blue-500' },
    { icon: Wifi, label: 'Data', color: 'bg-sky-500' },
    { icon: Lightbulb, label: 'Token Listrik', color: 'bg-yellow-500' },
    { icon: Zap, label: 'PLN', color: 'bg-amber-500' },
    { icon: Droplets, label: 'PDAM', color: 'bg-cyan-500' },
    { icon: HeartPulse, label: 'BPJS', color: 'bg-teal-500' },
];

export type Transaction = {
  id: string;
  userId: string;
  kasAccountId: string;
  name: string;
  account: string;
  date: string;
  amount: number;
  type: 'credit' | 'debit';
};


export const recentTransactions: Transaction[] = [];


export type NavItem = {
    id: 'home' | 'mutasi' | 'qris' | 'inbox' | 'settings';
    icon: LucideIcon;
    label: string;
};

export const navItems: NavItem[] = [
    { id: 'home', icon: Home, label: 'Beranda' },
    { id: 'mutasi', icon: FileText, label: 'Mutasi' },
    { id: 'qris', icon: QrCode, label: 'QRIS' },
    { id: 'inbox', icon: Bell, label: 'Inbox' },
    { id: 'settings', icon: Settings, label: 'Akun' },
];
