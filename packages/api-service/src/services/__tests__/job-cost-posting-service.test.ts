import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JobCostPostingService } from '../job-cost-posting-service';
import { ServiceContext } from '../../types';

const {
  mockFindById,
  mockGetAccessibleProjectIds,
  mockGetJobCostSummary,
  mockCreateSnapshots,
  mockGetPeriodForDate,
  mockGenerateGlEntries,
} = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockGetAccessibleProjectIds: vi.fn(),
  mockGetJobCostSummary: vi.fn(),
  mockCreateSnapshots: vi.fn(),
  mockGetPeriodForDate: vi.fn(),
  mockGenerateGlEntries: vi.fn(),
}));

vi.mock('@glapi/database', () => ({
  ProjectCostCodeRepository: vi.fn().mockImplementation(() => ({
    findById: mockFindById,
    getAccessibleProjectIds: mockGetAccessibleProjectIds,
  })),
  ProjectReportingRepository: vi.fn().mockImplementation(() => ({
    getJobCostSummary: mockGetJobCostSummary,
  })),
  ProjectProgressSnapshotRepository: vi.fn().mockImplementation(() => ({
    createSnapshots: mockCreateSnapshots,
  })),
}));

vi.mock('../accounting-period-service', () => ({
  AccountingPeriodService: vi.fn().mockImplementation(() => ({
    getPeriodForDate: mockGetPeriodForDate,
  })),
}));

vi.mock('../gl-posting-engine', () => ({
  GlPostingEngine: vi.fn().mockImplementation(() => ({
    generateGlEntries: mockGenerateGlEntries,
  })),
}));

describe('JobCostPostingService', () => {
  let service: JobCostPostingService;
  const context: ServiceContext = { organizationId: 'org-1', userId: 'user-1' };

  const testProjectId = 'proj-1';
  const testCostCodeId = 'cc-1';
  const testSubsidiaryId = 'sub-1';

  const mockCostCode = {
    id: testCostCodeId,
    projectId: testProjectId,
    costCode: '010-001',
    name: 'Site Work',
    costType: 'LABOR',
    costAccountId: 'acc-cost-1',
    wipAccountId: 'acc-wip-1',
  };

  const mockPeriod = {
    id: 'period-1',
    startDate: '2025-01-01',
    endDate: '2025-01-31',
    status: 'OPEN',
  };

  const mockGlResult = {
    glTransaction: {
      id: 'gl-txn-1',
      transactionNumber: 'JOB-001',
      status: 'POSTED',
    },
    glTransactionLines: [
      { id: 'gl-line-1', debitAmount: '1000', creditAmount: '0' },
      { id: 'gl-line-2', debitAmount: '0', creditAmount: '1000' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new JobCostPostingService(context);

    mockGetAccessibleProjectIds.mockResolvedValue([testProjectId]);
    mockFindById.mockResolvedValue(mockCostCode);
    mockGetPeriodForDate.mockResolvedValue(mockPeriod);
    mockGenerateGlEntries.mockResolvedValue(mockGlResult);
    mockGetJobCostSummary.mockResolvedValue([
      {
        projectId: testProjectId,
        totalBudgetAmount: '10000',
        totalActualCost: '2000',
        percentComplete: '20',
      },
    ]);
    mockCreateSnapshots.mockResolvedValue([{ id: 'snap-1' }]);
  });

  describe('postLaborEntries', () => {
    const laborEntries = [
      {
        id: 'labor-1',
        projectId: testProjectId,
        costCodeId: testCostCodeId,
        amount: 1000,
        entryDate: '2025-01-15',
        subsidiaryId: testSubsidiaryId,
        description: 'Labor for site work',
        currencyCode: 'USD',
      },
    ];

    it('posts labor entries and generates GL transaction', async () => {
      const result = await service.postLaborEntries(laborEntries);

      expect(result.glResult).toBeDefined();
      expect(result.glResult.glTransaction.id).toBe('gl-txn-1');
      expect(mockGenerateGlEntries).toHaveBeenCalled();
    });

    it('records progress snapshots after posting', async () => {
      await service.postLaborEntries(laborEntries);

      expect(mockCreateSnapshots).toHaveBeenCalled();
      const snapshotCall = mockCreateSnapshots.mock.calls[0][0];
      expect(snapshotCall[0].projectId).toBe(testProjectId);
      expect(snapshotCall[0].sourceGlTransactionId).toBe('gl-txn-1');
    });

    it('throws error when no entries provided', async () => {
      await expect(service.postLaborEntries([])).rejects.toThrow(
        'No labor entries provided for posting'
      );
    });

    it('throws error when entries have mixed subsidiaries', async () => {
      const mixedEntries = [
        { ...laborEntries[0] },
        { ...laborEntries[0], id: 'labor-2', subsidiaryId: 'other-sub' },
      ];

      await expect(service.postLaborEntries(mixedEntries)).rejects.toThrow(
        'All entries must belong to the same subsidiary'
      );
    });

    it('throws error when cost code not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(service.postLaborEntries(laborEntries)).rejects.toThrow(
        'Cost code not found'
      );
    });

    it('throws error when no accounting period found', async () => {
      mockGetPeriodForDate.mockResolvedValue(null);

      await expect(service.postLaborEntries(laborEntries)).rejects.toThrow(
        'No open accounting period for posting date'
      );
    });

    it('throws error when entry date outside period', async () => {
      const outOfPeriodEntries = [
        { ...laborEntries[0], entryDate: '2025-02-15' },
      ];

      await expect(service.postLaborEntries(outOfPeriodEntries)).rejects.toThrow(
        'All entries must fall within the accounting period for posting'
      );
    });

    it('throws error when cost code missing accounts', async () => {
      mockFindById.mockResolvedValue({
        ...mockCostCode,
        costAccountId: null,
        wipAccountId: null,
      });

      await expect(service.postLaborEntries(laborEntries)).rejects.toThrow(
        'missing cost or WIP accounts'
      );
    });
  });

  describe('postExpenseEntries', () => {
    const expenseEntries = [
      {
        id: 'exp-1',
        projectId: testProjectId,
        costCodeId: testCostCodeId,
        amount: 500,
        expenseDate: '2025-01-20',
        subsidiaryId: testSubsidiaryId,
        description: 'Material expense',
        currencyCode: 'USD',
      },
    ];

    it('posts expense entries and generates GL transaction', async () => {
      const result = await service.postExpenseEntries(expenseEntries);

      expect(result.glResult).toBeDefined();
      expect(result.glResult.glTransaction.id).toBe('gl-txn-1');
    });

    it('records progress snapshots after posting', async () => {
      await service.postExpenseEntries(expenseEntries);

      expect(mockCreateSnapshots).toHaveBeenCalled();
    });

    it('throws error when no entries provided', async () => {
      await expect(service.postExpenseEntries([])).rejects.toThrow(
        'No expense entries provided for posting'
      );
    });

    it('throws error when entries have mixed currencies', async () => {
      const mixedCurrencyEntries = [
        { ...expenseEntries[0] },
        { ...expenseEntries[0], id: 'exp-2', currencyCode: 'EUR' },
      ];

      await expect(service.postExpenseEntries(mixedCurrencyEntries)).rejects.toThrow(
        'All entries must share a currency'
      );
    });
  });

  describe('posting multiple entries', () => {
    it('handles multiple entries for same cost code efficiently', async () => {
      const multipleEntries = [
        {
          id: 'labor-1',
          projectId: testProjectId,
          costCodeId: testCostCodeId,
          amount: 1000,
          entryDate: '2025-01-15',
          subsidiaryId: testSubsidiaryId,
          description: 'Labor entry 1',
          currencyCode: 'USD',
        },
        {
          id: 'labor-2',
          projectId: testProjectId,
          costCodeId: testCostCodeId,
          amount: 2000,
          entryDate: '2025-01-16',
          subsidiaryId: testSubsidiaryId,
          description: 'Labor entry 2',
          currencyCode: 'USD',
        },
      ];

      const result = await service.postLaborEntries(multipleEntries);

      expect(result.glResult).toBeDefined();
      // Cost code should only be fetched once due to caching
      expect(mockFindById).toHaveBeenCalledTimes(1);
    });

    it('handles entries across multiple cost codes', async () => {
      const secondCostCodeId = 'cc-2';
      const secondCostCode = {
        ...mockCostCode,
        id: secondCostCodeId,
        costCode: '020-001',
        costAccountId: 'acc-cost-2',
        wipAccountId: 'acc-wip-2',
      };

      mockFindById
        .mockResolvedValueOnce(mockCostCode)
        .mockResolvedValueOnce(secondCostCode);

      const multiCodeEntries = [
        {
          id: 'labor-1',
          projectId: testProjectId,
          costCodeId: testCostCodeId,
          amount: 1000,
          entryDate: '2025-01-15',
          subsidiaryId: testSubsidiaryId,
          description: 'Labor entry 1',
          currencyCode: 'USD',
        },
        {
          id: 'labor-2',
          projectId: testProjectId,
          costCodeId: secondCostCodeId,
          amount: 2000,
          entryDate: '2025-01-16',
          subsidiaryId: testSubsidiaryId,
          description: 'Labor entry 2',
          currencyCode: 'USD',
        },
      ];

      const result = await service.postLaborEntries(multiCodeEntries);

      expect(result.glResult).toBeDefined();
      expect(mockFindById).toHaveBeenCalledTimes(2);
    });
  });
});
