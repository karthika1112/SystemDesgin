import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import * as ProductController from './product.controller';
import { ProductResponseSchema, CreateProductSchema, UpdateProductSchema } from './product.schemas';
import { z } from 'zod';

export default async function productRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get('/products', {
    schema: {
      tags: ['Products'],
      response: { 200: z.array(ProductResponseSchema) }
    }
  }, ProductController.getProducts);

  app.get('/products/:id', {
    schema: {
      tags: ['Products'],
      params: z.object({ id: z.string() }),
      response: { 
        200: ProductResponseSchema,
        404: z.object({ message: z.string() })
      }
    }
  }, ProductController.getProductById);

  // Admin routes
  app.post('/products', {
    preValidation: [app.requireAdmin],
    schema: {
      tags: ['Products (Admin)'],
      security: [{ bearerAuth: [] }],
      body: CreateProductSchema,
      response: { 201: ProductResponseSchema }
    }
  }, ProductController.createProduct);

  app.put('/products/:id', {
    preValidation: [app.requireAdmin],
    schema: {
      tags: ['Products (Admin)'],
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      body: UpdateProductSchema,
      response: { 200: ProductResponseSchema }
    }
  }, ProductController.updateProduct);

  app.delete('/products/:id', {
    preValidation: [app.requireAdmin],
    schema: {
      tags: ['Products (Admin)'],
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 204: z.any() }
    }
  }, ProductController.deleteProduct);
}
