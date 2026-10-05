import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';

vi.mock('../src/plugins/redis', () => ({ redis: { get: vi.fn(), setex: vi.fn() } }));
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

describe('AI Natural Language Operations Assistant', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('Safely parses "Why are payments failing?" into PAYMENT_HEALTH intent without executing raw SQL', async () => {
    const res = await request(app.server)
      .post('/api/ai/query')
      .set('Authorization', 'Bearer admin')
      .send({ question: 'Why are payments failing?', timeRange: 'last_15_minutes' });
      
    expect(res.status).toBe(200);
    expect(res.body.evidence).toContain('payment_status_distribution');
    expect(res.body.answer).toContain('elevated rate of 20.0%'); // 20 fails / 100 total
    expect(res.body.confidence).toBeGreaterThan(0.8);
    expect(prismaMock.payment.groupBy).toHaveBeenCalled(); // Safe ORM call
    
    // Check audit log was fired
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'AI_NL_QUERY' })
    }));
  });

  it('Safely parses "How much inventory is left?" into INVENTORY_STATUS intent', async () => {
    const res = await request(app.server)
      .post('/api/ai/query')
      .set('Authorization', 'Bearer admin')
      .send({ question: 'How much inventory is left?' });
      
    expect(res.status).toBe(200);
    expect(res.body.evidence).toContain('availableQuantity');
    expect(res.body.metrics.available).toBe(50);
    expect(res.body.answer).toContain('We have 50 units remaining');
  });
  
  it('Handles Edge Case: Missing data yields insufficient confidence safely', async () => {
    // Override payment to return empty
    prismaMock.payment.groupBy.mockResolvedValueOnce([]);
    
    const res = await request(app.server)
      .post('/api/ai/query')
      .set('Authorization', 'Bearer admin')
      .send({ question: 'Are payments failing?' });
      
    expect(res.status).toBe(200);
    expect(res.body.answer).toContain('Insufficient data');
  });
});
