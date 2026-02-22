import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { DepartmentService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';
import { createReadOnlyAIMeta, createWriteAIMeta, createDeleteAIMeta } from '../ai-meta';

const departmentSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  subsidiaryId: z.string().uuid(),
  isActive: z.boolean().default(true),
});

export const departmentsRouter = router({
  list: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('list_departments', 'Search and list departments', {
      scopes: ['accounting', 'dimensions', 'global'],
      permissions: ['read:departments'],
    }) })
    .input(
      z.object({
        subsidiaryId: z.string().uuid().optional(),
        includeInactive: z.boolean().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new DepartmentService(ctx.serviceContext, { db: ctx.db });
      const result = await service.listDepartments(
        { page: 1, limit: 100 },
        'name',
        'asc',
        input?.subsidiaryId ? { subsidiaryId: input.subsidiaryId } : {}
      );
      return result.data;
    }),

  get: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('get_department', 'Get a single department by ID', {
      scopes: ['accounting', 'dimensions', 'global'],
      permissions: ['read:departments'],
    }) })
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new DepartmentService(ctx.serviceContext, { db: ctx.db });
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
    .meta({ ai: createWriteAIMeta('create_department', 'Create a new department', {
      scopes: ['accounting', 'dimensions'],
      permissions: ['write:departments'],
      riskLevel: 'MEDIUM',
    }) })
    .input(departmentSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new DepartmentService(ctx.serviceContext, { db: ctx.db });
      return service.createDepartment({
        ...input,
        organizationId: ctx.serviceContext!.organizationId,
      });
    }),

  update: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('update_department', 'Update an existing department', {
      scopes: ['accounting', 'dimensions'],
      permissions: ['write:departments'],
      riskLevel: 'MEDIUM',
    }) })
    .input(
      z.object({
        id: z.string().uuid(),
        data: departmentSchema.partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new DepartmentService(ctx.serviceContext, { db: ctx.db });
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
    .meta({ ai: createDeleteAIMeta('delete_department', 'Delete a department', {
      scopes: ['accounting'],
      permissions: ['delete:departments'],
      riskLevel: 'HIGH',
    }) })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new DepartmentService(ctx.serviceContext, { db: ctx.db });
      await service.deleteDepartment(input.id);
      return { success: true };
    }),
});