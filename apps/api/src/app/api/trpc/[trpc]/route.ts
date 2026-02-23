import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter, createContext } from '@glapi/trpc';
import { db } from '@glapi/database';
import { getOptionalServiceContext } from '../../../../../app/api/utils/auth';
import type { NextRequest } from 'next/server';

const handler = async (req: NextRequest) => {
  // Resolve auth context if present. Missing auth must not crash the route.
  // Authenticated procedures will return UNAUTHORIZED through tRPC middleware.
  const context = await getOptionalServiceContext();

  // Create a user object compatible with the tRPC context types when auth exists.
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
