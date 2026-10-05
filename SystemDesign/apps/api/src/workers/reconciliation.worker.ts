import { PrismaClient } from '@prisma/client';
import { OrderStateService } from '../modules/order/order.state';

const prisma = new PrismaClient();

export const startReconciliationWorker = () => {
  // Run every minute
  setInterval(async () => {
    try {
      await processReconciliation();
    } catch (err) {
      console.error('Reconciliation worker error:', err);
    }
  }, 60000);
};

export const processReconciliation = async () => {
  // Find payments that succeeded but orders are still pending payment after 30 seconds
  const stuckPayments = await prisma.payment.findMany({
    where: {
      status: 'SUCCESS',
      order: { status: 'PAYMENT_PENDING' },
      updatedAt: { lt: new Date(Date.now() - 30000) }
    }
  });

  for (const payment of stuckPayments) {
    try {
      // Direct Idempotent Retry
      await prisma.$transaction(async (tx) => {
        await OrderStateService.transition(payment.orderId, 'CONFIRMED', tx);
        
        await tx.outboxEvent.create({
          data: { aggregateType: 'ORDER', aggregateId: payment.orderId, eventType: 'ORDER_CONFIRMED', payload: { orderId: payment.orderId } }
        });
      });
    } catch (err) {
      console.error(`Reconciliation failed for payment ${payment.id}:`, err);
    }
  }
};
