import { z } from 'zod';

export const CreateReservationSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
});

export const ReservationResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  productId: z.string(),
  quantity: z.number(),
  status: z.enum(['PENDING', 'CONFIRMED', 'EXPIRED', 'RELEASED', 'CANCELLED']),
  expiresAt: z.union([z.date(), z.string()]),
  idempotencyKey: z.string().nullable(),
});
