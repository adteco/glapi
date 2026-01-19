import { z } from 'zod';
import { router, authenticatedProcedure, adminProcedure } from '../trpc';
import { ProjectExpenseService } from '@glapi/api-service';
import {
  createProjectExpenseSchema,
  updateProjectExpenseSchema,
  projectExpenseFiltersSchema,
  createExpenseAttachmentSchema,
} from '@glapi/api-service';

export const projectExpensesRouter = router({
  list: authenticatedProcedure
    .input(
      z
        .object({
          page: z.number().int().positive().optional(),
          limit: z.number().int().positive().max(100).optional(),
          orderBy: z.enum(['expenseDate', 'createdAt', 'amount']).optional(),
          orderDirection: z.enum(['asc', 'desc']).optional(),
          filters: projectExpenseFiltersSchema.optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new ProjectExpenseService(ctx.serviceContext);
      return service.list(
        { page: input?.page, limit: input?.limit },
        input?.filters || {},
        input?.orderBy || 'expenseDate',
        input?.orderDirection || 'desc'
      );
    }),

  getById: authenticatedProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    const service = new ProjectExpenseService(ctx.serviceContext);
    return service.getById(input.id);
  }),

  create: authenticatedProcedure.input(createProjectExpenseSchema).mutation(async ({ ctx, input }) => {
    const service = new ProjectExpenseService(ctx.serviceContext);
    return service.create(input);
  }),

  update: authenticatedProcedure
    .input(z.object({ id: z.string().uuid(), data: updateProjectExpenseSchema }))
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectExpenseService(ctx.serviceContext);
      return service.update(input.id, input.data);
    }),

  delete: authenticatedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const service = new ProjectExpenseService(ctx.serviceContext);
    return service.delete(input.id);
  }),

  submit: authenticatedProcedure.input(z.object({ id: z.string().uuid(), comments: z.string().optional() })).mutation(async ({ ctx, input }) => {
    const service = new ProjectExpenseService(ctx.serviceContext);
    return service.changeStatus(input.id, 'SUBMITTED', input.comments);
  }),

  approve: authenticatedProcedure.input(z.object({ id: z.string().uuid(), comments: z.string().optional() })).mutation(async ({ ctx, input }) => {
    const service = new ProjectExpenseService(ctx.serviceContext);
    return service.changeStatus(input.id, 'APPROVED', input.comments);
  }),

  reject: authenticatedProcedure.input(z.object({ id: z.string().uuid(), reason: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    const service = new ProjectExpenseService(ctx.serviceContext);
    return service.changeStatus(input.id, 'REJECTED', input.reason);
  }),

  returnToDraft: authenticatedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const service = new ProjectExpenseService(ctx.serviceContext);
    return service.changeStatus(input.id, 'DRAFT');
  }),

  postToGL: adminProcedure
    .input(z.object({ expenseIds: z.array(z.string().uuid()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectExpenseService(ctx.serviceContext);
      return service.postToGL(input.expenseIds);
    }),

  listAttachments: authenticatedProcedure.input(z.object({ expenseId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const service = new ProjectExpenseService(ctx.serviceContext);
    return service.listAttachments(input.expenseId);
  }),

  addAttachment: authenticatedProcedure.input(createExpenseAttachmentSchema).mutation(async ({ ctx, input }) => {
    const service = new ProjectExpenseService(ctx.serviceContext);
    return service.addAttachment(input);
  }),

  deleteAttachment: authenticatedProcedure.input(z.object({ attachmentId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const service = new ProjectExpenseService(ctx.serviceContext);
    return service.deleteAttachment(input.attachmentId);
  }),
});
