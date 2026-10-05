import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Redis from 'ioredis';

// Need a separate Redis instance purely for subscribing, as ioredis subscriber mode blocks other commands
const getSubscriber = () => new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export default async function eventsRoutes(fastify: FastifyInstance) {
  fastify.get('/stream', async (req: FastifyRequest, reply: FastifyReply) => {
    const raw = reply.raw;
    raw.setHeader('Content-Type', 'text/event-stream');
    raw.setHeader('Cache-Control', 'no-cache');
    raw.setHeader('Connection', 'keep-alive');
    raw.setHeader('Access-Control-Allow-Origin', '*'); // Or configure cors properly

    raw.writeHead(200);

    const subscriber = getSubscriber();
    await subscriber.subscribe('system_events');

    subscriber.on('message', (channel, message) => {
      raw.write(`data: ${message}\n\n`);
    });

    req.raw.on('close', () => {
      subscriber.quit();
    });

    // Send a heartbeat ping to keep connection alive
    const interval = setInterval(() => {
      raw.write(': heartbeat\n\n');
    }, 15000);

    req.raw.on('close', () => {
      clearInterval(interval);
    });

    // We manually hijacked the raw stream so tell fastify we sent the response
    reply.hijack();
  });
}
