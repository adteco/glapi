/**
 * Price Lists TRPC Router API Tests
 *
 * Tests key procedures in the price-lists router:
 * - list
 * - getById
 * - create
 * - update
 * - delete
 * - getItems
 * - getItemPrices
 */

import { test, expect } from '@playwright/test';
import {
  createTestTRPCClient,
  createCleanupHelper,
  waitForApi,
  testId,
  TEST_CONFIG,
} from '../helpers/api-client';

const priceListScenarios = {
  minimal: () => ({
    name: `Price List ${testId()}`,
  }),
  complete: () => ({
    name: `Full Price List ${testId()}`,
    code: `PL-${testId().slice(-6)}`,
    description: 'Test price list for E2E testing',
    currency: 'USD',
    isDefault: false,
    effectiveDate: new Date().toISOString(),
    status: 'active' as const,
  }),
  default: () => ({
    name: `Default Price List ${testId()}`,
    isDefault: true,
    status: 'active' as const,
  }),
};

test.describe('Price Lists TRPC Router', () => {
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

  test.describe('priceLists.list', () => {
    test('should return array of price lists', async () => {
      const result = await client.priceLists.list.query({});
      expect(Array.isArray(result)).toBe(true);
    });

    test('should return price lists with expected fields', async () => {
      const created = await client.priceLists.create.mutate(priceListScenarios.complete());
      cleanup.track('priceList', created.id);

      const result = await client.priceLists.list.query({});
      const priceList = result.find(p => p.id === created.id);

      expect(priceList).toBeDefined();
      expect(priceList).toHaveProperty('id');
      expect(priceList).toHaveProperty('name');
      expect(priceList).toHaveProperty('organizationId');
    });
  });

  test.describe('priceLists.getById', () => {
    test('should get price list by valid UUID', async () => {
      const plData = priceListScenarios.complete();
      const created = await client.priceLists.create.mutate(plData);
      cleanup.track('priceList', created.id);

      const result = await client.priceLists.getById.query({ id: created.id });

      expect(result).toBeDefined();
      expect(result.id).toBe(created.id);
      expect(result.name).toBe(plData.name);
    });

    test('should throw NOT_FOUND for non-existent UUID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.priceLists.getById.query({ id: fakeId })
      ).rejects.toThrow();
    });
  });

  test.describe('priceLists.create', () => {
    test('should create price list with minimal data', async () => {
      const plData = priceListScenarios.minimal();
      const result = await client.priceLists.create.mutate(plData);
      cleanup.track('priceList', result.id);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe(plData.name);
      expect(result.organizationId).toBe(TEST_CONFIG.organizationId);
    });

    test('should create price list with complete data', async () => {
      const plData = priceListScenarios.complete();
      const result = await client.priceLists.create.mutate(plData);
      cleanup.track('priceList', result.id);

      expect(result.name).toBe(plData.name);
      expect(result.code).toBe(plData.code);
      expect(result.currency).toBe(plData.currency);
    });

    test('should reject empty name', async () => {
      await expect(
        client.priceLists.create.mutate({ name: '' })
      ).rejects.toThrow();
    });
  });

  test.describe('priceLists.update', () => {
    test('should update price list name', async () => {
      const created = await client.priceLists.create.mutate(priceListScenarios.minimal());
      cleanup.track('priceList', created.id);

      const newName = `Updated Price List ${testId()}`;
      const updated = await client.priceLists.update.mutate({
        id: created.id,
        data: { name: newName },
      });

      expect(updated.name).toBe(newName);
    });

    test('should update price list currency', async () => {
      const created = await client.priceLists.create.mutate(priceListScenarios.complete());
      cleanup.track('priceList', created.id);

      const updated = await client.priceLists.update.mutate({
        id: created.id,
        data: { currency: 'EUR' },
      });

      expect(updated.currency).toBe('EUR');
    });

    test('should throw NOT_FOUND for non-existent price list', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.priceLists.update.mutate({
          id: fakeId,
          data: { name: 'New Name' },
        })
      ).rejects.toThrow();
    });
  });

  test.describe('priceLists.delete', () => {
    test('should delete price list successfully', async () => {
      const created = await client.priceLists.create.mutate(priceListScenarios.minimal());

      const result = await client.priceLists.delete.mutate({ id: created.id });
      expect(result).toEqual({ success: true });

      await expect(
        client.priceLists.getById.query({ id: created.id })
      ).rejects.toThrow();
    });

    test('should throw NOT_FOUND for non-existent price list', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.priceLists.delete.mutate({ id: fakeId })
      ).rejects.toThrow();
    });
  });

  test.describe('priceLists.getItems', () => {
    test('should return items for price list', async () => {
      const created = await client.priceLists.create.mutate(priceListScenarios.minimal());
      cleanup.track('priceList', created.id);

      const result = await client.priceLists.getItems.query({ priceListId: created.id });

      expect(Array.isArray(result)).toBe(true);
    });
  });

  test.describe('priceLists.getItemPrices', () => {
    test('should return item prices for price list', async () => {
      const created = await client.priceLists.create.mutate(priceListScenarios.minimal());
      cleanup.track('priceList', created.id);

      const result = await client.priceLists.getItemPrices.query({ priceListId: created.id });

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
