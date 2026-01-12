import { z } from 'zod';
import { authenticatedProcedure, adminProcedure, router } from '../trpc';
import { ProjectCostCodeService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';

const CostCodeTypeEnum = z.enum(['LABOR', 'MATERIAL', 'EQUIPMENT', 'SUBCONTRACT', 'OTHER']);

const createCostCodeSchema = z.object({
  projectId: z.string().uuid(),
  parentCostCodeId: z.string().uuid().optional(),
  activityCodeId: z.string().uuid().optional(),
  costCode: z.string().min(1).max(50),
  costType: CostCodeTypeEnum,
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  isBillable: z.boolean().default(true),
  revenueAccountId: z.string().uuid().optional(),
  costAccountId: z.string().uuid().optional(),
  wipAccountId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateCostCodeSchema = z.object({
  costCode: z.string().min(1).max(50).optional(),
  costType: CostCodeTypeEnum.optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  isBillable: z.boolean().optional(),
  parentCostCodeId: z.string().uuid().nullable().optional(),
  activityCodeId: z.string().uuid().nullable().optional(),
  revenueAccountId: z.string().uuid().nullable().optional(),
  costAccountId: z.string().uuid().nullable().optional(),
  wipAccountId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

const costCodeFiltersSchema = z.object({
  projectId: z.string().uuid().optional(),
  costType: z.union([CostCodeTypeEnum, z.array(CostCodeTypeEnum)]).optional(),
  isActive: z.boolean().optional(),
  isBillable: z.boolean().optional(),
  parentCostCodeId: z.string().uuid().nullable().optional(),
  search: z.string().optional(),
}).optional();

const importCostCodeRowSchema = z.object({
  costCode: z.string().min(1),
  parentCostCode: z.string().optional(),
  costType: CostCodeTypeEnum,
  name: z.string().min(1),
  description: z.string().optional(),
  isBillable: z.union([z.boolean(), z.string()]).default(true),
});

export const projectCostCodesRouter = router({
  /**
   * List cost codes with optional filters
   */
  list: authenticatedProcedure
    .input(
      z.object({
        page: z.number().int().positive().optional(),
        limit: z.number().int().positive().max(100).optional(),
        orderBy: z.enum(['costCode', 'name', 'sortOrder', 'createdAt']).optional(),
        orderDirection: z.enum(['asc', 'desc']).optional(),
        filters: costCodeFiltersSchema,
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new ProjectCostCodeService(ctx.serviceContext);
      return service.listCostCodes(
        { page: input?.page, limit: input?.limit },
        input?.filters || {},
        input?.orderBy || 'sortOrder',
        input?.orderDirection || 'asc'
      );
    }),

  /**
   * Get a single cost code by ID
   */
  get: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ProjectCostCodeService(ctx.serviceContext);
      const costCode = await service.getCostCodeById(input.id);

      if (!costCode) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Cost code not found',
        });
      }

      return costCode;
    }),

  /**
   * Get cost codes as a tree structure for a project
   */
  getTree: authenticatedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ProjectCostCodeService(ctx.serviceContext);
      return service.getCostCodeTree(input.projectId);
    }),

  /**
   * Get children of a cost code
   */
  getChildren: authenticatedProcedure
    .input(z.object({ parentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ProjectCostCodeService(ctx.serviceContext);
      return service.getCostCodeChildren(input.parentId);
    }),

  /**
   * Get cost type summary for a project
   */
  getCostTypeSummary: authenticatedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ProjectCostCodeService(ctx.serviceContext);
      return service.getCostTypeSummary(input.projectId);
    }),

  /**
   * Create a new cost code
   */
  create: authenticatedProcedure
    .input(createCostCodeSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectCostCodeService(ctx.serviceContext);
      return service.createCostCode(input);
    }),

  /**
   * Update a cost code
   */
  update: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateCostCodeSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectCostCodeService(ctx.serviceContext);
      return service.updateCostCode(input.id, input.data);
    }),

  /**
   * Delete (deactivate) a cost code
   */
  delete: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectCostCodeService(ctx.serviceContext);
      await service.deleteCostCode(input.id);
      return { success: true };
    }),

  /**
   * Import cost codes from CSV data (admin only)
   */
  import: adminProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        rows: z.array(importCostCodeRowSchema),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectCostCodeService(ctx.serviceContext);
      // Transform isBillable from string|boolean to boolean
      const transformedRows = input.rows.map((row) => ({
        ...row,
        isBillable: typeof row.isBillable === 'string'
          ? row.isBillable.toLowerCase() === 'true'
          : row.isBillable,
      }));
      return service.importCostCodes(input.projectId, transformedRows);
    }),
});
