import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceContext } from '../../types';

// Use vi.hoisted() to properly hoist mock functions and constants for use in vi.mock factory
const {
  mockFindAll,
  mockFindById,
  mockFindActiveByProject,
  mockCreate,
  mockUpdate,
  mockUpdateStatus,
  mockDelete,
  mockFindLinesBySov,
  mockFindLineById,
  mockCreateLine,
  mockUpdateLine,
  mockDeleteLine,
  mockBulkCreateLines,
  mockGetNextLineNumber,
  mockGetNextVersionNumber,
  mockRecalculateTotals,
  mockCreateChangeOrder,
  mockFindChangeOrderById,
  mockFindChangeOrdersBySov,
  mockUpdateChangeOrderStatus,
  mockApplyApprovedChangeOrders,
  SOV_STATUS,
} = vi.hoisted(() => ({
  mockFindAll: vi.fn(),
  mockFindById: vi.fn(),
  mockFindActiveByProject: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateStatus: vi.fn(),
  mockDelete: vi.fn(),
  mockFindLinesBySov: vi.fn(),
  mockFindLineById: vi.fn(),
  mockCreateLine: vi.fn(),
  mockUpdateLine: vi.fn(),
  mockDeleteLine: vi.fn(),
  mockBulkCreateLines: vi.fn(),
  mockGetNextLineNumber: vi.fn(),
  mockGetNextVersionNumber: vi.fn(),
  mockRecalculateTotals: vi.fn(),
  mockCreateChangeOrder: vi.fn(),
  mockFindChangeOrderById: vi.fn(),
  mockFindChangeOrdersBySov: vi.fn(),
  mockUpdateChangeOrderStatus: vi.fn(),
  mockApplyApprovedChangeOrders: vi.fn(),
  SOV_STATUS: {
    DRAFT: 'DRAFT',
    ACTIVE: 'ACTIVE',
    REVISED: 'REVISED',
    CLOSED: 'CLOSED',
  } as const,
}));

// Mock the database module
vi.mock('@glapi/database', () => ({
  SOV_STATUS,
  SovRepository: vi.fn().mockImplementation(() => ({
    findAll: mockFindAll,
    findById: mockFindById,
    findActiveByProject: mockFindActiveByProject,
    create: mockCreate,
    update: mockUpdate,
    updateStatus: mockUpdateStatus,
    delete: mockDelete,
    findLinesBySov: mockFindLinesBySov,
    findLineById: mockFindLineById,
    createLine: mockCreateLine,
    updateLine: mockUpdateLine,
    deleteLine: mockDeleteLine,
    bulkCreateLines: mockBulkCreateLines,
    getNextLineNumber: mockGetNextLineNumber,
    getNextVersionNumber: mockGetNextVersionNumber,
    recalculateTotals: mockRecalculateTotals,
    createChangeOrder: mockCreateChangeOrder,
    findChangeOrderById: mockFindChangeOrderById,
    findChangeOrdersBySov: mockFindChangeOrdersBySov,
    updateChangeOrderStatus: mockUpdateChangeOrderStatus,
    applyApprovedChangeOrders: mockApplyApprovedChangeOrders,
  })),
}));

// Import after mocking
import { SovService } from '../sov-service';

describe('SovService', () => {
  let service: SovService;
  let context: ServiceContext;

  const testUserId = 'user-123';
  const testOrgId = 'org-123';
  const testProjectId = 'proj-123';
  const testSovId = 'sov-123';

  const mockSov = {
    id: testSovId,
    organizationId: testOrgId,
    projectId: testProjectId,
    sovNumber: 'SOV-001',
    versionNumber: 1,
    status: 'DRAFT',
    description: 'Test SOV',
    effectiveDate: '2024-01-01',
    originalContractAmount: '100000.00',
    revisedContractAmount: '100000.00',
    approvedChangeOrders: '0',
    pendingChangeOrders: '0',
    totalScheduledValue: '100000.00',
    totalPreviouslyBilled: '0',
    totalCurrentBilling: '0',
    totalBilledToDate: '0',
    totalRetainageHeld: '0',
    totalRetainageReleased: '0',
    balanceToFinish: '100000.00',
    percentComplete: '0',
    retainagePercent: '10',
    createdBy: testUserId,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockSovLine = {
    id: 'line-123',
    scheduleOfValuesId: testSovId,
    lineNumber: 1,
    itemNumber: '01',
    lineType: 'LABOR',
    description: 'Foundation work',
    originalScheduledValue: '50000.00',
    revisedScheduledValue: '50000.00',
    changeOrderAmount: '0',
    previousWorkCompleted: '0',
    previousMaterialsStored: '0',
    currentWorkCompleted: '0',
    currentMaterialsStored: '0',
    totalCompletedAndStored: '0',
    balanceToFinish: '50000.00',
    retainagePercent: '10',
    retainageHeld: '0',
    retainageReleased: '0',
    netRetainage: '0',
    isActive: true,
    sortOrder: 1,
    projectCostCodeId: null,
    notes: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockChangeOrder = {
    id: 'co-123',
    scheduleOfValuesId: testSovId,
    changeOrderNumber: 'CO-001',
    description: 'Additional foundation work',
    amount: '5000.00',
    status: 'PENDING',
    effectiveDate: '2024-02-01',
    requestedBy: testUserId,
    requestedDate: new Date('2024-01-15'),
    approvedBy: null,
    approvedDate: null,
    externalReference: null,
    documentUrl: null,
    notes: null,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    context = {
      organizationId: testOrgId,
      userId: testUserId,
    };

    service = new SovService(context);
  });

  // ========== SOV CRUD Tests ==========

  describe('list', () => {
    it('should return paginated SOVs', async () => {
      mockFindAll.mockResolvedValue({
        data: [mockSov],
        total: 1,
        page: 1,
        limit: 20,
      });

      const result = await service.list({ page: 1, limit: 20 }, {});

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.data[0].sovNumber).toBe('SOV-001');
    });

    it('should apply filters', async () => {
      mockFindAll.mockResolvedValue({
        data: [mockSov],
        total: 1,
        page: 1,
        limit: 20,
      });

      await service.list({ page: 1, limit: 20 }, { projectId: testProjectId, status: 'DRAFT' });

      expect(mockFindAll).toHaveBeenCalledWith(
        testOrgId,
        { page: 1, limit: 20 },
        { projectId: testProjectId, status: 'DRAFT' }
      );
    });
  });

  describe('getById', () => {
    it('should return an SOV by ID', async () => {
      mockFindById.mockResolvedValue(mockSov);
      mockFindLinesBySov.mockResolvedValue([mockSovLine]);

      const result = await service.getById(testSovId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(testSovId);
      expect(result?.sovNumber).toBe('SOV-001');
      expect(result?.lineCount).toBe(1);
    });

    it('should return null when SOV not found', async () => {
      mockFindById.mockResolvedValue(null);

      const result = await service.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getActiveByProject', () => {
    it('should return the active SOV for a project', async () => {
      const activeSov = { ...mockSov, status: 'ACTIVE' };
      mockFindActiveByProject.mockResolvedValue(activeSov);

      const result = await service.getActiveByProject(testProjectId);

      expect(result).not.toBeNull();
      expect(result?.status).toBe('ACTIVE');
    });

    it('should return null when no active SOV exists', async () => {
      mockFindActiveByProject.mockResolvedValue(null);

      const result = await service.getActiveByProject(testProjectId);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new SOV', async () => {
      mockGetNextVersionNumber.mockResolvedValue(1);
      mockCreate.mockResolvedValue(mockSov);

      const input = {
        organizationId: testOrgId,
        projectId: testProjectId,
        description: 'Test SOV',
        originalContractAmount: 100000,
        defaultRetainagePercent: 10,
        effectiveDate: '2024-01-01',
      };

      const result = await service.create(input);

      expect(result).toBeTruthy();
      expect(mockCreate).toHaveBeenCalled();
      expect(result.projectId).toBe(testProjectId);
    });
  });

  describe('update', () => {
    it('should update a draft SOV', async () => {
      mockFindById.mockResolvedValue(mockSov);
      const updatedSov = { ...mockSov, retainagePercent: '15' };
      mockUpdate.mockResolvedValue(updatedSov);

      const result = await service.update(testSovId, { defaultRetainagePercent: 15 });

      expect(result).toBeTruthy();
      expect(result.id).toBe(testSovId);
      expect(mockUpdate).toHaveBeenCalledWith(testSovId, testOrgId, expect.objectContaining({
        retainagePercent: '15',
      }));
    });

    it('should throw error when updating non-draft SOV', async () => {
      mockFindById.mockResolvedValue({ ...mockSov, status: 'ACTIVE' });

      await expect(service.update(testSovId, { description: 'Updated' })).rejects.toThrow(
        'Cannot update SOV with status "ACTIVE"'
      );
    });

    it('should throw error when SOV not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(service.update('non-existent', { description: 'Updated' })).rejects.toThrow(
        'SOV with ID "non-existent" not found'
      );
    });
  });

  describe('updateStatus', () => {
    it('should transition SOV from DRAFT to ACTIVE', async () => {
      mockFindById.mockResolvedValue(mockSov);
      mockFindActiveByProject.mockResolvedValue(null);
      mockUpdateStatus.mockResolvedValue({ ...mockSov, status: 'ACTIVE' });

      const result = await service.updateStatus(testSovId, 'ACTIVE');

      expect(result.status).toBe('ACTIVE');
    });

    it('should deactivate existing active SOV when activating another', async () => {
      const existingActive = { ...mockSov, id: 'sov-old', status: 'ACTIVE' };
      mockFindById.mockResolvedValue(mockSov);
      mockFindActiveByProject.mockResolvedValue(existingActive);
      mockUpdateStatus.mockResolvedValue({ ...mockSov, status: 'ACTIVE' });

      await service.updateStatus(testSovId, 'ACTIVE');

      expect(mockUpdateStatus).toHaveBeenCalledWith('sov-old', testOrgId, 'REVISED', testUserId);
    });

    it('should throw error for invalid status transition', async () => {
      mockFindById.mockResolvedValue({ ...mockSov, status: 'CLOSED' });

      await expect(service.updateStatus(testSovId, 'DRAFT')).rejects.toThrow(
        'Invalid status transition'
      );
    });
  });

  describe('delete', () => {
    it('should delete a draft SOV', async () => {
      mockFindById.mockResolvedValue(mockSov);
      mockDelete.mockResolvedValue(undefined);

      await service.delete(testSovId);

      expect(mockDelete).toHaveBeenCalledWith(testSovId, testOrgId);
    });

    it('should throw error when deleting non-draft SOV', async () => {
      mockFindById.mockResolvedValue({ ...mockSov, status: 'ACTIVE' });

      await expect(service.delete(testSovId)).rejects.toThrow(
        'Cannot delete SOV with status "ACTIVE"'
      );
    });

    it('should throw error when SOV not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(service.delete('non-existent')).rejects.toThrow(
        'SOV with ID "non-existent" not found'
      );
    });
  });

  // ========== SOV Line Tests ==========

  describe('getLines', () => {
    it('should return lines for an SOV', async () => {
      mockFindById.mockResolvedValue(mockSov);
      mockFindLinesBySov.mockResolvedValue([mockSovLine]);

      const result = await service.getLines(testSovId);

      expect(result).toHaveLength(1);
      expect(result[0].lineNumber).toBe(1);
      expect(result[0].description).toBe('Foundation work');
    });

    it('should throw error when SOV not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(service.getLines('non-existent')).rejects.toThrow('SOV not found');
    });
  });

  describe('createLine', () => {
    it('should create a line on a draft SOV', async () => {
      mockFindById.mockResolvedValue(mockSov);
      mockGetNextLineNumber.mockResolvedValue(2);
      mockCreateLine.mockResolvedValue({ ...mockSovLine, lineNumber: 2 });
      mockRecalculateTotals.mockResolvedValue(undefined);

      const input = {
        lineNumber: 2,
        description: 'New line item',
        originalScheduledValue: 25000,
      };

      const result = await service.createLine(testSovId, input);

      expect(result).toBeTruthy();
      expect(mockRecalculateTotals).toHaveBeenCalledWith(testSovId);
    });

    it('should throw error when adding line to non-draft SOV', async () => {
      mockFindById.mockResolvedValue({ ...mockSov, status: 'ACTIVE' });

      await expect(
        service.createLine(testSovId, { lineNumber: 2, description: 'Test', originalScheduledValue: 1000 })
      ).rejects.toThrow('Cannot add lines to SOV with status "ACTIVE"');
    });
  });

  describe('updateLine', () => {
    it('should update a line on a draft SOV', async () => {
      mockFindLineById.mockResolvedValue(mockSovLine);
      mockFindById.mockResolvedValue(mockSov);
      mockUpdateLine.mockResolvedValue({ ...mockSovLine, description: 'Updated description' });
      mockRecalculateTotals.mockResolvedValue(undefined);

      const result = await service.updateLine('line-123', { description: 'Updated description' });

      expect(result.description).toBe('Updated description');
      expect(mockRecalculateTotals).toHaveBeenCalled();
    });

    it('should throw error when updating line on non-draft SOV', async () => {
      mockFindLineById.mockResolvedValue(mockSovLine);
      mockFindById.mockResolvedValue({ ...mockSov, status: 'ACTIVE' });

      await expect(service.updateLine('line-123', { description: 'Updated' })).rejects.toThrow(
        'Cannot modify lines in SOV with status "ACTIVE"'
      );
    });

    it('should throw error when line not found', async () => {
      mockFindLineById.mockResolvedValue(null);

      await expect(service.updateLine('non-existent', { description: 'Updated' })).rejects.toThrow(
        'SOV line not found'
      );
    });
  });

  describe('deleteLine', () => {
    it('should delete a line from a draft SOV', async () => {
      mockFindLineById.mockResolvedValue(mockSovLine);
      mockFindById.mockResolvedValue(mockSov);
      mockDeleteLine.mockResolvedValue(undefined);
      mockRecalculateTotals.mockResolvedValue(undefined);

      await service.deleteLine('line-123');

      expect(mockDeleteLine).toHaveBeenCalledWith('line-123');
      expect(mockRecalculateTotals).toHaveBeenCalled();
    });

    it('should throw error when deleting line from non-draft SOV', async () => {
      mockFindLineById.mockResolvedValue(mockSovLine);
      mockFindById.mockResolvedValue({ ...mockSov, status: 'ACTIVE' });

      await expect(service.deleteLine('line-123')).rejects.toThrow(
        'Cannot delete lines from SOV with status "ACTIVE"'
      );
    });
  });

  describe('bulkCreateLines', () => {
    it('should bulk create lines on a draft SOV', async () => {
      mockFindById.mockResolvedValue(mockSov);
      mockGetNextLineNumber.mockResolvedValue(1);
      mockBulkCreateLines.mockResolvedValue([mockSovLine, { ...mockSovLine, id: 'line-124', lineNumber: 2 }]);
      mockRecalculateTotals.mockResolvedValue(undefined);

      const lines = [
        { lineNumber: 1, description: 'Line 1', originalScheduledValue: 25000 },
        { lineNumber: 2, description: 'Line 2', originalScheduledValue: 25000 },
      ];

      const result = await service.bulkCreateLines(testSovId, lines);

      expect(result).toHaveLength(2);
      expect(mockRecalculateTotals).toHaveBeenCalled();
    });

    it('should throw error when bulk creating on non-draft SOV', async () => {
      mockFindById.mockResolvedValue({ ...mockSov, status: 'ACTIVE' });

      await expect(
        service.bulkCreateLines(testSovId, [{ lineNumber: 1, description: 'Test', originalScheduledValue: 1000 }])
      ).rejects.toThrow('Cannot add lines to SOV with status "ACTIVE"');
    });
  });

  // ========== Change Order Tests ==========

  describe('createChangeOrder', () => {
    it('should create a change order', async () => {
      mockFindById.mockResolvedValue(mockSov);
      mockCreateChangeOrder.mockResolvedValue(mockChangeOrder);

      const input = {
        scheduleOfValuesId: testSovId,
        changeOrderNumber: 'CO-001',
        description: 'Additional work',
        amount: 5000,
        effectiveDate: '2024-02-01',
        lines: [],
      };

      const result = await service.createChangeOrder(testSovId, input);

      expect(result).toBeTruthy();
      expect(result.changeOrderNumber).toBe('CO-001');
    });

    it('should throw error when SOV not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        service.createChangeOrder('non-existent', {
          scheduleOfValuesId: 'non-existent',
          changeOrderNumber: 'CO-001',
          description: 'Test',
          amount: 1000,
          lines: [],
        })
      ).rejects.toThrow('SOV not found');
    });
  });

  describe('approveChangeOrder', () => {
    it('should approve a change order', async () => {
      mockFindChangeOrderById.mockResolvedValue(mockChangeOrder);
      mockUpdateChangeOrderStatus.mockResolvedValue({ ...mockChangeOrder, status: 'APPROVED' });
      mockApplyApprovedChangeOrders.mockResolvedValue(undefined);

      const result = await service.approveChangeOrder('co-123');

      expect(result.status).toBe('APPROVED');
      expect(mockApplyApprovedChangeOrders).toHaveBeenCalledWith(testSovId);
    });

    it('should throw error when change order not found', async () => {
      mockFindChangeOrderById.mockResolvedValue(null);

      await expect(service.approveChangeOrder('non-existent')).rejects.toThrow(
        'Change order not found'
      );
    });
  });

  describe('getChangeOrders', () => {
    it('should return change orders for an SOV', async () => {
      mockFindById.mockResolvedValue(mockSov);
      mockFindChangeOrdersBySov.mockResolvedValue([mockChangeOrder]);

      const result = await service.getChangeOrders(testSovId);

      expect(result).toHaveLength(1);
      expect(result[0].changeOrderNumber).toBe('CO-001');
    });

    it('should throw error when SOV not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(service.getChangeOrders('non-existent')).rejects.toThrow('SOV not found');
    });
  });

  // ========== G703 Export Tests ==========

  describe('generateG703', () => {
    it('should generate G703 continuation sheet', async () => {
      mockFindById.mockResolvedValue(mockSov);
      mockFindLinesBySov.mockResolvedValue([mockSovLine]);

      const result = await service.generateG703(testSovId);

      expect(result).toBeTruthy();
      expect(result.lines).toHaveLength(1);
      expect(result.grandTotals).toBeDefined();
      expect(result.grandTotals.scheduledValue).toBe(50000);
    });

    it('should throw error when SOV not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(service.generateG703('non-existent')).rejects.toThrow('SOV not found');
    });

    it('should calculate correct totals', async () => {
      mockFindById.mockResolvedValue(mockSov);
      mockFindLinesBySov.mockResolvedValue([
        mockSovLine,
        { ...mockSovLine, id: 'line-124', lineNumber: 2, revisedScheduledValue: '30000.00' },
      ]);

      const result = await service.generateG703(testSovId);

      expect(result.grandTotals.scheduledValue).toBe(80000);
    });
  });

  // ========== Validation Tests ==========

  describe('validate', () => {
    it('should validate an SOV successfully', async () => {
      mockFindById.mockResolvedValue(mockSov);
      mockFindLinesBySov.mockResolvedValue([
        { ...mockSovLine, revisedScheduledValue: '100000.00' },
      ]);

      const result = await service.validate(testSovId);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error when SOV has no lines', async () => {
      mockFindById.mockResolvedValue(mockSov);
      mockFindLinesBySov.mockResolvedValue([]);

      const result = await service.validate(testSovId);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'NO_LINES')).toBe(true);
    });

    it('should return warning when line totals do not match contract sum', async () => {
      mockFindById.mockResolvedValue(mockSov);
      mockFindLinesBySov.mockResolvedValue([
        { ...mockSovLine, revisedScheduledValue: '50000.00' }, // Only 50k, but contract is 100k
      ]);

      const result = await service.validate(testSovId);

      expect(result.warnings.some((w) => w.code === 'TOTAL_MISMATCH')).toBe(true);
    });

    it('should return error for duplicate line numbers', async () => {
      mockFindById.mockResolvedValue(mockSov);
      mockFindLinesBySov.mockResolvedValue([
        mockSovLine,
        { ...mockSovLine, id: 'line-124', lineNumber: 1 }, // Same line number
      ]);

      const result = await service.validate(testSovId);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'DUPLICATE_LINE_NUMBERS')).toBe(true);
    });

    it('should return warning for zero value lines', async () => {
      mockFindById.mockResolvedValue(mockSov);
      mockFindLinesBySov.mockResolvedValue([
        { ...mockSovLine, revisedScheduledValue: '0' },
      ]);

      const result = await service.validate(testSovId);

      expect(result.warnings.some((w) => w.code === 'ZERO_VALUE_LINES')).toBe(true);
    });

    it('should throw error when SOV not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(service.validate('non-existent')).rejects.toThrow('SOV not found');
    });
  });

  // ========== Import Tests ==========

  describe('import', () => {
    it('should handle import with empty CSV data', async () => {
      const result = await service.import({
        organizationId: testOrgId,
        projectId: testProjectId,
        csvData: '',
      });

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.message === 'CSV data is required')).toBe(true);
    });

    it('should return success for basic import', async () => {
      const result = await service.import({
        organizationId: testOrgId,
        projectId: testProjectId,
        csvData: 'lineNumber,description,value\n1,Test Item,10000',
      });

      expect(result.success).toBe(true);
    });
  });
});
