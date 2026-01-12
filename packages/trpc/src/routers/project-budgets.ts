import { z } from 'zod';
import { authenticatedProcedure, adminProcedure, router } from '../trpc';
import { ProjectBudgetService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';

const BudgetVersionStatusEnum = z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'LOCKED', 'SUPERSEDED']);

const createVersionSchema = z.object({
  projectId: z.string().uuid(),
  versionName: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateVersionSchema = z.object({
  versionName: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

const versionFiltersSchema = z.object({
  projectId: z.string().uuid().optional(),
  status: z.union([BudgetVersionStatusEnum, z.array(BudgetVersionStatusEnum)]).optional(),
  isCurrent: z.boolean().optional(),
}).optional();

const createLineSchema = z.object({
  projectCostCodeId: z.string().uuid(),
  description: z.string().max(500).optional(),
  originalBudgetAmount: z.string().regex(/^-?\d+(\.\d{1,4})?$/),
  budgetUnits: z.string().optional(),
  unitOfMeasure: z.string().max(50).optional(),
  unitRate: z.string().regex(/^-?\d+(\.\d{1,6})?$/).optional(),
  notes: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateLineSchema = z.object({
  description: z.string().max(500).nullable().optional(),
  originalBudgetAmount: z.string().regex(/^-?\d+(\.\d{1,4})?$/).optional(),
  revisedBudgetAmount: z.string().regex(/^-?\d+(\.\d{1,4})?$/).optional(),
  approvedChanges: z.string().regex(/^-?\d+(\.\d{1,4})?$/).optional(),
  pendingChanges: z.string().regex(/^-?\d+(\.\d{1,4})?$/).optional(),
  forecastAmount: z.string().regex(/^-?\d+(\.\d{1,4})?$/).optional(),
  estimateToComplete: z.string().regex(/^-?\d+(\.\d{1,4})?$/).optional(),
  budgetUnits: z.string().nullable().optional(),
  actualUnits: z.string().nullable().optional(),
  unitOfMeasure: z.string().max(50).nullable().optional(),
  unitRate: z.string().regex(/^-?\d+(\.\d{1,6})?$/).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

const importBudgetRowSchema = z.object({
  costCode: z.string().min(1),
  description: z.string().optional(),
  budgetAmount: z.union([z.string(), z.number()]),
  budgetUnits: z.union([z.string(), z.number()]).optional(),
  unitOfMeasure: z.string().optional(),
  unitRate: z.union([z.string(), z.number()]).optional(),
  notes: z.string().optional(),
});

const importOptionsSchema = z.object({
  projectId: z.string().uuid(),
  versionName: z.string().min(1),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description: z.string().optional(),
  skipInvalidRows: z.boolean().default(false),
  createMissingCostCodes: z.boolean().default(false),
});

export const projectBudgetsRouter = router({
  // ========== Budget Version Routes ==========

  /**
   * List budget versions with optional filters
   */
  listVersions: authenticatedProcedure
    .input(
      z.object({
        page: z.number().int().positive().optional(),
        limit: z.number().int().positive().max(100).optional(),
        orderBy: z.enum(['versionNumber', 'versionName', 'status', 'createdAt', 'effectiveDate']).optional(),
        orderDirection: z.enum(['asc', 'desc']).optional(),
        filters: versionFiltersSchema,
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new ProjectBudgetService(ctx.serviceContext);
      return service.listVersions(
        { page: input?.page, limit: input?.limit },
        input?.filters || {},
        input?.orderBy || 'versionNumber',
        input?.orderDirection || 'desc'
      );
    }),

  /**
   * Get a single budget version by ID
   */
  getVersion: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ProjectBudgetService(ctx.serviceContext);
      const version = await service.getVersionById(input.id);

      if (!version) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Budget version not found',
        });
      }

      return version;
    }),

  /**
   * Get current budget version for a project
   */
  getCurrentVersion: authenticatedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ProjectBudgetService(ctx.serviceContext);
      return service.getCurrentVersion(input.projectId);
    }),

  /**
   * Create a new budget version
   */
  createVersion: authenticatedProcedure
    .input(createVersionSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectBudgetService(ctx.serviceContext);
      return service.createVersion(input);
    }),

  /**
   * Update a budget version (DRAFT only)
   */
  updateVersion: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateVersionSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectBudgetService(ctx.serviceContext);
      return service.updateVersion(input.id, input.data);
    }),

  /**
   * Update budget version status (workflow transitions)
   */
  updateVersionStatus: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: BudgetVersionStatusEnum,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectBudgetService(ctx.serviceContext);
      return service.updateVersionStatus(input.id, { status: input.status });
    }),

  /**
   * Set a version as the current budget for a project (admin only)
   */
  setCurrentVersion: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectBudgetService(ctx.serviceContext);
      return service.setCurrentVersion(input.id);
    }),

  /**
   * Copy a budget version to create a new draft
   */
  copyVersion: authenticatedProcedure
    .input(
      z.object({
        sourceVersionId: z.string().uuid(),
        newVersionName: z.string().min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectBudgetService(ctx.serviceContext);
      return service.copyVersion(input);
    }),

  /**
   * Delete a budget version (DRAFT only)
   */
  deleteVersion: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectBudgetService(ctx.serviceContext);
      await service.deleteVersion(input.id);
      return { success: true };
    }),

  // ========== Budget Line Routes ==========

  /**
   * Get budget lines for a version
   */
  getVersionLines: authenticatedProcedure
    .input(z.object({ budgetVersionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ProjectBudgetService(ctx.serviceContext);
      return service.getVersionLines(input.budgetVersionId);
    }),

  /**
   * Get budget lines with cost code details
   */
  getVersionLinesWithCostCodes: authenticatedProcedure
    .input(z.object({ budgetVersionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ProjectBudgetService(ctx.serviceContext);
      return service.getVersionLinesWithCostCodes(input.budgetVersionId);
    }),

  /**
   * Create a budget line
   */
  createLine: authenticatedProcedure
    .input(
      z.object({
        budgetVersionId: z.string().uuid(),
        line: createLineSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectBudgetService(ctx.serviceContext);
      return service.createLine(input.budgetVersionId, input.line);
    }),

  /**
   * Update a budget line (DRAFT version only)
   */
  updateLine: authenticatedProcedure
    .input(
      z.object({
        lineId: z.string().uuid(),
        data: updateLineSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectBudgetService(ctx.serviceContext);
      return service.updateLine(input.lineId, input.data);
    }),

  /**
   * Delete a budget line (DRAFT version only)
   */
  deleteLine: authenticatedProcedure
    .input(z.object({ lineId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectBudgetService(ctx.serviceContext);
      await service.deleteLine(input.lineId);
      return { success: true };
    }),

  // ========== Import Routes ==========

  /**
   * Import budget from CSV data (admin only)
   */
  import: adminProcedure
    .input(
      z.object({
        options: importOptionsSchema,
        rows: z.array(importBudgetRowSchema),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectBudgetService(ctx.serviceContext);
      // Transform numeric values to strings
      const transformedRows = input.rows.map((row) => ({
        ...row,
        budgetAmount: String(row.budgetAmount),
        budgetUnits: row.budgetUnits !== undefined ? String(row.budgetUnits) : undefined,
        unitRate: row.unitRate !== undefined ? String(row.unitRate) : undefined,
      }));
      return service.importBudget(input.options, transformedRows);
    }),

  // ========== Reporting Routes ==========

  /**
   * Get variance summary for a budget version
   */
  getVarianceSummary: authenticatedProcedure
    .input(z.object({ budgetVersionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ProjectBudgetService(ctx.serviceContext);
      return service.getVarianceSummary(input.budgetVersionId);
    }),
});
