import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { CreatePaymentSchema } from './payment.schemas';
import { PaymentFactory, PaymentResult } from './payment.provider';
import { paymentCircuitBreaker } from './circuit-breaker';

const prisma = new PrismaClient();

const executeWithRetry = async (
  chargeFn: () => Promise<PaymentResult>,
  maxRetries: number = 2
): Promise<PaymentResult> => {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const result = await chargeFn();
      // Retry only on safe transient failures (e.g. TIMEOUT)
      if (result.status === 'TIMEOUT' && attempt < maxRetries) {
        attempt++;
        continue;
      }
      return result;
    } catch (err: any) {
      if (attempt < maxRetries) {
        attempt++;
        continue;
      }
      return { success: false, status: 'TIMEOUT', error: err.message };
    }
  }
  return { success: false, status: 'TIMEOUT', error: 'Max retries exceeded' };
};

export const processPayment = async (
  request: FastifyRequest<{ Body: z.infer<typeof CreatePaymentSchema> }>,
  reply: FastifyReply
) => {
  const user = request.user as any;
  const { orderId, amount } = request.body;
  const idempotencyKey = request.headers['idempotency-key'] as string;

  if (!idempotencyKey) {
    return reply.status(400).send({ message: 'Idempotency-Key header is required' });
  }

  // 1. Idempotency Check
  try {
    await prisma.idempotencyKey.create({
      data: {
        key: idempotencyKey,
        userId: user.id,
        operation: 'PAYMENT',
        requestHash: `${orderId}:${amount}`,
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
    // 2. Validate Order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { reservation: true, payment: true }
    });

    if (!order) throw new Error('ORDER_NOT_FOUND');
    if (order.userId !== user.id) throw new Error('UNAUTHORIZED');
    if (order.status === 'CONFIRMED' || order.payment?.status === 'SUCCESS') {
      throw new Error('ALREADY_PAID');
    }

    // 3. Create Pending Payment Record
    const payment = await prisma.payment.upsert({
      where: { orderId },
      update: { status: 'PENDING', idempotencyKey, amount },
      create: { orderId, status: 'PENDING', idempotencyKey, amount }
    });

    // Factory Pattern Implementation
    const provider = PaymentFactory.getProvider(process.env.PAYMENT_GATEWAY);

    // Circuit Breaker Pattern protecting the external dependency
    const result = await paymentCircuitBreaker.execute(() => 
      executeWithRetry(() => provider.charge({ orderId, amount, idempotencyKey }))
    );

    // 5. Transaction to commit results
    const finalizedPayment = await prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: result.status,
          providerReference: result.transactionId
        }
      });

      if (result.status === 'SUCCESS') {
        await tx.outboxEvent.create({
          data: { aggregateType: 'PAYMENT', aggregateId: updatedPayment.id, eventType: 'PAYMENT_SUCCEEDED', payload: { orderId, eventType: 'PAYMENT_SUCCEEDED' } }
        });
      } else if (result.status === 'FAILED') {
        await tx.outboxEvent.create({
          data: { aggregateType: 'PAYMENT', aggregateId: updatedPayment.id, eventType: 'PAYMENT_FAILED', payload: { orderId, eventType: 'PAYMENT_FAILED' } }
        });
      }

      return updatedPayment;
    });

    // 6. Complete Idempotency
    await prisma.idempotencyKey.update({
      where: { key: idempotencyKey },
      data: { status: 'COMPLETED', response: JSON.parse(JSON.stringify(finalizedPayment)) }
    });

    return reply.status(result.status === 'SUCCESS' ? 200 : 400).send(finalizedPayment);
  } catch (err: any) {
    await prisma.idempotencyKey.update({
      where: { key: idempotencyKey },
      data: { status: 'FAILED', response: { message: err.message } }
    });

    if (err.message === 'ORDER_NOT_FOUND') return reply.status(404).send({ message: 'Order not found' });
    if (err.message === 'UNAUTHORIZED') return reply.status(403).send({ message: 'Unauthorized' });
    if (err.message === 'ALREADY_PAID') return reply.status(409).send({ message: 'Order already paid' });

    return reply.status(500).send({ message: 'Internal server error' });
  }
};
