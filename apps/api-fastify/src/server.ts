import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { appRouter, createContext, type User } from '@glapi/trpc';
import { db } from '@glapi/database';
import { allowedOrigins } from './config';
import { authPreHandler, resolveRequestUser } from './auth';
import { AuthenticationError } from './errors';
import { generateRuntimeOpenApiSpec } from './openapi';

export async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: true,
  });

  await server.register(cors, {
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-api-key',
      'x-organization-id',
      'x-user-id',
      'x-clerk-organization-id',
      'x-clerk-user-id',
    ],
    origin(origin, callback) {
      callback(null, !origin || allowedOrigins.includes(origin));
    },
  });

  server.setErrorHandler((error, _request, reply) => {
    if (error instanceof AuthenticationError) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: error.message,
        },
      });
    }

    server.log.error(error);
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      },
    });
  });

  const healthHandler = async () => ({
    status: 'ok',
    service: 'api-fastify',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });

  server.get('/health', healthHandler);
  server.get('/api/health', healthHandler);

  server.get('/openapi.json', async (_request, reply) => {
    return reply.send(generateRuntimeOpenApiSpec());
  });

  await server.register(swagger, {
    mode: 'static',
    specification: {
      document: generateRuntimeOpenApiSpec(),
    },
  });

  await server.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      url: '/openapi.json',
    },
  });

  await server.register(async (protectedApi) => {
    protectedApi.addHook('preHandler', authPreHandler);

    await protectedApi.register(fastifyTRPCPlugin, {
      prefix: '/api/trpc',
      trpcOptions: {
        router: appRouter,
        createContext({ req, res }) {
          const user = resolveRequestUser(req);
          res.header('X-Organization-Id', user.organizationId);

          return createContext({
            req: req as never,
            res: res as never,
            user: user as User,
            db,
          });
        },
        onError({ error, path }) {
          server.log.error({ err: error, path }, 'tRPC error');
        },
      },
    });
  });

  return server;
}
