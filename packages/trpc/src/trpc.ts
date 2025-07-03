import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './context';

// Use require for superjson to avoid ESM/CommonJS issues
const superjson = require('superjson');

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

export const middleware = t.middleware;
export const createCallerFactory = t.createCallerFactory;