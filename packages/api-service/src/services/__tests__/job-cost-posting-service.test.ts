import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JobCostPostingService } from '../job-cost-posting-service';
import { ServiceError } from '../../types';

const {
  mockFindCostCode,
  mockAccessibleProjects,
  mockGetPeriodForDate,
  mockGenerateGlEntries,
} = vi.hoisted(() => ({
  mockFindCostCode: vi.fn(),
  mockAccessibleProjects: vi.fn(),
  mockGetPeriodForDate: vi.fn(),
  mockGenerateGlEntries: vi.fn(),
}));

vi.mock('@glapi/database', () => ({
  ProjectCostCodeRepository: vi.fn().mockImplementation(() => ({
    getAccessibleProjectIds: mockAccessibleProjects,
    findById: mockFindCostCode,
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

  beforeEach(() => {
    vi.clearAllMocks();
    service = new JobCostPostingService({
      organizationId: 'org-1',
      userId: 'user-1',
    });

    mockAccessibleProjects.mockResolvedValue(['proj-1']);
    mockFindCostCode.mockResolvedValue({
      id: 'cost-1',
      projectId: 'proj-1',
      costCode: 'LAB-100',
      costAccountId: 'acc-expense',
      wipAccountId: 'acc-wip',
    });
    mockGetPeriodForDate.mockResolvedValue({
      id: 'period-1',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      status: 'OPEN',
    });
    mockGenerateGlEntries.mockResolvedValue({
      glTransaction: { id: 'gl-123' },
      glLines: [],
      balanceUpdates: [],
      validationResult: { isBalanced: true, errors: [], totalDebits: 100, totalCredits: 100 },
    });
  });

  it('creates GL posting for labor entries', async () => {
    const result = await service.postLaborEntries([
      {
        id: 'entry-1',
        projectId: 'proj-1',
        costCodeId: 'cost-1',
        amount: 100,
        entryDate: '2024-01-10',
        subsidiaryId: 'sub-1',
        description: 'Labor',
        currencyCode: 'USD',
      },
      {
        id: 'entry-2',
        projectId: 'proj-1',
        costCodeId: 'cost-1',
        amount: 50,
        entryDate: '2024-01-11',
        subsidiaryId: 'sub-1',
        description: 'Labor 2',
        currencyCode: 'USD',
      },
    ]);

    expect(result.glResult.glTransaction.id).toBe('gl-123');
    expect(mockGenerateGlEntries).toHaveBeenCalledTimes(1);
    const postingContext = mockGenerateGlEntries.mock.calls[0][0];
    expect(postingContext.businessTransactionLines).toHaveLength(2);
    expect(postingContext.postingRules).toHaveLength(1);
  });

  it('throws when posting entries with mixed subsidiaries', async () => {
    await expect(
      service.postLaborEntries([
        {
          id: 'entry-1',
          projectId: 'proj-1',
          costCodeId: 'cost-1',
          amount: 100,
          entryDate: '2024-01-10',
          subsidiaryId: 'sub-1',
          description: 'Labor',
        },
        {
          id: 'entry-2',
          projectId: 'proj-1',
          costCodeId: 'cost-1',
          amount: 75,
          entryDate: '2024-01-11',
          subsidiaryId: 'sub-2',
          description: 'Labor',
        },
      ])
    ).rejects.toThrow(ServiceError);
  });

  it('throws when cost code lacks accounts', async () => {
    mockFindCostCode.mockResolvedValueOnce({
      id: 'cost-2',
      projectId: 'proj-1',
      costCode: 'LAB-200',
      costAccountId: null,
      wipAccountId: null,
    });

    await expect(
      service.postLaborEntries([
        {
          id: 'entry-1',
          projectId: 'proj-1',
          costCodeId: 'cost-2',
          amount: 10,
          entryDate: '2024-01-15',
          subsidiaryId: 'sub-1',
          description: 'Labor',
        },
      ])
    ).rejects.toThrow('Cost code LAB-200 missing cost or WIP accounts');
  });
});
