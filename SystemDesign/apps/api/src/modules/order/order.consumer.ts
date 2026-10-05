import { ConsumerBase } from '../event/consumer.base';
import { QUEUES } from '../../plugins/rabbitmq';
import { OrderStateService } from './order.state';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Expose a test toggle to simulate downtime
export let isOrderConsumerDisabled = false;
export const setOrderConsumerDisabled = (disabled: boolean) => { isOrderConsumerDisabled = disabled; };

export const orderConsumer = new ConsumerBase(QUEUES.PAYMENT, async (payload, msg) => {
  if (isOrderConsumerDisabled) {
    throw new Error('SIMULATED_ORDER_SERVICE_DOWNTIME');
  }

  const eventType = msg.properties.headers?.eventType || payload.eventType;
  const orderId = payload.orderId;

  if (!orderId) return;

  await prisma.$transaction(async (tx) => {
    if (eventType === 'PAYMENT_SUCCEEDED') {
      await OrderStateService.transition(orderId, 'CONFIRMED', tx);
      
      // Optionally trigger another outbox event for Order Confirmed
      await tx.outboxEvent.create({
        data: { aggregateType: 'ORDER', aggregateId: orderId, eventType: 'ORDER_CONFIRMED', payload: { orderId } }
      });
    } else if (eventType === 'PAYMENT_FAILED') {
      await OrderStateService.transition(orderId, 'CANCELLED', tx);
    }
  });
});
