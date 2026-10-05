import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';

// Mock dependencies
vi.mock('../src/plugins/redis', () => ({ redis: { get: vi.fn(), setex: vi.fn() } }));
vi.mock('../src/plugins/rabbitmq', () => ({ getChannel: vi.fn(), QUEUES: {}, EXCHANGE: '' }));

// Provide env var to ensure AI is enabled for tests
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
      fastify.decorate('jwtVerify', async function () {
        this.user = { id: 'admin1', role: 'ADMIN' }; // AI endpoints require Admin
      });
      return actual.default(fastify, opts, next);
    }
  };
});

describe('AI-Powered Command Center Module', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('1. AI Copilot Query (Text Generation)', async () => {
    const res = await request(app.server)
      .post('/api/ai/copilot')
      .set('Authorization', 'Bearer admin')
      .send({ query: 'How is the sale going?' });
    expect(res.status).toBe(200);
    expect(res.body.result).toContain('Natural Language Response');
  });

  it('2. AI Sales Summary (Text Insights)', async () => {
    const res = await request(app.server).get('/api/ai/summary').set('Authorization', 'Bearer admin');
    expect(res.status).toBe(200);
    expect(res.body.summary).toContain('50 confirmed orders');
  });

  it('3. AI Inventory Risk Detection (JSON Analytics)', async () => {
    const res = await request(app.server).get('/api/ai/inventory-risk?productId=p1').set('Authorization', 'Bearer admin');
    expect(res.status).toBe(200);
    // Our mock logic checks if available < 10 -> 'CRITICAL'
    expect(res.body.riskLevel).toBe('CRITICAL');
  });

  it('4. AI Traffic Anomaly Detection (JSON Analytics)', async () => {
    const res = await request(app.server).get('/api/ai/traffic-anomaly').set('Authorization', 'Bearer admin');
    expect(res.status).toBe(200);
    expect(res.body.anomalyDetected).toBe(true); // Queue depth mocked to 150 > 100
  });

  it('5. AI Payment Failures Analysis (JSON Analytics)', async () => {
    const res = await request(app.server).get('/api/ai/payment-failures').set('Authorization', 'Bearer admin');
    expect(res.status).toBe(200);
    expect(res.body.failureRate).toBe(10); // 10 fails, 90 success
  });

  it('7. AI What-If Simulation', async () => {
    const res = await request(app.server)
      .post('/api/ai/simulate')
      .set('Authorization', 'Bearer admin')
      .send({ users: 20000, durationSeconds: 60 });
    expect(res.status).toBe(200);
    expect(res.body.simulatedSuccessfulCheckouts).toBe(100); // Caps at 100 max capacity!
    expect(res.body.projectedDatabaseLoad).toBe('HIGH');
  });

  it('9. AI Incident Explanation', async () => {
    const res = await request(app.server)
      .post('/api/ai/incident-explanation')
      .set('Authorization', 'Bearer admin')
      .send({ logs: 'ERROR timeout' });
    expect(res.status).toBe(200);
    expect(res.body.explanation).toContain('Incident Explanation: High latency');
  });
});
