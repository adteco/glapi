import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Define all mocks using vi.hoisted - this ensures they're available when vi.mock runs
const {
  mockDb,
  mockEmit,
  mockStartCorrelation,
  mockGenerateGlEntries,
  mockFindPeriodForDate,
  mockGetInvoiceById,
  mockSendInvoice,
} = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
  mockEmit: vi.fn(),
  mockStartCorrelation: vi.fn(),
  mockGenerateGlEntries: vi.fn(),
  mockFindPeriodForDate: vi.fn(),
  mockGetInvoiceById: vi.fn(),
  mockSendInvoice: vi.fn(),
}));

// Mock database
vi.mock('@glapi/database', () => ({
  db: mockDb,
}));

vi.mock('@glapi/database/schema', () => ({
  approvalInstances: {},
  approvalActions: {},
}));

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ eq: true, a, b })),
  and: vi.fn((...args) => ({ and: true, args })),
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-1234'),
}));

// Mock GlPostingEngine - use class syntax for proper constructor behavior
vi.mock('../gl-posting-engine', () => {
  return {
    GlPostingEngine: class MockGlPostingEngine {
      generateGlEntries = mockGenerateGlEntries;
    },
  };
});

// Mock AccountingPeriodService - use class syntax for proper constructor behavior
vi.mock('../accounting-period-service', () => {
  return {
    AccountingPeriodService: class MockAccountingPeriodService {
      findPeriodForDate = mockFindPeriodForDate;
    },
  };
});

// Mock EventService - use class syntax for proper constructor behavior
vi.mock('../event-service', () => {
  return {
    EventService: class MockEventService {
      emit = mockEmit;
      startCorrelation = mockStartCorrelation;
    },
    EventCategory: {
      TRANSACTION: 'TRANSACTION',
      CONTRACT: 'CONTRACT',
      SUBSCRIPTION: 'SUBSCRIPTION',
      PAYMENT: 'PAYMENT',
      SYSTEM: 'SYSTEM',
    },
    InvoiceEvents: {
      CREATED: 'InvoiceCreated',
      UPDATED: 'InvoiceUpdated',
      SENT: 'InvoiceSent',
      SUBMITTED_FOR_APPROVAL: 'InvoiceSubmittedForApproval',
      APPROVED: 'InvoiceApproved',
      REJECTED: 'InvoiceRejected',
      POSTED: 'InvoicePosted',
      POSTING_FAILED: 'InvoicePostingFailed',
      VOIDED: 'InvoiceVoided',
      PAID: 'InvoicePaid',
    },
  };
});

// Mock InvoiceService - use class syntax for proper constructor behavior
vi.mock('../invoice-service', () => {
  return {
    InvoiceService: class MockInvoiceService {
      getInvoiceById = mockGetInvoiceById;
      sendInvoice = mockSendInvoice;
    },
  };
});

// Import after mocks
import {
  InvoicePostingService,
  InvoicePostingPolicy,
  PostInvoiceRequest,
  ApproveInvoiceRequest,
} from '../invoice-posting-service';
import { ServiceError } from '../../types';

describe('InvoicePostingService', () => {
  let service: InvoicePostingService;
  const TEST_ORG_ID = 'test-org-id';
  const TEST_USER_ID = 'test-user-id';

  const defaultPolicy: InvoicePostingPolicy = {
    requiresApproval: false,
    autoPostAfterApproval: true,
    defaultArAccountId: 'ar-account-123',
    defaultRevenueAccountId: 'revenue-account-123',
    defaultTaxAccountId: 'tax-account-123',
  };

  const approvalRequiredPolicy: InvoicePostingPolicy = {
    requiresApproval: true,
    approvalThreshold: 1000,
    autoPostAfterApproval: true,
    defaultArAccountId: 'ar-account-123',
    defaultRevenueAccountId: 'revenue-account-123',
  };

  const mockInvoice = {
    id: 'invoice-123',
    organizationId: TEST_ORG_ID,
    invoiceNumber: 'INV-2026-001',
    entityId: 'customer-123',
    invoiceDate: '2026-01-15',
    dueDate: '2026-02-15',
    subtotal: '1000.00',
    taxAmount: '80.00',
    totalAmount: '1080.00',
    status: 'draft' as const,
    lineItems: [
      {
        id: 'line-1',
        invoiceId: 'invoice-123',
        description: 'Professional Services',
        quantity: '10',
        unitPrice: '100.00',
        amount: '1000.00',
      },
    ],
  };

  const mockGlPostingResult = {
    glTransaction: {
      id: 'gl-tx-123',
      transactionNumber: 'GL-2026-001',
      totalDebitAmount: '1080.00',
      totalCreditAmount: '1080.00',
      status: 'POSTED',
    },
    glLines: [
      { id: 'gl-line-1', debitAmount: '1080.00', creditAmount: '0' },
      { id: 'gl-line-2', debitAmount: '0', creditAmount: '1000.00' },
      { id: 'gl-line-3', debitAmount: '0', creditAmount: '80.00' },
    ],
    balanceUpdates: [],
    validationResult: {
      isBalanced: true,
      totalDebits: 1080,
      totalCredits: 1080,
      difference: 0,
      baseTotalDebits: 1080,
      baseTotalCredits: 1080,
      baseDifference: 0,
      errors: [],
      warnings: [],
    },
    auditEntryId: 'audit-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock implementations with proper chaining
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    // Reset service mocks
    mockStartCorrelation.mockReturnValue('correlation-id-123');
    mockEmit.mockResolvedValue({ event: { id: 'event-1' }, published: false });
    mockGetInvoiceById.mockResolvedValue(mockInvoice);
    mockSendInvoice.mockResolvedValue({ ...mockInvoice, status: 'sent' });
    mockFindPeriodForDate.mockResolvedValue({ id: 'period-123', status: 'OPEN' });
    mockGenerateGlEntries.mockResolvedValue(mockGlPostingResult);

    service = new InvoicePostingService({
      organizationId: TEST_ORG_ID,
      userId: TEST_USER_ID,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Happy Path Tests - No Approval Required
  // ===========================================================================

  describe('finalizeAndPost - no approval required', () => {
    it('should post invoice directly when no approval is required', async () => {
      const request: PostInvoiceRequest = { invoiceId: 'invoice-123' };

      const result = await service.finalizeAndPost(request, defaultPolicy);

      expect(result.posted).toBe(true);
      expect(result.approvalRequired).toBe(false);
      expect(result.glPostingResult).toBeDefined();
      expect(result.glPostingResult?.glTransaction.id).toBe('gl-tx-123');
      expect(result.events).toContain('InvoicePosted');
    });

    it('should emit InvoicePosted event on successful posting', async () => {
      const request: PostInvoiceRequest = { invoiceId: 'invoice-123' };

      await service.finalizeAndPost(request, defaultPolicy);

      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'InvoicePosted',
          aggregateType: 'Invoice',
          aggregateId: 'invoice-123',
        })
      );
    });

    it('should update invoice status to sent', async () => {
      const request: PostInvoiceRequest = { invoiceId: 'invoice-123' };

      await service.finalizeAndPost(request, defaultPolicy);

      expect(mockSendInvoice).toHaveBeenCalledWith('invoice-123');
    });

    it('should use custom posting date if provided', async () => {
      const request: PostInvoiceRequest = {
        invoiceId: 'invoice-123',
        postingDate: '2026-01-20',
      };

      await service.finalizeAndPost(request, defaultPolicy);

      expect(mockFindPeriodForDate).toHaveBeenCalledWith('2026-01-20');
    });

    it('should use invoice date as posting date when not specified', async () => {
      const request: PostInvoiceRequest = { invoiceId: 'invoice-123' };

      await service.finalizeAndPost(request, defaultPolicy);

      expect(mockFindPeriodForDate).toHaveBeenCalledWith('2026-01-15');
    });
  });

  // ===========================================================================
  // Happy Path Tests - Approval Required
  // ===========================================================================

  describe('finalizeAndPost - approval required', () => {
    it('should submit for approval when policy requires it and amount exceeds threshold', async () => {
      const request: PostInvoiceRequest = { invoiceId: 'invoice-123' };

      const result = await service.finalizeAndPost(request, approvalRequiredPolicy);

      expect(result.approvalRequired).toBe(true);
      expect(result.posted).toBe(false);
      expect(result.approvalInstanceId).toBe('mock-uuid-1234');
      expect(result.events).toContain('InvoiceSubmittedForApproval');
    });

    it('should emit InvoiceSubmittedForApproval event', async () => {
      const request: PostInvoiceRequest = { invoiceId: 'invoice-123' };

      await service.finalizeAndPost(request, approvalRequiredPolicy);

      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'InvoiceSubmittedForApproval',
          aggregateType: 'Invoice',
        })
      );
    });

    it('should create approval instance in database', async () => {
      const request: PostInvoiceRequest = { invoiceId: 'invoice-123' };

      await service.finalizeAndPost(request, approvalRequiredPolicy);

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should skip approval when amount is below threshold', async () => {
      const lowAmountInvoice = { ...mockInvoice, totalAmount: '500.00' };
      mockGetInvoiceById.mockResolvedValue(lowAmountInvoice);

      const request: PostInvoiceRequest = { invoiceId: 'invoice-123' };

      const result = await service.finalizeAndPost(request, approvalRequiredPolicy);

      expect(result.approvalRequired).toBe(false);
      expect(result.posted).toBe(true);
    });

    it('should bypass approval when forcePost is true', async () => {
      const request: PostInvoiceRequest = {
        invoiceId: 'invoice-123',
        forcePost: true,
      };

      const result = await service.finalizeAndPost(request, approvalRequiredPolicy);

      expect(result.approvalRequired).toBe(false);
      expect(result.posted).toBe(true);
    });
  });

  // ===========================================================================
  // Approval Processing Tests
  // ===========================================================================

  describe('processApproval', () => {
    const mockPendingApproval = {
      id: 'approval-instance-123',
      organizationId: TEST_ORG_ID,
      workflowType: 'INVOICE_POSTING',
      entityType: 'INVOICE',
      entityId: 'invoice-123',
      status: 'pending',
      currentStep: 1,
    };

    beforeEach(() => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockPendingApproval]),
          }),
        }),
      });
    });

    it('should post invoice when approved and autoPostAfterApproval is true', async () => {
      const request: ApproveInvoiceRequest = {
        invoiceId: 'invoice-123',
        action: 'APPROVE',
        comments: 'Approved for posting',
      };

      const result = await service.processApproval(request, approvalRequiredPolicy);

      expect(result.posted).toBe(true);
      expect(result.events).toContain('InvoiceApproved');
      expect(result.events).toContain('InvoicePosted');
    });

    it('should emit InvoiceApproved event', async () => {
      const request: ApproveInvoiceRequest = {
        invoiceId: 'invoice-123',
        action: 'APPROVE',
      };

      await service.processApproval(request, approvalRequiredPolicy);

      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'InvoiceApproved',
        })
      );
    });

    it('should record approval action in database', async () => {
      const request: ApproveInvoiceRequest = {
        invoiceId: 'invoice-123',
        action: 'APPROVE',
        comments: 'LGTM',
      };

      await service.processApproval(request, approvalRequiredPolicy);

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should not post when autoPostAfterApproval is false', async () => {
      const manualPostPolicy = {
        ...approvalRequiredPolicy,
        autoPostAfterApproval: false,
      };

      const request: ApproveInvoiceRequest = {
        invoiceId: 'invoice-123',
        action: 'APPROVE',
      };

      const result = await service.processApproval(request, manualPostPolicy);

      expect(result.posted).toBe(false);
      expect(result.events).toContain('InvoiceApproved');
      expect(result.events).not.toContain('InvoicePosted');
    });
  });

  // ===========================================================================
  // Sad Path Tests - Rejection
  // ===========================================================================

  describe('processApproval - rejection', () => {
    const mockPendingApproval = {
      id: 'approval-instance-123',
      status: 'pending',
      currentStep: 1,
    };

    beforeEach(() => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockPendingApproval]),
          }),
        }),
      });
    });

    it('should mark invoice as rejected when action is REJECT', async () => {
      const request: ApproveInvoiceRequest = {
        invoiceId: 'invoice-123',
        action: 'REJECT',
        comments: 'Missing documentation',
      };

      const result = await service.processApproval(request, approvalRequiredPolicy);

      expect(result.posted).toBe(false);
      expect(result.events).toContain('InvoiceRejected');
    });

    it('should emit InvoiceRejected event with reason', async () => {
      const request: ApproveInvoiceRequest = {
        invoiceId: 'invoice-123',
        action: 'REJECT',
        comments: 'Invalid line items',
      };

      await service.processApproval(request, approvalRequiredPolicy);

      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'InvoiceRejected',
          data: expect.objectContaining({
            reason: 'Invalid line items',
          }),
        })
      );
    });

    it('should update approval instance status to rejected', async () => {
      const request: ApproveInvoiceRequest = {
        invoiceId: 'invoice-123',
        action: 'REJECT',
      };

      await service.processApproval(request, approvalRequiredPolicy);

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Sad Path Tests - Validation Errors
  // ===========================================================================

  describe('finalizeAndPost - validation errors', () => {
    it('should throw error when invoice not found', async () => {
      mockGetInvoiceById.mockResolvedValue(null);

      const request: PostInvoiceRequest = { invoiceId: 'non-existent' };

      await expect(service.finalizeAndPost(request, defaultPolicy)).rejects.toThrow(
        'Invoice not found'
      );
    });

    it('should throw error when invoice is voided', async () => {
      mockGetInvoiceById.mockResolvedValue({ ...mockInvoice, status: 'void' });

      const request: PostInvoiceRequest = { invoiceId: 'invoice-123' };

      await expect(service.finalizeAndPost(request, defaultPolicy)).rejects.toThrow(
        'Cannot post voided invoice'
      );
    });

    it('should throw error when invoice is cancelled', async () => {
      mockGetInvoiceById.mockResolvedValue({ ...mockInvoice, status: 'cancelled' });

      const request: PostInvoiceRequest = { invoiceId: 'invoice-123' };

      await expect(service.finalizeAndPost(request, defaultPolicy)).rejects.toThrow(
        'Cannot post cancelled invoice'
      );
    });

    it('should throw error when invoice has zero or negative total', async () => {
      mockGetInvoiceById.mockResolvedValue({ ...mockInvoice, totalAmount: '0.00' });

      const request: PostInvoiceRequest = { invoiceId: 'invoice-123' };

      await expect(service.finalizeAndPost(request, defaultPolicy)).rejects.toThrow(
        'Invoice total must be positive'
      );
    });

    it('should throw error when invoice has no line items', async () => {
      mockGetInvoiceById.mockResolvedValue({ ...mockInvoice, lineItems: [] });

      const request: PostInvoiceRequest = { invoiceId: 'invoice-123' };

      await expect(service.finalizeAndPost(request, defaultPolicy)).rejects.toThrow(
        'Invoice must have at least one line item'
      );
    });

    it('should throw error when no accounting period found', async () => {
      mockFindPeriodForDate.mockResolvedValue(null);

      const request: PostInvoiceRequest = { invoiceId: 'invoice-123' };

      await expect(service.finalizeAndPost(request, defaultPolicy)).rejects.toThrow(
        'No accounting period found for posting date'
      );
    });
  });

  // ===========================================================================
  // Sad Path Tests - Posting Failures
  // ===========================================================================

  describe('finalizeAndPost - posting failures', () => {
    it('should emit InvoicePostingFailed event when GL posting fails', async () => {
      mockGenerateGlEntries.mockRejectedValue(
        new ServiceError('GL transaction not balanced', 'GL_TRANSACTION_NOT_BALANCED', 400)
      );

      const request: PostInvoiceRequest = { invoiceId: 'invoice-123' };

      await expect(service.finalizeAndPost(request, defaultPolicy)).rejects.toThrow();

      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'InvoicePostingFailed',
          data: expect.objectContaining({
            error: 'GL transaction not balanced',
            errorCode: 'GL_TRANSACTION_NOT_BALANCED',
          }),
        })
      );
    });

    it('should propagate GL posting engine errors', async () => {
      const glError = new ServiceError('Period is closed', 'PERIOD_CLOSED', 400);
      mockGenerateGlEntries.mockRejectedValue(glError);

      const request: PostInvoiceRequest = { invoiceId: 'invoice-123' };

      await expect(service.finalizeAndPost(request, defaultPolicy)).rejects.toThrow(
        'Period is closed'
      );
    });
  });

  // ===========================================================================
  // Sad Path Tests - Missing Approval
  // ===========================================================================

  describe('processApproval - error cases', () => {
    it('should throw error when no pending approval exists', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const request: ApproveInvoiceRequest = {
        invoiceId: 'invoice-123',
        action: 'APPROVE',
      };

      await expect(service.processApproval(request, approvalRequiredPolicy)).rejects.toThrow(
        'No pending approval found for this invoice'
      );
    });

    it('should throw error when invoice not found during approval', async () => {
      mockGetInvoiceById.mockResolvedValue(null);

      const request: ApproveInvoiceRequest = {
        invoiceId: 'non-existent',
        action: 'APPROVE',
      };

      await expect(service.processApproval(request, approvalRequiredPolicy)).rejects.toThrow(
        'Invoice not found'
      );
    });
  });

  // ===========================================================================
  // Approval Status Tests
  // ===========================================================================

  describe('getApprovalStatus', () => {
    it('should return approval status when approval exists', async () => {
      const mockApproval = {
        id: 'approval-123',
        status: 'approved',
      };
      const mockActions = [
        {
          actionType: 'APPROVE',
          actorId: TEST_USER_ID,
          comments: 'Approved',
          createdAt: new Date(),
        },
      ];

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockApproval]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockActions),
          }),
        });

      const status = await service.getApprovalStatus('invoice-123');

      expect(status.hasApproval).toBe(true);
      expect(status.status).toBe('approved');
      expect(status.approvalInstanceId).toBe('approval-123');
      expect(status.actions).toHaveLength(1);
    });

    it('should return no approval when none exists', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const status = await service.getApprovalStatus('invoice-123');

      expect(status.hasApproval).toBe(false);
      expect(status.status).toBeNull();
      expect(status.approvalInstanceId).toBeNull();
      expect(status.actions).toEqual([]);
    });
  });

  // ===========================================================================
  // Default Policy Tests
  // ===========================================================================

  describe('getDefaultPolicy', () => {
    it('should return sensible default policy', () => {
      const policy = InvoicePostingService.getDefaultPolicy();

      expect(policy.requiresApproval).toBe(true);
      expect(policy.approvalThreshold).toBe(10000);
      expect(policy.autoPostAfterApproval).toBe(true);
      expect(policy.defaultArAccountId).toBeDefined();
      expect(policy.defaultRevenueAccountId).toBeDefined();
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle invoice already in sent status', async () => {
      mockGetInvoiceById.mockResolvedValue({ ...mockInvoice, status: 'sent' });

      const request: PostInvoiceRequest = { invoiceId: 'invoice-123' };

      const result = await service.finalizeAndPost(request, defaultPolicy);

      // Should not call sendInvoice again
      expect(mockSendInvoice).not.toHaveBeenCalled();
      expect(result.posted).toBe(true);
    });

    it('should handle Date objects for posting date', async () => {
      const request: PostInvoiceRequest = {
        invoiceId: 'invoice-123',
        postingDate: new Date('2026-01-20'),
      };

      await service.finalizeAndPost(request, defaultPolicy);

      expect(mockFindPeriodForDate).toHaveBeenCalledWith('2026-01-20');
    });

    it('should include custom memo in GL posting context', async () => {
      const request: PostInvoiceRequest = {
        invoiceId: 'invoice-123',
        memo: 'Q1 Services Revenue',
      };

      await service.finalizeAndPost(request, defaultPolicy);

      expect(mockGenerateGlEntries).toHaveBeenCalledWith(
        expect.objectContaining({
          businessTransaction: expect.objectContaining({
            memo: 'Q1 Services Revenue',
          }),
        })
      );
    });

    it('should handle REQUEST_INFO action without changing status', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { id: 'approval-123', status: 'pending', currentStep: 1 },
            ]),
          }),
        }),
      });

      const request: ApproveInvoiceRequest = {
        invoiceId: 'invoice-123',
        action: 'REQUEST_INFO',
        comments: 'Please provide more details',
      };

      const result = await service.processApproval(request, approvalRequiredPolicy);

      expect(result.posted).toBe(false);
      expect(result.approvalRequired).toBe(true);
      // Should record action but not change approval status
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });
});
