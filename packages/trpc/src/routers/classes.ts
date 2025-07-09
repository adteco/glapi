import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { ClassService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';

const classSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  description: z.string().optional(),
  subsidiaryId: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const classesRouter = router({
  list: authenticatedProcedure
    .input(
      z.object({
        includeInactive: z.boolean().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new ClassService(ctx.serviceContext);
      const result = await service.listClasses(
        { page: 1, limit: 100 },
        'name',
        'asc'
      );
      return result.data;
    }),

  get: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ClassService(ctx.serviceContext);
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
    .input(classSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ClassService(ctx.serviceContext);
      return service.createClass({
        ...input,
        organizationId: ctx.serviceContext!.organizationId,
        // TODO: This should come from form - using temp default for now
        subsidiaryId: input.subsidiaryId || '00000000-0000-0000-0000-000000000000',
      });
    }),

  update: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: classSchema.partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new ClassService(ctx.serviceContext);
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
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ClassService(ctx.serviceContext);
      await service.deleteClass(input.id);
      return { success: true };
    }),
});