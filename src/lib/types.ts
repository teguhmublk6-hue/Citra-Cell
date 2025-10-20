
import * as z from 'zod';

const numberPreprocessor = (val: unknown) => (val === "" || val === undefined || val === null) ? undefined : Number(String(val).replace(/[^0-9]/g, ""));

export const CustomerTransferFormSchema = z.object({
  sourceAccountId: z.string().min(1, 'Akun kas asal harus dipilih'),
  destinationBank: z.string().min(1, 'Bank tujuan harus dipilih'),
  destinationAccountName: z.string().min(1, 'Nama pemilik rekening harus diisi'),
  transferAmount: z.preprocess(numberPreprocessor, z.number({ invalid_type_error: "Nominal harus angka" }).positive('Nominal transfer harus lebih dari 0')),
  bankAdminFee: z.preprocess(numberPreprocessor, z.number({ invalid_type_error: "Biaya harus angka" }).min(0, 'Biaya admin tidak boleh negatif').optional().default(0)),
  serviceFee: z.preprocess(numberPreprocessor, z.number({ invalid_type_error: "Biaya harus angka" }).min(0, 'Biaya jasa tidak boleh negatif')),
  paymentMethod: z.enum(['Tunai', 'Transfer', 'Split'], { required_error: 'Metode pembayaran harus dipilih' }),
  paymentToKasTransferAccountId: z.string().optional(),
  splitTunaiAmount: z.preprocess(numberPreprocessor, z.number().optional()),
});

export type CustomerTransferFormValues = z.infer<typeof CustomerTransferFormSchema>;

export type CustomerTransfer = {
    id: string;
    date: string;
    sourceKasAccountId: string;
    destinationBankName: string;
    destinationAccountName: string;
    transferAmount: number;
    bankAdminFee: number;
    serviceFee: number;
    netProfit: number;
    paymentMethod: "Tunai" | "Transfer" | "Split";
    paymentToKasTunaiAmount?: number;
    paymentToKasTransferAccountId?: string | null;
    paymentToKasTransferAmount?: number;
    deviceName: string;
}

export const CustomerWithdrawalFormSchema = z.object({
  customerBankSource: z.string().min(1, 'Bank/E-wallet pelanggan harus dipilih'),
  customerName: z.string().min(1, 'Nama penarik harus diisi'),
  withdrawalAmount: z.preprocess(numberPreprocessor, z.number({ invalid_type_error: "Nominal harus angka" }).positive('Nominal penarikan harus lebih dari 0')),
  serviceFee: z.preprocess(numberPreprocessor, z.number({ invalid_type_error: "Biaya harus angka" }).min(0, 'Biaya jasa tidak boleh negatif')),
  destinationAccountId: z.string().min(1, 'Akun kas tujuan harus dipilih'),
});

export type CustomerWithdrawalFormValues = z.infer<typeof CustomerWithdrawalFormSchema>;

export type CustomerWithdrawal = {
    id: string;
    date: string;
    customerName: string;
    customerBankSource: string;
    withdrawalAmount: number;
    serviceFee: number;
    totalTransfer: number;
    destinationKasAccountId: string;
    sourceKasTunaiAccountId: string;
    deviceName: string;
}

export const CustomerTopUpFormSchema = z.object({
  sourceAccountId: z.string().min(1, 'Akun kas asal harus dipilih'),
  destinationEwallet: z.string().min(1, 'E-wallet tujuan harus dipilih'),
  customerName: z.string().min(1, 'Nama pelanggan harus diisi'),
  topUpAmount: z.preprocess(numberPreprocessor, z.number({ invalid_type_error: "Nominal harus angka" }).positive('Nominal top up harus lebih dari 0')),
  serviceFee: z.preprocess(numberPreprocessor, z.number({ invalid_type_error: "Biaya harus angka" }).min(0, 'Biaya jasa tidak boleh negatif')),
  paymentMethod: z.enum(['Tunai', 'Transfer', 'Split'], { required_error: 'Metode pembayaran harus dipilih' }),
  paymentToKasTransferAccountId: z.string().optional(),
  splitTunaiAmount: z.preprocess(numberPreprocessor, z.number().optional()),
});

export type CustomerTopUpFormValues = z.infer<typeof CustomerTopUpFormSchema>;

export type CustomerTopUp = {
    id: string;
    date: string;
    sourceKasAccountId: string;
    destinationEwallet: string;
    customerName: string;
    topUpAmount: number;
    serviceFee: number;
    paymentMethod: "Tunai" | "Transfer" | "Split";
    paymentToKasTunaiAmount?: number;
    paymentToKasTransferAccountId?: string | null;
    paymentToKasTransferAmount?: number;
    deviceName: string;
}

export const CustomerEmoneyTopUpFormSchema = z.object({
  sourceAccountId: z.string().min(1, 'Akun kas asal harus dipilih'),
  destinationEmoney: z.string().min(1, 'Kartu E-Money tujuan harus dipilih'),
  topUpAmount: z.preprocess(numberPreprocessor, z.number({ invalid_type_error: "Nominal harus angka" }).positive('Nominal top up harus lebih dari 0')),
  serviceFee: z.preprocess(numberPreprocessor, z.number({ invalid_type_error: "Biaya harus angka" }).min(0, 'Biaya jasa tidak boleh negatif')),
  paymentMethod: z.enum(['Tunai', 'Transfer', 'Split'], { required_error: 'Metode pembayaran harus dipilih' }),
  paymentToKasTransferAccountId: z.string().optional(),
  splitTunaiAmount: z.preprocess(numberPreprocessor, z.number().optional()),
});

export type CustomerEmoneyTopUpFormValues = z.infer<typeof CustomerEmoneyTopUpFormSchema>;

export type CustomerEmoneyTopUp = {
    id: string;
    date: string;
    sourceKasAccountId: string;
    destinationEmoney: string;
    topUpAmount: number;
    serviceFee: number;
    paymentMethod: "Tunai" | "Transfer" | "Split";
    paymentToKasTunaiAmount?: number;
    paymentToKasTransferAccountId?: string | null;
    paymentToKasTransferAmount?: number;
    deviceName: string;
}

export const CustomerVAPaymentFormSchema = z.object({
  sourceAccountId: z.string().min(1, 'Akun kas asal harus dipilih'),
  serviceProvider: z.string().min(1, 'Penyedia layanan harus dipilih'),
  recipientName: z.string().min(1, 'Nama penerima harus diisi'),
  paymentAmount: z.preprocess(numberPreprocessor, z.number({ invalid_type_error: "Nominal harus angka" }).positive('Nominal pembayaran harus lebih dari 0')),
  adminFee: z.preprocess(numberPreprocessor, z.number({ invalid_type_error: "Biaya harus angka" }).min(0, 'Biaya admin tidak boleh negatif').optional().default(0)),
  serviceFee: z.preprocess(numberPreprocessor, z.number({ invalid_type_error: "Biaya harus angka" }).min(0, 'Biaya jasa tidak boleh negatif')),
  paymentMethod: z.enum(['Tunai', 'Transfer', 'Split'], { required_error: 'Metode pembayaran harus dipilih' }),
  paymentToKasTransferAccountId: z.string().optional(),
  splitTunaiAmount: z.preprocess(numberPreprocessor, z.number().optional()),
});

export type CustomerVAPaymentFormValues = z.infer<typeof CustomerVAPaymentFormSchema>;

export type CustomerVAPayment = {
    id: string;
    date: string;
    sourceKasAccountId: string;
    serviceProvider: string;
    recipientName: string;
    paymentAmount: number;
    adminFee: number;
    serviceFee: number;
    netProfit: number;
    paymentMethod: "Tunai" | "Transfer" | "Split";
    paymentToKasTunaiAmount?: number;
    paymentToKasTransferAccountId?: string | null;
    paymentToKasTransferAmount?: number;
    deviceName: string;
}

export const EDCServiceFormSchema = z.object({
  customerName: z.string().min(1, "Nama peminjam harus diisi"),
  machineUsed: z.string().min(1, "Mesin yang digunakan harus diisi"),
  serviceFee: z.preprocess(
    numberPreprocessor,
    z.number({ invalid_type_error: "Biaya jasa harus angka" }).positive("Biaya jasa harus lebih dari 0")
  ),
});

export type EDCServiceFormValues = z.infer<typeof EDCServiceFormSchema>;

export type EDCService = {
  id: string;
  date: string;
  customerName: string;
  machineUsed: string;
  serviceFee: number;
  paymentToKasTunaiAccountId: string;
  deviceName: string;
};

export const SettlementFormSchema = z.object({
    sourceMerchantAccountId: z.string().min(1, 'Akun merchant sumber harus valid'),
});

export type SettlementFormValues = z.infer<typeof SettlementFormSchema>;

export type Settlement = {
    id: string;
    date: string;
    sourceMerchantAccountId: string;
    destinationAccountId: string;
    grossAmount: number;
    mdrFee: number;
    netAmount: number;
    deviceName: string;
}

export type ReportItem = 
    | (CustomerTransfer & { id: string; transactionType: 'Transfer' }) 
    | (CustomerWithdrawal & { id: string; transactionType: 'Tarik Tunai' }) 
    | (CustomerTopUp & { id: string; transactionType: 'Top Up' })
    | (CustomerEmoneyTopUp & { id: string; transactionType: 'Top Up E-Money' })
    | (CustomerVAPayment & { id: string; transactionType: 'VA Payment' })
    | (EDCService & { id: string; transactionType: 'Layanan EDC' });

