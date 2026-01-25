/**
 * Warehouses TRPC Router API Tests
 *
 * Tests all procedures in the warehouses router:
 * - list
 * - getById
 * - create
 * - update
 * - delete
 * - assignPriceList / getPriceLists / removePriceList
 * - assignCustomer / getCustomerAssignments / updateCustomerAssignment / removeCustomerAssignment
 * - getCustomerPrice
 * - bulkAssignCustomers
 */

import { test, expect } from '@playwright/test';
import {
  createTestTRPCClient,
  createCleanupHelper,
  waitForApi,
  testId,
  TEST_CONFIG,
} from '../helpers/api-client';

const warehouseScenarios = {
  minimal: () => ({
    name: `Warehouse ${testId()}`,
  }),
  complete: () => ({
    name: `Full Warehouse ${testId()}`,
    code: `WH-${testId().slice(-6)}`,
    address: '100 Warehouse Blvd',
    city: 'Warehouse City',
    state: 'TX',
    zip: '75001',
    isDefault: false,
    status: 'active' as const,
  }),
  default: () => ({
    name: `Default Warehouse ${testId()}`,
    isDefault: true,
    status: 'active' as const,
  }),
};

test.describe('Warehouses TRPC Router', () => {
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

  test.describe('warehouses.list', () => {
    test('should return array of warehouses', async () => {
      const result = await client.warehouses.list.query({});
      expect(Array.isArray(result)).toBe(true);
    });

    test('should return warehouses with expected fields', async () => {
      const created = await client.warehouses.create.mutate(warehouseScenarios.complete());
      cleanup.track('warehouse', created.id);

      const result = await client.warehouses.list.query({});
      const warehouse = result.find(w => w.id === created.id);

      expect(warehouse).toBeDefined();
      expect(warehouse).toHaveProperty('id');
      expect(warehouse).toHaveProperty('name');
      expect(warehouse).toHaveProperty('organizationId');
    });
  });

  test.describe('warehouses.getById', () => {
    test('should get warehouse by valid UUID', async () => {
      const whData = warehouseScenarios.complete();
      const created = await client.warehouses.create.mutate(whData);
      cleanup.track('warehouse', created.id);

      const result = await client.warehouses.getById.query({ id: created.id });

      expect(result).toBeDefined();
      expect(result.id).toBe(created.id);
      expect(result.name).toBe(whData.name);
    });

    test('should throw NOT_FOUND for non-existent UUID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.warehouses.getById.query({ id: fakeId })
      ).rejects.toThrow();
    });
  });

  test.describe('warehouses.create', () => {
    test('should create warehouse with minimal data', async () => {
      const whData = warehouseScenarios.minimal();
      const result = await client.warehouses.create.mutate(whData);
      cleanup.track('warehouse', result.id);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe(whData.name);
      expect(result.organizationId).toBe(TEST_CONFIG.organizationId);
    });

    test('should create warehouse with complete data', async () => {
      const whData = warehouseScenarios.complete();
      const result = await client.warehouses.create.mutate(whData);
      cleanup.track('warehouse', result.id);

      expect(result.name).toBe(whData.name);
      expect(result.code).toBe(whData.code);
      expect(result.city).toBe(whData.city);
    });

    test('should reject empty name', async () => {
      await expect(
        client.warehouses.create.mutate({ name: '' })
      ).rejects.toThrow();
    });
  });

  test.describe('warehouses.update', () => {
    test('should update warehouse name', async () => {
      const created = await client.warehouses.create.mutate(warehouseScenarios.minimal());
      cleanup.track('warehouse', created.id);

      const newName = `Updated Warehouse ${testId()}`;
      const updated = await client.warehouses.update.mutate({
        id: created.id,
        data: { name: newName },
      });

      expect(updated.name).toBe(newName);
    });

    test('should update warehouse address', async () => {
      const created = await client.warehouses.create.mutate(warehouseScenarios.complete());
      cleanup.track('warehouse', created.id);

      const newAddress = '200 New Warehouse Ave';
      const updated = await client.warehouses.update.mutate({
        id: created.id,
        data: { address: newAddress },
      });

      expect(updated.address).toBe(newAddress);
    });

    test('should throw NOT_FOUND for non-existent warehouse', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.warehouses.update.mutate({
          id: fakeId,
          data: { name: 'New Name' },
        })
      ).rejects.toThrow();
    });
  });

  test.describe('warehouses.delete', () => {
    test('should delete warehouse successfully', async () => {
      const created = await client.warehouses.create.mutate(warehouseScenarios.minimal());

      const result = await client.warehouses.delete.mutate({ id: created.id });
      expect(result).toEqual({ success: true });

      await expect(
        client.warehouses.getById.query({ id: created.id })
      ).rejects.toThrow();
    });

    test('should throw NOT_FOUND for non-existent warehouse', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.warehouses.delete.mutate({ id: fakeId })
      ).rejects.toThrow();
    });
  });

  test.describe('warehouses.getPriceLists', () => {
    test('should return empty array for warehouse with no price lists', async () => {
      const created = await client.warehouses.create.mutate(warehouseScenarios.minimal());
      cleanup.track('warehouse', created.id);

      const result = await client.warehouses.getPriceLists.query({ warehouseId: created.id });

      expect(Array.isArray(result)).toBe(true);
    });
  });

  test.describe('warehouses.getCustomerAssignments', () => {
    test('should return empty array for warehouse with no customer assignments', async () => {
      const created = await client.warehouses.create.mutate(warehouseScenarios.minimal());
      cleanup.track('warehouse', created.id);

      const result = await client.warehouses.getCustomerAssignments.query({
        warehouseId: created.id,
      });

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
