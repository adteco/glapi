import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  createAuthenticatedCaller,
  createUnauthenticatedCaller,
} from '../../../../tests/utils/trpc-utils';

// Mock the BankDepositService
jest.mock('@glapi/api-service', () => {
  const mockBankDepositService = {
    listDeposits: jest.fn(),
    getDepositById: jest.fn(),
    getDepositsForReconciliation: jest.fn(),
    getDepositBatchSummary: jest.fn(),
    getDepositGLSummary: jest.fn(),
    reconcileDeposit: jest.fn(),
    listExceptions: jest.fn(),
    getExceptionById: jest.fn(),
    resolveException: jest.fn(),
  };

  return {
    BankDepositService: jest.fn().mockImplementation(() => mockBankDepositService),
    __mockService: mockBankDepositService,
  };
});

describe('Bank Deposits tRPC API (Reconciliation System)', () => {
  let mockService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Get reference to mock service
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mockService = require('@glapi/api-service').__mockService;
  });

  describe('Authentication & Authorization', () => {
    it('should require authentication for list endpoint', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(caller.bankDeposits.list({})).rejects.toThrow('UNAUTHORIZED');
    });

    it('should require authentication for get endpoint', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.bankDeposits.get({ id: '123e4567-e89b-12d3-a456-426614174000' })
      ).rejects.toThrow('UNAUTHORIZED');
    });

    it('should require authentication for reconcile mutation', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.bankDeposits.reconcile({
          depositId: '123e4567-e89b-12d3-a456-426614174000',
          bankStatementDate: '2026-01-15',
          bankStatementRef: 'STMT-001',
          bankStatementAmount: '5000.00',
        })
      ).rejects.toThrow('UNAUTHORIZED');
    });
  });

  describe('bankDeposits.list', () => {
    it('should list deposits with pagination', async () => {
      const mockDeposits = {
        data: [
          {
            id: 'dep-1',
            depositNumber: 'DEP-2026-000001',
            depositDate: '2026-01-15',
            totalAmount: '5000.00',
            paymentCount: 3,
            status: 'SUBMITTED',
            reconciliationStatus: 'PENDING',
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
        hasMore: false,
      };

      mockService.listDeposits.mockResolvedValue(mockDeposits);

      const caller = createAuthenticatedCaller('test-org-id');
      const result = await caller.bankDeposits.list({ page: 1, limit: 50 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].depositNumber).toBe('DEP-2026-000001');
      expect(mockService.listDeposits).toHaveBeenCalled();
    });

    it('should filter deposits by status', async () => {
      const mockDeposits = {
        data: [
          {
            id: 'dep-1',
            depositNumber: 'DEP-2026-000001',
            status: 'SUBMITTED',
            reconciliationStatus: 'PENDING',
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
        hasMore: false,
      };

      mockService.listDeposits.mockResolvedValue(mockDeposits);

      const caller = createAuthenticatedCaller('test-org-id');
      const result = await caller.bankDeposits.list({ status: 'SUBMITTED' });

      expect(result.data[0].status).toBe('SUBMITTED');
    });
  });

  describe('bankDeposits.get', () => {
    it('should return deposit details by ID', async () => {
      const mockDeposit = {
        id: 'dep-1',
        depositNumber: 'DEP-2026-000001',
        depositDate: '2026-01-15',
        totalAmount: '5000.00',
        paymentCount: 3,
        status: 'SUBMITTED',
        reconciliationStatus: 'PENDING',
        payments: [],
      };

      mockService.getDepositById.mockResolvedValue(mockDeposit);

      const caller = createAuthenticatedCaller('test-org-id');
      const result = await caller.bankDeposits.get({
        id: '123e4567-e89b-12d3-a456-426614174000',
      });

      expect(result.id).toBe('dep-1');
      expect(result.depositNumber).toBe('DEP-2026-000001');
    });

    it('should throw NOT_FOUND for non-existent deposit', async () => {
      mockService.getDepositById.mockResolvedValue(null);

      const caller = createAuthenticatedCaller('test-org-id');

      await expect(
        caller.bankDeposits.get({ id: '123e4567-e89b-12d3-a456-426614174000' })
      ).rejects.toThrow('NOT_FOUND');
    });
  });

  describe('bankDeposits.pendingReconciliation', () => {
    it('should return deposits pending reconciliation', async () => {
      const mockDeposits = [
        {
          id: 'dep-1',
          depositNumber: 'DEP-2026-000001',
          status: 'SUBMITTED',
          reconciliationStatus: 'PENDING',
        },
        {
          id: 'dep-2',
          depositNumber: 'DEP-2026-000002',
          status: 'SUBMITTED',
          reconciliationStatus: 'PENDING',
        },
      ];

      mockService.getDepositsForReconciliation.mockResolvedValue(mockDeposits);

      const caller = createAuthenticatedCaller('test-org-id');
      const result = await caller.bankDeposits.pendingReconciliation({});

      expect(result).toHaveLength(2);
      expect(result[0].reconciliationStatus).toBe('PENDING');
    });
  });

  describe('bankDeposits.summary', () => {
    it('should return deposit batch summary', async () => {
      const mockSummary = {
        openCount: 5,
        openAmount: '15000.00',
        submittedCount: 3,
        submittedAmount: '10000.00',
        reconciledCount: 20,
        reconciledAmount: '85000.00',
      };

      mockService.getDepositBatchSummary.mockResolvedValue(mockSummary);

      const caller = createAuthenticatedCaller('test-org-id');
      const result = await caller.bankDeposits.summary({});

      expect(result.openCount).toBe(5);
      expect(result.submittedCount).toBe(3);
      expect(result.reconciledCount).toBe(20);
    });
  });

  describe('bankDeposits.reconcile', () => {
    it('should reconcile a deposit successfully', async () => {
      const mockReconciledDeposit = {
        id: 'dep-1',
        depositNumber: 'DEP-2026-000001',
        status: 'RECONCILED',
        reconciliationStatus: 'MATCHED',
        bankStatementDate: '2026-01-16',
        bankStatementRef: 'STMT-12345',
      };

      mockService.reconcileDeposit.mockResolvedValue(mockReconciledDeposit);

      const caller = createAuthenticatedCaller('test-org-id');
      const result = await caller.bankDeposits.reconcile({
        depositId: '123e4567-e89b-12d3-a456-426614174000',
        bankStatementDate: '2026-01-16',
        bankStatementRef: 'STMT-12345',
        bankStatementAmount: '5000.00',
      });

      expect(result.status).toBe('RECONCILED');
      expect(result.reconciliationStatus).toBe('MATCHED');
    });

    it('should handle reconciliation errors', async () => {
      const error = new Error('Deposit already reconciled');
      (error as any).code = 'ALREADY_RECONCILED';
      mockService.reconcileDeposit.mockRejectedValue(error);

      const caller = createAuthenticatedCaller('test-org-id');

      await expect(
        caller.bankDeposits.reconcile({
          depositId: '123e4567-e89b-12d3-a456-426614174000',
          bankStatementDate: '2026-01-16',
          bankStatementRef: 'STMT-12345',
          bankStatementAmount: '5000.00',
        })
      ).rejects.toThrow('BAD_REQUEST');
    });
  });

  describe('bankDeposits.listExceptions', () => {
    it('should list reconciliation exceptions', async () => {
      const mockExceptions = {
        data: [
          {
            id: 'exc-1',
            exceptionType: 'AMOUNT_VARIANCE',
            exceptionDescription: 'Bank statement differs from deposit',
            varianceAmount: '-50.00',
            status: 'EXCEPTION',
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
        hasMore: false,
      };

      mockService.listExceptions.mockResolvedValue(mockExceptions);

      const caller = createAuthenticatedCaller('test-org-id');
      const result = await caller.bankDeposits.listExceptions({ status: 'EXCEPTION' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].exceptionType).toBe('AMOUNT_VARIANCE');
    });
  });

  describe('bankDeposits.resolveException', () => {
    it('should resolve an exception successfully', async () => {
      const mockResolvedException = {
        id: 'exc-1',
        exceptionType: 'AMOUNT_VARIANCE',
        status: 'RESOLVED',
        resolutionNotes: 'Bank fee adjustment',
      };

      mockService.resolveException.mockResolvedValue(mockResolvedException);

      const caller = createAuthenticatedCaller('test-org-id');
      const result = await caller.bankDeposits.resolveException({
        exceptionId: '123e4567-e89b-12d3-a456-426614174000',
        resolutionNotes: 'Bank fee adjustment',
      });

      expect(result.status).toBe('RESOLVED');
      expect(result.resolutionNotes).toBe('Bank fee adjustment');
    });
  });

  describe('bankDeposits.dashboardStats', () => {
    it('should return dashboard statistics', async () => {
      const mockSummary = {
        openCount: 5,
        openAmount: '15000.00',
        submittedCount: 3,
        submittedAmount: '10000.00',
        reconciledCount: 20,
        reconciledAmount: '85000.00',
      };

      const mockExceptions = {
        total: 2,
        data: [],
        page: 1,
        limit: 1,
        hasMore: false,
      };

      const mockPendingDeposits = [
        { id: 'dep-1', totalAmount: '5000.00' },
        { id: 'dep-2', totalAmount: '3000.00' },
      ];

      mockService.getDepositBatchSummary.mockResolvedValue(mockSummary);
      mockService.listExceptions.mockResolvedValue(mockExceptions);
      mockService.getDepositsForReconciliation.mockResolvedValue(mockPendingDeposits);

      const caller = createAuthenticatedCaller('test-org-id');
      const result = await caller.bankDeposits.dashboardStats({});

      expect(result.openDeposits).toBe(5);
      expect(result.pendingReconciliationCount).toBe(2);
      expect(result.openExceptionsCount).toBe(2);
    });
  });

  describe('bankDeposits.glSummary', () => {
    it('should return GL summary for posted deposit', async () => {
      const mockGLSummary = {
        isPosted: true,
        glTransactionId: 'gl-dep-12345',
        postedAt: new Date().toISOString(),
        totalAmount: '5000.00',
        paymentCount: 3,
      };

      mockService.getDepositGLSummary.mockResolvedValue(mockGLSummary);

      const caller = createAuthenticatedCaller('test-org-id');
      const result = await caller.bankDeposits.glSummary({
        depositId: '123e4567-e89b-12d3-a456-426614174000',
      });

      expect(result.isPosted).toBe(true);
      expect(result.glTransactionId).toBe('gl-dep-12345');
    });

    it('should return GL summary for unposted deposit', async () => {
      const mockGLSummary = {
        isPosted: false,
        totalAmount: '5000.00',
        paymentCount: 3,
      };

      mockService.getDepositGLSummary.mockResolvedValue(mockGLSummary);

      const caller = createAuthenticatedCaller('test-org-id');
      const result = await caller.bankDeposits.glSummary({
        depositId: '123e4567-e89b-12d3-a456-426614174000',
      });

      expect(result.isPosted).toBe(false);
      expect(result.glTransactionId).toBeUndefined();
    });
  });
});
