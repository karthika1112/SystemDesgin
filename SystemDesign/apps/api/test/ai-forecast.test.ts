import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';

// Mock dependencies
const redisMock = {
  get: vi.fn(),
  setex: vi.fn(),
  lpush: vi.fn(),
  ltrim: vi.fn()
};
vi.mock('../src/plugins/redis', () => ({ redis: redisMock }));
vi.mock('../src/plugins/rabbitmq', () => ({ getChannel: vi.fn(), QUEUES: {}, EXCHANGE: '' }));

// Provide env var to ensure AI is enabled for tests
process.env.AI_ENABLED = 'true';
process.env.AI_PROVIDER = 'mock';

// We will mutate these to simulate different states
let mockInventoryCount = 50;
let mockReservationCount = 100;

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

describe('AI Demand Forecasting', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = buildApp();
    await app.ready();
    
    mockInventoryCount = 50;
    mockReservationCount = 100;
  });

  afterEach(async () => {
    await app.close();
  });

  it('Calculates 15m default demand correctly', async () => {
    // 100 reservations * 1.5 multiplier = 150 forecast
    const res = await request(app.server)
      .get('/api/ai/forecast/00000000-0000-0000-0000-000000000000')
      .set('Authorization', 'Bearer admin');
      
    expect(res.status).toBe(200);
    expect(res.body.currentDemand).toBe(100);
    expect(res.body.forecastDemand).toBe(150);
    
    // 150 forecast > 50 inventory -> HIGH Risk
    expect(res.body.riskLevel).toBe('HIGH');
    
    // Check explanation constraints
    expect(res.body.explanation).toContain('deterministic forecast simulates demand over a 15m horizon');
    expect(res.body.explanation).toContain('not a production ML model');
    
    // Ensure it saved snapshot
    expect(redisMock.lpush).toHaveBeenCalledWith('ai:forecast:snapshots:00000000-0000-0000-0000-000000000000', expect.any(String));
    expect(redisMock.ltrim).toHaveBeenCalled();
  });

  it('Adjusts calculations correctly for 5m horizon with LOW risk', async () => {
    mockReservationCount = 20;
    mockInventoryCount = 100; // 20 * 1.2 = 24 forecast < 100 inventory -> LOW risk

    const res = await request(app.server)
      .get('/api/ai/forecast/00000000-0000-0000-0000-000000000000?horizon=5m')
      .set('Authorization', 'Bearer admin');
      
    expect(res.status).toBe(200);
    expect(res.body.currentDemand).toBe(20);
    expect(res.body.forecastDemand).toBe(24);
    expect(res.body.riskLevel).toBe('LOW');
    expect(res.body.explanation).toContain('over a 5m horizon');
  });

  it('Rejects invalid horizons', async () => {
    const res = await request(app.server)
      .get('/api/ai/forecast/00000000-0000-0000-0000-000000000000?horizon=1y') // invalid
      .set('Authorization', 'Bearer admin');
      
    expect(res.status).toBe(400); // Fastify-Zod schema validation blocks it
  });
});
