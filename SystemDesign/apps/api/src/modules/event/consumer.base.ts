import { ConsumeMessage } from 'amqplib';
import { getChannel, EXCHANGE } from '../../plugins/rabbitmq';
import { redis } from '../../plugins/redis';

export type MessageHandler = (payload: any, msg: ConsumeMessage) => Promise<void>;

export class ConsumerBase {
  constructor(public queue: string, public handler: MessageHandler, public maxRetries = 3) {}

  async start() {
    const channel = getChannel();
    if (!channel) return;

    await channel.consume(this.queue, async (msg) => {
      if (!msg) return;

      const messageId = msg.properties.messageId;
      const idempotencyKey = `processed_msg:${messageId}`;

      // 1. Check Idempotency using Redis (ensures duplicate events aren't processed twice)
      if (messageId) {
        const isProcessed = await redis.get(idempotencyKey);
        if (isProcessed) {
          channel.ack(msg); // Already done safely
          return;
        }
      }

      try {
        const payload = JSON.parse(msg.content.toString());
        
        // 2. Process Core Logic
        await this.handler(payload, msg);

        // 3. Complete and cache idempotency marker for 7 days
        if (messageId) {
          await redis.setex(idempotencyKey, 604800, '1');
        }
        
        channel.ack(msg);
      } catch (err) {
        const retryCount = msg.properties.headers?.['x-retry-count'] || 0;

        if (retryCount < this.maxRetries) {
          // Republish with incremented retry count
          const headers = { ...msg.properties.headers, 'x-retry-count': retryCount + 1 };
          channel.publish(msg.fields.exchange || EXCHANGE, msg.fields.routingKey, msg.content, {
            ...msg.properties,
            headers
          });
          channel.ack(msg); // Acknowledge the original so we don't endlessly loop it right now
        } else {
          // Send to Dead Letter Queue via NACK (requeue=false)
          channel.nack(msg, false, false);
        }
      }
    });
  }
}
