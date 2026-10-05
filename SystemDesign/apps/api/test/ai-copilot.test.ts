import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';

vi.mock('../src/plugins/redis', () => ({ redis: { get: vi.fn(), setex: vi.fn() } }));
vi.mock('../src/plugins/rabbitmq', () => ({ getChannel: vi.fn(), QUEUES: {}, EXCHANGE: '' }));

process.env.AI_ENABLED = 'true';
process.env.AI_PROVIDER = 'mock';

// Dynamic Database State values for testing specific AI trigger behaviors
let mockQueueDepth = 10;
let mockPaymentFailures = 2;
let mockInventoryAvailable = 100;

const prismaMock = vi.hoisted(() => ({

}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => prismaMock),
}));

vi.mock('@fastify/jwt', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual, default: function (fastify: any, opts: any, next: any) {
      fastify.decorate('jwtVerify', async function () { this.user = { id: 'admin1', role: 'ADMIN' }; });
      return actual.default(fastify, opts, next);
    }
  };
});

describe('AI Copilot Real-Time Analysis', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = buildApp();
    await app.ready();
    
    // Reset to healthy nominal state
    mockQueueDepth = 10;
    mockPaymentFailures = 0;
    mockInventoryAvailable = 100;
  });

  afterEach(async () => {
    await app.close();
  });

  it('Returns a PERFECT Health Score when system is entirely nominal', async () => {
    const res = await request(app.server).get('/api/ai/copilot/summary').set('Authorization', 'Bearer admin');
    expect(res.status).toBe(200);
    expect(res.body.healthScore).toBe(100);
    expect(res.body.riskLevel).toBe('LOW');
    expect(res.body.keyInsights.length).toBe(0);
  });

  it('Detects RabbitMQ Backlog anomaly and outputs actionable insights', async () => {
    mockQueueDepth = 150; // Triggers Queue depth rule (> 50)
    
    const res = await request(app.server).get('/api/ai/copilot/summary').set('Authorization', 'Bearer admin');
    expect(res.body.healthScore).toBe(85);
    expect(res.body.riskLevel).toBe('MEDIUM');
    expect(res.body.keyInsights[0].insight).toContain('RabbitMQ backlog is increasing');
    expect(res.body.keyInsights[0].confidence).toBeGreaterThan(0.9);
    expect(res.body.keyInsights[0].evidence).toContain('queue_depth');
  });

  it('Detects severe Gateway Timeout issues and adjusts Risk to HIGH', async () => {
    mockPaymentFailures = 15; // > 10% failure rate compared to 10 success
    
    const res = await request(app.server).get('/api/ai/copilot/summary').set('Authorization', 'Bearer admin');
    expect(res.body.riskLevel).toBe('HIGH');
    expect(res.body.keyInsights[0].insight).toContain('Payment failure rate is above baseline');
    expect(res.body.alerts[0]).toContain('Payment Gateway Failure Rate is 60.0%');
  });

  it('Combines compounding risks (Stock + Latency + Queue) into CRITICAL Health Score', async () => {
    mockInventoryAvailable = 5; // < 20%
    mockPaymentFailures = 20; 
    mockQueueDepth = 80;
    
    const res = await request(app.server).get('/api/ai/copilot/summary').set('Authorization', 'Bearer admin');
    expect(res.body.healthScore).toBe(55); // 100 - 10 (inv) - 20 (pay) - 15 (queue) = 55
    expect(res.body.riskLevel).toBe('CRITICAL');
    expect(res.body.keyInsights.length).toBe(3);
    
    // Check that ALL requested insights are correctly synthesized
    const insightsStr = JSON.stringify(res.body.keyInsights);
    expect(insightsStr).toContain('Inventory pressure is HIGH');
    expect(insightsStr).toContain('gateway latency');
    expect(insightsStr).toContain('RabbitMQ');
  });
});
