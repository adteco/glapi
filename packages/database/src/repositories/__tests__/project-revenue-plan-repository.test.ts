import { describe, expect, it, vi } from 'vitest';

vi.mock('../base-repository', () => ({
  BaseRepository: class {
    protected db: unknown;

    constructor(db: unknown) {
      this.db = db;
    }
  },
}));

import { contractSspAllocations } from '../../db/schema/contract-ssp-allocations';
import { performanceObligations } from '../../db/schema/performance-obligations';
import { revenueSchedules } from '../../db/schema/revenue-schedules';
import {
  ProjectRevenuePlanRepository,
  type PersistProjectRevenuePlanInput,
} from '../project-revenue-plan-repository';

function plan(): PersistProjectRevenuePlanInput {
  return {
    organizationId: 'org-1',
    projectContractId: 'contract-1',
    projectContractVersionId: 'version-1',
    currencyCode: 'USD',
    transactionPrice: '108000.00',
    totalSsp: '120000.00',
    totalAllocated: '108000.00',
    obligations: [
      {
        lineId: 'line-1',
        itemId: 'item-1',
        name: 'Implementation',
        revenueTiming: 'point_in_time',
        recognitionMethod: 'manual_output',
        startDate: '2026-01-01',
        endDate: '2026-02-15',
        sspAmount: '48000.00',
        allocatedAmount: '43200.00',
        allocationPercentage: '40.000000',
        allocationMethod: 'proportional',
        schedules: [
          {
            scheduleDate: '2026-02-15',
            periodStartDate: '2026-02-15',
            periodEndDate: '2026-02-15',
            scheduledAmount: '43200.00',
            recognitionPattern: 'immediate',
            status: 'scheduled',
          },
        ],
      },
    ],
  };
}

function createHarness(existing: boolean) {
  const inserts: Array<{ table: unknown; values: unknown }> = [];
  const execute = vi.fn().mockResolvedValue({ rows: [] });
  const tx = {
    execute,
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: async () => (existing ? [{ id: 'obligation-existing' }] : []),
        }),
      }),
    })),
    insert: vi.fn((table: unknown) => ({
      values: (values: unknown) => {
        inserts.push({ table, values });
        return {
          returning: async () => [{ id: 'obligation-1' }],
        };
      },
    })),
  };
  const db = {
    transaction: (callback: (transaction: typeof tx) => unknown) => callback(tx),
  };
  return { db, execute, inserts };
}

describe('ProjectRevenuePlanRepository', () => {
  it('writes obligation, SSP allocation, and schedule lineage atomically', async () => {
    const harness = createHarness(false);
    const repository = new ProjectRevenuePlanRepository(harness.db as never);

    await expect(repository.persistPlan(plan())).resolves.toEqual({ created: true });

    expect(harness.execute).toHaveBeenCalledTimes(1);
    expect(
      harness.inserts.find((entry) => entry.table === performanceObligations)?.values,
    ).toMatchObject({
      organizationId: 'org-1',
      projectContractId: 'contract-1',
      projectContractVersionId: 'version-1',
      projectContractLineId: 'line-1',
      subscriptionId: null,
      allocatedAmount: '43200.00',
    });
    expect(
      harness.inserts.find((entry) => entry.table === contractSspAllocations)?.values,
    ).toMatchObject({
      performanceObligationId: 'obligation-1',
      projectContractVersionId: 'version-1',
      projectContractLineId: 'line-1',
      allocationPercentage: '40.000000',
    });
    expect(
      harness.inserts.find((entry) => entry.table === revenueSchedules)?.values,
    ).toEqual([
      expect.objectContaining({
        performanceObligationId: 'obligation-1',
        projectContractVersionId: 'version-1',
        scheduledAmount: '43200.00',
        scheduleVersion: 1,
      }),
    ]);
  });

  it('returns an idempotent replay after taking the per-version transaction lock', async () => {
    const harness = createHarness(true);
    const repository = new ProjectRevenuePlanRepository(harness.db as never);

    await expect(repository.persistPlan(plan())).resolves.toEqual({ created: false });

    expect(harness.execute).toHaveBeenCalledTimes(1);
    expect(harness.inserts).toEqual([]);
  });
});
