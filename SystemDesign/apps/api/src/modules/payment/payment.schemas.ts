import { z } from 'zod';

export const CreatePaymentSchema = z.object({
  orderId: z.string(),
  amount: z.number().positive(),
});

export const PaymentResponseSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  status: z.enum(['PENDING', 'SUCCESS', 'FAILED', 'TIMEOUT', 'REFUNDED']),
  amount: z.union([z.number(), z.string()]),
  providerReference: z.string().nullable(),
  createdAt: z.union([z.date(), z.string()]),
});
