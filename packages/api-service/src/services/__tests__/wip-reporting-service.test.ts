import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WipReportingService } from '../wip-reporting-service';
import { WipReportingRepository } from '@glapi/database';

vi.mock('@glapi/database', () => ({
  WipReportingRepository: vi.fn().mockImplementation(() => ({
    getWipSummary: vi.fn(),
    getPercentComplete: vi.fn(),
    getRetainageAging: vi.fn(),
    refreshViews: vi.fn(),
    getRefreshHistory: vi.fn(),
    getLastRefreshTime: vi.fn(),
  })),
}));

describe('WipReportingService', () => {
  let service: WipReportingService;
  let mockRepository: ReturnType<typeof WipReportingRepository>;

  const mockOrgId = 'org-123';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WipReportingService({ organizationId: mockOrgId });
    mockRepository = (WipReportingRepository as unknown as ReturnType<typeof vi.fn>).mock
      .results[0].value;
  });

  describe('getWipSummary', () => {
    it('should return WIP summary data for all projects', async () => {
      const mockData = [
        {
          projectId: 'proj-1',
          organizationId: mockOrgId,
          subsidiaryId: 'sub-1',
          projectCode: 'PRJ-001',
          projectName: 'Office Building',
          projectStatus: 'active',
          retainagePercent: '10.00',
          totalBudgetAmount: '1000000.00',
          budgetLabor: '400000.00',
          budgetMaterial: '300000.00',
          budgetEquipment: '100000.00',
          budgetSubcontract: '150000.00',
          budgetOther: '50000.00',
          totalCommittedAmount: '450000.00',
          totalActualCost: '350000.00',
          totalBilledAmount: '300000.00',
          totalCollectedAmount: '250000.00',
          totalRetainageHeld: '30000.00',
          wipBalance: '50000.00',
          underbillings: '50000.00',
          overbillings: '0.00',
          actualLabor: '140000.00',
          actualMaterial: '100000.00',
          actualEquipment: '40000.00',
          actualSubcontract: '50000.00',
          actualOther: '20000.00',
          budgetVariance: '650000.00',
          projectCreatedAt: new Date('2025-01-01'),
          projectStartDate: '2025-02-01',
          projectEndDate: '2026-06-30',
          refreshedAt: new Date('2026-01-19T10:00:00Z'),
        },
      ];

      mockRepository.getWipSummary.mockResolvedValue(mockData);

      const result = await service.getWipSummary();

      expect(mockRepository.getWipSummary).toHaveBeenCalledWith(mockOrgId, {});
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        projectId: 'proj-1',
        projectCode: 'PRJ-001',
        projectName: 'Office Building',
        totalBudgetAmount: '1000000.00',
        wipBalance: '50000.00',
        underbillings: '50000.00',
        overbillings: '0.00',
        budgetByType: {
          labor: '400000.00',
          material: '300000.00',
          equipment: '100000.00',
          subcontract: '150000.00',
          other: '50000.00',
        },
      });
    });

    it('should filter by underbillings', async () => {
      mockRepository.getWipSummary.mockResolvedValue([]);

      await service.getWipSummary({ hasUnderbillings: true });

      expect(mockRepository.getWipSummary).toHaveBeenCalledWith(mockOrgId, {
        hasUnderbillings: true,
      });
    });

    it('should filter by project ID', async () => {
      mockRepository.getWipSummary.mockResolvedValue([]);

      await service.getWipSummary({ projectId: 'proj-1' });

      expect(mockRepository.getWipSummary).toHaveBeenCalledWith(mockOrgId, { projectId: 'proj-1' });
    });
  });

  describe('getPercentComplete', () => {
    it('should return percent complete data for all projects', async () => {
      const mockData = [
        {
          projectId: 'proj-1',
          organizationId: mockOrgId,
          subsidiaryId: 'sub-1',
          projectCode: 'PRJ-001',
          projectName: 'Office Building',
          projectStatus: 'active',
          budgetAtCompletion: '1000000.00',
          actualCost: '350000.00',
          committedCost: '450000.00',
          estimateToComplete: '600000.00',
          estimateAtCompletion: '950000.00',
          costPercentComplete: '35.00',
          earnedValue: '350000.00',
          remainingBudget: '650000.00',
          projectedVariance: '50000.00',
          costPerformanceIndex: '1.05',
          varianceAtCompletion: '50000.00',
          laborPercentComplete: '35.00',
          materialPercentComplete: '33.33',
          subcontractPercentComplete: '33.33',
          lastSnapshotDate: '2026-01-15',
          snapshotPercentComplete: '33.00',
          refreshedAt: new Date('2026-01-19T10:00:00Z'),
        },
      ];

      mockRepository.getPercentComplete.mockResolvedValue(mockData);

      const result = await service.getPercentComplete();

      expect(mockRepository.getPercentComplete).toHaveBeenCalledWith(mockOrgId, {});
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        projectId: 'proj-1',
        costPercentComplete: '35.00',
        costPerformanceIndex: '1.05',
        earnedValue: '350000.00',
      });
    });

    it('should filter by percent complete range', async () => {
      mockRepository.getPercentComplete.mockResolvedValue([]);

      await service.getPercentComplete({ minPercentComplete: 25, maxPercentComplete: 75 });

      expect(mockRepository.getPercentComplete).toHaveBeenCalledWith(mockOrgId, {
        minPercentComplete: 25,
        maxPercentComplete: 75,
      });
    });
  });

  describe('getRetainageAging', () => {
    it('should return retainage aging data', async () => {
      const mockData = [
        {
          projectId: 'proj-1',
          organizationId: mockOrgId,
          subsidiaryId: 'sub-1',
          projectCode: 'PRJ-001',
          projectName: 'Office Building',
          retainagePercent: '10.00',
          totalRetainageHeld: '30000.00',
          retainageCurrent: '10000.00',
          retainage30Days: '8000.00',
          retainage60Days: '6000.00',
          retainage90Days: '4000.00',
          retainageOver90: '2000.00',
          retainageReleased: '5000.00',
          retainageOutstanding: '25000.00',
          expectedReleaseDate: '2026-06-30',
          refreshedAt: new Date('2026-01-19T10:00:00Z'),
        },
      ];

      mockRepository.getRetainageAging.mockResolvedValue(mockData);

      const result = await service.getRetainageAging();

      expect(mockRepository.getRetainageAging).toHaveBeenCalledWith(mockOrgId, {});
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        projectId: 'proj-1',
        totalRetainageHeld: '30000.00',
        retainageOutstanding: '25000.00',
        current: '10000.00',
        days30: '8000.00',
        days60: '6000.00',
        days90: '4000.00',
        over90: '2000.00',
      });
    });
  });

  describe('refreshViews', () => {
    it('should trigger view refresh and return results', async () => {
      const mockResults = [
        { viewName: 'project_wip_summary', durationMs: 150, rowCount: 25 },
        { viewName: 'project_percent_complete', durationMs: 120, rowCount: 25 },
        { viewName: 'project_retainage_aging', durationMs: 80, rowCount: 10 },
      ];

      mockRepository.refreshViews.mockResolvedValue(mockResults);

      const result = await service.refreshViews('scheduled');

      expect(mockRepository.refreshViews).toHaveBeenCalledWith('scheduled');
      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        viewName: 'project_wip_summary',
        durationMs: 150,
        rowCount: 25,
      });
    });
  });

  describe('getWipDashboard', () => {
    it('should return aggregated dashboard data', async () => {
      const mockWipData = [
        {
          projectId: 'proj-1',
          organizationId: mockOrgId,
          subsidiaryId: null,
          projectCode: 'PRJ-001',
          projectName: 'Project 1',
          projectStatus: 'active',
          retainagePercent: '10.00',
          totalBudgetAmount: '500000.00',
          budgetLabor: '200000.00',
          budgetMaterial: '150000.00',
          budgetEquipment: '50000.00',
          budgetSubcontract: '75000.00',
          budgetOther: '25000.00',
          totalCommittedAmount: '200000.00',
          totalActualCost: '175000.00',
          totalBilledAmount: '150000.00',
          totalCollectedAmount: '125000.00',
          totalRetainageHeld: '15000.00',
          wipBalance: '25000.00',
          underbillings: '25000.00',
          overbillings: '0.00',
          actualLabor: '70000.00',
          actualMaterial: '50000.00',
          actualEquipment: '20000.00',
          actualSubcontract: '25000.00',
          actualOther: '10000.00',
          budgetVariance: '325000.00',
          projectCreatedAt: new Date('2025-01-01'),
          projectStartDate: '2025-02-01',
          projectEndDate: '2026-06-30',
          refreshedAt: new Date('2026-01-19T10:00:00Z'),
        },
        {
          projectId: 'proj-2',
          organizationId: mockOrgId,
          subsidiaryId: null,
          projectCode: 'PRJ-002',
          projectName: 'Project 2',
          projectStatus: 'active',
          retainagePercent: '10.00',
          totalBudgetAmount: '500000.00',
          budgetLabor: '200000.00',
          budgetMaterial: '150000.00',
          budgetEquipment: '50000.00',
          budgetSubcontract: '75000.00',
          budgetOther: '25000.00',
          totalCommittedAmount: '300000.00',
          totalActualCost: '275000.00',
          totalBilledAmount: '300000.00',
          totalCollectedAmount: '275000.00',
          totalRetainageHeld: '30000.00',
          wipBalance: '-25000.00',
          underbillings: '0.00',
          overbillings: '25000.00',
          actualLabor: '110000.00',
          actualMaterial: '80000.00',
          actualEquipment: '30000.00',
          actualSubcontract: '40000.00',
          actualOther: '15000.00',
          budgetVariance: '225000.00',
          projectCreatedAt: new Date('2025-03-01'),
          projectStartDate: '2025-04-01',
          projectEndDate: '2026-08-31',
          refreshedAt: new Date('2026-01-19T10:00:00Z'),
        },
      ];

      mockRepository.getWipSummary.mockResolvedValue(mockWipData);
      mockRepository.getLastRefreshTime.mockResolvedValue(new Date('2026-01-19T10:00:00Z'));

      const result = await service.getWipDashboard();

      expect(result.summary).toMatchObject({
        totalProjects: 2,
        totalBudget: 1000000,
        totalActualCost: 450000,
        totalUnderbillings: 25000,
        totalOverbillings: 25000,
        totalRetainageHeld: 45000,
      });
      expect(result.projectsWithUnderbillings).toHaveLength(1);
      expect(result.projectsWithOverbillings).toHaveLength(1);
      expect(result.lastRefreshed).toBe('2026-01-19T10:00:00.000Z');
    });
  });

  describe('getPercentCompleteDashboard', () => {
    it('should return aggregated percent complete dashboard', async () => {
      const mockPctData = [
        {
          projectId: 'proj-1',
          organizationId: mockOrgId,
          subsidiaryId: null,
          projectCode: 'PRJ-001',
          projectName: 'Project 1',
          projectStatus: 'active',
          budgetAtCompletion: '500000.00',
          actualCost: '175000.00',
          committedCost: '200000.00',
          estimateToComplete: '300000.00',
          estimateAtCompletion: '475000.00',
          costPercentComplete: '35.00',
          earnedValue: '175000.00',
          remainingBudget: '325000.00',
          projectedVariance: '25000.00',
          costPerformanceIndex: '1.05',
          varianceAtCompletion: '25000.00',
          laborPercentComplete: '35.00',
          materialPercentComplete: '33.33',
          subcontractPercentComplete: '33.33',
          lastSnapshotDate: '2026-01-15',
          snapshotPercentComplete: '33.00',
          refreshedAt: new Date('2026-01-19T10:00:00Z'),
        },
        {
          projectId: 'proj-2',
          organizationId: mockOrgId,
          subsidiaryId: null,
          projectCode: 'PRJ-002',
          projectName: 'Project 2',
          projectStatus: 'active',
          budgetAtCompletion: '500000.00',
          actualCost: '275000.00',
          committedCost: '300000.00',
          estimateToComplete: '250000.00',
          estimateAtCompletion: '525000.00',
          costPercentComplete: '55.00',
          earnedValue: '275000.00',
          remainingBudget: '225000.00',
          projectedVariance: '-25000.00',
          costPerformanceIndex: '0.85',
          varianceAtCompletion: '-25000.00',
          laborPercentComplete: '55.00',
          materialPercentComplete: '53.33',
          subcontractPercentComplete: '53.33',
          lastSnapshotDate: '2026-01-15',
          snapshotPercentComplete: '52.00',
          refreshedAt: new Date('2026-01-19T10:00:00Z'),
        },
      ];

      mockRepository.getPercentComplete.mockResolvedValue(mockPctData);
      mockRepository.getLastRefreshTime.mockResolvedValue(new Date('2026-01-19T10:00:00Z'));

      const result = await service.getPercentCompleteDashboard();

      expect(result.summary).toMatchObject({
        totalProjects: 2,
        averagePercentComplete: 45,
        totalBudgetAtCompletion: 1000000,
        totalActualCost: 450000,
      });
      expect(result.projectsBehindSchedule).toHaveLength(1);
      expect(result.projectsBehindSchedule[0].projectId).toBe('proj-2');
      expect(result.projectsAtRisk).toHaveLength(1);
      expect(result.projectsAtRisk[0].projectId).toBe('proj-2');
    });
  });
});
