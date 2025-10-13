import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { Database, schema } from '@glapi/database';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export interface Context {
  db: NodePgDatabase<typeof schema>;
  user?: {
    id: string;
    organizationId: string;
    email: string;
    role?: string;
  };
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure;

export type AppRouter = ReturnType<typeof router>;