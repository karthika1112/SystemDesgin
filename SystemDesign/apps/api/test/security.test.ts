import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';

// Mock dependencies safely
vi.mock('../src/plugins/redis', () => ({ redis: { get: vi.fn(), setex: vi.fn() } }));
vi.mock('../src/plugins/rabbitmq', () => ({ getChannel: vi.fn(), QUEUES: {}, EXCHANGE: '' }));

let mockAuditLog: any[] = [];

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
        const auth = this.headers.authorization;
        if (!auth || auth === 'Bearer invalid') throw new Error('Unauthorized');
        
        if (auth === 'Bearer customer') {
          this.user = { id: 'cust1', role: 'CUSTOMER' };
        } else if (auth === 'Bearer admin') {
          this.user = { id: 'admin1', role: 'ADMIN' };
        }
      });
      return actual.default(fastify, opts, next);
    }
  };
});

describe('Security Hardening Test Suite', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockAuditLog = [];
    app = buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('1. Blocks unauthorized API access without JWT', async () => {
    const res = await request(app.server).get('/api/orders');
    expect(res.status).toBe(401);
  });

  it('2. Blocks requests with an invalid/forged JWT', async () => {
    const res = await request(app.server).get('/api/orders').set('Authorization', 'Bearer invalid');
    expect(res.status).toBe(401);
  });

  it('3. Prevents Customer from accessing Admin endpoints (Role-Based Authorization)', async () => {
    const res = await request(app.server).get('/api/admin/flash-sale/metrics').set('Authorization', 'Bearer customer');
    expect(res.status).toBe(403);
  });

  it('4. Rejects malformed requests instantly via strict validation (SQLi/XSS vector block)', async () => {
    // Requires number for amount, sending string
    const res = await request(app.server).post('/api/payments').set('Authorization', 'Bearer customer').send({ orderId: 'ord1', amount: 'abc' });
    expect(res.status).toBe(400); // Bad Request (Zod Validation Error)
  });

  it('5. Successfully records Audit Log on sensitive mutating Admin action', async () => {
    // Sending a PATCH to shipment status (requires ADMIN role)
    const res = await request(app.server)
      .patch('/api/shipments/ship1/status')
      .set('Authorization', 'Bearer admin')
      .send({ status: 'SHIPPED', trackingNumber: '123' });

    // Ensure our onResponse hook triggered the database audit log write!
    expect(prismaMock.auditLog.create).toHaveBeenCalled();
    const log = mockAuditLog[0];
    expect(log.action).toBe('PATCH');
    expect(log.userId).toBe('admin1');
    expect(log.resource).toContain('/api/shipments/ship1/status');
    expect(log.details.body.trackingNumber).toBe('123');
  });

  it('6. Demonstrates Rate Limiting enforcement (100 requests per minute limit)', async () => {
    // We execute 101 raw Fastify injections to bypass supertest overhead to test the fastify-rate-limit plugin
    const limitApp = buildApp();
    await limitApp.ready();
    
    let lastStatus = 200;
    for (let i = 0; i < 101; i++) {
      const response = await limitApp.inject({
        method: 'GET',
        url: '/api/products',
        headers: { 'x-forwarded-for': '1.2.3.4' }
      });
      lastStatus = response.statusCode;
    }
    
    await limitApp.close();
    
    // The 101st request from the exact same IP should trip the 429 Too Many Requests response
    expect(lastStatus).toBe(429);
  });
});
