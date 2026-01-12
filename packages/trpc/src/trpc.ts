import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './context';
import superjson from 'superjson';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const authenticatedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user?.organizationId || !ctx.serviceContext) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      organizationId: ctx.user.organizationId,
      serviceContext: ctx.serviceContext,
    },
  });
});

// Alias for backwards compatibility
export const protectedProcedure = authenticatedProcedure;

/**
 * Admin-only procedure - requires user to have 'admin' role
 * Use for sensitive operations like period close/lock, user management, etc.
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