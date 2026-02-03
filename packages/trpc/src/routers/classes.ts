import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { ClassService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';
import { createReadOnlyAIMeta, createWriteAIMeta, createDeleteAIMeta } from '../ai-meta';

const classSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  description: z.string().optional(),
  subsidiaryId: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const classesRouter = router({
  list: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('list_classes', 'Search and list accounting classes', {
      scopes: ['accounting', 'dimensions', 'global'],
      permissions: ['read:classes'],
    }) })
    .input(
      z.object({
        includeInactive: z.boolean().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new ClassService(ctx.serviceContext, { db: ctx.db });
      const result = await service.listClasses(
        { page: 1, limit: 100 },
        'name',
        'asc'
      );
      return result.data;
    }),

  get: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('get_class', 'Get a single accounting class by ID', {
      scopes: ['accounting', 'dimensions', 'global'],
      permissions: ['read:classes'],
    }) })
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ClassService(ctx.serviceContext, { db: ctx.db });
      const classItem = await service.getClassById(input.id);
      
      if (!classItem) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Class not found',
        });
      }
      
      return classItem;
    }),

  create: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('create_class', 'Create a new accounting class', {
      scopes: ['accounting', 'dimensions'],
      permissions: ['write:classes'],
      riskLevel: 'MEDIUM',
    }) })
    .input(classSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ClassService(ctx.serviceContext, { db: ctx.db });
      return service.createClass({
        ...input,
        organizationId: ctx.serviceContext!.organizationId,
        // TODO: This should come from form - using temp default for now
        subsidiaryId: input.subsidiaryId || '00000000-0000-0000-0000-000000000000',
      });
    }),

  update: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('update_class', 'Update an existing accounting class', {
      scopes: ['accounting', 'dimensions'],
      permissions: ['write:classes'],
      riskLevel: 'MEDIUM',
    }) })
    .input(
      z.object({
        id: z.string().uuid(),
        data: classSchema.partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new ClassService(ctx.serviceContext, { db: ctx.db });
      const updated = await service.updateClass(input.id, input.data);
      
      if (!updated) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Class not found',
        });
      }
      
      return updated;
    }),

  delete: authenticatedProcedure
    .meta({ ai: createDeleteAIMeta('delete_class', 'Delete an accounting class', {
      scopes: ['accounting'],
      permissions: ['delete:classes'],
      riskLevel: 'HIGH',
    }) })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ClassService(ctx.serviceContext, { db: ctx.db });
      await service.deleteClass(input.id);
      return { success: true };
    }),
});