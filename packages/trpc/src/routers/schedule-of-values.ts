import { z } from 'zod';
import { authenticatedProcedure, adminProcedure, router } from '../trpc';
import { SovService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';

const SovStatusEnum = z.enum(['DRAFT', 'ACTIVE', 'REVISED', 'CLOSED']);

const createSovSchema = z.object({
  projectId: z.string().uuid(),
  description: z.string().max(500).optional(),
  originalContractAmount: z.number().nonnegative(),
  defaultRetainagePercent: z.number().min(0).max(100).optional(),
  retainageCapAmount: z.number().nonnegative().optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const updateSovSchema = z.object({
  description: z.string().max(500).optional(),
  defaultRetainagePercent: z.number().min(0).max(100).optional(),
  retainageCapAmount: z.number().nonnegative().nullable().optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const createSovLineSchema = z.object({
  projectCostCodeId: z.string().uuid().optional(),
  lineNumber: z.number().int().positive().optional(),
  itemNumber: z.string().max(50).optional(),
  lineType: z.string().optional(),
  description: z.string().min(1).max(500),
  originalScheduledValue: z.number().nonnegative(),
  retainagePercent: z.number().min(0).max(100).optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  notes: z.string().max(2000).optional(),
});

const updateSovLineSchema = z.object({
  lineType: z.string().optional(),
  description: z.string().min(1).max(500).optional(),
  originalScheduledValue: z.number().nonnegative().optional(),
  retainagePercent: z.number().min(0).max(100).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const createChangeOrderSchema = z.object({
  changeOrderNumber: z.string().min(1).max(50),
  description: z.string().min(1).max(500),
  amount: z.number(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  externalReference: z.string().max(100).optional(),
  documentUrl: z.string().url().optional(),
  notes: z.string().max(2000).optional(),
});

const sovFiltersSchema = z
  .object({
    projectId: z.string().uuid().optional(),
    status: z.union([SovStatusEnum, z.array(SovStatusEnum)]).optional(),
    search: z.string().max(100).optional(),
  })
  .optional();

export const scheduleOfValuesRouter = router({
  // ========== SOV CRUD Routes ==========

  /**
   * List schedules of values with optional filters
   */
  list: authenticatedProcedure
    .input(
      z
        .object({
          page: z.number().int().positive().optional(),
          limit: z.number().int().positive().max(100).optional(),
          filters: sovFiltersSchema,
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new SovService(ctx.serviceContext);
      const filters = input?.filters || {};
      return service.list(
        { page: input?.page, limit: input?.limit },
        {
          projectId: filters.projectId,
          status: filters.status as any,
          search: filters.search,
        }
      );
    }),

  /**
   * Get a single SOV by ID
   */
  getById: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new SovService(ctx.serviceContext);
      const sov = await service.getById(input.id);

      if (!sov) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Schedule of Values not found',
        });
      }

      return sov;
    }),

  /**
   * Get active SOV for a project
   */
  getActiveByProject: authenticatedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new SovService(ctx.serviceContext);
      return service.getActiveByProject(input.projectId);
    }),

  /**
   * Create a new Schedule of Values
   */
  create: authenticatedProcedure.input(createSovSchema).mutation(async ({ ctx, input }) => {
    const service = new SovService(ctx.serviceContext);
    return service.create({
      organizationId: ctx.serviceContext.organizationId!,
      projectId: input.projectId,
      description: input.description,
      originalContractAmount: input.originalContractAmount,
      defaultRetainagePercent: input.defaultRetainagePercent,
      retainageCapAmount: input.retainageCapAmount,
      effectiveDate: input.effectiveDate,
    });
  }),

  /**
   * Update an existing SOV (DRAFT only)
   */
  update: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateSovSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new SovService(ctx.serviceContext);
      return service.update(input.id, input.data);
    }),

  /**
   * Update SOV status (activate, close, etc.)
   */
  updateStatus: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: SovStatusEnum,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new SovService(ctx.serviceContext);
      return service.updateStatus(input.id, input.status as any);
    }),

  /**
   * Delete an SOV (DRAFT only)
   */
  delete: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new SovService(ctx.serviceContext);
      await service.delete(input.id);
      return { success: true };
    }),

  // ========== SOV Line Routes ==========

  /**
   * Get lines for an SOV
   */
  getLines: authenticatedProcedure
    .input(z.object({ sovId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new SovService(ctx.serviceContext);
      return service.getLines(input.sovId);
    }),

  /**
   * Create a new SOV line
   */
  createLine: authenticatedProcedure
    .input(
      z.object({
        sovId: z.string().uuid(),
        line: createSovLineSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new SovService(ctx.serviceContext);
      return service.createLine(input.sovId, {
        lineNumber: input.line.lineNumber || 0,
        description: input.line.description,
        originalScheduledValue: input.line.originalScheduledValue,
        projectCostCodeId: input.line.projectCostCodeId,
        itemNumber: input.line.itemNumber,
        lineType: input.line.lineType,
        retainagePercent: input.line.retainagePercent,
        sortOrder: input.line.sortOrder,
        notes: input.line.notes,
      });
    }),

  /**
   * Update an SOV line (DRAFT SOV only)
   */
  updateLine: authenticatedProcedure
    .input(
      z.object({
        lineId: z.string().uuid(),
        data: updateSovLineSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new SovService(ctx.serviceContext);
      return service.updateLine(input.lineId, input.data);
    }),

  /**
   * Delete an SOV line (DRAFT SOV only)
   */
  deleteLine: authenticatedProcedure
    .input(z.object({ lineId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new SovService(ctx.serviceContext);
      await service.deleteLine(input.lineId);
      return { success: true };
    }),

  /**
   * Bulk create lines (e.g., from import)
   */
  bulkCreateLines: authenticatedProcedure
    .input(
      z.object({
        sovId: z.string().uuid(),
        lines: z.array(createSovLineSchema),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new SovService(ctx.serviceContext);
      return service.bulkCreateLines(
        input.sovId,
        input.lines.map((line, index) => ({
          lineNumber: line.lineNumber || index + 1,
          description: line.description,
          originalScheduledValue: line.originalScheduledValue,
          projectCostCodeId: line.projectCostCodeId,
          itemNumber: line.itemNumber,
          lineType: line.lineType,
          retainagePercent: line.retainagePercent,
          sortOrder: line.sortOrder,
          notes: line.notes,
        }))
      );
    }),

  // ========== Change Order Routes ==========

  /**
   * Get change orders for an SOV
   */
  getChangeOrders: authenticatedProcedure
    .input(z.object({ sovId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new SovService(ctx.serviceContext);
      return service.getChangeOrders(input.sovId);
    }),

  /**
   * Create a change order
   */
  createChangeOrder: authenticatedProcedure
    .input(
      z.object({
        sovId: z.string().uuid(),
        data: createChangeOrderSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new SovService(ctx.serviceContext);
      return service.createChangeOrder(input.sovId, {
        scheduleOfValuesId: input.sovId,
        changeOrderNumber: input.data.changeOrderNumber,
        description: input.data.description,
        amount: input.data.amount,
        effectiveDate: input.data.effectiveDate,
        externalReference: input.data.externalReference,
        documentUrl: input.data.documentUrl,
        notes: input.data.notes,
        lines: [],
      });
    }),

  /**
   * Approve a change order
   */
  approveChangeOrder: authenticatedProcedure
    .input(z.object({ changeOrderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new SovService(ctx.serviceContext);
      return service.approveChangeOrder(input.changeOrderId);
    }),

  // ========== G703 Export Routes ==========

  /**
   * Generate AIA G703 Continuation Sheet
   */
  generateG703: authenticatedProcedure
    .input(z.object({ sovId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new SovService(ctx.serviceContext);
      return service.generateG703(input.sovId);
    }),

  // ========== Validation Routes ==========

  /**
   * Validate an SOV
   */
  validate: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new SovService(ctx.serviceContext);
      return service.validate(input.id);
    }),

  // ========== Import Routes ==========

  /**
   * Import SOV from CSV (admin only)
   */
  import: adminProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        csvData: z.string(),
        hasHeaders: z.boolean().default(true),
        columnMapping: z.record(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new SovService(ctx.serviceContext);
      return service.import({
        organizationId: ctx.serviceContext.organizationId!,
        projectId: input.projectId,
        csvData: input.csvData,
        hasHeaders: input.hasHeaders,
        columnMapping: input.columnMapping,
      });
    }),
});
