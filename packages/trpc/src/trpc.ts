import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './context';
import superjson from 'superjson';
import { createContextualDb } from '@glapi/database';
import type { ContextualDatabase } from '@glapi/database';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Authenticated procedure with RLS context.
 *
 * This middleware:
 * 1. Validates the user is authenticated with an organizationId
 * 2. Creates a database connection with RLS context set
 * 3. Ensures the connection is released after the procedure completes
 *
 * All queries through ctx.db will be automatically filtered by RLS policies.
 */
export const authenticatedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user?.organizationId || !ctx.serviceContext) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }

  // Create a contextual database connection with RLS context set
  const { db: rlsDb, release } = await createContextualDb({
    organizationId: ctx.user.organizationId,
    userId: ctx.user.id,
  });

  try {
    const result = await next({
      ctx: {
        ...ctx,
        // Override db with RLS-protected connection
        db: rlsDb as typeof ctx.db,
        user: ctx.user,
        organizationId: ctx.user.organizationId,
        serviceContext: ctx.serviceContext,
      },
    });
    return result;
  } finally {
    // Always release the connection back to the pool
    release();
  }
});

// Alias for backwards compatibility
export const protectedProcedure = authenticatedProcedure;

/**
 * Admin-only procedure - requires user to have 'admin' role
 * Use for sensitive operations like period close/lock, user management, etc.
 *
 * Note: RLS context is already set by the authenticatedProcedure middleware.
 */
export const adminProcedure = authenticatedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user?.role !== 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'This operation requires administrator privileges',
    });
  }

  return next({ ctx });
});

export const middleware = t.middleware;
export const createCallerFactory = t.createCallerFactory;