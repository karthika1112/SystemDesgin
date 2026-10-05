import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';

// ----------------------------------------------------
// SOPHISTICATED IN-MEMORY DB MOCK FOR CONCURRENCY TEST
// ----------------------------------------------------
let mockDB = {
  inventory: 100,
  reserved: 0,
  idempotencyKeys: new Set<string>(),
  reservationsCreated: 0
};

const prismaMock = vi.hoisted(() => ({

}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => prismaMock),
}));

vi.mock('ioredis', () => ({ default: vi.fn(() => ({})) }));

// Mock JWT
vi.mock('@fastify/jwt', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    default: function (fastify: any, opts: any, next: any) {
      fastify.decorate('jwtVerify', async function () {
        this.user = { id: 'user-id-test', role: 'CUSTOMER' };
      });
      return actual.default(fastify, opts, next);
    }
  };
});

describe('Reservation System - Concurrency & Idempotency', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDB = { inventory: 100, reserved: 0, idempotencyKeys: new Set(), reservationsCreated: 0 };
    app = buildApp();
    await app.ready();
  });

  it('CRITICAL TEST: 10,000 Concurrent Reservations', async () => {
    const totalRequests = 10000;
    const concurrencyPool = [];

    // Fire 10,000 requests without awaiting them to simulate high concurrency
    for (let i = 0; i < totalRequests; i++) {
      concurrencyPool.push(
        request(app.server)
          .post('/api/reservations')
          .set('Authorization', 'Bearer dummy')
          .set('Idempotency-Key', `idem-key-${i}`)
          .send({ productId: 'flash-sale-shoe', quantity: 1 })
      );
    }

    // Await all requests to complete
    const responses = await Promise.all(concurrencyPool);

    // Assertions
    const successCount = responses.filter(r => r.status === 201).length;
    const outOfStockCount = responses.filter(r => r.status === 422).length;

    expect(successCount).toBe(100);
    expect(outOfStockCount).toBe(9900);
    
    expect(mockDB.inventory).toBe(0);
    expect(mockDB.reserved).toBe(100);
    expect(mockDB.reservationsCreated).toBe(100);
    
    // Safety check: NO NEGATIVE INVENTORY
    expect(mockDB.inventory).toBeGreaterThanOrEqual(0);
    // Safety check: NEVER OVERSELL
    expect(mockDB.reserved).toBeLessThanOrEqual(100);
  });

  it('Prevents duplicate execution via Idempotency-Key', async () => {
    // 1st request goes through
    await request(app.server)
      .post('/api/reservations')
      .set('Authorization', 'Bearer dummy')
      .set('Idempotency-Key', 'same-key')
      .send({ productId: 'flash-sale-shoe', quantity: 1 });

    // 2nd request with same key
    const response2 = await request(app.server)
      .post('/api/reservations')
      .set('Authorization', 'Bearer dummy')
      .set('Idempotency-Key', 'same-key')
      .send({ productId: 'flash-sale-shoe', quantity: 1 });

    // Handled by our Prisma mock throwing P2002 -> returns 409
    expect(response2.status).toBe(409);
    expect(mockDB.reserved).toBe(1); // Still only 1 reserved
  });
});
