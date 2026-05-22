import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { auth as betterAuth } from '@glapi/auth';
import { appRouter, createContext, type User } from '@glapi/trpc';
import { db } from '@glapi/database';
import { allowedOrigins } from './config';
import { authPreHandler, resolveRequestUser } from './auth';
import { registerCustomFieldRoutes } from './custom-field-routes';
import { AuthenticationError } from './errors';
import { registerOntologyRoutes } from './ontology-routes';
import { generateRuntimeOpenApiSpec } from './openapi';
import { registerSavedSearchRoutes } from './saved-search-routes';

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
  await server.register(registerOntologyRoutes);

  server.all('/api/auth/*', async (request, reply) => {
    const forwardedProto = request.headers['x-forwarded-proto'];
    const protocol = Array.isArray(forwardedProto)
      ? forwardedProto[0]
      : forwardedProto || request.protocol;
    const host = request.headers.host ?? 'localhost';
    const url = `${protocol}://${host}${request.url}`;
    const method = request.method.toUpperCase();
    const canHaveBody = method !== 'GET' && method !== 'HEAD';

    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== undefined) headers.append(key, item);
        }
      } else if (value !== undefined) {
        headers.set(key, String(value));
      }
    }

    const webRequest = new Request(url, {
      method,
      headers,
      body: canHaveBody && request.body !== undefined
        ? JSON.stringify(request.body)
        : undefined,
    });
    const response = await betterAuth.handler(webRequest);

    const getSetCookie = (response.headers as unknown as { getSetCookie?: () => string[] })
      .getSetCookie;
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'set-cookie') {
        reply.header(key, value);
      }
    });

    if (typeof getSetCookie === 'function') {
      getSetCookie.call(response.headers).forEach((cookie) => {
        reply.header('set-cookie', cookie);
      });
    } else {
      const cookie = response.headers.get('set-cookie');
      if (cookie) reply.header('set-cookie', cookie);
    }

    reply.status(response.status);
    return reply.send(Buffer.from(await response.arrayBuffer()));
  });

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
    await protectedApi.register(registerCustomFieldRoutes);
    await protectedApi.register(registerSavedSearchRoutes);

    await protectedApi.register(fastifyTRPCPlugin, {
      prefix: '/api/trpc',
      trpcOptions: {
        router: appRouter,
        async createContext({ req, res }) {
          const user = await resolveRequestUser(req);
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
