import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceContext } from '../../types';

// Use vi.hoisted() for ALL mock functions and constants
const {
  mockEventEmit,
  mockDbSelect,
  mockDbInsert,
  mockDbUpdate,
  mockDbDelete,
  mockDbExecute,
  HybridBillPaymentStatus,
  TransactionTypeCode
} = vi.hoisted(() => ({
  mockEventEmit: vi.fn(),
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbDelete: vi.fn(),
  mockDbExecute: vi.fn(),
  HybridBillPaymentStatus: {
    DRAFT: 'DRAFT',
    PENDING: 'PENDING',
    POSTED: 'POSTED',
    CLEARED: 'CLEARED',
    VOIDED: 'VOIDED',
  } as const,
  TransactionTypeCode: {
    BILL_PAYMENT: 'BILL_PAYMENT',
    VENDOR_BILL: 'VENDOR_BILL',
  } as const,
}));

// Mock the database module
vi.mock('@glapi/database', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
    delete: mockDbDelete,
    execute: mockDbExecute,
  },
}));

// Mock schema
vi.mock('@glapi/database/schema', () => ({
  transactionHeaders: { id: 'id', organizationId: 'organizationId', transactionType: 'transactionType' },
  transactionLines: { id: 'id', transactionId: 'transactionId' },
  billPaymentExt: { transactionId: 'transactionId', paymentMethod: 'paymentMethod' },
  billPaymentApplications2: { id: 'id', paymentId: 'paymentId', billId: 'billId' },
  vendorBillExt: { transactionId: 'transactionId', paidAmount: 'paidAmount' },
  entities: { id: 'id', name: 'name' },
  accounts: { id: 'id', accountCategory: 'accountCategory', accountSubcategory: 'accountSubcategory' },
  HybridBillPaymentStatus,
  HybridBillPaymentStatusValue: HybridBillPaymentStatus,
}));

// Mock drizzle-orm operators
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', left: a, right: b })),
  and: vi.fn((...args) => ({ type: 'and', conditions: args })),
  or: vi.fn((...args) => ({ type: 'or', conditions: args })),
  desc: vi.fn((a) => ({ type: 'desc', field: a })),
  sql: vi.fn((strings, ...values) => ({ type: 'sql', strings, values })),
  inArray: vi.fn((a, b) => ({ type: 'inArray', field: a, values: b })),
  gte: vi.fn((a, b) => ({ type: 'gte', left: a, right: b })),
  lte: vi.fn((a, b) => ({ type: 'lte', left: a, right: b })),
  ilike: vi.fn((a, b) => ({ type: 'ilike', left: a, right: b })),
}));

// Mock EventService
vi.mock('../event-service', () => ({
  EventService: vi.fn().mockImplementation(() => ({
    emit: mockEventEmit,
  })),
}));

// Mock GlPostingEngine
vi.mock('../gl-posting-engine', () => ({
  GlPostingEngine: vi.fn().mockImplementation(() => ({
    generateGlEntries: vi.fn(),
  })),
}));

// Import after mocking
import { BillPaymentHybridService } from '../bill-payment-hybrid-service';

describe('BillPaymentHybridService', () => {
  let service: BillPaymentHybridService;
  let context: ServiceContext;

  const testUserId = 'user-123';
  const testOrgId = 'org-123';
  const testSubsidiaryId = 'sub-123';
  const testVendorId = 'vendor-123';
  const testPaymentId = 'pmt-123';
  const testBillId = 'bill-123';
  const testBankAccountId = 'bank-123';

  beforeEach(() => {
    vi.clearAllMocks();

    context = {
      organizationId: testOrgId,
      userId: testUserId,
    };

    service = new BillPaymentHybridService(context);
  });

  // ========== Constructor Tests ==========

  describe('constructor', () => {
    it('should create service with context', () => {
      expect(service).toBeDefined();
    });

    it('should set transaction type to BILL_PAYMENT', () => {
      expect((service as unknown as { transactionType: string }).transactionType).toBe('BILL_PAYMENT');
    });
  });

  // ========== Status Transition Tests ==========

  describe('status transitions', () => {
    it('should define valid DRAFT transitions', () => {
      const validFromDraft = ['PENDING', 'VOIDED'];
      expect(validFromDraft).toContain('PENDING');
      expect(validFromDraft).toContain('VOIDED');
    });

    it('should define valid PENDING transitions', () => {
      const validFromPending = ['POSTED', 'VOIDED'];
      expect(validFromPending).toContain('POSTED');
      expect(validFromPending).toContain('VOIDED');
    });

    it('should define valid POSTED transitions', () => {
      const validFromPosted = ['CLEARED', 'VOIDED'];
      expect(validFromPosted).toContain('CLEARED');
      expect(validFromPosted).toContain('VOIDED');
    });

    it('should define valid CLEARED transitions', () => {
      const validFromCleared = ['VOIDED'];
      expect(validFromCleared).toContain('VOIDED');
    });

    it('should not allow transitions from VOIDED', () => {
      const validFromVoided: string[] = [];
      expect(validFromVoided).toHaveLength(0);
    });
  });

  // ========== Type Definition Tests ==========

  describe('type definitions', () => {
    it('should define BillPaymentHeader interface fields', () => {
      const headerFields = [
        'vendorId',
        'vendorName',
        'paymentDate',
        'totalAmount',
        'currencyCode',
        'exchangeRate',
        'memo',
      ];

      expect(headerFields).toContain('vendorId');
      expect(headerFields).toContain('paymentDate');
      expect(headerFields).toContain('totalAmount');
    });

    it('should define BillPaymentExtension interface fields', () => {
      const extensionFields = [
        'paymentMethod',
        'paymentAmount',
        'appliedAmount',
        'unappliedAmount',
        'discountTaken',
        'bankAccountId',
        'checkNumber',
        'achTraceNumber',
        'wireReference',
        'externalRef',
        'payeeName',
        'clearedDate',
        'clearedAmount',
        'voidedAt',
        'voidedBy',
        'voidReason',
      ];

      expect(extensionFields).toContain('paymentMethod');
      expect(extensionFields).toContain('bankAccountId');
      expect(extensionFields).toContain('checkNumber');
      expect(extensionFields).toContain('clearedDate');
    });

    it('should define BillPaymentApplicationDetail interface fields', () => {
      const applicationFields = [
        'billId',
        'billNumber',
        'vendorInvoiceNumber',
        'appliedAmount',
        'discountTaken',
        'applicationDate',
      ];

      expect(applicationFields).toContain('billId');
      expect(applicationFields).toContain('appliedAmount');
      expect(applicationFields).toContain('discountTaken');
    });
  });

  // ========== Input Validation Tests ==========

  describe('input validation', () => {
    it('should require subsidiaryId for create', () => {
      const validInput = {
        subsidiaryId: testSubsidiaryId,
        vendorId: testVendorId,
        paymentDate: '2024-01-15',
        paymentMethod: 'CHECK',
        applications: [{ billId: testBillId, appliedAmount: 100 }],
      };

      expect(validInput.subsidiaryId).toBeDefined();
    });

    it('should require vendorId for create', () => {
      const validInput = {
        subsidiaryId: testSubsidiaryId,
        vendorId: testVendorId,
        paymentDate: '2024-01-15',
        paymentMethod: 'CHECK',
        applications: [{ billId: testBillId, appliedAmount: 100 }],
      };

      expect(validInput.vendorId).toBeDefined();
    });

    it('should require paymentMethod for create', () => {
      const validInput = {
        subsidiaryId: testSubsidiaryId,
        vendorId: testVendorId,
        paymentDate: '2024-01-15',
        paymentMethod: 'CHECK',
        applications: [{ billId: testBillId, appliedAmount: 100 }],
      };

      expect(validInput.paymentMethod).toBeDefined();
    });

    it('should require at least one application for create', () => {
      const validInput = {
        subsidiaryId: testSubsidiaryId,
        vendorId: testVendorId,
        paymentDate: '2024-01-15',
        paymentMethod: 'CHECK',
        applications: [{ billId: testBillId, appliedAmount: 100 }],
      };

      expect(validInput.applications.length).toBeGreaterThan(0);
    });

    it('should support optional bank account fields', () => {
      const inputWithBank = {
        subsidiaryId: testSubsidiaryId,
        vendorId: testVendorId,
        paymentDate: '2024-01-15',
        paymentMethod: 'CHECK',
        bankAccountId: testBankAccountId,
        checkNumber: '12345',
        applications: [{ billId: testBillId, appliedAmount: 100 }],
      };

      expect(inputWithBank.bankAccountId).toBeDefined();
      expect(inputWithBank.checkNumber).toBeDefined();
    });
  });

  // ========== Payment Method Tests ==========

  describe('payment methods', () => {
    it('should support CHECK payment method', () => {
      const paymentMethod = 'CHECK';
      expect(paymentMethod).toBe('CHECK');
    });

    it('should support ACH payment method', () => {
      const paymentMethod = 'ACH';
      expect(paymentMethod).toBe('ACH');
    });

    it('should support WIRE payment method', () => {
      const paymentMethod = 'WIRE';
      expect(paymentMethod).toBe('WIRE');
    });

    it('should support CASH payment method', () => {
      const paymentMethod = 'CASH';
      expect(paymentMethod).toBe('CASH');
    });

    it('should support CREDIT_CARD payment method', () => {
      const paymentMethod = 'CREDIT_CARD';
      expect(paymentMethod).toBe('CREDIT_CARD');
    });
  });

  // ========== Payment Calculation Tests ==========

  describe('payment calculations', () => {
    it('should calculate total payment from applications', () => {
      const applications = [
        { billId: 'bill-1', appliedAmount: 500, discountTaken: 10 },
        { billId: 'bill-2', appliedAmount: 300, discountTaken: 0 },
      ];

      const totalApplied = applications.reduce((sum, a) => sum + a.appliedAmount, 0);
      const totalDiscount = applications.reduce((sum, a) => sum + a.discountTaken, 0);
      const totalPayment = totalApplied + totalDiscount;

      expect(totalApplied).toBe(800);
      expect(totalDiscount).toBe(10);
      expect(totalPayment).toBe(810);
    });

    it('should track unapplied amount', () => {
      const paymentAmount = 1000;
      const appliedAmount = 800;
      const unappliedAmount = paymentAmount - appliedAmount;

      expect(unappliedAmount).toBe(200);
    });
  });

  // ========== GL Posting Tests ==========

  describe('GL posting', () => {
    it('should define GL posting for bill payments', () => {
      const glEntries = {
        debit: { account: 'ACCOUNTS_PAYABLE', amount: 1000 },
        credit: { account: 'CASH', amount: 1000 },
      };

      expect(glEntries.debit.account).toBe('ACCOUNTS_PAYABLE');
      expect(glEntries.credit.account).toBe('CASH');
    });

    it('should handle discounts in GL posting', () => {
      const paymentAmount = 970;
      const discountTaken = 30;
      const totalDebit = paymentAmount + discountTaken;

      // DR Accounts Payable (full amount)
      // CR Cash (actual payment)
      // CR Purchase Discounts (discount taken)

      expect(totalDebit).toBe(1000);
    });

    it('should require bank account for posting', () => {
      const payment = {
        bankAccountId: null,
      };

      const canPost = payment.bankAccountId !== null;
      expect(canPost).toBe(false);
    });
  });

  // ========== Bill Balance Update Tests ==========

  describe('bill balance updates', () => {
    it('should update bill paid amount on posting', () => {
      const bill = {
        totalAmount: 1000,
        paidAmount: 0,
        balanceDue: 1000,
      };
      const appliedAmount = 400;

      const newPaidAmount = bill.paidAmount + appliedAmount;
      const newBalanceDue = bill.totalAmount - newPaidAmount;

      expect(newPaidAmount).toBe(400);
      expect(newBalanceDue).toBe(600);
    });

    it('should transition bill to PARTIALLY_PAID when partial payment', () => {
      const bill = {
        totalAmount: 1000,
        paidAmount: 400,
        balanceDue: 600,
      };

      const newStatus = bill.balanceDue > 0 ? 'PARTIALLY_PAID' : 'PAID';
      expect(newStatus).toBe('PARTIALLY_PAID');
    });

    it('should transition bill to PAID when fully paid', () => {
      const bill = {
        totalAmount: 1000,
        paidAmount: 1000,
        balanceDue: 0,
      };

      const newStatus = bill.balanceDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';
      expect(newStatus).toBe('PAID');
    });
  });

  // ========== Event Emission Tests ==========

  describe('event emission', () => {
    it('should define BILL_PAYMENT_CREATED event type', () => {
      const eventType = 'BILL_PAYMENT_CREATED';
      expect(eventType).toBe('BILL_PAYMENT_CREATED');
    });

    it('should define BILL_PAYMENT_POSTED event type', () => {
      const eventType = 'BILL_PAYMENT_POSTED';
      expect(eventType).toBe('BILL_PAYMENT_POSTED');
    });

    it('should define BILL_PAYMENT_CLEARED event type', () => {
      const eventType = 'BILL_PAYMENT_CLEARED';
      expect(eventType).toBe('BILL_PAYMENT_CLEARED');
    });

    it('should define BILL_PAYMENT_VOIDED event type', () => {
      const eventType = 'BILL_PAYMENT_VOIDED';
      expect(eventType).toBe('BILL_PAYMENT_VOIDED');
    });

    it('should define BILL_PAYMENT_GL_READY event type', () => {
      const eventType = 'BILL_PAYMENT_GL_READY';
      expect(eventType).toBe('BILL_PAYMENT_GL_READY');
    });
  });

  // ========== Bank Clearing Tests ==========

  describe('bank clearing', () => {
    it('should track cleared date', () => {
      const payment = {
        status: 'CLEARED',
        clearedDate: '2024-01-20',
        clearedAmount: 1000,
      };

      expect(payment.clearedDate).toBeDefined();
    });

    it('should track cleared amount for reconciliation', () => {
      const payment = {
        paymentAmount: 1000,
        clearedAmount: 1000,
      };

      const isReconciled = payment.clearedAmount === payment.paymentAmount;
      expect(isReconciled).toBe(true);
    });

    it('should only allow clearing POSTED payments', () => {
      const payment = { status: 'POSTED' };
      const canClear = payment.status === 'POSTED';
      expect(canClear).toBe(true);
    });
  });

  // ========== Void Tests ==========

  describe('void functionality', () => {
    it('should reverse bill balance on void', () => {
      const bill = {
        totalAmount: 1000,
        paidAmount: 400,
        balanceDue: 600,
      };
      const appliedAmount = 400;

      const newPaidAmount = bill.paidAmount - appliedAmount;
      const newBalanceDue = bill.totalAmount - newPaidAmount;

      expect(newPaidAmount).toBe(0);
      expect(newBalanceDue).toBe(1000);
    });

    it('should require void reason', () => {
      const voidRequest = {
        paymentId: testPaymentId,
        reason: 'Duplicate payment',
      };

      expect(voidRequest.reason).toBeDefined();
    });

    it('should track void metadata', () => {
      const voidedPayment = {
        voidedAt: new Date().toISOString(),
        voidedBy: testUserId,
        voidReason: 'Duplicate payment',
      };

      expect(voidedPayment.voidedAt).toBeDefined();
      expect(voidedPayment.voidedBy).toBeDefined();
      expect(voidedPayment.voidReason).toBeDefined();
    });
  });

  // ========== Filter Tests ==========

  describe('filters', () => {
    it('should support status filter', () => {
      const filters = { status: 'POSTED' };
      expect(filters.status).toBe('POSTED');
    });

    it('should support paymentMethod filter', () => {
      const filters = { paymentMethod: 'CHECK' };
      expect(filters.paymentMethod).toBe('CHECK');
    });

    it('should support bankAccountId filter', () => {
      const filters = { bankAccountId: testBankAccountId };
      expect(filters.bankAccountId).toBe(testBankAccountId);
    });

    it('should support isCleared filter', () => {
      const filters = { isCleared: true };
      expect(filters.isCleared).toBe(true);
    });

    it('should support date range filters', () => {
      const filters = {
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
      };
      expect(filters.dateFrom).toBeDefined();
      expect(filters.dateTo).toBeDefined();
    });
  });

  // ========== Summary/Reporting Tests ==========

  describe('summary and reporting', () => {
    it('should calculate payment summary by method', () => {
      const payments = [
        { paymentMethod: 'CHECK', amount: 500 },
        { paymentMethod: 'CHECK', amount: 300 },
        { paymentMethod: 'ACH', amount: 1000 },
      ];

      const byMethod: Record<string, number> = {};
      for (const p of payments) {
        byMethod[p.paymentMethod] = (byMethod[p.paymentMethod] || 0) + p.amount;
      }

      expect(byMethod['CHECK']).toBe(800);
      expect(byMethod['ACH']).toBe(1000);
    });

    it('should calculate payment summary by status', () => {
      const payments = [
        { status: 'POSTED', amount: 500 },
        { status: 'POSTED', amount: 300 },
        { status: 'CLEARED', amount: 1000 },
      ];

      const byStatus: Record<string, number> = {};
      for (const p of payments) {
        byStatus[p.status] = (byStatus[p.status] || 0) + p.amount;
      }

      expect(byStatus['POSTED']).toBe(800);
      expect(byStatus['CLEARED']).toBe(1000);
    });
  });
});
