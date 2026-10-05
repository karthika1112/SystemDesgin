import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import * as ShipmentController from './shipment.controller';
import { CreateShipmentSchema, UpdateShipmentStatusSchema, ShipmentResponseSchema } from './shipment.schemas';
import { z } from 'zod';

export default async function shipmentRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.addHook('preValidation', app.authenticate);

  app.post('/', {
    schema: {
      tags: ['Shipment'],
      security: [{ bearerAuth: [] }],
      body: CreateShipmentSchema,
      response: {
        201: ShipmentResponseSchema,
        422: z.object({ message: z.string() })
      }
    }
  }, ShipmentController.createShipment);

  app.get('/:id', {
    schema: {
      tags: ['Shipment'],
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: {
        200: ShipmentResponseSchema,
        404: z.object({ message: z.string() })
      }
    }
  }, ShipmentController.getShipment);

  app.patch('/:id/status', {
    preValidation: [app.requireAdmin],
    schema: {
      tags: ['Shipment (Admin)'],
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      body: UpdateShipmentStatusSchema,
      response: {
        200: ShipmentResponseSchema,
        404: z.object({ message: z.string() }),
        422: z.object({ message: z.string() })
      }
    }
  }, ShipmentController.updateShipmentStatus);
}
