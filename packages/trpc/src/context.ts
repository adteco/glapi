import type { CreateNextContextOptions } from '@trpc/server/adapters/next';

export interface User {
  id: string;
  organizationId: string;
  email: string | null;
  role: 'user' | 'admin';
}

export interface ServiceContext {
  organizationId: string;
  userId: string;
}

export interface CreateContextOptions {
  req?: CreateNextContextOptions['req'];
  res?: CreateNextContextOptions['res'];
  resHeaders?: Headers; // Response headers for fetch adapter
  user?: User | null;
  db?: any; // We'll type this properly in the API app
  organizationName?: string | null; // Organization name for debugging headers
}

export async function createContext(opts: CreateContextOptions) {
  const { req, res, resHeaders, user, db, organizationName } = opts;

  // Create service context from user info
  const serviceContext: ServiceContext | undefined = user ? {
    organizationId: user.organizationId,
    userId: user.id,
  } : undefined;

  return {
    req,
    res,
    resHeaders,
    user,
    db,
    serviceContext,
    organizationName,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;