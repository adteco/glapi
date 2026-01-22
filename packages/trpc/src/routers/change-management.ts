import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { ChangeManagementService } from '@glapi/api-service';

const createSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  requestType: z.string().optional(),
  subsystem: z.string().optional(),
  riskLevel: z.string().optional(),
  linkedResourceType: z.string().optional(),
  linkedResourceId: z.string().optional(),
  changeWindowStart: z.coerce.date().optional(),
  changeWindowEnd: z.coerce.date().optional(),
  metadata: z.record(z.any()).optional(),
});

export const changeManagementRouter = router({
  create: authenticatedProcedure
    .input(createSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ChangeManagementService(ctx.serviceContext);
      return service.createChangeRequest({
        title: input.title,
        description: input.description,
        requestType: input.requestType,
        subsystem: input.subsystem,
        riskLevel: input.riskLevel,
        linkedResourceType: input.linkedResourceType,
        linkedResourceId: input.linkedResourceId,
        changeWindowStart: input.changeWindowStart,
        changeWindowEnd: input.changeWindowEnd,
        metadata: input.metadata,
      });
    }),

  list: authenticatedProcedure
    .input(
      z
        .object({
          status: z
            .enum(['draft', 'pending_approval', 'approved', 'rejected', 'completed', 'cancelled'])
            .optional(),
          requestType: z.string().optional(),
          subsystem: z.string().optional(),
          page: z.number().min(1).optional(),
          limit: z.number().min(1).max(100).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input = {} }) => {
      const service = new ChangeManagementService(ctx.serviceContext);
      return service.listChangeRequests(input);
    }),

  get: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ChangeManagementService(ctx.serviceContext);
      const record = await service.getChangeRequest(input.id);
      if (!record) {
        throw new Error('Change request not found');
      }
      return record;
    }),

  submit: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ChangeManagementService(ctx.serviceContext);
      return service.submitChangeRequest(input.id);
    }),

  approve: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ChangeManagementService(ctx.serviceContext);
      return service.approveChangeRequest(input.id);
    }),

  reject: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ChangeManagementService(ctx.serviceContext);
      return service.rejectChangeRequest(input.id);
    }),

  complete: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ChangeManagementService(ctx.serviceContext);
      return service.completeChangeRequest(input.id);
    }),
});
