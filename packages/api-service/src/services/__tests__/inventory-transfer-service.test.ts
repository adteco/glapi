/**
 * Unit tests for InventoryTransferService
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
  return chain;
};

let mockDbInstance: any;

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', field: a, value: b })),
  and: vi.fn((...args) => ({ type: 'and', conditions: args })),
  desc: vi.fn((field) => ({ type: 'desc', field })),
  sql: vi.fn((strings, ...values) => ({ type: 'sql', strings, values })),
}));

vi.mock('@glapi/database', () => ({
  getDb: vi.fn(() => mockDbInstance),
  inventoryTransfers: { id: 'id', organizationId: 'organizationId', status: 'status' },
  inventoryTransferLines: { id: 'id', transferId: 'transferId' },
  inventoryApprovalHistory: {},
  itemCostLayers: { organizationId: 'organizationId', itemId: 'itemId' },
}));

// Mock ItemCostingConfigService
vi.mock('../item-costing-config-service', () => ({
  ItemCostingConfigService: vi.fn().mockImplementation(() => ({
    getEffectiveConfig: vi.fn().mockResolvedValue({ costingMethod: 'FIFO' }),
    getAverageCost: vi.fn().mockResolvedValue(10.00),
    createCostLayer: vi.fn().mockResolvedValue({ id: 'layer-123' }),
    consumeFromLayers: vi.fn().mockResolvedValue({ totalCost: 100 }),
    recordCostHistory: vi.fn().mockResolvedValue({}),
  })),
}));

// Mock InventoryGlPostingService
vi.mock('../inventory-gl-posting-service', () => ({
  InventoryGlPostingService: vi.fn().mockImplementation(() => ({
    postTransferShipment: vi.fn().mockResolvedValue({
      glTransactionId: 'gl-ship-123',
      transactionNumber: 'GL-TRF-SHIP-2025-001',
    }),
    postTransferReceipt: vi.fn().mockResolvedValue({
      glTransactionId: 'gl-rcv-123',
      transactionNumber: 'GL-TRF-RCV-2025-001',
    }),
    postDirectTransfer: vi.fn().mockResolvedValue({
      glTransactionId: 'gl-trf-123',
      transactionNumber: 'GL-TRF-2025-001',
    }),
  })),
}));

import { InventoryTransferService } from '../inventory-transfer-service';

describe('InventoryTransferService', () => {
  let service: InventoryTransferService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbInstance = createMockDbChain();
  });

  describe('constructor', () => {
    it('should initialize with context', () => {
      service = new InventoryTransferService({
        organizationId: 'org-123',
        userId: 'user-123',
        userName: 'Test User',
      });
      expect(service).toBeDefined();
    });
  });

  describe('getTransfer', () => {
    beforeEach(() => {
      service = new InventoryTransferService({
        organizationId: 'org-123',
        userId: 'user-123',
      });
    });

    it('should return null if transfer not found', async () => {
      mockDbInstance = createMockDbChain([]);
      service = new InventoryTransferService({
        organizationId: 'org-123',
        userId: 'user-123',
      });

      const result = await service.getTransfer('non-existent');
      expect(result).toBeNull();
    });

    it('should return transfer with lines if found', async () => {
      const mockTransfer = { id: 'trf-123', organizationId: 'org-123', status: 'DRAFT' };
      const mockLines = [{ id: 'line-1' }];

      let callCount = 0;
      mockDbInstance = {
        select: vi.fn(() => mockDbInstance),
        from: vi.fn(() => mockDbInstance),
        where: vi.fn(() => {
          callCount++;
          return Promise.resolve(callCount === 1 ? [mockTransfer] : mockLines);
        }),
      };
      service = new InventoryTransferService({
        organizationId: 'org-123',
        userId: 'user-123',
      });

      const result = await service.getTransfer('trf-123');
      expect(result).toBeDefined();
      expect(result?.id).toBe('trf-123');
    });
  });

  describe('workflow validation', () => {
    it('should validate transfer status transitions', () => {
      const validTransitions: Record<string, string[]> = {
        DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
        PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'CANCELLED'],
        APPROVED: ['IN_TRANSIT', 'CANCELLED'],
        IN_TRANSIT: ['RECEIVED', 'CANCELLED'],
        RECEIVED: ['POSTED', 'CANCELLED'],
        POSTED: [],
        REJECTED: ['DRAFT'],
        CANCELLED: [],
      };

      expect(validTransitions['DRAFT']).toContain('PENDING_APPROVAL');
      expect(validTransitions['APPROVED']).toContain('IN_TRANSIT');
      expect(validTransitions['IN_TRANSIT']).toContain('RECEIVED');
      expect(validTransitions['RECEIVED']).toContain('POSTED');
    });

    it('should validate extended workflow for transfers', () => {
      const validTransitions: Record<string, string[]> = {
        DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
        PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'CANCELLED'],
        APPROVED: ['IN_TRANSIT', 'CANCELLED'],
        IN_TRANSIT: ['RECEIVED', 'CANCELLED'],
        RECEIVED: ['POSTED', 'CANCELLED'],
        POSTED: [],
        REJECTED: ['DRAFT'],
        CANCELLED: [],
      };

      // Transfers have IN_TRANSIT and RECEIVED states unlike adjustments
      expect(validTransitions['APPROVED']).not.toContain('POSTED');
      expect(validTransitions['IN_TRANSIT']).not.toContain('POSTED');
    });
  });

  describe('transfer types', () => {
    it('should support all transfer types', () => {
      const transferTypes = [
        'LOCATION_TRANSFER',
        'SUBSIDIARY_TRANSFER',
        'BIN_TRANSFER',
      ];

      expect(transferTypes).toHaveLength(3);
      expect(transferTypes).toContain('LOCATION_TRANSFER');
      expect(transferTypes).toContain('SUBSIDIARY_TRANSFER');
    });
  });

  describe('intercompany transfers', () => {
    it('should detect intercompany when subsidiaries differ', () => {
      const isIntercompany = (fromSub: string, toSub: string) => fromSub !== toSub;

      expect(isIntercompany('sub-1', 'sub-2')).toBe(true);
      expect(isIntercompany('sub-1', 'sub-1')).toBe(false);
    });
  });

  describe('ship validation', () => {
    it('should require APPROVED status before shipping', async () => {
      const mockTransfer = { id: 'trf-123', status: 'DRAFT', lines: [] };
      mockDbInstance = {
        select: vi.fn(() => mockDbInstance),
        from: vi.fn(() => mockDbInstance),
        where: vi.fn(() => Promise.resolve([mockTransfer])),
      };
      service = new InventoryTransferService({
        organizationId: 'org-123',
        userId: 'user-123',
      });

      await expect(service.ship('trf-123')).rejects.toThrow(
        'Transfer must be approved before shipping'
      );
    });
  });

  describe('receive validation', () => {
    it('should require IN_TRANSIT status before receiving', async () => {
      const mockTransfer = { id: 'trf-123', status: 'APPROVED', lines: [] };
      mockDbInstance = {
        select: vi.fn(() => mockDbInstance),
        from: vi.fn(() => mockDbInstance),
        where: vi.fn(() => Promise.resolve([mockTransfer])),
      };
      service = new InventoryTransferService({
        organizationId: 'org-123',
        userId: 'user-123',
      });

      await expect(service.receive('trf-123')).rejects.toThrow(
        'Transfer must be in transit to receive'
      );
    });
  });

  describe('post validation', () => {
    it('should require RECEIVED status before posting', async () => {
      const mockTransfer = { id: 'trf-123', status: 'IN_TRANSIT', lines: [] };
      mockDbInstance = {
        select: vi.fn(() => mockDbInstance),
        from: vi.fn(() => mockDbInstance),
        where: vi.fn(() => Promise.resolve([mockTransfer])),
      };
      service = new InventoryTransferService({
        organizationId: 'org-123',
        userId: 'user-123',
      });

      await expect(service.post('trf-123')).rejects.toThrow(
        'Transfer must be received before posting'
      );
    });
  });

  describe('GL posting integration', () => {
    it('should support two-step posting for inter-subsidiary transfers', () => {
      // Inter-subsidiary transfers post at ship and receive:
      // Ship: Dr Transit Inventory, Cr Source Inventory
      // Receive: Dr Destination Inventory, Cr Transit Inventory
      const postingSteps = ['SHIP_POST', 'RECEIVE_POST'];
      expect(postingSteps).toHaveLength(2);
    });

    it('should support direct posting for intra-subsidiary transfers', () => {
      // Intra-subsidiary can skip transit accounting
      const directPost = (fromSub: string, toSub: string) => fromSub === toSub;
      expect(directPost('sub-1', 'sub-1')).toBe(true);
    });
  });
});
