import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';

let mockFailedPayments = 0;
let mockReservationAttempts = 0;
let mockDuplicateRequests = 0;

vi.mock('../src/plugins/redis', () => ({ 
  redis: { 
    get: vi.fn(async (key) => {
      if (key.includes('risk:dupes')) return mockDuplicateRequests.toString();
      return null;
    }), 
    setex: vi.fn() 
  } 
}));
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

describe('AI User Risk Abuse Detection', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = buildApp();
    await app.ready();
    
    // Reset to healthy nominal state
    mockFailedPayments = 1;
    mockReservationAttempts = 2;
    mockDuplicateRequests = 5;
  });

  afterEach(async () => {
    await app.close();
  });

  it('Returns LOW risk level for normal user behavior', async () => {
    const res = await request(app.server).get('/api/ai/risk/users/user-123').set('Authorization', 'Bearer admin');
    expect(res.status).toBe(200);
    expect(res.body.riskScore).toBe(0);
    expect(res.body.riskLevel).toBe('LOW');
    expect(res.body.signals.length).toBe(0);
  });

  it('Returns HIGH risk when failed payments exceeds deterministic threshold', async () => {
    mockFailedPayments = 10; // > 5 config
    
    const res = await request(app.server).get('/api/ai/risk/users/user-123').set('Authorization', 'Bearer admin');
    expect(res.body.riskLevel).toBe('HIGH');
    expect(res.body.signals).toContain('EXCESSIVE_FAILED_PAYMENTS');
    expect(res.body.riskScore).toBe(40);
  });

  it('Returns CRITICAL risk and recommends CAPTCHA/Manual review for combined abuse vectors', async () => {
    mockFailedPayments = 10; // > 5 (score: 40)
    mockReservationAttempts = 20; // > 10 (score: 30)
    mockDuplicateRequests = 50; // > 20 (score: 30)
    
    const res = await request(app.server).get('/api/ai/risk/users/user-123').set('Authorization', 'Bearer admin');
    expect(res.body.riskLevel).toBe('CRITICAL');
    expect(res.body.riskScore).toBe(100);
    expect(res.body.signals.length).toBe(3);
    expect(res.body.recommendedAction).toContain('Flag for manual review');
    // Ensure AI obeys constraint:
    expect(res.body.recommendedAction).toContain('Do NOT automatically ban without deterministic policy');
  });
});
