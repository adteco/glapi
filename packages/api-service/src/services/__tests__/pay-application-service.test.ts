import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ServiceError } from '../../types';

// Hoist all mocks and constants
const {
  mockPayAppFindAll,
  mockPayAppFindById,
  mockPayAppCreate,
  mockPayAppUpdate,
  mockPayAppDelete,
  mockPayAppUpdateStatus,
  mockPayAppFindLinesByPayApp,
  mockPayAppFindLinesWithSovDetails,
  mockPayAppBulkUpdateLines,
  mockPayAppRecalculateTotals,
  mockPayAppInitializeLinesFromSov,
  mockPayAppGetNextApplicationNumber,
  mockPayAppCalculatePreviousBillingTotals,
  mockPayAppGetApprovalHistory,
  mockPayAppGetNextReleaseNumber,
  mockPayAppCreateRetainageRelease,
  mockPayAppFindRetainageReleaseById,
  mockPayAppUpdateRetainageReleaseStatus,
  mockPayAppFindRetainageReleasesByProject,
  mockPayAppFindLineById,
  mockSovFindById,
  mockSovRecalculateTotals,
  mockSovUpdateLineBillingProgress,
  PAY_APP_STATUS,
  PAY_APP_TYPE,
} = vi.hoisted(() => ({
  mockPayAppFindAll: vi.fn(),
  mockPayAppFindById: vi.fn(),
  mockPayAppCreate: vi.fn(),
  mockPayAppUpdate: vi.fn(),
  mockPayAppDelete: vi.fn(),
  mockPayAppUpdateStatus: vi.fn(),
  mockPayAppFindLinesByPayApp: vi.fn(),
  mockPayAppFindLinesWithSovDetails: vi.fn(),
  mockPayAppBulkUpdateLines: vi.fn(),
  mockPayAppRecalculateTotals: vi.fn(),
  mockPayAppInitializeLinesFromSov: vi.fn(),
  mockPayAppGetNextApplicationNumber: vi.fn(),
  mockPayAppCalculatePreviousBillingTotals: vi.fn(),
  mockPayAppGetApprovalHistory: vi.fn(),
  mockPayAppGetNextReleaseNumber: vi.fn(),
  mockPayAppCreateRetainageRelease: vi.fn(),
  mockPayAppFindRetainageReleaseById: vi.fn(),
  mockPayAppUpdateRetainageReleaseStatus: vi.fn(),
  mockPayAppFindRetainageReleasesByProject: vi.fn(),
  mockPayAppFindLineById: vi.fn(),
  mockSovFindById: vi.fn(),
  mockSovRecalculateTotals: vi.fn(),
  mockSovUpdateLineBillingProgress: vi.fn(),
  PAY_APP_STATUS: {
    DRAFT: 'DRAFT',
    SUBMITTED: 'SUBMITTED',
    APPROVED: 'APPROVED',
    CERTIFIED: 'CERTIFIED',
    BILLED: 'BILLED',
    PAID: 'PAID',
    REJECTED: 'REJECTED',
    VOIDED: 'VOIDED',
  } as const,
  PAY_APP_TYPE: {
    PROGRESS: 'PROGRESS',
    FINAL: 'FINAL',
    RETAINAGE: 'RETAINAGE',
  } as const,
}));

// Mock @glapi/database - must come BEFORE importing the service
vi.mock('@glapi/database', () => ({
  PAY_APP_STATUS,
  PAY_APP_TYPE,
  PayApplicationRepository: class MockPayApplicationRepository {
    findAll = mockPayAppFindAll;
    findById = mockPayAppFindById;
    create = mockPayAppCreate;
    update = mockPayAppUpdate;
    delete = mockPayAppDelete;
    updateStatus = mockPayAppUpdateStatus;
    findLinesByPayApp = mockPayAppFindLinesByPayApp;
    findLinesWithSovDetails = mockPayAppFindLinesWithSovDetails;
    bulkUpdateLines = mockPayAppBulkUpdateLines;
    recalculateTotals = mockPayAppRecalculateTotals;
    initializeLinesFromSov = mockPayAppInitializeLinesFromSov;
    getNextApplicationNumber = mockPayAppGetNextApplicationNumber;
    calculatePreviousBillingTotals = mockPayAppCalculatePreviousBillingTotals;
    getApprovalHistory = mockPayAppGetApprovalHistory;
    getNextReleaseNumber = mockPayAppGetNextReleaseNumber;
    createRetainageRelease = mockPayAppCreateRetainageRelease;
    findRetainageReleaseById = mockPayAppFindRetainageReleaseById;
    updateRetainageReleaseStatus = mockPayAppUpdateRetainageReleaseStatus;
    findRetainageReleasesByProject = mockPayAppFindRetainageReleasesByProject;
    findLineById = mockPayAppFindLineById;
  },
  SovRepository: class MockSovRepository {
    findById = mockSovFindById;
    recalculateTotals = mockSovRecalculateTotals;
    updateLineBillingProgress = mockSovUpdateLineBillingProgress;
  },
}));

// Import service AFTER mocks are set up
import { PayApplicationService } from '../pay-application-service';

describe('PayApplicationService', () => {
  let service: PayApplicationService;
  const testOrgId = 'org-123';
  const testUserId = 'user-456';
  const testProjectId = 'proj-789';
  const testSovId = 'sov-123';
  const testPayAppId = 'payapp-123';
  const testLineId = 'line-123';

  const mockPayApp = {
    id: testPayAppId,
    organizationId: testOrgId,
    projectId: testProjectId,
    scheduleOfValuesId: testSovId,
    applicationNumber: 1,
    applicationDate: '2024-01-15',
    periodFrom: '2024-01-01',
    periodTo: '2024-01-31',
    payAppType: 'PROGRESS',
    status: PAY_APP_STATUS.DRAFT,
    contractSumToDate: '1000000.00',
    totalCompletedAndStoredToDate: '250000.00',
    totalRetainage: '25000.00',
    totalEarnedLessRetainage: '225000.00',
    lessPreviousCertificates: '0',
    currentPaymentDue: '225000.00',
    balanceToFinish: '750000.00',
  };

  const mockSov = {
    id: testSovId,
    organizationId: testOrgId,
    projectId: testProjectId,
    status: 'ACTIVE',
    originalContractAmount: '1000000.00',
    revisedContractAmount: '1000000.00',
    approvedChangeOrders: '0',
  };

  const mockPayAppLine = {
    id: testLineId,
    payApplicationId: testPayAppId,
    lineNumber: 1,
    scheduledValue: '100000.00',
    previousWorkCompleted: '0',
    previousMaterialsStored: '0',
    thisWorkCompleted: '25000.00',
    thisMaterialsStored: '0',
    totalCompletedAndStored: '25000.00',
    retainagePercent: '10',
    retainageAmount: '2500.00',
    sovLineId: 'sov-line-123',
  };

  const mockSovLine = {
    id: 'sov-line-123',
    itemNumber: '001',
    description: 'Foundation Work',
    revisedScheduledValue: '100000.00',
    previousWorkCompleted: '0',
    previousMaterialsStored: '0',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PayApplicationService({
      organizationId: testOrgId,
      userId: testUserId,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ========== Pay Application CRUD Tests ==========

  describe('list', () => {
    it('should list pay applications with pagination', async () => {
      mockPayAppFindAll.mockResolvedValue({
        data: [mockPayApp],
        total: 1,
        page: 1,
        pageSize: 50,
        totalPages: 1,
      });

      const result = await service.list(
        { page: 1, limit: 50 },
        { organizationId: testOrgId }
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(testPayAppId);
      expect(result.total).toBe(1);
      expect(mockPayAppFindAll).toHaveBeenCalledWith(testOrgId, expect.any(Object), expect.any(Object));
    });

    it('should filter by project', async () => {
      mockPayAppFindAll.mockResolvedValue({
        data: [mockPayApp],
        total: 1,
        page: 1,
        pageSize: 50,
        totalPages: 1,
      });

      await service.list({}, { organizationId: testOrgId, projectId: testProjectId });

      expect(mockPayAppFindAll).toHaveBeenCalledWith(
        testOrgId,
        expect.any(Object),
        expect.objectContaining({ projectId: testProjectId })
      );
    });

    it('should filter by status', async () => {
      mockPayAppFindAll.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        pageSize: 50,
        totalPages: 0,
      });

      await service.list({}, { organizationId: testOrgId, status: ['DRAFT', 'SUBMITTED'] });

      expect(mockPayAppFindAll).toHaveBeenCalledWith(
        testOrgId,
        expect.any(Object),
        expect.objectContaining({ status: ['DRAFT', 'SUBMITTED'] })
      );
    });
  });

  describe('getById', () => {
    it('should return a pay application by ID', async () => {
      mockPayAppFindById.mockResolvedValue(mockPayApp);

      const result = await service.getById(testPayAppId);

      expect(result).toBeTruthy();
      expect(result!.id).toBe(testPayAppId);
      expect(result!.applicationNumber).toBe(1);
      expect(mockPayAppFindById).toHaveBeenCalledWith(testPayAppId, testOrgId);
    });

    it('should return null for non-existent pay application', async () => {
      mockPayAppFindById.mockResolvedValue(null);

      const result = await service.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new pay application', async () => {
      mockSovFindById.mockResolvedValue(mockSov);
      mockPayAppGetNextApplicationNumber.mockResolvedValue(1);
      mockPayAppCalculatePreviousBillingTotals.mockResolvedValue({
        totalPreviousCertificates: '0',
      });
      mockPayAppCreate.mockResolvedValue(mockPayApp);
      mockPayAppInitializeLinesFromSov.mockResolvedValue(undefined);
      mockPayAppUpdate.mockResolvedValue(mockPayApp);

      const result = await service.create({
        organizationId: testOrgId,
        projectId: testProjectId,
        scheduleOfValuesId: testSovId,
        applicationDate: '2024-01-15',
        periodFrom: '2024-01-01',
        periodTo: '2024-01-31',
        payAppType: 'PROGRESS',
      });

      expect(result).toBeTruthy();
      expect(result.id).toBe(testPayAppId);
      expect(mockPayAppCreate).toHaveBeenCalled();
      expect(mockPayAppInitializeLinesFromSov).toHaveBeenCalledWith(testPayAppId, testSovId);
    });

    it('should throw error if SOV not found', async () => {
      mockSovFindById.mockResolvedValue(null);

      await expect(
        service.create({
          organizationId: testOrgId,
          projectId: testProjectId,
          scheduleOfValuesId: testSovId,
          applicationDate: '2024-01-15',
          periodFrom: '2024-01-01',
          periodTo: '2024-01-31',
        })
      ).rejects.toThrow('Schedule of Values not found');
    });

    it('should throw error if SOV is not active', async () => {
      mockSovFindById.mockResolvedValue({ ...mockSov, status: 'DRAFT' });

      await expect(
        service.create({
          organizationId: testOrgId,
          projectId: testProjectId,
          scheduleOfValuesId: testSovId,
          applicationDate: '2024-01-15',
          periodFrom: '2024-01-01',
          periodTo: '2024-01-31',
        })
      ).rejects.toThrow('Cannot create pay application for inactive SOV');
    });
  });

  describe('delete', () => {
    it('should delete a draft pay application', async () => {
      mockPayAppFindById.mockResolvedValue(mockPayApp);
      mockPayAppDelete.mockResolvedValue(undefined);

      await service.delete(testPayAppId);

      expect(mockPayAppDelete).toHaveBeenCalledWith(testPayAppId, testOrgId);
    });

    it('should throw error when deleting non-draft pay application', async () => {
      mockPayAppFindById.mockResolvedValue({ ...mockPayApp, status: PAY_APP_STATUS.SUBMITTED });

      await expect(service.delete(testPayAppId)).rejects.toThrow(
        'Cannot delete pay application with status "SUBMITTED"'
      );
    });

    it('should throw error when pay application not found', async () => {
      mockPayAppFindById.mockResolvedValue(null);

      await expect(service.delete(testPayAppId)).rejects.toThrow('Pay application not found');
    });
  });

  // ========== Line Operations Tests ==========

  describe('getLines', () => {
    it('should get lines for a pay application', async () => {
      mockPayAppFindById.mockResolvedValue(mockPayApp);
      mockPayAppFindLinesWithSovDetails.mockResolvedValue([
        { line: mockPayAppLine, sovLine: mockSovLine },
      ]);

      const result = await service.getLines(testPayAppId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(testLineId);
      expect(result[0].description).toBe('Foundation Work');
      expect(result[0].scheduledValue).toBe(100000);
    });

    it('should throw error when pay application not found', async () => {
      mockPayAppFindById.mockResolvedValue(null);

      await expect(service.getLines(testPayAppId)).rejects.toThrow('Pay application not found');
    });
  });

  describe('updateLines', () => {
    it('should update lines for a draft pay application', async () => {
      mockPayAppFindById.mockResolvedValue(mockPayApp);
      mockPayAppBulkUpdateLines.mockResolvedValue(undefined);
      mockPayAppRecalculateTotals.mockResolvedValue(undefined);
      mockPayAppFindLinesWithSovDetails.mockResolvedValue([
        { line: mockPayAppLine, sovLine: mockSovLine },
      ]);

      const result = await service.updateLines({
        payApplicationId: testPayAppId,
        lines: [
          {
            id: testLineId,
            thisWorkCompleted: 30000,
            thisMaterialsStored: 5000,
          },
        ],
      });

      expect(result).toHaveLength(1);
      expect(mockPayAppBulkUpdateLines).toHaveBeenCalled();
      expect(mockPayAppRecalculateTotals).toHaveBeenCalledWith(testPayAppId);
    });

    it('should throw error when updating non-draft pay application', async () => {
      mockPayAppFindById.mockResolvedValue({ ...mockPayApp, status: PAY_APP_STATUS.SUBMITTED });

      await expect(
        service.updateLines({
          payApplicationId: testPayAppId,
          lines: [{ id: testLineId, thisWorkCompleted: 30000 }],
        })
      ).rejects.toThrow('Cannot update lines for pay application with status "SUBMITTED"');
    });
  });

  // ========== Workflow Tests ==========

  describe('submit', () => {
    it('should submit a draft pay application', async () => {
      const submittedPayApp = { ...mockPayApp, status: PAY_APP_STATUS.SUBMITTED };
      mockPayAppFindById.mockResolvedValue(mockPayApp);
      mockPayAppFindLinesByPayApp.mockResolvedValue([mockPayAppLine]);
      mockPayAppUpdateStatus.mockResolvedValue(submittedPayApp);

      const result = await service.submit({
        payApplicationId: testPayAppId,
        submittedBy: testUserId,
        notes: 'Ready for review',
      });

      expect(result.status).toBe(PAY_APP_STATUS.SUBMITTED);
      expect(mockPayAppUpdateStatus).toHaveBeenCalledWith(
        testPayAppId,
        testOrgId,
        expect.objectContaining({
          status: PAY_APP_STATUS.SUBMITTED,
          userId: testUserId,
        })
      );
    });

    it('should throw error for invalid status transition', async () => {
      mockPayAppFindById.mockResolvedValue({ ...mockPayApp, status: PAY_APP_STATUS.APPROVED });

      await expect(
        service.submit({
          payApplicationId: testPayAppId,
          submittedBy: testUserId,
        })
      ).rejects.toThrow('Invalid status transition');
    });

    it('should throw error if validation fails', async () => {
      mockPayAppFindById.mockResolvedValue(mockPayApp);
      mockPayAppFindLinesByPayApp.mockResolvedValue([]); // No lines = validation error

      await expect(
        service.submit({
          payApplicationId: testPayAppId,
          submittedBy: testUserId,
        })
      ).rejects.toThrow('Cannot submit pay application');
    });
  });

  describe('approve', () => {
    it('should approve a submitted pay application', async () => {
      const submittedPayApp = { ...mockPayApp, status: PAY_APP_STATUS.SUBMITTED };
      const approvedPayApp = { ...mockPayApp, status: PAY_APP_STATUS.APPROVED };
      mockPayAppFindById.mockResolvedValue(submittedPayApp);
      mockPayAppUpdateStatus.mockResolvedValue(approvedPayApp);

      const result = await service.approve({
        payApplicationId: testPayAppId,
        approvedBy: testUserId,
        approvedAmount: 225000,
      });

      expect(result.status).toBe(PAY_APP_STATUS.APPROVED);
      expect(mockPayAppUpdateStatus).toHaveBeenCalledWith(
        testPayAppId,
        testOrgId,
        expect.objectContaining({
          status: PAY_APP_STATUS.APPROVED,
          userId: testUserId,
        })
      );
    });

    it('should throw error for invalid status transition', async () => {
      mockPayAppFindById.mockResolvedValue(mockPayApp); // DRAFT status

      await expect(
        service.approve({
          payApplicationId: testPayAppId,
          approvedBy: testUserId,
        })
      ).rejects.toThrow('Invalid status transition');
    });
  });

  describe('reject', () => {
    it('should reject a submitted pay application', async () => {
      const submittedPayApp = { ...mockPayApp, status: PAY_APP_STATUS.SUBMITTED };
      const rejectedPayApp = { ...mockPayApp, status: PAY_APP_STATUS.REJECTED };
      mockPayAppFindById.mockResolvedValue(submittedPayApp);
      mockPayAppUpdateStatus.mockResolvedValue(rejectedPayApp);

      const result = await service.reject({
        payApplicationId: testPayAppId,
        rejectedBy: testUserId,
        reason: 'Incorrect amounts',
      });

      expect(result.status).toBe(PAY_APP_STATUS.REJECTED);
      expect(mockPayAppUpdateStatus).toHaveBeenCalledWith(
        testPayAppId,
        testOrgId,
        expect.objectContaining({
          status: PAY_APP_STATUS.REJECTED,
          reason: 'Incorrect amounts',
        })
      );
    });

    it('should reject an approved pay application', async () => {
      const approvedPayApp = { ...mockPayApp, status: PAY_APP_STATUS.APPROVED };
      const rejectedPayApp = { ...mockPayApp, status: PAY_APP_STATUS.REJECTED };
      mockPayAppFindById.mockResolvedValue(approvedPayApp);
      mockPayAppUpdateStatus.mockResolvedValue(rejectedPayApp);

      const result = await service.reject({
        payApplicationId: testPayAppId,
        rejectedBy: testUserId,
        reason: 'Needs revision',
      });

      expect(result.status).toBe(PAY_APP_STATUS.REJECTED);
    });
  });

  describe('certify', () => {
    it('should certify an approved pay application', async () => {
      const approvedPayApp = { ...mockPayApp, status: PAY_APP_STATUS.APPROVED };
      const certifiedPayApp = { ...mockPayApp, status: PAY_APP_STATUS.CERTIFIED };
      mockPayAppFindById.mockResolvedValue(approvedPayApp);
      mockPayAppUpdateStatus.mockResolvedValue(certifiedPayApp);

      const result = await service.certify({
        payApplicationId: testPayAppId,
        certifiedBy: testUserId,
        certificationNumber: 'CERT-001',
      });

      expect(result.status).toBe(PAY_APP_STATUS.CERTIFIED);
      expect(mockPayAppUpdateStatus).toHaveBeenCalledWith(
        testPayAppId,
        testOrgId,
        expect.objectContaining({
          status: PAY_APP_STATUS.CERTIFIED,
          certificationNumber: 'CERT-001',
        })
      );
    });

    it('should throw error for invalid status transition', async () => {
      mockPayAppFindById.mockResolvedValue(mockPayApp); // DRAFT status

      await expect(
        service.certify({
          payApplicationId: testPayAppId,
          certifiedBy: testUserId,
        })
      ).rejects.toThrow('Invalid status transition');
    });
  });

  describe('bill', () => {
    it('should mark a certified pay application as billed', async () => {
      const certifiedPayApp = { ...mockPayApp, status: PAY_APP_STATUS.CERTIFIED };
      const billedPayApp = { ...mockPayApp, status: PAY_APP_STATUS.BILLED };
      mockPayAppFindById.mockResolvedValue(certifiedPayApp);
      mockPayAppUpdateStatus.mockResolvedValue(billedPayApp);
      mockPayAppFindLinesWithSovDetails.mockResolvedValue([
        { line: mockPayAppLine, sovLine: mockSovLine },
      ]);
      mockSovUpdateLineBillingProgress.mockResolvedValue(undefined);
      mockPayAppFindLineById.mockResolvedValue(null);

      const result = await service.bill({
        payApplicationId: testPayAppId,
        invoiceNumber: 'INV-001',
        invoiceDate: '2024-02-01',
        billedBy: testUserId,
      });

      expect(result.status).toBe(PAY_APP_STATUS.BILLED);
      expect(mockPayAppUpdateStatus).toHaveBeenCalledWith(
        testPayAppId,
        testOrgId,
        expect.objectContaining({
          status: PAY_APP_STATUS.BILLED,
          invoiceNumber: 'INV-001',
        })
      );
    });
  });

  describe('recordPayment', () => {
    it('should record payment for a billed pay application', async () => {
      const billedPayApp = { ...mockPayApp, status: PAY_APP_STATUS.BILLED };
      const paidPayApp = { ...mockPayApp, status: PAY_APP_STATUS.PAID };
      mockPayAppFindById.mockResolvedValue(billedPayApp);
      mockPayAppUpdateStatus.mockResolvedValue(paidPayApp);

      const result = await service.recordPayment({
        payApplicationId: testPayAppId,
        paidAmount: 225000,
        paidDate: '2024-02-15',
        checkNumber: 'CHK-001',
      });

      expect(result.status).toBe(PAY_APP_STATUS.PAID);
      expect(mockPayAppUpdateStatus).toHaveBeenCalledWith(
        testPayAppId,
        testOrgId,
        expect.objectContaining({
          status: PAY_APP_STATUS.PAID,
          paidAmount: '225000',
          checkNumber: 'CHK-001',
        })
      );
    });
  });

  describe('void', () => {
    it('should void a draft pay application', async () => {
      const voidedPayApp = { ...mockPayApp, status: PAY_APP_STATUS.VOIDED };
      mockPayAppFindById.mockResolvedValue(mockPayApp);
      mockPayAppUpdateStatus.mockResolvedValue(voidedPayApp);

      const result = await service.void({
        payApplicationId: testPayAppId,
        voidedBy: testUserId,
        reason: 'Created in error',
      });

      expect(result.status).toBe(PAY_APP_STATUS.VOIDED);
      expect(mockPayAppUpdateStatus).toHaveBeenCalledWith(
        testPayAppId,
        testOrgId,
        expect.objectContaining({
          status: PAY_APP_STATUS.VOIDED,
          reason: 'Created in error',
        })
      );
    });

    it('should throw error when voiding paid pay application', async () => {
      mockPayAppFindById.mockResolvedValue({ ...mockPayApp, status: PAY_APP_STATUS.PAID });

      await expect(
        service.void({
          payApplicationId: testPayAppId,
          voidedBy: testUserId,
          reason: 'Created in error',
        })
      ).rejects.toThrow('Invalid status transition');
    });
  });

  describe('revertToDraft', () => {
    it('should revert a rejected pay application to draft', async () => {
      const rejectedPayApp = { ...mockPayApp, status: PAY_APP_STATUS.REJECTED };
      const draftPayApp = { ...mockPayApp, status: PAY_APP_STATUS.DRAFT };
      mockPayAppFindById.mockResolvedValue(rejectedPayApp);
      mockPayAppUpdateStatus.mockResolvedValue(draftPayApp);

      const result = await service.revertToDraft(testPayAppId);

      expect(result.status).toBe(PAY_APP_STATUS.DRAFT);
    });

    it('should revert a submitted pay application to draft', async () => {
      const submittedPayApp = { ...mockPayApp, status: PAY_APP_STATUS.SUBMITTED };
      const draftPayApp = { ...mockPayApp, status: PAY_APP_STATUS.DRAFT };
      mockPayAppFindById.mockResolvedValue(submittedPayApp);
      mockPayAppUpdateStatus.mockResolvedValue(draftPayApp);

      const result = await service.revertToDraft(testPayAppId);

      expect(result.status).toBe(PAY_APP_STATUS.DRAFT);
    });

    it('should throw error when reverting from invalid status', async () => {
      mockPayAppFindById.mockResolvedValue({ ...mockPayApp, status: PAY_APP_STATUS.CERTIFIED });

      await expect(service.revertToDraft(testPayAppId)).rejects.toThrow('Invalid status transition');
    });
  });

  // ========== Validation Tests ==========

  describe('validate', () => {
    it('should validate a pay application with valid data', async () => {
      mockPayAppFindById.mockResolvedValue(mockPayApp);
      mockPayAppFindLinesByPayApp.mockResolvedValue([mockPayAppLine]);

      const result = await service.validate(testPayAppId);

      expect(result.valid).toBe(true);
      expect(result.canSubmit).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error for pay application with no lines', async () => {
      mockPayAppFindById.mockResolvedValue(mockPayApp);
      mockPayAppFindLinesByPayApp.mockResolvedValue([]);

      const result = await service.validate(testPayAppId);

      expect(result.valid).toBe(false);
      expect(result.canSubmit).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'NO_LINES' })
      );
    });

    it('should return warning for overbilling', async () => {
      const overbilledLine = {
        ...mockPayAppLine,
        scheduledValue: '100000.00',
        totalCompletedAndStored: '105000.00',
      };
      mockPayAppFindById.mockResolvedValue(mockPayApp);
      mockPayAppFindLinesByPayApp.mockResolvedValue([overbilledLine]);

      const result = await service.validate(testPayAppId);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({ code: 'OVERBILLING' })
      );
    });

    it('should return error for negative values', async () => {
      const negativeLine = {
        ...mockPayAppLine,
        thisWorkCompleted: '-5000.00',
      };
      mockPayAppFindById.mockResolvedValue(mockPayApp);
      mockPayAppFindLinesByPayApp.mockResolvedValue([negativeLine]);

      const result = await service.validate(testPayAppId);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'NEGATIVE_VALUE' })
      );
    });

    it('should return warning for zero billing', async () => {
      const zeroBillingLine = {
        ...mockPayAppLine,
        thisWorkCompleted: '0',
        thisMaterialsStored: '0',
      };
      mockPayAppFindById.mockResolvedValue(mockPayApp);
      mockPayAppFindLinesByPayApp.mockResolvedValue([zeroBillingLine]);

      const result = await service.validate(testPayAppId);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({ code: 'ZERO_BILLING' })
      );
    });
  });

  describe('validateMath', () => {
    it('should validate math calculations', async () => {
      mockPayAppFindById.mockResolvedValue(mockPayApp);
      mockPayAppFindLinesByPayApp.mockResolvedValue([mockPayAppLine]);

      const result = await service.validateMath(testPayAppId);

      expect(result.isBalanced).toBeDefined();
      expect(result.totalScheduledValue).toBe(100000);
      expect(result.totalCurrentBilling).toBe(25000);
    });

    it('should throw error when pay application not found', async () => {
      mockPayAppFindById.mockResolvedValue(null);

      await expect(service.validateMath(testPayAppId)).rejects.toThrow('Pay application not found');
    });
  });

  // ========== G702 Export Tests ==========

  describe('generateG702', () => {
    it('should generate G702 application and certificate', async () => {
      mockPayAppFindById.mockResolvedValue(mockPayApp);
      mockSovFindById.mockResolvedValue(mockSov);
      mockPayAppCalculatePreviousBillingTotals.mockResolvedValue({
        totalPreviousCertificates: '0',
      });

      const result = await service.generateG702(testPayAppId);

      expect(result.applicationNumber).toBe(1);
      expect(result.periodTo).toBe('2024-01-31');
      expect(result.contractSummary).toBeDefined();
      expect(result.contractSummary.originalContractSum).toBe(1000000);
    });

    it('should throw error when pay application not found', async () => {
      mockPayAppFindById.mockResolvedValue(null);

      await expect(service.generateG702(testPayAppId)).rejects.toThrow('Pay application not found');
    });

    it('should throw error when SOV not found', async () => {
      mockPayAppFindById.mockResolvedValue(mockPayApp);
      mockSovFindById.mockResolvedValue(null);

      await expect(service.generateG702(testPayAppId)).rejects.toThrow('SOV not found');
    });
  });

  // ========== Approval History Tests ==========

  describe('getApprovalHistory', () => {
    it('should get approval history for a pay application', async () => {
      const mockHistory = [
        {
          id: 'history-1',
          payApplicationId: testPayAppId,
          action: 'SUBMIT',
          userId: testUserId,
          createdAt: new Date(),
        },
        {
          id: 'history-2',
          payApplicationId: testPayAppId,
          action: 'APPROVE',
          userId: 'approver-1',
          createdAt: new Date(),
        },
      ];
      mockPayAppFindById.mockResolvedValue(mockPayApp);
      mockPayAppGetApprovalHistory.mockResolvedValue(mockHistory);

      const result = await service.getApprovalHistory(testPayAppId);

      expect(result).toHaveLength(2);
      expect(mockPayAppGetApprovalHistory).toHaveBeenCalledWith(testPayAppId);
    });

    it('should throw error when pay application not found', async () => {
      mockPayAppFindById.mockResolvedValue(null);

      await expect(service.getApprovalHistory(testPayAppId)).rejects.toThrow(
        'Pay application not found'
      );
    });
  });

  // ========== Retainage Release Tests ==========

  describe('createRetainageRelease', () => {
    it('should create a retainage release', async () => {
      const mockRelease = {
        id: 'release-123',
        projectId: testProjectId,
        releaseNumber: 1,
        releaseDate: '2024-12-01',
        releaseType: 'PARTIAL',
        status: 'PENDING',
        releaseAmount: '50000.00',
        totalRetainageHeld: '100000.00',
        retainageRemaining: '50000.00',
        requiresPunchlistComplete: true,
        requiresLienWaivers: true,
        requiresWarrantyDocuments: false,
      };
      mockPayAppGetNextReleaseNumber.mockResolvedValue(1);
      mockPayAppCreateRetainageRelease.mockResolvedValue(mockRelease);

      const result = await service.createRetainageRelease({
        organizationId: testOrgId,
        projectId: testProjectId,
        releaseDate: '2024-12-01',
        releaseAmount: 50000,
        requiresPunchlistComplete: true,
        requiresLienWaivers: true,
      });

      expect(result.id).toBe('release-123');
      expect(result.releaseAmount).toBe(50000);
      expect(result.requiresPunchlistComplete).toBe(true);
    });
  });

  describe('approveRetainageRelease', () => {
    it('should approve a retainage release', async () => {
      const mockRelease = {
        id: 'release-123',
        projectId: testProjectId,
        releaseNumber: 1,
        releaseDate: '2024-12-01',
        releaseType: 'PARTIAL',
        status: 'PENDING',
        releaseAmount: '50000.00',
        totalRetainageHeld: '100000.00',
        retainageRemaining: '50000.00',
        requiresPunchlistComplete: false,
        requiresLienWaivers: false,
        requiresWarrantyDocuments: false,
      };
      const approvedRelease = { ...mockRelease, status: 'APPROVED' };
      mockPayAppFindRetainageReleaseById.mockResolvedValue(mockRelease);
      mockPayAppUpdateRetainageReleaseStatus.mockResolvedValue(approvedRelease);

      const result = await service.approveRetainageRelease({
        retainageReleaseId: 'release-123',
        approvedBy: testUserId,
        approvedAmount: 50000,
      });

      expect(result.status).toBe('APPROVED');
    });

    it('should throw error when release not found', async () => {
      mockPayAppFindRetainageReleaseById.mockResolvedValue(null);

      await expect(
        service.approveRetainageRelease({
          retainageReleaseId: 'non-existent',
          approvedBy: testUserId,
        })
      ).rejects.toThrow('Retainage release not found');
    });
  });

  describe('getRetainageReleases', () => {
    it('should get retainage releases for a project', async () => {
      const mockReleases = [
        {
          id: 'release-1',
          projectId: testProjectId,
          releaseNumber: 1,
          releaseDate: '2024-12-01',
          releaseType: 'PARTIAL',
          status: 'APPROVED',
          releaseAmount: '50000.00',
          totalRetainageHeld: '100000.00',
          retainageRemaining: '50000.00',
          requiresPunchlistComplete: false,
          requiresLienWaivers: false,
          requiresWarrantyDocuments: false,
        },
      ];
      mockPayAppFindRetainageReleasesByProject.mockResolvedValue(mockReleases);

      const result = await service.getRetainageReleases(testProjectId);

      expect(result).toHaveLength(1);
      expect(result[0].releaseNumber).toBe(1);
    });
  });

  // ========== Error Handling Tests ==========

  describe('error handling', () => {
    it('should throw ServiceError with correct code for not found', async () => {
      mockPayAppFindById.mockResolvedValue(null);

      try {
        await service.getLines(testPayAppId);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceError);
        expect((error as ServiceError).code).toBe('PAY_APP_NOT_FOUND');
        expect((error as ServiceError).statusCode).toBe(404);
      }
    });

    it('should throw ServiceError for unauthorized organization', async () => {
      const unauthorizedService = new PayApplicationService({
        organizationId: undefined,
        userId: testUserId,
      });

      await expect(unauthorizedService.getById(testPayAppId)).rejects.toThrow();
    });
  });

  // ========== Status Transition Tests ==========

  describe('status transitions', () => {
    const statusTransitionTests = [
      { from: 'DRAFT', to: 'SUBMITTED', valid: true },
      { from: 'DRAFT', to: 'VOIDED', valid: true },
      { from: 'SUBMITTED', to: 'APPROVED', valid: true },
      { from: 'SUBMITTED', to: 'REJECTED', valid: true },
      { from: 'SUBMITTED', to: 'DRAFT', valid: true },
      { from: 'APPROVED', to: 'CERTIFIED', valid: true },
      { from: 'APPROVED', to: 'REJECTED', valid: true },
      { from: 'CERTIFIED', to: 'BILLED', valid: true },
      { from: 'BILLED', to: 'PAID', valid: true },
      { from: 'REJECTED', to: 'DRAFT', valid: true },
      { from: 'PAID', to: 'DRAFT', valid: false },
      { from: 'VOIDED', to: 'DRAFT', valid: false },
      { from: 'DRAFT', to: 'PAID', valid: false },
    ];

    statusTransitionTests.forEach(({ from, to, valid }) => {
      it(`should ${valid ? 'allow' : 'reject'} transition from ${from} to ${to}`, async () => {
        const payApp = { ...mockPayApp, status: from };
        mockPayAppFindById.mockResolvedValue(payApp);

        if (valid) {
          mockPayAppUpdateStatus.mockResolvedValue({ ...payApp, status: to });
          if (from === 'DRAFT' && to === 'SUBMITTED') {
            mockPayAppFindLinesByPayApp.mockResolvedValue([mockPayAppLine]);
          }
        }

        const performTransition = async () => {
          switch (to) {
            case 'SUBMITTED':
              return service.submit({ payApplicationId: testPayAppId, submittedBy: testUserId });
            case 'APPROVED':
              return service.approve({ payApplicationId: testPayAppId, approvedBy: testUserId });
            case 'REJECTED':
              return service.reject({
                payApplicationId: testPayAppId,
                rejectedBy: testUserId,
                reason: 'Test',
              });
            case 'CERTIFIED':
              return service.certify({ payApplicationId: testPayAppId, certifiedBy: testUserId });
            case 'BILLED':
              mockPayAppFindLinesWithSovDetails.mockResolvedValue([]);
              mockPayAppFindLineById.mockResolvedValue(null);
              return service.bill({
                payApplicationId: testPayAppId,
                invoiceNumber: 'INV-001',
                invoiceDate: '2024-01-01',
                billedBy: testUserId,
              });
            case 'PAID':
              return service.recordPayment({
                payApplicationId: testPayAppId,
                paidAmount: 100000,
                paidDate: '2024-01-15',
              });
            case 'VOIDED':
              return service.void({
                payApplicationId: testPayAppId,
                voidedBy: testUserId,
                reason: 'Test',
              });
            case 'DRAFT':
              return service.revertToDraft(testPayAppId);
            default:
              throw new Error(`Unknown status: ${to}`);
          }
        };

        if (valid) {
          const result = await performTransition();
          expect(result.status).toBe(to);
        } else {
          await expect(performTransition()).rejects.toThrow('Invalid status transition');
        }
      });
    });
  });
});
