import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Define all mocks using vi.hoisted
const {
  mockEmit,
  mockCheckPostingAllowed,
} = vi.hoisted(() => ({
  mockEmit: vi.fn(),
  mockCheckPostingAllowed: vi.fn(),
}));

// Create mockDb
const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}));

// Mock database
vi.mock('@glapi/database', () => ({
  db: mockDb,
}));

vi.mock('@glapi/database/schema', () => ({
  bankDeposits: {
    id: 'id',
    organizationId: 'organization_id',
    subsidiaryId: 'subsidiary_id',
    depositNumber: 'deposit_number',
    depositDate: 'deposit_date',
    bankAccountId: 'bank_account_id',
    totalAmount: 'total_amount',
    paymentCount: 'payment_count',
    status: 'status',
    glTransactionId: 'gl_transaction_id',
    postedAt: 'posted_at',
    reconciliationStatus: 'reconciliation_status',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  customerPayments: {
    id: 'id',
    organizationId: 'organization_id',
    subsidiaryId: 'subsidiary_id',
    paymentNumber: 'payment_number',
    paymentAmount: 'payment_amount',
    appliedAmount: 'applied_amount',
    unappliedAmount: 'unapplied_amount',
    status: 'status',
    bankDepositId: 'bank_deposit_id',
  },
  bankReconciliationExceptions: {
    id: 'id',
    organizationId: 'organization_id',
    bankDepositId: 'bank_deposit_id',
    status: 'status',
  },
  entities: {
    id: 'id',
    name: 'name',
    email: 'email',
  },
  accounts: {
    id: 'id',
    organizationId: 'organization_id',
    accountNumber: 'account_number',
    accountName: 'account_name',
  },
  BankDepositStatus: {
    OPEN: 'OPEN',
    SUBMITTED: 'SUBMITTED',
    RECONCILED: 'RECONCILED',
    CANCELLED: 'CANCELLED',
  },
  ReconciliationStatus: {
    PENDING: 'PENDING',
    MATCHED: 'MATCHED',
    EXCEPTION: 'EXCEPTION',
    RESOLVED: 'RESOLVED',
  },
  CustomerPaymentStatus: {
    RECEIVED: 'RECEIVED',
    DEPOSITED: 'DEPOSITED',
    VOIDED: 'VOIDED',
  },
}));

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ eq: true, a, b })),
  and: vi.fn((...args) => ({ and: true, args })),
  desc: vi.fn((col) => ({ desc: true, col })),
  sql: vi.fn((strings, ...values) => ({ sql: true, strings, values })),
  gte: vi.fn((a, b) => ({ gte: true, a, b })),
  lte: vi.fn((a, b) => ({ lte: true, a, b })),
  inArray: vi.fn((col, values) => ({ inArray: true, col, values })),
}));

// Mock AccountingPeriodService
vi.mock('../accounting-period-service', () => {
  return {
    AccountingPeriodService: class MockAccountingPeriodService {
      checkPostingAllowed = mockCheckPostingAllowed;
    },
  };
});

// Mock EventService
vi.mock('../event-service', () => {
  return {
    EventService: class MockEventService {
      emit = mockEmit;
    },
  };
});

// Import after mocks
import { BankDepositService } from '../bank-deposit-service';
import type { DepositGLConfig } from '../bank-deposit-service';

describe('BankDepositService', () => {
  let service: BankDepositService;
  const TEST_ORG_ID = 'test-org-id';
  const TEST_USER_ID = 'test-user-id';
  const TEST_SUBSIDIARY_ID = 'test-subsidiary-id';

  const defaultGLConfig: DepositGLConfig = {
    bankAccountId: 'bank-account-123',
    undepositedFundsAccountId: 'undeposited-funds-account-123',
  };

  const mockDeposit = {
    id: 'deposit-123',
    organizationId: TEST_ORG_ID,
    subsidiaryId: TEST_SUBSIDIARY_ID,
    depositNumber: 'DEP-2026-000001',
    depositDate: '2026-01-15',
    bankAccountId: 'bank-account-123',
    bankAccountName: 'Operating Account',
    currencyCode: 'USD',
    totalAmount: '5000.00',
    paymentCount: 3,
    status: 'OPEN',
    glTransactionId: null,
    postedAt: null,
    reconciliationStatus: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: TEST_USER_ID,
    memo: null,
    internalNotes: null,
    metadata: null,
    submittedAt: null,
    submittedBy: null,
    reconciledAt: null,
    reconciledBy: null,
    bankStatementDate: null,
    bankStatementRef: null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
  };

  const mockPayment = {
    id: 'payment-123',
    organizationId: TEST_ORG_ID,
    subsidiaryId: TEST_SUBSIDIARY_ID,
    paymentNumber: 'PMT-2026-000001',
    paymentAmount: '1000.00',
    appliedAmount: '1000.00',
    unappliedAmount: '0.00',
    status: 'RECEIVED',
    bankDepositId: null,
    entityId: 'customer-123',
    paymentDate: '2026-01-15',
    paymentMethod: 'CHECK',
    currencyCode: 'USD',
    exchangeRate: '1.000000',
    cashAccountId: 'cash-account-123',
    arAccountId: 'ar-account-123',
    glTransactionId: null,
    postedAt: null,
    checkNumber: '12345',
    externalReference: null,
    memo: null,
    internalNotes: null,
    metadata: null,
    createdBy: TEST_USER_ID,
    createdAt: new Date(),
    updatedBy: null,
    updatedAt: new Date(),
    voidedAt: null,
    voidedBy: null,
    voidReason: null,
  };

  const mockAccount = {
    id: 'bank-account-123',
    organizationId: TEST_ORG_ID,
    accountNumber: '1010',
    accountName: 'Operating Bank Account',
  };

  // Helper to setup select mock chain
  const setupSelectMock = (results: any[][]) => {
    let callIndex = 0;
    mockDb.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          const currentResult = results[callIndex++] || [];
          return {
            limit: vi.fn().mockResolvedValue(currentResult),
            then: (resolve: (value: any) => void, reject?: (reason: any) => void) => {
              return Promise.resolve(currentResult).then(resolve, reject);
            },
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(currentResult),
              }),
            }),
          };
        }),
        leftJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            const currentResult = results[callIndex++] || [];
            return {
              limit: vi.fn().mockResolvedValue(currentResult),
              then: (resolve: (value: any) => void) => Promise.resolve(currentResult).then(resolve),
            };
          }),
        }),
      }),
    }));
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BankDepositService({
      organizationId: TEST_ORG_ID,
      userId: TEST_USER_ID,
    });

    // Default mock implementations
    mockEmit.mockResolvedValue({ event: {}, published: false });
    mockCheckPostingAllowed.mockResolvedValue({ canPost: true, period: { id: 'period-123' } });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==========================================================================
  // Deposit Validation Tests
  // ==========================================================================

  describe('validateDepositForPosting', () => {
    it('should return valid for postable deposit', async () => {
      setupSelectMock([[mockDeposit]]);

      const result = await service.validateDepositForPosting('deposit-123');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error for deposit not found', async () => {
      setupSelectMock([[]]);

      const result = await service.validateDepositForPosting('non-existent');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Deposit not found');
    });

    it('should return error for cancelled deposit', async () => {
      setupSelectMock([[{ ...mockDeposit, status: 'CANCELLED' }]]);

      const result = await service.validateDepositForPosting('deposit-123');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cannot post cancelled deposit');
    });

    it('should return error for already posted deposit', async () => {
      setupSelectMock([[{ ...mockDeposit, glTransactionId: 'gl-123' }]]);

      const result = await service.validateDepositForPosting('deposit-123');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Deposit already posted to GL');
    });

    it('should return error for empty deposit', async () => {
      setupSelectMock([[{ ...mockDeposit, paymentCount: 0 }]]);

      const result = await service.validateDepositForPosting('deposit-123');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cannot post empty deposit');
    });

    it('should return error for zero amount deposit', async () => {
      setupSelectMock([[{ ...mockDeposit, totalAmount: '0.00' }]]);

      const result = await service.validateDepositForPosting('deposit-123');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Deposit amount must be positive');
    });

    it('should return warning for missing bank account', async () => {
      setupSelectMock([[{ ...mockDeposit, bankAccountId: null }]]);

      const result = await service.validateDepositForPosting('deposit-123');

      expect(result.warnings).toContain('No bank account specified - will use default');
    });

    it('should return error when period is closed', async () => {
      setupSelectMock([[mockDeposit]]);
      mockCheckPostingAllowed.mockResolvedValueOnce({
        canPost: false,
        reason: 'Period is closed for posting',
      });

      const result = await service.validateDepositForPosting('deposit-123');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cannot post: Period is closed for posting');
    });
  });

  // ==========================================================================
  // GL Posting Tests
  // ==========================================================================

  describe('postDepositToGL', () => {
    it('should create balanced journal entries for deposit', async () => {
      setupSelectMock([
        [mockDeposit],  // validation lookup
        [mockDeposit],  // posting lookup
        [mockAccount, { ...mockAccount, id: 'undeposited-funds-account-123', accountName: 'Undeposited Funds' }],  // account enrichment
      ]);

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ id: 'deposit-123' }]),
      });

      const result = await service.postDepositToGL({
        depositId: 'deposit-123',
        bankAccountId: defaultGLConfig.bankAccountId,
        undepositedFundsAccountId: defaultGLConfig.undepositedFundsAccountId,
      });

      expect(result.success).toBe(true);
      expect(result.journalEntries).toHaveLength(2);

      // Verify double-entry: debits = credits
      const totalDebits = result.journalEntries.reduce((sum, e) => sum + parseFloat(e.debitAmount), 0);
      const totalCredits = result.journalEntries.reduce((sum, e) => sum + parseFloat(e.creditAmount), 0);
      expect(totalDebits).toBe(totalCredits);
      expect(totalDebits).toBe(5000.00);
    });

    it('should generate GL transaction ID', async () => {
      setupSelectMock([
        [mockDeposit],
        [mockDeposit],
        [mockAccount],
      ]);

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ id: 'deposit-123' }]),
      });

      const result = await service.postDepositToGL({
        depositId: 'deposit-123',
        bankAccountId: defaultGLConfig.bankAccountId,
        undepositedFundsAccountId: defaultGLConfig.undepositedFundsAccountId,
      });

      expect(result.success).toBe(true);
      expect(result.glTransactionId).toBeDefined();
      expect(result.glTransactionId).toMatch(/^gl-dep-/);
    });

    it('should emit BankDepositPosted event', async () => {
      setupSelectMock([
        [mockDeposit],
        [mockDeposit],
        [mockAccount],
      ]);

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ id: 'deposit-123' }]),
      });

      await service.postDepositToGL({
        depositId: 'deposit-123',
        bankAccountId: defaultGLConfig.bankAccountId,
        undepositedFundsAccountId: defaultGLConfig.undepositedFundsAccountId,
      });

      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'BankDepositPosted',
          eventCategory: 'ACCOUNTING',
          aggregateType: 'BankDeposit',
          aggregateId: 'deposit-123',
        })
      );
    });

    it('should return error for deposit not found during posting', async () => {
      setupSelectMock([
        [mockDeposit],  // validation
        [],             // posting lookup - not found
      ]);

      const result = await service.postDepositToGL({
        depositId: 'non-existent',
        bankAccountId: defaultGLConfig.bankAccountId,
        undepositedFundsAccountId: defaultGLConfig.undepositedFundsAccountId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Deposit not found');
    });
  });

  // ==========================================================================
  // Submit Deposit with Posting Tests
  // ==========================================================================

  describe('submitDepositWithPosting', () => {
    it('should submit deposit and post to GL in one operation', async () => {
      // Mock for getDepositById (submit validation)
      const depositWithPayments = {
        deposit: mockDeposit,
        bankAccount: mockAccount,
      };

      // The flow of database calls is:
      // 1. submitDeposit → getDepositById (1st) - deposit lookup via leftJoin
      // 2. submitDeposit → getDepositById (1st) - payments lookup via leftJoin
      // 3. submitDeposit → getDepositById (return/2nd) - deposit lookup via leftJoin
      // 4. submitDeposit → getDepositById (return/2nd) - payments lookup via leftJoin
      // 5. postDepositToGL → validateDepositForPosting - deposit lookup (no leftJoin)
      // 6. postDepositToGL - deposit lookup (no leftJoin)
      // 7. postDepositToGL → enrichJournalEntries - accounts lookup (no leftJoin)
      // 8. submitDepositWithPosting → getDepositById (final) - deposit lookup via leftJoin
      // 9. submitDepositWithPosting → getDepositById (final) - payments lookup via leftJoin
      setupSelectMock([
        [depositWithPayments],  // 0: getDepositById (1st) - deposit
        [],                     // 1: getDepositById (1st) - payments
        [depositWithPayments],  // 2: getDepositById (return) - deposit
        [],                     // 3: getDepositById (return) - payments
        [mockDeposit],          // 4: validateDepositForPosting - deposit lookup
        [mockDeposit],          // 5: postDepositToGL - deposit lookup
        [mockAccount],          // 6: enrichJournalEntries - accounts
        [depositWithPayments],  // 7: getDepositById (final) - deposit
        [],                     // 8: getDepositById (final) - payments
      ]);

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ id: 'deposit-123' }]),
      });

      const result = await service.submitDepositWithPosting(
        { depositId: 'deposit-123' },
        defaultGLConfig
      );

      expect(result.deposit).toBeDefined();
      expect(result.postingResult).toBeDefined();
      expect(result.postingResult.success).toBe(true);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge cases', () => {
    it('should handle missing organization context', async () => {
      const serviceNoOrg = new BankDepositService({ userId: TEST_USER_ID });

      await expect(
        serviceNoOrg.validateDepositForPosting('deposit-123')
      ).rejects.toThrow('Organization context is required');
    });

    it('should verify DR Bank equals CR Undeposited Funds', async () => {
      setupSelectMock([
        [mockDeposit],
        [mockDeposit],
        [mockAccount],
      ]);

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ id: 'deposit-123' }]),
      });

      const result = await service.postDepositToGL({
        depositId: 'deposit-123',
        bankAccountId: defaultGLConfig.bankAccountId,
        undepositedFundsAccountId: defaultGLConfig.undepositedFundsAccountId,
      });

      expect(result.success).toBe(true);

      // Find bank account entry (DR)
      const bankEntry = result.journalEntries.find(
        e => e.accountId === defaultGLConfig.bankAccountId
      );
      expect(bankEntry).toBeDefined();
      expect(parseFloat(bankEntry!.debitAmount)).toBe(5000.00);
      expect(parseFloat(bankEntry!.creditAmount)).toBe(0);

      // Find undeposited funds entry (CR)
      const undepositedEntry = result.journalEntries.find(
        e => e.accountId === defaultGLConfig.undepositedFundsAccountId
      );
      expect(undepositedEntry).toBeDefined();
      expect(parseFloat(undepositedEntry!.debitAmount)).toBe(0);
      expect(parseFloat(undepositedEntry!.creditAmount)).toBe(5000.00);
    });
  });

  // ==========================================================================
  // GL Summary Tests
  // ==========================================================================

  describe('getDepositGLSummary', () => {
    it('should return posted status when deposit has GL transaction', async () => {
      const postedDeposit = {
        deposit: {
          ...mockDeposit,
          glTransactionId: 'gl-dep-123',
          postedAt: new Date(),
        },
        bankAccount: mockAccount,
      };

      setupSelectMock([
        [postedDeposit],
        [],
      ]);

      const summary = await service.getDepositGLSummary('deposit-123');

      expect(summary.isPosted).toBe(true);
      expect(summary.glTransactionId).toBe('gl-dep-123');
      expect(summary.totalAmount).toBe('5000.00');
      expect(summary.paymentCount).toBe(3);
    });

    it('should return unposted status when deposit has no GL transaction', async () => {
      const unpostedDeposit = {
        deposit: mockDeposit,
        bankAccount: mockAccount,
      };

      setupSelectMock([
        [unpostedDeposit],
        [],
      ]);

      const summary = await service.getDepositGLSummary('deposit-123');

      expect(summary.isPosted).toBe(false);
      expect(summary.glTransactionId).toBeUndefined();
    });
  });
});
