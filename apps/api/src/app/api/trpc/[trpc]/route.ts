import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter, createContext } from '@glapi/trpc';
import { db } from '@glapi/database';
import { getServiceContext } from '../../../../../app/api/utils/auth';
import type { NextRequest } from 'next/server';

const handler = async (req: NextRequest) => {
  // Get the organization context from headers (set by middleware)
  const context = await getServiceContext();

  // Create a user object compatible with the tRPC context types
  // Uses branded types from @glapi/shared-types for type safety
  const user = {
    clerkId: context.clerkUserId,
    entityId: context.entityId,
    organizationId: context.organizationId,
    email: null, // Would come from Clerk/auth provider
    role: 'user' as const,
    // Deprecated alias - kept for backward compatibility
    id: context.clerkUserId,
  };

  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: ({ resHeaders }) => {
      // Add organization context headers for debugging and auditing
      // These are only set for authenticated requests
      if (context.organizationId) {
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
        organizationName: context.organizationName,
      });
    },
    onError({ error, path }) {
      console.error(`tRPC error on ${path}:`, error);
    },
  });
};

export { handler as GET, handler as POST };