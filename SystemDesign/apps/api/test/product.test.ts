import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';

const mockProducts = [
  { id: 'p1', name: 'Product 1', description: 'Desc 1', price: 10, inventory: { availableQuantity: 50 } }
];

const prismaMock = vi.hoisted(() => ({

}));
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => prismaMock),
}));

const redisMock = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
};
vi.mock('ioredis', () => ({
  default: vi.fn(() => redisMock),
}));

// Mock fastify jwt
vi.mock('@fastify/jwt', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    default: function (fastify: any, opts: any, next: any) {
      fastify.decorate('jwtVerify', async function () {
        if (this.headers.authorization === 'Bearer admin-token') {
          this.user = { id: 'admin1', role: 'ADMIN' };
          return;
        }
        throw new Error('Unauthorized');
      });
      return actual.default(fastify, opts, next);
    }
  };
});

describe('Product Endpoints', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = buildApp();
    await app.ready();
  });

  it('GET /api/products uses cache', async () => {
    redisMock.get.mockResolvedValue(JSON.stringify(mockProducts));

    const response = await request(app.server).get('/api/products');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockProducts);
    expect(prismaMock.product.findMany).not.toHaveBeenCalled();
  });

  it('GET /api/products falls back to db and sets cache', async () => {
    redisMock.get.mockResolvedValue(null);
    prismaMock.product.findMany.mockResolvedValue(mockProducts);

    const response = await request(app.server).get('/api/products');

    expect(response.status).toBe(200);
    expect(prismaMock.product.findMany).toHaveBeenCalled();
    expect(redisMock.setex).toHaveBeenCalledWith('cache:products', 300, JSON.stringify(mockProducts));
  });

  it('POST /api/products (Admin) creates and invalidates cache', async () => {
    prismaMock.product.create.mockResolvedValue({ id: 'p2', name: 'Product 2' });

    const response = await request(app.server)
      .post('/api/products')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'Product 2', description: 'Desc 2', price: 20, initialQuantity: 100 });

    expect(response.status).toBe(201);
    expect(redisMock.del).toHaveBeenCalledWith('cache:products');
  });

  it('POST /api/products fails for non-admins', async () => {
    const response = await request(app.server)
      .post('/api/products')
      .set('Authorization', 'Bearer customer-token')
      .send({ name: 'Product 2', description: 'Desc 2', price: 20 });

    expect(response.status).toBe(401);
  });
});
