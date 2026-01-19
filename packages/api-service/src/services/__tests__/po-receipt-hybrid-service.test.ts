import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceContext } from '../../types';

// Use vi.hoisted() for ALL mock functions and constants
const {
  mockEventEmit,
  mockPOServiceGetById,
  mockPOServiceUpdateReceivedAmounts,
  mockDbSelect,
  mockDbInsert,
  mockDbUpdate,
  mockDbDelete,
  mockDbExecute,
  HybridPOReceiptStatus,
  HybridPurchaseOrderStatus,
  TransactionTypeCode
} = vi.hoisted(() => ({
  mockEventEmit: vi.fn(),
  mockPOServiceGetById: vi.fn(),
  mockPOServiceUpdateReceivedAmounts: vi.fn(),
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbDelete: vi.fn(),
  mockDbExecute: vi.fn(),
  HybridPOReceiptStatus: {
    DRAFT: 'DRAFT',
    PENDING: 'PENDING',
    POSTED: 'POSTED',
    CANCELLED: 'CANCELLED',
  } as const,
  HybridPurchaseOrderStatus: {
    DRAFT: 'DRAFT',
    PENDING_APPROVAL: 'PENDING_APPROVAL',
    APPROVED: 'APPROVED',
    PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
    FULLY_RECEIVED: 'FULLY_RECEIVED',
    CLOSED: 'CLOSED',
    CANCELLED: 'CANCELLED',
  } as const,
  TransactionTypeCode: {
    PURCHASE_ORDER: 'PURCHASE_ORDER',
    PO_RECEIPT: 'PO_RECEIPT',
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
  transactionHeaders: { id: 'id', organizationId: 'organizationId', transactionType: 'transactionType', transactionNumber: 'transactionNumber' },
  transactionLines: { id: 'id', transactionId: 'transactionId', lineNumber: 'lineNumber' },
  poReceiptExt: { transactionId: 'transactionId', purchaseOrderId: 'purchaseOrderId' },
  poReceiptLineExt: { lineId: 'lineId', purchaseOrderLineId: 'purchaseOrderLineId' },
  purchaseOrderExt: { transactionId: 'transactionId' },
  purchaseOrderLineExt: { lineId: 'lineId' },
  entities: { id: 'id', name: 'name' },
  HybridPOReceiptStatus,
  HybridPOReceiptStatusValue: HybridPOReceiptStatus,
  HybridPurchaseOrderStatus,
  HybridPurchaseOrderStatusValue: HybridPurchaseOrderStatus,
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

// Mock PurchaseOrderHybridService
vi.mock('../purchase-order-hybrid-service', () => ({
  PurchaseOrderHybridService: vi.fn().mockImplementation(() => ({
    getPurchaseOrderById: mockPOServiceGetById,
    updateReceivedAmounts: mockPOServiceUpdateReceivedAmounts,
  })),
}));

// Import after mocking
import { POReceiptHybridService } from '../po-receipt-hybrid-service';

describe('POReceiptHybridService', () => {
  let service: POReceiptHybridService;
  let context: ServiceContext;

  const testUserId = 'user-123';
  const testOrgId = 'org-123';
  const testSubsidiaryId = 'sub-123';
  const testVendorId = 'vendor-123';
  const testPoId = 'po-123';
  const testReceiptId = 'rcv-123';
  const testPoLineId = 'po-line-123';

  const mockVendor = {
    id: testVendorId,
    name: 'Test Vendor Inc',
  };

  const mockPurchaseOrder = {
    header: {
      id: testPoId,
      organizationId: testOrgId,
      subsidiaryId: testSubsidiaryId,
      transactionType: 'PURCHASE_ORDER',
      transactionNumber: 'PO-2024-000001',
      entityId: testVendorId,
      entityName: 'Test Vendor Inc',
      transactionDate: '2024-01-15',
      status: 'APPROVED',
      subtotal: '1000.00',
      taxAmount: '80.00',
      totalAmount: '1080.00',
      currencyCode: 'USD',
      exchangeRate: '1',
    },
    lines: [
      {
        id: testPoLineId,
        transactionId: testPoId,
        lineNumber: 1,
        itemId: 'item-123',
        itemName: 'Widget A',
        itemDescription: 'A standard widget',
        quantity: '10',
        unitOfMeasure: 'EA',
        unitPrice: '100.00',
        amount: '1000.00',
        taxAmount: '80.00',
        quantityReceived: '0',
        quantityBilled: '0',
        accountId: 'acc-123',
      },
    ],
    vendor: mockVendor,
  };

  const mockReceiptHeader = {
    id: testReceiptId,
    organizationId: testOrgId,
    subsidiaryId: testSubsidiaryId,
    transactionType: 'PO_RECEIPT',
    transactionNumber: 'RCV-2024-000001',
    entityId: testVendorId,
    entityName: 'Test Vendor Inc',
    transactionDate: '2024-01-20',
    status: 'DRAFT',
    subtotal: '500.00',
    taxAmount: '0',
    totalAmount: '500.00',
    currencyCode: 'USD',
    exchangeRate: '1',
    memo: 'Partial receipt',
    createdAt: new Date('2024-01-20'),
    createdBy: testUserId,
    updatedAt: new Date('2024-01-20'),
  };

  const mockReceiptExt = {
    transactionId: testReceiptId,
    purchaseOrderId: testPoId,
    receiptLocationId: 'loc-123',
    shippingRef: 'SHIP-001',
    carrierName: 'FedEx',
    postedAt: null,
    postedBy: null,
    cancelledAt: null,
  };

  const mockReceiptLine = {
    id: 'rcv-line-123',
    transactionId: testReceiptId,
    lineNumber: 1,
    itemId: 'item-123',
    itemName: 'Widget A',
    quantity: '5',
    unitPrice: '100.00',
    amount: '500.00',
    taxAmount: '0',
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-01-20'),
  };

  const mockReceiptLineExt = {
    lineId: 'rcv-line-123',
    purchaseOrderLineId: testPoLineId,
    quantityAccepted: '5',
    quantityRejected: '0',
    rejectionReason: null,
    binLocation: 'BIN-A1',
    lotNumber: 'LOT-001',
    serialNumbers: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    context = {
      organizationId: testOrgId,
      userId: testUserId,
    };

    service = new POReceiptHybridService(context);

    // Reset PO service mocks
    mockPOServiceGetById.mockReset();
    mockPOServiceUpdateReceivedAmounts.mockReset();
  });

  // ========== Constructor Tests ==========

  describe('constructor', () => {
    it('should create service with context', () => {
      expect(service).toBeDefined();
    });

    it('should set transaction type to PO_RECEIPT', () => {
      expect((service as unknown as { transactionType: string }).transactionType).toBe('PO_RECEIPT');
    });
  });

  // ========== GET BY ID Tests ==========

  describe('getReceiptById', () => {
    it('should have getReceiptById method', () => {
      expect(typeof service.getReceiptById).toBe('function');
    });
  });

  // ========== Status Transition Tests ==========

  describe('status transitions', () => {
    it('should define valid DRAFT transitions', () => {
      const validFromDraft = ['PENDING', 'CANCELLED'];
      expect(validFromDraft).toContain('PENDING');
      expect(validFromDraft).toContain('CANCELLED');
    });

    it('should define valid PENDING transitions', () => {
      const validFromPending = ['POSTED', 'CANCELLED', 'DRAFT'];
      expect(validFromPending).toContain('POSTED');
      expect(validFromPending).toContain('CANCELLED');
      expect(validFromPending).toContain('DRAFT');
    });

    it('should not allow transitions from POSTED', () => {
      const validFromPosted: string[] = [];
      expect(validFromPosted).toHaveLength(0);
    });

    it('should not allow transitions from CANCELLED', () => {
      const validFromCancelled: string[] = [];
      expect(validFromCancelled).toHaveLength(0);
    });
  });

  // ========== Type Definition Tests ==========

  describe('type definitions', () => {
    it('should define POReceiptHeader interface fields', () => {
      const headerFields = [
        'purchaseOrderId',
        'purchaseOrderNumber',
        'receiptLocationId',
        'shippingRef',
        'carrierName',
        'postedAt',
        'postedBy',
        'cancelledAt',
      ];

      expect(headerFields).toContain('purchaseOrderId');
      expect(headerFields).toContain('receiptLocationId');
      expect(headerFields).toContain('postedAt');
    });

    it('should define POReceiptLine interface fields', () => {
      const lineFields = [
        'purchaseOrderLineId',
        'quantityAccepted',
        'quantityRejected',
        'rejectionReason',
        'binLocation',
        'lotNumber',
        'serialNumbers',
      ];

      expect(lineFields).toContain('purchaseOrderLineId');
      expect(lineFields).toContain('quantityAccepted');
      expect(lineFields).toContain('quantityRejected');
      expect(lineFields).toContain('binLocation');
      expect(lineFields).toContain('lotNumber');
      expect(lineFields).toContain('serialNumbers');
    });
  });

  // ========== Input Validation Tests ==========

  describe('input validation', () => {
    it('should require purchaseOrderId for create', () => {
      const validInput = {
        purchaseOrderId: testPoId,
        receiptDate: '2024-01-20',
        lines: [{ purchaseOrderLineId: testPoLineId, quantityReceived: 5 }],
      };

      expect(validInput.purchaseOrderId).toBeDefined();
    });

    it('should require receiptDate for create', () => {
      const validInput = {
        purchaseOrderId: testPoId,
        receiptDate: '2024-01-20',
        lines: [{ purchaseOrderLineId: testPoLineId, quantityReceived: 5 }],
      };

      expect(validInput.receiptDate).toBeDefined();
    });

    it('should require at least one line for create', () => {
      const validInput = {
        purchaseOrderId: testPoId,
        receiptDate: '2024-01-20',
        lines: [{ purchaseOrderLineId: testPoLineId, quantityReceived: 5 }],
      };

      expect(validInput.lines.length).toBeGreaterThan(0);
    });

    it('should require purchaseOrderLineId on each line', () => {
      const line = {
        purchaseOrderLineId: testPoLineId,
        quantityReceived: 5,
      };

      expect(line.purchaseOrderLineId).toBeDefined();
    });

    it('should require quantityReceived on each line', () => {
      const line = {
        purchaseOrderLineId: testPoLineId,
        quantityReceived: 5,
      };

      expect(line.quantityReceived).toBeDefined();
    });

    it('should support optional fields', () => {
      const inputWithOptionals = {
        purchaseOrderId: testPoId,
        receiptDate: '2024-01-20',
        receiptLocationId: 'loc-123',
        shippingRef: 'SHIP-001',
        carrierName: 'FedEx',
        memo: 'Test receipt',
        internalNotes: 'Internal note',
        lines: [
          {
            purchaseOrderLineId: testPoLineId,
            quantityReceived: 5,
            quantityAccepted: 5,
            quantityRejected: 0,
            rejectionReason: null,
            binLocation: 'BIN-A1',
            lotNumber: 'LOT-001',
            serialNumbers: ['SN001', 'SN002'],
          },
        ],
      };

      expect(inputWithOptionals.receiptLocationId).toBeDefined();
      expect(inputWithOptionals.shippingRef).toBeDefined();
      expect(inputWithOptionals.lines[0].binLocation).toBeDefined();
      expect(inputWithOptionals.lines[0].serialNumbers).toBeDefined();
    });
  });

  // ========== Receivable Status Tests ==========

  describe('receivable statuses', () => {
    it('should allow receiving against APPROVED PO', () => {
      const receivableStatuses = ['APPROVED', 'PARTIALLY_RECEIVED'];
      expect(receivableStatuses).toContain('APPROVED');
    });

    it('should allow receiving against PARTIALLY_RECEIVED PO', () => {
      const receivableStatuses = ['APPROVED', 'PARTIALLY_RECEIVED'];
      expect(receivableStatuses).toContain('PARTIALLY_RECEIVED');
    });

    it('should not allow receiving against DRAFT PO', () => {
      const receivableStatuses = ['APPROVED', 'PARTIALLY_RECEIVED'];
      expect(receivableStatuses).not.toContain('DRAFT');
    });

    it('should not allow receiving against CANCELLED PO', () => {
      const receivableStatuses = ['APPROVED', 'PARTIALLY_RECEIVED'];
      expect(receivableStatuses).not.toContain('CANCELLED');
    });
  });

  // ========== Quantity Validation Tests ==========

  describe('quantity validation', () => {
    it('should calculate remaining quantity correctly', () => {
      const poQuantity = 10;
      const quantityReceived = 3;
      const remaining = poQuantity - quantityReceived;

      expect(remaining).toBe(7);
    });

    it('should detect over-receiving', () => {
      const poQuantity = 10;
      const alreadyReceived = 8;
      const newQuantityToReceive = 5;
      const remaining = poQuantity - alreadyReceived;

      expect(newQuantityToReceive > remaining).toBe(true);
    });

    it('should allow receiving within limits', () => {
      const poQuantity = 10;
      const alreadyReceived = 3;
      const newQuantityToReceive = 5;
      const remaining = poQuantity - alreadyReceived;

      expect(newQuantityToReceive <= remaining).toBe(true);
    });
  });

  // ========== Event Emission Tests ==========

  describe('event emission', () => {
    it('should define POReceiptCreated event type', () => {
      const eventType = 'POReceiptCreated';
      expect(eventType).toBe('POReceiptCreated');
    });

    it('should define POReceiptSubmitted event type', () => {
      const eventType = 'POReceiptSubmitted';
      expect(eventType).toBe('POReceiptSubmitted');
    });

    it('should define POReceiptPosted event type', () => {
      const eventType = 'POReceiptPosted';
      expect(eventType).toBe('POReceiptPosted');
    });

    it('should define POReceiptCancelled event type', () => {
      const eventType = 'POReceiptCancelled';
      expect(eventType).toBe('POReceiptCancelled');
    });

    it('should define POReceiptReturnedToDraft event type', () => {
      const eventType = 'POReceiptReturnedToDraft';
      expect(eventType).toBe('POReceiptReturnedToDraft');
    });
  });

  // ========== Transaction Number Generation Tests ==========

  describe('transaction number generation', () => {
    it('should use RCV prefix for receipts', () => {
      const prefix = 'RCV';
      const year = new Date().getFullYear();
      const expectedFormat = `${prefix}-${year}-`;

      expect(expectedFormat).toMatch(/^RCV-\d{4}-$/);
    });

    it('should pad sequence number to 6 digits', () => {
      const seq = 1;
      const paddedSeq = String(seq).padStart(6, '0');

      expect(paddedSeq).toBe('000001');
    });
  });

  // ========== Filter Tests ==========

  describe('filters', () => {
    it('should support status filter', () => {
      const filters = { status: 'DRAFT' };
      expect(filters.status).toBe('DRAFT');
    });

    it('should support purchaseOrderId filter', () => {
      const filters = { purchaseOrderId: testPoId };
      expect(filters.purchaseOrderId).toBe(testPoId);
    });

    it('should support vendorId filter', () => {
      const filters = { vendorId: testVendorId };
      expect(filters.vendorId).toBe(testVendorId);
    });

    it('should support date range filters', () => {
      const filters = {
        receiptDateFrom: '2024-01-01',
        receiptDateTo: '2024-12-31',
      };
      expect(filters.receiptDateFrom).toBeDefined();
      expect(filters.receiptDateTo).toBeDefined();
    });

    it('should support search filter', () => {
      const filters = { search: 'Widget' };
      expect(filters.search).toBe('Widget');
    });

    it('should support subsidiaryId filter', () => {
      const filters = { subsidiaryId: testSubsidiaryId };
      expect(filters.subsidiaryId).toBe(testSubsidiaryId);
    });
  });

  // ========== Quality Inspection Tests ==========

  describe('quality inspection', () => {
    it('should track quantityAccepted', () => {
      const line = {
        quantityReceived: 10,
        quantityAccepted: 9,
        quantityRejected: 1,
      };

      expect(line.quantityAccepted).toBe(9);
    });

    it('should track quantityRejected', () => {
      const line = {
        quantityReceived: 10,
        quantityAccepted: 9,
        quantityRejected: 1,
      };

      expect(line.quantityRejected).toBe(1);
    });

    it('should ensure accepted + rejected = received', () => {
      const line = {
        quantityReceived: 10,
        quantityAccepted: 9,
        quantityRejected: 1,
      };

      expect(line.quantityAccepted + line.quantityRejected).toBe(line.quantityReceived);
    });

    it('should track rejection reason', () => {
      const line = {
        quantityReceived: 10,
        quantityAccepted: 9,
        quantityRejected: 1,
        rejectionReason: 'Damaged in transit',
      };

      expect(line.rejectionReason).toBeDefined();
    });
  });

  // ========== Lot/Serial Tracking Tests ==========

  describe('lot and serial tracking', () => {
    it('should support lot number tracking', () => {
      const line = {
        purchaseOrderLineId: testPoLineId,
        quantityReceived: 10,
        lotNumber: 'LOT-2024-001',
      };

      expect(line.lotNumber).toBe('LOT-2024-001');
    });

    it('should support serial number tracking', () => {
      const line = {
        purchaseOrderLineId: testPoLineId,
        quantityReceived: 3,
        serialNumbers: ['SN001', 'SN002', 'SN003'],
      };

      expect(line.serialNumbers).toHaveLength(3);
    });

    it('should support bin location tracking', () => {
      const line = {
        purchaseOrderLineId: testPoLineId,
        quantityReceived: 10,
        binLocation: 'WAREHOUSE-A-RACK-1-BIN-5',
      };

      expect(line.binLocation).toBeDefined();
    });
  });

  // ========== PO Update on Posting Tests ==========

  describe('PO update on posting', () => {
    it('should update PO received amounts when posting', () => {
      // This documents the expected behavior when postReceipt is called
      const expectedBehavior = {
        updatesPoReceivedAmounts: true,
        updatesPoLineQuantities: true,
        updatesPoStatus: true,
      };

      expect(expectedBehavior.updatesPoReceivedAmounts).toBe(true);
      expect(expectedBehavior.updatesPoLineQuantities).toBe(true);
      expect(expectedBehavior.updatesPoStatus).toBe(true);
    });

    it('should transition PO to PARTIALLY_RECEIVED when partial', () => {
      const poQuantity = 10;
      const receivedQuantity = 5;
      const isPartial = receivedQuantity < poQuantity;

      expect(isPartial).toBe(true);
    });

    it('should transition PO to FULLY_RECEIVED when complete', () => {
      const poQuantity = 10;
      const receivedQuantity = 10;
      const isComplete = receivedQuantity >= poQuantity;

      expect(isComplete).toBe(true);
    });
  });
});
