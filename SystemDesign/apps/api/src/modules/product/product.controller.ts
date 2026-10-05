import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { redis, CACHE_KEYS } from '../../plugins/redis';
import { CreateProductSchema, UpdateProductSchema } from './product.schemas';

const prisma = new PrismaClient();

export const getProducts = async (request: FastifyRequest, reply: FastifyReply) => {
  const cached = await redis.get(CACHE_KEYS.PRODUCTS);
  if (cached) {
    return reply.send(JSON.parse(cached));
  }

  const products = await prisma.product.findMany({
    include: { inventory: true },
  });

  await redis.setex(CACHE_KEYS.PRODUCTS, 300, JSON.stringify(products));
  return reply.send(products);
};

export const getProductById = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  const { id } = request.params;
  const cacheKey = CACHE_KEYS.PRODUCT(id);

  const cached = await redis.get(cacheKey);
  if (cached) {
    return reply.send(JSON.parse(cached));
  }

  const product = await prisma.product.findUnique({
    where: { id },
    include: { inventory: true },
  });

  if (!product) {
    return reply.status(404).send({ message: 'Product not found' });
  }

  await redis.setex(cacheKey, 300, JSON.stringify(product));
  return reply.send(product);
};

export const createProduct = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const { name, description, price, initialQuantity } = request.body as z.infer<typeof CreateProductSchema>;

  const product = await prisma.product.create({
    data: {
      name,
      description,
      price,
      inventory: {
        create: {
          availableQuantity: initialQuantity,
        }
      }
    },
    include: { inventory: true },
  });

  // Invalidate cache
  await redis.del(CACHE_KEYS.PRODUCTS);

  return reply.status(201).send(product);
};

export const updateProduct = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const { id } = request.params as { id: string };
  const body = request.body as z.infer<typeof UpdateProductSchema>;
  
  const product = await prisma.product.update({
    where: { id },
    data: body,
    include: { inventory: true },
  });

  // Invalidate caches
  await redis.del(CACHE_KEYS.PRODUCTS);
  await redis.del(CACHE_KEYS.PRODUCT(id));

  return reply.send(product);
};

export const deleteProduct = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const { id } = request.params as { id: string };
  
  // Note: normally we'd soft delete or check relations. For hackathon, just delete.
  await prisma.inventory.deleteMany({ where: { productId: id } });
  await prisma.product.delete({ where: { id } });

  await redis.del(CACHE_KEYS.PRODUCTS);
  await redis.del(CACHE_KEYS.PRODUCT(id));

  return reply.status(204).send();
};
