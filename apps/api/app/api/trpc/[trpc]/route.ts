import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter, createContext } from '@glapi/trpc';
import { db } from '@glapi/database';
import { AuthenticationError, getServiceContext } from '../../utils/auth';
import type { NextRequest } from 'next/server';

const handler = async (req: NextRequest) => {
  let context;
  try {
    // Get the organization context from headers (set by middleware)
    context = await getServiceContext();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      console.warn('[trpc] Authentication rejected request', {
        path: req.nextUrl.pathname,
        query: req.nextUrl.search,
        message: error.message,
      });

      return new Response(
        JSON.stringify({
          error: {
            code: 'UNAUTHORIZED',
            message: error.message,
          },
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    throw error;
  }

  // Create a user object compatible with the tRPC User interface
  // Must include clerkId and entityId for proper serviceContext creation
  const user = {
    id: context.userId,
    clerkId: context.clerkUserId,
    entityId: context.entityId,
    organizationId: context.organizationId,
    email: null, // Would come from Clerk/auth provider
    role: 'user' as const,
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
