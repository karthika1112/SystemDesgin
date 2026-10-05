import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import { RegisterSchema, LoginSchema } from './auth.schemas';
import { z } from 'zod';
// Import Prisma directly for now due to workspace linking issues
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const register = async (
  request: FastifyRequest<{ Body: z.infer<typeof RegisterSchema> }>,
  reply: FastifyReply
) => {
  const { email, password, name } = request.body;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return reply.status(409).send({ message: 'Email already in use' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: 'CUSTOMER',
    },
  });

  const { passwordHash: _, ...userWithoutPassword } = user;
  return reply.status(201).send(userWithoutPassword);
};

export const login = async (
  request: FastifyRequest<{ Body: z.infer<typeof LoginSchema> }>,
  reply: FastifyReply
) => {
  const { email, password } = request.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return reply.status(401).send({ message: 'Invalid credentials' });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return reply.status(401).send({ message: 'Invalid credentials' });
  }

  const token = await reply.jwtSign({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  return reply.send({ token });
};

export const getCurrentUser = async (request: FastifyRequest, reply: FastifyReply) => {
  const jwtUser = request.user as any;
  const user = await prisma.user.findUnique({ where: { id: jwtUser.id } });
  
  if (!user) {
    return reply.status(404).send({ message: 'User not found' });
  }

  const { passwordHash: _, ...userWithoutPassword } = user;
  return reply.send(userWithoutPassword);
};
