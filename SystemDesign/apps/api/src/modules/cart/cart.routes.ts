import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import * as CartController from './cart.controller';
import { CartItemSchema, CartResponseSchema } from './cart.schemas';
import { z } from 'zod';

export default async function cartRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.addHook('preValidation', app.authenticate);

  app.get('/', {
    schema: {
      tags: ['Cart'],
      security: [{ bearerAuth: [] }],
      response: { 200: CartResponseSchema }
    }
  }, CartController.getCart);

  app.post('/items', {
    schema: {
      tags: ['Cart'],
      security: [{ bearerAuth: [] }],
      body: CartItemSchema,
      response: { 200: CartResponseSchema }
    }
  }, CartController.addItem);

  app.put('/items/:productId', {
    schema: {
      tags: ['Cart'],
      security: [{ bearerAuth: [] }],
      params: z.object({ productId: z.string() }),
      body: z.object({ quantity: z.number().int().positive() }),
      response: { 200: CartResponseSchema }
    }
  }, CartController.updateItem);

  app.delete('/items/:productId', {
    schema: {
      tags: ['Cart'],
      security: [{ bearerAuth: [] }],
      params: z.object({ productId: z.string() }),
      response: { 200: CartResponseSchema }
    }
  }, CartController.removeItem);
}
