import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectReportingService } from '../project-reporting-service';
import { ServiceContext } from '../../types';

const { mockGetJobCostSummary } = vi.hoisted(() => ({
  mockGetJobCostSummary: vi.fn(),
}));

vi.mock('@glapi/database', () => ({
  ProjectReportingRepository: vi.fn().mockImplementation(() => ({
    getJobCostSummary: mockGetJobCostSummary,
  })),
}));

describe('ProjectReportingService', () => {
  let service: ProjectReportingService;
  const context: ServiceContext = { organizationId: 'org-123', userId: 'user-456' };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProjectReportingService(context);
  });

  it('returns mapped job cost summary rows', async () => {
    mockGetJobCostSummary.mockResolvedValue([
      {
        projectId: 'proj-1',
        projectName: 'Project One',
        projectCode: 'P-001',
        subsidiaryId: 'sub-1',
        totalBudgetAmount: '100000',
        totalCommittedAmount: '25000',
        totalActualCost: '15000',
        totalWipClearing: '-15000',
        percentComplete: '15',
        lastPostedAt: '2025-01-15T00:00:00.000Z',
      },
    ]);

    const result = await service.listJobCostSummary();
    expect(result).toHaveLength(1);
    expect(result[0].projectId).toBe('proj-1');
    expect(result[0].totalActualCost).toBe('15000');
    expect(mockGetJobCostSummary).toHaveBeenCalledWith('org-123', {});
  });

  it('passes filters down to repository', async () => {
    mockGetJobCostSummary.mockResolvedValue([]);
    await service.listJobCostSummary({ projectId: 'proj-2', search: 'Alpha' });
    expect(mockGetJobCostSummary).toHaveBeenCalledWith('org-123', {
      projectId: 'proj-2',
      search: 'Alpha',
    });
  });

  it('throws if organization context missing', async () => {
    const missingContextService = new ProjectReportingService({});
    await expect(missingContextService.listJobCostSummary()).rejects.toThrow('organization');
  });
});
