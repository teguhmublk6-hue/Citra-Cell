"use server";

import { summarizeTransactions } from '@/ai/flows/summarize-recent-transactions';
import { recentTransactions as transactions } from '@/lib/data';

export async function getTransactionSummary(): Promise<{ summary: string } | { error: string }> {
  try {
    // In a real app, you would fetch these transactions from your database.
    // For this demo, we use mock data.
    const formattedTransactions = transactions.map(t => ({
      ...t,
      // The AI model expects a clean number string for the amount.
      amount: t.amount.replace(/[+-]\sRp\s/, '').replace(/\./g, '')
    }));

    if (formattedTransactions.length === 0) {
      return { error: 'Tidak ada transaksi untuk diringkas.' };
    }

    const result = await summarizeTransactions({ transactions: formattedTransactions });
    return { summary: result.summary };
  } catch (e) {
    console.error(e);
    return { error: 'Gagal meringkas transaksi. Silakan coba lagi.' };
  }
}
