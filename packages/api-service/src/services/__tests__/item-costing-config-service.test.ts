import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ItemCostingConfigService, CostingServiceContext } from '../item-costing-config-service';

// Mock the database
vi.mock('@glapi/database', () => ({
  getDb: vi.fn(() => mockDb),
  organizationCostingDefaults: { id: 'id', organizationId: 'organization_id' },
  subsidiaryCostingConfig: { id: 'id', organizationId: 'organization_id', subsidiaryId: 'subsidiary_id' },
  itemCostingMethods: { id: 'id', organizationId: 'organization_id', itemId: 'item_id', subsidiaryId: 'subsidiary_id' },
  itemCostLayers: { id: 'id', organizationId: 'organization_id', itemId: 'item_id', subsidiaryId: 'subsidiary_id' },
  itemCostHistory: { id: 'id', organizationId: 'organization_id', itemId: 'item_id' },
}));

// Mock query builder
const mockReturning = vi.fn().mockResolvedValue([{ id: 'test-id' }]);
const mockWhere = vi.fn().mockReturnThis();
const mockOrderBy = vi.fn().mockResolvedValue([]);
const mockLimit = vi.fn().mockReturnThis();
const mockOffset = vi.fn().mockReturnThis();
const mockSet = vi.fn().mockReturnThis();
const mockValues = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockSelect = vi.fn(() => ({
  from: mockFrom,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  offset: mockOffset,
}));

const mockDb = {
  select: mockSelect,
  insert: vi.fn(() => ({
    values: mockValues,
    returning: mockReturning,
  })),
  update: vi.fn(() => ({
    set: mockSet,
    where: mockWhere,
    returning: mockReturning,
  })),
};

describe('ItemCostingConfigService', () => {
  const testContext: CostingServiceContext = {
    organizationId: 'org-123',
    userId: 'user-456',
  };

  let service: ItemCostingConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ItemCostingConfigService(testContext);
  });

  describe('getOrganizationDefaults', () => {
    it('should return organization costing defaults when found', async () => {
      const mockDefaults = {
        id: 'default-1',
        organizationId: 'org-123',
        defaultCostingMethod: 'AVERAGE',
        allowStandardCostRevaluation: false,
      };

      mockWhere.mockResolvedValueOnce([mockDefaults]);

      const result = await service.getOrganizationDefaults();

      expect(result).toEqual(mockDefaults);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return null when no defaults exist', async () => {
      mockWhere.mockResolvedValueOnce([]);

      const result = await service.getOrganizationDefaults();

      expect(result).toBeNull();
    });
  });

  describe('upsertOrganizationDefaults', () => {
    it('should create new defaults when none exist', async () => {
      // First call returns no existing defaults
      mockWhere.mockResolvedValueOnce([]);

      // Insert returns new defaults
      const newDefaults = {
        id: 'new-default-1',
        organizationId: 'org-123',
        defaultCostingMethod: 'FIFO',
      };
      mockReturning.mockResolvedValueOnce([newDefaults]);

      const result = await service.upsertOrganizationDefaults({
        defaultCostingMethod: 'FIFO',
      });

      expect(result).toEqual(newDefaults);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should update existing defaults', async () => {
      // First call returns existing defaults
      const existingDefaults = {
        id: 'existing-1',
        organizationId: 'org-123',
        defaultCostingMethod: 'AVERAGE',
      };
      mockWhere.mockResolvedValueOnce([existingDefaults]);

      // Update returns updated defaults
      const updatedDefaults = {
        ...existingDefaults,
        defaultCostingMethod: 'LIFO',
      };
      mockReturning.mockResolvedValueOnce([updatedDefaults]);

      const result = await service.upsertOrganizationDefaults({
        defaultCostingMethod: 'LIFO',
      });

      expect(result).toEqual(updatedDefaults);
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('getEffectiveConfig', () => {
    it('should return item-level config when available', async () => {
      const itemConfig = {
        id: 'item-config-1',
        costingMethod: 'STANDARD',
        standardCost: '100.00',
        allowStandardCostRevaluation: true,
        priceVarianceThresholdPercent: '3.00',
        quantityVarianceThresholdPercent: '2.00',
      };

      mockWhere.mockResolvedValueOnce([itemConfig]);

      const result = await service.getEffectiveConfig('item-1', 'sub-1');

      expect(result.costingMethod).toBe('STANDARD');
      expect(result.source).toBe('item');
      expect(result.standardCost).toBe(100);
    });

    it('should fall back to subsidiary config when no item config', async () => {
      // No item config
      mockWhere.mockResolvedValueOnce([]);

      // Subsidiary config exists
      const subsidiaryConfig = {
        id: 'sub-config-1',
        costingMethod: 'FIFO',
        priceVarianceThresholdPercent: '4.00',
        quantityVarianceThresholdPercent: '4.00',
      };
      mockWhere.mockResolvedValueOnce([subsidiaryConfig]);

      const result = await service.getEffectiveConfig('item-1', 'sub-1');

      expect(result.costingMethod).toBe('FIFO');
      expect(result.source).toBe('subsidiary');
      expect(result.trackCostLayers).toBe(true); // FIFO requires layer tracking
    });

    it('should fall back to organization defaults when no item or subsidiary config', async () => {
      // No item config
      mockWhere.mockResolvedValueOnce([]);
      // No subsidiary config
      mockWhere.mockResolvedValueOnce([]);
      // Organization defaults exist
      const orgDefaults = {
        id: 'org-default-1',
        defaultCostingMethod: 'WEIGHTED_AVERAGE',
        trackCostLayers: false,
        autoRecalculateOnReceipt: true,
        priceVarianceThresholdPercent: '5.00',
        quantityVarianceThresholdPercent: '5.00',
      };
      mockWhere.mockResolvedValueOnce([orgDefaults]);

      const result = await service.getEffectiveConfig('item-1', 'sub-1');

      expect(result.costingMethod).toBe('WEIGHTED_AVERAGE');
      expect(result.source).toBe('organization');
    });

    it('should return default AVERAGE config when no config exists at any level', async () => {
      // No item config
      mockWhere.mockResolvedValueOnce([]);
      // No subsidiary config
      mockWhere.mockResolvedValueOnce([]);
      // No organization defaults
      mockWhere.mockResolvedValueOnce([]);

      const result = await service.getEffectiveConfig('item-1', 'sub-1');

      expect(result.costingMethod).toBe('AVERAGE');
      expect(result.source).toBe('organization');
      expect(result.priceVarianceThresholdPercent).toBe(5);
    });
  });

  describe('getAvailableCostLayers', () => {
    it('should return layers ordered by receipt date for FIFO', async () => {
      const layers = [
        { id: 'layer-1', receiptDate: new Date('2024-01-01'), quantityRemaining: '10' },
        { id: 'layer-2', receiptDate: new Date('2024-01-15'), quantityRemaining: '20' },
      ];

      mockOrderBy.mockResolvedValueOnce(layers);

      const result = await service.getAvailableCostLayers('item-1', 'sub-1', 'FIFO');

      expect(result).toEqual(layers);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return layers in reverse order for LIFO', async () => {
      const layers = [
        { id: 'layer-2', receiptDate: new Date('2024-01-15'), quantityRemaining: '20' },
        { id: 'layer-1', receiptDate: new Date('2024-01-01'), quantityRemaining: '10' },
      ];

      mockOrderBy.mockResolvedValueOnce(layers);

      const result = await service.getAvailableCostLayers('item-1', 'sub-1', 'LIFO');

      expect(result).toEqual(layers);
    });
  });

  describe('getAverageCost', () => {
    it('should calculate weighted average cost from layers', async () => {
      const layers = [
        { quantityRemaining: '10', unitCost: '100' },
        { quantityRemaining: '20', unitCost: '120' },
      ];

      mockOrderBy.mockResolvedValueOnce(layers);

      const result = await service.getAverageCost('item-1', 'sub-1');

      // (10 * 100 + 20 * 120) / 30 = (1000 + 2400) / 30 = 113.33...
      expect(result).toBeCloseTo(113.33, 2);
    });

    it('should return 0 when no layers exist', async () => {
      mockOrderBy.mockResolvedValueOnce([]);

      const result = await service.getAverageCost('item-1', 'sub-1');

      expect(result).toBe(0);
    });
  });

  describe('calculateCost', () => {
    it('should return receipt cost for FIFO/LIFO receipts', async () => {
      // Mock getEffectiveConfig to return FIFO
      const itemConfig = {
        costingMethod: 'FIFO',
        priceVarianceThresholdPercent: '5.00',
        quantityVarianceThresholdPercent: '5.00',
      };
      mockWhere.mockResolvedValueOnce([itemConfig]);

      const result = await service.calculateCost('item-1', 'sub-1', 10, 'RECEIPT', 50);

      expect(result.unitCost).toBe(50);
      expect(result.totalCost).toBe(500);
      expect(result.costingMethod).toBe('FIFO');
    });

    it('should calculate variance for STANDARD cost receipts', async () => {
      const itemConfig = {
        costingMethod: 'STANDARD',
        standardCost: '100.00',
        priceVarianceThresholdPercent: '5.00',
        quantityVarianceThresholdPercent: '5.00',
      };
      mockWhere.mockResolvedValueOnce([itemConfig]);

      const result = await service.calculateCost('item-1', 'sub-1', 10, 'RECEIPT', 110);

      expect(result.unitCost).toBe(100);
      expect(result.totalCost).toBe(1000);
      expect(result.varianceAmount).toBe(100); // (110 - 100) * 10
      expect(result.costingMethod).toBe('STANDARD');
    });

    it('should throw error when STANDARD cost is not defined', async () => {
      const itemConfig = {
        costingMethod: 'STANDARD',
        standardCost: null,
        priceVarianceThresholdPercent: '5.00',
        quantityVarianceThresholdPercent: '5.00',
      };
      mockWhere.mockResolvedValueOnce([itemConfig]);

      await expect(service.calculateCost('item-1', 'sub-1', 10, 'RECEIPT', 110))
        .rejects.toThrow('Standard cost not defined');
    });
  });

  describe('createCostLayer', () => {
    it('should create a new cost layer', async () => {
      const newLayer = {
        id: 'layer-1',
        itemId: 'item-1',
        subsidiaryId: 'sub-1',
        layerNumber: 'L001',
        receiptDate: new Date(),
        quantityReceived: '100',
        quantityRemaining: '100',
        unitCost: '50.00',
        totalCost: '5000.00',
      };

      mockReturning.mockResolvedValueOnce([newLayer]);

      const result = await service.createCostLayer({
        itemId: 'item-1',
        subsidiaryId: 'sub-1',
        layerNumber: 'L001',
        receiptDate: new Date(),
        quantityReceived: '100',
        quantityRemaining: '100',
        unitCost: '50.00',
        totalCost: '5000.00',
      });

      expect(result).toEqual(newLayer);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('recordCostHistory', () => {
    it('should record cost change in history', async () => {
      const historyRecord = {
        id: 'history-1',
        itemId: 'item-1',
        changeType: 'STANDARD_COST_UPDATE',
        previousCost: '100.00',
        newCost: '110.00',
      };

      mockReturning.mockResolvedValueOnce([historyRecord]);

      const result = await service.recordCostHistory({
        organizationId: 'org-123',
        subsidiaryId: 'sub-1',
        itemId: 'item-1',
        changeType: 'STANDARD_COST_UPDATE',
        previousCost: '100.00',
        newCost: '110.00',
        varianceAmount: '10.00',
        changeReason: 'Annual cost review',
      });

      expect(result).toEqual(historyRecord);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('Costing Method Validation', () => {
    it('should set trackCostLayers true for FIFO method', async () => {
      const subsidiaryConfig = {
        costingMethod: 'FIFO',
        priceVarianceThresholdPercent: '5.00',
        quantityVarianceThresholdPercent: '5.00',
      };
      mockWhere.mockResolvedValueOnce([]);
      mockWhere.mockResolvedValueOnce([subsidiaryConfig]);

      const result = await service.getEffectiveConfig('item-1', 'sub-1');

      expect(result.trackCostLayers).toBe(true);
    });

    it('should set trackCostLayers true for LIFO method', async () => {
      const subsidiaryConfig = {
        costingMethod: 'LIFO',
        priceVarianceThresholdPercent: '5.00',
        quantityVarianceThresholdPercent: '5.00',
      };
      mockWhere.mockResolvedValueOnce([]);
      mockWhere.mockResolvedValueOnce([subsidiaryConfig]);

      const result = await service.getEffectiveConfig('item-1', 'sub-1');

      expect(result.trackCostLayers).toBe(true);
    });

    it('should set trackCostLayers false for AVERAGE method by default', async () => {
      const subsidiaryConfig = {
        costingMethod: 'AVERAGE',
        priceVarianceThresholdPercent: '5.00',
        quantityVarianceThresholdPercent: '5.00',
      };
      mockWhere.mockResolvedValueOnce([]);
      mockWhere.mockResolvedValueOnce([subsidiaryConfig]);

      const result = await service.getEffectiveConfig('item-1', 'sub-1');

      expect(result.trackCostLayers).toBe(false);
    });
  });
});
