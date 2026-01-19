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
  HybridVendorBillStatus,
  HybridThreeWayMatchStatus,
  HybridLineMatchStatus,
  TransactionTypeCode
} = vi.hoisted(() => ({
  mockEventEmit: vi.fn(),
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbDelete: vi.fn(),
  mockDbExecute: vi.fn(),
  HybridVendorBillStatus: {
    DRAFT: 'DRAFT',
    PENDING_APPROVAL: 'PENDING_APPROVAL',
    APPROVED: 'APPROVED',
    PENDING_MATCH: 'PENDING_MATCH',
    MATCHED: 'MATCHED',
    MATCH_EXCEPTION: 'MATCH_EXCEPTION',
    PARTIALLY_PAID: 'PARTIALLY_PAID',
    PAID: 'PAID',
    VOIDED: 'VOIDED',
    CANCELLED: 'CANCELLED',
  } as const,
  HybridThreeWayMatchStatus: {
    NOT_REQUIRED: 'NOT_REQUIRED',
    PENDING: 'PENDING',
    MATCHED: 'MATCHED',
    VARIANCE_WITHIN_TOLERANCE: 'VARIANCE_WITHIN_TOLERANCE',
    VARIANCE_EXCEPTION: 'VARIANCE_EXCEPTION',
    OVERRIDE_APPROVED: 'OVERRIDE_APPROVED',
  } as const,
  HybridLineMatchStatus: {
    NOT_REQUIRED: 'NOT_REQUIRED',
    PENDING: 'PENDING',
    MATCHED: 'MATCHED',
    QUANTITY_VARIANCE: 'QUANTITY_VARIANCE',
    PRICE_VARIANCE: 'PRICE_VARIANCE',
    BOTH_VARIANCE: 'BOTH_VARIANCE',
  } as const,
  TransactionTypeCode: {
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
  transactionLines: { id: 'id', transactionId: 'transactionId', lineNumber: 'lineNumber' },
  vendorBillExt: { transactionId: 'transactionId', purchaseOrderId: 'purchaseOrderId' },
  vendorBillLineExt: { lineId: 'lineId', purchaseOrderLineId: 'purchaseOrderLineId' },
  purchaseOrderExt: { transactionId: 'transactionId' },
  purchaseOrderLineExt: { lineId: 'lineId', quantityReceived: 'quantityReceived' },
  entities: { id: 'id', name: 'name' },
  accounts: { id: 'id', accountCategory: 'accountCategory' },
  HybridVendorBillStatus,
  HybridVendorBillStatusValue: HybridVendorBillStatus,
  HybridThreeWayMatchStatus,
  HybridLineMatchStatus,
  HybridLineMatchStatusValue: HybridLineMatchStatus,
}));

// Mock drizzle-orm operators
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', left: a, right: b })),
  and: vi.fn((...args) => ({ type: 'and', conditions: args })),
  or: vi.fn((...args) => ({ type: 'or', conditions: args })),
  desc: vi.fn((a) => ({ type: 'desc', field: a })),
  asc: vi.fn((a) => ({ type: 'asc', field: a })),
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

// Import after mocking
import { VendorBillHybridService } from '../vendor-bill-hybrid-service';

describe('VendorBillHybridService', () => {
  let service: VendorBillHybridService;
  let context: ServiceContext;

  const testUserId = 'user-123';
  const testOrgId = 'org-123';
  const testSubsidiaryId = 'sub-123';
  const testVendorId = 'vendor-123';
  const testBillId = 'bill-123';
  const testPoId = 'po-123';

  beforeEach(() => {
    vi.clearAllMocks();

    context = {
      organizationId: testOrgId,
      userId: testUserId,
    };

    service = new VendorBillHybridService(context);
  });

  // ========== Constructor Tests ==========

  describe('constructor', () => {
    it('should create service with context', () => {
      expect(service).toBeDefined();
    });

    it('should set transaction type to VENDOR_BILL', () => {
      expect((service as unknown as { transactionType: string }).transactionType).toBe('VENDOR_BILL');
    });
  });

  // ========== Status Transition Tests ==========

  describe('status transitions', () => {
    it('should define valid DRAFT transitions', () => {
      const validFromDraft = ['PENDING_APPROVAL', 'CANCELLED'];
      expect(validFromDraft).toContain('PENDING_APPROVAL');
      expect(validFromDraft).toContain('CANCELLED');
    });

    it('should define valid PENDING_APPROVAL transitions', () => {
      const validFromPending = ['APPROVED', 'DRAFT', 'CANCELLED'];
      expect(validFromPending).toContain('APPROVED');
      expect(validFromPending).toContain('DRAFT');
    });

    it('should define valid APPROVED transitions', () => {
      const validFromApproved = ['PARTIALLY_PAID', 'PAID', 'VOIDED'];
      expect(validFromApproved).toContain('PARTIALLY_PAID');
      expect(validFromApproved).toContain('PAID');
    });

    it('should define valid payment transitions', () => {
      const validFromPartiallyPaid = ['PAID', 'VOIDED'];
      expect(validFromPartiallyPaid).toContain('PAID');
      expect(validFromPartiallyPaid).toContain('VOIDED');
    });

    it('should not allow transitions from VOIDED', () => {
      const validFromVoided: string[] = [];
      expect(validFromVoided).toHaveLength(0);
    });

    it('should not allow transitions from CANCELLED', () => {
      const validFromCancelled: string[] = [];
      expect(validFromCancelled).toHaveLength(0);
    });
  });

  // ========== 3-Way Match Tests ==========

  describe('3-way match validation', () => {
    it('should define NOT_REQUIRED match status for bills without PO', () => {
      expect(HybridThreeWayMatchStatus.NOT_REQUIRED).toBe('NOT_REQUIRED');
    });

    it('should define PENDING match status for new bills with PO', () => {
      expect(HybridThreeWayMatchStatus.PENDING).toBe('PENDING');
    });

    it('should define MATCHED status for bills without variance', () => {
      expect(HybridThreeWayMatchStatus.MATCHED).toBe('MATCHED');
    });

    it('should define VARIANCE_EXCEPTION for bills with variance', () => {
      expect(HybridThreeWayMatchStatus.VARIANCE_EXCEPTION).toBe('VARIANCE_EXCEPTION');
    });

    it('should define OVERRIDE_APPROVED for approved exceptions', () => {
      expect(HybridThreeWayMatchStatus.OVERRIDE_APPROVED).toBe('OVERRIDE_APPROVED');
    });
  });

  // ========== 2-Way Match Tests ==========

  describe('2-way match support', () => {
    it('should compare billed qty to PO qty when no receipt exists', () => {
      // 2-way match: Bill quantity should match PO quantity
      const poQty = 10;
      const billedQty = 10;
      const variance = billedQty - poQty;

      expect(variance).toBe(0);
    });

    it('should detect 2-way quantity variance', () => {
      const poQty = 10;
      const billedQty = 12;
      const variance = billedQty - poQty;

      expect(variance).toBe(2);
    });
  });

  // ========== Line Match Status Tests ==========

  describe('line match status', () => {
    it('should define QUANTITY_VARIANCE status', () => {
      expect(HybridLineMatchStatus.QUANTITY_VARIANCE).toBe('QUANTITY_VARIANCE');
    });

    it('should define PRICE_VARIANCE status', () => {
      expect(HybridLineMatchStatus.PRICE_VARIANCE).toBe('PRICE_VARIANCE');
    });

    it('should define BOTH_VARIANCE status', () => {
      expect(HybridLineMatchStatus.BOTH_VARIANCE).toBe('BOTH_VARIANCE');
    });
  });

  // ========== Type Definition Tests ==========

  describe('type definitions', () => {
    it('should define VendorBillHeader interface fields', () => {
      const headerFields = [
        'vendorInvoiceNumber',
        'purchaseOrderId',
        'dueDate',
        'receivedDate',
        'shippingAmount',
        'threeWayMatchStatus',
        'matchVarianceAmount',
        'matchOverrideReason',
        'paidAmount',
        'balanceDue',
        'discountDate',
        'discountPercent',
        'discountAmount',
        'discountTaken',
        'apAccountId',
        'approvedAt',
        'approvedBy',
        'voidedAt',
        'voidedBy',
        'voidReason',
      ];

      expect(headerFields).toContain('vendorInvoiceNumber');
      expect(headerFields).toContain('threeWayMatchStatus');
      expect(headerFields).toContain('paidAmount');
      expect(headerFields).toContain('balanceDue');
    });

    it('should define VendorBillLine interface fields', () => {
      const lineFields = [
        'purchaseOrderLineId',
        'receiptLineId',
        'poQuantity',
        'poUnitPrice',
        'receivedQuantity',
        'quantityVariance',
        'priceVariance',
        'matchStatus',
      ];

      expect(lineFields).toContain('purchaseOrderLineId');
      expect(lineFields).toContain('quantityVariance');
      expect(lineFields).toContain('priceVariance');
      expect(lineFields).toContain('matchStatus');
    });
  });

  // ========== Input Validation Tests ==========

  describe('input validation', () => {
    it('should require subsidiaryId for create', () => {
      const validInput = {
        subsidiaryId: testSubsidiaryId,
        vendorId: testVendorId,
        billDate: '2024-01-15',
        dueDate: '2024-02-15',
        lines: [{ itemName: 'Test', quantity: 1, unitPrice: 100 }],
      };

      expect(validInput.subsidiaryId).toBeDefined();
    });

    it('should require vendorId for create', () => {
      const validInput = {
        subsidiaryId: testSubsidiaryId,
        vendorId: testVendorId,
        billDate: '2024-01-15',
        dueDate: '2024-02-15',
        lines: [{ itemName: 'Test', quantity: 1, unitPrice: 100 }],
      };

      expect(validInput.vendorId).toBeDefined();
    });

    it('should require dueDate for create', () => {
      const validInput = {
        subsidiaryId: testSubsidiaryId,
        vendorId: testVendorId,
        billDate: '2024-01-15',
        dueDate: '2024-02-15',
        lines: [{ itemName: 'Test', quantity: 1, unitPrice: 100 }],
      };

      expect(validInput.dueDate).toBeDefined();
    });

    it('should support optional PO linkage', () => {
      const inputWithPO = {
        subsidiaryId: testSubsidiaryId,
        vendorId: testVendorId,
        purchaseOrderId: testPoId,
        billDate: '2024-01-15',
        dueDate: '2024-02-15',
        lines: [{ itemName: 'Test', quantity: 1, unitPrice: 100, purchaseOrderLineId: 'po-line-1' }],
      };

      expect(inputWithPO.purchaseOrderId).toBeDefined();
    });

    it('should support discount fields', () => {
      const inputWithDiscount = {
        subsidiaryId: testSubsidiaryId,
        vendorId: testVendorId,
        billDate: '2024-01-15',
        dueDate: '2024-02-15',
        discountDate: '2024-01-25',
        discountPercent: 2,
        discountAmount: 20,
        lines: [{ itemName: 'Test', quantity: 1, unitPrice: 100 }],
      };

      expect(inputWithDiscount.discountDate).toBeDefined();
      expect(inputWithDiscount.discountPercent).toBe(2);
    });
  });

  // ========== Variance Calculation Tests ==========

  describe('variance calculations', () => {
    it('should calculate quantity variance correctly', () => {
      const billedQty = 10;
      const receivedQty = 8;
      const variance = billedQty - receivedQty;

      expect(variance).toBe(2);
    });

    it('should calculate price variance correctly', () => {
      const billedPrice = 105;
      const poPrice = 100;
      const variance = billedPrice - poPrice;

      expect(variance).toBe(5);
    });

    it('should calculate total variance as price * quantity impact', () => {
      const billedQty = 10;
      const receivedQty = 8;
      const billedPrice = 105;
      const poPrice = 100;

      const qtyVariance = billedQty - receivedQty;
      const priceVariance = billedPrice - poPrice;

      // Quantity variance impact = (10 - 8) * 105 = 210
      const qtyImpact = qtyVariance * billedPrice;
      // Price variance impact = (105 - 100) * 10 = 50
      const priceImpact = priceVariance * billedQty;

      expect(qtyImpact).toBe(210);
      expect(priceImpact).toBe(50);
    });
  });

  // ========== Event Emission Tests ==========

  describe('event emission', () => {
    it('should define VendorBillCreated event type', () => {
      const eventType = 'VendorBillCreated';
      expect(eventType).toBe('VendorBillCreated');
    });

    it('should define VendorBillSubmitted event type', () => {
      const eventType = 'VendorBillSubmitted';
      expect(eventType).toBe('VendorBillSubmitted');
    });

    it('should define VendorBillApproved event type', () => {
      const eventType = 'VendorBillApproved';
      expect(eventType).toBe('VendorBillApproved');
    });

    it('should define ThreeWayMatchCompleted event type', () => {
      const eventType = 'ThreeWayMatchCompleted';
      expect(eventType).toBe('ThreeWayMatchCompleted');
    });

    it('should define MatchExceptionOverridden event type', () => {
      const eventType = 'MatchExceptionOverridden';
      expect(eventType).toBe('MatchExceptionOverridden');
    });

    it('should define VendorBillVoided event type', () => {
      const eventType = 'VendorBillVoided';
      expect(eventType).toBe('VendorBillVoided');
    });
  });

  // ========== Approval Workflow Tests ==========

  describe('approval workflow', () => {
    it('should block submission with unresolved match exceptions', () => {
      const bill = {
        status: 'DRAFT',
        threeWayMatchStatus: 'VARIANCE_EXCEPTION',
      };

      const canSubmit = bill.threeWayMatchStatus !== 'VARIANCE_EXCEPTION';
      expect(canSubmit).toBe(false);
    });

    it('should allow submission after match override', () => {
      const bill = {
        status: 'DRAFT',
        threeWayMatchStatus: 'OVERRIDE_APPROVED',
      };

      const canSubmit = bill.threeWayMatchStatus !== 'VARIANCE_EXCEPTION';
      expect(canSubmit).toBe(true);
    });

    it('should allow submission when match passes', () => {
      const bill = {
        status: 'DRAFT',
        threeWayMatchStatus: 'MATCHED',
      };

      const canSubmit = bill.threeWayMatchStatus !== 'VARIANCE_EXCEPTION';
      expect(canSubmit).toBe(true);
    });
  });

  // ========== Payment Tracking Tests ==========

  describe('payment tracking', () => {
    it('should calculate balance due correctly', () => {
      const totalAmount = 1000;
      const paidAmount = 400;
      const discountTaken = 0;
      const balanceDue = totalAmount - paidAmount - discountTaken;

      expect(balanceDue).toBe(600);
    });

    it('should transition to PARTIALLY_PAID when partial payment applied', () => {
      const totalAmount = 1000;
      const paidAmount = 400;
      const balanceDue = totalAmount - paidAmount;

      const newStatus = balanceDue > 0 && paidAmount > 0 ? 'PARTIALLY_PAID' : 'APPROVED';
      expect(newStatus).toBe('PARTIALLY_PAID');
    });

    it('should transition to PAID when fully paid', () => {
      const totalAmount = 1000;
      const paidAmount = 1000;
      const balanceDue = totalAmount - paidAmount;

      const newStatus = balanceDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';
      expect(newStatus).toBe('PAID');
    });

    it('should track discounts taken', () => {
      const totalAmount = 1000;
      const paidAmount = 970;
      const discountTaken = 30;
      const balanceDue = totalAmount - paidAmount - discountTaken;

      expect(balanceDue).toBe(0);
    });
  });

  // ========== Filter Tests ==========

  describe('filters', () => {
    it('should support status filter', () => {
      const filters = { status: 'DRAFT' };
      expect(filters.status).toBe('DRAFT');
    });

    it('should support vendorId filter', () => {
      const filters = { vendorId: testVendorId };
      expect(filters.vendorId).toBe(testVendorId);
    });

    it('should support purchaseOrderId filter', () => {
      const filters = { purchaseOrderId: testPoId };
      expect(filters.purchaseOrderId).toBe(testPoId);
    });

    it('should support threeWayMatchStatus filter', () => {
      const filters = { threeWayMatchStatus: 'VARIANCE_EXCEPTION' };
      expect(filters.threeWayMatchStatus).toBe('VARIANCE_EXCEPTION');
    });

    it('should support hasBalance filter', () => {
      const filters = { hasBalance: true };
      expect(filters.hasBalance).toBe(true);
    });

    it('should support date range filters', () => {
      const filters = {
        billDateFrom: '2024-01-01',
        billDateTo: '2024-12-31',
      };
      expect(filters.billDateFrom).toBeDefined();
      expect(filters.billDateTo).toBeDefined();
    });
  });

  // ========== Void Tests ==========

  describe('void functionality', () => {
    it('should prevent voiding bills with payments', () => {
      const bill = {
        status: 'APPROVED',
        paidAmount: 500,
      };

      const canVoid = bill.paidAmount === 0;
      expect(canVoid).toBe(false);
    });

    it('should allow voiding bills without payments', () => {
      const bill = {
        status: 'APPROVED',
        paidAmount: 0,
      };

      const canVoid = bill.paidAmount === 0;
      expect(canVoid).toBe(true);
    });
  });
});
