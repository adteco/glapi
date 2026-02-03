import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { ProjectTypeService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';
import { createReadOnlyAIMeta, createWriteAIMeta, createDeleteAIMeta } from '../ai-meta';

const createProjectTypeSchema = z.object({
  subsidiaryId: z.string().uuid().optional(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
});

const updateProjectTypeSchema = z.object({
  subsidiaryId: z.string().uuid().nullable().optional(),
  code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
});

const projectTypeFiltersSchema = z
  .object({
    subsidiaryId: z.string().uuid().optional(),
    isActive: z.boolean().optional(),
    search: z.string().optional(),
  })
  .optional();

export const projectTypesRouter = router({
  /**
   * List project types with pagination and filters
   */
  list: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('list_project_types', 'List project types with pagination and filters', {
      scopes: ['project-types', 'projects'],
      permissions: ['read:project-types'],
    }) })
    .input(
      z
        .object({
          page: z.number().int().positive().optional(),
          limit: z.number().int().positive().max(100).optional(),
          sortField: z.enum(['name', 'code', 'createdAt']).optional(),
          sortOrder: z.enum(['asc', 'desc']).optional(),
          filters: projectTypeFiltersSchema,
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new ProjectTypeService(ctx.serviceContext, { db: ctx.db });
      return service.listProjectTypes(
        {
          page: input?.page,
          limit: input?.limit,
          sortField: input?.sortField,
          sortOrder: input?.sortOrder,
        },
        input?.filters || {}
      );
    }),

  /**
   * Get a single project type by ID
   */
  get: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('get_project_type', 'Get a single project type by ID', {
      scopes: ['project-types', 'projects'],
      permissions: ['read:project-types'],
    }) })
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ProjectTypeService(ctx.serviceContext, { db: ctx.db });
      try {
        return await service.getProjectTypeById(input.id);
      } catch (error: any) {
        if (error.code === 'PROJECT_TYPE_NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Project type not found',
          });
        }
        throw error;
      }
    }),

  /**
   * Get a project type by code
   */
  getByCode: authenticatedProcedure
    .input(z.object({ code: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const service = new ProjectTypeService(ctx.serviceContext, { db: ctx.db });
      try {
        return await service.getProjectTypeByCode(input.code);
      } catch (error: any) {
        if (error.code === 'PROJECT_TYPE_NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Project type not found',
          });
        }
        throw error;
      }
    }),

  /**
   * Create a new project type
   * Requires permission: project_types.create
   */
  create: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('create_project_type', 'Create a new project type', {
      scopes: ['project-types', 'projects'],
      permissions: ['write:project-types'],
      riskLevel: 'LOW',
    }) })
    .input(createProjectTypeSchema)
    .mutation(async ({ ctx, input }) => {
      // TODO: Add permission check for project_types.create
      // if (!ctx.permissions?.includes('project_types.create')) {
      //   throw new TRPCError({
      //     code: 'FORBIDDEN',
      //     message: 'You do not have permission to create project types',
      //   });
      // }

      const service = new ProjectTypeService(ctx.serviceContext, { db: ctx.db });
      try {
        return await service.createProjectType({
          code: input.code,
          name: input.name,
          subsidiaryId: input.subsidiaryId,
          description: input.description,
          isActive: input.isActive,
        });
      } catch (error: any) {
        if (error.code === 'PROJECT_TYPE_CODE_EXISTS') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Find or create a project type (for on-the-fly creation in select menus)
   * This allows creating new project types when not found in the list
   * Requires permission: project_types.create for new types
   */
  findOrCreate: authenticatedProcedure
    .input(createProjectTypeSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectTypeService(ctx.serviceContext, { db: ctx.db });

      // First try to find by code
      const result = await service.findOrCreateProjectType({
        code: input.code,
        name: input.name,
        subsidiaryId: input.subsidiaryId,
        description: input.description,
        isActive: input.isActive ?? true,
      });

      // TODO: If created, verify permission
      // if (result.created && !ctx.permissions?.includes('project_types.create')) {
      //   // Rollback the creation
      //   await service.deleteProjectType(result.projectType.id);
      //   throw new TRPCError({
      //     code: 'FORBIDDEN',
      //     message: 'You do not have permission to create new project types',
      //   });
      // }

      return result;
    }),

  /**
   * Update a project type
   * Requires permission: project_types.update
   */
  update: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('update_project_type', 'Update a project type', {
      scopes: ['project-types', 'projects'],
      permissions: ['write:project-types'],
      riskLevel: 'LOW',
    }) })
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateProjectTypeSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // TODO: Add permission check for project_types.update
      // if (!ctx.permissions?.includes('project_types.update')) {
      //   throw new TRPCError({
      //     code: 'FORBIDDEN',
      //     message: 'You do not have permission to update project types',
      //   });
      // }

      const service = new ProjectTypeService(ctx.serviceContext, { db: ctx.db });
      try {
        return await service.updateProjectType(input.id, input.data);
      } catch (error: any) {
        if (error.code === 'PROJECT_TYPE_NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Project type not found',
          });
        }
        if (error.code === 'PROJECT_TYPE_CODE_EXISTS') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Delete a project type
   * Requires permission: project_types.delete
   */
  delete: authenticatedProcedure
    .meta({ ai: createDeleteAIMeta('delete_project_type', 'Delete a project type', {
      scopes: ['project-types', 'projects'],
      permissions: ['delete:project-types'],
      riskLevel: 'MEDIUM',
    }) })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // TODO: Add permission check for project_types.delete
      // if (!ctx.permissions?.includes('project_types.delete')) {
      //   throw new TRPCError({
      //     code: 'FORBIDDEN',
      //     message: 'You do not have permission to delete project types',
      //   });
      // }

      const service = new ProjectTypeService(ctx.serviceContext, { db: ctx.db });
      try {
        await service.deleteProjectType(input.id);
        return { success: true };
      } catch (error: any) {
        if (error.code === 'PROJECT_TYPE_NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Project type not found',
          });
        }
        throw error;
      }
    }),

  /**
   * Get project types for a specific subsidiary
   * Useful for filtering dropdowns by subsidiary context
   */
  listBySubsidiary: authenticatedProcedure
    .input(
      z.object({
        subsidiaryId: z.string().uuid(),
        activeOnly: z.boolean().optional().default(true),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new ProjectTypeService(ctx.serviceContext, { db: ctx.db });
      return service.getProjectTypesBySubsidiary(input.subsidiaryId, input.activeOnly);
    }),
});
