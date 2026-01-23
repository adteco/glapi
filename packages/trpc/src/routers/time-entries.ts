import { z } from 'zod';
import { authenticatedProcedure, adminProcedure, router } from '../trpc';
import { TimeEntryService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';
import {
  // Time entry types
  TimeEntryStatusEnum,
  createTimeEntrySchema,
  updateTimeEntrySchema,
  timeEntryFiltersSchema,
  timeEntryListInputSchema,
  submitTimeEntriesSchema,
  approveTimeEntriesSchema,
  rejectTimeEntriesSchema,
  // Labor cost rate types
  createLaborCostRateSchema,
  laborRateFiltersSchema,
  // Employee assignment types
  createEmployeeAssignmentSchema,
  // Common types
  byIdInputSchema,
  uuidArraySchema,
  dateStringSchema,
  optionalPaginationInputSchema,
} from '@glapi/types';

export const timeEntriesRouter = router({
  // ========== Time Entry CRUD Routes ==========

  /**
   * List time entries with optional filters
   */
  list: authenticatedProcedure.input(timeEntryListInputSchema).query(async ({ ctx, input }) => {
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
  getById: authenticatedProcedure.input(byIdInputSchema).query(async ({ ctx, input }) => {
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
  getByIdWithRelations: authenticatedProcedure.input(byIdInputSchema).query(async ({ ctx, input }) => {
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
  getPendingApprovals: authenticatedProcedure.input(optionalPaginationInputSchema.optional()).query(async ({ ctx, input }) => {
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
  delete: authenticatedProcedure.input(byIdInputSchema).mutation(async ({ ctx, input }) => {
    const service = new TimeEntryService(ctx.serviceContext);
    await service.delete(input.id);
    return { success: true };
  }),

  // ========== Approval Workflow Routes ==========

  /**
   * Submit time entries for approval
   */
  submit: authenticatedProcedure.input(submitTimeEntriesSchema).mutation(async ({ ctx, input }) => {
    const service = new TimeEntryService(ctx.serviceContext);
    return service.submit(input);
  }),

  /**
   * Approve submitted time entries
   */
  approve: authenticatedProcedure.input(approveTimeEntriesSchema).mutation(async ({ ctx, input }) => {
    const service = new TimeEntryService(ctx.serviceContext);
    return service.approve(input);
  }),

  /**
   * Reject submitted time entries
   */
  reject: authenticatedProcedure.input(rejectTimeEntriesSchema).mutation(async ({ ctx, input }) => {
    const service = new TimeEntryService(ctx.serviceContext);
    return service.reject(input);
  }),

  /**
   * Return approved time entries to draft (before posting)
   */
  returnToDraft: authenticatedProcedure
    .input(z.object({ timeEntryIds: uuidArraySchema }))
    .mutation(async ({ ctx, input }) => {
      const service = new TimeEntryService(ctx.serviceContext);
      return service.returnToDraft(input.timeEntryIds);
    }),

  /**
   * Post approved time entries to GL
   */
  postToGL: adminProcedure.input(z.object({ timeEntryIds: uuidArraySchema })).mutation(async ({ ctx, input }) => {
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
  listLaborRates: authenticatedProcedure.input(laborRateFiltersSchema).query(async ({ ctx, input }) => {
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
        startDate: dateStringSchema,
        endDate: dateStringSchema,
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
        startDate: dateStringSchema,
        endDate: dateStringSchema,
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
        startDate: dateStringSchema,
        endDate: dateStringSchema,
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
      return service.listPostingBatches({ page: input?.page, limit: input?.limit }, { status: input?.status });
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
