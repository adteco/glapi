import { and, asc, eq, inArray, isNotNull, lte, sql } from 'drizzle-orm';
import type { ContextualDatabase } from '../context';
import { accountingPeriods } from '../db/schema/accounting-periods';
import { projectContracts } from '../db/schema/project-contracts';
import { revenueJournalEntries } from '../db/schema/revenue-journal-entries';
import {
  revenueRecognitionRunItems,
  revenueRecognitionRuns,
  type RevenueRecognitionRun,
  type RevenueRecognitionRunItem,
} from '../db/schema/revenue-recognition-runs';
import { revenueSchedules } from '../db/schema/revenue-schedules';
import { performanceObligations } from '../db/schema/performance-obligations';
import { BaseRepository } from './base-repository';

type RevenueRecognitionQueryExecutor = Pick<ContextualDatabase, 'select'>;

export class ProjectRevenueRecognitionRunError extends Error {
  constructor(
    public readonly code:
      | 'REVENUE_RECOGNITION_IDEMPOTENCY_CONFLICT'
      | 'REVENUE_RECOGNITION_PERIOD_NOT_FOUND'
      | 'REVENUE_RECOGNITION_PERIOD_CLOSED'
      | 'REVENUE_RECOGNITION_DATE_OUTSIDE_PERIOD'
      | 'REVENUE_SCHEDULE_NOT_ELIGIBLE'
      | 'REVENUE_RECOGNITION_CONCURRENT_CONFLICT',
    message: string,
  ) {
    super(message);
    this.name = 'ProjectRevenueRecognitionRunError';
  }
}

export interface ProjectRevenueRecognitionRunInput {
  organizationId: string;
  subsidiaryId: string;
  accountingPeriodId: string;
  recognitionDate: string;
  idempotencyKey: string;
  requestHash: string;
  scheduleIds?: string[];
  initiatedBy?: string;
}

export interface ProjectRevenueRecognitionPreview {
  accountingPeriod: {
    id: string;
    startDate: string;
    endDate: string;
    status: string;
  };
  schedules: Array<{
    id: string;
    projectContractVersionId: string | null;
    performanceObligationId: string;
    scheduleDate: string;
    scheduledAmount: string;
  }>;
}

export interface ProjectRevenueRecognitionReceipt {
  run: RevenueRecognitionRun;
  items: RevenueRecognitionRunItem[];
  replayed: boolean;
}

function scheduleConditions(input: ProjectRevenueRecognitionRunInput, cutoffDate: string) {
  const conditions = [
    eq(revenueSchedules.organizationId, input.organizationId),
    isNotNull(revenueSchedules.projectContractVersionId),
    eq(revenueSchedules.status, 'scheduled'),
    lte(revenueSchedules.scheduleDate, cutoffDate),
    // Join-backed subsidiary scope is enforced by the caller's query.
    eq(projectContracts.subsidiaryId, input.subsidiaryId),
  ];
  if (input.scheduleIds?.length) {
    conditions.push(inArray(revenueSchedules.id, input.scheduleIds));
  }
  return and(...conditions);
}

function amountCents(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(`${fraction}00`.slice(0, 2));
}

export class ProjectRevenueRecognitionRunRepository extends BaseRepository {
  constructor(db?: ContextualDatabase) {
    super(db);
  }

  private async findReceipt(
    executor: RevenueRecognitionQueryExecutor,
    organizationId: string,
    idempotencyKey: string,
  ): Promise<ProjectRevenueRecognitionReceipt | null> {
    const [run] = await executor
      .select()
      .from(revenueRecognitionRuns)
      .where(
        and(
          eq(revenueRecognitionRuns.organizationId, organizationId),
          eq(revenueRecognitionRuns.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);
    if (!run) return null;
    const items = await executor
      .select()
      .from(revenueRecognitionRunItems)
      .where(
        and(
          eq(revenueRecognitionRunItems.organizationId, organizationId),
          eq(revenueRecognitionRunItems.recognitionRunId, run.id),
        ),
      )
      .orderBy(asc(revenueRecognitionRunItems.createdAt), asc(revenueRecognitionRunItems.id));
    return { run, items, replayed: true };
  }

  private async requirePeriod(
    executor: RevenueRecognitionQueryExecutor,
    input: ProjectRevenueRecognitionRunInput,
    lockForUpdate = false,
  ) {
    const query = executor
      .select({
        id: accountingPeriods.id,
        startDate: accountingPeriods.startDate,
        endDate: accountingPeriods.endDate,
        status: accountingPeriods.status,
      })
      .from(accountingPeriods)
      .where(
        and(
          eq(accountingPeriods.id, input.accountingPeriodId),
          eq(accountingPeriods.organizationId, input.organizationId),
          eq(accountingPeriods.subsidiaryId, input.subsidiaryId),
        ),
      )
      .limit(1);
    const [period] = lockForUpdate ? await query.for('update') : await query;
    if (!period) {
      throw new ProjectRevenueRecognitionRunError(
        'REVENUE_RECOGNITION_PERIOD_NOT_FOUND',
        'Accounting period not found for the organization and subsidiary',
      );
    }
    if (period.status !== 'OPEN') {
      throw new ProjectRevenueRecognitionRunError(
        'REVENUE_RECOGNITION_PERIOD_CLOSED',
        `Revenue recognition requires an OPEN period; ${period.status} is not writable`,
      );
    }
    if (input.recognitionDate < period.startDate || input.recognitionDate > period.endDate) {
      throw new ProjectRevenueRecognitionRunError(
        'REVENUE_RECOGNITION_DATE_OUTSIDE_PERIOD',
        'Recognition date must fall within the selected accounting period',
      );
    }
    return period;
  }

  private selectSchedules(
    executor: RevenueRecognitionQueryExecutor,
    input: ProjectRevenueRecognitionRunInput,
    cutoffDate: string,
  ) {
    return executor
      .select({
        id: revenueSchedules.id,
        projectContractVersionId: revenueSchedules.projectContractVersionId,
        performanceObligationId: revenueSchedules.performanceObligationId,
        scheduleDate: revenueSchedules.scheduleDate,
        scheduledAmount: revenueSchedules.scheduledAmount,
      })
      .from(revenueSchedules)
      .innerJoin(
        performanceObligations,
        eq(performanceObligations.id, revenueSchedules.performanceObligationId),
      )
      .innerJoin(
        projectContracts,
        eq(projectContracts.id, performanceObligations.projectContractId),
      )
      .where(scheduleConditions(input, cutoffDate))
      .orderBy(asc(revenueSchedules.scheduleDate), asc(revenueSchedules.id));
  }

  async preview(input: ProjectRevenueRecognitionRunInput): Promise<ProjectRevenueRecognitionPreview> {
    const period = await this.requirePeriod(this.db, input);
    const schedules = await this.selectSchedules(this.db, input, input.recognitionDate);
    if (input.scheduleIds?.length && schedules.length !== new Set(input.scheduleIds).size) {
      throw new ProjectRevenueRecognitionRunError(
        'REVENUE_SCHEDULE_NOT_ELIGIBLE',
        'One or more selected schedules are already recognized, outside the period, or out of scope',
      );
    }
    return { accountingPeriod: period, schedules };
  }

  async execute(input: ProjectRevenueRecognitionRunInput): Promise<ProjectRevenueRecognitionReceipt> {
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${input.organizationId}:${input.idempotencyKey}:project-revenue-recognition`}, 0))`,
      );
      const existing = await this.findReceipt(tx, input.organizationId, input.idempotencyKey);
      if (existing) {
        if (existing.run.requestHash !== input.requestHash) {
          throw new ProjectRevenueRecognitionRunError(
            'REVENUE_RECOGNITION_IDEMPOTENCY_CONFLICT',
            'Idempotency key was already used with a different recognition request',
          );
        }
        return existing;
      }

      // Lock the period row so it cannot be closed between validation and commit.
      await this.requirePeriod(tx, input, true);
      const schedules = await this.selectSchedules(tx, input, input.recognitionDate).for('update');
      if (input.scheduleIds?.length && schedules.length !== new Set(input.scheduleIds).size) {
        throw new ProjectRevenueRecognitionRunError(
          'REVENUE_SCHEDULE_NOT_ELIGIBLE',
          'One or more selected schedules are already recognized, outside the period, or out of scope',
        );
      }
      const totalCents = schedules.reduce(
        (sum, schedule) => sum + amountCents(schedule.scheduledAmount),
        0n,
      );
      const totalRecognizedAmount = `${totalCents / 100n}.${(totalCents % 100n)
        .toString()
        .padStart(2, '0')}`;
      const [run] = await tx
        .insert(revenueRecognitionRuns)
        .values({
          organizationId: input.organizationId,
          subsidiaryId: input.subsidiaryId,
          accountingPeriodId: input.accountingPeriodId,
          idempotencyKey: input.idempotencyKey,
          requestHash: input.requestHash,
          recognitionDate: input.recognitionDate,
          scheduleCount: schedules.length,
          totalRecognizedAmount,
          status: 'completed',
          selection: { scheduleIds: input.scheduleIds ?? null },
          initiatedBy: input.initiatedBy,
        })
        .returning();

      let items: RevenueRecognitionRunItem[] = [];
      if (schedules.length) {
        const updated = await tx
          .update(revenueSchedules)
          .set({
            status: 'recognized',
            recognizedAmount: sql`${revenueSchedules.scheduledAmount}`,
            recognitionDate: input.recognitionDate,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(revenueSchedules.organizationId, input.organizationId),
              eq(revenueSchedules.status, 'scheduled'),
              inArray(
                revenueSchedules.id,
                schedules.map((schedule) => schedule.id),
              ),
            ),
          )
          .returning({ id: revenueSchedules.id });
        if (updated.length !== schedules.length) {
          throw new ProjectRevenueRecognitionRunError(
            'REVENUE_RECOGNITION_CONCURRENT_CONFLICT',
            'A selected schedule changed while the recognition run was executing',
          );
        }
        items = await tx
          .insert(revenueRecognitionRunItems)
          .values(
            schedules.map((schedule) => ({
              organizationId: input.organizationId,
              recognitionRunId: run.id,
              revenueScheduleId: schedule.id,
              recognizedAmount: schedule.scheduledAmount,
            })),
          )
          .returning();
        await tx.insert(revenueJournalEntries).values(
          schedules.map((schedule) => ({
            organizationId: input.organizationId,
            revenueScheduleId: schedule.id,
            recognitionRunId: run.id,
            accountingPeriodId: input.accountingPeriodId,
            entryDate: input.recognitionDate,
            recognizedRevenueAmount: schedule.scheduledAmount,
            status: 'draft' as const,
          })),
        );
      }
      return { run, items, replayed: false };
    });
  }
}
