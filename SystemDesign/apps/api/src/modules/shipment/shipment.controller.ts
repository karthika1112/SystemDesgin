import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { CreateShipmentSchema, UpdateShipmentStatusSchema } from './shipment.schemas';
import { OrderStateService, OrderStatus } from '../order/order.state';

const prisma = new PrismaClient();

export const createShipment = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const user = request.user as any;
  const { orderId, address } = request.body as z.infer<typeof CreateShipmentSchema>;

  try {
    const shipment = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error('ORDER_NOT_FOUND');
      if (order.userId !== user.id && user.role !== 'ADMIN') throw new Error('UNAUTHORIZED');
      
      if (order.status !== 'CONFIRMED' && order.status !== 'PROCESSING') {
        throw new Error('INVALID_ORDER_STATE');
      }

      const newShipment = await tx.shipment.create({
        data: {
          orderId,
          address,
          status: 'CREATED'
        }
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'SHIPMENT',
          aggregateId: newShipment.id,
          eventType: 'SHIPMENT_CREATED',
          payload: JSON.parse(JSON.stringify(newShipment))
        }
      });

      return newShipment;
    });

    return reply.status(201).send(shipment);
  } catch (err: any) {
    if (err.message === 'ORDER_NOT_FOUND') return reply.status(404).send({ message: 'Order not found' });
    if (err.message === 'UNAUTHORIZED') return reply.status(403).send({ message: 'Unauthorized' });
    if (err.message === 'INVALID_ORDER_STATE') return reply.status(422).send({ message: 'Order must be CONFIRMED to create a shipment' });
    return reply.status(500).send({ message: err.message });
  }
};

export const getShipment = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  const user = request.user as any;
  const { id } = request.params;

  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: { order: true }
  });

  if (!shipment || (shipment.order.userId !== user.id && user.role !== 'ADMIN')) {
    return reply.status(404).send({ message: 'Shipment not found' });
  }

  return reply.send(shipment);
};

export const updateShipmentStatus = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const { id } = request.params as { id: string };
  const { status, trackingNumber } = request.body as z.infer<typeof UpdateShipmentStatusSchema>;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({ where: { id } });
      if (!shipment) throw new Error('NOT_FOUND');

      const newShipment = await tx.shipment.update({
        where: { id },
        data: { status, trackingNumber }
      });

      // Synchronize Order State safely
      try {
        if (['PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(status)) {
           await OrderStateService.transition(shipment.orderId, status as OrderStatus, tx);
        }
      } catch (e) {
        // If state transition fails, fail the whole transaction to ensure consistency
        throw new Error('ORDER_TRANSITION_FAILED');
      }

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'SHIPMENT',
          aggregateId: id,
          eventType: 'SHIPMENT_UPDATED',
          payload: JSON.parse(JSON.stringify(newShipment))
        }
      });

      return newShipment;
    });

    return reply.send(updated);
  } catch (err: any) {
    if (err.message === 'NOT_FOUND') return reply.status(404).send({ message: 'Shipment not found' });
    if (err.message === 'ORDER_TRANSITION_FAILED') return reply.status(422).send({ message: 'Invalid corresponding order state transition' });
    return reply.status(500).send({ message: err.message });
  }
};
