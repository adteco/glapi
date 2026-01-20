import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Define all mocks using vi.hoisted
const {
  mockEmit,
  mockStartCorrelation,
  mockCheckPostingAllowed,
} = vi.hoisted(() => ({
  mockEmit: vi.fn(),
  mockStartCorrelation: vi.fn(),
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
  customerPayments: {
    id: 'id',
    organizationId: 'organization_id',
    subsidiaryId: 'subsidiary_id',
    paymentNumber: 'payment_number',
    paymentAmount: 'payment_amount',
    status: 'status',
    glTransactionId: 'gl_transaction_id',
    postedAt: 'posted_at',
    cashAccountId: 'cash_account_id',
  },
  customerPaymentApplications: {
    id: 'id',
    organizationId: 'organization_id',
    customerPaymentId: 'customer_payment_id',
    appliedAmount: 'applied_amount',
    discountAmount: 'discount_amount',
    writeOffAmount: 'write_off_amount',
    reversedAt: 'reversed_at',
  },
  accounts: {
    id: 'id',
    organizationId: 'organization_id',
    accountNumber: 'account_number',
    accountName: 'account_name',
    accountType: 'account_type',
    isActive: 'is_active',
    subsidiaryId: 'subsidiary_id',
  },
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
      startCorrelation = mockStartCorrelation;
    },
    EventCategory: {
      TRANSACTION: 'TRANSACTION',
      CONTRACT: 'CONTRACT',
      SUBSCRIPTION: 'SUBSCRIPTION',
      PAYMENT: 'PAYMENT',
      GL: 'GL',
      SYSTEM: 'SYSTEM',
    },
  };
});

// Import after mocks
import { PaymentPostingService } from '../payment-posting-service';
import type { PaymentGLConfig } from '../payment-posting-service';

describe('PaymentPostingService', () => {
  let service: PaymentPostingService;
  const TEST_ORG_ID = 'test-org-id';
  const TEST_USER_ID = 'test-user-id';
  const TEST_SUBSIDIARY_ID = 'test-subsidiary-id';

  const defaultGLConfig: PaymentGLConfig = {
    cashAccountId: 'cash-account-123',
    unappliedCashAccountId: 'unapplied-cash-account-123',
    arAccountId: 'ar-account-123',
    discountAccountId: 'discount-account-123',
    writeOffAccountId: 'writeoff-account-123',
  };

  const mockPayment = {
    id: 'payment-123',
    organizationId: TEST_ORG_ID,
    subsidiaryId: TEST_SUBSIDIARY_ID,
    paymentNumber: 'PMT-2026-000001',
    paymentAmount: '1000.00',
    appliedAmount: '0.00',
    unappliedAmount: '1000.00',
    status: 'RECEIVED',
    cashAccountId: 'cash-account-123',
    arAccountId: 'ar-account-123',
    glTransactionId: null,
    postedAt: null,
    entityId: 'customer-123',
    paymentDate: '2026-01-15',
    paymentMethod: 'CHECK',
    currencyCode: 'USD',
    exchangeRate: '1.000000',
  };

  const mockApplication = {
    id: 'application-123',
    organizationId: TEST_ORG_ID,
    customerPaymentId: 'payment-123',
    invoiceId: 'invoice-123',
    applicationDate: '2026-01-15',
    appliedAmount: '500.00',
    discountAmount: '50.00',
    writeOffAmount: '0.00',
    reversedAt: null,
  };

  const mockAccount = {
    id: 'cash-account-123',
    organizationId: TEST_ORG_ID,
    accountNumber: '1000',
    accountName: 'Cash - Operating',
    accountType: 'Asset',
    isActive: true,
    subsidiaryId: TEST_SUBSIDIARY_ID,
  };

  // Helper to setup select mock chain that handles both .limit() and direct resolution
  const setupSelectMock = (results: any[][]) => {
    let callIndex = 0;
    mockDb.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          const currentResult = results[callIndex++] || [];
          // Return an object that is also a Promise
          // This allows both .limit() and direct await to work
          const whereResult = {
            limit: vi.fn().mockResolvedValue(currentResult),
            then: (resolve: (value: any) => void, reject?: (reason: any) => void) => {
              return Promise.resolve(currentResult).then(resolve, reject);
            },
          };
          return whereResult;
        }),
      }),
    }));
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PaymentPostingService({
      organizationId: TEST_ORG_ID,
      userId: TEST_USER_ID,
    });

    // Default mock implementations
    mockEmit.mockResolvedValue({ event: {}, published: false });
    mockStartCorrelation.mockReturnValue('correlation-123');
    mockCheckPostingAllowed.mockResolvedValue({ canPost: true, period: { id: 'period-123' } });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==========================================================================
  // Validation Tests
  // ==========================================================================

  describe('validatePaymentForPosting', () => {
    it('should return valid for postable payment', async () => {
      setupSelectMock([[mockPayment], [mockAccount]]);

      const result = await service.validatePaymentForPosting('payment-123');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error for payment not found', async () => {
      setupSelectMock([[]]);

      const result = await service.validatePaymentForPosting('non-existent');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Payment not found');
    });

    it('should return error for voided payment', async () => {
      setupSelectMock([[{ ...mockPayment, status: 'VOIDED' }]]);

      const result = await service.validatePaymentForPosting('payment-123');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cannot post voided payment');
    });

    it('should return error for already posted payment', async () => {
      setupSelectMock([[{ ...mockPayment, glTransactionId: 'gl-123' }]]);

      const result = await service.validatePaymentForPosting('payment-123');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Payment already posted to GL');
    });

    it('should return error for zero amount payment', async () => {
      setupSelectMock([[{ ...mockPayment, paymentAmount: '0.00' }]]);

      const result = await service.validatePaymentForPosting('payment-123');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Payment amount must be positive');
    });

    it('should return warning for missing cash account', async () => {
      setupSelectMock([[{ ...mockPayment, cashAccountId: null }]]);

      const result = await service.validatePaymentForPosting('payment-123');

      expect(result.warnings).toContain('No cash account specified - will use default');
    });

    it('should return error when period is closed', async () => {
      setupSelectMock([[mockPayment], [mockAccount]]);
      mockCheckPostingAllowed.mockResolvedValueOnce({
        canPost: false,
        reason: 'Period is closed for posting',
      });

      const result = await service.validatePaymentForPosting('payment-123');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cannot post: Period is closed for posting');
    });
  });

  // ==========================================================================
  // Payment Receipt Posting Tests
  // ==========================================================================

  describe('postPaymentReceipt', () => {
    it('should create balanced journal entries for payment receipt', async () => {
      // Setup mocks: validation selects, then posting selects (all in order)
      setupSelectMock([
        [mockPayment],  // validation payment lookup
        [mockAccount],  // validation account lookup
        [mockPayment],  // posting payment lookup
        [mockAccount, { ...mockAccount, id: 'unapplied-cash-account-123', accountName: 'Unapplied Cash' }],  // account lookups
      ]);

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ id: 'payment-123' }]),
      });

      const result = await service.postPaymentReceipt({
        paymentId: 'payment-123',
        cashAccountId: defaultGLConfig.cashAccountId,
        unappliedCashAccountId: defaultGLConfig.unappliedCashAccountId,
      });

      expect(result.success).toBe(true);
      expect(result.journalEntries).toHaveLength(2);

      // Verify double-entry: debits = credits
      const totalDebits = result.journalEntries.reduce((sum, e) => sum + parseFloat(e.debitAmount), 0);
      const totalCredits = result.journalEntries.reduce((sum, e) => sum + parseFloat(e.creditAmount), 0);
      expect(totalDebits).toBe(totalCredits);
    });

    it('should generate GL transaction ID', async () => {
      setupSelectMock([
        [mockPayment],
        [mockAccount],
        [mockPayment],
        [mockAccount, { ...mockAccount, id: 'unapplied-cash-account-123' }],
      ]);

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ id: 'payment-123' }]),
      });

      const result = await service.postPaymentReceipt({
        paymentId: 'payment-123',
        cashAccountId: defaultGLConfig.cashAccountId,
        unappliedCashAccountId: defaultGLConfig.unappliedCashAccountId,
      });

      expect(result.success).toBe(true);
      expect(result.glTransactionId).toBeDefined();
      expect(result.glTransactionId).toMatch(/^gl-pmt-/);
    });

    it('should emit PaymentPosted event', async () => {
      setupSelectMock([
        [mockPayment],
        [mockAccount],
        [mockPayment],
        [mockAccount, { ...mockAccount, id: 'unapplied-cash-account-123' }],
      ]);

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ id: 'payment-123' }]),
      });

      await service.postPaymentReceipt({
        paymentId: 'payment-123',
        cashAccountId: defaultGLConfig.cashAccountId,
        unappliedCashAccountId: defaultGLConfig.unappliedCashAccountId,
      });

      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'PaymentPosted',
          eventCategory: 'GL',
          aggregateType: 'CustomerPayment',
          aggregateId: 'payment-123',
        })
      );
    });

    it('should return error for payment not found during posting', async () => {
      setupSelectMock([
        [mockPayment],  // validation
        [mockAccount],  // account validation
        [],             // posting lookup - not found
      ]);

      const result = await service.postPaymentReceipt({
        paymentId: 'non-existent',
        cashAccountId: defaultGLConfig.cashAccountId,
        unappliedCashAccountId: defaultGLConfig.unappliedCashAccountId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment not found');
    });
  });

  // ==========================================================================
  // Payment Application Posting Tests
  // ==========================================================================

  describe('postPaymentApplication', () => {
    it('should create balanced journal entries for payment application', async () => {
      setupSelectMock([
        [mockApplication],  // application lookup
        [mockPayment],      // parent payment lookup
        [
          mockAccount,
          { ...mockAccount, id: 'unapplied-cash-account-123', accountName: 'Unapplied Cash' },
          { ...mockAccount, id: 'ar-account-123', accountName: 'Accounts Receivable' },
          { ...mockAccount, id: 'discount-account-123', accountName: 'Sales Discounts' },
        ],  // account lookups
      ]);

      const result = await service.postPaymentApplication({
        applicationId: 'application-123',
        unappliedCashAccountId: defaultGLConfig.unappliedCashAccountId,
        arAccountId: defaultGLConfig.arAccountId,
        discountAccountId: defaultGLConfig.discountAccountId,
      });

      expect(result.success).toBe(true);
      expect(result.journalEntries.length).toBeGreaterThanOrEqual(2);

      // Verify double-entry: debits = credits
      const totalDebits = result.journalEntries.reduce((sum, e) => sum + parseFloat(e.debitAmount), 0);
      const totalCredits = result.journalEntries.reduce((sum, e) => sum + parseFloat(e.creditAmount), 0);
      expect(Math.abs(totalDebits - totalCredits)).toBeLessThan(0.01);
    });

    it('should include discount expense entry when discount applied', async () => {
      setupSelectMock([
        [mockApplication],
        [mockPayment],
        [
          mockAccount,
          { ...mockAccount, id: 'unapplied-cash-account-123' },
          { ...mockAccount, id: 'ar-account-123' },
          { ...mockAccount, id: 'discount-account-123' },
        ],
      ]);

      const result = await service.postPaymentApplication({
        applicationId: 'application-123',
        unappliedCashAccountId: defaultGLConfig.unappliedCashAccountId,
        arAccountId: defaultGLConfig.arAccountId,
        discountAccountId: defaultGLConfig.discountAccountId,
      });

      expect(result.success).toBe(true);
      const discountEntry = result.journalEntries.find(
        e => e.accountId === defaultGLConfig.discountAccountId
      );
      expect(discountEntry).toBeDefined();
      expect(parseFloat(discountEntry!.debitAmount)).toBe(50.00);
    });

    it('should emit PaymentApplicationPosted event', async () => {
      setupSelectMock([
        [mockApplication],
        [mockPayment],
        [
          mockAccount,
          { ...mockAccount, id: 'unapplied-cash-account-123' },
          { ...mockAccount, id: 'ar-account-123' },
          { ...mockAccount, id: 'discount-account-123' },
        ],
      ]);

      await service.postPaymentApplication({
        applicationId: 'application-123',
        unappliedCashAccountId: defaultGLConfig.unappliedCashAccountId,
        arAccountId: defaultGLConfig.arAccountId,
        discountAccountId: defaultGLConfig.discountAccountId,  // Include discount to balance entries
      });

      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'PaymentApplicationPosted',
          eventCategory: 'GL',
          aggregateType: 'CustomerPaymentApplication',
          aggregateId: 'application-123',
        })
      );
    });

    it('should return error for reversed application', async () => {
      setupSelectMock([
        [{ ...mockApplication, reversedAt: new Date() }],
      ]);

      const result = await service.postPaymentApplication({
        applicationId: 'application-123',
        unappliedCashAccountId: defaultGLConfig.unappliedCashAccountId,
        arAccountId: defaultGLConfig.arAccountId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Application has been reversed');
    });
  });

  // ==========================================================================
  // Void Payment Posting Tests
  // ==========================================================================

  describe('postPaymentVoid', () => {
    it('should create reversing journal entries for voided payment', async () => {
      setupSelectMock([
        [{ ...mockPayment, glTransactionId: 'gl-123' }],
        [mockAccount, { ...mockAccount, id: 'unapplied-cash-account-123' }],
      ]);

      const result = await service.postPaymentVoid(
        'payment-123',
        defaultGLConfig,
        'Customer requested void'
      );

      expect(result.success).toBe(true);
      expect(result.journalEntries).toHaveLength(2);

      // Check reversing entries (CR Cash, DR Unapplied Cash)
      const creditCashEntry = result.journalEntries.find(
        e => e.accountId === defaultGLConfig.cashAccountId && parseFloat(e.creditAmount) > 0
      );
      expect(creditCashEntry).toBeDefined();
      expect(creditCashEntry!.creditAmount).toBe('1000.00');
    });

    it('should emit PaymentVoidPosted event', async () => {
      setupSelectMock([
        [{ ...mockPayment, glTransactionId: 'gl-123' }],
        [mockAccount, { ...mockAccount, id: 'unapplied-cash-account-123' }],
      ]);

      await service.postPaymentVoid(
        'payment-123',
        defaultGLConfig,
        'Customer requested void'
      );

      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'PaymentVoidPosted',
          eventCategory: 'GL',
          aggregateType: 'CustomerPayment',
          aggregateId: 'payment-123',
        })
      );
    });

    it('should return success with no entries for unposted payment', async () => {
      setupSelectMock([
        [mockPayment],  // No glTransactionId
      ]);

      const result = await service.postPaymentVoid(
        'payment-123',
        defaultGLConfig,
        'Customer requested void'
      );

      expect(result.success).toBe(true);
      expect(result.journalEntries).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge cases', () => {
    it('should handle payment with zero discount amount', async () => {
      const appWithNoDiscount = { ...mockApplication, discountAmount: '0.00' };

      setupSelectMock([
        [appWithNoDiscount],
        [mockPayment],
        [mockAccount, { ...mockAccount, id: 'unapplied-cash-account-123' }],
      ]);

      const result = await service.postPaymentApplication({
        applicationId: 'application-123',
        unappliedCashAccountId: defaultGLConfig.unappliedCashAccountId,
        arAccountId: defaultGLConfig.arAccountId,
        discountAccountId: defaultGLConfig.discountAccountId,
      });

      expect(result.success).toBe(true);
      // Should NOT have discount entry when amount is 0
      const discountEntry = result.journalEntries.find(
        e => e.accountId === defaultGLConfig.discountAccountId
      );
      expect(discountEntry).toBeUndefined();
    });

    it('should include write-off entry when write-off amount provided', async () => {
      const appWithWriteOff = { ...mockApplication, writeOffAmount: '25.00', discountAmount: '0.00' };

      setupSelectMock([
        [appWithWriteOff],
        [mockPayment],
        [
          mockAccount,
          { ...mockAccount, id: 'unapplied-cash-account-123' },
          { ...mockAccount, id: 'writeoff-account-123' },
        ],
      ]);

      const result = await service.postPaymentApplication({
        applicationId: 'application-123',
        unappliedCashAccountId: defaultGLConfig.unappliedCashAccountId,
        arAccountId: defaultGLConfig.arAccountId,
        writeOffAccountId: defaultGLConfig.writeOffAccountId,
      });

      expect(result.success).toBe(true);
      const writeOffEntry = result.journalEntries.find(
        e => e.accountId === defaultGLConfig.writeOffAccountId
      );
      expect(writeOffEntry).toBeDefined();
      expect(parseFloat(writeOffEntry!.debitAmount)).toBe(25.00);
    });

    it('should handle missing organization context', async () => {
      const serviceNoOrg = new PaymentPostingService({ userId: TEST_USER_ID });

      await expect(
        serviceNoOrg.validatePaymentForPosting('payment-123')
      ).rejects.toThrow('Organization context is required');
    });
  });
});
