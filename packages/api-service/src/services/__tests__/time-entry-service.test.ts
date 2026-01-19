import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceContext } from '../../types';

// Use vi.hoisted() to properly hoist mock functions for use in vi.mock factory
const {
  mockFindAll,
  mockFindById,
  mockFindByIdWithRelations,
  mockCreate,
  mockUpdate,
  mockDelete,
  mockSubmit,
  mockApprove,
  mockReject,
  mockReturnToDraft,
  mockFindApplicableLaborRate,
  mockIsEmployeeAssignedToProject,
  mockFindEmployeeAssignments,
  mockFindLaborRates,
  mockCreateLaborRate,
  mockCreateEmployeeAssignment,
  mockUpdateEmployeeAssignment,
  mockMarkAsPosted,
  mockGetTotalHours,
  mockGetProjectTotalCost,
  mockGenerateBatchNumber,
  mockCreatePostingBatch,
  mockUpdateAssignmentHours,
} = vi.hoisted(() => ({
  mockFindAll: vi.fn(),
  mockFindById: vi.fn(),
  mockFindByIdWithRelations: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockSubmit: vi.fn(),
  mockApprove: vi.fn(),
  mockReject: vi.fn(),
  mockReturnToDraft: vi.fn(),
  mockFindApplicableLaborRate: vi.fn(),
  mockIsEmployeeAssignedToProject: vi.fn(),
  mockFindEmployeeAssignments: vi.fn(),
  mockFindLaborRates: vi.fn(),
  mockCreateLaborRate: vi.fn(),
  mockCreateEmployeeAssignment: vi.fn(),
  mockUpdateEmployeeAssignment: vi.fn(),
  mockMarkAsPosted: vi.fn(),
  mockGetTotalHours: vi.fn(),
  mockGetProjectTotalCost: vi.fn(),
  mockGenerateBatchNumber: vi.fn(),
  mockCreatePostingBatch: vi.fn(),
  mockUpdateAssignmentHours: vi.fn(),
}));

// Mock the database module
vi.mock('@glapi/database', () => ({
  TimeEntryRepository: vi.fn().mockImplementation(() => ({
    findAll: mockFindAll,
    findById: mockFindById,
    findByIdWithRelations: mockFindByIdWithRelations,
    create: mockCreate,
    update: mockUpdate,
    delete: mockDelete,
    submit: mockSubmit,
    approve: mockApprove,
    reject: mockReject,
    returnToDraft: mockReturnToDraft,
    findApplicableLaborRate: mockFindApplicableLaborRate,
    isEmployeeAssignedToProject: mockIsEmployeeAssignedToProject,
    findEmployeeAssignments: mockFindEmployeeAssignments,
    findLaborRates: mockFindLaborRates,
    createLaborRate: mockCreateLaborRate,
    createEmployeeAssignment: mockCreateEmployeeAssignment,
    updateEmployeeAssignment: mockUpdateEmployeeAssignment,
    markAsPosted: mockMarkAsPosted,
    getTotalHours: mockGetTotalHours,
    getProjectTotalCost: mockGetProjectTotalCost,
    generateBatchNumber: mockGenerateBatchNumber,
    createPostingBatch: mockCreatePostingBatch,
    updateAssignmentHours: mockUpdateAssignmentHours,
  })),
}));

// Import after mocking
import { TimeEntryService } from '../time-entry-service';

describe('TimeEntryService', () => {
  let service: TimeEntryService;
  let context: ServiceContext;

  const testUserId = 'user-123';
  const testOrgId = 'org-123';
  const testEmployeeId = 'emp-123';
  const testProjectId = 'proj-123';

  const mockTimeEntry = {
    id: 'entry-123',
    organizationId: testOrgId,
    subsidiaryId: null,
    employeeId: testEmployeeId,
    projectId: testProjectId,
    costCodeId: null,
    entryDate: '2024-01-15',
    hours: '8.00',
    entryType: 'REGULAR',
    isBillable: true,
    billingRate: '150.00',
    laborRate: '75.00',
    laborCost: '600.00',
    burdenRate: '25.00',
    burdenCost: '200.00',
    totalCost: '800.00',
    description: 'Development work',
    internalNotes: null,
    status: 'DRAFT',
    submittedAt: null,
    submittedBy: null,
    approvedAt: null,
    approvedBy: null,
    rejectedAt: null,
    rejectedBy: null,
    rejectionReason: null,
    postedAt: null,
    glTransactionId: null,
    glPostingBatchId: null,
    externalId: null,
    externalSource: null,
    metadata: null,
    createdBy: testUserId,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  };

  const mockLaborRateData = {
    id: 'rate-123',
    organizationId: testOrgId,
    subsidiaryId: null,
    employeeId: testEmployeeId,
    projectId: null,
    costCodeId: null,
    laborRole: null,
    laborRate: '75.00',
    burdenRate: '25.00',
    billingRate: '150.00',
    overtimeMultiplier: '1.5',
    doubleTimeMultiplier: '2.0',
    effectiveFrom: '2024-01-01',
    effectiveTo: null,
    priority: 0,
    isActive: true,
    currencyCode: 'USD',
    description: null,
    metadata: null,
    createdBy: testUserId,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    context = {
      organizationId: testOrgId,
      userId: testUserId,
    };

    service = new TimeEntryService(context);
  });

  describe('list', () => {
    it('should return paginated time entries', async () => {
      mockFindAll.mockResolvedValue({
        entries: [mockTimeEntry],
        totalCount: 1,
      });

      const result = await service.list({ page: 1, limit: 20 }, {});

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should apply filters', async () => {
      mockFindAll.mockResolvedValue({
        entries: [mockTimeEntry],
        totalCount: 1,
      });

      await service.list({ page: 1, limit: 20 }, { status: 'DRAFT', employeeId: testEmployeeId });

      expect(mockFindAll).toHaveBeenCalledWith(
        testOrgId,
        expect.objectContaining({ status: 'DRAFT', employeeId: testEmployeeId }),
        1,
        20,
        'entryDate',
        'desc'
      );
    });
  });

  describe('create', () => {
    it('should create a time entry with labor costs calculated', async () => {
      mockIsEmployeeAssignedToProject.mockResolvedValue(true);
      mockFindApplicableLaborRate.mockResolvedValue(mockLaborRateData);
      mockCreate.mockResolvedValue(mockTimeEntry);

      const input = {
        employeeId: testEmployeeId,
        projectId: testProjectId,
        entryDate: '2024-01-15',
        hours: '8.00',
        entryType: 'REGULAR' as const,
        isBillable: true,
        description: 'Development work',
      };

      const result = await service.create(input);

      expect(result).toBeTruthy();
      expect(mockCreate).toHaveBeenCalled();
    });

    it('should use employee from context if not provided', async () => {
      // No project specified, so no project assignment check
      mockFindApplicableLaborRate.mockResolvedValue(mockLaborRateData);
      mockCreate.mockResolvedValue({ ...mockTimeEntry, employeeId: testUserId, projectId: null });

      const input = {
        entryDate: '2024-01-15',
        hours: '8.00',
        entryType: 'REGULAR' as const,
        isBillable: true,
      };

      await service.create(input);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeId: testUserId,
        })
      );
    });
  });

  describe('update', () => {
    it('should update a draft time entry', async () => {
      mockFindById.mockResolvedValue(mockTimeEntry);
      mockFindApplicableLaborRate.mockResolvedValue(mockLaborRateData);
      mockUpdate.mockResolvedValue({ ...mockTimeEntry, hours: '10.00' });

      const result = await service.update('entry-123', { hours: '10.00' });

      expect(result.hours).toBe('10.00');
    });

    it('should throw error when updating non-draft entry', async () => {
      mockFindById.mockResolvedValue({ ...mockTimeEntry, status: 'SUBMITTED' });

      await expect(service.update('entry-123', { hours: '10.00' })).rejects.toThrow(
        'Cannot update time entry with status "SUBMITTED"'
      );
    });
  });

  describe('delete', () => {
    it('should delete a draft time entry', async () => {
      mockFindById.mockResolvedValue(mockTimeEntry);
      mockDelete.mockResolvedValue(undefined);

      await service.delete('entry-123');

      expect(mockDelete).toHaveBeenCalledWith('entry-123', testOrgId);
    });

    it('should throw error when deleting non-draft entry', async () => {
      mockFindById.mockResolvedValue({ ...mockTimeEntry, status: 'APPROVED' });

      await expect(service.delete('entry-123')).rejects.toThrow(
        'Cannot delete time entry with status "APPROVED"'
      );
    });
  });

  describe('submit', () => {
    it('should submit draft entries for approval', async () => {
      const draftEntry = { ...mockTimeEntry, status: 'DRAFT' };
      mockFindById.mockResolvedValue(draftEntry);
      mockSubmit.mockResolvedValue({ ...draftEntry, status: 'SUBMITTED' });

      const result = await service.submit({
        timeEntryIds: ['entry-123'],
        comments: 'Please review',
      });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('SUBMITTED');
    });

    it('should throw error when submitting non-draft entries', async () => {
      mockFindById.mockResolvedValue({ ...mockTimeEntry, status: 'APPROVED' });

      await expect(
        service.submit({
          timeEntryIds: ['entry-123'],
        })
      ).rejects.toThrow('Cannot submit time entry with status "APPROVED"');
    });
  });

  describe('approve', () => {
    it('should approve submitted entries', async () => {
      const submittedEntry = { ...mockTimeEntry, status: 'SUBMITTED', projectId: testProjectId };
      mockFindById.mockResolvedValue(submittedEntry);
      mockFindEmployeeAssignments.mockResolvedValue([{ projectId: testProjectId, canApproveTime: true }]);
      mockApprove.mockResolvedValue({ ...submittedEntry, status: 'APPROVED' });

      const result = await service.approve({
        timeEntryIds: ['entry-123'],
      });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('APPROVED');
    });

    it('should throw error when user cannot approve', async () => {
      const submittedEntry = { ...mockTimeEntry, status: 'SUBMITTED', projectId: testProjectId };
      mockFindById.mockResolvedValue(submittedEntry);
      mockFindEmployeeAssignments.mockResolvedValue([]);

      await expect(
        service.approve({
          timeEntryIds: ['entry-123'],
        })
      ).rejects.toThrow('You do not have permission to approve');
    });
  });

  describe('reject', () => {
    it('should reject submitted entries with reason', async () => {
      const submittedEntry = { ...mockTimeEntry, status: 'SUBMITTED', projectId: testProjectId };
      mockFindById.mockResolvedValue(submittedEntry);
      mockFindEmployeeAssignments.mockResolvedValue([{ projectId: testProjectId, canApproveTime: true }]);
      mockReject.mockResolvedValue({
        ...submittedEntry,
        status: 'REJECTED',
        rejectionReason: 'Missing details',
      });

      const result = await service.reject({
        timeEntryIds: ['entry-123'],
        reason: 'Missing details',
      });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('REJECTED');
    });
  });

  describe('returnToDraft', () => {
    it('should return submitted entries to draft', async () => {
      const submittedEntry = { ...mockTimeEntry, status: 'SUBMITTED' };
      mockFindById.mockResolvedValue(submittedEntry);
      mockReturnToDraft.mockResolvedValue({ ...submittedEntry, status: 'DRAFT' });

      const result = await service.returnToDraft(['entry-123']);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('DRAFT');
    });

    it('should throw error for entries that cannot be returned to draft', async () => {
      const postedEntry = { ...mockTimeEntry, status: 'POSTED' };
      mockFindById.mockResolvedValue(postedEntry);

      await expect(service.returnToDraft(['entry-123'])).rejects.toThrow(
        'Cannot return time entry with status "POSTED" to draft'
      );
    });
  });

  describe('createLaborRate', () => {
    it('should create a new labor cost rate', async () => {
      mockCreateLaborRate.mockResolvedValue(mockLaborRateData);

      const input = {
        employeeId: testEmployeeId,
        laborRate: '75.00',
        burdenRate: '25.00',
        billingRate: '150.00',
        overtimeMultiplier: '1.5',
        doubleTimeMultiplier: '2.0',
        effectiveFrom: '2024-01-01',
        priority: 0,
      };

      const result = await service.createLaborRate(input);

      expect(result).toBeTruthy();
      expect(result.laborRate).toBe('75.00');
    });
  });

  describe('getEmployeeTotalHours', () => {
    it('should return total hours for employee in date range', async () => {
      mockGetTotalHours.mockResolvedValue(40);

      const result = await service.getEmployeeTotalHours(testEmployeeId, '2024-01-01', '2024-01-31');

      expect(result).toBe('40.00');
    });
  });

  describe('getProjectTotalCost', () => {
    it('should return total cost for project', async () => {
      mockGetProjectTotalCost.mockResolvedValue({ totalHours: 100, totalCost: 10000 });

      const result = await service.getProjectTotalCost(testProjectId);

      expect(result).toBe('10000.0000');
    });
  });

  describe('postToGL', () => {
    it('should post approved entries to GL', async () => {
      const approvedEntry = { ...mockTimeEntry, status: 'APPROVED' };
      mockFindById.mockResolvedValue(approvedEntry);
      mockGenerateBatchNumber.mockResolvedValue('BATCH-001');
      mockCreatePostingBatch.mockResolvedValue({ id: 'batch-123', batchNumber: 'BATCH-001' });
      mockMarkAsPosted.mockResolvedValue({ ...approvedEntry, status: 'POSTED' });
      mockUpdateAssignmentHours.mockResolvedValue(undefined);

      const result = await service.postToGL(['entry-123']);

      expect(result.success).toBe(true);
      expect(result.postedCount).toBe(1);
      expect(result.failedCount).toBe(0);
    });

    it('should fail posting non-approved entries', async () => {
      mockFindById.mockResolvedValue(mockTimeEntry); // DRAFT status

      const result = await service.postToGL(['entry-123']);

      expect(result.success).toBe(false);
      expect(result.failedCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('APPROVED');
    });
  });
});
