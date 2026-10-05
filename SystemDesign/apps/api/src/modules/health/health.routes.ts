import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { redis } from '../../plugins/redis';
import { getChannel } from '../../plugins/rabbitmq';

const prisma = new PrismaClient();

export default async function healthRoutes(app: FastifyInstance) {
  // Liveness Probe (Does the process exist and route traffic?)
  app.get('/health', async () => ({ status: 'UP', timestamp: new Date() }));

  // Readiness Probe (Are dependencies functioning?)
  app.get('/ready', async (request, reply) => {
    const health: any = { status: 'READY', dependencies: {} };
    let isReady = true;

    // Check DB
    try {
      await prisma.$runCommandRaw({ ping: 1 });
      health.dependencies.database = 'UP';
    } catch {
      health.dependencies.database = 'DOWN';
      isReady = false;
    }

    // Check Redis
    try {
      await redis.ping();
      health.dependencies.redis = 'UP';
    } catch {
      health.dependencies.redis = 'DOWN';
      isReady = false;
    }

    // Check RabbitMQ
    try {
      const channel = getChannel();
      if (!channel) throw new Error();
      health.dependencies.rabbitmq = 'UP';
    } catch {
      health.dependencies.rabbitmq = 'DOWN';
      isReady = false;
    }

    if (!isReady) {
      health.status = 'NOT_READY';
      return reply.status(503).send(health);
    }

    return reply.send(health);
  });
}
