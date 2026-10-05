import { PrismaClient } from '@prisma/client';
import { getChannel, EXCHANGE } from '../plugins/rabbitmq';

const prisma = new PrismaClient();

export const startOutboxWorker = () => {
  // Poll every 2 seconds
  setInterval(async () => {
    try {
      await processOutbox();
    } catch (err) {
      console.error('Outbox worker error:', err);
    }
  }, 2000);
};

export const processOutbox = async () => {
  const channel = getChannel();
  if (!channel) return;

  // Use a transaction to safely fetch and lock a pending event
  const events = await prisma.$transaction(async (tx) => {
    // Note: In postgres, we would use SKIP LOCKED. 
    // Here we find pending events and immediately update them to PROCESSING status 
    // to prevent concurrent workers from grabbing the same event.
    const pendingEvents = await tx.outboxEvent.findMany({
      where: { status: 'PENDING' },
      take: 50,
      orderBy: { createdAt: 'asc' }
    });

    if (pendingEvents.length === 0) return [];

    await tx.outboxEvent.updateMany({
      where: { id: { in: pendingEvents.map(e => e.id) } },
      data: { status: 'PROCESSING' }
    });

    return pendingEvents;
  });

  for (const event of events) {
    try {
      // Routing key format: `aggregatetype.EVENT_TYPE` e.g., `reservation.RESERVATION_CREATED`
      const routingKey = `${event.aggregateType.toLowerCase()}.${event.eventType}`;
      
      const payload = typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload);

      // Publish to RabbitMQ securely tied to messageId
      channel.publish(EXCHANGE, routingKey, Buffer.from(payload), {
        messageId: event.id,
        correlationId: event.id,
        persistent: true,
        headers: {
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          eventType: event.eventType
        }
      });

      // Mark as PROCESSED
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: { status: 'PROCESSED', processedAt: new Date() }
      });
    } catch (err) {
      // Revert to PENDING if publication fails internally
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: { status: 'PENDING' }
      });
    }
  }
};
