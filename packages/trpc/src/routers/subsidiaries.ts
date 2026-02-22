import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { SubsidiaryService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';
import { createReadOnlyAIMeta, createWriteAIMeta, createDeleteAIMeta } from '../ai-meta';

const subsidiarySchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const subsidiariesRouter = router({
  list: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('list_subsidiaries', 'Search and list subsidiaries', {
      scopes: ['accounting', 'dimensions', 'global'],
      permissions: ['read:subsidiaries'],
    }) })
    .input(
      z.object({
        includeInactive: z.boolean().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new SubsidiaryService(ctx.serviceContext, { db: ctx.db });
      const result = await service.listSubsidiaries(
        { page: 1, limit: 100 },
        'name',
        'asc'
      );
      return result.data;
    }),

  get: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('get_subsidiary', 'Get a single subsidiary by ID', {
      scopes: ['accounting', 'dimensions', 'global'],
      permissions: ['read:subsidiaries'],
    }) })
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new SubsidiaryService(ctx.serviceContext, { db: ctx.db });
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
    .meta({ ai: createWriteAIMeta('create_subsidiary', 'Create a new subsidiary', {
      scopes: ['accounting', 'dimensions'],
      permissions: ['write:subsidiaries'],
      riskLevel: 'HIGH',
      minimumRole: 'admin',
    }) })
    .input(subsidiarySchema)
    .mutation(async ({ ctx, input }) => {
      const service = new SubsidiaryService(ctx.serviceContext, { db: ctx.db });
      return service.createSubsidiary({
        ...input,
        organizationId: ctx.serviceContext!.organizationId,
      });
    }),

  update: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('update_subsidiary', 'Update an existing subsidiary', {
      scopes: ['accounting', 'dimensions'],
      permissions: ['write:subsidiaries'],
      riskLevel: 'HIGH',
      minimumRole: 'admin',
    }) })
    .input(
      z.object({
        id: z.string().uuid(),
        data: subsidiarySchema.partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new SubsidiaryService(ctx.serviceContext, { db: ctx.db });
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
    .meta({ ai: createDeleteAIMeta('delete_subsidiary', 'Delete a subsidiary', {
      scopes: ['accounting'],
      permissions: ['delete:subsidiaries'],
      riskLevel: 'HIGH',
      minimumRole: 'admin',
    }) })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new SubsidiaryService(ctx.serviceContext, { db: ctx.db });
      await service.deleteSubsidiary(input.id);
      return { success: true };
    }),
});