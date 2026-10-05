import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { redis } from '../../plugins/redis';

const prisma = new PrismaClient();

export const getObservabilityMetrics = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    // Collect System Metrics from Redis
    const [reqTotalStr, reqErrorsStr, latencySumStr] = await Promise.all([
      redis.get('obs:req_total'),
      redis.get('obs:req_errors'),
      redis.get('obs:latency_sum')
    ]);

    const reqTotal = parseFloat(reqTotalStr || '0');
    const reqErrors = parseFloat(reqErrorsStr || '0');
    const latencySum = parseFloat(latencySumStr || '0');
    
    // Average Latency
    const avgLatency = reqTotal > 0 ? (latencySum / reqTotal).toFixed(2) : 0;
    
    // Uptime calculation
    const uptimeSecs = process.uptime();
    const reqPerSec = uptimeSecs > 0 ? (reqTotal / uptimeSecs).toFixed(2) : 0;
    const errorRate = reqTotal > 0 ? ((reqErrors / reqTotal) * 100).toFixed(4) : 0;

    // Active Database Connections (Not natively supported by Prisma MongoDB without raw driver access)
    const connectionCount = 0; // Fallback metric

    // Business Data from existing endpoint logic
    const queueDepth = await prisma.outboxEvent.count({ where: { status: 'PENDING' } });
    
    const [reservations, payments, orders] = await Promise.all([
      prisma.reservation.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.payment.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.order.groupBy({ by: ['status'], _count: { _all: true } })
    ]);

    const formatCounts = (arr: any[]) => arr.reduce((acc, curr) => ({ ...acc, [curr.status]: curr._count._all }), {});
    const rC = formatCounts(reservations);
    const pC = formatCounts(payments);
    const oC = formatCounts(orders);

    const metrics = {
      system: {
        reqPerSec,
        avgLatencyMs: avgLatency,
        errorRatePct: errorRate,
        uptimeSeconds: Math.floor(uptimeSecs),
        databaseActiveConnections: connectionCount,
        messageQueueDepth: queueDepth
      },
      business: {
        reservationSuccess: (rC['PENDING'] || 0) + (rC['CONFIRMED'] || 0),
        reservationFailure: (rC['RELEASED'] || 0) + (rC['EXPIRED'] || 0),
        paymentSuccess: pC['SUCCESS'] || 0,
        paymentFailure: (pC['FAILED'] || 0) + (pC['TIMEOUT'] || 0),
        orderSuccess: (oC['CONFIRMED'] || 0) + (oC['PROCESSING'] || 0) + (oC['SHIPPED'] || 0) + (oC['DELIVERED'] || 0),
        orderFailure: oC['CANCELLED'] || 0
      }
    };

    return reply.send(metrics);
  } catch (err: any) {
    return reply.status(500).send({ message: err.message });
  }
};
