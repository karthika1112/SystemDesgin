import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';
import { OrderStateService } from '../src/modules/order/order.state';

let mockDB = { inventory: { available: 100, reserved: 10, sold: 0 } };

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
      fastify.decorate('jwtVerify', async function () { this.user = { id: 'user1', role: 'CUSTOMER' }; });
      return actual.default(fastify, opts, next);
    }
  };
});

describe('Checkout and Order Module', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDB = { inventory: { available: 100, reserved: 10, sold: 0 } };
    app = buildApp();
    await app.ready();
  });

  it('successful checkout creates order from reservation', async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    prismaMock.reservation.findUnique.mockResolvedValue({ id: 'res1', userId: 'user1', status: 'PENDING', quantity: 2, expiresAt: new Date(Date.now() + 100000), product: { id: 'prod1', price: 50 } });
    prismaMock.order.create.mockResolvedValue({ id: 'order1', status: 'PAYMENT_PENDING', totalAmount: 100 });

    const response = await request(app.server).post('/api/checkout').set('Authorization', 'Bearer token').send({ reservationId: 'res1' });
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('PAYMENT_PENDING');
    expect(prismaMock.order.create).toHaveBeenCalled();
  });

  it('duplicate checkout returns existing order', async () => {
    prismaMock.order.findUnique.mockResolvedValue({ id: 'order1', status: 'PAYMENT_PENDING' });
    const response = await request(app.server).post('/api/checkout').set('Authorization', 'Bearer token').send({ reservationId: 'res1' });
    expect(response.status).toBe(201);
    expect(response.body.id).toBe('order1');
    expect(prismaMock.reservation.findUnique).not.toHaveBeenCalled();
  });

  it('expired reservation rejects checkout', async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    prismaMock.reservation.findUnique.mockResolvedValue({ id: 'res1', userId: 'user1', status: 'PENDING', expiresAt: new Date(Date.now() - 100000), product: { price: 50 } });
    const response = await request(app.server).post('/api/checkout').set('Authorization', 'Bearer token').send({ reservationId: 'res1' });
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/expired/i);
  });

  it('invalid state transition throws', async () => {
    expect(() => OrderStateService.canTransition('DELIVERED', 'SHIPPED')).toBe(false);
    expect(() => OrderStateService.canTransition('CREATED', 'PAYMENT_PENDING')).toBe(true);
  });

  it('cancellation from PAYMENT_PENDING returns reserved inventory', async () => {
    prismaMock.order.findUnique.mockResolvedValue({ id: 'order1', status: 'PAYMENT_PENDING', userId: 'user1', reservationId: 'res1', items: [{ quantity: 5, productId: 'prod1' }] });
    prismaMock.order.update.mockResolvedValue({ id: 'order1', status: 'CANCELLED' });

    const response = await request(app.server).post('/api/orders/order1/cancel').set('Authorization', 'Bearer token');
    expect(response.status).toBe(200);
    expect(mockDB.inventory.available).toBe(105);
    expect(mockDB.inventory.reserved).toBe(5);
  });
});
