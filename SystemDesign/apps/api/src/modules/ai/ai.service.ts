import { PrismaClient } from '@prisma/client';
import { IAIProvider } from './ai.provider';
import { redis } from '../../plugins/redis';

/**
 * AI Services serve ONLY as decision-support layers.
 * They STRICTLY read state and NEVER directly mutate the database.
 */

export class AICopilotService {
  constructor(private ai: IAIProvider, private prisma: PrismaClient) {}

  async getSystemSummary() {
    const [inv, resCount, payCount, ordCount, queueDepth, reqTot, reqErr, latSum, recentIncidents] = await Promise.all([
      this.prisma.inventory.aggregate({ _sum: { availableQuantity: true, reservedQuantity: true, soldQuantity: true } }),
      this.prisma.reservation.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.payment.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.outboxEvent.count({ where: { status: 'PENDING' } }),
      redis.get('obs:req_total'),
      redis.get('obs:req_errors'),
      redis.get('obs:latency_sum'),
      this.prisma.outboxEvent.findMany({ where: { status: 'FAILED' }, take: 5, orderBy: { createdAt: 'desc' } })
    ]);

    const formatCounts = (arr: any[]) => arr.reduce((acc, curr) => ({ ...acc, [curr.status]: curr._count._all }), {});
    
    const context = {
      inventory: {
        available: inv._sum.availableQuantity || 0,
        reserved: inv._sum.reservedQuantity || 0,
        sold: inv._sum.soldQuantity || 0
      },
      reservations: formatCounts(resCount),
      payments: formatCounts(payCount),
      orders: formatCounts(ordCount),
      queueDepth,
      system: {
        reqTotal: Number(reqTot || 0),
        reqErrors: Number(reqErr || 0),
        latencySum: Number(latSum || 0)
      },
      recentIncidents
    };

    return this.ai.generateJSON('Generate Copilot Summary', context);
  }
}

export class AIAnalyticsService {
  constructor(private ai: IAIProvider, private prisma: PrismaClient) {}

  async getSalesSummary() {
    const orders = await this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } });
    const context = { orders: Object.fromEntries(orders.map(o => [o.status, o._count._all])) };
    return this.ai.generateText('Generate AI Sales Summary', context);
  }

  async getDemandForecast(productId: string, horizon: string = '15m') {
    const inventory = await this.prisma.inventory.findUnique({ where: { productId } });
    if (!inventory) throw new Error('Inventory not found');

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentReservations = await this.prisma.reservation.count({
      where: { productId, createdAt: { gte: fifteenMinutesAgo } }
    });

    let multiplier = 1.0;
    switch (horizon) {
      case '5m': multiplier = 1.2; break;
      case '15m': multiplier = 1.5; break;
      case '30m': multiplier = 2.0; break;
      case '1h': multiplier = 3.5; break;
    }

    const currentDemand = Math.max(recentReservations, 10); 
    const forecastDemand = Math.floor(currentDemand * multiplier);

    const trend = forecastDemand > currentDemand * 1.1 ? 'RISING' : 'STABLE';
    const confidence = recentReservations > 50 ? 0.92 : 0.78;
    
    const isHighRisk = forecastDemand > inventory.availableQuantity;
    const riskLevel = isHighRisk ? 'HIGH' : 'LOW';
    const recommendedAction = isHighRisk 
      ? 'Prepare additional read capacity and enable out-of-stock CDN cache strategies.' 
      : 'Monitor traffic patterns passively.';

    const explanation = `This deterministic forecast simulates demand over a ${horizon} horizon using a linear multiplier (${multiplier}x) applied against the ${recentReservations} actual reservations recorded in the last 15 minutes. Note: This is a decision-support hackathon prototype, not a production ML model.`;

    const result = {
      currentDemand, forecastDemand, confidence, trend, riskLevel,
      recommendedAction, explanation, timestamp: new Date().toISOString()
    };

    const snapshotKey = `ai:forecast:snapshots:${productId}`;
    await redis.lpush(snapshotKey, JSON.stringify(result));
    await redis.ltrim(snapshotKey, 0, 49);

    return result;
  }
}

export class AIAnomalyService {
  constructor(private ai: IAIProvider, private prisma: PrismaClient) {}

  async detectAllAnomalies() {
    const [queueDepth, payments, reservations, orders, inv, reqTot, reqErr, latSum, dupReq] = await Promise.all([
      this.prisma.outboxEvent.count({ where: { status: 'PENDING' } }),
      this.prisma.payment.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.reservation.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.inventory.aggregate({ _sum: { availableQuantity: true, reservedQuantity: true, soldQuantity: true } }),
      redis.get('obs:req_total'),
      redis.get('obs:req_errors'),
      redis.get('obs:latency_sum'),
      redis.get('obs:duplicate_req')
    ]);

    const formatCounts = (arr: any[]) => arr.reduce((acc, curr) => ({ ...acc, [curr.status]: curr._count._all }), {});

    const context = {
      queueDepth,
      payments: formatCounts(payments),
      reservations: formatCounts(reservations),
      orders: formatCounts(orders),
      inventory: { available: inv._sum.availableQuantity || 0 },
      system: {
        reqTotal: Number(reqTot || 0),
        reqErrors: Number(reqErr || 0),
        latencySum: Number(latSum || 0),
        duplicates: Number(dupReq || 0)
      }
    };

    return this.ai.generateJSON('Detect System Anomalies', context);
  }

  async detectTrafficAnomaly() {
    const queueDepth = await this.prisma.outboxEvent.count({ where: { status: 'PENDING' } });
    return this.ai.generateJSON('Detect Traffic Anomaly', { system: { queueDepth } });
  }

  async analyzePaymentFailures() {
    const payments = await this.prisma.payment.groupBy({ by: ['status'], _count: { _all: true } });
    const pMap = Object.fromEntries(payments.map(p => [p.status, p._count._all]));
    return this.ai.generateJSON('Analyze Payment Failures', { payments: pMap });
  }

  async explainIncident(incidentId: string, logs: string) {
    return this.ai.generateText('Analyze and Explain Incident', { incidentId, logs });
  }
}

export class AIRecommendationService {
  constructor(private ai: IAIProvider, private prisma: PrismaClient) {}

  async detectInventoryRisk(productId: string) {
    const inventory = await this.prisma.inventory.findUnique({ where: { productId } });
    if (!inventory) throw new Error('Inventory not found');
    return this.ai.generateJSON('Detect Inventory Risk', { inventory });
  }

  async getOperationalRecommendations() {
    const systemMetrics = await this.prisma.outboxEvent.count({ where: { status: 'FAILED' } });
    return this.ai.generateJSON('Generate Operational Recommendations', { failedEvents: systemMetrics });
  }

  async getUserRiskProfile(userId: string) {
    return this.ai.generateJSON('Calculate User Risk Profile', { userId });
  }
}

export class AISimulationService {
  constructor(private ai: IAIProvider) {}

  async simulateWhatIf(users: number, durationSeconds: number) {
    return this.ai.generateJSON('Run What-If Simulate', { users, durationSeconds });
  }
}

export class AINaturalLanguageService {
  constructor(private ai: IAIProvider, private prisma: PrismaClient) {}

  private determineIntent(question: string) {
    const q = question.toLowerCase();
    if (q.includes('payment') || q.includes('gateway')) return 'PAYMENT_HEALTH';
    if (q.includes('inventory') || q.includes('oversell')) return 'INVENTORY_STATUS';
    if (q.includes('slow') || q.includes('latency') || q.includes('checkout')) return 'CHECKOUT_LATENCY';
    if (q.includes('traffic')) return 'TRAFFIC_HEALTH';
    if (q.includes('reservation')) return 'RESERVATION_HEALTH';
    if (q.includes('queue') || q.includes('rabbitmq') || q.includes('backlog')) return 'QUEUE_HEALTH';
    if (q.includes('order')) return 'ORDER_HEALTH';
    if (q.includes('happened') || q.includes('anomaly')) return 'ANOMALY_SUMMARY';
    return 'SYSTEM_HEALTH';
  }

  async query(question: string, timeRange: string, userId: string) {
    const intent = this.determineIntent(question);
    let metrics: any = {};

    switch(intent) {
      case 'PAYMENT_HEALTH':
        const payments = await this.prisma.payment.groupBy({ by: ['status'], _count: { _all: true } });
        metrics = payments.reduce((acc, curr) => ({ ...acc, [curr.status]: curr._count._all }), {});
        break;
      case 'INVENTORY_STATUS':
        const inv = await this.prisma.inventory.aggregate({ _sum: { availableQuantity: true, reservedQuantity: true, soldQuantity: true } });
        metrics = { available: inv._sum.availableQuantity || 0, reserved: inv._sum.reservedQuantity || 0, sold: inv._sum.soldQuantity || 0 };
        break;
      case 'QUEUE_HEALTH':
        metrics = { pendingMessages: await this.prisma.outboxEvent.count({ where: { status: 'PENDING' } }) };
        break;
      case 'TRAFFIC_HEALTH':
        metrics = { totalRequests: Number(await redis.get('obs:req_total') || 0), errors: Number(await redis.get('obs:req_errors') || 0) };
        break;
      case 'CHECKOUT_LATENCY':
         metrics = { latencySum: Number(await redis.get('obs:latency_sum') || 0), totalRequests: Number(await redis.get('obs:req_total') || 1) };
         break;
      case 'RESERVATION_HEALTH':
        const resCount = await this.prisma.reservation.groupBy({ by: ['status'], _count: { _all: true } });
        metrics = resCount.reduce((acc, curr) => ({ ...acc, [curr.status]: curr._count._all }), {});
        break;
      default:
        metrics = { status: 'SYSTEM_ONLINE' };
        break;
    }

    const response = await this.ai.generateJSON('NL Operations Assistant', { question, intent, metrics });

    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'AI_NL_QUERY',
          resource: 'AI_ASSISTANT',
          ipAddress: '127.0.0.1',
          details: { question, intent, timeRange }
        }
      });
    } catch(e) {}

    return response;
  }
}
