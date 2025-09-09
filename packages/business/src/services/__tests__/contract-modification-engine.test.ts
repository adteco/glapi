import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContractModificationEngine } from '../contract-modification-engine';
import { Database } from '@glapi/database';
import { ModificationMethod, ModificationType, ModificationStatus } from '@glapi/database/schema';
import type { ModificationRequest, ModificationImpact } from '../contract-modification-engine';

// Mock the database
vi.mock('@glapi/database', () => ({
  Database: vi.fn(),
  contractModifications: {},
  modificationLineItems: {},
  catchUpAdjustments: {},
  subscriptions: {},
  subscriptionItems: {},
  items: {},
  performanceObligations: {},
  revenueSchedules: {}
}));

describe('ContractModificationEngine', () => {
  let engine: ContractModificationEngine;
  let mockDb: any;
  let mockRevenueEngine: any;

  beforeEach(() => {
    // Setup mock database
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      transaction: vi.fn((callback) => callback(mockDb))
    };

    // Setup mock revenue engine
    mockRevenueEngine = {
      recalculateAllocations: vi.fn().mockResolvedValue({
        obligations: [],
        totalAllocated: 1000
      }),
      calculateCatchUpAdjustment: vi.fn().mockResolvedValue({
        adjustmentAmount: 100,
        priorRecognized: 500,
        revisedCumulative: 600
      }),
      recalculateSchedules: vi.fn().mockResolvedValue([])
    };

    engine = new ContractModificationEngine(mockDb as Database, mockRevenueEngine);
  });

  describe('processModification', () => {
    it('should process a simple add items modification', async () => {
      const request: ModificationRequest = {
        subscriptionId: 'sub-123',
        modificationType: ModificationType.ADD_ITEMS,
        effectiveDate: new Date('2024-01-01'),
        changes: {
          addItems: [
            {
              itemId: 'item-456',
              quantity: 5,
              unitPrice: 100,
              discountPercent: 10
            }
          ]
        },
        requestedBy: 'user-789'
      };

      // Mock subscription lookup
      mockDb.limit.mockResolvedValue([{
        id: 'sub-123',
        organizationId: 'org-123',
        customerId: 'cust-123',
        contractNumber: 'CONTRACT-001',
        status: 'active',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2025-01-01'),
        totalContractValue: '10000'
      }]);

      // Mock item lookup
      mockDb.where.mockImplementation(() => {
        mockDb.limit.mockResolvedValue([{
          id: 'item-456',
          name: 'Test Item',
          type: 'service',
          standardPrice: '100'
        }]);
        return mockDb;
      });

      // Mock modification creation
      mockDb.returning.mockResolvedValue([{
        id: 'mod-001',
        modificationNumber: 'MOD-001'
      }]);

      const result = await engine.processModification(request);

      expect(result.modificationId).toBe('mod-001');
      expect(result.impact).toBeDefined();
      expect(result.impact.totalImpact).toBeGreaterThan(0);
    });

    it('should handle preview mode without persisting changes', async () => {
      const request: ModificationRequest = {
        subscriptionId: 'sub-123',
        modificationType: ModificationType.PRICE_CHANGE,
        effectiveDate: new Date('2024-01-01'),
        changes: {
          modifyItems: [
            {
              subscriptionItemId: 'item-123',
              newUnitPrice: 150
            }
          ]
        },
        requestedBy: 'user-789'
      };

      // Mock subscription and item lookups
      mockDb.limit.mockResolvedValue([{
        id: 'sub-123',
        totalContractValue: '10000'
      }]);

      const result = await engine.processModification(request, { preview: true });

      expect(result.modificationId).toBeUndefined();
      expect(result.impact).toBeDefined();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should determine SEPARATE_CONTRACT method for distinct items at SSP', async () => {
      const request: ModificationRequest = {
        subscriptionId: 'sub-123',
        modificationType: ModificationType.ADD_ITEMS,
        effectiveDate: new Date('2024-01-01'),
        changes: {
          addItems: [
            {
              itemId: 'distinct-item',
              quantity: 1,
              unitPrice: 500
            }
          ]
        },
        requestedBy: 'user-789'
      };

      // Mock subscription lookup
      mockDb.limit.mockResolvedValue([{
        id: 'sub-123',
        totalContractValue: '10000'
      }]);

      // Mock item lookup with SSP matching unit price
      mockDb.where.mockImplementation(() => {
        mockDb.limit.mockResolvedValue([{
          id: 'distinct-item',
          name: 'Distinct Service',
          type: 'service',
          isDistinct: true,
          standardPrice: '500'
        }]);
        return mockDb;
      });

      mockDb.returning.mockResolvedValue([{
        id: 'mod-002',
        modificationMethod: ModificationMethod.SEPARATE_CONTRACT
      }]);

      const result = await engine.processModification(request);

      expect(result.impact.accountingMethod).toBe(ModificationMethod.SEPARATE_CONTRACT);
    });

    it('should calculate cumulative catch-up adjustment', async () => {
      const request: ModificationRequest = {
        subscriptionId: 'sub-123',
        modificationType: ModificationType.PRICE_CHANGE,
        effectiveDate: new Date('2024-01-01'),
        changes: {
          modifyItems: [
            {
              subscriptionItemId: 'item-123',
              newUnitPrice: 200
            }
          ]
        },
        requestedBy: 'user-789'
      };

      // Mock subscription with existing items
      mockDb.limit.mockResolvedValue([{
        id: 'sub-123',
        totalContractValue: '10000'
      }]);

      // Mock existing subscription items
      mockDb.where.mockImplementation(() => {
        mockDb.limit.mockResolvedValue([{
          id: 'item-123',
          itemId: 'base-item',
          quantity: '10',
          unitPrice: '100'
        }]);
        return mockDb;
      });

      mockDb.returning.mockResolvedValue([{
        id: 'mod-003',
        modificationMethod: ModificationMethod.CUMULATIVE_CATCH_UP
      }]);

      const result = await engine.processModification(request);

      expect(result.impact.accountingMethod).toBe(ModificationMethod.CUMULATIVE_CATCH_UP);
      expect(mockRevenueEngine.calculateCatchUpAdjustment).toHaveBeenCalled();
    });
  });

  describe('processPartialTermination', () => {
    it('should handle partial termination with prorated refund', async () => {
      const subscriptionId = 'sub-123';
      const itemsToTerminate = ['item-001', 'item-002'];
      const terminationDate = new Date('2024-06-01');

      // Mock subscription and items
      mockDb.limit.mockResolvedValue([{
        id: 'sub-123',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        totalContractValue: '12000'
      }]);

      // Mock subscription items to terminate
      mockDb.where.mockImplementation(() => {
        mockDb.limit.mockResolvedValue([
          {
            id: 'item-001',
            unitPrice: '100',
            quantity: '10',
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-12-31')
          },
          {
            id: 'item-002',
            unitPrice: '50',
            quantity: '5',
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-12-31')
          }
        ]);
        return mockDb;
      });

      mockDb.returning.mockResolvedValue([{
        id: 'mod-004',
        modificationNumber: 'MOD-004'
      }]);

      const result = await engine.processPartialTermination(
        subscriptionId,
        itemsToTerminate,
        terminationDate,
        { refundPolicy: 'prorated' }
      );

      expect(result.modificationId).toBe('mod-004');
      expect(result.refundAmount).toBeGreaterThan(0);
      expect(result.affectedObligations).toHaveLength(2);
    });

    it('should handle no refund policy', async () => {
      const result = await engine.processPartialTermination(
        'sub-123',
        ['item-001'],
        new Date('2024-06-01'),
        { refundPolicy: 'none' }
      );

      expect(result.refundAmount).toBe(0);
    });
  });

  describe('processUpgradeDowngrade', () => {
    it('should process upgrade with prorated credit', async () => {
      const subscriptionId = 'sub-123';
      const changes = {
        fromItemId: 'basic-plan',
        toItemId: 'premium-plan',
        effectiveDate: new Date('2024-06-01'),
        creditPolicy: 'prorated' as const
      };

      // Mock subscription
      mockDb.limit.mockResolvedValue([{
        id: 'sub-123',
        totalContractValue: '10000'
      }]);

      // Mock items
      mockDb.where.mockImplementation(() => {
        mockDb.limit.mockResolvedValue([
          {
            id: 'basic-plan',
            unitPrice: '100',
            quantity: '1'
          }
        ]);
        return mockDb;
      });

      // Mock new item lookup
      mockDb.where.mockImplementation(() => {
        mockDb.limit.mockResolvedValue([{
          id: 'premium-plan',
          standardPrice: '200'
        }]);
        return mockDb;
      });

      mockDb.returning.mockResolvedValue([{
        id: 'mod-005',
        modificationNumber: 'MOD-005'
      }]);

      const result = await engine.processUpgradeDowngrade(subscriptionId, changes);

      expect(result.modificationId).toBe('mod-005');
      expect(result.creditAmount).toBeGreaterThan(0);
      expect(result.impact).toBeDefined();
    });

    it('should handle downgrade with credit', async () => {
      const subscriptionId = 'sub-123';
      const changes = {
        fromItemId: 'premium-plan',
        toItemId: 'basic-plan',
        effectiveDate: new Date('2024-06-01'),
        creditPolicy: 'full' as const
      };

      mockDb.limit.mockResolvedValue([{
        id: 'sub-123',
        totalContractValue: '20000'
      }]);

      mockDb.where.mockImplementation(() => {
        mockDb.limit.mockResolvedValue([
          {
            id: 'premium-plan',
            unitPrice: '200',
            quantity: '1'
          }
        ]);
        return mockDb;
      });

      mockDb.returning.mockResolvedValue([{
        id: 'mod-006'
      }]);

      const result = await engine.processUpgradeDowngrade(subscriptionId, changes);

      expect(result.creditAmount).toBeGreaterThan(0);
    });
  });

  describe('processBlendAndExtend', () => {
    it('should calculate blended rate for term extension', async () => {
      const subscriptionId = 'sub-123';
      const newTermEndDate = new Date('2025-12-31');
      const priceAdjustment = -10; // 10% discount

      // Mock subscription
      mockDb.limit.mockResolvedValue([{
        id: 'sub-123',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        totalContractValue: '12000'
      }]);

      // Mock subscription items
      mockDb.where.mockImplementation(() => {
        mockDb.limit.mockResolvedValue([
          {
            id: 'item-001',
            unitPrice: '1000',
            quantity: '1'
          }
        ]);
        return mockDb;
      });

      mockDb.returning.mockResolvedValue([{
        id: 'mod-007',
        modificationNumber: 'MOD-007'
      }]);

      const result = await engine.processBlendAndExtend(
        subscriptionId,
        newTermEndDate,
        priceAdjustment
      );

      expect(result.modificationId).toBe('mod-007');
      expect(result.blendedRate).toBeLessThan(1000); // Should be discounted
      expect(result.extendedMonths).toBe(12); // One year extension
    });
  });

  describe('applyModification', () => {
    it('should apply an approved modification', async () => {
      const modificationId = 'mod-001';

      // Mock modification lookup
      mockDb.limit.mockResolvedValue([{
        id: modificationId,
        status: ModificationStatus.APPROVED,
        modificationType: ModificationType.ADD_ITEMS,
        effectiveDate: new Date('2024-01-01'),
        modificationDetails: {
          addItems: [{ itemId: 'item-123', quantity: 5 }]
        }
      }]);

      // Mock line items
      mockDb.where.mockImplementation(() => {
        mockDb.limit.mockResolvedValue([
          {
            id: 'line-001',
            changeType: 'add',
            newItemId: 'item-123',
            newQuantity: '5',
            newUnitPrice: '100'
          }
        ]);
        return mockDb;
      });

      mockDb.returning.mockResolvedValue([{
        id: 'sub-item-new'
      }]);

      await engine.applyModification(modificationId);

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should throw error for non-approved modification', async () => {
      const modificationId = 'mod-002';

      mockDb.limit.mockResolvedValue([{
        id: modificationId,
        status: ModificationStatus.DRAFT
      }]);

      await expect(engine.applyModification(modificationId))
        .rejects.toThrow('Modification must be approved before applying');
    });

    it('should handle cumulative catch-up adjustments', async () => {
      const modificationId = 'mod-003';

      mockDb.limit.mockResolvedValue([{
        id: modificationId,
        status: ModificationStatus.APPROVED,
        modificationMethod: ModificationMethod.CUMULATIVE_CATCH_UP,
        cumulativeCatchUpAmount: '500'
      }]);

      // Mock catch-up adjustments
      mockDb.where.mockImplementation(() => {
        mockDb.limit.mockResolvedValue([
          {
            id: 'catch-001',
            catchUpAdjustment: '500',
            performanceObligationId: 'po-001'
          }
        ]);
        return mockDb;
      });

      await engine.applyModification(modificationId);

      expect(mockRevenueEngine.recalculateSchedules).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle modification with no changes', async () => {
      const request: ModificationRequest = {
        subscriptionId: 'sub-123',
        modificationType: ModificationType.PRICE_CHANGE,
        effectiveDate: new Date('2024-01-01'),
        changes: {},
        requestedBy: 'user-789'
      };

      await expect(engine.processModification(request))
        .rejects.toThrow('No changes specified in modification request');
    });

    it('should handle subscription not found', async () => {
      const request: ModificationRequest = {
        subscriptionId: 'non-existent',
        modificationType: ModificationType.ADD_ITEMS,
        effectiveDate: new Date('2024-01-01'),
        changes: {
          addItems: [{ itemId: 'item-123', quantity: 1, unitPrice: 100 }]
        },
        requestedBy: 'user-789'
      };

      mockDb.limit.mockResolvedValue([]);

      await expect(engine.processModification(request))
        .rejects.toThrow('Subscription not found');
    });

    it('should validate effective date is not in the past', async () => {
      const request: ModificationRequest = {
        subscriptionId: 'sub-123',
        modificationType: ModificationType.ADD_ITEMS,
        effectiveDate: new Date('2020-01-01'), // Past date
        changes: {
          addItems: [{ itemId: 'item-123', quantity: 1, unitPrice: 100 }]
        },
        requestedBy: 'user-789'
      };

      mockDb.limit.mockResolvedValue([{
        id: 'sub-123',
        startDate: new Date('2024-01-01')
      }]);

      await expect(engine.processModification(request))
        .rejects.toThrow('Effective date cannot be before subscription start date');
    });

    it('should handle concurrent modifications', async () => {
      const modificationId = 'mod-001';

      // Mock modification with pending status
      mockDb.limit.mockResolvedValue([{
        id: modificationId,
        status: ModificationStatus.PENDING_APPROVAL
      }]);

      await expect(engine.applyModification(modificationId))
        .rejects.toThrow('Modification must be approved before applying');
    });
  });
});