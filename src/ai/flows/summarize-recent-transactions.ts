'use server';
/**
 * @fileOverview Summarizes recent transactions to help users understand their spending habits.
 *
 * - summarizeTransactions - A function that summarizes recent transactions.
 * - SummarizeTransactionsInput - The input type for the summarizeTransactions function.
 * - SummarizeTransactionsOutput - The return type for the summarizeTransactions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeTransactionsInputSchema = z.object({
  transactions: z.array(
    z.object({
      name: z.string(),
      account: z.string(),
      date: z.string(),
      amount: z.string(),
      type: z.enum(['credit', 'debit']),
    })
  ).describe('An array of recent transactions.'),
});
export type SummarizeTransactionsInput = z.infer<typeof SummarizeTransactionsInputSchema>;

const SummarizeTransactionsOutputSchema = z.object({
  summary: z.string().describe('A summary of the recent transactions, including categorization and identification of unusual spending patterns.'),
});
export type SummarizeTransactionsOutput = z.infer<typeof SummarizeTransactionsOutputSchema>;

export async function summarizeTransactions(input: SummarizeTransactionsInput): Promise<SummarizeTransactionsOutput> {
  return summarizeTransactionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeTransactionsPrompt',
  input: {schema: SummarizeTransactionsInputSchema},
  output: {schema: SummarizeTransactionsOutputSchema},
  prompt: `You are a personal finance expert. Please summarize the following recent transactions, categorize them, and identify any unusual spending patterns.

Transactions:
{{#each transactions}}
- {{name}} ({{account}}, {{date}}): {{amount}} ({{type}})
{{/each}}
`,
});

const summarizeTransactionsFlow = ai.defineFlow(
  {
    name: 'summarizeTransactionsFlow',
    inputSchema: SummarizeTransactionsInputSchema,
    outputSchema: SummarizeTransactionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
