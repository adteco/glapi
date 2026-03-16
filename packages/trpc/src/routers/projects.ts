import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { ProjectService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';
import { createReadOnlyAIMeta, createWriteAIMeta, createDeleteAIMeta } from '../ai-meta';
import { ProjectStatusEnum } from '@glapi/types';

const projectBillingModelEnum = z.enum([
  'fixed_fee',
  'time_and_materials',
]);

const createProjectSchema = z.object({
  subsidiaryId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  projectCode: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  status: ProjectStatusEnum.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  jobNumber: z.string().max(50).optional(),
  projectType: z.string().max(50).optional(),
  billingModel: projectBillingModelEnum.optional(),
  budgetRevenue: z.string().optional(),
  budgetCost: z.string().optional(),
  retainagePercent: z.string().optional(),
  currencyCode: z.string().max(10).optional(),
  description: z.string().max(2000).optional(),
  externalSource: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateProjectSchema = z.object({
  subsidiaryId: z.string().uuid().optional(),
  customerId: z.string().uuid().nullable().optional(),
  projectCode: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(200).optional(),
  status: ProjectStatusEnum.optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  jobNumber: z.string().max(50).nullable().optional(),
  projectType: z.string().max(50).nullable().optional(),
  billingModel: projectBillingModelEnum.optional(),
  budgetRevenue: z.string().nullable().optional(),
  budgetCost: z.string().nullable().optional(),
  percentComplete: z.string().nullable().optional(),
  retainagePercent: z.string().optional(),
  currencyCode: z.string().max(10).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  externalSource: z.string().max(100).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const projectFiltersSchema = z
  .object({
    subsidiaryId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    status: z.union([ProjectStatusEnum, z.array(ProjectStatusEnum)]).optional(),
    projectType: z.string().optional(),
    billingModel: projectBillingModelEnum.optional(),
    search: z.string().optional(),
    startDateFrom: z.string().optional(),
    startDateTo: z.string().optional(),
  })
  .optional();

const createParticipantSchema = z.object({
  entityId: z.string().uuid().optional(),
  participantRole: z.string().min(1).max(50),
  isPrimary: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateParticipantSchema = z.object({
  entityId: z.string().uuid().optional(),
  participantRole: z.string().min(1).max(50).optional(),
  isPrimary: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const projectsRouter = router({
  /**
   * List projects with pagination and filters
   */
  list: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('list_projects', 'Search and list construction/job projects', {
      scopes: ['projects', 'construction', 'global'],
      permissions: ['read:projects'],
    }) })
    .input(
      z
        .object({
          page: z.number().int().positive().optional(),
          limit: z.number().int().positive().max(1000).optional(),
          orderBy: z
            .enum(['name', 'projectCode', 'status', 'startDate', 'createdAt'])
            .optional(),
          orderDirection: z.enum(['asc', 'desc']).optional(),
          filters: projectFiltersSchema,
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new ProjectService(ctx.serviceContext, { db: ctx.db });
      return service.listProjects(
        {
          page: input?.page,
          limit: input?.limit,
          orderBy: input?.orderBy,
          orderDirection: input?.orderDirection,
        },
        input?.filters || {}
      );
    }),

  /**
   * Get a single project by ID
   */
  get: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('get_project', 'Get a single project by ID', {
      scopes: ['projects', 'construction', 'global'],
      permissions: ['read:projects'],
    }) })
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ProjectService(ctx.serviceContext, { db: ctx.db });
      try {
        return await service.getProjectById(input.id);
      } catch (error: any) {
        if (error.code === 'PROJECT_NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Project not found',
          });
        }
        throw error;
      }
    }),

  /**
   * Get a project by code
   */
  getByCode: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('get_project_by_code', 'Get a project by its project code', {
      scopes: ['projects', 'construction'],
      permissions: ['read:projects'],
    }) })
    .input(z.object({ projectCode: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const service = new ProjectService(ctx.serviceContext, { db: ctx.db });
      try {
        return await service.getProjectByCode(input.projectCode);
      } catch (error: any) {
        if (error.code === 'PROJECT_NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Project not found',
          });
        }
        throw error;
      }
    }),

  /**
   * Create a new project
   */
  create: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('create_project', 'Create a new construction/job project', {
      scopes: ['projects', 'construction'],
      permissions: ['write:projects'],
      riskLevel: 'MEDIUM',
    }) })
    .input(createProjectSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectService(ctx.serviceContext, { db: ctx.db });
      try {
        return await service.createProject({
          projectCode: input.projectCode,
          name: input.name,
          subsidiaryId: input.subsidiaryId,
          customerId: input.customerId,
          status: input.status,
          startDate: input.startDate,
          endDate: input.endDate,
          jobNumber: input.jobNumber,
          projectType: input.projectType,
          billingModel: input.billingModel,
          budgetRevenue: input.budgetRevenue,
          budgetCost: input.budgetCost,
          retainagePercent: input.retainagePercent,
          currencyCode: input.currencyCode,
          description: input.description,
          externalSource: input.externalSource,
          metadata: input.metadata,
        });
      } catch (error: any) {
        if (error.code === 'PROJECT_CODE_EXISTS') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: error.message,
          });
        }
        if (error.code === 'INVALID_DATE_RANGE') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Update a project
   */
  update: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('update_project', 'Update an existing project', {
      scopes: ['projects', 'construction'],
      permissions: ['write:projects'],
      riskLevel: 'MEDIUM',
    }) })
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateProjectSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectService(ctx.serviceContext, { db: ctx.db });
      try {
        return await service.updateProject(input.id, input.data);
      } catch (error: any) {
        if (error.code === 'PROJECT_NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Project not found',
          });
        }
        if (error.code === 'PROJECT_CODE_EXISTS') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: error.message,
          });
        }
        if (error.code === 'INVALID_DATE_RANGE') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Delete a project
   */
  delete: authenticatedProcedure
    .meta({ ai: createDeleteAIMeta('delete_project', 'Delete a project', {
      scopes: ['projects'],
      permissions: ['delete:projects'],
      riskLevel: 'HIGH',
      minimumRole: 'manager',
    }) })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectService(ctx.serviceContext, { db: ctx.db });
      try {
        await service.deleteProject(input.id);
        return { success: true };
      } catch (error: any) {
        if (error.code === 'PROJECT_NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Project not found',
          });
        }
        throw error;
      }
    }),

  // ========== Participant Endpoints ==========

  /**
   * List participants for a project
   */
  listParticipants: authenticatedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ProjectService(ctx.serviceContext, { db: ctx.db });
      try {
        return await service.listParticipants(input.projectId);
      } catch (error: any) {
        if (error.code === 'PROJECT_NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Project not found',
          });
        }
        throw error;
      }
    }),

  /**
   * Add a participant to a project
   */
  addParticipant: authenticatedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        data: createParticipantSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectService(ctx.serviceContext, { db: ctx.db });
      try {
        return await service.addParticipant(input.projectId, {
          participantRole: input.data.participantRole,
          entityId: input.data.entityId,
          isPrimary: input.data.isPrimary,
          metadata: input.data.metadata,
        });
      } catch (error: any) {
        if (error.code === 'PROJECT_NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Project not found',
          });
        }
        if (error.code === 'PARTICIPANT_EXISTS') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Update a participant
   */
  updateParticipant: authenticatedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        participantId: z.string().uuid(),
        data: updateParticipantSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectService(ctx.serviceContext, { db: ctx.db });
      try {
        return await service.updateParticipant(
          input.projectId,
          input.participantId,
          input.data
        );
      } catch (error: any) {
        if (
          error.code === 'PROJECT_NOT_FOUND' ||
          error.code === 'PARTICIPANT_NOT_FOUND'
        ) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Remove a participant from a project
   */
  removeParticipant: authenticatedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        participantId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectService(ctx.serviceContext, { db: ctx.db });
      try {
        await service.removeParticipant(input.projectId, input.participantId);
        return { success: true };
      } catch (error: any) {
        if (
          error.code === 'PROJECT_NOT_FOUND' ||
          error.code === 'PARTICIPANT_NOT_FOUND'
        ) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message,
          });
        }
        throw error;
      }
    }),
});
