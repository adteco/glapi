/**
 * RLS Isolation Test - Warehouses Table
 *
 * Verifies that Row Level Security properly isolates warehouse data
 * between organizations.
 */

import { test, expect } from '@playwright/test';
import {
  createTestTRPCClient,
  testId,
  waitForApi,
  TEST_CONFIG,
} from '../helpers/api-client';

const ORG_B_CONFIG = {
  organizationId: '456c2475-2277-4d90-929b-ae694a2a8577',
  userId: 'api-key-user',
  apiKey: 'glapi_test_sk_orgb_0987654321fedcba',
};

test.describe('Warehouses Table RLS Isolation', () => {
  let clientOrgA: ReturnType<typeof createTestTRPCClient>;
  let clientOrgB: ReturnType<typeof createTestTRPCClient>;
  let createdWarehouseId: string | null = null;

  test.beforeAll(async () => {
    const apiReady = await waitForApi(10, 2000);
    if (!apiReady) {
      console.warn('API not available, tests may fail');
    }

    clientOrgA = createTestTRPCClient();
    clientOrgB = createTestTRPCClient({
      organizationId: ORG_B_CONFIG.organizationId,
      userId: ORG_B_CONFIG.userId,
      apiKey: ORG_B_CONFIG.apiKey,
    });
  });

  test.afterAll(async () => {
    if (createdWarehouseId) {
      try {
        await clientOrgA.warehouses.delete.mutate({ id: createdWarehouseId });
      } catch (error) {
        console.log(`Cleanup: Warehouse ${createdWarehouseId} already deleted or not found`);
      }
    }
  });

  test('Org A can create warehouse and Org B cannot see it', async () => {
    const warehouseId = `RLS-WH-${Date.now()}`;
    const warehouseName = `RLS-Test-Warehouse-${testId()}`;
    const created = await clientOrgA.warehouses.create.mutate({
      warehouseId,
      name: warehouseName,
    });

    expect(created).toBeDefined();
    expect(created.id).toBeDefined();
    createdWarehouseId = created.id;

    // Org A can retrieve their own warehouse
    const orgAWarehouse = await clientOrgA.warehouses.get.query({ id: created.id });
    expect(orgAWarehouse).toBeDefined();
    expect(orgAWarehouse.name).toBe(warehouseName);

    // Org B cannot see Org A's warehouse
    await expect(
      clientOrgB.warehouses.get.query({ id: created.id })
    ).rejects.toThrow();
  });

  test('Org B cannot list Org A warehouses', async () => {
    if (!createdWarehouseId) {
      const created = await clientOrgA.warehouses.create.mutate({
        warehouseId: `RLS-WH-L-${Date.now()}`,
        name: `RLS-Test-Warehouse-List-${testId()}`,
      });
      createdWarehouseId = created.id;
    }

    // Org A should see their warehouse in the list
    const orgAList = await clientOrgA.warehouses.list.query({ limit: 100 });
    const orgAWarehouseInList = orgAList.data.find(w => w.id === createdWarehouseId);
    expect(orgAWarehouseInList).toBeDefined();

    // Org B should NOT see Org A's warehouse in their list
    const orgBList = await clientOrgB.warehouses.list.query({ limit: 100 });
    const orgBWarehouseInList = orgBList.data.find(w => w.id === createdWarehouseId);
    expect(orgBWarehouseInList).toBeUndefined();
  });

  test('Org B cannot update Org A warehouse', async () => {
    if (!createdWarehouseId) {
      const created = await clientOrgA.warehouses.create.mutate({
        warehouseId: `RLS-WH-U-${Date.now()}`,
        name: `RLS-Test-Warehouse-Update-${testId()}`,
      });
      createdWarehouseId = created.id;
    }

    // Org B should NOT be able to update Org A's warehouse
    await expect(
      clientOrgB.warehouses.update.mutate({
        id: createdWarehouseId,
        data: { name: 'Hacked Name' },
      })
    ).rejects.toThrow();

    // Verify name was NOT changed
    const orgAWarehouse = await clientOrgA.warehouses.get.query({ id: createdWarehouseId });
    expect(orgAWarehouse.name).not.toBe('Hacked Name');
  });

  test('Org B cannot delete Org A warehouse', async () => {
    const created = await clientOrgA.warehouses.create.mutate({
      warehouseId: `RLS-WH-D-${Date.now()}`,
      name: `RLS-Test-Warehouse-Delete-${testId()}`,
    });

    // Org B should NOT be able to delete Org A's warehouse
    await expect(
      clientOrgB.warehouses.delete.mutate({ id: created.id })
    ).rejects.toThrow();

    // Verify warehouse still exists for Org A
    const orgAWarehouse = await clientOrgA.warehouses.get.query({ id: created.id });
    expect(orgAWarehouse).toBeDefined();

    // Clean up
    await clientOrgA.warehouses.delete.mutate({ id: created.id });
  });

  test('Each organization only sees their own warehouses', async () => {
    const orgAWarehouseName = `RLS-OrgA-Warehouse-${testId()}`;
    const orgBWarehouseName = `RLS-OrgB-Warehouse-${testId()}`;

    const orgACreated = await clientOrgA.warehouses.create.mutate({
      warehouseId: `RLS-WH-A-${Date.now()}`,
      name: orgAWarehouseName,
    });

    const orgBCreated = await clientOrgB.warehouses.create.mutate({
      warehouseId: `RLS-WH-B-${Date.now()}`,
      name: orgBWarehouseName,
    });

    try {
      // Org A list should contain their warehouse but not Org B's
      const orgAList = await clientOrgA.warehouses.list.query({ limit: 100 });
      expect(orgAList.data.some(w => w.id === orgACreated.id)).toBe(true);
      expect(orgAList.data.some(w => w.id === orgBCreated.id)).toBe(false);

      // Org B list should contain their warehouse but not Org A's
      const orgBList = await clientOrgB.warehouses.list.query({ limit: 100 });
      expect(orgBList.data.some(w => w.id === orgBCreated.id)).toBe(true);
      expect(orgBList.data.some(w => w.id === orgACreated.id)).toBe(false);
    } finally {
      await clientOrgA.warehouses.delete.mutate({ id: orgACreated.id });
      await clientOrgB.warehouses.delete.mutate({ id: orgBCreated.id });
    }
  });
});
