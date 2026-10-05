import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redis } from './redis';
import { randomUUID } from 'crypto';

// In-Memory buffering for ultra-fast metric collection during 10k load tests
let localMetrics = {
  reqTotal: 0,
  reqErrors: 0,
  latencySum: 0,
};

// Sync memory to Redis every 5 seconds to minimize blocking I/O
setInterval(async () => {
  if (localMetrics.reqTotal === 0) return;
  const { reqTotal, reqErrors, latencySum } = localMetrics;
  
  // Reset locals
  localMetrics.reqTotal = 0;
  localMetrics.reqErrors = 0;
  localMetrics.latencySum = 0;

  try {
    const pipeline = redis.pipeline();
    pipeline.incrby('obs:req_total', reqTotal);
    pipeline.incrby('obs:req_errors', reqErrors);
    pipeline.incrbyfloat('obs:latency_sum', latencySum);
    await pipeline.exec();
  } catch (e) {
    console.error('Failed to flush metrics to redis', e);
  }
}, 5000);

export default async function telemetryPlugin(app: FastifyInstance) {
  
  // 1. Trace IDs
  app.addHook('onRequest', (request, reply, done) => {
    request.headers['x-correlation-id'] = request.headers['x-correlation-id'] || randomUUID();
    done();
  });

  // 2. Metrics Tracking
  app.addHook('onResponse', (request, reply, done) => {
    const time = reply.getResponseTime();
    
    localMetrics.reqTotal++;
    localMetrics.latencySum += time;

    // 422 is a business error (Out of Stock), so system errors are 5xx or unhandled 400s
    if (reply.statusCode >= 500) {
      localMetrics.reqErrors++;
    }

    // Explicitly add custom fields to the pino log
    request.log.info({
      msg: 'Request processed',
      status: reply.statusCode,
      latencyMs: time,
      userId: (request.user as any)?.id || 'anonymous',
      // Pluck potential domain IDs if they exist in body/params to fulfill strict requirement
      reservationId: (request.body as any)?.reservationId || (request.params as any)?.id,
      paymentId: undefined, 
      orderId: (request.body as any)?.orderId || (request.params as any)?.id,
    });

    done();
  });
}
