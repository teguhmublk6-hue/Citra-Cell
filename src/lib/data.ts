

import type { LucideIcon } from 'lucide-react';
import { Wallet, Building2, Zap, Smartphone, ShoppingBag, Send, CreditCard, Gift, FileText, QrCode, UserCog, Settings, Home, MoreHorizontal, Phone, Wifi, Lightbulb, Droplets, HeartPulse, Plus, Calculator, IdCard, GraduationCap, BookText, PhoneCall } from 'lucide-react';

export type DailyReport = {
  id: string;
  date: { seconds: number; nanoseconds: number };
  totalAccountBalance: number;
  openingBalanceRotation: number;
  capitalAdditionToday: number;
  liabilityBeforePayment: number;
  paymentToPartyB: number;
  liabilityAfterPayment: number;
  manualSpending: number;
  finalLiabilityForNextDay: number;
  assetAccessories: number;
  assetSIMCards: number;
  assetVouchers: number;
  totalCurrentAssets: number;
  grossProfitBrilink: number;
  grossProfitPPOB: number;
  posGrossProfit: number;
  totalGrossProfit: number;
  operationalCosts: number;
  netProfit: number;
  cashInDrawer: number;
  cashInSafe: number;
  totalPhysicalCash: number;
  grandTotalBalance: number;
  liquidAccumulation: number;
  spendingItems: { id: number; description: string; amount: number; }[];
};

export type CurrentShiftStatus = {
  isActive: boolean;
  operatorName: string;
  startTime: string;
};

export type ShiftReconciliation = {
  id: string;
  date: Date;
  operatorName: string;
  initialCapital: number;
  appCashIn: number;
  voucherCashIn: number;
  expectedTotalCash: number;
  actualPhysicalCash: number;
  difference: number;
  notes: string;
  deviceName: string;
}

export type KasAccount = {
  id: string;
  // userId field is no longer needed for a shared data model
  // userId: string; 
  label: string;
  type: string;
  balance: number;
  minimumBalance: number;
  color: string;
  settlementDestinationAccountId?: string;
  iconUrl?: string;
  transactions?: Transaction[];
};

export const kasAccounts: KasAccount[] = [
  { id: 'tunai', label: 'Tunai', type: 'Tunai', balance: 125000, minimumBalance: 50000, color: 'bg-green-500' },
  { id: 'bank', label: 'Bank', type: 'Bank', balance: 2500000, minimumBalance: 500000, color: 'bg-blue-500' },
  { id: 'ppob', label: 'PPOB', type: 'PPOB', balance: 50000, minimumBalance: 25000, color: 'bg-yellow-500' },
  { id: 'ewallet', label: 'E-Wallet', type: 'E-Wallet', balance: 375000, minimumBalance: 100000, color: 'bg-purple-500' },
  { id: 'merchant', label: 'Merchant', type: 'Merchant', balance: 0, minimumBalance: 0, color: 'bg-orange-500' },
];

export type QuickService = {
  id: 'customerTransfer' | 'withdraw' | 'topUp' | 'customerVAPayment' | 'EDCService' | 'Emoney' | 'KJP';
  icon: LucideIcon;
  label: string;
  color: string;
}

export const quickServices: QuickService[] = [
  { id: 'customerTransfer', icon: Send, label: 'Transfer', color: 'bg-blue-500' },
  { id: 'withdraw', icon: Wallet, label: 'Tarik Tunai', color: 'bg-gray-400' },
  { id: 'topUp', icon: Smartphone, label: 'Top Up', color: 'bg-purple-500' },
  { id: 'customerVAPayment', icon: CreditCard, label: 'VA Payment', color: 'bg-orange-500' },
  { id: 'EDCService', icon: Calculator, label: 'Layanan EDC', color: 'bg-teal-500' },
  { id: 'Emoney', icon: IdCard, label: 'Emoney', color: 'bg-sky-500' },
  { id: 'KJP', icon: GraduationCap, label: 'KJP', color: 'bg-pink-500' },
];

export type PPOBService = {
    id: 'Pulsa' | 'Paket Telpon' | 'Data' | 'Token Listrik' | 'PLN' | 'PDAM' | 'BPJS' | 'Wifi';
    icon: LucideIcon;
    label: string;
    color: string;
}

export const ppobServices: PPOBService[] = [
    { id: 'Pulsa', icon: Phone, label: 'Pulsa', color: 'bg-blue-500' },
    { id: 'Paket Telpon', icon: PhoneCall, label: 'Paket Telpon', color: 'bg-green-500' },
    { id: 'Data', icon: Smartphone, label: 'Data', color: 'bg-sky-500' },
    { id: 'Token Listrik', icon: Lightbulb, label: 'Token Listrik', color: 'bg-yellow-500' },
    { id: 'PLN', icon: Zap, label: 'PLN', color: 'bg-amber-500' },
    { id: 'PDAM', icon: Droplets, label: 'PDAM', color: 'bg-cyan-500' },
    { id: 'BPJS', icon: HeartPulse, label: 'BPJS', color: 'bg-teal-500' },
    { id: 'Wifi', icon: Wifi, label: 'Wifi', color: 'bg-green-500' },
];

export type Transaction = {
  id: string;
  kasAccountId: string;
  name: string;
  account: string;
  date: string;
  amount: number;
  type: 'credit' | 'debit';
  category?: 'operational' | 'transfer' | 'capital' | string;
  balanceBefore?: number;
  balanceAfter?: number;
  sourceKasAccountId?: string;
  destinationKasAccountId?: string;
  deviceName?: string;
  auditId?: string;
};


export const recentTransactions: Transaction[] = [];


export type NavItem = {
    id: 'home' | 'laporan' | 'mutasi' | 'accounts' | 'qris' | 'admin' | 'settings';
    icon: LucideIcon;
    label: string;
};

export const navItems: NavItem[] = [
    { id: 'home', icon: Home, label: 'Beranda' },
    { id: 'laporan', icon: BookText, label: 'Laporan' },
    { id: 'mutasi', icon: FileText, label: 'Riwayat' },
    { id: 'accounts', icon: Wallet, label: 'Akun' },
    { id: 'qris', icon: Plus, label: 'Mutasi' },
    { id: 'admin', icon: UserCog, label: 'Admin' },
    { id: 'settings', icon: Settings, label: 'Setelan' },
];

export const accountTypes = [
    { value: 'Tunai', label: 'Tunai', color: 'bg-green-500' },
    { value: 'Bank', label: 'Bank', color: 'bg-blue-500' },
    { value: 'E-Wallet', label: 'E-Wallet', color: 'bg-purple-500' },
    { value: 'PPOB', label: 'PPOB', color: 'bg-yellow-500' },
    { value: 'Merchant', label: 'Merchant', color: 'bg-orange-500' },
];
