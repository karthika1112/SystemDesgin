import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import * as AIController from './ai.controller';
import { CopilotRequestSchema, SimulationRequestSchema, IncidentRequestSchema, ForecastParamsSchema, ForecastQuerySchema, NLQueryRequestSchema, RiskParamsSchema } from './ai.schemas';

export default async function aiRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // Secure AI routes to Admin only
  app.addHook('preValidation', app.authenticate);
  app.addHook('preValidation', app.requireAdmin);

  const security = [{ bearerAuth: [] }];
  const tags = ['AI Dashboard'];

  app.get('/copilot/summary', { schema: { tags, security } }, AIController.getCopilotSummary);
  app.post('/copilot', { schema: { tags, security, body: CopilotRequestSchema } }, AIController.askCopilot);
  app.get('/summary', { schema: { tags, security } }, AIController.getSalesSummary);
  app.get('/inventory-risk', { schema: { tags, security, querystring: { type: 'object', properties: { productId: { type: 'string' } } } } }, AIController.detectInventoryRisk);
  app.get('/anomalies', { schema: { tags, security } }, AIController.getAnomalies);
  app.get('/traffic-anomaly', { schema: { tags, security } }, AIController.detectTrafficAnomaly);
  app.get('/payment-failures', { schema: { tags, security } }, AIController.analyzePaymentFailures);
  app.get('/forecast/:productId', { schema: { tags, security, params: ForecastParamsSchema, querystring: ForecastQuerySchema } }, AIController.getDemandForecast);
  app.post('/simulate', { schema: { tags, security, body: SimulationRequestSchema } }, AIController.simulateWhatIf);
  app.post('/query', { schema: { tags, security, body: NLQueryRequestSchema } }, AIController.queryOperationsAssistant);
  app.get('/recommendations', { schema: { tags, security } }, AIController.getRecommendations);
  app.post('/incident-explanation', { schema: { tags, security, body: IncidentRequestSchema } }, AIController.explainIncident);
  app.get('/risk/users/:userId', { schema: { tags, security, params: RiskParamsSchema } }, AIController.getUserRiskProfile);
}
