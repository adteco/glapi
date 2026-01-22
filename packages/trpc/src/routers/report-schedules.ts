import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { ReportSchedulerService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';

// Schema definitions
const reportScheduleStatusSchema = z.enum(['draft', 'active', 'paused', 'completed', 'error']);
const reportScheduleFrequencySchema = z.enum(['once', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'cron']);
const reportTypeSchema = z.enum([
  'income_statement', 'balance_sheet', 'cash_flow_statement', 'trial_balance', 'general_ledger', 'account_activity',
  'job_cost_summary', 'wip_summary', 'project_budget_variance', 'retainage_aging',
  'revenue_forecast', 'deferred_revenue', 'subscription_metrics',
  'custom'
]);
const outputFormatSchema = z.enum(['json', 'csv', 'pdf', 'xlsx']);
const jobExecutionStatusSchema = z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']);

const reportFiltersSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  relativeDateRange: z.enum(['last_7_days', 'last_30_days', 'last_month', 'last_quarter', 'last_year', 'ytd', 'custom']).optional(),
  subsidiaryIds: z.array(z.string().uuid()).optional(),
  departmentIds: z.array(z.string().uuid()).optional(),
  locationIds: z.array(z.string().uuid()).optional(),
  classIds: z.array(z.string().uuid()).optional(),
  projectIds: z.array(z.string().uuid()).optional(),
  entityIds: z.array(z.string().uuid()).optional(),
  accountIds: z.array(z.string().uuid()).optional(),
  includeInactive: z.boolean().optional(),
  compareWithPriorPeriod: z.boolean().optional(),
  consolidate: z.boolean().optional(),
  custom: z.record(z.unknown()).optional(),
}).optional();

const deliveryConfigSchema = z.object({
  type: z.enum(['email', 'sftp', 'webhook', 's3', 'none']),
  emailRecipients: z.array(z.string().email()).optional(),
  emailSubject: z.string().optional(),
  emailBody: z.string().optional(),
  sftpHost: z.string().optional(),
  sftpPort: z.number().optional(),
  sftpPath: z.string().optional(),
  sftpCredentialsId: z.string().uuid().optional(),
  webhookUrl: z.string().url().optional(),
  webhookHeaders: z.record(z.string()).optional(),
  s3Bucket: z.string().optional(),
  s3Prefix: z.string().optional(),
  s3Region: z.string().optional(),
}).optional();

// Helper to map service errors to TRPC errors
function handleServiceError(error: any): never {
  if (error.code === 'NOT_FOUND') {
    throw new TRPCError({ code: 'NOT_FOUND', message: error.message });
  }
  if (error.code === 'INVALID_STATUS_TRANSITION') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
  }
  if (error.code === 'INVALID_CRON' || error.code === 'INVALID_TIMEZONE' || error.code === 'INVALID_FREQUENCY') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
  }
  if (error.code === 'UPDATE_FAILED') {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
  }
  throw error;
}

export const reportSchedulesRouter = router({
  // ============================================================================
  // Schedule CRUD
  // ============================================================================

  // Create a new report schedule
  create: authenticatedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      reportType: reportTypeSchema,
      outputFormat: outputFormatSchema.default('json'),
      filters: reportFiltersSchema,
      frequency: reportScheduleFrequencySchema,
      cronExpression: z.string().max(100).optional(),
      timezone: z.string().max(100).default('UTC'),
      dayOfWeek: z.number().min(0).max(6).optional(),
      dayOfMonth: z.number().min(1).max(31).optional(),
      monthOfYear: z.number().min(1).max(12).optional(),
      timeOfDay: z.string().regex(/^\d{2}:\d{2}:\d{2}$/).default('06:00:00'),
      maxRetries: z.number().min(0).max(10).default(3),
      retryDelaySeconds: z.number().min(60).max(3600).default(300),
      runUntil: z.coerce.date().optional(),
      maxRuns: z.number().min(1).optional(),
      notifyOnSuccess: z.boolean().default(false),
      notifyOnFailure: z.boolean().default(true),
      notificationEmails: z.array(z.string().email()).default([]),
      deliveryConfig: deliveryConfigSchema,
      tags: z.array(z.string()).default([]),
      metadata: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ReportSchedulerService(ctx.serviceContext);

      try {
        return await service.createSchedule({
          name: input.name,
          description: input.description,
          reportType: input.reportType,
          outputFormat: input.outputFormat,
          filters: input.filters,
          frequency: input.frequency,
          cronExpression: input.cronExpression,
          timezone: input.timezone,
          dayOfWeek: input.dayOfWeek,
          dayOfMonth: input.dayOfMonth,
          monthOfYear: input.monthOfYear,
          timeOfDay: input.timeOfDay,
          maxRetries: input.maxRetries,
          retryDelaySeconds: input.retryDelaySeconds,
          runUntil: input.runUntil,
          maxRuns: input.maxRuns,
          notifyOnSuccess: input.notifyOnSuccess,
          notifyOnFailure: input.notifyOnFailure,
          notificationEmails: input.notificationEmails,
          deliveryConfig: input.deliveryConfig,
          tags: input.tags,
          metadata: input.metadata,
        });
      } catch (error: any) {
        handleServiceError(error);
      }
    }),

  // Get a report schedule by ID
  get: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ReportSchedulerService(ctx.serviceContext);

      const schedule = await service.getSchedule(input.id);
      if (!schedule) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Report schedule not found'
        });
      }

      return schedule;
    }),

  // Get a report schedule with recent executions
  getWithExecutions: authenticatedProcedure
    .input(z.object({
      id: z.string().uuid(),
      executionLimit: z.number().min(1).max(100).default(10)
    }))
    .query(async ({ ctx, input }) => {
      const service = new ReportSchedulerService(ctx.serviceContext);

      const schedule = await service.getScheduleWithExecutions(input.id, input.executionLimit);
      if (!schedule) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Report schedule not found'
        });
      }

      return schedule;
    }),

  // Update a report schedule
  update: authenticatedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      reportType: reportTypeSchema.optional(),
      outputFormat: outputFormatSchema.optional(),
      filters: reportFiltersSchema,
      frequency: reportScheduleFrequencySchema.optional(),
      cronExpression: z.string().max(100).optional(),
      timezone: z.string().max(100).optional(),
      dayOfWeek: z.number().min(0).max(6).optional(),
      dayOfMonth: z.number().min(1).max(31).optional(),
      monthOfYear: z.number().min(1).max(12).optional(),
      timeOfDay: z.string().regex(/^\d{2}:\d{2}:\d{2}$/).optional(),
      maxRetries: z.number().min(0).max(10).optional(),
      retryDelaySeconds: z.number().min(60).max(3600).optional(),
      runUntil: z.coerce.date().optional(),
      maxRuns: z.number().min(1).optional(),
      notifyOnSuccess: z.boolean().optional(),
      notifyOnFailure: z.boolean().optional(),
      notificationEmails: z.array(z.string().email()).optional(),
      deliveryConfig: deliveryConfigSchema,
      tags: z.array(z.string()).optional(),
      metadata: z.record(z.unknown()).optional(),
      isEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ReportSchedulerService(ctx.serviceContext);
      const { id, ...updateData } = input;

      try {
        return await service.updateSchedule(id, updateData);
      } catch (error: any) {
        handleServiceError(error);
      }
    }),

  // Delete a report schedule
  delete: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ReportSchedulerService(ctx.serviceContext);

      try {
        await service.deleteSchedule(input.id);
        return { success: true };
      } catch (error: any) {
        handleServiceError(error);
      }
    }),

  // List report schedules
  list: authenticatedProcedure
    .input(z.object({
      status: z.union([
        reportScheduleStatusSchema,
        z.array(reportScheduleStatusSchema)
      ]).optional(),
      reportType: reportTypeSchema.optional(),
      isEnabled: z.boolean().optional(),
      tags: z.array(z.string()).optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50)
    }).optional())
    .query(async ({ ctx, input = {} }) => {
      const service = new ReportSchedulerService(ctx.serviceContext);

      return service.listSchedules(input);
    }),

  // ============================================================================
  // Schedule Status Management
  // ============================================================================

  // Activate a schedule
  activate: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ReportSchedulerService(ctx.serviceContext);

      try {
        return await service.activateSchedule(input.id);
      } catch (error: any) {
        handleServiceError(error);
      }
    }),

  // Pause a schedule
  pause: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ReportSchedulerService(ctx.serviceContext);

      try {
        return await service.pauseSchedule(input.id);
      } catch (error: any) {
        handleServiceError(error);
      }
    }),

  // Resume a paused schedule
  resume: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ReportSchedulerService(ctx.serviceContext);

      try {
        return await service.resumeSchedule(input.id);
      } catch (error: any) {
        handleServiceError(error);
      }
    }),

  // ============================================================================
  // Execution Management
  // ============================================================================

  // Get execution history for a schedule
  getExecutionHistory: authenticatedProcedure
    .input(z.object({
      scheduleId: z.string().uuid(),
      status: jobExecutionStatusSchema.optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50)
    }))
    .query(async ({ ctx, input }) => {
      const service = new ReportSchedulerService(ctx.serviceContext);

      try {
        return await service.getExecutionHistory(input.scheduleId, {
          status: input.status,
          page: input.page,
          limit: input.limit
        });
      } catch (error: any) {
        handleServiceError(error);
      }
    }),

  // Manually trigger a schedule execution
  triggerExecution: authenticatedProcedure
    .input(z.object({
      scheduleId: z.string().uuid()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ReportSchedulerService(ctx.serviceContext);

      try {
        // Create an immediate execution
        return await service.createExecution(input.scheduleId, new Date());
      } catch (error: any) {
        handleServiceError(error);
      }
    }),

  // ============================================================================
  // Statistics
  // ============================================================================

  // Get scheduler statistics
  getStats: authenticatedProcedure
    .query(async ({ ctx }) => {
      const service = new ReportSchedulerService(ctx.serviceContext);

      return service.getStats();
    }),

  // ============================================================================
  // Scheduling Utilities
  // ============================================================================

  // Calculate next run time for given schedule parameters (for UI preview)
  calculateNextRunTime: authenticatedProcedure
    .input(z.object({
      frequency: reportScheduleFrequencySchema,
      cronExpression: z.string().max(100).optional(),
      timezone: z.string().max(100).default('UTC'),
      dayOfWeek: z.number().min(0).max(6).optional(),
      dayOfMonth: z.number().min(1).max(31).optional(),
      monthOfYear: z.number().min(1).max(12).optional(),
      timeOfDay: z.string().regex(/^\d{2}:\d{2}:\d{2}$/).default('06:00:00'),
    }))
    .query(async ({ ctx, input }) => {
      const service = new ReportSchedulerService(ctx.serviceContext);

      try {
        const nextRunAt = service.calculateNextRunTime({
          frequency: input.frequency,
          cronExpression: input.cronExpression,
          timezone: input.timezone,
          dayOfWeek: input.dayOfWeek,
          dayOfMonth: input.dayOfMonth,
          monthOfYear: input.monthOfYear,
          timeOfDay: input.timeOfDay,
        });

        return { nextRunAt };
      } catch (error: any) {
        handleServiceError(error);
      }
    }),

  // Validate a cron expression
  validateCron: authenticatedProcedure
    .input(z.object({
      expression: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const service = new ReportSchedulerService(ctx.serviceContext);

      try {
        service.validateCronExpression(input.expression);
        return { valid: true, error: null };
      } catch (error: any) {
        return { valid: false, error: error.message };
      }
    }),
});
