import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';

// Mock Prisma and bcrypt
const prismaMock = vi.hoisted(() => ({

}));
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => prismaMock),
}));
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashedPassword'),
    compare: vi.fn().mockImplementation((plain, hash) => plain === 'validpassword' && hash === 'hashedPassword'),
  },
}));

describe('Auth Endpoints', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = buildApp();
    await app.ready();
  });

  it('successful registration', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test',
      passwordHash: 'hashedPassword',
      role: 'CUSTOMER',
      createdAt: new Date(),
    });

    const response = await request(app.server)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'validpassword', name: 'Test' });

    expect(response.status).toBe(201);
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.body.email).toBe('test@example.com');
  });

  it('duplicate email registration', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-2' });

    const response = await request(app.server)
      .post('/api/auth/register')
      .send({ email: 'existing@example.com', password: 'validpassword', name: 'Test' });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('Email already in use');
  });

  it('successful login', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      passwordHash: 'hashedPassword',
      role: 'CUSTOMER',
    });

    const response = await request(app.server)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'validpassword' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
  });

  it('invalid password login', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      passwordHash: 'hashedPassword',
      role: 'CUSTOMER',
    });

    const response = await request(app.server)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrongpassword' });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid credentials');
  });

  it('unauthorized request without token', async () => {
    const response = await request(app.server)
      .get('/api/auth/me');

    expect(response.status).toBe(401);
  });

  it('invalid JWT', async () => {
    const response = await request(app.server)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');

    expect(response.status).toBe(401);
  });
});
