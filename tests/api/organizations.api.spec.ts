/**
 * Organizations TRPC Router API Tests
 *
 * Tests all procedures in the organizations router:
 * - list
 * - get
 * - getDefault
 * - create
 * - update
 * - lookup
 */

import { test, expect } from '@playwright/test';
import {
  createTestTRPCClient,
  waitForApi,
  testId,
  TEST_CONFIG,
} from '../helpers/api-client';

test.describe('Organizations TRPC Router', () => {
  let client: ReturnType<typeof createTestTRPCClient>;

  test.beforeAll(async () => {
    const apiReady = await waitForApi(10, 2000);
    if (!apiReady) {
      console.warn('API not available, tests may fail');
    }
    client = createTestTRPCClient();
  });

  test.describe('organizations.list', () => {
    test('should return array of organizations', async () => {
      const result = await client.organizations.list.query({});

      expect(Array.isArray(result)).toBe(true);
    });

    test('should return organizations with expected fields', async () => {
      const result = await client.organizations.list.query({});

      if (result.length > 0) {
        const org = result[0];
        expect(org).toHaveProperty('id');
        expect(org).toHaveProperty('name');
      }
    });
  });

  test.describe('organizations.get', () => {
    test('should get organization by valid ID', async () => {
      // Use the test organization ID
      const result = await client.organizations.get.query({ id: TEST_CONFIG.organizationId });

      expect(result).toBeDefined();
      expect(result.id).toBe(TEST_CONFIG.organizationId);
    });

    test('should throw for non-existent organization', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(
        client.organizations.get.query({ id: fakeId })
      ).rejects.toThrow();
    });

    test('should throw for invalid UUID format', async () => {
      await expect(
        client.organizations.get.query({ id: 'not-a-uuid' })
      ).rejects.toThrow();
    });
  });

  test.describe('organizations.getDefault', () => {
    test('should return default organization', async () => {
      const result = await client.organizations.getDefault.query({});

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });
  });

  test.describe('organizations.create', () => {
    test('should create organization with minimal data', async () => {
      const orgData = {
        name: `Test Org ${testId()}`,
      };

      const result = await client.organizations.create.mutate(orgData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe(orgData.name);
    });

    test('should create organization with complete data', async () => {
      const orgData = {
        name: `Full Test Org ${testId()}`,
        slug: `full-test-org-${testId().toLowerCase()}`,
      };

      const result = await client.organizations.create.mutate(orgData);

      expect(result).toBeDefined();
      expect(result.name).toBe(orgData.name);
    });

    test('should reject empty organization name', async () => {
      await expect(
        client.organizations.create.mutate({ name: '' })
      ).rejects.toThrow();
    });
  });

  test.describe('organizations.update', () => {
    test('should update organization name', async () => {
      // Create an org first
      const created = await client.organizations.create.mutate({
        name: `Update Test Org ${testId()}`,
      });

      const newName = `Updated Org ${testId()}`;
      const updated = await client.organizations.update.mutate({
        id: created.id,
        data: { name: newName },
      });

      expect(updated.name).toBe(newName);
    });

    test('should throw for non-existent organization', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(
        client.organizations.update.mutate({
          id: fakeId,
          data: { name: 'New Name' },
        })
      ).rejects.toThrow();
    });
  });

  test.describe('organizations.lookup', () => {
    test('should lookup organization by name', async () => {
      // First get existing org
      const org = await client.organizations.get.query({ id: TEST_CONFIG.organizationId });

      // Look it up by name
      const result = await client.organizations.lookup.query({ name: org.name });

      expect(result).toBeDefined();
      expect(result.id).toBe(org.id);
    });

    test('should return null for non-existent name', async () => {
      const result = await client.organizations.lookup.query({
        name: `NonExistent_${testId()}`,
      });

      // May return null or empty depending on implementation
      expect(result === null || result === undefined || !result.id).toBe(true);
    });
  });
});

test.describe('Organizations API - Error Handling', () => {
  test('should handle unauthorized request', async () => {
    const unauthorizedClient = createTestTRPCClient({
      apiKey: 'invalid-api-key',
    });

    await expect(
      unauthorizedClient.organizations.list.query({})
    ).rejects.toThrow();
  });
});
