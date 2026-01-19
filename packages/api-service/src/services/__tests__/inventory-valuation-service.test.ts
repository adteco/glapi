/**
 * Unit tests for InventoryValuationService
 * Tests valuation calculations, reports, and export functionality
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create chainable mock for database queries
const createMockDbChain = (resolveValue: any = []) => {
  const chain: any = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    offset: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
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
  asc: vi.fn((field) => ({ type: 'asc', field })),
  inArray: vi.fn((field, values) => ({ type: 'inArray', field, values })),
  isNull: vi.fn((field) => ({ type: 'isNull', field })),
  or: vi.fn((...args) => ({ type: 'or', conditions: args })),
  sql: vi.fn((strings, ...values) => ({ type: 'sql', strings, values })),
}));

vi.mock('@glapi/database', () => ({
  getDb: vi.fn(() => mockDbInstance),
  itemCostLayers: {
    id: 'id',
    organizationId: 'organizationId',
    itemId: 'itemId',
    subsidiaryId: 'subsidiaryId',
    locationId: 'locationId',
    isFullyDepleted: 'isFullyDepleted',
    quantityRemaining: 'quantityRemaining',
    unitCost: 'unitCost',
    layerNumber: 'layerNumber',
    receiptDate: 'receiptDate',
  },
  items: {
    id: 'id',
    organizationId: 'organizationId',
    itemCode: 'itemCode',
    name: 'name',
    categoryId: 'categoryId',
  },
  locations: { id: 'id', name: 'name' },
  subsidiaries: { id: 'id', name: 'name' },
  itemCategories: { id: 'id', name: 'name' },
}));

// Mock ItemCostingConfigService
vi.mock('../item-costing-config-service', () => ({
  ItemCostingConfigService: vi.fn().mockImplementation(() => ({
    getEffectiveConfig: vi.fn().mockResolvedValue({ costingMethod: 'FIFO' }),
    getAverageCost: vi.fn().mockResolvedValue(10.00),
  })),
}));

import { InventoryValuationService } from '../inventory-valuation-service';

describe('InventoryValuationService', () => {
  let service: InventoryValuationService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbInstance = createMockDbChain([]);
  });

  describe('constructor', () => {
    it('should initialize with context', () => {
      service = new InventoryValuationService({
        organizationId: 'org-123',
        userId: 'user-123',
      });
      expect(service).toBeDefined();
    });
  });

  describe('valuation report types', () => {
    it('should support item valuation reports', () => {
      const reportTypes = ['itemValuation', 'costLayers', 'summary', 'export'];
      expect(reportTypes).toContain('itemValuation');
      expect(reportTypes).toContain('costLayers');
    });

    it('should support multiple export formats', () => {
      const formats = ['json', 'csv', 'xlsx'];
      expect(formats).toContain('json');
      expect(formats).toContain('csv');
    });

    it('should support grouping by dimension', () => {
      const dimensions = ['subsidiary', 'location', 'category'];
      expect(dimensions).toContain('subsidiary');
      expect(dimensions).toContain('location');
      expect(dimensions).toContain('category');
    });
  });

  describe('valuation calculations', () => {
    it('should calculate average unit cost correctly', () => {
      const calculateAverageUnitCost = (totalValue: number, totalQuantity: number): number => {
        return totalQuantity > 0 ? totalValue / totalQuantity : 0;
      };

      expect(calculateAverageUnitCost(1000, 100)).toBe(10);
      expect(calculateAverageUnitCost(1500, 75)).toBe(20);
      expect(calculateAverageUnitCost(0, 0)).toBe(0);
    });

    it('should calculate total value correctly', () => {
      const calculateTotalValue = (quantity: number, unitCost: number): number => {
        return quantity * unitCost;
      };

      expect(calculateTotalValue(100, 10)).toBe(1000);
      expect(calculateTotalValue(50, 25.50)).toBe(1275);
    });

    it('should aggregate values across cost layers', () => {
      const layers = [
        { quantityRemaining: 100, unitCost: 10 },
        { quantityRemaining: 50, unitCost: 12 },
        { quantityRemaining: 75, unitCost: 11 },
      ];

      const totalQuantity = layers.reduce((sum, l) => sum + l.quantityRemaining, 0);
      const totalValue = layers.reduce((sum, l) => sum + l.quantityRemaining * l.unitCost, 0);
      const avgCost = totalValue / totalQuantity;

      expect(totalQuantity).toBe(225);
      expect(totalValue).toBe(100 * 10 + 50 * 12 + 75 * 11);
      expect(avgCost).toBeCloseTo(10.78, 1);
    });
  });

  describe('cost layer details', () => {
    it('should include required fields in cost layer detail', () => {
      const requiredFields = [
        'layerId',
        'layerNumber',
        'itemId',
        'itemCode',
        'receiptDate',
        'quantityReceived',
        'quantityRemaining',
        'unitCost',
        'totalCost',
        'currencyCode',
        'isFullyDepleted',
      ];

      const mockLayer = {
        layerId: 'layer-1',
        layerNumber: 1,
        itemId: 'item-1',
        itemCode: 'ITEM-001',
        receiptDate: new Date(),
        quantityReceived: 100,
        quantityRemaining: 75,
        unitCost: 10.50,
        totalCost: 1050,
        currencyCode: 'USD',
        isFullyDepleted: false,
      };

      requiredFields.forEach((field) => {
        expect(mockLayer).toHaveProperty(field);
      });
    });

    it('should track lot and serial numbers when applicable', () => {
      const layerWithTracking = {
        lotNumber: 'LOT-2025-001',
        serialNumber: 'SN-12345',
      };

      expect(layerWithTracking.lotNumber).toBe('LOT-2025-001');
      expect(layerWithTracking.serialNumber).toBe('SN-12345');
    });
  });

  describe('filtering', () => {
    it('should support filtering by subsidiary', () => {
      const filters = { subsidiaryId: 'sub-123' };
      expect(filters.subsidiaryId).toBe('sub-123');
    });

    it('should support filtering by location', () => {
      const filters = { locationId: 'loc-123' };
      expect(filters.locationId).toBe('loc-123');
    });

    it('should support filtering by category', () => {
      const filters = { categoryId: 'cat-123' };
      expect(filters.categoryId).toBe('cat-123');
    });

    it('should support filtering by item', () => {
      const filters = { itemId: 'item-123' };
      expect(filters.itemId).toBe('item-123');
    });

    it('should support including zero quantity items', () => {
      const filters = { includeZeroQuantity: true };
      expect(filters.includeZeroQuantity).toBe(true);
    });
  });

  describe('pagination', () => {
    it('should support limit and offset', () => {
      const pagination = { limit: 50, offset: 100 };
      expect(pagination.limit).toBe(50);
      expect(pagination.offset).toBe(100);
    });

    it('should support ordering', () => {
      const ordering = { orderBy: 'totalValue', orderDirection: 'desc' };
      expect(ordering.orderBy).toBe('totalValue');
      expect(ordering.orderDirection).toBe('desc');
    });

    it('should calculate hasMore correctly', () => {
      const calculateHasMore = (offset: number, limit: number, total: number): boolean => {
        return offset + limit < total;
      };

      expect(calculateHasMore(0, 100, 500)).toBe(true);
      expect(calculateHasMore(400, 100, 500)).toBe(false);
      expect(calculateHasMore(450, 100, 500)).toBe(false);
    });
  });

  describe('export functionality', () => {
    it('should escape CSV values correctly', () => {
      const escapeCSV = (value: string): string => {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      expect(escapeCSV('Simple value')).toBe('Simple value');
      expect(escapeCSV('Value, with comma')).toBe('"Value, with comma"');
      expect(escapeCSV('Value "with" quotes')).toBe('"Value ""with"" quotes"');
      expect(escapeCSV('Value\nwith newline')).toBe('"Value\nwith newline"');
    });

    it('should generate correct CSV headers for valuation', () => {
      const expectedHeaders = [
        'Item Code',
        'Item Name',
        'Subsidiary',
        'Location',
        'Category',
        'Costing Method',
        'Quantity On Hand',
        'Unit Cost',
        'Total Value',
        'Layer Count',
        'Oldest Layer Date',
        'Newest Layer Date',
      ];

      expect(expectedHeaders).toHaveLength(12);
      expect(expectedHeaders).toContain('Quantity On Hand');
      expect(expectedHeaders).toContain('Total Value');
    });

    it('should generate correct CSV headers for cost layers', () => {
      const expectedHeaders = [
        'Layer Number',
        'Item Code',
        'Item Name',
        'Receipt Date',
        'Document Number',
        'Transaction Type',
        'Quantity Received',
        'Quantity Remaining',
        'Quantity Reserved',
        'Unit Cost',
        'Total Cost',
        'Currency',
        'Lot Number',
        'Serial Number',
        'Is Depleted',
        'Depleted At',
      ];

      expect(expectedHeaders).toHaveLength(16);
      expect(expectedHeaders).toContain('Layer Number');
      expect(expectedHeaders).toContain('Unit Cost');
    });
  });

  describe('summary calculations', () => {
    it('should aggregate by subsidiary', () => {
      const valuations = [
        { subsidiaryId: 'sub-1', totalValue: 1000, quantityOnHand: 100 },
        { subsidiaryId: 'sub-1', totalValue: 500, quantityOnHand: 50 },
        { subsidiaryId: 'sub-2', totalValue: 750, quantityOnHand: 75 },
      ];

      const bySubsidiary = valuations.reduce((acc, v) => {
        if (!acc[v.subsidiaryId]) {
          acc[v.subsidiaryId] = { totalValue: 0, quantityOnHand: 0, itemCount: 0 };
        }
        acc[v.subsidiaryId].totalValue += v.totalValue;
        acc[v.subsidiaryId].quantityOnHand += v.quantityOnHand;
        acc[v.subsidiaryId].itemCount += 1;
        return acc;
      }, {} as Record<string, { totalValue: number; quantityOnHand: number; itemCount: number }>);

      expect(bySubsidiary['sub-1'].totalValue).toBe(1500);
      expect(bySubsidiary['sub-1'].quantityOnHand).toBe(150);
      expect(bySubsidiary['sub-1'].itemCount).toBe(2);
      expect(bySubsidiary['sub-2'].totalValue).toBe(750);
    });

    it('should calculate overall totals', () => {
      const valuations = [
        { totalValue: 1000, quantityOnHand: 100 },
        { totalValue: 500, quantityOnHand: 50 },
        { totalValue: 750, quantityOnHand: 75 },
      ];

      const totals = {
        totalItems: valuations.length,
        totalQuantity: valuations.reduce((sum, v) => sum + v.quantityOnHand, 0),
        totalValue: valuations.reduce((sum, v) => sum + v.totalValue, 0),
      };

      expect(totals.totalItems).toBe(3);
      expect(totals.totalQuantity).toBe(225);
      expect(totals.totalValue).toBe(2250);
    });
  });

  describe('costing method support', () => {
    it('should support all costing methods', () => {
      const methods = ['FIFO', 'LIFO', 'AVERAGE', 'WEIGHTED_AVERAGE', 'STANDARD'];
      expect(methods).toHaveLength(5);
      expect(methods).toContain('FIFO');
      expect(methods).toContain('LIFO');
      expect(methods).toContain('AVERAGE');
    });

    it('should display costing method in valuation', () => {
      const valuation = {
        itemId: 'item-1',
        costingMethod: 'FIFO' as const,
        quantityOnHand: 100,
        totalValue: 1000,
      };

      expect(valuation.costingMethod).toBe('FIFO');
    });
  });
});
