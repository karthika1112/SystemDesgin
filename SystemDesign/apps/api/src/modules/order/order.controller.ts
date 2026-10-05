import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { OrderStateService, OrderStatus } from './order.state';

const prisma = new PrismaClient();

export const getOrders = async (request: FastifyRequest, reply: FastifyReply) => {
  const user = request.user as any;
  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    include: { items: true },
    orderBy: { createdAt: 'desc' }
  });
  return reply.send(orders);
};

export const getOrderById = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  const user = request.user as any;
  const { id } = request.params;
  
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, payment: true, shipment: true }
  });

  if (!order || (order.userId !== user.id && user.role !== 'ADMIN')) {
    return reply.status(404).send({ message: 'Order not found' });
  }

  return reply.send(order);
};

export const cancelOrder = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  const user = request.user as any;
  const { id } = request.params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id } });
      if (!order || (order.userId !== user.id && user.role !== 'ADMIN')) {
        throw new Error('NOT_FOUND');
      }

      return await OrderStateService.transition(order.id, 'CANCELLED', tx);
    });

    return reply.send(result);
  } catch (err: any) {
    if (err.message === 'NOT_FOUND') return reply.status(404).send({ message: 'Order not found' });
    if (err.message === 'INVALID_TRANSITION') return reply.status(422).send({ message: 'Order cannot be cancelled in its current state' });
    return reply.status(500).send({ message: err.message });
  }
};
