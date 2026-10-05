import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { redis } from '../../plugins/redis';

const prisma = new PrismaClient();

export const getFlashSaleMetrics = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    // 1. Redis caching for read-heavy operations during a flash sale.
    // Cache TTL is strictly 2 seconds to provide real-time-ish dashboarding without hammering the DB.
    const cachedMetrics = await redis.get('flash_sale_metrics');
    if (cachedMetrics) {
      return reply.send(JSON.parse(cachedMetrics));
    }

    // 2. Authoritative Database Aggregation
    const [inventory, reservations, payments, orders, queueBacklog, outboxErrors] = await Promise.all([
      prisma.inventory.aggregate({
        _sum: { availableQuantity: true, reservedQuantity: true, soldQuantity: true }
      }),
      prisma.reservation.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.payment.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.outboxEvent.count({ where: { status: 'PENDING' } }),
      prisma.outboxEvent.count({ where: { status: 'FAILED' } })
    ]);

    const formatCounts = (arr: any[]) => arr.reduce((acc, curr) => ({ ...acc, [curr.status]: curr._count._all }), {});
    
    const resCount = formatCounts(reservations);
    const payCount = formatCounts(payments);
    const ordCount = formatCounts(orders);

    const metrics = {
      inventory: {
        available: inventory._sum.availableQuantity || 0,
        reserved: inventory._sum.reservedQuantity || 0,
        sold: inventory._sum.soldQuantity || 0,
        total: (inventory._sum.availableQuantity || 0) + (inventory._sum.reservedQuantity || 0) + (inventory._sum.soldQuantity || 0)
      },
      reservations: {
        success: (resCount['PENDING'] || 0) + (resCount['CONFIRMED'] || 0),
        failed: (resCount['RELEASED'] || 0) + (resCount['EXPIRED'] || 0)
      },
      payments: {
        success: payCount['SUCCESS'] || 0,
        failed: (payCount['FAILED'] || 0) + (payCount['TIMEOUT'] || 0)
      },
      orders: {
        confirmed: (ordCount['CONFIRMED'] || 0) + (ordCount['PROCESSING'] || 0) + (ordCount['SHIPPED'] || 0) + (ordCount['DELIVERED'] || 0),
        failed: ordCount['CANCELLED'] || 0
      },
      system: {
        queueBacklog,
        errorCount: outboxErrors + (payCount['FAILED'] || 0)
      }
    };

    // Store in cache
    await redis.setex('flash_sale_metrics', 2, JSON.stringify(metrics));

    return reply.send(metrics);
  } catch (err: any) {
    return reply.status(500).send({ message: err.message });
  }
};
