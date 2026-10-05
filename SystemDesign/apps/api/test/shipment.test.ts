import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';

let mockDB = { shipment: { id: 'ship1', status: 'CREATED', orderId: 'ord1' }, orderStatus: 'CONFIRMED' };

const prismaMock = vi.hoisted(() => ({

}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => prismaMock),
}));

vi.mock('ioredis', () => ({ default: vi.fn(() => ({})) }));
vi.mock('@fastify/jwt', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual, default: function (fastify: any, opts: any, next: any) {
      fastify.decorate('jwtVerify', async function () { this.user = { id: 'user1', role: 'ADMIN' }; }); // Use admin for update endpoints
      return actual.default(fastify, opts, next);
    }
  };
});

describe('Shipment Module', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDB = { shipment: { id: 'ship1', status: 'CREATED', orderId: 'ord1' }, orderStatus: 'CONFIRMED' };
    app = buildApp();
    await app.ready();
  });

  it('create shipment on confirmed order', async () => {
    const res = await request(app.server).post('/api/shipments').set('Authorization', 'Bearer admin').send({ orderId: 'ord1', address: '123 Main St' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('CREATED');
    expect(prismaMock.outboxEvent.create).toHaveBeenCalled(); // Generates event
  });

  it('rejects shipment creation if order is not confirmed', async () => {
    mockDB.orderStatus = 'PAYMENT_PENDING';
    const res = await request(app.server).post('/api/shipments').set('Authorization', 'Bearer admin').send({ orderId: 'ord1', address: '123 Main St' });
    expect(res.status).toBe(422); // Invalid order state
  });

  it('updates shipment status and triggers outbox event safely', async () => {
    const res = await request(app.server).patch('/api/shipments/ship1/status').set('Authorization', 'Bearer admin').send({ status: 'SHIPPED', trackingNumber: 'TRK123' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SHIPPED');
    // Emits SHIPMENT_UPDATED
    expect(prismaMock.outboxEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventType: 'SHIPMENT_UPDATED' })
    }));
  });
});
