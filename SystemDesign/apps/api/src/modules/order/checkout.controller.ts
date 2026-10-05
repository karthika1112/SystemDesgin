import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { CheckoutRequestSchema } from './order.schemas';

import { CheckoutFacade } from '../checkout/checkout.facade';
import { OrderRepository } from './order.repository';

const prisma = new PrismaClient();
const checkoutFacade = new CheckoutFacade(prisma, new OrderRepository(prisma));

export const checkout = async (
  request: FastifyRequest<{ Body: z.infer<typeof CheckoutRequestSchema> }>,
  reply: FastifyReply
) => {
  const user = request.user as any;
  const { reservationId } = request.body;

  try {
    // Facade Pattern: Hides the complex orchestration and repository logic from the HTTP Controller
    const order = await checkoutFacade.processCheckout(reservationId, user.id);
    return reply.status(201).send(order);
  } catch (err: any) {
    if (err.message === 'INVALID_RESERVATION') return reply.status(404).send({ message: 'Reservation not found or unauthorized' });
    if (err.message === 'RESERVATION_NOT_PENDING') return reply.status(400).send({ message: 'Reservation is not pending' });
    if (err.message === 'RESERVATION_EXPIRED') return reply.status(400).send({ message: 'Reservation has expired' });
    return reply.status(500).send({ message: 'Internal Server Error' });
  }
};
