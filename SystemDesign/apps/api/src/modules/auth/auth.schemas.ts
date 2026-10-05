import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2)
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export const UserResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.enum(['CUSTOMER', 'ADMIN']),
  createdAt: z.date().or(z.string()) // Fastify sometimes serializes dates to strings
});
