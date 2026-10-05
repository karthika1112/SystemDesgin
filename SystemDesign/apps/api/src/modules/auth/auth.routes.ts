import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import * as AuthController from './auth.controller';
import { RegisterSchema, LoginSchema, UserResponseSchema } from './auth.schemas';
import { z } from 'zod';

export default async function authRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.post(
    '/register',
    {
      schema: {
        description: 'Register a new customer',
        tags: ['Auth'],
        body: RegisterSchema,
        response: {
          201: UserResponseSchema,
          409: z.object({ message: z.string() })
        }
      }
    },
    AuthController.register
  );

  app.post(
    '/login',
    {
      schema: {
        description: 'Login to an account',
        tags: ['Auth'],
        body: LoginSchema,
        response: {
          200: z.object({ token: z.string() }),
          401: z.object({ message: z.string() })
        }
      }
    },
    AuthController.login
  );

  app.get(
    '/me',
    {
      preValidation: [app.authenticate],
      schema: {
        description: 'Get current user profile',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        response: {
          200: UserResponseSchema,
          401: z.object({ message: z.string() }),
          404: z.object({ message: z.string() })
        }
      }
    },
    AuthController.getCurrentUser
  );
}
