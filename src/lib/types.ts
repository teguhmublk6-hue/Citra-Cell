
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

    