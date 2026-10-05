import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AIFactory } from './ai.provider';
import { AICopilotService, AIAnalyticsService, AIAnomalyService, AIRecommendationService, AISimulationService, AINaturalLanguageService } from './ai.service';
import { CopilotRequestSchema, SimulationRequestSchema, IncidentRequestSchema, ForecastParamsSchema, ForecastQuerySchema, NLQueryRequestSchema, RiskParamsSchema } from './ai.schemas';

const prisma = new PrismaClient();

// 0. AI Copilot Summary
export const getCopilotSummary = async (request: FastifyRequest, reply: FastifyReply) => {
  const svc = new AICopilotService(AIFactory.getProvider(), prisma);
  const result = await svc.getSystemSummary();
  return reply.send(result);
};

// 1. AI Flash Sale Copilot & 10. AI Natural Language Dashboard Query
export const askCopilot = async (request: FastifyRequest<{ Body: z.infer<typeof CopilotRequestSchema> }>, reply: FastifyReply) => {
  const provider = AIFactory.getProvider();
  const res = await provider.generateText(`Query: ${request.body.query}`);
  return reply.send({ result: res });
};

// 2. AI Sales Summary
export const getSalesSummary = async (request: FastifyRequest, reply: FastifyReply) => {
  const svc = new AIAnalyticsService(AIFactory.getProvider(), prisma);
  const result = await svc.getSalesSummary();
  return reply.send({ summary: result });
};

// 3. AI Inventory Risk Detection
export const detectInventoryRisk = async (request: FastifyRequest<{ Querystring: { productId: string } }>, reply: FastifyReply) => {
  if (!request.query.productId) return reply.status(400).send({ message: 'productId required' });
  const svc = new AIRecommendationService(AIFactory.getProvider(), prisma);
  const result = await svc.detectInventoryRisk(request.query.productId);
  return reply.send(result);
};

// 4b. AI System Anomalies Dashboard
export const getAnomalies = async (request: FastifyRequest, reply: FastifyReply) => {
  const svc = new AIAnomalyService(AIFactory.getProvider(), prisma);
  const anomalies = await svc.detectAllAnomalies();
  return reply.send({ anomalies });
};

// 4. AI Traffic Anomaly Detection
export const detectTrafficAnomaly = async (request: FastifyRequest, reply: FastifyReply) => {
  const svc = new AIAnomalyService(AIFactory.getProvider(), prisma);
  const result = await svc.detectTrafficAnomaly();
  return reply.send(result);
};

// 5. AI Payment Failure Analysis
export const analyzePaymentFailures = async (request: FastifyRequest, reply: FastifyReply) => {
  const svc = new AIAnomalyService(AIFactory.getProvider(), prisma);
  const result = await svc.analyzePaymentFailures();
  return reply.send(result);
};

// 6. AI Demand Forecast
export const getDemandForecast = async (request: FastifyRequest<{ Params: z.infer<typeof ForecastParamsSchema>, Querystring: z.infer<typeof ForecastQuerySchema> }>, reply: FastifyReply) => {
  const svc = new AIAnalyticsService(AIFactory.getProvider(), prisma);
  const result = await svc.getDemandForecast(request.params.productId, request.query.horizon);
  return reply.send(result);
};

// 7. AI What-If Simulation
export const simulateWhatIf = async (request: FastifyRequest<{ Body: z.infer<typeof SimulationRequestSchema> }>, reply: FastifyReply) => {
  const svc = new AISimulationService(AIFactory.getProvider());
  const result = await svc.simulateWhatIf(request.body.users, request.body.durationSeconds);
  return reply.send(result);
};

// 8. AI Operational Recommendations
export const getRecommendations = async (request: FastifyRequest, reply: FastifyReply) => {
  const svc = new AIRecommendationService(AIFactory.getProvider(), prisma);
  const result = await svc.getOperationalRecommendations();
  return reply.send(result);
};

// 9. AI Incident Explanation
export const explainIncident = async (request: FastifyRequest<{ Body: z.infer<typeof IncidentRequestSchema> }>, reply: FastifyReply) => {
  const svc = new AIAnomalyService(AIFactory.getProvider(), prisma);
  const result = await svc.explainIncident(request.body.incidentId || '', request.body.logs);
  return reply.send({ explanation: result });
};

// 11. AI Natural Language Operations Assistant
export const queryOperationsAssistant = async (request: FastifyRequest<{ Body: z.infer<typeof NLQueryRequestSchema> }>, reply: FastifyReply) => {
  const user = request.user as any;
  const svc = new AINaturalLanguageService(AIFactory.getProvider(), prisma);
  const result = await svc.query(request.body.question, request.body.timeRange, user.id);
  return reply.send(result);
};

// 12. AI User Risk Profile
export const getUserRiskProfile = async(request: FastifyRequest<{ Params: z.infer<typeof RiskParamsSchema> }>, reply: FastifyReply) => {
  const svc = new AIRecommendationService(AIFactory.getProvider(), prisma);
  const result = await svc.getUserRiskProfile(request.params.userId);
  return reply.send(result);
};