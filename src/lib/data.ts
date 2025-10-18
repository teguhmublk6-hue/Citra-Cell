import type { LucideIcon } from 'lucide-react';
import { Wallet, Building2, Zap, Smartphone, ShoppingBag, Send, CreditCard, Gift, FileText, QrCode, Bell, Settings, Home, MoreHorizontal, Phone, Wifi, Lightbulb, Droplets, HeartPulse } from 'lucide-react';

export type KasAccount = {
  id: string;
  userId: string;
  label: string;
  balance: number;
  minimumBalance: number;
  color: string;
};

export const kasAccounts: KasAccount[] = [
  { id: 'tunai', userId: 'dummy', label: 'Tunai', balance: 125000, minimumBalance: 50000, color: 'bg-green-500' },
  { id: 'bank', userId: 'dummy', label: 'Bank', balance: 2500000, minimumBalance: 500000, color: 'bg-blue-500' },
  { id: 'ppob', userId: 'dummy', label: 'PPOB', balance: 50000, minimumBalance: 25000, color: 'bg-yellow-500' },
  { id: 'ewallet', userId: 'dummy', label: 'E-Wallet', balance: 375000, minimumBalance: 100000, color: 'bg-purple-500' },
  { id: 'merchant', userId: 'dummy', label: 'Merchant', balance: 0, minimumBalance: 0, color: 'bg-orange-500' },
];

export type QuickService = {
  icon: LucideIcon;
  label: string;
  color: string;
}

export const quickServices: QuickService[] = [
  { icon: Send, label: 'Transfer', color: 'bg-blue-500' },
  { icon: Wallet, label: 'Tarik Tunai', color: 'bg-gray-400' },
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

export const accountTypes = [
    { value: 'Tunai', label: 'Tunai', color: 'bg-green-500' },
    { value: 'Bank', label: 'Bank', color: 'bg-blue-500' },
    { value: 'E-Wallet', label: 'E-Wallet', color: 'bg-purple-500' },
    { value: 'PPOB', label: 'PPOB', color: 'bg-yellow-500' },
    { value: 'Merchant', label: 'Merchant', color: 'bg-orange-500' },
];
