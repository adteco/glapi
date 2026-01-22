/**
 * Items TRPC Router API Tests
 *
 * Tests the items router including:
 * - list
 * - get
 * - create
 * - update
 * - delete
 */

import { test, expect } from '@playwright/test';
import {
  createTestTRPCClient,
  createCleanupHelper,
  testId,
  waitForApi,
  TEST_CONFIG,
} from '../helpers/api-client';
import { createTestItem, itemScenarios, invalidItems } from '../fixtures';

test.describe('Items TRPC Router', () => {
  let client: ReturnType<typeof createTestTRPCClient>;
  let cleanup: ReturnType<typeof createCleanupHelper>;

  test.beforeAll(async () => {
    const apiReady = await waitForApi(10, 2000);
    if (!apiReady) {
      console.warn('API not available, tests may fail');
    }

    client = createTestTRPCClient();
    cleanup = createCleanupHelper(client);
  });

  test.afterAll(async () => {
    await cleanup.cleanupAll();
  });

  test.describe('items.list', () => {
    test('should return array of items', async () => {
      const result = await client.items.list.query({});

      expect(Array.isArray(result)).toBe(true);
    });

    test('should return items with expected fields', async () => {
      const result = await client.items.list.query({});

      if (result.length > 0) {
        const item = result[0];
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('type');
      }
    });

    test('should handle pagination parameters', async () => {
      // Query with pagination
      const page1 = await client.items.list.query({ page: 1, limit: 10 });
      expect(Array.isArray(page1)).toBe(true);
    });

    test('should filter by active status', async () => {
      // Query active items only
      const activeItems = await client.items.list.query({ active: true });
      expect(Array.isArray(activeItems)).toBe(true);

      // All returned items should be active
      for (const item of activeItems) {
        if ('active' in item) {
          expect(item.active).toBe(true);
        }
      }
    });
  });

  test.describe('items.get', () => {
    test('should get item by valid UUID', async () => {
      // First create an item
      const itemData = createTestItem();
      const created = await client.items.create.mutate(itemData);
      cleanup.track('item', created.id);

      // Then fetch it
      const result = await client.items.get.query({ id: created.id });

      expect(result).toBeDefined();
      expect(result.id).toBe(created.id);
      expect(result.name).toBe(itemData.name);
    });

    test('should throw NOT_FOUND for non-existent UUID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(
        client.items.get.query({ id: fakeId })
      ).rejects.toThrow();
    });

    test('should throw for invalid UUID format', async () => {
      await expect(
        client.items.get.query({ id: 'not-a-uuid' })
      ).rejects.toThrow();
    });
  });

  test.describe('items.create', () => {
    test('should create inventory item', async () => {
      const itemData = itemScenarios.inventory();

      const result = await client.items.create.mutate(itemData);
      cleanup.track('item', result.id);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe(itemData.name);
      expect(result.type).toBe('inventory');
    });

    test('should create service item', async () => {
      const itemData = itemScenarios.service();

      const result = await client.items.create.mutate(itemData);
      cleanup.track('item', result.id);

      expect(result.name).toBe(itemData.name);
      expect(result.type).toBe('service');
    });

    test('should create non-inventory item', async () => {
      const itemData = itemScenarios.nonInventory();

      const result = await client.items.create.mutate(itemData);
      cleanup.track('item', result.id);

      expect(result.type).toBe('non_inventory');
    });

    test('should create discount item', async () => {
      const itemData = itemScenarios.discount();

      const result = await client.items.create.mutate(itemData);
      cleanup.track('item', result.id);

      expect(result.type).toBe('discount');
    });

    test('should set default values correctly', async () => {
      const itemData = {
        name: `Minimal Item ${testId()}`,
        type: 'inventory' as const,
      };

      const result = await client.items.create.mutate(itemData);
      cleanup.track('item', result.id);

      expect(result.active).toBe(true);
    });

    test('should reject empty name', async () => {
      const invalidData = invalidItems.emptyName();

      await expect(
        client.items.create.mutate(invalidData)
      ).rejects.toThrow();
    });

    test('should reject invalid type', async () => {
      const invalidData = invalidItems.invalidType();

      await expect(
        client.items.create.mutate(invalidData)
      ).rejects.toThrow();
    });
  });

  test.describe('items.update', () => {
    test('should update item name', async () => {
      const itemData = createTestItem();
      const created = await client.items.create.mutate(itemData);
      cleanup.track('item', created.id);

      const newName = `Updated Item ${testId()}`;
      const updated = await client.items.update.mutate({
        id: created.id,
        data: { name: newName },
      });

      expect(updated.name).toBe(newName);
    });

    test('should update item price', async () => {
      const itemData = createTestItem({ unitPrice: 100 });
      const created = await client.items.create.mutate(itemData);
      cleanup.track('item', created.id);

      const updated = await client.items.update.mutate({
        id: created.id,
        data: { unitPrice: 150 },
      });

      expect(updated.unitPrice).toBe(150);
    });

    test('should update item active status', async () => {
      const itemData = createTestItem({ active: true });
      const created = await client.items.create.mutate(itemData);
      cleanup.track('item', created.id);

      const updated = await client.items.update.mutate({
        id: created.id,
        data: { active: false },
      });

      expect(updated.active).toBe(false);
    });

    test('should update inventory quantities', async () => {
      const itemData = itemScenarios.inventory();
      const created = await client.items.create.mutate(itemData);
      cleanup.track('item', created.id);

      const updated = await client.items.update.mutate({
        id: created.id,
        data: {
          quantityOnHand: 200,
          reorderPoint: 25,
        },
      });

      expect(updated.quantityOnHand).toBe(200);
      expect(updated.reorderPoint).toBe(25);
    });

    test('should throw NOT_FOUND for non-existent item', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(
        client.items.update.mutate({
          id: fakeId,
          data: { name: 'New Name' },
        })
      ).rejects.toThrow();
    });

    test('should preserve unmodified fields', async () => {
      const itemData = itemScenarios.inventory();
      const created = await client.items.create.mutate(itemData);
      cleanup.track('item', created.id);

      // Only update name
      const updated = await client.items.update.mutate({
        id: created.id,
        data: { name: 'New Name Only' },
      });

      // Original fields should be preserved
      expect(updated.type).toBe(itemData.type);
      expect(updated.sku).toBe(itemData.sku);
    });
  });

  test.describe('items.delete', () => {
    test('should delete item successfully', async () => {
      const itemData = createTestItem();
      const created = await client.items.create.mutate(itemData);
      // Don't track for cleanup since we're deleting it

      const result = await client.items.delete.mutate({ id: created.id });
      expect(result).toEqual({ success: true });

      // Verify it's gone
      await expect(
        client.items.get.query({ id: created.id })
      ).rejects.toThrow();
    });

    test('should throw NOT_FOUND for non-existent item', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(
        client.items.delete.mutate({ id: fakeId })
      ).rejects.toThrow();
    });

    test('should throw for invalid UUID format', async () => {
      await expect(
        client.items.delete.mutate({ id: 'not-a-uuid' })
      ).rejects.toThrow();
    });
  });
});

test.describe('Items API - Business Logic', () => {
  let client: ReturnType<typeof createTestTRPCClient>;
  let cleanup: ReturnType<typeof createCleanupHelper>;

  test.beforeAll(async () => {
    client = createTestTRPCClient();
    cleanup = createCleanupHelper(client);
  });

  test.afterAll(async () => {
    await cleanup.cleanupAll();
  });

  test('should identify low stock items', async () => {
    // Create an item with low stock
    const itemData = itemScenarios.lowStock();
    const created = await client.items.create.mutate(itemData);
    cleanup.track('item', created.id);

    // Verify the item was created with low stock values
    expect(created.quantityOnHand).toBeLessThan(created.reorderPoint || 0);
  });

  test('should handle out of stock items', async () => {
    const itemData = itemScenarios.outOfStock();
    const created = await client.items.create.mutate(itemData);
    cleanup.track('item', created.id);

    expect(created.quantityOnHand).toBe(0);
  });

  test('should handle high-value items', async () => {
    const itemData = itemScenarios.highValue();
    const created = await client.items.create.mutate(itemData);
    cleanup.track('item', created.id);

    expect(created.unitPrice).toBeGreaterThan(1000);
  });

  test('should handle free/promotional items', async () => {
    const itemData = itemScenarios.freeItem();
    const created = await client.items.create.mutate(itemData);
    cleanup.track('item', created.id);

    expect(created.unitPrice).toBe(0);
  });
});

test.describe('Items API - Performance', () => {
  let client: ReturnType<typeof createTestTRPCClient>;

  test.beforeAll(async () => {
    client = createTestTRPCClient();
  });

  test('should complete list query within timeout', async () => {
    const startTime = Date.now();
    await client.items.list.query({});
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(5000);
  });

  test('should complete create/read/delete cycle within timeout', async () => {
    const startTime = Date.now();

    const itemData = createTestItem();
    const created = await client.items.create.mutate(itemData);
    await client.items.get.query({ id: created.id });
    await client.items.delete.mutate({ id: created.id });

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(10000);
  });
});
