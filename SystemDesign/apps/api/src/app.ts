import fastify from 'fastify';
import { serializerCompiler, validatorCompiler, jsonSchemaTransform, ZodTypeProvider } from 'fastify-type-provider-zod';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fjwt from '@fastify/jwt';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { PrismaClient } from '@prisma/client';
import authPlugin from './plugins/auth';
import authRoutes from './modules/auth/auth.routes';
import telemetryPlugin from './plugins/telemetry';
import healthRoutes from './modules/health/health.routes';
import { randomUUID } from 'crypto';
import productRoutes from './modules/product/product.routes';
import cartRoutes from './modules/cart/cart.routes';
import reservationRoutes from './modules/reservation/reservation.routes';
import paymentRoutes from './modules/payment/payment.routes';
import orderRoutes from './modules/order/order.routes';
import shipmentRoutes from './modules/shipment/shipment.routes';
import adminRoutes from './modules/admin/admin.routes';
import aiRoutes from './modules/ai/ai.routes';

const prisma = new PrismaClient();

export const buildApp = () => {
  // Configured Structured JSON Logging with strict PII/Secrets masking
  const app = fastify({ 
    logger: {
      level: 'info',
      redact: ['req.headers.authorization', 'body.password', 'body.token', 'body.cardNumber'],
      serializers: {
        req(request) {
          return {
            method: request.method,
            url: request.url,
            requestId: request.id,
            correlationId: request.headers['x-correlation-id'],
          };
        }
      }
    },
    genReqId: (req) => (req.headers['x-request-id'] as string) || randomUUID()
  }).withTypeProvider<ZodTypeProvider>();

  // Security Plugins
  app.register(helmet, { global: true }); 
  app.register(cors, { origin: process.env.CORS_ORIGIN || '*' }); 
  app.register(rateLimit, {
    max: 100, 
    timeWindow: '1 minute', 
    keyGenerator: (req) => (req.headers['x-forwarded-for'] as string) || req.ip
  });

  // Telemetry & Observability Layer
  app.register(telemetryPlugin);

  app.setValidatorCompiler(validatorCompiler); 
  app.setSerializerCompiler(serializerCompiler);

  app.register(swagger, {
    openapi: {
      info: { 
        title: 'SALESTORM API', 
        version: '1.0.0',
        description: 'High-Concurrency Flash Sale E-Commerce Platform API Documentation.\n\nProvides endpoints for Auth, Products, Cart, Reservations, Checkout, Payments, Orders, Shipments, and Admin Telemetry.'
      },
      tags: [
        { name: 'Auth', description: 'Authentication and User Management' },
        { name: 'Products', description: 'Product Catalog and Inventory' },
        { name: 'Cart', description: 'Shopping Cart Management' },
        { name: 'Reservations', description: 'Strict-consistency Inventory Reservation' },
        { name: 'Checkout', description: 'Order Creation' },
        { name: 'Payments', description: 'Payment Gateway Integration' },
        { name: 'Orders', description: 'Order Lifecycle' },
        { name: 'Shipments', description: 'Fulfillment and Tracking' },
        { name: 'Admin', description: 'Observability and Metrics' }
      ],
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }
      }
    },
    transform: jsonSchemaTransform,
  });

  app.register(swaggerUi, { routePrefix: '/documentation' });

  // Auth Configuration
  app.register(fjwt, { secret: process.env.JWT_SECRET || 'supersecret' });
  app.register(authPlugin);

  // Security Audit Hook
  app.addHook('onResponse', async (request, reply) => {
    if ((request.url.includes('/api/admin') || request.url.includes('/status')) && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      try {
        await prisma.auditLog.create({
          data: {
            userId: (request.user as any)?.id || 'SYSTEM',
            action: request.method,
            resource: request.url,
            ipAddress: request.ip,
            details: { body: request.body as any }
          }
        });
      } catch (err) {}
    }
  });

  // Routing
  app.register(healthRoutes, { prefix: '/' });
  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(productRoutes, { prefix: '/api' });
  app.register(cartRoutes, { prefix: '/api/cart' });
  app.register(reservationRoutes, { prefix: '/api/reservations' });
  app.register(paymentRoutes, { prefix: '/api/payments' });
  app.register(orderRoutes, { prefix: '/api' });
  app.register(shipmentRoutes, { prefix: '/api/shipments' });
  app.register(adminRoutes, { prefix: '/api/admin' });
  app.register(aiRoutes, { prefix: '/api/ai' });

  return app;
};
