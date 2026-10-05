import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import * as PaymentController from './payment.controller';
import { CreatePaymentSchema, PaymentResponseSchema } from './payment.schemas';
import { z } from 'zod';

export default async function paymentRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.addHook('preValidation', app.authenticate);

  app.post('/', {
    schema: {
      tags: ['Payments'],
      security: [{ bearerAuth: [] }],
      headers: z.object({
        'idempotency-key': z.string()
      }).passthrough(),
      body: CreatePaymentSchema,
      response: {
        200: PaymentResponseSchema,
        400: PaymentResponseSchema, // Also returns payment schema on failure with FAILED status
        409: z.object({ message: z.string() }),
        404: z.object({ message: z.string() })
      }
    }
  }, PaymentController.processPayment);
}
