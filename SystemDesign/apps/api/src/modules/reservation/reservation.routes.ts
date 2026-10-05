import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import * as ReservationController from './reservation.controller';
import { CreateReservationSchema, ReservationResponseSchema } from './reservation.schemas';
import { z } from 'zod';

export default async function reservationRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.addHook('preValidation', app.authenticate);

  app.post('/', {
    schema: {
      tags: ['Reservations'],
      security: [{ bearerAuth: [] }],
      headers: z.object({
        'idempotency-key': z.string()
      }).passthrough(),
      body: CreateReservationSchema,
      response: {
        201: ReservationResponseSchema,
        422: z.object({ message: z.string() }),
        409: z.object({ message: z.string() })
      }
    }
  }, ReservationController.createReservation);

  app.post('/:id/release', {
    schema: {
      tags: ['Reservations'],
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: {
        200: z.object({ message: z.string() })
      }
    }
  }, ReservationController.releaseReservation);
}
