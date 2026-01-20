import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectReportingService } from '../project-reporting-service';
import { ServiceContext } from '../../types';

const {
  mockGetSummary,
  mockListSnapshots,
  mockGetAccessibleProjectIds,
  mockFindVersionById,
  mockGetCurrentVersion,
  mockFindLinesWithCostCodes,
  mockGetVarianceSummary,
} = vi.hoisted(() => ({
  mockGetSummary: vi.fn(),
  mockListSnapshots: vi.fn(),
  mockGetAccessibleProjectIds: vi.fn(),
  mockFindVersionById: vi.fn(),
  mockGetCurrentVersion: vi.fn(),
  mockFindLinesWithCostCodes: vi.fn(),
  mockGetVarianceSummary: vi.fn(),
}));

vi.mock('@glapi/database', () => ({
  ProjectReportingRepository: vi.fn().mockImplementation(() => ({
    getJobCostSummary: mockGetSummary,
  })),
  ProjectProgressSnapshotRepository: vi.fn().mockImplementation(() => ({
    listByProject: mockListSnapshots,
  })),
  ProjectBudgetRepository: vi.fn().mockImplementation(() => ({
    getAccessibleProjectIds: mockGetAccessibleProjectIds,
    findVersionById: mockFindVersionById,
    getCurrentVersion: mockGetCurrentVersion,
    findLinesWithCostCodes: mockFindLinesWithCostCodes,
    getVarianceSummary: mockGetVarianceSummary,
  })),
}));

describe('ProjectReportingService', () => {
  let service: ProjectReportingService;
  const context: ServiceContext = { organizationId: 'org-1', userId: 'user-9' };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProjectReportingService(context);
  });

  describe('listJobCostSummary', () => {
    it('lists job cost summaries', async () => {
      mockGetSummary.mockResolvedValue([
        {
          projectId: 'proj-1',
          projectName: 'Project One',
          projectCode: 'PRJ-001',
          subsidiaryId: 'sub-1',
          totalBudgetAmount: '1000',
          totalCommittedAmount: '500',
          totalActualCost: '250',
          totalWipClearing: '-250',
          percentComplete: '25',
          lastPostedAt: '2025-01-10T00:00:00.000Z',
        },
      ]);

      const result = await service.listJobCostSummary();
      expect(result).toHaveLength(1);
      expect(result[0].projectId).toBe('proj-1');
      expect(mockGetSummary).toHaveBeenCalledWith('org-1', {});
    });
  });

  describe('listProgressHistory', () => {
    it('returns progress history snapshots', async () => {
      const now = new Date();
      mockListSnapshots.mockResolvedValue([
        {
          id: 'snap-1',
          organizationId: 'org-1',
          projectId: 'proj-1',
          snapshotDate: '2025-01-10',
          totalBudgetAmount: '1000',
          totalCommittedAmount: '500',
          totalActualCost: '400',
          totalWipClearing: '-400',
          percentComplete: '40',
          sourceGlTransactionId: 'gl-1',
          metadata: null,
          createdAt: now,
        },
      ]);

      const history = await service.listProgressHistory('proj-1');
      expect(history).toHaveLength(1);
      expect(history[0].percentComplete).toBe('40');
      expect(mockListSnapshots).toHaveBeenCalledWith('proj-1', 'org-1', 12);
    });
  });

  describe('getBudgetVarianceReport', () => {
    const projectId = 'proj-1';
    const budgetVersionId = 'bv-1';

    beforeEach(() => {
      mockGetAccessibleProjectIds.mockResolvedValue([projectId]);
      mockGetCurrentVersion.mockResolvedValue({
        id: budgetVersionId,
        projectId,
        versionName: 'Version 1',
        totalBudgetAmount: '10000',
      });
      mockFindLinesWithCostCodes.mockResolvedValue([
        {
          line: {
            id: 'line-1',
            originalBudgetAmount: '5000',
            revisedBudgetAmount: '5000',
            committedAmount: '3000',
            actualAmount: '2500',
            encumberedAmount: '500',
            estimateToComplete: '2500',
            estimateAtCompletion: '5000',
          },
          costCode: {
            id: 'cc-1',
            costCode: '010-001',
            name: 'Site Preparation',
            costType: 'LABOR',
          },
        },
        {
          line: {
            id: 'line-2',
            originalBudgetAmount: '3000',
            revisedBudgetAmount: '3000',
            committedAmount: '1500',
            actualAmount: '1000',
            encumberedAmount: '200',
            estimateToComplete: '2000',
            estimateAtCompletion: '3000',
          },
          costCode: {
            id: 'cc-2',
            costCode: '020-001',
            name: 'Concrete Materials',
            costType: 'MATERIAL',
          },
        },
      ]);
      mockGetVarianceSummary.mockResolvedValue([
        {
          costType: 'LABOR',
          totalBudget: '5000',
          totalActual: '2500',
          totalCommitted: '3000',
          totalVariance: '2500',
        },
        {
          costType: 'MATERIAL',
          totalBudget: '3000',
          totalActual: '1000',
          totalCommitted: '1500',
          totalVariance: '2000',
        },
      ]);
      mockGetSummary.mockResolvedValue([
        {
          projectId,
          projectName: 'Test Project',
          projectCode: 'PRJ-001',
          totalActualCost: '3500',
          totalCommittedAmount: '4500',
        },
      ]);
    });

    it('returns budget variance report with line details', async () => {
      const result = await service.getBudgetVarianceReport({ projectId });

      expect(result.projectId).toBe(projectId);
      expect(result.budgetVersionId).toBe(budgetVersionId);
      expect(result.byLine).toHaveLength(2);
      expect(result.byLine[0].costCode).toBe('010-001');
      expect(result.byLine[0].costType).toBe('LABOR');
      expect(result.byLine[1].costType).toBe('MATERIAL');
    });

    it('returns cost type breakdown', async () => {
      const result = await service.getBudgetVarianceReport({ projectId });

      expect(result.byCostType).toHaveLength(2);
      expect(result.byCostType[0].costType).toBe('LABOR');
      expect(result.byCostType[0].totalBudget).toBe('5000');
      expect(result.byCostType[1].costType).toBe('MATERIAL');
    });

    it('calculates variance correctly', async () => {
      const result = await service.getBudgetVarianceReport({ projectId });

      // Line 1: 5000 budget - 2500 actual = 2500 variance
      expect(result.byLine[0].varianceAmount).toBe('2500.00');
      expect(result.byLine[0].variancePercent).toBe('50.00');

      // Line 2: 3000 budget - 1000 actual = 2000 variance
      expect(result.byLine[1].varianceAmount).toBe('2000.00');
      expect(parseFloat(result.byLine[1].variancePercent)).toBeCloseTo(66.67, 1);
    });

    it('uses specified budget version when provided', async () => {
      const specificVersionId = 'bv-2';
      mockFindVersionById.mockResolvedValue({
        id: specificVersionId,
        projectId,
        versionName: 'Version 2',
        totalBudgetAmount: '12000',
      });

      const result = await service.getBudgetVarianceReport({
        projectId,
        budgetVersionId: specificVersionId,
      });

      expect(result.budgetVersionId).toBe(specificVersionId);
      expect(mockFindVersionById).toHaveBeenCalledWith(specificVersionId, [projectId]);
    });

    it('filters by cost type when specified', async () => {
      const result = await service.getBudgetVarianceReport({
        projectId,
        costType: 'LABOR',
      });

      expect(result.byLine).toHaveLength(1);
      expect(result.byLine[0].costType).toBe('LABOR');
    });

    it('throws error when project not accessible', async () => {
      mockGetAccessibleProjectIds.mockResolvedValue(['other-project']);

      await expect(service.getBudgetVarianceReport({ projectId })).rejects.toThrow(
        'Project not found or not accessible'
      );
    });

    it('throws error when no budget version exists', async () => {
      mockGetCurrentVersion.mockResolvedValue(null);

      await expect(service.getBudgetVarianceReport({ projectId })).rejects.toThrow(
        'No budget version found for project'
      );
    });

    it('includes summary totals', async () => {
      const result = await service.getBudgetVarianceReport({ projectId });

      expect(result.summary).toBeDefined();
      expect(result.summary.totalBudgetAmount).toBeDefined();
      expect(result.summary.totalActualAmount).toBeDefined();
      expect(result.summary.variancePercent).toBeDefined();
      expect(result.summary.percentComplete).toBeDefined();
    });
  });
});
