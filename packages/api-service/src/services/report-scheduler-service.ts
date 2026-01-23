import { BaseService } from './base-service';
import { ServiceError } from '../types';
import {
  ReportScheduleRepository,
  reportScheduleRepository,
  type ReportSchedule,
  type NewReportSchedule,
  type UpdateReportSchedule,
  type ReportJobExecution,
  type NewReportJobExecution,
  type ReportScheduleWithExecutions,
  type ReportScheduleStatus,
  type ReportScheduleFrequency,
  type ReportFilters,
} from '@glapi/database';

// Types for the scheduler service
export interface CreateScheduleInput {
  name: string;
  description?: string;
  reportType: string;
  outputFormat?: 'json' | 'csv' | 'pdf' | 'xlsx';
  filters?: ReportFilters;
  frequency: ReportScheduleFrequency;
  cronExpression?: string;
  timezone?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  monthOfYear?: number;
  timeOfDay?: string;
  maxRetries?: number;
  retryDelaySeconds?: number;
  runUntil?: Date;
  maxRuns?: number;
  notifyOnSuccess?: boolean;
  notifyOnFailure?: boolean;
  notificationEmails?: string[];
  deliveryConfig?: any;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateScheduleInput extends Partial<CreateScheduleInput> {
  status?: ReportScheduleStatus;
  isEnabled?: boolean;
}

export interface ListSchedulesInput {
  status?: ReportScheduleStatus | ReportScheduleStatus[];
  reportType?: string;
  isEnabled?: boolean;
  tags?: string[];
  page?: number;
  limit?: number;
}

export interface ScheduleExecutionResult {
  schedule: ReportSchedule;
  execution: ReportJobExecution;
}

/**
 * ReportSchedulerService manages scheduled report generation jobs.
 *
 * Features:
 * - Cron expression and interval-based scheduling
 * - Timezone-aware execution times
 * - Retry handling with configurable delays
 * - Execution tracking and statistics
 */
export class ReportSchedulerService extends BaseService {
  private repository: ReportScheduleRepository;

  constructor(context = {}) {
    super(context);
    this.repository = reportScheduleRepository;
  }

  // ============================================================================
  // Schedule CRUD Operations
  // ============================================================================

  /**
   * Create a new report schedule
   */
  async createSchedule(input: CreateScheduleInput): Promise<ReportSchedule> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.context.userId;

    // Validate cron expression if provided
    if (input.frequency === 'cron' && input.cronExpression) {
      this.validateCronExpression(input.cronExpression);
    }

    // Validate timezone if provided
    if (input.timezone) {
      this.validateTimezone(input.timezone);
    }

    // Calculate initial next run time
    const nextRunAt = this.calculateNextRunTime({
      frequency: input.frequency,
      cronExpression: input.cronExpression,
      timezone: input.timezone || 'UTC',
      dayOfWeek: input.dayOfWeek,
      dayOfMonth: input.dayOfMonth,
      monthOfYear: input.monthOfYear,
      timeOfDay: input.timeOfDay || '06:00:00',
    });

    const scheduleData: NewReportSchedule = {
      organizationId,
      name: input.name,
      description: input.description,
      reportType: input.reportType as any,
      outputFormat: input.outputFormat || 'json',
      filters: input.filters || {},
      frequency: input.frequency,
      cronExpression: input.cronExpression,
      timezone: input.timezone || 'UTC',
      dayOfWeek: input.dayOfWeek,
      dayOfMonth: input.dayOfMonth,
      monthOfYear: input.monthOfYear,
      timeOfDay: input.timeOfDay || '06:00:00',
      status: 'draft',
      isEnabled: true,
      nextRunAt,
      maxRetries: input.maxRetries ?? 3,
      retryDelaySeconds: input.retryDelaySeconds ?? 300,
      runUntil: input.runUntil,
      maxRuns: input.maxRuns,
      notifyOnSuccess: input.notifyOnSuccess ?? false,
      notifyOnFailure: input.notifyOnFailure ?? true,
      notificationEmails: input.notificationEmails || [],
      deliveryConfig: input.deliveryConfig,
      tags: input.tags || [],
      metadata: input.metadata,
      createdBy: userId,
      updatedBy: userId,
    };

    return this.repository.create(scheduleData);
  }

  /**
   * Get a schedule by ID
   */
  async getSchedule(id: string): Promise<ReportSchedule | null> {
    const organizationId = this.requireOrganizationContext();
    const schedule = await this.repository.findById(id);

    if (schedule && schedule.organizationId !== organizationId) {
      throw new ServiceError('Schedule not found', 'NOT_FOUND', 404);
    }

    return schedule;
  }

  /**
   * Get a schedule with its recent executions
   */
  async getScheduleWithExecutions(
    id: string,
    executionLimit = 10
  ): Promise<ReportScheduleWithExecutions | null> {
    const organizationId = this.requireOrganizationContext();
    const schedule = await this.repository.findByIdWithExecutions(id, executionLimit);

    if (schedule && schedule.organizationId !== organizationId) {
      throw new ServiceError('Schedule not found', 'NOT_FOUND', 404);
    }

    return schedule;
  }

  /**
   * Update a schedule
   */
  async updateSchedule(id: string, input: UpdateScheduleInput): Promise<ReportSchedule> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.context.userId;

    const existing = await this.repository.findById(id);
    if (!existing || existing.organizationId !== organizationId) {
      throw new ServiceError('Schedule not found', 'NOT_FOUND', 404);
    }

    // Validate cron expression if provided
    if (input.frequency === 'cron' && input.cronExpression) {
      this.validateCronExpression(input.cronExpression);
    }

    // Validate timezone if provided
    if (input.timezone) {
      this.validateTimezone(input.timezone);
    }

    // Recalculate next run time if scheduling parameters changed
    let nextRunAt = existing.nextRunAt;
    if (
      input.frequency !== undefined ||
      input.cronExpression !== undefined ||
      input.timezone !== undefined ||
      input.dayOfWeek !== undefined ||
      input.dayOfMonth !== undefined ||
      input.monthOfYear !== undefined ||
      input.timeOfDay !== undefined
    ) {
      nextRunAt = this.calculateNextRunTime({
        frequency: input.frequency ?? existing.frequency,
        cronExpression: input.cronExpression ?? existing.cronExpression,
        timezone: input.timezone ?? existing.timezone,
        dayOfWeek: input.dayOfWeek ?? existing.dayOfWeek,
        dayOfMonth: input.dayOfMonth ?? existing.dayOfMonth,
        monthOfYear: input.monthOfYear ?? existing.monthOfYear,
        timeOfDay: input.timeOfDay ?? existing.timeOfDay ?? '06:00:00',
      });
    }

    // Extract reportType separately to handle type compatibility
    const { reportType, ...restInput } = input;
    const updateData: UpdateReportSchedule = {
      ...restInput,
      ...(reportType !== undefined && { reportType: reportType as NewReportSchedule['reportType'] }),
      nextRunAt,
      updatedBy: userId,
    };

    const updated = await this.repository.update(id, updateData);
    if (!updated) {
      throw new ServiceError('Failed to update schedule', 'UPDATE_FAILED', 500);
    }

    return updated;
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();

    const existing = await this.repository.findById(id);
    if (!existing || existing.organizationId !== organizationId) {
      throw new ServiceError('Schedule not found', 'NOT_FOUND', 404);
    }

    await this.repository.delete(id);
  }

  /**
   * List schedules with filtering
   */
  async listSchedules(input: ListSchedulesInput = {}) {
    const organizationId = this.requireOrganizationContext();
    const { page = 1, limit = 50, ...filters } = input;

    const result = await this.repository.list({
      organizationId,
      ...filters,
      limit,
      offset: (page - 1) * limit,
    });

    return {
      data: result.data,
      total: result.total,
      page,
      limit,
      hasMore: (page - 1) * limit + result.data.length < result.total,
    };
  }

  // ============================================================================
  // Schedule Status Management
  // ============================================================================

  /**
   * Activate a schedule (change from draft to active)
   */
  async activateSchedule(id: string): Promise<ReportSchedule> {
    const schedule = await this.getSchedule(id);
    if (!schedule) {
      throw new ServiceError('Schedule not found', 'NOT_FOUND', 404);
    }

    if (schedule.status !== 'draft' && schedule.status !== 'paused' && schedule.status !== 'error') {
      throw new ServiceError(
        `Cannot activate schedule in ${schedule.status} status`,
        'INVALID_STATUS_TRANSITION',
        400
      );
    }

    // Recalculate next run time when activating
    const nextRunAt = this.calculateNextRunTime({
      frequency: schedule.frequency,
      cronExpression: schedule.cronExpression,
      timezone: schedule.timezone,
      dayOfWeek: schedule.dayOfWeek,
      dayOfMonth: schedule.dayOfMonth,
      monthOfYear: schedule.monthOfYear,
      timeOfDay: schedule.timeOfDay ?? '06:00:00',
    });

    return this.updateSchedule(id, {
      status: 'active',
      isEnabled: true,
      nextRunAt,
    } as any);
  }

  /**
   * Pause a schedule
   */
  async pauseSchedule(id: string): Promise<ReportSchedule> {
    const schedule = await this.getSchedule(id);
    if (!schedule) {
      throw new ServiceError('Schedule not found', 'NOT_FOUND', 404);
    }

    if (schedule.status !== 'active') {
      throw new ServiceError(
        `Cannot pause schedule in ${schedule.status} status`,
        'INVALID_STATUS_TRANSITION',
        400
      );
    }

    return this.updateSchedule(id, { status: 'paused' });
  }

  /**
   * Resume a paused schedule
   */
  async resumeSchedule(id: string): Promise<ReportSchedule> {
    return this.activateSchedule(id);
  }

  // ============================================================================
  // Job Execution Management
  // ============================================================================

  /**
   * Create a new execution for a schedule
   */
  async createExecution(scheduleId: string, scheduledAt: Date): Promise<ReportJobExecution> {
    const schedule = await this.getSchedule(scheduleId);
    if (!schedule) {
      throw new ServiceError('Schedule not found', 'NOT_FOUND', 404);
    }

    const executionNumber = await this.repository.getNextExecutionNumber(scheduleId);

    const executionData: NewReportJobExecution = {
      reportScheduleId: scheduleId,
      organizationId: schedule.organizationId,
      executionNumber,
      status: 'pending',
      scheduledAt,
      attemptNumber: 1,
      filtersSnapshot: schedule.filters,
    };

    return this.repository.createExecution(executionData);
  }

  /**
   * Start execution of a job
   */
  async startExecution(executionId: string): Promise<ReportJobExecution> {
    const execution = await this.repository.findExecutionById(executionId);
    if (!execution) {
      throw new ServiceError('Execution not found', 'NOT_FOUND', 404);
    }

    if (execution.status !== 'pending') {
      throw new ServiceError(
        `Cannot start execution in ${execution.status} status`,
        'INVALID_STATUS_TRANSITION',
        400
      );
    }

    const updated = await this.repository.markExecutionStarted(executionId);
    if (!updated) {
      throw new ServiceError('Failed to start execution', 'UPDATE_FAILED', 500);
    }

    return updated;
  }

  /**
   * Complete execution successfully
   */
  async completeExecution(
    executionId: string,
    result: {
      outputLocation?: string;
      outputSizeBytes?: number;
      rowCount?: number;
    }
  ): Promise<ScheduleExecutionResult> {
    const execution = await this.repository.findExecutionById(executionId);
    if (!execution) {
      throw new ServiceError('Execution not found', 'NOT_FOUND', 404);
    }

    const schedule = await this.repository.findById(execution.reportScheduleId);
    if (!schedule) {
      throw new ServiceError('Schedule not found', 'NOT_FOUND', 404);
    }

    // Mark execution as completed
    const updatedExecution = await this.repository.markExecutionCompleted(executionId, result);
    if (!updatedExecution) {
      throw new ServiceError('Failed to complete execution', 'UPDATE_FAILED', 500);
    }

    // Calculate next run time
    const nextRunAt = this.shouldContinueSchedule(schedule)
      ? this.calculateNextRunTime({
          frequency: schedule.frequency,
          cronExpression: schedule.cronExpression,
          timezone: schedule.timezone,
          dayOfWeek: schedule.dayOfWeek,
          dayOfMonth: schedule.dayOfMonth,
          monthOfYear: schedule.monthOfYear,
          timeOfDay: schedule.timeOfDay ?? '06:00:00',
        })
      : null;

    // Update schedule statistics
    let updatedSchedule: ReportSchedule | null;
    if (nextRunAt) {
      updatedSchedule = await this.repository.recordSuccess(schedule.id, nextRunAt);
    } else {
      // Schedule has reached its end condition
      await this.repository.recordSuccess(schedule.id, null);
      updatedSchedule = await this.repository.markCompleted(schedule.id);
    }

    if (!updatedSchedule) {
      throw new ServiceError('Failed to update schedule', 'UPDATE_FAILED', 500);
    }

    return {
      schedule: updatedSchedule,
      execution: updatedExecution,
    };
  }

  /**
   * Fail execution with error
   */
  async failExecution(
    executionId: string,
    error: {
      errorCode?: string;
      errorMessage: string;
      errorStack?: string;
    }
  ): Promise<ScheduleExecutionResult> {
    const execution = await this.repository.findExecutionById(executionId);
    if (!execution) {
      throw new ServiceError('Execution not found', 'NOT_FOUND', 404);
    }

    const schedule = await this.repository.findById(execution.reportScheduleId);
    if (!schedule) {
      throw new ServiceError('Schedule not found', 'NOT_FOUND', 404);
    }

    // Determine if we should retry
    const shouldRetry = execution.attemptNumber < schedule.maxRetries;
    const nextRetryAt = shouldRetry
      ? this.calculateRetryTime(schedule.retryDelaySeconds, execution.attemptNumber)
      : undefined;

    // Mark execution as failed
    const updatedExecution = await this.repository.markExecutionFailed(
      executionId,
      error,
      nextRetryAt
    );
    if (!updatedExecution) {
      throw new ServiceError('Failed to fail execution', 'UPDATE_FAILED', 500);
    }

    // Update schedule
    let updatedSchedule: ReportSchedule | null;
    if (shouldRetry) {
      // Keep schedule active, will retry
      updatedSchedule = await this.repository.recordFailure(
        schedule.id,
        error.errorMessage,
        nextRetryAt!
      );
    } else {
      // Max retries exceeded - set schedule to error status
      await this.repository.recordFailure(schedule.id, error.errorMessage, null);
      updatedSchedule = await this.repository.setErrorStatus(
        schedule.id,
        `Max retries (${schedule.maxRetries}) exceeded: ${error.errorMessage}`
      );
    }

    if (!updatedSchedule) {
      throw new ServiceError('Failed to update schedule', 'UPDATE_FAILED', 500);
    }

    return {
      schedule: updatedSchedule,
      execution: updatedExecution,
    };
  }

  /**
   * Get execution history for a schedule
   */
  async getExecutionHistory(
    scheduleId: string,
    options: {
      status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
      page?: number;
      limit?: number;
    } = {}
  ) {
    const schedule = await this.getSchedule(scheduleId);
    if (!schedule) {
      throw new ServiceError('Schedule not found', 'NOT_FOUND', 404);
    }

    const { page = 1, limit = 50, status } = options;

    return this.repository.listExecutions({
      reportScheduleId: scheduleId,
      status: status as any,
      limit,
      offset: (page - 1) * limit,
    });
  }

  // ============================================================================
  // Scheduler Operations (for worker/processor)
  // ============================================================================

  /**
   * Find all schedules that are due for execution
   * This is used by the scheduler worker to find jobs to run
   */
  async findDueSchedules(limit = 100): Promise<ReportSchedule[]> {
    return this.repository.findDueSchedules(new Date(), limit);
  }

  /**
   * Find pending executions that are ready to run
   */
  async findPendingExecutions(limit = 100): Promise<ReportJobExecution[]> {
    return this.repository.findPendingExecutions(new Date(), limit);
  }

  /**
   * Find failed executions that are ready for retry
   */
  async findRetryableExecutions(limit = 100): Promise<ReportJobExecution[]> {
    return this.repository.findRetryableExecutions(new Date(), limit);
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get scheduler statistics for the organization
   */
  async getStats() {
    const organizationId = this.requireOrganizationContext();
    return this.repository.getScheduleStats(organizationId);
  }

  // ============================================================================
  // Scheduling Helpers
  // ============================================================================

  /**
   * Calculate the next run time based on schedule configuration
   */
  calculateNextRunTime(config: {
    frequency: ReportScheduleFrequency;
    cronExpression?: string | null;
    timezone: string;
    dayOfWeek?: number | null;
    dayOfMonth?: number | null;
    monthOfYear?: number | null;
    timeOfDay: string;
    fromDate?: Date;
  }): Date {
    const { frequency, cronExpression, timezone, dayOfWeek, dayOfMonth, monthOfYear, timeOfDay, fromDate } = config;
    const now = fromDate || new Date();

    // Parse time of day
    const [hours, minutes, seconds] = (timeOfDay || '06:00:00').split(':').map(Number);

    switch (frequency) {
      case 'once':
        // For one-time execution, schedule for next occurrence of timeOfDay
        return this.getNextTimeOfDay(now, hours, minutes, seconds, timezone);

      case 'daily':
        return this.getNextTimeOfDay(now, hours, minutes, seconds, timezone);

      case 'weekly':
        return this.getNextWeeklyRun(now, dayOfWeek ?? 1, hours, minutes, seconds, timezone);

      case 'monthly':
        return this.getNextMonthlyRun(now, dayOfMonth ?? 1, hours, minutes, seconds, timezone);

      case 'quarterly':
        return this.getNextQuarterlyRun(now, dayOfMonth ?? 1, hours, minutes, seconds, timezone);

      case 'yearly':
        return this.getNextYearlyRun(now, monthOfYear ?? 1, dayOfMonth ?? 1, hours, minutes, seconds, timezone);

      case 'cron':
        if (!cronExpression) {
          throw new ServiceError('Cron expression required for cron frequency', 'INVALID_CRON', 400);
        }
        return this.getNextCronRun(now, cronExpression, timezone);

      default:
        throw new ServiceError(`Unknown frequency: ${frequency}`, 'INVALID_FREQUENCY', 400);
    }
  }

  /**
   * Validate a cron expression
   */
  validateCronExpression(expression: string): void {
    // Basic cron format validation: minute hour day-of-month month day-of-week
    const parts = expression.trim().split(/\s+/);
    if (parts.length < 5 || parts.length > 6) {
      throw new ServiceError(
        'Invalid cron expression: must have 5 or 6 fields',
        'INVALID_CRON',
        400
      );
    }

    // Validate each field has valid characters
    const validPattern = /^[\d,*/-]+$/;
    for (const part of parts) {
      if (!validPattern.test(part)) {
        throw new ServiceError(
          `Invalid cron expression: invalid characters in "${part}"`,
          'INVALID_CRON',
          400
        );
      }
    }
  }

  /**
   * Validate a timezone string
   */
  validateTimezone(timezone: string): void {
    try {
      // Try to use the timezone with Intl
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch {
      throw new ServiceError(
        `Invalid timezone: ${timezone}`,
        'INVALID_TIMEZONE',
        400
      );
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private shouldContinueSchedule(schedule: ReportSchedule): boolean {
    // Check if schedule has reached max runs
    if (schedule.maxRuns !== null && schedule.totalRuns >= schedule.maxRuns) {
      return false;
    }

    // Check if schedule has passed run_until date
    if (schedule.runUntil && new Date() >= new Date(schedule.runUntil)) {
      return false;
    }

    // For one-time schedules, don't continue after first run
    if (schedule.frequency === 'once' && schedule.totalRuns > 0) {
      return false;
    }

    return true;
  }

  private calculateRetryTime(retryDelaySeconds: number, attemptNumber: number): Date {
    // Exponential backoff with jitter
    const baseDelay = retryDelaySeconds * 1000;
    const exponentialDelay = baseDelay * Math.pow(2, attemptNumber - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    const totalDelay = Math.min(exponentialDelay + jitter, 300000); // Cap at 5 minutes

    return new Date(Date.now() + totalDelay);
  }

  private getNextTimeOfDay(now: Date, hours: number, minutes: number, seconds: number, timezone: string): Date {
    // Get current time in the target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';

    const currentHour = parseInt(getPart('hour'), 10);
    const currentMinute = parseInt(getPart('minute'), 10);
    const currentSecond = parseInt(getPart('second'), 10);

    // Create a date for today at the target time
    const result = new Date(now);
    result.setHours(hours, minutes, seconds, 0);

    // If target time has passed today, schedule for tomorrow
    if (
      currentHour > hours ||
      (currentHour === hours && currentMinute > minutes) ||
      (currentHour === hours && currentMinute === minutes && currentSecond >= seconds)
    ) {
      result.setDate(result.getDate() + 1);
    }

    return result;
  }

  private getNextWeeklyRun(
    now: Date,
    targetDayOfWeek: number,
    hours: number,
    minutes: number,
    seconds: number,
    timezone: string
  ): Date {
    const result = this.getNextTimeOfDay(now, hours, minutes, seconds, timezone);
    const currentDay = result.getDay();
    const daysUntilTarget = (targetDayOfWeek - currentDay + 7) % 7;

    if (daysUntilTarget === 0 && result <= now) {
      result.setDate(result.getDate() + 7);
    } else {
      result.setDate(result.getDate() + daysUntilTarget);
    }

    return result;
  }

  private getNextMonthlyRun(
    now: Date,
    targetDay: number,
    hours: number,
    minutes: number,
    seconds: number,
    timezone: string
  ): Date {
    const result = new Date(now);
    result.setHours(hours, minutes, seconds, 0);

    // Handle months with fewer days
    const daysInMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
    const day = Math.min(targetDay, daysInMonth);
    result.setDate(day);

    // If target day has passed this month, go to next month
    if (result <= now) {
      result.setMonth(result.getMonth() + 1);
      const newDaysInMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
      result.setDate(Math.min(targetDay, newDaysInMonth));
    }

    return result;
  }

  private getNextQuarterlyRun(
    now: Date,
    targetDay: number,
    hours: number,
    minutes: number,
    seconds: number,
    timezone: string
  ): Date {
    const result = new Date(now);
    result.setHours(hours, minutes, seconds, 0);

    // Quarters start on months 0, 3, 6, 9 (Jan, Apr, Jul, Oct)
    const currentQuarterStart = Math.floor(result.getMonth() / 3) * 3;
    result.setMonth(currentQuarterStart);

    const daysInMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
    result.setDate(Math.min(targetDay, daysInMonth));

    // If target has passed, go to next quarter
    if (result <= now) {
      result.setMonth(result.getMonth() + 3);
      const newDaysInMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
      result.setDate(Math.min(targetDay, newDaysInMonth));
    }

    return result;
  }

  private getNextYearlyRun(
    now: Date,
    targetMonth: number,
    targetDay: number,
    hours: number,
    minutes: number,
    seconds: number,
    timezone: string
  ): Date {
    const result = new Date(now);
    result.setMonth(targetMonth - 1); // months are 0-indexed
    result.setHours(hours, minutes, seconds, 0);

    const daysInMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
    result.setDate(Math.min(targetDay, daysInMonth));

    // If target has passed this year, go to next year
    if (result <= now) {
      result.setFullYear(result.getFullYear() + 1);
      const newDaysInMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
      result.setDate(Math.min(targetDay, newDaysInMonth));
    }

    return result;
  }

  private getNextCronRun(now: Date, cronExpression: string, timezone: string): Date {
    // Simple cron parser for common patterns
    // Format: minute hour day-of-month month day-of-week
    const parts = cronExpression.trim().split(/\s+/);
    const [minuteExpr, hourExpr, dayExpr, monthExpr, dowExpr] = parts;

    // Parse cron field (simplified - handles *, specific numbers, ranges, and steps)
    const parseField = (expr: string, min: number, max: number): number[] => {
      if (expr === '*') {
        return Array.from({ length: max - min + 1 }, (_, i) => min + i);
      }

      const values: number[] = [];
      const parts = expr.split(',');

      for (const part of parts) {
        if (part.includes('/')) {
          const [range, step] = part.split('/');
          const stepNum = parseInt(step, 10);
          let start = min;
          let end = max;

          if (range !== '*') {
            if (range.includes('-')) {
              [start, end] = range.split('-').map(Number);
            } else {
              start = parseInt(range, 10);
            }
          }

          for (let i = start; i <= end; i += stepNum) {
            values.push(i);
          }
        } else if (part.includes('-')) {
          const [start, end] = part.split('-').map(Number);
          for (let i = start; i <= end; i++) {
            values.push(i);
          }
        } else {
          values.push(parseInt(part, 10));
        }
      }

      return [...new Set(values)].sort((a, b) => a - b);
    };

    const validMinutes = parseField(minuteExpr, 0, 59);
    const validHours = parseField(hourExpr, 0, 23);
    const validDays = parseField(dayExpr, 1, 31);
    const validMonths = parseField(monthExpr, 1, 12);
    const validDow = parseField(dowExpr, 0, 6);

    // Find next valid time
    const result = new Date(now);
    result.setSeconds(0, 0);

    // Try up to 366 days ahead
    for (let i = 0; i < 366 * 24 * 60; i++) {
      result.setMinutes(result.getMinutes() + 1);

      const month = result.getMonth() + 1;
      const day = result.getDate();
      const dow = result.getDay();
      const hour = result.getHours();
      const minute = result.getMinutes();

      if (
        validMonths.includes(month) &&
        validDays.includes(day) &&
        validDow.includes(dow) &&
        validHours.includes(hour) &&
        validMinutes.includes(minute) &&
        result > now
      ) {
        return result;
      }
    }

    // Fallback: return tomorrow at the specified time
    result.setDate(result.getDate() + 1);
    result.setHours(validHours[0] || 0, validMinutes[0] || 0, 0, 0);
    return result;
  }
}
