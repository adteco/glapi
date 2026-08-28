import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@glapi/database', () => ({
  ProjectRevenuePlanRepository: vi.fn(),
}));
vi.mock('@glapi/business', async () =>
  import('../../../../business/src/services/project-revenue-plan-engine'),
);

import type {
  ContractSSPAllocation,
  PerformanceObligation,
  ProjectRevenuePlanSource,
  RevenueSchedule,
} from '@glapi/database';
import {
  ProjectRevenuePlanService,
  type ProjectRevenuePlanRepositoryLike,
} from '../project-revenue-plan-service';

function source(): ProjectRevenuePlanSource {
  return {
    projectContractId: 'contract-1',
    projectContractVersionId: 'version-1',
    transactionPrice: '108000.00',
    variableConsideration: '0.00',
    currencyCode: 'USD',
    contractStartDate: '2026-01-01',
    contractEndDate: '2026-12-31',
    lines: [
      {
        id: 'implementation',
        itemId: null,
        description: 'Implementation',
        transactionPrice: '54000.00',
        sspAmount: '48000.00',
        fallbackSspAmount: null,
        revenueTiming: 'point_in_time',
        recognitionMethod: 'manual_output',
        serviceStartDate: '2026-01-01',
        serviceEndDate: '2026-02-15',
      },
      {
        id: 'support',
        itemId: null,
        description: 'Support',
        transactionPrice: '54000.00',
        sspAmount: '72000.00',
        fallbackSspAmount: null,
        revenueTiming: 'over_time',
        recognitionMethod: 'elapsed_time',
        serviceStartDate: '2026-01-01',
        serviceEndDate: '2026-12-31',
      },
    ],
  };
}

function persistedPlan() {
  const obligations = [
    {
      id: 'obligation-1',
      allocatedAmount: '43200.00',
      allocatedTransactionPrice: '43200.00',
    },
    {
      id: 'obligation-2',
      allocatedAmount: '64800.00',
      allocatedTransactionPrice: '64800.00',
    },
  ] as PerformanceObligation[];
  const allocations = [
    { id: 'allocation-1', performanceObligationId: 'obligation-1' },
    { id: 'allocation-2', performanceObligationId: 'obligation-2' },
  ] as ContractSSPAllocation[];
  const schedules = [
    {
      id: 'schedule-1',
      performanceObligationId: 'obligation-1',
      scheduleDate: '2026-02-15',
      periodEndDate: '2026-02-15',
      scheduledAmount: '43200.00',
      recognizedAmount: '43200.00',
      status: 'recognized',
    },
    {
      id: 'schedule-2',
      performanceObligationId: 'obligation-2',
      scheduleDate: '2026-01-31',
      periodEndDate: '2026-01-31',
      scheduledAmount: '5400.00',
      recognizedAmount: '0.00',
      status: 'scheduled',
    },
    {
      id: 'schedule-3',
      performanceObligationId: 'obligation-2',
      scheduleDate: '2026-02-28',
      periodEndDate: '2026-02-28',
      scheduledAmount: '5400.00',
      recognizedAmount: '0.00',
      status: 'scheduled',
    },
  ] as RevenueSchedule[];
  return { obligations, allocations, schedules };
}

describe('ProjectRevenuePlanService', () => {
  let findPlanSource: ReturnType<typeof vi.fn>;
  let findPersistedPlan: ReturnType<typeof vi.fn>;
  let persistPlan: ReturnType<typeof vi.fn>;
  let service: ProjectRevenuePlanService;

  beforeEach(() => {
    findPlanSource = vi.fn().mockResolvedValue(source());
    findPersistedPlan = vi.fn().mockResolvedValue(null);
    persistPlan = vi.fn().mockResolvedValue({ created: true });
    service = new ProjectRevenuePlanService(
      { organizationId: 'org-1' },
      {
        repository: {
          findPlanSource,
          findPersistedPlan,
          persistPlan,
        } as ProjectRevenuePlanRepositoryLike,
      },
    );
  });

  it('previews deterministic SSP allocation using only the tenant-scoped contract source', async () => {
    const result = await service.previewPlan('version-1');

    expect(findPlanSource).toHaveBeenCalledWith('version-1', 'org-1');
    expect(result.obligations.map((row) => row.allocatedAmount)).toEqual([
      '43200.00',
      '64800.00',
    ]);
    expect(result.obligations[0].schedules[0].scheduleDate).toBe('2026-02-15');
  });

  it('rejects versions that are not the approved current version of an active contract', async () => {
    findPlanSource.mockResolvedValue(null);

    await expect(service.previewPlan('version-1')).rejects.toMatchObject({
      code: 'PROJECT_CONTRACT_VERSION_NOT_REVENUE_ELIGIBLE',
      statusCode: 409,
    });
  });

  it('persists the calculated plan then returns its waterfall and contract balance', async () => {
    findPersistedPlan
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(persistedPlan());

    const result = await service.generatePlan('version-1');

    expect(persistPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        projectContractVersionId: 'version-1',
        transactionPrice: '108000.00',
        totalAllocated: '108000.00',
      }),
    );
    expect(result).toMatchObject({
      replayed: false,
      summary: {
        totalAllocated: '108000.00',
        totalScheduled: '54000.00',
        totalRecognized: '43200.00',
        remainingAllocation: '64800.00',
      },
    });
    expect(result.waterfall).toEqual([
      expect.objectContaining({ period: '2026-01', scheduled: '5400.00' }),
      expect.objectContaining({
        period: '2026-02',
        scheduled: '48600.00',
        cumulativeRecognized: '43200.00',
      }),
    ]);
  });

  it('replays an existing plan without recalculation or persistence', async () => {
    findPersistedPlan.mockResolvedValue(persistedPlan());

    const result = await service.generatePlan('version-1');

    expect(result.replayed).toBe(true);
    expect(findPlanSource).not.toHaveBeenCalled();
    expect(persistPlan).not.toHaveBeenCalled();
  });
});
