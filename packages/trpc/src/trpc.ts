import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './context';

const t = initTRPC.context<Context>().create({
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