import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';

const mockCart = {
  id: 'cart1',
  userId: 'user1',
  items: []
};

const prismaMock = vi.hoisted(() => ({

}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => prismaMock),
}));

vi.mock('ioredis', () => ({
  default: vi.fn(() => ({ get: vi.fn(), setex: vi.fn(), del: vi.fn() })),
}));

// Mock fastify jwt
vi.mock('@fastify/jwt', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    default: function (fastify: any, opts: any, next: any) {
      fastify.decorate('jwtVerify', async function () {
        if (this.headers.authorization === 'Bearer valid-token') {
          this.user = { id: 'user1', role: 'CUSTOMER' };
          return;
        }
        throw new Error('Unauthorized');
      });
      return actual.default(fastify, opts, next);
    }
  };
});

describe('Cart Endpoints', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = buildApp();
    await app.ready();

    prismaMock.cart.findUnique.mockResolvedValue(mockCart);
  });

  it('GET /api/cart retrieves cart', async () => {
    const response = await request(app.server)
      .get('/api/cart')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body.id).toBe('cart1');
  });

  it('POST /api/cart/items validates positive quantity', async () => {
    const response = await request(app.server)
      .post('/api/cart/items')
      .set('Authorization', 'Bearer valid-token')
      .send({ productId: 'p1', quantity: 0 });

    expect(response.status).toBe(400); // validation error from Zod
  });

  it('POST /api/cart/items rejects invalid product', async () => {
    prismaMock.product.findUnique.mockResolvedValue(null);

    const response = await request(app.server)
      .post('/api/cart/items')
      .set('Authorization', 'Bearer valid-token')
      .send({ productId: 'invalid', quantity: 1 });

    expect(response.status).toBe(404);
  });

  it('POST /api/cart/items adds item', async () => {
    prismaMock.product.findUnique.mockResolvedValue({ id: 'p1', name: 'Product' });
    prismaMock.cartItem.findFirst.mockResolvedValue(null); // not in cart yet

    const response = await request(app.server)
      .post('/api/cart/items')
      .set('Authorization', 'Bearer valid-token')
      .send({ productId: 'p1', quantity: 1 });

    expect(response.status).toBe(200);
    expect(prismaMock.cartItem.create).toHaveBeenCalledWith({
      data: { cartId: 'cart1', productId: 'p1', quantity: 1 }
    });
  });
});
