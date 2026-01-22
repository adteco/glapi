/**
 * Item Test Fixtures
 *
 * Provides test data generators for inventory items
 */

import { testId } from '../helpers/api-client';

export interface ItemTestData {
  name: string;
  sku?: string;
  description?: string;
  type: 'inventory' | 'service' | 'non_inventory' | 'discount' | 'subtotal' | 'group';
  unitPrice?: number;
  costPrice?: number;
  taxable?: boolean;
  active?: boolean;
  trackQuantity?: boolean;
  quantityOnHand?: number;
  reorderPoint?: number;
  categoryId?: string;
  vendorId?: string;
}

/**
 * Generate a basic test item
 */
export function createTestItem(overrides?: Partial<ItemTestData>): ItemTestData {
  const id = testId('item');
  return {
    name: `Test Item ${id}`,
    sku: `SKU-${id}`,
    description: 'A test item for E2E testing',
    type: 'inventory',
    unitPrice: 99.99,
    costPrice: 49.99,
    taxable: true,
    active: true,
    trackQuantity: true,
    quantityOnHand: 100,
    reorderPoint: 10,
    ...overrides,
  };
}

/**
 * Generate multiple test items
 */
export function createTestItems(count: number, overrides?: Partial<ItemTestData>): ItemTestData[] {
  return Array.from({ length: count }, () => createTestItem(overrides));
}

/**
 * Sample item scenarios for testing
 */
export const itemScenarios = {
  /**
   * Physical inventory item
   */
  inventory: (): ItemTestData => ({
    name: `Inventory Item ${testId()}`,
    sku: `INV-${testId()}`,
    type: 'inventory',
    unitPrice: 149.99,
    costPrice: 75.00,
    taxable: true,
    trackQuantity: true,
    quantityOnHand: 50,
    reorderPoint: 5,
  }),

  /**
   * Service item (non-physical)
   */
  service: (): ItemTestData => ({
    name: `Consulting Service ${testId()}`,
    sku: `SVC-${testId()}`,
    type: 'service',
    unitPrice: 150.00,
    taxable: false,
    trackQuantity: false,
  }),

  /**
   * Non-inventory item
   */
  nonInventory: (): ItemTestData => ({
    name: `Non-Inventory Item ${testId()}`,
    sku: `NI-${testId()}`,
    type: 'non_inventory',
    unitPrice: 25.00,
    taxable: true,
    trackQuantity: false,
  }),

  /**
   * Discount item
   */
  discount: (): ItemTestData => ({
    name: `Volume Discount ${testId()}`,
    type: 'discount',
    unitPrice: -10.00,
    taxable: false,
  }),

  /**
   * Low stock item
   */
  lowStock: (): ItemTestData => ({
    name: `Low Stock Item ${testId()}`,
    sku: `LOW-${testId()}`,
    type: 'inventory',
    unitPrice: 199.99,
    trackQuantity: true,
    quantityOnHand: 2,
    reorderPoint: 10,
  }),

  /**
   * Out of stock item
   */
  outOfStock: (): ItemTestData => ({
    name: `Out of Stock Item ${testId()}`,
    sku: `OOS-${testId()}`,
    type: 'inventory',
    unitPrice: 299.99,
    trackQuantity: true,
    quantityOnHand: 0,
    reorderPoint: 5,
  }),

  /**
   * Inactive item
   */
  inactive: (): ItemTestData => ({
    name: `Inactive Item ${testId()}`,
    sku: `INACTIVE-${testId()}`,
    type: 'inventory',
    active: false,
  }),

  /**
   * High-value item
   */
  highValue: (): ItemTestData => ({
    name: `Premium Product ${testId()}`,
    sku: `PREMIUM-${testId()}`,
    type: 'inventory',
    unitPrice: 9999.99,
    costPrice: 5000.00,
    taxable: true,
    trackQuantity: true,
  }),

  /**
   * Zero-price item (promotional)
   */
  freeItem: (): ItemTestData => ({
    name: `Free Sample ${testId()}`,
    sku: `FREE-${testId()}`,
    type: 'non_inventory',
    unitPrice: 0,
    taxable: false,
  }),
};

/**
 * Invalid item data for negative testing
 */
export const invalidItems = {
  /**
   * Empty name
   */
  emptyName: () => ({
    name: '',
    type: 'inventory' as const,
  }),

  /**
   * Invalid type
   */
  invalidType: () => ({
    name: `Invalid Type Item ${testId()}`,
    type: 'invalid' as any,
  }),

  /**
   * Negative price
   */
  negativePrice: () => ({
    name: `Negative Price Item ${testId()}`,
    type: 'inventory' as const,
    unitPrice: -100,
  }),

  /**
   * Negative quantity
   */
  negativeQuantity: () => ({
    name: `Negative Qty Item ${testId()}`,
    type: 'inventory' as const,
    quantityOnHand: -5,
  }),
};
