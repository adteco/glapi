import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { DepartmentService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';

const departmentSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  subsidiaryId: z.string().uuid(),
  isActive: z.boolean().default(true),
});

export const departmentsRouter = router({
  list: authenticatedProcedure
    .input(
      z.object({
        subsidiaryId: z.string().uuid().optional(),
        includeInactive: z.boolean().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new DepartmentService(ctx.serviceContext);
      const result = await service.listDepartments(
        { page: 1, limit: 100 },
        'name',
        'asc',
        input?.subsidiaryId ? { subsidiaryId: input.subsidiaryId } : {}
      );
      return result.data;
    }),

  get: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new DepartmentService(ctx.serviceContext);
      const department = await service.getDepartmentById(input.id);
      
      if (!department) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Department not found',
        });
      }
      
      return department;
    }),

  create: authenticatedProcedure
    .input(departmentSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new DepartmentService(ctx.serviceContext);
      return service.createDepartment({
        ...input,
        organizationId: ctx.serviceContext!.organizationId,
      });
    }),

  update: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: departmentSchema.partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new DepartmentService(ctx.serviceContext);
      const updated = await service.updateDepartment(input.id, input.data);
      
      if (!updated) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Department not found',
        });
      }
      
      return updated;
    }),

  delete: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new DepartmentService(ctx.serviceContext);
      await service.deleteDepartment(input.id);
      return { success: true };
    }),
});