import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AccountingPeriodService } from '../accounting-period-service';
import { ServiceContext, ServiceError } from '../../types';
import * as database from '@glapi/database';

// Mock the database module
jest.mock('@glapi/database', () => ({
  AccountingPeriodRepository: jest.fn().mockImplementation(() => ({
    getAccessibleSubsidiaryIds: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    findByDate: jest.fn(),
    findOpenPeriodForDate: jest.fn(),
    canPostToDate: jest.fn(),
    create: jest.fn(),
    updateStatus: jest.fn(),
    delete: jest.fn(),
    getFiscalYears: jest.fn(),
    getCurrentOpenPeriod: jest.fn(),
    createFiscalYearPeriods: jest.fn(),
  })),
}));

describe('AccountingPeriodService', () => {
  let service: AccountingPeriodService;
  let context: ServiceContext;
  let mockRepository: any;

  const testSubsidiaryId = 'sub-123';
  const testUserId = 'user-123';
  const testOrgId = 'org-123';

  const mockPeriod = {
    id: 'period-123',
    subsidiaryId: testSubsidiaryId,
    periodName: 'January 2024',
    fiscalYear: '2024',
    periodNumber: 1,
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    periodType: 'MONTH',
    status: 'OPEN',
    isAdjustmentPeriod: false,
    softClosedBy: null,
    softClosedDate: null,
    closedBy: null,
    closedDate: null,
    lockedBy: null,
    lockedDate: null,
    createdBy: testUserId,
    createdDate: new Date('2024-01-01'),
    modifiedBy: null,
    modifiedDate: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    context = {
      organizationId: testOrgId,
      userId: testUserId,
    };

    service = new AccountingPeriodService(context);

    // Get the mocked repository instance
    mockRepository = (database.AccountingPeriodRepository as jest.Mock).mock.results[0]?.value;

    // Default mock implementations
    mockRepository.getAccessibleSubsidiaryIds.mockResolvedValue([testSubsidiaryId]);
  });

  describe('checkPostingAllowed', () => {
    it('should allow posting to an OPEN period', async () => {
      mockRepository.canPostToDate.mockResolvedValue({
        canPost: true,
        period: mockPeriod,
      });

      const result = await service.checkPostingAllowed({
        subsidiaryId: testSubsidiaryId,
        postingDate: '2024-01-15',
        isAdjustment: false,
      });

      expect(result.canPost).toBe(true);
      expect(result.period).toBeTruthy();
      expect(result.period?.status).toBe('OPEN');
    });

    it('should deny posting to a CLOSED period for non-adjustments', async () => {
      const closedPeriod = { ...mockPeriod, status: 'CLOSED' };
      mockRepository.canPostToDate.mockResolvedValue({
        canPost: false,
        period: closedPeriod,
        reason: 'Period is closed - only adjustment entries allowed',
      });

      const result = await service.checkPostingAllowed({
        subsidiaryId: testSubsidiaryId,
        postingDate: '2024-01-15',
        isAdjustment: false,
      });

      expect(result.canPost).toBe(false);
      expect(result.reason).toContain('closed');
    });

    it('should allow adjustment posting to a CLOSED period', async () => {
      const closedPeriod = { ...mockPeriod, status: 'CLOSED' };
      mockRepository.canPostToDate.mockResolvedValue({
        canPost: true,
        period: closedPeriod,
        reason: 'Adjustment entry allowed in closed period',
      });

      const result = await service.checkPostingAllowed({
        subsidiaryId: testSubsidiaryId,
        postingDate: '2024-01-15',
        isAdjustment: true,
      });

      expect(result.canPost).toBe(true);
    });

    it('should deny all posting to a LOCKED period', async () => {
      const lockedPeriod = { ...mockPeriod, status: 'LOCKED' };
      mockRepository.canPostToDate.mockResolvedValue({
        canPost: false,
        period: lockedPeriod,
        reason: 'Period is locked - no transactions allowed',
      });

      const result = await service.checkPostingAllowed({
        subsidiaryId: testSubsidiaryId,
        postingDate: '2024-01-15',
        isAdjustment: true,
      });

      expect(result.canPost).toBe(false);
      expect(result.reason).toContain('locked');
    });

    it('should deny posting when no period exists for date', async () => {
      mockRepository.canPostToDate.mockResolvedValue({
        canPost: false,
        period: null,
        reason: 'No accounting period found for this date',
      });

      const result = await service.checkPostingAllowed({
        subsidiaryId: testSubsidiaryId,
        postingDate: '2025-01-15',
        isAdjustment: false,
      });

      expect(result.canPost).toBe(false);
      expect(result.period).toBeNull();
    });

    it('should deny access to unauthorized subsidiary', async () => {
      mockRepository.getAccessibleSubsidiaryIds.mockResolvedValue(['other-sub']);

      const result = await service.checkPostingAllowed({
        subsidiaryId: testSubsidiaryId,
        postingDate: '2024-01-15',
        isAdjustment: false,
      });

      expect(result.canPost).toBe(false);
      expect(result.reason).toContain('denied');
    });
  });

  describe('updatePeriodStatus', () => {
    it('should allow OPEN to SOFT_CLOSED transition', async () => {
      mockRepository.findById.mockResolvedValue(mockPeriod);
      mockRepository.updateStatus.mockResolvedValue({
        ...mockPeriod,
        status: 'SOFT_CLOSED',
        softClosedBy: testUserId,
        softClosedDate: new Date(),
      });

      const result = await service.updatePeriodStatus('period-123', { status: 'SOFT_CLOSED' });

      expect(result.status).toBe('SOFT_CLOSED');
      expect(mockRepository.updateStatus).toHaveBeenCalledWith(
        'period-123',
        [testSubsidiaryId],
        expect.objectContaining({ status: 'SOFT_CLOSED', userId: testUserId })
      );
    });

    it('should deny invalid status transition OPEN to LOCKED', async () => {
      mockRepository.findById.mockResolvedValue(mockPeriod);

      await expect(
        service.updatePeriodStatus('period-123', { status: 'LOCKED' })
      ).rejects.toThrow(ServiceError);
    });

    it('should deny invalid status transition OPEN to CLOSED', async () => {
      mockRepository.findById.mockResolvedValue(mockPeriod);

      await expect(
        service.updatePeriodStatus('period-123', { status: 'CLOSED' })
      ).rejects.toThrow(ServiceError);
    });

    it('should allow SOFT_CLOSED to CLOSED transition', async () => {
      const softClosedPeriod = { ...mockPeriod, status: 'SOFT_CLOSED' };
      mockRepository.findById.mockResolvedValue(softClosedPeriod);
      mockRepository.updateStatus.mockResolvedValue({
        ...softClosedPeriod,
        status: 'CLOSED',
        closedBy: testUserId,
        closedDate: new Date(),
      });

      const result = await service.updatePeriodStatus('period-123', { status: 'CLOSED' });

      expect(result.status).toBe('CLOSED');
    });

    it('should allow SOFT_CLOSED to OPEN transition (reopen)', async () => {
      const softClosedPeriod = { ...mockPeriod, status: 'SOFT_CLOSED' };
      mockRepository.findById.mockResolvedValue(softClosedPeriod);
      mockRepository.updateStatus.mockResolvedValue({
        ...mockPeriod,
        status: 'OPEN',
      });

      const result = await service.updatePeriodStatus('period-123', { status: 'OPEN' });

      expect(result.status).toBe('OPEN');
    });

    it('should allow CLOSED to LOCKED transition', async () => {
      const closedPeriod = { ...mockPeriod, status: 'CLOSED' };
      mockRepository.findById.mockResolvedValue(closedPeriod);
      mockRepository.updateStatus.mockResolvedValue({
        ...closedPeriod,
        status: 'LOCKED',
        lockedBy: testUserId,
        lockedDate: new Date(),
      });

      const result = await service.updatePeriodStatus('period-123', { status: 'LOCKED' });

      expect(result.status).toBe('LOCKED');
    });

    it('should deny any transition from LOCKED status', async () => {
      const lockedPeriod = { ...mockPeriod, status: 'LOCKED' };
      mockRepository.findById.mockResolvedValue(lockedPeriod);

      await expect(
        service.updatePeriodStatus('period-123', { status: 'OPEN' })
      ).rejects.toThrow(ServiceError);

      await expect(
        service.updatePeriodStatus('period-123', { status: 'CLOSED' })
      ).rejects.toThrow(ServiceError);
    });

    it('should throw error if period not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.updatePeriodStatus('invalid-id', { status: 'SOFT_CLOSED' })
      ).rejects.toThrow(
        new ServiceError('Accounting period with ID "invalid-id" not found', 'PERIOD_NOT_FOUND', 404)
      );
    });
  });

  describe('createPeriod', () => {
    const validInput = {
      subsidiaryId: testSubsidiaryId,
      periodName: 'February 2024',
      fiscalYear: '2024',
      periodNumber: 2,
      startDate: '2024-02-01',
      endDate: '2024-02-29',
      periodType: 'MONTH' as const,
      isAdjustmentPeriod: false,
    };

    it('should create a new period with OPEN status', async () => {
      const createdPeriod = {
        ...mockPeriod,
        ...validInput,
        id: 'new-period-123',
        status: 'OPEN',
      };
      mockRepository.create.mockResolvedValue(createdPeriod);

      const result = await service.createPeriod(validInput);

      expect(result.status).toBe('OPEN');
      expect(result.periodName).toBe('February 2024');
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          subsidiaryId: testSubsidiaryId,
          createdBy: testUserId,
        })
      );
    });

    it('should reject if start date is after end date', async () => {
      const invalidInput = {
        ...validInput,
        startDate: '2024-02-28',
        endDate: '2024-02-01',
      };

      await expect(service.createPeriod(invalidInput)).rejects.toThrow(
        new ServiceError('Start date must be before end date', 'INVALID_DATE_RANGE', 400)
      );
    });

    it('should reject if subsidiary access denied', async () => {
      mockRepository.getAccessibleSubsidiaryIds.mockResolvedValue(['other-sub']);

      await expect(service.createPeriod(validInput)).rejects.toThrow(
        new ServiceError('Access denied to this subsidiary', 'SUBSIDIARY_ACCESS_DENIED', 403)
      );
    });
  });

  describe('deletePeriod', () => {
    it('should delete an OPEN period', async () => {
      mockRepository.findById.mockResolvedValue(mockPeriod);
      mockRepository.delete.mockResolvedValue(undefined);

      await service.deletePeriod('period-123');

      expect(mockRepository.delete).toHaveBeenCalledWith('period-123', [testSubsidiaryId]);
    });

    it('should reject deleting a non-OPEN period', async () => {
      const closedPeriod = { ...mockPeriod, status: 'CLOSED' };
      mockRepository.findById.mockResolvedValue(closedPeriod);

      await expect(service.deletePeriod('period-123')).rejects.toThrow(
        new ServiceError('Only OPEN periods can be deleted', 'PERIOD_NOT_OPEN', 400)
      );
    });

    it('should reject deleting non-existent period', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.deletePeriod('invalid-id')).rejects.toThrow(
        new ServiceError('Accounting period with ID "invalid-id" not found', 'PERIOD_NOT_FOUND', 404)
      );
    });
  });

  describe('convenience methods', () => {
    it('softClosePeriod should call updatePeriodStatus with SOFT_CLOSED', async () => {
      mockRepository.findById.mockResolvedValue(mockPeriod);
      mockRepository.updateStatus.mockResolvedValue({
        ...mockPeriod,
        status: 'SOFT_CLOSED',
      });

      const result = await service.softClosePeriod('period-123');

      expect(result.status).toBe('SOFT_CLOSED');
    });

    it('closePeriod should work from SOFT_CLOSED status', async () => {
      const softClosedPeriod = { ...mockPeriod, status: 'SOFT_CLOSED' };
      mockRepository.findById.mockResolvedValue(softClosedPeriod);
      mockRepository.updateStatus.mockResolvedValue({
        ...softClosedPeriod,
        status: 'CLOSED',
      });

      const result = await service.closePeriod('period-123');

      expect(result.status).toBe('CLOSED');
    });

    it('lockPeriod should work from CLOSED status', async () => {
      const closedPeriod = { ...mockPeriod, status: 'CLOSED' };
      mockRepository.findById.mockResolvedValue(closedPeriod);
      mockRepository.updateStatus.mockResolvedValue({
        ...closedPeriod,
        status: 'LOCKED',
      });

      const result = await service.lockPeriod('period-123');

      expect(result.status).toBe('LOCKED');
    });

    it('reopenPeriod should work from SOFT_CLOSED status', async () => {
      const softClosedPeriod = { ...mockPeriod, status: 'SOFT_CLOSED' };
      mockRepository.findById.mockResolvedValue(softClosedPeriod);
      mockRepository.updateStatus.mockResolvedValue({
        ...mockPeriod,
        status: 'OPEN',
      });

      const result = await service.reopenPeriod('period-123');

      expect(result.status).toBe('OPEN');
    });
  });

  describe('listPeriods', () => {
    it('should list periods with filters', async () => {
      const mockPeriods = [mockPeriod];
      mockRepository.findAll.mockResolvedValue({
        data: mockPeriods,
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const result = await service.listPeriods(
        { page: 1, limit: 20 },
        { status: 'OPEN', fiscalYear: '2024' }
      );

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should return empty when no subsidiaries accessible', async () => {
      mockRepository.getAccessibleSubsidiaryIds.mockResolvedValue([]);

      const result = await service.listPeriods();

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getFiscalYears', () => {
    it('should return available fiscal years', async () => {
      mockRepository.getFiscalYears.mockResolvedValue(['2024', '2023', '2022']);

      const result = await service.getFiscalYears();

      expect(result).toEqual(['2024', '2023', '2022']);
    });
  });
});
