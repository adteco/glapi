import { z } from 'zod';
import { authenticatedProcedure, adminProcedure, router } from '../trpc';
import { TimeEntryService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';

const TimeEntryStatusEnum = z.enum([
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'POSTED',
  'CANCELLED',
]);

const TimeEntryTypeEnum = z.enum([
  'REGULAR',
  'OVERTIME',
  'DOUBLE_TIME',
  'PTO',
  'SICK',
  'HOLIDAY',
  'OTHER',
]);

const createTimeEntrySchema = z.object({
  employeeId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  costCodeId: z.string().uuid().optional(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Entry date must be YYYY-MM-DD format'),
  hours: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Hours must be a positive number'),
  entryType: TimeEntryTypeEnum.default('REGULAR'),
  description: z.string().max(500).optional(),
  internalNotes: z.string().max(2000).optional(),
  isBillable: z.boolean().default(true),
  externalId: z.string().max(100).optional(),
  externalSource: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateTimeEntrySchema = z.object({
  projectId: z.string().uuid().nullable().optional(),
  costCodeId: z.string().uuid().nullable().optional(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hours: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  entryType: TimeEntryTypeEnum.optional(),
  description: z.string().max(500).nullable().optional(),
  internalNotes: z.string().max(2000).nullable().optional(),
  isBillable: z.boolean().optional(),
  externalId: z.string().max(100).nullable().optional(),
  externalSource: z.string().max(100).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

const timeEntryFiltersSchema = z
  .object({
    employeeId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    costCodeId: z.string().uuid().optional(),
    status: z.union([TimeEntryStatusEnum, z.array(TimeEntryStatusEnum)]).optional(),
    entryType: z.union([TimeEntryTypeEnum, z.array(TimeEntryTypeEnum)]).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    isBillable: z.boolean().optional(),
    batchId: z.string().uuid().optional(),
  })
  .optional();

const createLaborCostRateSchema = z.object({
  employeeId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  costCodeId: z.string().uuid().optional(),
  laborRole: z.string().max(100).optional(),
  laborRate: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Rate must be a positive number'),
  burdenRate: z.string().regex(/^\d+(\.\d{1,4})?$/).default('0'),
  billingRate: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  overtimeMultiplier: z.string().regex(/^\d+(\.\d{1,2})?$/).default('1.5'),
  doubleTimeMultiplier: z.string().regex(/^\d+(\.\d{1,2})?$/).default('2.0'),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  priority: z.number().int().min(0).max(100).default(0),
  description: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const createEmployeeAssignmentSchema = z.object({
  employeeId: z.string().uuid(),
  projectId: z.string().uuid(),
  role: z.string().max(100).optional(),
  defaultCostCodeId: z.string().uuid().optional(),
  budgetedHours: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  canApproveTime: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
});

export const timeEntriesRouter = router({
  // ========== Time Entry CRUD Routes ==========

  /**
   * List time entries with optional filters
   */
  list: authenticatedProcedure
    .input(
      z
        .object({
          page: z.number().int().positive().optional(),
          limit: z.number().int().positive().max(100).optional(),
          orderBy: z.enum(['entryDate', 'createdAt', 'status', 'hours']).optional(),
          orderDirection: z.enum(['asc', 'desc']).optional(),
          filters: timeEntryFiltersSchema,
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new TimeEntryService(ctx.serviceContext);
      return service.list(
        { page: input?.page, limit: input?.limit },
        input?.filters || {},
        input?.orderBy || 'entryDate',
        input?.orderDirection || 'desc'
      );
    }),

  /**
   * Get a single time entry by ID
   */
  getById: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new TimeEntryService(ctx.serviceContext);
      const entry = await service.getById(input.id);

      if (!entry) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Time entry not found',
        });
      }

      return entry;
    }),

  /**
   * Get a time entry with relations (employee, project, approver)
   */
  getByIdWithRelations: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new TimeEntryService(ctx.serviceContext);
      const entry = await service.getByIdWithRelations(input.id);

      if (!entry) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Time entry not found',
        });
      }

      return entry;
    }),

  /**
   * Get entries pending approval for the current user
   */
  getPendingApprovals: authenticatedProcedure
    .input(
      z
        .object({
          page: z.number().int().positive().optional(),
          limit: z.number().int().positive().max(100).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new TimeEntryService(ctx.serviceContext);
      return service.getPendingApprovals({ page: input?.page, limit: input?.limit });
    }),

  /**
   * Create a new time entry
   */
  create: authenticatedProcedure.input(createTimeEntrySchema).mutation(async ({ ctx, input }) => {
    const service = new TimeEntryService(ctx.serviceContext);
    return service.create(input);
  }),

  /**
   * Update an existing time entry (DRAFT only)
   */
  update: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateTimeEntrySchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new TimeEntryService(ctx.serviceContext);
      return service.update(input.id, input.data);
    }),

  /**
   * Delete a time entry (DRAFT only)
   */
  delete: authenticatedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const service = new TimeEntryService(ctx.serviceContext);
    await service.delete(input.id);
    return { success: true };
  }),

  // ========== Approval Workflow Routes ==========

  /**
   * Submit time entries for approval
   */
  submit: authenticatedProcedure
    .input(
      z.object({
        timeEntryIds: z.array(z.string().uuid()).min(1),
        comments: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new TimeEntryService(ctx.serviceContext);
      return service.submit(input);
    }),

  /**
   * Approve submitted time entries
   */
  approve: authenticatedProcedure
    .input(
      z.object({
        timeEntryIds: z.array(z.string().uuid()).min(1),
        comments: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new TimeEntryService(ctx.serviceContext);
      return service.approve(input);
    }),

  /**
   * Reject submitted time entries
   */
  reject: authenticatedProcedure
    .input(
      z.object({
        timeEntryIds: z.array(z.string().uuid()).min(1),
        reason: z.string().min(1, 'Rejection reason is required').max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new TimeEntryService(ctx.serviceContext);
      return service.reject(input);
    }),

  /**
   * Return approved time entries to draft (before posting)
   */
  returnToDraft: authenticatedProcedure
    .input(z.object({ timeEntryIds: z.array(z.string().uuid()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const service = new TimeEntryService(ctx.serviceContext);
      return service.returnToDraft(input.timeEntryIds);
    }),

  /**
   * Post approved time entries to GL
   */
  postToGL: adminProcedure
    .input(z.object({ timeEntryIds: z.array(z.string().uuid()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const service = new TimeEntryService(ctx.serviceContext);
      return service.postToGL(input.timeEntryIds);
    }),

  // ========== Labor Cost Rate Routes ==========

  /**
   * Create a new labor cost rate
   */
  createLaborRate: adminProcedure.input(createLaborCostRateSchema).mutation(async ({ ctx, input }) => {
    const service = new TimeEntryService(ctx.serviceContext);
    return service.createLaborRate(input);
  }),

  /**
   * List labor cost rates
   */
  listLaborRates: authenticatedProcedure
    .input(
      z
        .object({
          employeeId: z.string().uuid().optional(),
          projectId: z.string().uuid().optional(),
          costCodeId: z.string().uuid().optional(),
          laborRole: z.string().optional(),
          effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          isActive: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new TimeEntryService(ctx.serviceContext);
      return service.listLaborRates(input || {});
    }),

  // ========== Employee Assignment Routes ==========

  /**
   * Create an employee project assignment
   */
  createAssignment: authenticatedProcedure.input(createEmployeeAssignmentSchema).mutation(async ({ ctx, input }) => {
    const service = new TimeEntryService(ctx.serviceContext);
    return service.createAssignment(input);
  }),

  /**
   * Get my project assignments
   */
  getMyAssignments: authenticatedProcedure
    .input(z.object({ activeOnly: z.boolean().default(true) }).optional())
    .query(async ({ ctx, input }) => {
      const service = new TimeEntryService(ctx.serviceContext);
      return service.getMyAssignments(input?.activeOnly ?? true);
    }),

  // ========== Reporting Routes ==========

  /**
   * Get summary by employee
   */
  getSummaryByEmployee: authenticatedProcedure
    .input(
      z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        status: TimeEntryStatusEnum.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new TimeEntryService(ctx.serviceContext);
      return service.getSummaryByEmployee(input.startDate, input.endDate, input.status);
    }),

  /**
   * Get summary by project
   */
  getSummaryByProject: authenticatedProcedure
    .input(
      z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        status: TimeEntryStatusEnum.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new TimeEntryService(ctx.serviceContext);
      return service.getSummaryByProject(input.startDate, input.endDate, input.status);
    }),

  /**
   * Get total hours for an employee
   */
  getEmployeeTotalHours: authenticatedProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        status: TimeEntryStatusEnum.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new TimeEntryService(ctx.serviceContext);
      return service.getEmployeeTotalHours(input.employeeId, input.startDate, input.endDate, input.status);
    }),

  /**
   * Get total cost for a project
   */
  getProjectTotalCost: authenticatedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        status: TimeEntryStatusEnum.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new TimeEntryService(ctx.serviceContext);
      return service.getProjectTotalCost(input.projectId, input.status);
    }),

  // ========== Posting Batch Routes ==========

  /**
   * List posting batches
   */
  listPostingBatches: authenticatedProcedure
    .input(
      z
        .object({
          page: z.number().int().positive().optional(),
          limit: z.number().int().positive().max(100).optional(),
          status: TimeEntryStatusEnum.optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new TimeEntryService(ctx.serviceContext);
      return service.listPostingBatches(
        { page: input?.page, limit: input?.limit },
        { status: input?.status }
      );
    }),

  /**
   * Get posting batch by ID
   */
  getPostingBatch: authenticatedProcedure
    .input(z.object({ batchId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new TimeEntryService(ctx.serviceContext);
      const batch = await service.getPostingBatch(input.batchId);
      if (!batch) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Posting batch not found',
        });
      }
      return batch;
    }),
});
