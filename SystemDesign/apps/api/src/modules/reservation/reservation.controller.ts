import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { CreateReservationSchema } from './reservation.schemas';

const prisma = new PrismaClient();

export const createReservation = async (
  request: FastifyRequest<{ Body: z.infer<typeof CreateReservationSchema> }>,
  reply: FastifyReply
) => {
  const user = request.user as any;
  const { productId, quantity } = request.body;
  const idempotencyKey = request.headers['idempotency-key'] as string;

  if (!idempotencyKey) {
    return reply.status(400).send({ message: 'Idempotency-Key header is required' });
  }

  // 1. Idempotency handling
  try {
    await prisma.idempotencyKey.create({
      data: {
        key: idempotencyKey,
        userId: user.id,
        operation: 'RESERVE',
        requestHash: `${productId}:${quantity}`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    });
  } catch (err: any) {
    if (err.code === 'P2002') {
      const existing = await prisma.idempotencyKey.findUnique({ where: { key: idempotencyKey } });
      if (existing?.status === 'COMPLETED') return reply.send(existing.response);
      return reply.status(409).send({ message: 'Concurrent request processing' });
    }
    throw err;
  }

  try {
    // 2. Transaction for atomic inventory reservation
    const reservation = await prisma.$transaction(async (tx) => {
      // 2a. Atomic Conditional Update
      const invUpdate = await tx.inventory.updateMany({
        where: {
          productId,
          availableQuantity: { gte: quantity }
        },
        data: {
          availableQuantity: { decrement: quantity },
          reservedQuantity: { increment: quantity },
          version: { increment: 1 }
        }
      });

      // Crucial part: If 0 rows updated, it means stock is insufficient.
      if (invUpdate.count === 0) {
        throw new Error('OUT_OF_STOCK');
      }

      // 2b. Create Reservation
      const res = await tx.reservation.create({
        data: {
          userId: user.id,
          productId,
          quantity,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins expiry
          idempotencyKey
        }
      });

      // 2c. Create Outbox Event
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'RESERVATION',
          aggregateId: res.id,
          eventType: 'RESERVATION_CREATED',
          payload: JSON.parse(JSON.stringify(res))
        }
      });

      return res;
    });

    // 3. Mark Idempotency as completed
    await prisma.idempotencyKey.update({
      where: { key: idempotencyKey },
      data: { status: 'COMPLETED', response: JSON.parse(JSON.stringify(reservation)) }
    });

    return reply.status(201).send(reservation);
  } catch (err: any) {
    // Mark idempotency as failed or out of stock
    await prisma.idempotencyKey.update({
      where: { key: idempotencyKey },
      data: { status: 'FAILED', response: { message: err.message } }
    });

    if (err.message === 'OUT_OF_STOCK') {
      return reply.status(422).send({ message: 'Out of stock' });
    }
    return reply.status(500).send({ message: 'Internal server error' });
  }
};

export const releaseReservation = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  const user = request.user as any;
  const { id } = request.params;

  await prisma.$transaction(async (tx) => {
    const res = await tx.reservation.findUnique({ where: { id } });
    if (!res || res.userId !== user.id) {
      throw new Error('NOT_FOUND');
    }

    // Atomic update to prevent double release
    const updated = await tx.reservation.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'RELEASED' }
    });

    // If 0, it was already processed
    if (updated.count === 0) return;

    // Release inventory atomically
    await tx.inventory.updateMany({
      where: { productId: res.productId },
      data: {
        availableQuantity: { increment: res.quantity },
        reservedQuantity: { decrement: res.quantity },
        version: { increment: 1 }
      }
    });

    await tx.outboxEvent.create({
      data: {
        aggregateType: 'RESERVATION',
        aggregateId: id,
        eventType: 'RESERVATION_RELEASED',
        payload: { id, status: 'RELEASED' }
      }
    });
  }).catch((err) => {
    if (err.message === 'NOT_FOUND') reply.status(404).send({ message: 'Reservation not found' });
  });

  return reply.send({ message: 'Reservation released successfully' });
};
