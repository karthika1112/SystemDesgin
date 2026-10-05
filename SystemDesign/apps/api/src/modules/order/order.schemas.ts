import { z } from 'zod';

export const CheckoutRequestSchema = z.object({
  reservationId: z.string(),
});

export const OrderResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  status: z.string(),
  totalAmount: z.union([z.number(), z.string()]),
  reservationId: z.string().nullable(),
  createdAt: z.union([z.date(), z.string()]),
});
