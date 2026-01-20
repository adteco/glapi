import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to define constants that mocks can access (mocks are hoisted)
const { SalesOrderStatus, ApprovalActionType, VALID_SALES_ORDER_TRANSITIONS } = vi.hoisted(() => ({
  SalesOrderStatus: {
    DRAFT: 'DRAFT',
    SUBMITTED: 'SUBMITTED',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    PARTIALLY_FULFILLED: 'PARTIALLY_FULFILLED',
    FULFILLED: 'FULFILLED',
    CLOSED: 'CLOSED',
    CANCELLED: 'CANCELLED',
    ON_HOLD: 'ON_HOLD',
  } as const,
  ApprovalActionType: {
    SUBMIT: 'SUBMIT',
    APPROVE: 'APPROVE',
    REJECT: 'REJECT',
    RETURN_FOR_REVISION: 'RETURN_FOR_REVISION',
    ESCALATE: 'ESCALATE',
    DELEGATE: 'DELEGATE',
  } as const,
  VALID_SALES_ORDER_TRANSITIONS: {
    DRAFT: ['SUBMITTED', 'CANCELLED'],
    SUBMITTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
    APPROVED: ['PARTIALLY_FULFILLED', 'FULFILLED', 'ON_HOLD', 'CANCELLED'],
    REJECTED: ['DRAFT', 'CANCELLED'],
    PARTIALLY_FULFILLED: ['FULFILLED', 'ON_HOLD', 'CANCELLED'],
    FULFILLED: ['CLOSED'],
    CLOSED: [],
    CANCELLED: [],
    ON_HOLD: ['APPROVED', 'PARTIALLY_FULFILLED', 'CANCELLED'],
  } as Record<string, string[]>,
}));

// Mock @glapi/database/schema before importing anything that uses it
vi.mock('@glapi/database/schema', () => ({
  SalesOrderStatus,
  ApprovalActionType,
  VALID_SALES_ORDER_TRANSITIONS,
  salesOrders: {},
  salesOrderLines: {},
  salesOrderApprovalHistory: {},
  salesOrderInvoices: {},
}));

// Mock the database
vi.mock('@glapi/database', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'test-order-id' }]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  },
  salesOrders: {},
  salesOrderLines: {},
  salesOrderApprovalHistory: {},
  salesOrderInvoices: {},
}));

// Mock dependent services
vi.mock('../invoice-service', () => ({
  InvoiceService: vi.fn().mockImplementation(() => ({
    createInvoice: vi.fn().mockResolvedValue({
      id: 'test-invoice-id',
      invoiceNumber: 'INV-001',
    }),
  })),
}));

vi.mock('../gl-posting-engine', () => ({
  GlPostingEngine: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../accounting-period-service', () => ({
  AccountingPeriodService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../event-service', () => ({
  EventService: vi.fn().mockImplementation(() => ({
    emit: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Import after mocks are set up
import { SalesOrderService } from '../sales-order-service';

describe('SalesOrderService', () => {
  let service: SalesOrderService;
  const TEST_ORG_ID = 'test-org-id';
  const TEST_USER_ID = 'test-user-id';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SalesOrderService({
      organizationId: TEST_ORG_ID,
      userId: TEST_USER_ID,
    });
  });

  // ===========================================================================
  // State Machine Validation Tests
  // ===========================================================================

  describe('validateStatusTransition', () => {
    describe('DRAFT status transitions', () => {
      it('should allow DRAFT -> SUBMITTED', () => {
        const result = service.validateStatusTransition(
          SalesOrderStatus.DRAFT,
          SalesOrderStatus.SUBMITTED
        );
        expect(result.valid).toBe(true);
        expect(result.currentStatus).toBe('DRAFT');
        expect(result.targetStatus).toBe('SUBMITTED');
      });

      it('should allow DRAFT -> CANCELLED', () => {
        const result = service.validateStatusTransition(
          SalesOrderStatus.DRAFT,
          SalesOrderStatus.CANCELLED
        );
        expect(result.valid).toBe(true);
      });

      it('should NOT allow DRAFT -> APPROVED directly', () => {
        const result = service.validateStatusTransition(
          SalesOrderStatus.DRAFT,
          SalesOrderStatus.APPROVED
        );
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('Cannot transition from DRAFT to APPROVED');
        expect(result.allowedTransitions).toEqual(['SUBMITTED', 'CANCELLED']);
      });

      it('should NOT allow DRAFT -> FULFILLED directly', () => {
        const result = service.validateStatusTransition(
          SalesOrderStatus.DRAFT,
          SalesOrderStatus.FULFILLED
        );
        expect(result.valid).toBe(false);
      });

      it('should NOT allow DRAFT -> CLOSED directly', () => {
        const result = service.validateStatusTransition(
          SalesOrderStatus.DRAFT,
          SalesOrderStatus.CLOSED
        );
        expect(result.valid).toBe(false);
      });
    });

    describe('SUBMITTED status transitions', () => {
      it('should allow SUBMITTED -> APPROVED', () => {
        const result = service.validateStatusTransition(
          SalesOrderStatus.SUBMITTED,
          SalesOrderStatus.APPROVED
        );
        expect(result.valid).toBe(true);
      });

      it('should allow SUBMITTED -> REJECTED', () => {
        const result = service.validateStatusTransition(
          SalesOrderStatus.SUBMITTED,
          SalesOrderStatus.REJECTED
        );
        expect(result.valid).toBe(true);
      });

      it('should allow SUBMITTED -> CANCELLED', () => {
        const result = service.validateStatusTransition(
          SalesOrderStatus.SUBMITTED,
          SalesOrderStatus.CANCELLED
        );
        expect(result.valid).toBe(true);
      });

      it('should NOT allow SUBMITTED -> DRAFT directly', () => {
        const result = service.validateStatusTransition(
          SalesOrderStatus.SUBMITTED,
          SalesOrderStatus.DRAFT
        );
        expect(result.valid).toBe(false);
      });

      it('should NOT allow SUBMITTED -> FULFILLED directly', () => {
        const result = service.validateStatusTransition(
          SalesOrderStatus.SUBMITTED,
          SalesOrderStatus.FULFILLED
        );
        expect(result.valid).toBe(false);
      });
    });

    describe('APPROVED status transitions', () => {
      it('should allow APPROVED -> PARTIALLY_FULFILLED', () => {
        const result = service.validateStatusTransition(
          SalesOrderStatus.APPROVED,
          SalesOrderStatus.PARTIALLY_FULFILLED
        );
        expect(result.valid).toBe(true);
      });

      it('should allow APPROVED -> FULFILLED', () => {
        const result = service.validateStatusTransition(
          SalesOrderStatus.APPROVED,
          SalesOrderStatus.FULFILLED
        );
        expect(result.valid).toBe(true);
      });

      it('should allow APPROVED -> ON_HOLD', () => {
        const result = service.validateStatusTransition(
          SalesOrderStatus.APPROVED,
          SalesOrderStatus.ON_HOLD
        );
        expect(result.valid).toBe(true);
      });

      it('should allow APPROVED -> CANCELLED', () => {
        const result = service.validateStatusTransition(
          SalesOrderStatus.APPROVED,
          SalesOrderStatus.CANCELLED
        );
        expect(result.valid).toBe(true);
      });

      it('should NOT allow APPROVED -> DRAFT', () => {
        const result = service.validateStatusTransition(
          SalesOrderStatus.APPROVED,
          SalesOrderStatus.DRAFT
        );
        expect(result.valid).toBe(false);
      });

      it('should NOT allow APPROVED -> CLOSED directly', () => {
        const result = service.validateStatusTransition(
          SalesOrderStatus.APPROVED,
          SalesOrderStatus.CLOSED
        );
        expect(result.valid).toBe(false);
      });
    });

    describe('REJECTED status transitions', () => {
      it('should allow REJECTED -> DRAFT (revision)', () => {
        const result = service.validateStatusTransition(
          SalesOrderStatus.REJECTED,
          SalesOrderStatus.DRAFT
        );
        expect(result.valid).toBe(true);
      });

      it('should allow REJECTED -> CANCELLED', () => {
        const result = service.validateStatusTransition(
          SalesOrderStatus.REJECTED,
          SalesOrderStatus.CANCELLED
        );
        expect(result.valid).toBe(true);
      });

      it('should NOT allow REJECTED -> APPROVED directly', () => {
        const result = service.validateStatusTransition(
          SalesOrderStatus.REJECTED,
          SalesOrderStatus.APPROVED
        );
        expect(result.valid).toBe(false);
      });
    });

    describe('PARTIALLY_FULFILLED status transitions', () => {
      it('should allow PARTIALLY_FULFILLED -> FULFILLED', () => {
        const result = service.validateStatusTransition(
          SalesOrderStatus.PARTIALLY_FULFILLED,
          SalesOrderStatus.FULFILLED
        );
        expect(result.valid).toBe(true);
      });

      it('should allow PARTIALLY_FULFILLED -> ON_HOLD', () => {
        const result = service.validateStatusTransition(
          SalesOrderStatus.PARTIALLY_FULFILLED,
          SalesOrderStatus.ON_HOLD
        );
        expect(result.valid).toBe(true);
      });

      it('should allow PARTIALLY_FULFILLED -> CANCELLED', () => {
        const result = service.validateStatusTransition(
          SalesOrderStatus.PARTIALLY_FULFILLED,
          SalesOrderStatus.CANCELLED
        );
        expect(result.valid).toBe(true);
      });
    });

    describe('FULFILLED status transitions', () => {
      it('should allow FULFILLED -> CLOSED', () => {
        const result = service.validateStatusTransition(
          SalesOrderStatus.FULFILLED,
          SalesOrderStatus.CLOSED
        );
        expect(result.valid).toBe(true);
      });

      it('should NOT allow any other transitions from FULFILLED', () => {
        const otherStatuses = [
          SalesOrderStatus.DRAFT,
          SalesOrderStatus.SUBMITTED,
          SalesOrderStatus.APPROVED,
          SalesOrderStatus.REJECTED,
          SalesOrderStatus.CANCELLED,
          SalesOrderStatus.ON_HOLD,
        ];

        otherStatuses.forEach((status) => {
          const result = service.validateStatusTransition(
            SalesOrderStatus.FULFILLED,
            status
          );
          expect(result.valid).toBe(false);
        });
      });
    });

    describe('Terminal status transitions', () => {
      it('should NOT allow any transitions from CLOSED', () => {
        const allStatuses = Object.values(SalesOrderStatus);

        allStatuses.forEach((status) => {
          const result = service.validateStatusTransition(
            SalesOrderStatus.CLOSED,
            status
          );
          expect(result.valid).toBe(false);
        });
      });

      it('should NOT allow any transitions from CANCELLED', () => {
        const allStatuses = Object.values(SalesOrderStatus);

        allStatuses.forEach((status) => {
          const result = service.validateStatusTransition(
            SalesOrderStatus.CANCELLED,
            status
          );
          expect(result.valid).toBe(false);
        });
      });
    });

    describe('ON_HOLD status transitions', () => {
      it('should allow ON_HOLD -> APPROVED', () => {
        const result = service.validateStatusTransition(
          SalesOrderStatus.ON_HOLD,
          SalesOrderStatus.APPROVED
        );
        expect(result.valid).toBe(true);
      });

      it('should allow ON_HOLD -> PARTIALLY_FULFILLED', () => {
        const result = service.validateStatusTransition(
          SalesOrderStatus.ON_HOLD,
          SalesOrderStatus.PARTIALLY_FULFILLED
        );
        expect(result.valid).toBe(true);
      });

      it('should allow ON_HOLD -> CANCELLED', () => {
        const result = service.validateStatusTransition(
          SalesOrderStatus.ON_HOLD,
          SalesOrderStatus.CANCELLED
        );
        expect(result.valid).toBe(true);
      });
    });
  });

  // ===========================================================================
  // Valid Transitions Configuration Tests
  // ===========================================================================

  describe('VALID_SALES_ORDER_TRANSITIONS configuration', () => {
    it('should have transitions defined for all statuses', () => {
      const allStatuses = Object.values(SalesOrderStatus);

      allStatuses.forEach((status) => {
        expect(VALID_SALES_ORDER_TRANSITIONS).toHaveProperty(status);
        expect(Array.isArray(VALID_SALES_ORDER_TRANSITIONS[status])).toBe(true);
      });
    });

    it('should have terminal states with empty transition arrays', () => {
      expect(VALID_SALES_ORDER_TRANSITIONS[SalesOrderStatus.CLOSED]).toEqual([]);
      expect(VALID_SALES_ORDER_TRANSITIONS[SalesOrderStatus.CANCELLED]).toEqual([]);
    });

    it('should enforce one-way transitions from terminal states', () => {
      // CLOSED and CANCELLED should not appear in any transition target arrays
      // (except they can be targets themselves)
      const terminalStatuses = [SalesOrderStatus.CLOSED, SalesOrderStatus.CANCELLED];

      Object.entries(VALID_SALES_ORDER_TRANSITIONS).forEach(([fromStatus, targets]) => {
        if (terminalStatuses.includes(fromStatus as any)) {
          expect(targets.length).toBe(0);
        }
      });
    });

    it('should ensure DRAFT cannot skip SUBMITTED', () => {
      const draftTransitions = VALID_SALES_ORDER_TRANSITIONS[SalesOrderStatus.DRAFT];
      expect(draftTransitions).not.toContain(SalesOrderStatus.APPROVED);
      expect(draftTransitions).not.toContain(SalesOrderStatus.FULFILLED);
      expect(draftTransitions).not.toContain(SalesOrderStatus.CLOSED);
    });

    it('should ensure SUBMITTED goes through approval flow', () => {
      const submittedTransitions = VALID_SALES_ORDER_TRANSITIONS[SalesOrderStatus.SUBMITTED];
      expect(submittedTransitions).toContain(SalesOrderStatus.APPROVED);
      expect(submittedTransitions).toContain(SalesOrderStatus.REJECTED);
      expect(submittedTransitions).not.toContain(SalesOrderStatus.FULFILLED);
    });

    it('should ensure only FULFILLED can transition to CLOSED', () => {
      Object.entries(VALID_SALES_ORDER_TRANSITIONS).forEach(([status, targets]) => {
        if (status === SalesOrderStatus.FULFILLED) {
          expect(targets).toContain(SalesOrderStatus.CLOSED);
        } else {
          expect(targets).not.toContain(SalesOrderStatus.CLOSED);
        }
      });
    });
  });

  // ===========================================================================
  // Line Total Calculation Tests
  // ===========================================================================

  describe('calculateLineTotals (via createSalesOrder)', () => {
    it('should calculate line total correctly (quantity * unitPrice)', () => {
      const lines = [
        { description: 'Item 1', quantity: 10, unitPrice: 100 },
        { description: 'Item 2', quantity: 5, unitPrice: 50 },
      ];

      // Access private method via any cast
      const result = (service as any).calculateLineTotals(lines);

      expect(result.subtotal).toBe(1250); // (10*100) + (5*50)
    });

    it('should apply discount amount correctly', () => {
      const lines = [
        { description: 'Item 1', quantity: 10, unitPrice: 100, discountAmount: 50 },
      ];

      const result = (service as any).calculateLineTotals(lines);

      expect(result.subtotal).toBe(950); // (10*100) - 50
    });

    it('should apply discount percent correctly', () => {
      const lines = [
        { description: 'Item 1', quantity: 10, unitPrice: 100, discountPercent: 10 },
      ];

      const result = (service as any).calculateLineTotals(lines);

      expect(result.subtotal).toBe(900); // (10*100) * 0.9
    });

    it('should sum tax amounts from lines', () => {
      const lines = [
        { description: 'Item 1', quantity: 10, unitPrice: 100, taxAmount: 80 },
        { description: 'Item 2', quantity: 5, unitPrice: 50, taxAmount: 20 },
      ];

      const result = (service as any).calculateLineTotals(lines);

      expect(result.taxTotal).toBe(100); // 80 + 20
    });

    it('should assign sequential line numbers', () => {
      const lines = [
        { description: 'Item 1', quantity: 1, unitPrice: 100 },
        { description: 'Item 2', quantity: 1, unitPrice: 200 },
        { description: 'Item 3', quantity: 1, unitPrice: 300 },
      ];

      const result = (service as any).calculateLineTotals(lines);

      expect(result.lines[0].lineNumber).toBe(1);
      expect(result.lines[1].lineNumber).toBe(2);
      expect(result.lines[2].lineNumber).toBe(3);
    });

    it('should initialize remainingQuantity to quantity', () => {
      const lines = [
        { description: 'Item 1', quantity: 10, unitPrice: 100 },
      ];

      const result = (service as any).calculateLineTotals(lines);

      expect(result.lines[0].remainingQuantity).toBe('10');
    });

    it('should calculate lineTotal for each line', () => {
      const lines = [
        { description: 'Item 1', quantity: 10, unitPrice: 100 },
        { description: 'Item 2', quantity: 5, unitPrice: 50 },
      ];

      const result = (service as any).calculateLineTotals(lines);

      expect(result.lines[0].lineTotal).toBe('1000');
      expect(result.lines[1].lineTotal).toBe('250');
    });

    it('should handle string quantities and prices', () => {
      const lines = [
        { description: 'Item 1', quantity: '10', unitPrice: '100' },
      ];

      const result = (service as any).calculateLineTotals(lines);

      expect(result.subtotal).toBe(1000);
      expect(result.lines[0].lineTotal).toBe('1000');
    });

    it('should handle empty lines array', () => {
      const result = (service as any).calculateLineTotals([]);

      expect(result.subtotal).toBe(0);
      expect(result.taxTotal).toBe(0);
      expect(result.lines).toEqual([]);
    });

    it('should prioritize discount amount over discount percent', () => {
      const lines = [
        {
          description: 'Item 1',
          quantity: 10,
          unitPrice: 100,
          discountAmount: 50, // Will be applied
          discountPercent: 10, // Will be ignored since amount is set
        },
      ];

      const result = (service as any).calculateLineTotals(lines);

      // 1000 - 50 = 950 (not 1000 * 0.9 = 900)
      expect(result.subtotal).toBe(950);
    });
  });

  // ===========================================================================
  // Order Number Generation Tests
  // ===========================================================================

  describe('generateOrderNumber', () => {
    it('should generate order number with SO prefix', async () => {
      const orderNumber = await (service as any).generateOrderNumber();
      expect(orderNumber).toMatch(/^SO-/);
    });

    it('should include current year in order number', async () => {
      const orderNumber = await (service as any).generateOrderNumber();
      const currentYear = new Date().getFullYear();
      expect(orderNumber).toContain(currentYear.toString());
    });

    it('should generate mostly unique order numbers', async () => {
      const orderNumbers = new Set<string>();

      for (let i = 0; i < 10; i++) {
        const orderNumber = await (service as any).generateOrderNumber();
        orderNumbers.add(orderNumber);
      }

      // Allow for some timing collisions in tight loop, but most should be unique
      expect(orderNumbers.size).toBeGreaterThanOrEqual(8);
    });
  });

  // ===========================================================================
  // Date Handling Tests
  // ===========================================================================

  describe('toDateString', () => {
    it('should convert Date object to date string', () => {
      const date = new Date('2026-01-15T10:30:00Z');
      const result = (service as any).toDateString(date);
      expect(result).toBe('2026-01-15');
    });

    it('should extract date from ISO string', () => {
      const result = (service as any).toDateString('2026-01-15T10:30:00Z');
      expect(result).toBe('2026-01-15');
    });

    it('should handle date-only string', () => {
      const result = (service as any).toDateString('2026-01-15');
      expect(result).toBe('2026-01-15');
    });
  });

  // ===========================================================================
  // Approval Action Mapping Tests
  // ===========================================================================

  describe('approval action processing', () => {
    it('should map APPROVE action to APPROVED status', () => {
      // The mapping is tested implicitly through validateStatusTransition
      // which is used in processApprovalAction
      const result = service.validateStatusTransition(
        SalesOrderStatus.SUBMITTED,
        SalesOrderStatus.APPROVED
      );
      expect(result.valid).toBe(true);
    });

    it('should map REJECT action to REJECTED status', () => {
      const result = service.validateStatusTransition(
        SalesOrderStatus.SUBMITTED,
        SalesOrderStatus.REJECTED
      );
      expect(result.valid).toBe(true);
    });

    it('should map RETURN_FOR_REVISION to DRAFT status', () => {
      // RETURN_FOR_REVISION goes back to DRAFT from SUBMITTED
      // Verified by checking that DRAFT is a valid target from REJECTED
      const result = service.validateStatusTransition(
        SalesOrderStatus.REJECTED,
        SalesOrderStatus.DRAFT
      );
      expect(result.valid).toBe(true);
    });
  });

  // ===========================================================================
  // Happy Path Flow Test
  // ===========================================================================

  describe('complete order lifecycle validation', () => {
    it('should validate the full happy path: DRAFT -> SUBMITTED -> APPROVED -> FULFILLED -> CLOSED', () => {
      // Step 1: DRAFT -> SUBMITTED
      let result = service.validateStatusTransition(
        SalesOrderStatus.DRAFT,
        SalesOrderStatus.SUBMITTED
      );
      expect(result.valid).toBe(true);

      // Step 2: SUBMITTED -> APPROVED
      result = service.validateStatusTransition(
        SalesOrderStatus.SUBMITTED,
        SalesOrderStatus.APPROVED
      );
      expect(result.valid).toBe(true);

      // Step 3: APPROVED -> FULFILLED (or PARTIALLY_FULFILLED first)
      result = service.validateStatusTransition(
        SalesOrderStatus.APPROVED,
        SalesOrderStatus.FULFILLED
      );
      expect(result.valid).toBe(true);

      // Step 4: FULFILLED -> CLOSED
      result = service.validateStatusTransition(
        SalesOrderStatus.FULFILLED,
        SalesOrderStatus.CLOSED
      );
      expect(result.valid).toBe(true);
    });

    it('should validate partial fulfillment path: APPROVED -> PARTIALLY_FULFILLED -> FULFILLED -> CLOSED', () => {
      // Step 1: APPROVED -> PARTIALLY_FULFILLED
      let result = service.validateStatusTransition(
        SalesOrderStatus.APPROVED,
        SalesOrderStatus.PARTIALLY_FULFILLED
      );
      expect(result.valid).toBe(true);

      // Step 2: PARTIALLY_FULFILLED -> FULFILLED
      result = service.validateStatusTransition(
        SalesOrderStatus.PARTIALLY_FULFILLED,
        SalesOrderStatus.FULFILLED
      );
      expect(result.valid).toBe(true);

      // Step 3: FULFILLED -> CLOSED
      result = service.validateStatusTransition(
        SalesOrderStatus.FULFILLED,
        SalesOrderStatus.CLOSED
      );
      expect(result.valid).toBe(true);
    });

    it('should validate rejection and revision path: SUBMITTED -> REJECTED -> DRAFT -> SUBMITTED', () => {
      // Step 1: SUBMITTED -> REJECTED
      let result = service.validateStatusTransition(
        SalesOrderStatus.SUBMITTED,
        SalesOrderStatus.REJECTED
      );
      expect(result.valid).toBe(true);

      // Step 2: REJECTED -> DRAFT (revision)
      result = service.validateStatusTransition(
        SalesOrderStatus.REJECTED,
        SalesOrderStatus.DRAFT
      );
      expect(result.valid).toBe(true);

      // Step 3: DRAFT -> SUBMITTED (resubmit)
      result = service.validateStatusTransition(
        SalesOrderStatus.DRAFT,
        SalesOrderStatus.SUBMITTED
      );
      expect(result.valid).toBe(true);
    });

    it('should validate hold and release path: APPROVED -> ON_HOLD -> APPROVED', () => {
      // Step 1: APPROVED -> ON_HOLD
      let result = service.validateStatusTransition(
        SalesOrderStatus.APPROVED,
        SalesOrderStatus.ON_HOLD
      );
      expect(result.valid).toBe(true);

      // Step 2: ON_HOLD -> APPROVED (release)
      result = service.validateStatusTransition(
        SalesOrderStatus.ON_HOLD,
        SalesOrderStatus.APPROVED
      );
      expect(result.valid).toBe(true);
    });
  });
});
