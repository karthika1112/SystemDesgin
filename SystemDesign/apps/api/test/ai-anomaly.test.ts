import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';

// Mock Dependencies
let mockReqTotal = 1000;
let mockReqErrors = 10;
let mockLatencySum = 200000; // avg 200ms
let mockQueueDepth = 10;
let mockPaymentFailures = 2; // 2 failures / 100 total = 2%
let mockInventoryAvailable = 100;
let mockDuplicates = 10;
let mockCanceledOrders = 1; // 1 canceled / 100 total = 1%

const redisMock = {
  get: vi.fn(async (key: string) => {
    if (key === 'obs:req_total') return mockReqTotal.toString();
    if (key === 'obs:req_errors') return mockReqErrors.toString();
    if (key === 'obs:latency_sum') return mockLatencySum.toString();
    if (key === 'obs:duplicate_req') return mockDuplicates.toString();
    return null;
  }),
  setex: vi.fn(),
};

vi.mock('../src/plugins/redis', () => ({ redis: redisMock }));
vi.mock('../src/plugins/rabbitmq', () => ({ getChannel: vi.fn(), QUEUES: {}, EXCHANGE: '' }));

process.env.AI_ENABLED = 'true';
process.env.AI_PROVIDER = 'mock';

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

describe('AI Anomaly Detection Suite', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = buildApp();
    await app.ready();
    
    // Reset to healthy nominal state
    mockReqTotal = 1000;
    mockReqErrors = 10;
    mockLatencySum = 200000; // avg 200ms
    mockQueueDepth = 10;
    mockPaymentFailures = 2; // 2%
    mockInventoryAvailable = 100;
    mockDuplicates = 10;
    mockCanceledOrders = 1; // 1%
  });

  afterEach(async () => {
    await app.close();
  });

  it('Returns an empty anomaly list when system is healthy', async () => {
    const res = await request(app.server).get('/api/ai/anomalies').set('Authorization', 'Bearer admin');
    expect(res.status).toBe(200);
    expect(res.body.anomalies.length).toBe(0);
  });

  it('Detects PAYMENT_SPIKE when failure rate exceeds 10%', async () => {
    mockPaymentFailures = 31; // 31 / (98+31) = 24% failure rate
    
    const res = await request(app.server).get('/api/ai/anomalies').set('Authorization', 'Bearer admin');
    expect(res.body.anomalies.length).toBe(1);
    
    const anomaly = res.body.anomalies[0];
    expect(anomaly.type).toBe('PAYMENT_SPIKE');
    expect(anomaly.severity).toBe('HIGH');
    expect(anomaly.metric).toBe('payment_failure_rate');
    expect(anomaly.currentValue).toBeGreaterThan(20);
    expect(anomaly.explanation).toContain('Current payment failures');
  });

  it('Detects QUEUE_BACKLOG and API_ERROR_INCREASE simultaneously', async () => {
    mockQueueDepth = 600; // > 500 => CRITICAL
    mockReqErrors = 150; // 150 / 1000 = 15% > 10% => CRITICAL
    
    const res = await request(app.server).get('/api/ai/anomalies').set('Authorization', 'Bearer admin');
    expect(res.body.anomalies.length).toBe(2);
    
    const types = res.body.anomalies.map((a: any) => a.type);
    expect(types).toContain('QUEUE_BACKLOG');
    expect(types).toContain('API_ERROR_INCREASE');
    
    const queueAnomaly = res.body.anomalies.find((a: any) => a.type === 'QUEUE_BACKLOG');
    expect(queueAnomaly.severity).toBe('CRITICAL');
  });

  it('Detects INVENTORY_MISMATCH if available stock is negative', async () => {
    mockInventoryAvailable = -5; // Impossible state
    
    const res = await request(app.server).get('/api/ai/anomalies').set('Authorization', 'Bearer admin');
    expect(res.body.anomalies[0].type).toBe('INVENTORY_MISMATCH');
    expect(res.body.anomalies[0].severity).toBe('CRITICAL');
    expect(res.body.anomalies[0].explanation).toContain('Physical impossibility');
  });
});
