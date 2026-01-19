import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ModificationRequest } from '@glapi/business/services/contract-modification-engine';

// Mock @glapi/database BEFORE any imports that use it
vi.mock('@glapi/database', () => ({
  Database: vi.fn(),
  schema: {
    contractModifications: {},
    modificationLineItems: {},
    catchUpAdjustments: {},
    modificationApprovalHistory: {},
  },
}));

// Mock @glapi/database/schema
vi.mock('@glapi/database/schema', () => ({
  contractModifications: {},
  modificationLineItems: {},
  catchUpAdjustments: {},
  modificationApprovalHistory: {},
  ContractModification: {},
  ModificationLineItem: {},
  CatchUpAdjustment: {},
  ModificationStatus: {
    DRAFT: 'draft',
    PENDING_APPROVAL: 'pending_approval',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    APPLIED: 'applied',
    CANCELLED: 'cancelled',
  },
  ModificationType: {
    ADD_ITEMS: 'add_items',
    REMOVE_ITEMS: 'remove_items',
    PRICE_CHANGE: 'price_change',
    QUANTITY_CHANGE: 'quantity_change',
    EARLY_TERMINATION: 'early_termination',
    EXTENSION: 'extension',
    UPGRADE: 'upgrade',
    DOWNGRADE: 'downgrade',
  },
}));

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
  inArray: vi.fn(),
  sql: vi.fn(),
}));

// Mock the business layer services - using the main @glapi/business entry point
vi.mock('@glapi/business', () => ({
  ContractModificationEngine: vi.fn().mockImplementation(() => ({
    processModification: vi.fn(),
    applyModification: vi.fn(),
    processPartialTermination: vi.fn(),
    processUpgradeDowngrade: vi.fn(),
    processBlendAndExtend: vi.fn()
  })),
  ModificationApprovalWorkflow: vi.fn().mockImplementation(() => ({
    submitForApproval: vi.fn(),
    processApproval: vi.fn(),
    getApprovalStatus: vi.fn(),
    recallModification: vi.fn(),
    delegateApproval: vi.fn(),
    checkForEscalations: vi.fn()
  })),
}));

// Also mock the individual imports for type resolution
vi.mock('@glapi/business/services/contract-modification-engine', () => ({
  ContractModificationEngine: vi.fn(),
}));

vi.mock('@glapi/business/services/modification-approval-workflow', () => ({
  ModificationApprovalWorkflow: vi.fn(),
}));

// Import after mocking
import { ContractModificationService } from '../contract-modification-service';
import { Database } from '@glapi/database';

describe('ContractModificationService', () => {
  let service: ContractModificationService;
  let mockDb: any;

  // Helper to create a chainable mock that resolves to a value
  const createQueryChain = (resolveValue: any) => {
    const chain: any = {};
    const methods = ['select', 'from', 'where', 'limit', 'offset', 'orderBy', 'groupBy'];
    methods.forEach(method => {
      chain[method] = vi.fn(() => chain);
    });
    // Make the chain thenable so await works
    chain.then = (resolve: any) => Promise.resolve(resolveValue).then(resolve);
    return chain;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock database with methods that can be configured per test
    mockDb = {
      select: vi.fn(),
      from: vi.fn(),
      where: vi.fn(),
      limit: vi.fn(),
      offset: vi.fn(),
      orderBy: vi.fn(),
      groupBy: vi.fn(),
      insert: vi.fn(),
      values: vi.fn(),
      returning: vi.fn(),
      update: vi.fn(),
      set: vi.fn()
    };

    // Default chain behavior - each method returns mockDb for chaining
    Object.keys(mockDb).forEach(key => {
      mockDb[key].mockReturnValue(mockDb);
    });

    service = new ContractModificationService(mockDb as Database);
  });

  describe('createModification', () => {
    it('should create a new modification', async () => {
      const request: ModificationRequest = {
        subscriptionId: 'sub-123',
        modificationType: "add_items",
        effectiveDate: new Date('2024-06-01'),
        changes: {
          addItems: [
            {
              itemId: 'item-456',
              quantity: 5,
              unitPrice: 100
            }
          ]
        },
        requestedBy: 'user-123'
      };

      const mockImpact = {
        totalImpact: 500,
        monthlyImpact: 100,
        accountingMethod: 'prospective',
        obligations: []
      };

      // Mock engine response
      (service as any).modificationEngine.processModification.mockResolvedValue({
        modificationId: 'mod-001',
        impact: mockImpact
      });

      const result = await service.createModification(request);

      expect(result.modificationId).toBe('mod-001');
      expect(result.impact).toEqual(mockImpact);
      expect((service as any).modificationEngine.processModification).toHaveBeenCalledWith(
        request,
        { preview: undefined }
      );
    });

    it('should handle preview mode', async () => {
      const request: ModificationRequest = {
        subscriptionId: 'sub-123',
        modificationType: "price_change",
        effectiveDate: new Date('2024-06-01'),
        changes: {
          modifyItems: [
            {
              subscriptionItemId: 'item-123',
              newUnitPrice: 150
            }
          ]
        },
        requestedBy: 'user-123'
      };

      const mockImpact = {
        totalImpact: 150,
        monthlyImpact: 50,
        accountingMethod: 'cumulative_catch_up'
      };

      (service as any).modificationEngine.processModification.mockResolvedValue({
        impact: mockImpact,
        warnings: ['Price increase exceeds 10%']
      });

      const result = await service.createModification(request, { preview: true });

      expect(result.modificationId).toBeUndefined();
      expect(result.impact).toEqual(mockImpact);
      expect(result.warnings).toContain('Price increase exceeds 10%');
    });

    it('should auto-submit for approval if requested', async () => {
      const request: ModificationRequest = {
        subscriptionId: 'sub-123',
        modificationType: "add_items",
        effectiveDate: new Date('2024-06-01'),
        changes: {
          addItems: [{ itemId: 'item-456', quantity: 1, unitPrice: 100 }]
        },
        requestedBy: 'user-123'
      };

      (service as any).modificationEngine.processModification.mockResolvedValue({
        modificationId: 'mod-002',
        impact: { totalImpact: 100 }
      });

      const mockApprovalStatus = {
        status: 'pending',
        pendingApprovals: ['manager'],
        completedApprovals: []
      };

      (service as any).approvalWorkflow.submitForApproval.mockResolvedValue(mockApprovalStatus);

      const result = await service.createModification(request, { autoSubmit: true });

      expect(result.approvalStatus).toEqual(mockApprovalStatus);
      expect((service as any).approvalWorkflow.submitForApproval).toHaveBeenCalledWith(
        'mod-002',
        'user-123'
      );
    });
  });

  describe('getModification', () => {
    it('should retrieve modification details', async () => {
      const modificationId = 'mod-001';

      // Each query needs its own chain that resolves to the expected data
      let queryCount = 0;
      mockDb.select.mockImplementation(() => {
        queryCount++;
        if (queryCount === 1) {
          // First query: modification
          return createQueryChain([{
            id: modificationId,
            modificationNumber: 'MOD-001',
            subscriptionId: 'sub-123',
            modificationType: 'add_items',
            status: "pending_approval",
            effectiveDate: new Date('2024-06-01'),
            adjustmentAmount: '500',
            requestDate: new Date('2024-05-01'),
            revenueImpact: { totalImpact: 500 }
          }]);
        } else if (queryCount === 2) {
          // Second query: line items
          return createQueryChain([{
            id: 'line-001',
            modificationId,
            changeType: 'add',
            newItemId: 'item-456',
            newQuantity: '5',
            newUnitPrice: '100'
          }]);
        } else if (queryCount === 3) {
          // Third query: catch-up adjustments
          return createQueryChain([]);
        } else if (queryCount === 4) {
          // Fourth query: approval history
          return createQueryChain([{
            approvalLevel: 'submitted',
            approvalAction: 'submitted',
            approvalDate: new Date('2024-05-01')
          }]);
        }
        return createQueryChain([]);
      });

      // Mock approval status
      (service as any).approvalWorkflow.getApprovalStatus.mockResolvedValue({
        status: 'pending',
        pendingApprovals: ['manager'],
        completedApprovals: []
      });

      const result = await service.getModification(modificationId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(modificationId);
      expect(result?.lineItems).toHaveLength(1);
      expect(result?.approvalHistory).toHaveLength(1);
      expect(result?.approvalStatus).toBeDefined();
    });

    it('should return null for non-existent modification', async () => {
      mockDb.select.mockImplementation(() => createQueryChain([]));

      const result = await service.getModification('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('listModifications', () => {
    it('should list modifications with filters', async () => {
      const filters = {
        subscriptionId: 'sub-123',
        status: "approved",
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      let queryCount = 0;
      mockDb.select.mockImplementation(() => {
        queryCount++;
        if (queryCount === 1) {
          // Count query
          return createQueryChain([{ count: 2 }]);
        } else {
          // Data query
          return createQueryChain([
            {
              id: 'mod-001',
              modificationNumber: 'MOD-001',
              subscriptionId: 'sub-123',
              modificationType: 'add_items',
              status: "approved",
              effectiveDate: new Date('2024-03-01'),
              adjustmentAmount: '500',
              requestDate: new Date('2024-02-01')
            },
            {
              id: 'mod-002',
              modificationNumber: 'MOD-002',
              subscriptionId: 'sub-123',
              modificationType: 'price_change',
              status: "approved",
              effectiveDate: new Date('2024-06-01'),
              adjustmentAmount: '200',
              requestDate: new Date('2024-05-01')
            }
          ]);
        }
      });

      const result = await service.listModifications(filters, {
        limit: 10,
        offset: 0
      });

      expect(result.total).toBe(2);
      expect(result.modifications).toHaveLength(2);
      expect(result.modifications[0].subscriptionId).toBe('sub-123');
    });

    it('should handle pagination', async () => {
      const filters = {};

      let queryCount = 0;
      mockDb.select.mockImplementation(() => {
        queryCount++;
        if (queryCount === 1) {
          // Count query
          return createQueryChain([{ count: 50 }]);
        } else {
          // Data query with offset
          return createQueryChain([
            {
              id: 'mod-010',
              modificationNumber: 'MOD-010',
              subscriptionId: 'sub-123',
              modificationType: 'add_items',
              status: "applied",
              effectiveDate: new Date('2024-01-01'),
              adjustmentAmount: '100',
              requestDate: new Date('2023-12-01')
            }
          ]);
        }
      });

      const result = await service.listModifications(filters, {
        limit: 1,
        offset: 9
      });

      expect(result.total).toBe(50);
      expect(result.modifications).toHaveLength(1);
    });
  });

  describe('processPartialTermination', () => {
    it('should process partial termination', async () => {
      const subscriptionId = 'sub-123';
      const itemsToTerminate = ['item-001', 'item-002'];
      const terminationDate = new Date('2024-06-01');

      const mockResult = {
        modificationId: 'mod-003',
        refundAmount: 500,
        affectedObligations: ['po-001', 'po-002'],
        cancelledSchedules: 10
      };

      (service as any).modificationEngine.processPartialTermination.mockResolvedValue(mockResult);

      const result = await service.processPartialTermination(
        subscriptionId,
        itemsToTerminate,
        terminationDate,
        { refundPolicy: 'prorated' }
      );

      expect(result).toEqual(mockResult);
      expect((service as any).modificationEngine.processPartialTermination).toHaveBeenCalledWith(
        subscriptionId,
        itemsToTerminate,
        terminationDate,
        { refundPolicy: 'prorated' }
      );
    });
  });

  describe('processUpgradeDowngrade', () => {
    it('should process upgrade', async () => {
      const subscriptionId = 'sub-123';
      const changes = {
        fromItemId: 'basic-plan',
        toItemId: 'premium-plan',
        effectiveDate: new Date('2024-06-01'),
        creditPolicy: 'prorated' as const
      };

      const mockResult = {
        modificationId: 'mod-004',
        creditAmount: 100,
        newObligations: [],
        impact: { totalImpact: 200 }
      };

      (service as any).modificationEngine.processUpgradeDowngrade.mockResolvedValue(mockResult);

      const result = await service.processUpgradeDowngrade(subscriptionId, changes);

      expect(result).toEqual(mockResult);
    });
  });

  describe('getPendingApprovals', () => {
    it('should get pending approvals for user', async () => {
      const approverId = 'manager-001';
      const approverRole = 'manager';

      // Mock pending modifications query
      mockDb.select.mockImplementation(() => createQueryChain([
        {
          id: 'mod-001',
          modificationNumber: 'MOD-001',
          subscriptionId: 'sub-123',
          modificationType: 'add_items',
          status: "pending_approval",
          effectiveDate: new Date('2024-06-01'),
          adjustmentAmount: '500',
          requestDate: new Date('2024-05-01')
        },
        {
          id: 'mod-002',
          modificationNumber: 'MOD-002',
          subscriptionId: 'sub-456',
          modificationType: 'price_change',
          status: "pending_approval",
          effectiveDate: new Date('2024-07-01'),
          adjustmentAmount: '1000',
          requestDate: new Date('2024-05-15')
        }
      ]));

      // Mock approval status checks
      (service as any).approvalWorkflow.getApprovalStatus
        .mockResolvedValueOnce({
          status: 'pending',
          pendingApprovals: ['manager', 'finance'],
          completedApprovals: []
        })
        .mockResolvedValueOnce({
          status: 'pending',
          pendingApprovals: ['finance'], // Manager not needed for this one
          completedApprovals: ['manager']
        });

      const result = await service.getPendingApprovals(approverId, approverRole);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('mod-001');
    });
  });

  describe('getStatistics', () => {
    it('should calculate modification statistics', async () => {
      const organizationId = 'org-123';
      const period = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      let queryCount = 0;
      mockDb.select.mockImplementation(() => {
        queryCount++;
        if (queryCount === 1) {
          // By type query
          return createQueryChain([
            { type: 'add_items', count: 10 },
            { type: 'price_change', count: 5 },
            { type: 'early_termination', count: 2 }
          ]);
        } else if (queryCount === 2) {
          // By status query
          return createQueryChain([
            { status: "approved", count: 12 },
            { status: "pending_approval", count: 3 },
            { status: "rejected", count: 2 }
          ]);
        } else if (queryCount === 3) {
          // Total adjustment query
          return createQueryChain([{ total: 50000 }]);
        } else if (queryCount === 4) {
          // Average approval time query
          return createQueryChain([{ avgTime: 48 }]);
        }
        return createQueryChain([]);
      });

      const result = await service.getStatistics(organizationId, period);

      expect(result.totalModifications).toBe(17);
      expect(result.byType['add_items']).toBe(10);
      expect(result.byStatus["approved"]).toBe(12);
      expect(result.totalAdjustmentAmount).toBe(50000);
      expect(result.averageApprovalTime).toBe(48);
      expect(result.approvalRate).toBeCloseTo(0.706, 2);
    });
  });

  describe('cancelModification', () => {
    it('should cancel a draft modification', async () => {
      const modificationId = 'mod-001';
      const cancelledBy = 'user-123';
      const reason = 'Requirements changed';

      // Mock modification lookup
      mockDb.select.mockImplementation(() => createQueryChain([{
        id: modificationId,
        status: "draft"
      }]));

      // Mock update - create a chain that resolves to the updated record
      const updateChain: any = {};
      const updateMethods = ['set', 'where', 'returning'];
      updateMethods.forEach(method => {
        updateChain[method] = vi.fn(() => updateChain);
      });
      updateChain.then = (resolve: any) => Promise.resolve([{
        id: modificationId,
        status: "cancelled"
      }]).then(resolve);
      mockDb.update.mockReturnValue(updateChain);

      await service.cancelModification(modificationId, cancelledBy, reason);

      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should reject cancellation of non-draft modification', async () => {
      const modificationId = 'mod-002';

      mockDb.select.mockImplementation(() => createQueryChain([{
        id: modificationId,
        status: "approved"
      }]));

      await expect(service.cancelModification(modificationId, 'user-123', 'reason'))
        .rejects.toThrow('Only draft modifications can be cancelled');
    });

    it('should handle modification not found', async () => {
      mockDb.select.mockImplementation(() => createQueryChain([]));

      await expect(service.cancelModification('non-existent', 'user-123', 'reason'))
        .rejects.toThrow('Modification not found');
    });
  });
});
