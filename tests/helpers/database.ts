/**
 * Database Helpers for E2E Testing
 *
 * Provides utilities for seeding test data and cleaning up after tests.
 * Uses direct database access for setup/teardown, while tests use API calls.
 */

import { db } from '@glapi/database';
import {
  customers,
  vendors,
  items,
  organizations,
  departments,
  locations,
  classes,
  subsidiaries,
  employees,
  contacts,
  leads,
  prospects,
  warehouses,
  priceLists,
  itemCategories,
  unitsOfMeasure,
  glAccounts,
} from '@glapi/database/schema';
import { eq, and, like, inArray } from 'drizzle-orm';

// Test data prefix to identify test-created data
export const TEST_DATA_PREFIX = 'E2E_TEST_';

// Default test organization ID (should match TEST_CONFIG in api-client.ts)
export const TEST_ORGANIZATION_ID = 'ba3b8cdf-efc1-4a60-88be-ac203d263fe2';

/**
 * Generate a unique test identifier
 */
export function testId(prefix = 'E2E_TEST'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
}

/**
 * Base test data factory interface
 */
interface TestDataFactory<T> {
  create(overrides?: Partial<T>): Promise<T>;
  createMany(count: number, overrides?: Partial<T>): Promise<T[]>;
  cleanup(): Promise<void>;
}

/**
 * Tracked entities for cleanup
 */
const trackedEntities: Map<string, string[]> = new Map();

function trackEntity(type: string, id: string): void {
  const existing = trackedEntities.get(type) || [];
  existing.push(id);
  trackedEntities.set(type, existing);
}

/**
 * Customer test data factory
 */
export const customerFactory = {
  async create(overrides: Partial<{
    companyName: string;
    contactEmail: string;
    contactPhone: string;
    status: string;
    organizationId: string;
  }> = {}) {
    const data = {
      companyName: overrides.companyName || `${TEST_DATA_PREFIX}Customer_${testId()}`,
      contactEmail: overrides.contactEmail || `test-${testId()}@example.com`,
      contactPhone: overrides.contactPhone || '555-0100',
      status: overrides.status || 'active',
      organizationId: overrides.organizationId || TEST_ORGANIZATION_ID,
    };

    const [customer] = await db.insert(customers).values(data).returning();
    trackEntity('customer', customer.id);
    return customer;
  },

  async createMany(count: number, overrides = {}) {
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(await this.create({
        ...overrides,
        companyName: `${TEST_DATA_PREFIX}Customer_${i + 1}_${testId()}`,
      }));
    }
    return results;
  },

  async cleanup() {
    await db.delete(customers)
      .where(like(customers.companyName, `${TEST_DATA_PREFIX}%`));
  },
};

/**
 * Vendor test data factory
 */
export const vendorFactory = {
  async create(overrides: Partial<{
    companyName: string;
    contactEmail: string;
    status: string;
    organizationId: string;
  }> = {}) {
    const data = {
      companyName: overrides.companyName || `${TEST_DATA_PREFIX}Vendor_${testId()}`,
      contactEmail: overrides.contactEmail || `vendor-${testId()}@example.com`,
      status: overrides.status || 'active',
      organizationId: overrides.organizationId || TEST_ORGANIZATION_ID,
    };

    const [vendor] = await db.insert(vendors).values(data).returning();
    trackEntity('vendor', vendor.id);
    return vendor;
  },

  async createMany(count: number, overrides = {}) {
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(await this.create({
        ...overrides,
        companyName: `${TEST_DATA_PREFIX}Vendor_${i + 1}_${testId()}`,
      }));
    }
    return results;
  },

  async cleanup() {
    await db.delete(vendors)
      .where(like(vendors.companyName, `${TEST_DATA_PREFIX}%`));
  },
};

/**
 * Item test data factory
 */
export const itemFactory = {
  async create(overrides: Partial<{
    name: string;
    sku: string;
    description: string;
    status: string;
    organizationId: string;
  }> = {}) {
    const id = testId();
    const data = {
      name: overrides.name || `${TEST_DATA_PREFIX}Item_${id}`,
      sku: overrides.sku || `SKU-${id}`,
      description: overrides.description || 'Test item for E2E testing',
      status: overrides.status || 'active',
      organizationId: overrides.organizationId || TEST_ORGANIZATION_ID,
    };

    const [item] = await db.insert(items).values(data).returning();
    trackEntity('item', item.id);
    return item;
  },

  async createMany(count: number, overrides = {}) {
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(await this.create({
        ...overrides,
        name: `${TEST_DATA_PREFIX}Item_${i + 1}_${testId()}`,
      }));
    }
    return results;
  },

  async cleanup() {
    await db.delete(items)
      .where(like(items.name, `${TEST_DATA_PREFIX}%`));
  },
};

/**
 * Department test data factory
 */
export const departmentFactory = {
  async create(overrides: Partial<{
    name: string;
    code: string;
    status: string;
    organizationId: string;
  }> = {}) {
    const id = testId();
    const data = {
      name: overrides.name || `${TEST_DATA_PREFIX}Dept_${id}`,
      code: overrides.code || `DEPT-${id.slice(-6)}`,
      status: overrides.status || 'active',
      organizationId: overrides.organizationId || TEST_ORGANIZATION_ID,
    };

    const [dept] = await db.insert(departments).values(data).returning();
    trackEntity('department', dept.id);
    return dept;
  },

  async cleanup() {
    await db.delete(departments)
      .where(like(departments.name, `${TEST_DATA_PREFIX}%`));
  },
};

/**
 * Location test data factory
 */
export const locationFactory = {
  async create(overrides: Partial<{
    name: string;
    code: string;
    status: string;
    organizationId: string;
  }> = {}) {
    const id = testId();
    const data = {
      name: overrides.name || `${TEST_DATA_PREFIX}Location_${id}`,
      code: overrides.code || `LOC-${id.slice(-6)}`,
      status: overrides.status || 'active',
      organizationId: overrides.organizationId || TEST_ORGANIZATION_ID,
    };

    const [location] = await db.insert(locations).values(data).returning();
    trackEntity('location', location.id);
    return location;
  },

  async cleanup() {
    await db.delete(locations)
      .where(like(locations.name, `${TEST_DATA_PREFIX}%`));
  },
};

/**
 * Class test data factory
 */
export const classFactory = {
  async create(overrides: Partial<{
    name: string;
    code: string;
    status: string;
    organizationId: string;
  }> = {}) {
    const id = testId();
    const data = {
      name: overrides.name || `${TEST_DATA_PREFIX}Class_${id}`,
      code: overrides.code || `CLS-${id.slice(-6)}`,
      status: overrides.status || 'active',
      organizationId: overrides.organizationId || TEST_ORGANIZATION_ID,
    };

    const [cls] = await db.insert(classes).values(data).returning();
    trackEntity('class', cls.id);
    return cls;
  },

  async cleanup() {
    await db.delete(classes)
      .where(like(classes.name, `${TEST_DATA_PREFIX}%`));
  },
};

/**
 * Subsidiary test data factory
 */
export const subsidiaryFactory = {
  async create(overrides: Partial<{
    name: string;
    code: string;
    status: string;
    organizationId: string;
  }> = {}) {
    const id = testId();
    const data = {
      name: overrides.name || `${TEST_DATA_PREFIX}Subsidiary_${id}`,
      code: overrides.code || `SUB-${id.slice(-6)}`,
      status: overrides.status || 'active',
      organizationId: overrides.organizationId || TEST_ORGANIZATION_ID,
    };

    const [subsidiary] = await db.insert(subsidiaries).values(data).returning();
    trackEntity('subsidiary', subsidiary.id);
    return subsidiary;
  },

  async cleanup() {
    await db.delete(subsidiaries)
      .where(like(subsidiaries.name, `${TEST_DATA_PREFIX}%`));
  },
};

/**
 * Warehouse test data factory
 */
export const warehouseFactory = {
  async create(overrides: Partial<{
    name: string;
    code: string;
    status: string;
    organizationId: string;
  }> = {}) {
    const id = testId();
    const data = {
      name: overrides.name || `${TEST_DATA_PREFIX}Warehouse_${id}`,
      code: overrides.code || `WH-${id.slice(-6)}`,
      status: overrides.status || 'active',
      organizationId: overrides.organizationId || TEST_ORGANIZATION_ID,
    };

    const [warehouse] = await db.insert(warehouses).values(data).returning();
    trackEntity('warehouse', warehouse.id);
    return warehouse;
  },

  async cleanup() {
    await db.delete(warehouses)
      .where(like(warehouses.name, `${TEST_DATA_PREFIX}%`));
  },
};

/**
 * Clean up all test data created during tests
 * Should be called in global teardown or afterAll hooks
 */
export async function cleanupAllTestData(): Promise<void> {
  console.log('Cleaning up E2E test data...');

  // Clean up in reverse order of dependencies
  const cleanupOrder = [
    // Transactions first (they reference other entities)
    // Then relationships
    customerFactory,
    vendorFactory,
    itemFactory,
    // Then accounting dimensions
    departmentFactory,
    locationFactory,
    classFactory,
    subsidiaryFactory,
    warehouseFactory,
  ];

  for (const factory of cleanupOrder) {
    try {
      await factory.cleanup();
    } catch (error) {
      console.warn(`Cleanup warning for ${factory.constructor.name}:`, error);
    }
  }

  // Clear tracked entities
  trackedEntities.clear();

  console.log('E2E test data cleanup complete');
}

/**
 * Clean up specific tracked entities (for test isolation)
 */
export async function cleanupTrackedEntities(): Promise<void> {
  for (const [type, ids] of trackedEntities) {
    if (ids.length === 0) continue;

    try {
      switch (type) {
        case 'customer':
          await db.delete(customers).where(inArray(customers.id, ids));
          break;
        case 'vendor':
          await db.delete(vendors).where(inArray(vendors.id, ids));
          break;
        case 'item':
          await db.delete(items).where(inArray(items.id, ids));
          break;
        case 'department':
          await db.delete(departments).where(inArray(departments.id, ids));
          break;
        case 'location':
          await db.delete(locations).where(inArray(locations.id, ids));
          break;
        case 'class':
          await db.delete(classes).where(inArray(classes.id, ids));
          break;
        case 'subsidiary':
          await db.delete(subsidiaries).where(inArray(subsidiaries.id, ids));
          break;
        case 'warehouse':
          await db.delete(warehouses).where(inArray(warehouses.id, ids));
          break;
      }
    } catch (error) {
      console.warn(`Failed to cleanup ${type}:`, error);
    }
  }

  trackedEntities.clear();
}

/**
 * Seed minimal test data for smoke tests
 */
export async function seedSmokeTestData(): Promise<{
  customer: Awaited<ReturnType<typeof customerFactory.create>>;
  vendor: Awaited<ReturnType<typeof vendorFactory.create>>;
  item: Awaited<ReturnType<typeof itemFactory.create>>;
}> {
  console.log('Seeding smoke test data...');

  const customer = await customerFactory.create({
    companyName: `${TEST_DATA_PREFIX}Smoke_Customer`,
  });
  const vendor = await vendorFactory.create({
    companyName: `${TEST_DATA_PREFIX}Smoke_Vendor`,
  });
  const item = await itemFactory.create({
    name: `${TEST_DATA_PREFIX}Smoke_Item`,
  });

  console.log('Smoke test data seeded');

  return { customer, vendor, item };
}

/**
 * Check database connectivity
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    // Simple query to verify connection
    await db.execute('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
}
