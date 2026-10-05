import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import * as CheckoutController from './checkout.controller';
import * as OrderController from './order.controller';
import { CheckoutRequestSchema, OrderResponseSchema } from './order.schemas';
import { z } from 'zod';

export default async function orderRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.addHook('preValidation', app.authenticate);

  // Checkout
  app.post('/checkout', {
    schema: {
      tags: ['Checkout'],
      security: [{ bearerAuth: [] }],
      body: CheckoutRequestSchema,
      response: { 201: OrderResponseSchema, 200: OrderResponseSchema, 400: z.object({ message: z.string() }) }
    }
  }, CheckoutController.checkout);

  // Orders
  app.get('/orders', {
    schema: {
      tags: ['Orders'],
      security: [{ bearerAuth: [] }],
      response: { 200: z.array(OrderResponseSchema) }
    }
  }, OrderController.getOrders);

  app.get('/orders/:id', {
    schema: {
      tags: ['Orders'],
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: OrderResponseSchema, 404: z.object({ message: z.string() }) }
    }
  }, OrderController.getOrderById);

  app.post('/orders/:id/cancel', {
    schema: {
      tags: ['Orders'],
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: OrderResponseSchema, 422: z.object({ message: z.string() }) }
    }
  }, OrderController.cancelOrder);
}
