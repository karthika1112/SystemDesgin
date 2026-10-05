import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { CartItemSchema } from './cart.schemas';

const prisma = new PrismaClient();

// Helper to reliably fetch or create a user's cart
const getOrCreateCart = async (userId: string) => {
  let cart = await prisma.cart.findUnique({
    where: { userId },
    include: { items: { include: { product: { include: { inventory: true } } } } }
  });
  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId },
      include: { items: { include: { product: { include: { inventory: true } } } } }
    });
  }
  return cart;
};

export const getCart = async (request: FastifyRequest, reply: FastifyReply) => {
  const user = request.user as any;
  const cart = await getOrCreateCart(user.id);
  return reply.send(cart);
};

export const addItem = async (
  request: FastifyRequest<{ Body: z.infer<typeof CartItemSchema> }>,
  reply: FastifyReply
) => {
  const user = request.user as any;
  const { productId, quantity } = request.body;

  // 1. Verify Product
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return reply.status(404).send({ message: 'Product not found' });
  }

  // 2. Trust nothing from client regarding price. We only need productId and quantity.
  
  const cart = await getOrCreateCart(user.id);
  
  // 3. Upsert item
  const existingItem = await prisma.cartItem.findFirst({
    where: { cartId: cart.id, productId }
  });

  if (existingItem) {
    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: existingItem.quantity + quantity }
    });
  } else {
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId, quantity }
    });
  }

  const updatedCart = await getOrCreateCart(user.id);
  return reply.send(updatedCart);
};

export const updateItem = async (
  request: FastifyRequest<{ Params: { productId: string }, Body: { quantity: number } }>,
  reply: FastifyReply
) => {
  const user = request.user as any;
  const { productId } = request.params;
  const { quantity } = request.body;

  const cart = await getOrCreateCart(user.id);
  const existingItem = await prisma.cartItem.findFirst({
    where: { cartId: cart.id, productId }
  });

  if (!existingItem) {
    return reply.status(404).send({ message: 'Item not found in cart' });
  }

  await prisma.cartItem.update({
    where: { id: existingItem.id },
    data: { quantity }
  });

  const updatedCart = await getOrCreateCart(user.id);
  return reply.send(updatedCart);
};

export const removeItem = async (
  request: FastifyRequest<{ Params: { productId: string } }>,
  reply: FastifyReply
) => {
  const user = request.user as any;
  const { productId } = request.params;

  const cart = await getOrCreateCart(user.id);
  await prisma.cartItem.deleteMany({
    where: { cartId: cart.id, productId }
  });

  const updatedCart = await getOrCreateCart(user.id);
  return reply.send(updatedCart);
};
