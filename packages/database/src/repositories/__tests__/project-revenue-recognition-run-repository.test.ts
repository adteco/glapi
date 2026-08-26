import { describe, expect, it, vi } from 'vitest';

vi.mock('../base-repository', () => ({
  BaseRepository: class {
    protected db: unknown;

    constructor(db: unknown) {
      this.db = db;
    }
  },
}));

import { revenueJournalEntries } from '../../db/schema/revenue-journal-entries';
import {
  revenueRecognitionRunItems,
  revenueRecognitionRuns,
} from '../../db/schema/revenue-recognition-runs';
import { revenueSchedules } from '../../db/schema/revenue-schedules';
import {
  ProjectRevenueRecognitionRunRepository,
  type ProjectRevenueRecognitionRunInput,
} from '../project-revenue-recognition-run-repository';

const input: ProjectRevenueRecognitionRunInput = {
  organizationId: 'org-1',
  subsidiaryId: 'subsidiary-1',
  accountingPeriodId: 'period-1',
  recognitionDate: '2026-08-31',
  idempotencyKey: 'recognition-2026-08',
  requestHash: 'a'.repeat(64),
  initiatedBy: 'user-1',
};

const period = {
  id: 'period-1',
  startDate: '2026-08-01',
  endDate: '2026-08-31',
  status: 'OPEN',
};

const schedules = [
  {
    id: 'schedule-1',
    projectContractVersionId: 'version-1',
    performanceObligationId: 'obligation-1',
    scheduleDate: '2026-08-15',
    scheduledAmount: '43200.25',
  },
  {
    id: 'schedule-2',
    projectContractVersionId: 'version-1',
    performanceObligationId: 'obligation-2',
    scheduleDate: '2026-08-31',
    scheduledAmount: '5400.10',
  },
];

function queryResult<T>(rows: T[]) {
  return {
    for: async () => rows,
    then: (resolve: (value: T[]) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  };
}

function createHarness(options: {
  existingRun?: Record<string, unknown>;
  period?: typeof period;
  updatedIds?: string[];
} = {}) {
  const inserts: Array<{ table: unknown; values: unknown }> = [];
  const updates: Array<{ table: unknown; values: unknown }> = [];
  const execute = vi.fn().mockResolvedValue({ rows: [] });
  let selectCall = 0;
  let rolledBack = false;
  const tx = {
    execute,
    select: vi.fn(() => {
      const call = selectCall++;
      return {
        from: () => ({
          where: () => ({
            limit: () =>
              queryResult(
                call === 0
                  ? options.existingRun
                    ? [options.existingRun]
                    : []
                  : [options.period ?? period],
              ),
            orderBy: () => queryResult([]),
          }),
          innerJoin: () => ({
            innerJoin: () => ({
              where: () => ({
                orderBy: () => queryResult(schedules),
              }),
            }),
          }),
        }),
      };
    }),
    insert: vi.fn((table: unknown) => ({
      values: (values: unknown) => {
        inserts.push({ table, values });
        return {
          returning: async () =>
            table === revenueRecognitionRuns
              ? [
                  {
                    id: 'run-1',
                    requestHash: input.requestHash,
                    scheduleCount: 2,
                    totalRecognizedAmount: '48600.35',
                  },
                ]
              : table === revenueRecognitionRunItems
                ? schedules.map((schedule, index) => ({
                    id: `item-${index + 1}`,
                    organizationId: input.organizationId,
                    recognitionRunId: 'run-1',
                    revenueScheduleId: schedule.id,
                    recognizedAmount: schedule.scheduledAmount,
                    createdAt: new Date('2026-08-31T00:00:00Z'),
                  }))
                : [],
        };
      },
    })),
    update: vi.fn((table: unknown) => ({
      set: (values: unknown) => {
        updates.push({ table, values });
        return {
          where: () => ({
            returning: async () =>
              (options.updatedIds ?? ['schedule-1', 'schedule-2']).map((id) => ({ id })),
          }),
        };
      },
    })),
  };
  const db = {
    transaction: async (callback: (transaction: typeof tx) => unknown) => {
      try {
        return await callback(tx);
      } catch (error) {
        rolledBack = true;
        throw error;
      }
    },
  };
  return { db, execute, inserts, updates, didRollBack: () => rolledBack };
}

describe('ProjectRevenueRecognitionRunRepository', () => {
  it('updates schedules, writes run items, and drafts journals in one reconciled transaction', async () => {
    const harness = createHarness();
    const repository = new ProjectRevenueRecognitionRunRepository(harness.db as never);

    const result = await repository.execute(input);

    expect(result).toMatchObject({
      replayed: false,
      run: { scheduleCount: 2, totalRecognizedAmount: '48600.35' },
    });
    expect(harness.execute).toHaveBeenCalledTimes(1);
    expect(
      harness.updates.find((entry) => entry.table === revenueSchedules)?.values,
    ).toMatchObject({ status: 'recognized', recognitionDate: '2026-08-31' });
    expect(
      harness.inserts.find((entry) => entry.table === revenueRecognitionRunItems)?.values,
    ).toEqual([
      expect.objectContaining({ revenueScheduleId: 'schedule-1', recognizedAmount: '43200.25' }),
      expect.objectContaining({ revenueScheduleId: 'schedule-2', recognizedAmount: '5400.10' }),
    ]);
    expect(
      harness.inserts.find((entry) => entry.table === revenueJournalEntries)?.values,
    ).toEqual([
      expect.objectContaining({ recognitionRunId: 'run-1', revenueScheduleId: 'schedule-1' }),
      expect.objectContaining({ recognitionRunId: 'run-1', revenueScheduleId: 'schedule-2' }),
    ]);
  });

  it('replays an exact idempotent request before locking schedules or writing rows', async () => {
    const existingRun = {
      id: 'run-existing',
      requestHash: input.requestHash,
      scheduleCount: 2,
      totalRecognizedAmount: '48600.35',
    };
    const harness = createHarness({ existingRun });
    const repository = new ProjectRevenueRecognitionRunRepository(harness.db as never);

    await expect(repository.execute(input)).resolves.toMatchObject({ replayed: true });
    expect(harness.inserts).toEqual([]);
    expect(harness.updates).toEqual([]);
  });

  it('rejects idempotency-key reuse with a different request hash', async () => {
    const harness = createHarness({
      existingRun: {
        id: 'run-existing',
        requestHash: 'b'.repeat(64),
        scheduleCount: 2,
        totalRecognizedAmount: '48600.35',
      },
    });
    const repository = new ProjectRevenueRecognitionRunRepository(harness.db as never);

    await expect(repository.execute(input)).rejects.toMatchObject({
      code: 'REVENUE_RECOGNITION_IDEMPOTENCY_CONFLICT',
    });
    expect(harness.inserts).toEqual([]);
    expect(harness.updates).toEqual([]);
  });

  it('rejects a closed period before any recognition writes', async () => {
    const harness = createHarness({ period: { ...period, status: 'CLOSED' } });
    const repository = new ProjectRevenueRecognitionRunRepository(harness.db as never);

    await expect(repository.execute(input)).rejects.toMatchObject({
      code: 'REVENUE_RECOGNITION_PERIOD_CLOSED',
    });
    expect(harness.inserts).toEqual([]);
    expect(harness.updates).toEqual([]);
    expect(harness.didRollBack()).toBe(true);
  });

  it('rolls back before run items or journals when a schedule changes concurrently', async () => {
    const harness = createHarness({ updatedIds: ['schedule-1'] });
    const repository = new ProjectRevenueRecognitionRunRepository(harness.db as never);

    await expect(repository.execute(input)).rejects.toMatchObject({
      code: 'REVENUE_RECOGNITION_CONCURRENT_CONFLICT',
    });
    expect(harness.didRollBack()).toBe(true);
    expect(
      harness.inserts.some((entry) => entry.table === revenueRecognitionRunItems),
    ).toBe(false);
    expect(harness.inserts.some((entry) => entry.table === revenueJournalEntries)).toBe(false);
  });
});
