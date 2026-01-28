/**
 * RLS Isolation Test - Price Lists Table
 *
 * Verifies that Row Level Security properly isolates price list data
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

test.describe('Price Lists Table RLS Isolation', () => {
  let clientOrgA: ReturnType<typeof createTestTRPCClient>;
  let clientOrgB: ReturnType<typeof createTestTRPCClient>;
  let createdPriceListId: string | null = null;

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
    if (createdPriceListId) {
      try {
        await clientOrgA.priceLists.delete.mutate({ id: createdPriceListId });
      } catch (error) {
        console.log(`Cleanup: Price List ${createdPriceListId} already deleted or not found`);
      }
    }
  });

  test('Org A can create price list and Org B cannot see it', async () => {
    const code = `RLS-PL-${Date.now()}`;
    const name = `RLS-Test-PriceList-${testId()}`;
    const created = await clientOrgA.priceLists.create.mutate({
      code,
      name,
    });

    expect(created).toBeDefined();
    expect(created.id).toBeDefined();
    createdPriceListId = created.id;

    // Org A can retrieve their own price list
    const orgAPriceList = await clientOrgA.priceLists.get.query({ id: created.id });
    expect(orgAPriceList).toBeDefined();
    expect(orgAPriceList.name).toBe(name);

    // Org B cannot see Org A's price list
    await expect(
      clientOrgB.priceLists.get.query({ id: created.id })
    ).rejects.toThrow();
  });

  test('Org B cannot list Org A price lists', async () => {
    if (!createdPriceListId) {
      const created = await clientOrgA.priceLists.create.mutate({
        code: `RLS-PL-L-${Date.now()}`,
        name: `RLS-Test-PriceList-List-${testId()}`,
      });
      createdPriceListId = created.id;
    }

    // Org A should see their price list in the list
    const orgAList = await clientOrgA.priceLists.list.query({ limit: 100 });
    const orgAPriceListInList = orgAList.data.find(pl => pl.id === createdPriceListId);
    expect(orgAPriceListInList).toBeDefined();

    // Org B should NOT see Org A's price list in their list
    const orgBList = await clientOrgB.priceLists.list.query({ limit: 100 });
    const orgBPriceListInList = orgBList.data.find(pl => pl.id === createdPriceListId);
    expect(orgBPriceListInList).toBeUndefined();
  });

  test('Org B cannot update Org A price list', async () => {
    if (!createdPriceListId) {
      const created = await clientOrgA.priceLists.create.mutate({
        code: `RLS-PL-U-${Date.now()}`,
        name: `RLS-Test-PriceList-Update-${testId()}`,
      });
      createdPriceListId = created.id;
    }

    // Org B should NOT be able to update Org A's price list
    await expect(
      clientOrgB.priceLists.update.mutate({
        id: createdPriceListId,
        data: { name: 'Hacked Name' },
      })
    ).rejects.toThrow();

    // Verify name was NOT changed
    const orgAPriceList = await clientOrgA.priceLists.get.query({ id: createdPriceListId });
    expect(orgAPriceList.name).not.toBe('Hacked Name');
  });

  test('Org B cannot delete Org A price list', async () => {
    const created = await clientOrgA.priceLists.create.mutate({
      code: `RLS-PL-D-${Date.now()}`,
      name: `RLS-Test-PriceList-Delete-${testId()}`,
    });

    // Org B should NOT be able to delete Org A's price list
    await expect(
      clientOrgB.priceLists.delete.mutate({ id: created.id })
    ).rejects.toThrow();

    // Verify price list still exists for Org A
    const orgAPriceList = await clientOrgA.priceLists.get.query({ id: created.id });
    expect(orgAPriceList).toBeDefined();

    // Clean up
    await clientOrgA.priceLists.delete.mutate({ id: created.id });
  });

  test('Each organization only sees their own price lists', async () => {
    const orgAPriceListName = `RLS-OrgA-PriceList-${testId()}`;
    const orgBPriceListName = `RLS-OrgB-PriceList-${testId()}`;

    const orgACreated = await clientOrgA.priceLists.create.mutate({
      code: `RLS-PL-A-${Date.now()}`,
      name: orgAPriceListName,
    });

    const orgBCreated = await clientOrgB.priceLists.create.mutate({
      code: `RLS-PL-B-${Date.now()}`,
      name: orgBPriceListName,
    });

    try {
      // Org A list should contain their price list but not Org B's
      const orgAList = await clientOrgA.priceLists.list.query({ limit: 100 });
      expect(orgAList.data.some(pl => pl.id === orgACreated.id)).toBe(true);
      expect(orgAList.data.some(pl => pl.id === orgBCreated.id)).toBe(false);

      // Org B list should contain their price list but not Org A's
      const orgBList = await clientOrgB.priceLists.list.query({ limit: 100 });
      expect(orgBList.data.some(pl => pl.id === orgBCreated.id)).toBe(true);
      expect(orgBList.data.some(pl => pl.id === orgACreated.id)).toBe(false);
    } finally {
      await clientOrgA.priceLists.delete.mutate({ id: orgACreated.id });
      await clientOrgB.priceLists.delete.mutate({ id: orgBCreated.id });
    }
  });
});
