import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../../plugins/redis';

export default async function chaosRoutes(fastify: FastifyInstance) {
  // Only register chaos routes if NODE_ENV is development
  if (process.env.NODE_ENV !== 'development') {
    fastify.post('/scenario', async (req, reply) => {
      return reply.status(403).send({ error: 'Chaos testing restricted to development environment' });
    });
    return;
  }

  // Admin authentication applied
  fastify.addHook('preValidation', (fastify as any).authenticate);
  fastify.addHook('preValidation', (fastify as any).requireAdmin);

  fastify.post('/scenario', async (request: FastifyRequest<{ Body: { scenario: string; durationSeconds: number } }>, reply: FastifyReply) => {
    const { scenario, durationSeconds } = request.body;
    
    // Set a chaos flag in Redis with TTL = durationSeconds
    const key = `chaos:${scenario.toLowerCase()}`;
    await redis.setex(key, durationSeconds, 'active');
    
    // Broadcast the event to SSE streams
    await redis.publish('system_events', JSON.stringify({
      timestamp: new Date().toISOString(),
      eventType: 'CHAOS_STARTED',
      severity: 'WARNING',
      shortDescription: `Chaos Scenario: ${scenario} activated for ${durationSeconds}s`
    }));

    // Start a timeout to resolve it
    setTimeout(async () => {
      await redis.publish('system_events', JSON.stringify({
        timestamp: new Date().toISOString(),
        eventType: 'CHAOS_RESOLVED',
        severity: 'INFO',
        shortDescription: `Chaos Scenario: ${scenario} resolved automatically`
      }));
    }, durationSeconds * 1000);

    return reply.send({ success: true, scenario, durationSeconds });
  });
}
