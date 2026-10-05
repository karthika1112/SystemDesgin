import { ConsumerBase } from '../event/consumer.base';
import { QUEUES } from '../../plugins/rabbitmq';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const notificationConsumer = new ConsumerBase(QUEUES.NOTIFICATION, async (payload, msg) => {
  const eventType = msg.properties.headers?.eventType || payload.eventType;
  
  const pushNotification = async (userId: string, type: string, message: string) => {
    // In a real app this might send an email or WebSocket push. Here we store in DB/Logs.
    console.log(`[NOTIFICATION -> User:${userId}]: ${message}`);
    await prisma.notification.create({
      data: { userId, type, message }
    });
  };

  if (eventType === 'ORDER_CONFIRMED') {
    const order = await prisma.order.findUnique({ where: { id: payload.orderId } });
    if (order) {
      await pushNotification(order.userId, eventType, `Your order ${order.id} has been confirmed and is preparing for shipment.`);
    }
  } 
  else if (eventType === 'PAYMENT_FAILED') {
    const order = await prisma.order.findUnique({ where: { id: payload.orderId } });
    if (order) {
      await pushNotification(order.userId, eventType, `Your payment for order ${order.id} failed. Your reservation has been released.`);
    }
  }
  else if (eventType === 'SHIPMENT_UPDATED') {
    const shipment = await prisma.shipment.findUnique({ where: { id: payload.id }, include: { order: true } });
    if (shipment && shipment.status === 'SHIPPED') {
      await pushNotification(shipment.order.userId, eventType, `Good news! Order ${shipment.orderId} has been shipped. Tracking: ${shipment.trackingNumber || 'N/A'}`);
    } else if (shipment && shipment.status === 'DELIVERED') {
      await pushNotification(shipment.order.userId, 'ORDER_DELIVERED', `Your order ${shipment.orderId} has been successfully delivered.`);
    }
  }
}, 5); // 5 retries for notifications because it's non-critical to order flow
