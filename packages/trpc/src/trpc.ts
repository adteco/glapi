import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './context';
import superjson from 'superjson';
import { createContextualDb, verifyRLSContext } from '@glapi/database';
import type { ContextualDatabase } from '@glapi/database';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
 * 2. Validates the organizationId is a proper UUID format
 * 3. Creates a database connection with RLS context set
 * 4. CRITICAL: Verifies the RLS context was actually set correctly
 * 5. Ensures the connection is released after the procedure completes
 *
 * All queries through ctx.db will be automatically filtered by RLS policies.
 */
export const authenticatedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user?.organizationId || !ctx.serviceContext) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Organization context required',
    });
  }

  // Validate UUID format to prevent injection and ensure data integrity
  if (!UUID_REGEX.test(ctx.user.organizationId)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Invalid organization ID format',
    });
  }

  // Create a contextual database connection with RLS context set
  const { db: rlsDb, release, client } = await createContextualDb({
    organizationId: ctx.user.organizationId,
    userId: ctx.user.id,
  });

  try {
    // CRITICAL: Verify RLS context was actually set
    // This prevents any scenario where the context wasn't properly established
    const rlsContext = await verifyRLSContext(client);
    if (rlsContext.organizationId !== ctx.user.organizationId) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to establish organization security context',
      });
    }

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