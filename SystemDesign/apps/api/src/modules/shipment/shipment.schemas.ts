import { z } from 'zod';

export const ShipmentStatusEnum = z.enum(['CREATED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED']);

export const CreateShipmentSchema = z.object({
  orderId: z.string(),
  address: z.string().min(5),
});

export const UpdateShipmentStatusSchema = z.object({
  status: ShipmentStatusEnum,
  trackingNumber: z.string().optional(),
});

export const ShipmentResponseSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  address: z.string(),
  status: z.string(),
  trackingNumber: z.string().nullable(),
  createdAt: z.union([z.date(), z.string()]),
  updatedAt: z.union([z.date(), z.string()]),
});
