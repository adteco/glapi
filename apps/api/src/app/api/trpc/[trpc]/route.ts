import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter, createContext } from '@glapi/trpc';
import { db } from '@glapi/database';
import { getServiceContext } from '../../../../../app/api/utils/auth';
import type { NextRequest } from 'next/server';

const handler = async (req: NextRequest) => {
  // Get the organization context from headers (set by middleware)
  const context = await getServiceContext();
  
  // Create a user object compatible with the API service types
  const user = {
    id: context.userId,
    organizationId: context.organizationId,
    email: null, // Would come from Clerk/auth provider
    role: 'user' as const,
  };

  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createContext({ 
      req: req as any,
      user,
      db 
    }),
    onError({ error, path }) {
      console.error(`tRPC error on ${path}:`, error);
    },
  });
};

export { handler as GET, handler as POST };