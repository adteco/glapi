/**
 * Subsidiaries TRPC Router API Tests
 *
 * Tests all procedures in the subsidiaries router:
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
  waitForApi,
  testId,
  TEST_CONFIG,
} from '../helpers/api-client';

const subsidiaryScenarios = {
  minimal: () => ({
    name: `Subsidiary ${testId()}`,
  }),
  complete: () => ({
    name: `Full Subsidiary ${testId()}`,
    code: `SUB-${testId().slice(-6)}`,
    legalName: `Subsidiary Legal Name ${testId()}`,
    country: 'US',
    currency: 'USD',
    status: 'active' as const,
  }),
  inactive: () => ({
    name: `Inactive Subsidiary ${testId()}`,
    status: 'inactive' as const,
  }),
};

test.describe('Subsidiaries TRPC Router', () => {
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

  test.describe('subsidiaries.list', () => {
    test('should return array of subsidiaries', async () => {
      const result = await client.subsidiaries.list.query({});
      expect(Array.isArray(result)).toBe(true);
    });

    test('should return subsidiaries with expected fields', async () => {
      const created = await client.subsidiaries.create.mutate(subsidiaryScenarios.complete());
      cleanup.track('subsidiary', created.id);

      const result = await client.subsidiaries.list.query({});
      const subsidiary = result.find(s => s.id === created.id);

      expect(subsidiary).toBeDefined();
      expect(subsidiary).toHaveProperty('id');
      expect(subsidiary).toHaveProperty('name');
      expect(subsidiary).toHaveProperty('organizationId');
    });
  });

  test.describe('subsidiaries.get', () => {
    test('should get subsidiary by valid UUID', async () => {
      const subData = subsidiaryScenarios.complete();
      const created = await client.subsidiaries.create.mutate(subData);
      cleanup.track('subsidiary', created.id);

      const result = await client.subsidiaries.get.query({ id: created.id });

      expect(result).toBeDefined();
      expect(result.id).toBe(created.id);
      expect(result.name).toBe(subData.name);
    });

    test('should throw NOT_FOUND for non-existent UUID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.subsidiaries.get.query({ id: fakeId })
      ).rejects.toThrow();
    });
  });

  test.describe('subsidiaries.create', () => {
    test('should create subsidiary with minimal data', async () => {
      const subData = subsidiaryScenarios.minimal();
      const result = await client.subsidiaries.create.mutate(subData);
      cleanup.track('subsidiary', result.id);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe(subData.name);
      expect(result.organizationId).toBe(TEST_CONFIG.organizationId);
    });

    test('should create subsidiary with complete data', async () => {
      const subData = subsidiaryScenarios.complete();
      const result = await client.subsidiaries.create.mutate(subData);
      cleanup.track('subsidiary', result.id);

      expect(result.name).toBe(subData.name);
      expect(result.code).toBe(subData.code);
      expect(result.country).toBe(subData.country);
    });

    test('should reject empty name', async () => {
      await expect(
        client.subsidiaries.create.mutate({ name: '' })
      ).rejects.toThrow();
    });
  });

  test.describe('subsidiaries.update', () => {
    test('should update subsidiary name', async () => {
      const created = await client.subsidiaries.create.mutate(subsidiaryScenarios.minimal());
      cleanup.track('subsidiary', created.id);

      const newName = `Updated Subsidiary ${testId()}`;
      const updated = await client.subsidiaries.update.mutate({
        id: created.id,
        data: { name: newName },
      });

      expect(updated.name).toBe(newName);
    });

    test('should update subsidiary code and country', async () => {
      const created = await client.subsidiaries.create.mutate(subsidiaryScenarios.complete());
      cleanup.track('subsidiary', created.id);

      const newCode = `NEW-${testId().slice(-6)}`;
      const updated = await client.subsidiaries.update.mutate({
        id: created.id,
        data: { code: newCode, country: 'CA' },
      });

      expect(updated.code).toBe(newCode);
      expect(updated.country).toBe('CA');
    });

    test('should throw NOT_FOUND for non-existent subsidiary', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.subsidiaries.update.mutate({
          id: fakeId,
          data: { name: 'New Name' },
        })
      ).rejects.toThrow();
    });
  });

  test.describe('subsidiaries.delete', () => {
    test('should delete subsidiary successfully', async () => {
      const created = await client.subsidiaries.create.mutate(subsidiaryScenarios.minimal());

      const result = await client.subsidiaries.delete.mutate({ id: created.id });
      expect(result).toEqual({ success: true });

      await expect(
        client.subsidiaries.get.query({ id: created.id })
      ).rejects.toThrow();
    });

    test('should throw NOT_FOUND for non-existent subsidiary', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.subsidiaries.delete.mutate({ id: fakeId })
      ).rejects.toThrow();
    });
  });
});
