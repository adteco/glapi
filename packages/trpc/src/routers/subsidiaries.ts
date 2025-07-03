import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { SubsidiaryService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';

const subsidiarySchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  isActive: z.boolean().default(true),
});

export const subsidiariesRouter = router({
  list: authenticatedProcedure
    .input(
      z.object({
        includeInactive: z.boolean().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new SubsidiaryService(ctx.serviceContext);
      const result = await service.listSubsidiaries(
        { page: 1, limit: 100 },
        'name',
        'asc'
      );
      return result.data;
    }),

  get: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new SubsidiaryService(ctx.serviceContext);
      const subsidiary = await service.getSubsidiaryById(input.id);
      
      if (!subsidiary) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Subsidiary not found',
        });
      }
      
      return subsidiary;
    }),

  create: authenticatedProcedure
    .input(subsidiarySchema)
    .mutation(async ({ ctx, input }) => {
      const service = new SubsidiaryService(ctx.serviceContext);
      return service.createSubsidiary({
        ...input,
        organizationId: ctx.serviceContext!.organizationId,
      });
    }),

  update: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: subsidiarySchema.partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new SubsidiaryService(ctx.serviceContext);
      const updated = await service.updateSubsidiary(input.id, input.data);
      
      if (!updated) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Subsidiary not found',
        });
      }
      
      return updated;
    }),

  delete: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new SubsidiaryService(ctx.serviceContext);
      await service.deleteSubsidiary(input.id);
      return { success: true };
    }),
});