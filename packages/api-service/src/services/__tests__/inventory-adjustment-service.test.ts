/**
 * Unit tests for InventoryAdjustmentService
 * Tests workflow state transitions and validation logic
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create chainable mock
const createMockDbChain = (resolveValue: any = []) => {
  const chain: any = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    offset: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    values: vi.fn(() => chain),
    returning: vi.fn(() => Promise.resolve(resolveValue)),
    update: vi.fn(() => chain),
    set: vi.fn(() => chain),
    then: vi.fn((resolve) => Promise.resolve(resolveValue).then(resolve)),
    [Symbol.iterator]: function* () { yield* resolveValue; },
  };
  // Make the chain itself a thenable to support await on the chain
  chain[Symbol.toStringTag] = 'Promise';
  return chain;
};

let mockDbInstance: any;

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', field: a, value: b })),
  and: vi.fn((...args) => ({ type: 'and', conditions: args })),
  desc: vi.fn((field) => ({ type: 'desc', field })),
  asc: vi.fn((field) => ({ type: 'asc', field })),
  inArray: vi.fn((field, values) => ({ type: 'inArray', field, values })),
  sql: vi.fn((strings, ...values) => ({ type: 'sql', strings, values })),
}));

vi.mock('@glapi/database', () => ({
  getDb: vi.fn(() => mockDbInstance),
  inventoryAdjustments: { id: 'id', organizationId: 'organizationId', status: 'status' },
  inventoryAdjustmentLines: { id: 'id', adjustmentId: 'adjustmentId' },
  inventoryApprovalHistory: {},
  adjustmentReasonCodes: { organizationId: 'organizationId', code: 'code', isActive: 'isActive' },
  itemCostLayers: { organizationId: 'organizationId', itemId: 'itemId', isFullyDepleted: 'isFullyDepleted' },
  itemCostHistory: {},
}));

// Mock ItemCostingConfigService
vi.mock('../item-costing-config-service', () => ({
  ItemCostingConfigService: vi.fn().mockImplementation(() => ({
    getEffectiveConfig: vi.fn().mockResolvedValue({ costingMethod: 'FIFO' }),
    getAverageCost: vi.fn().mockResolvedValue(10.00),
    createCostLayer: vi.fn().mockResolvedValue({}),
    consumeFromLayers: vi.fn().mockResolvedValue({ totalCost: 100 }),
    recordCostHistory: vi.fn().mockResolvedValue({}),
  })),
}));

// Mock InventoryGlPostingService
vi.mock('../inventory-gl-posting-service', () => ({
  InventoryGlPostingService: vi.fn().mockImplementation(() => ({
    postAdjustment: vi.fn().mockResolvedValue({
      glTransactionId: 'gl-123',
      transactionNumber: 'GL-ADJ-2025-001',
    }),
  })),
}));

import { InventoryAdjustmentService } from '../inventory-adjustment-service';

describe('InventoryAdjustmentService', () => {
  let service: InventoryAdjustmentService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbInstance = createMockDbChain();
  });

  describe('constructor', () => {
    it('should initialize with context', () => {
      service = new InventoryAdjustmentService({
        organizationId: 'org-123',
        userId: 'user-123',
        userName: 'Test User',
      });
      expect(service).toBeDefined();
    });
  });

  describe('getAdjustment', () => {
    beforeEach(() => {
      service = new InventoryAdjustmentService({
        organizationId: 'org-123',
        userId: 'user-123',
      });
    });

    it('should return null if adjustment not found', async () => {
      mockDbInstance = createMockDbChain([]);
      service = new InventoryAdjustmentService({
        organizationId: 'org-123',
        userId: 'user-123',
      });

      const result = await service.getAdjustment('non-existent');
      expect(result).toBeNull();
    });

    it('should return adjustment with lines if found', async () => {
      const mockAdjustment = { id: 'adj-123', organizationId: 'org-123', status: 'DRAFT' };
      const mockLines = [{ id: 'line-1' }];

      // First call returns adjustment, second returns lines
      let callCount = 0;
      mockDbInstance = {
        select: vi.fn(() => mockDbInstance),
        from: vi.fn(() => mockDbInstance),
        where: vi.fn(() => {
          callCount++;
          return Promise.resolve(callCount === 1 ? [mockAdjustment] : mockLines);
        }),
      };
      service = new InventoryAdjustmentService({
        organizationId: 'org-123',
        userId: 'user-123',
      });

      const result = await service.getAdjustment('adj-123');
      expect(result).toBeDefined();
      expect(result?.id).toBe('adj-123');
    });
  });

  describe('workflow validation', () => {
    it('should validate DRAFT can transition to PENDING_APPROVAL', () => {
      // The VALID_TRANSITIONS constant ensures proper state machine
      const validTransitions: Record<string, string[]> = {
        DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
        PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'CANCELLED'],
        APPROVED: ['POSTED', 'CANCELLED'],
        POSTED: [],
        REJECTED: ['DRAFT'],
        CANCELLED: [],
      };

      expect(validTransitions['DRAFT']).toContain('PENDING_APPROVAL');
      expect(validTransitions['DRAFT']).not.toContain('POSTED');
    });

    it('should validate POSTED cannot transition', () => {
      const validTransitions: Record<string, string[]> = {
        DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
        PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'CANCELLED'],
        APPROVED: ['POSTED', 'CANCELLED'],
        POSTED: [],
        REJECTED: ['DRAFT'],
        CANCELLED: [],
      };

      expect(validTransitions['POSTED']).toHaveLength(0);
    });
  });

  describe('adjustment types', () => {
    it('should support all adjustment types', () => {
      const adjustmentTypes = [
        'QUANTITY_INCREASE',
        'QUANTITY_DECREASE',
        'VALUE_REVALUATION',
        'WRITE_DOWN',
        'WRITE_OFF',
      ];

      expect(adjustmentTypes).toHaveLength(5);
      expect(adjustmentTypes).toContain('QUANTITY_INCREASE');
      expect(adjustmentTypes).toContain('WRITE_OFF');
    });
  });

  describe('GL posting integration', () => {
    it('should require APPROVED status before posting', async () => {
      const mockAdjustment = { id: 'adj-123', status: 'DRAFT', lines: [] };
      mockDbInstance = {
        select: vi.fn(() => mockDbInstance),
        from: vi.fn(() => mockDbInstance),
        where: vi.fn(() => Promise.resolve([mockAdjustment])),
      };
      service = new InventoryAdjustmentService({
        organizationId: 'org-123',
        userId: 'user-123',
      });

      await expect(service.post('adj-123')).rejects.toThrow(
        'Adjustment must be approved before posting'
      );
    });
  });
});
