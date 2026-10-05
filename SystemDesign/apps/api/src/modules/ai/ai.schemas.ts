import { z } from 'zod';

export const CopilotRequestSchema = z.object({
  query: z.string().min(1)
});

export const SimulationRequestSchema = z.object({
  users: z.number().int().positive(),
  durationSeconds: z.number().int().positive()
});

export const IncidentRequestSchema = z.object({
  incidentId: z.string().uuid().optional(),
  logs: z.string()
});

export const ForecastParamsSchema = z.object({
  productId: z.string().uuid()
});

export const ForecastQuerySchema = z.object({
  horizon: z.enum(['5m', '15m', '30m', '1h']).default('15m')
});

export const NLQueryRequestSchema = z.object({
  question: z.string().min(3),
  timeRange: z.enum(['last_5_minutes', 'last_15_minutes', 'last_1_hour']).default('last_15_minutes')
});

export const RiskParamsSchema = z.object({
  userId: z.string()
});
