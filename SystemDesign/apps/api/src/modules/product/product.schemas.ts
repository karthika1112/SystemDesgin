import { z } from 'zod';

export const ProductInventorySchema = z.object({
  availableQuantity: z.number(),
  reservedQuantity: z.number(),
  soldQuantity: z.number(),
});

export const ProductResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.union([z.number(), z.string()]),
  inventory: ProductInventorySchema.nullable(),
});

export const CreateProductSchema = z.object({
  name: z.string().min(2),
  description: z.string(),
  price: z.number().positive(),
  initialQuantity: z.number().int().nonnegative().default(0),
});

export const UpdateProductSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
});
