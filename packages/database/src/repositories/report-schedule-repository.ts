import { eq, and, desc, sql, gte, lte, inArray, lt, or, isNotNull } from 'drizzle-orm';
import { db } from '../db';
import {
  reportSchedules,
  reportJobExecutions,
  type ReportSchedule,
  type NewReportSchedule,
  type UpdateReportSchedule,
  type ReportJobExecution,
  type NewReportJobExecution,
  type UpdateReportJobExecution,
  type ReportScheduleWithExecutions,
  type ReportScheduleStatus,
  type JobExecutionStatus,
} from '../db/schema/report-schedules';

export class ReportScheduleRepository {
  // ============================================================================
  // Schedule CRUD Operations
  // ============================================================================

  async create(data: NewReportSchedule): Promise<ReportSchedule> {
    const [schedule] = await db
      .insert(reportSchedules)
      .values(data)
      .returning();
    return schedule;
  }

  async findById(id: string): Promise<ReportSchedule | null> {
    const [schedule] = await db
      .select()
      .from(reportSchedules)
      .where(eq(reportSchedules.id, id))
      .limit(1);
    return schedule || null;
  }

  async findByIdWithExecutions(
    id: string,
    executionLimit = 10
  ): Promise<ReportScheduleWithExecutions | null> {
    const schedule = await this.findById(id);
    if (!schedule) return null;

    const executions = await db
      .select()
      .from(reportJobExecutions)
      .where(eq(reportJobExecutions.reportScheduleId, id))
      .orderBy(desc(reportJobExecutions.scheduledAt))
      .limit(executionLimit);

    return {
      ...schedule,
      executions,
    };
  }

  async update(id: string, data: UpdateReportSchedule): Promise<ReportSchedule | null> {
    const [updated] = await db
      .update(reportSchedules)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(reportSchedules.id, id))
      .returning();
    return updated || null;
  }

  async delete(id: string): Promise<void> {
    await db.delete(reportSchedules).where(eq(reportSchedules.id, id));
  }

  // ============================================================================
  // Schedule Query Operations
  // ============================================================================

  async list(options: {
    organizationId: string;
    status?: ReportScheduleStatus | ReportScheduleStatus[];
    reportType?: string;
    isEnabled?: boolean;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{ data: ReportSchedule[]; total: number }> {
    const { organizationId, status, reportType, isEnabled, tags, limit = 50, offset = 0 } = options;

    const conditions = [eq(reportSchedules.organizationId, organizationId)];

    if (status) {
      if (Array.isArray(status)) {
        conditions.push(inArray(reportSchedules.status, status));
      } else {
        conditions.push(eq(reportSchedules.status, status));
      }
    }

    if (reportType) {
      conditions.push(eq(reportSchedules.reportType, reportType as any));
    }

    if (isEnabled !== undefined) {
      conditions.push(eq(reportSchedules.isEnabled, isEnabled));
    }

    // Note: Tag filtering would require jsonb contains operator
    // For now, we'll do client-side filtering if tags are specified

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reportSchedules)
      .where(whereClause);

    let data = await db
      .select()
      .from(reportSchedules)
      .where(whereClause)
      .orderBy(desc(reportSchedules.createdAt))
      .limit(limit)
      .offset(offset);

    // Client-side tag filtering if needed
    if (tags && tags.length > 0) {
      data = data.filter(schedule =>
        tags.some(tag => (schedule.tags as string[] || []).includes(tag))
      );
    }

    return {
      data,
      total: countResult?.count || 0,
    };
  }

  // ============================================================================
  // Scheduling Operations
  // ============================================================================

  /**
   * Find schedules that are due for execution
   * Returns active, enabled schedules where next_run_at is in the past
   */
  async findDueSchedules(
    asOfTime: Date = new Date(),
    limit = 100
  ): Promise<ReportSchedule[]> {
    return await db
      .select()
      .from(reportSchedules)
      .where(
        and(
          eq(reportSchedules.status, 'active'),
          eq(reportSchedules.isEnabled, true),
          lte(reportSchedules.nextRunAt, asOfTime),
          // Ensure not past run_until if set
          or(
            sql`${reportSchedules.runUntil} IS NULL`,
            gte(reportSchedules.runUntil, asOfTime)
          ),
          // Ensure not past max_runs if set
          or(
            sql`${reportSchedules.maxRuns} IS NULL`,
            lt(reportSchedules.totalRuns, reportSchedules.maxRuns)
          )
        )
      )
      .orderBy(reportSchedules.nextRunAt)
      .limit(limit);
  }

  /**
   * Find schedules by organization that are due for execution
   */
  async findDueSchedulesByOrg(
    organizationId: string,
    asOfTime: Date = new Date()
  ): Promise<ReportSchedule[]> {
    return await db
      .select()
      .from(reportSchedules)
      .where(
        and(
          eq(reportSchedules.organizationId, organizationId),
          eq(reportSchedules.status, 'active'),
          eq(reportSchedules.isEnabled, true),
          lte(reportSchedules.nextRunAt, asOfTime)
        )
      )
      .orderBy(reportSchedules.nextRunAt);
  }

  /**
   * Update next run time for a schedule
   */
  async updateNextRunTime(id: string, nextRunAt: Date): Promise<ReportSchedule | null> {
    const [updated] = await db
      .update(reportSchedules)
      .set({
        nextRunAt,
        updatedAt: new Date(),
      })
      .where(eq(reportSchedules.id, id))
      .returning();
    return updated || null;
  }

  /**
   * Record a successful execution
   */
  async recordSuccess(id: string, nextRunAt: Date | null): Promise<ReportSchedule | null> {
    const now = new Date();
    const [updated] = await db
      .update(reportSchedules)
      .set({
        lastRunAt: now,
        lastSuccessAt: now,
        nextRunAt,
        totalRuns: sql`${reportSchedules.totalRuns} + 1`,
        successfulRuns: sql`${reportSchedules.successfulRuns} + 1`,
        lastErrorMessage: null,
        updatedAt: now,
      })
      .where(eq(reportSchedules.id, id))
      .returning();
    return updated || null;
  }

  /**
   * Record a failed execution
   */
  async recordFailure(
    id: string,
    errorMessage: string,
    nextRunAt: Date | null
  ): Promise<ReportSchedule | null> {
    const now = new Date();
    const [updated] = await db
      .update(reportSchedules)
      .set({
        lastRunAt: now,
        lastFailureAt: now,
        nextRunAt,
        totalRuns: sql`${reportSchedules.totalRuns} + 1`,
        failedRuns: sql`${reportSchedules.failedRuns} + 1`,
        lastErrorMessage: errorMessage,
        updatedAt: now,
      })
      .where(eq(reportSchedules.id, id))
      .returning();
    return updated || null;
  }

  /**
   * Set schedule status to error (after max retries exceeded)
   */
  async setErrorStatus(id: string, errorMessage: string): Promise<ReportSchedule | null> {
    const [updated] = await db
      .update(reportSchedules)
      .set({
        status: 'error',
        lastErrorMessage: errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(reportSchedules.id, id))
      .returning();
    return updated || null;
  }

  /**
   * Mark schedule as completed (reached end conditions)
   */
  async markCompleted(id: string): Promise<ReportSchedule | null> {
    const [updated] = await db
      .update(reportSchedules)
      .set({
        status: 'completed',
        nextRunAt: null,
        updatedAt: new Date(),
      })
      .where(eq(reportSchedules.id, id))
      .returning();
    return updated || null;
  }

  // ============================================================================
  // Job Execution Operations
  // ============================================================================

  async createExecution(data: NewReportJobExecution): Promise<ReportJobExecution> {
    const [execution] = await db
      .insert(reportJobExecutions)
      .values(data)
      .returning();
    return execution;
  }

  async findExecutionById(id: string): Promise<ReportJobExecution | null> {
    const [execution] = await db
      .select()
      .from(reportJobExecutions)
      .where(eq(reportJobExecutions.id, id))
      .limit(1);
    return execution || null;
  }

  async updateExecution(
    id: string,
    data: UpdateReportJobExecution
  ): Promise<ReportJobExecution | null> {
    const [updated] = await db
      .update(reportJobExecutions)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(reportJobExecutions.id, id))
      .returning();
    return updated || null;
  }

  async listExecutions(options: {
    reportScheduleId?: string;
    organizationId?: string;
    status?: JobExecutionStatus | JobExecutionStatus[];
    scheduledAfter?: Date;
    scheduledBefore?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ data: ReportJobExecution[]; total: number }> {
    const {
      reportScheduleId,
      organizationId,
      status,
      scheduledAfter,
      scheduledBefore,
      limit = 50,
      offset = 0,
    } = options;

    const conditions = [];

    if (reportScheduleId) {
      conditions.push(eq(reportJobExecutions.reportScheduleId, reportScheduleId));
    }

    if (organizationId) {
      conditions.push(eq(reportJobExecutions.organizationId, organizationId));
    }

    if (status) {
      if (Array.isArray(status)) {
        conditions.push(inArray(reportJobExecutions.status, status));
      } else {
        conditions.push(eq(reportJobExecutions.status, status));
      }
    }

    if (scheduledAfter) {
      conditions.push(gte(reportJobExecutions.scheduledAt, scheduledAfter));
    }

    if (scheduledBefore) {
      conditions.push(lte(reportJobExecutions.scheduledAt, scheduledBefore));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reportJobExecutions)
      .where(whereClause);

    const data = await db
      .select()
      .from(reportJobExecutions)
      .where(whereClause)
      .orderBy(desc(reportJobExecutions.scheduledAt))
      .limit(limit)
      .offset(offset);

    return {
      data,
      total: countResult?.count || 0,
    };
  }

  /**
   * Find pending executions that are ready to run
   */
  async findPendingExecutions(
    asOfTime: Date = new Date(),
    limit = 100
  ): Promise<ReportJobExecution[]> {
    return await db
      .select()
      .from(reportJobExecutions)
      .where(
        and(
          eq(reportJobExecutions.status, 'pending'),
          lte(reportJobExecutions.scheduledAt, asOfTime)
        )
      )
      .orderBy(reportJobExecutions.scheduledAt)
      .limit(limit);
  }

  /**
   * Find failed executions that are ready for retry
   */
  async findRetryableExecutions(
    asOfTime: Date = new Date(),
    limit = 100
  ): Promise<ReportJobExecution[]> {
    return await db
      .select()
      .from(reportJobExecutions)
      .where(
        and(
          eq(reportJobExecutions.status, 'failed'),
          isNotNull(reportJobExecutions.nextRetryAt),
          lte(reportJobExecutions.nextRetryAt, asOfTime)
        )
      )
      .orderBy(reportJobExecutions.nextRetryAt)
      .limit(limit);
  }

  /**
   * Mark execution as started
   */
  async markExecutionStarted(id: string): Promise<ReportJobExecution | null> {
    const [updated] = await db
      .update(reportJobExecutions)
      .set({
        status: 'running',
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reportJobExecutions.id, id))
      .returning();
    return updated || null;
  }

  /**
   * Mark execution as completed
   */
  async markExecutionCompleted(
    id: string,
    result: {
      outputLocation?: string;
      outputSizeBytes?: number;
      rowCount?: number;
    }
  ): Promise<ReportJobExecution | null> {
    const now = new Date();
    const execution = await this.findExecutionById(id);
    if (!execution) return null;

    const durationMs = execution.startedAt
      ? now.getTime() - new Date(execution.startedAt).getTime()
      : null;

    const [updated] = await db
      .update(reportJobExecutions)
      .set({
        status: 'completed',
        completedAt: now,
        durationMs,
        outputLocation: result.outputLocation,
        outputSizeBytes: result.outputSizeBytes,
        rowCount: result.rowCount,
        nextRetryAt: null,
        updatedAt: now,
      })
      .where(eq(reportJobExecutions.id, id))
      .returning();
    return updated || null;
  }

  /**
   * Mark execution as failed
   */
  async markExecutionFailed(
    id: string,
    error: {
      errorCode?: string;
      errorMessage: string;
      errorStack?: string;
    },
    nextRetryAt?: Date
  ): Promise<ReportJobExecution | null> {
    const now = new Date();
    const execution = await this.findExecutionById(id);
    if (!execution) return null;

    const durationMs = execution.startedAt
      ? now.getTime() - new Date(execution.startedAt).getTime()
      : null;

    const [updated] = await db
      .update(reportJobExecutions)
      .set({
        status: 'failed',
        completedAt: now,
        durationMs,
        errorCode: error.errorCode,
        errorMessage: error.errorMessage,
        errorStack: error.errorStack,
        attemptNumber: sql`${reportJobExecutions.attemptNumber} + 1`,
        nextRetryAt,
        updatedAt: now,
      })
      .where(eq(reportJobExecutions.id, id))
      .returning();
    return updated || null;
  }

  /**
   * Get the next execution number for a schedule
   */
  async getNextExecutionNumber(scheduleId: string): Promise<number> {
    const [result] = await db
      .select({ maxNum: sql<number>`COALESCE(MAX(${reportJobExecutions.executionNumber}), 0)::int` })
      .from(reportJobExecutions)
      .where(eq(reportJobExecutions.reportScheduleId, scheduleId));

    return (result?.maxNum || 0) + 1;
  }

  // ============================================================================
  // Statistics Operations
  // ============================================================================

  async getScheduleStats(organizationId: string): Promise<{
    total: number;
    active: number;
    paused: number;
    error: number;
    totalExecutionsToday: number;
    successfulExecutionsToday: number;
    failedExecutionsToday: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [scheduleStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) FILTER (WHERE ${reportSchedules.status} = 'active')::int`,
        paused: sql<number>`count(*) FILTER (WHERE ${reportSchedules.status} = 'paused')::int`,
        error: sql<number>`count(*) FILTER (WHERE ${reportSchedules.status} = 'error')::int`,
      })
      .from(reportSchedules)
      .where(eq(reportSchedules.organizationId, organizationId));

    const [executionStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        successful: sql<number>`count(*) FILTER (WHERE ${reportJobExecutions.status} = 'completed')::int`,
        failed: sql<number>`count(*) FILTER (WHERE ${reportJobExecutions.status} = 'failed')::int`,
      })
      .from(reportJobExecutions)
      .where(
        and(
          eq(reportJobExecutions.organizationId, organizationId),
          gte(reportJobExecutions.scheduledAt, today)
        )
      );

    return {
      total: scheduleStats?.total || 0,
      active: scheduleStats?.active || 0,
      paused: scheduleStats?.paused || 0,
      error: scheduleStats?.error || 0,
      totalExecutionsToday: executionStats?.total || 0,
      successfulExecutionsToday: executionStats?.successful || 0,
      failedExecutionsToday: executionStats?.failed || 0,
    };
  }
}
