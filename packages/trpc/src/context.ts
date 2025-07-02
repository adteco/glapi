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
  user?: User | null;
  db?: any; // We'll type this properly in the API app
}

export async function createContext(opts: CreateContextOptions) {
  const { req, res, user, db } = opts;
  
  // Create service context from user info
  const serviceContext: ServiceContext | undefined = user ? {
    organizationId: user.organizationId,
    userId: user.id,
  } : undefined;

  return {
    req,
    res,
    user,
    db,
    serviceContext,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;