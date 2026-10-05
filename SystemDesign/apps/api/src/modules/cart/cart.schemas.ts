import { z } from 'zod';
import { ProductResponseSchema } from '../product/product.schemas';

export const CartItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(), // Must be > 0
});

export const CartResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  items: z.array(z.object({
    id: z.string(),
    productId: z.string(),
    quantity: z.number(),
    product: ProductResponseSchema
  }))
});
