import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';

let mockIdempotencyKeys = new Map();
let mockDB = {
  inventory: 100,
  reserved: 1
};

const prismaMock = vi.hoisted(() => ({

}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => prismaMock),
}));

// Mock JWT
vi.mock('@fastify/jwt', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual, default: function (fastify: any, opts: any, next: any) {
      fastify.decorate('jwtVerify', async function () { this.user = { id: 'user1', role: 'CUSTOMER' }; });
      return actual.default(fastify, opts, next);
    }
  };
});

describe('Payment Service', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockIdempotencyKeys.clear();
    mockDB = { inventory: 100, reserved: 1 };
    app = buildApp();
    await app.ready();
    process.env.MOCK_PAYMENT_MODE = 'SUCCESS';
  });

  it('successful payment', async () => {
    const response = await request(app.server)
      .post('/api/payments')
      .set('Idempotency-Key', 'idem-1')
      .set('Authorization', 'Bearer token')
      .send({ orderId: 'order1', amount: 100 });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('SUCCESS');
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: 'order1' }, data: { status: 'CONFIRMED' }
    });
  });

  it('failure releases reservation', async () => {
    process.env.MOCK_PAYMENT_MODE = 'FAILURE';

    const response = await request(app.server)
      .post('/api/payments')
      .set('Idempotency-Key', 'idem-2')
      .set('Authorization', 'Bearer token')
      .send({ orderId: 'order1', amount: 100 });

    expect(response.status).toBe(400);
    expect(response.body.status).toBe('FAILED');
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: 'order1' }, data: { status: 'CANCELLED' }
    });
    // Reservation released
    expect(prismaMock.reservation.updateMany).toHaveBeenCalled();
    expect(mockDB.inventory).toBe(101);
    expect(mockDB.reserved).toBe(0);
  });

  it('timeout behavior', async () => {
    process.env.MOCK_PAYMENT_MODE = 'TIMEOUT';

    const response = await request(app.server)
      .post('/api/payments')
      .set('Idempotency-Key', 'idem-3')
      .set('Authorization', 'Bearer token')
      .send({ orderId: 'order1', amount: 100 });

    expect(response.status).toBe(400);
    expect(response.body.status).toBe('TIMEOUT');
  });

  it('duplicate payment blocked by idempotency', async () => {
    process.env.MOCK_PAYMENT_MODE = 'SUCCESS';
    await request(app.server).post('/api/payments').set('Idempotency-Key', 'idem-4').set('Authorization', 'Bearer token').send({ orderId: 'order1', amount: 100 });
    
    // Second request
    const response = await request(app.server).post('/api/payments').set('Idempotency-Key', 'idem-4').set('Authorization', 'Bearer token').send({ orderId: 'order1', amount: 100 });

    expect(response.status).toBe(200);
    expect(prismaMock.payment.upsert).toHaveBeenCalledTimes(1); // Cached via idempotency
  });

  it('payment success after retry', async () => {
    process.env.MOCK_PAYMENT_MODE = 'TIMEOUT_ONCE_THEN_SUCCESS';

    const response = await request(app.server)
      .post('/api/payments')
      .set('Idempotency-Key', 'idem-5')
      .set('Authorization', 'Bearer token')
      .send({ orderId: 'order1', amount: 100 });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('SUCCESS');
  });
});
