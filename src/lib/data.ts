import type { LucideIcon } from 'lucide-react';
import { Wallet, Building2, Zap, Smartphone, ShoppingBag, Send, CreditCard, Gift, FileText, QrCode, Bell, Settings, Home, MoreHorizontal } from 'lucide-react';

export type KasAccount = {
  id: string;
  label: string;
  icon: LucideIcon;
  balance: number;
  color: string;
};

export const kasAccounts: KasAccount[] = [
  { id: 'tunai', label: 'Tunai', icon: Wallet, balance: 125000, color: 'bg-green-500' },
  { id: 'bank', label: 'Bank', icon: Building2, balance: 2500000, color: 'bg-blue-500' },
  { id: 'ppob', label: 'PPOB', icon: Zap, balance: 50000, color: 'bg-yellow-500' },
  { id: 'ewallet', label: 'E-Wallet', icon: Smartphone, balance: 375000, color: 'bg-purple-500' },
  { id: 'merchant', label: 'Merchant', icon: ShoppingBag, balance: 0, color: 'bg-orange-500' },
];

export type QuickService = {
  icon: LucideIcon;
  label: string;
  color: string;
}

export const quickServices: QuickService[] = [
  { icon: Send, label: 'Transfer', color: 'bg-primary' },
  { icon: Wallet, label: 'Tarik Tunai', color: 'bg-green-500' },
  { icon: Smartphone, label: 'Top Up', color: 'bg-purple-500' },
  { icon: CreditCard, label: 'VA Payment', color: 'bg-orange-500' },
  { icon: Gift, label: 'KJP', color: 'bg-pink-500' },
  { icon: MoreHorizontal, label: 'Lainnya', color: 'bg-gray-400' },
];

export type Transaction = {
  name: string;
  account: string;
  date: string;
  amount: string;
  type: 'credit' | 'debit';
};

export const recentTransactions: Transaction[] = [
    { name: 'Transfer dari Budi', account: 'Bank', date: 'Hari ini', amount: '+ Rp 500.000', type: 'credit' },
    { name: 'Bayar Kopi Kenangan', account: 'E-Wallet', date: 'Kemarin', amount: '- Rp 22.000', type: 'debit' },
    { name: 'Langganan Netflix', account: 'Bank', date: '2 hari lalu', amount: '- Rp 186.000', type: 'debit' },
    { name: 'Isi Saldo GoPay', account: 'Bank', date: '2 hari lalu', amount: '- Rp 100.000', type: 'debit' },
];

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
