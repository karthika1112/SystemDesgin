import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import * as AdminController from './admin.controller';

import { getObservabilityMetrics } from './observability.controller';

export default async function adminRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // Use the admin middleware hook protecting these routes
  app.addHook('preValidation', app.authenticate);
  app.addHook('preValidation', app.requireAdmin);

  app.get('/flash-sale/metrics', {
    schema: { tags: ['Admin'], security: [{ bearerAuth: [] }] }
  }, AdminController.getFlashSaleMetrics);

  app.get('/observability', {
    schema: { tags: ['Admin'], security: [{ bearerAuth: [] }] }
  }, getObservabilityMetrics);
}
