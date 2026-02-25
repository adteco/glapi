import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter, createContext } from '@glapi/trpc';
import { db } from '@glapi/database';
import { getOptionalServiceContext } from '../../utils/auth';
import type { NextRequest } from 'next/server';

const AUTH_DEBUG_LOGS = process.env.AUTH_DEBUG_LOGS === 'true';

const handler = async (req: NextRequest) => {
  // Resolve auth context if present. Missing auth must not crash the route.
  // Authenticated procedures will return UNAUTHORIZED through tRPC middleware.
  const context = await getOptionalServiceContext();

  if (AUTH_DEBUG_LOGS) {
    const headers = req.headers;
    console.info('[auth-debug][trpc-route] context_resolution', {
      path: req.nextUrl.pathname,
      query: req.nextUrl.searchParams.toString(),
      hasContext: Boolean(context),
      hasAuthorization: Boolean(
        headers.get('authorization') || headers.get('Authorization'),
      ),
      hasXOrganizationId: Boolean(headers.get('x-organization-id')),
      hasXUserId: Boolean(headers.get('x-user-id')),
      apiKeyName: headers.get('x-api-key-name') || null,
      resolvedOrganizationId: context?.organizationId ?? null,
      resolvedUserId: context?.userId ?? null,
    });
  }

  // Create a user object compatible with the tRPC User interface when auth exists.
  const user = context
    ? {
        id: context.userId,
        clerkId: context.clerkUserId,
        entityId: context.entityId,
        organizationId: context.organizationId,
        email: null, // Would come from Clerk/auth provider
        role: 'user' as const,
      }
    : null;

  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: ({ resHeaders }) => {
      // Add organization context headers for debugging and auditing
      // These are only set for authenticated requests
      if (context?.organizationId) {
        resHeaders.set('X-Organization-Id', context.organizationId);
        if (context.organizationName) {
          resHeaders.set('X-Organization-Name', context.organizationName);
        }
      }

      return createContext({
        req: req as any,
        resHeaders,
        user,
        db,
        organizationName: context?.organizationName,
      });
    },
    onError({ error, path }) {
      console.error(`tRPC error on ${path}:`, error);
    },
  });
};

export { handler as GET, handler as POST };
