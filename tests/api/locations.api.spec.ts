/**
 * Locations TRPC Router API Tests
 *
 * Tests all procedures in the locations router:
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

const locationScenarios = {
  minimal: () => ({
    name: `Location ${testId()}`,
  }),
  complete: () => ({
    name: `Full Location ${testId()}`,
    code: `LOC-${testId().slice(-6)}`,
    address: '456 Location Ave',
    city: 'Location City',
    state: 'NY',
    zip: '10001',
    status: 'active' as const,
  }),
  inactive: () => ({
    name: `Inactive Location ${testId()}`,
    status: 'inactive' as const,
  }),
};

test.describe('Locations TRPC Router', () => {
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

  test.describe('locations.list', () => {
    test('should return array of locations', async () => {
      const result = await client.locations.list.query({});
      expect(Array.isArray(result)).toBe(true);
    });

    test('should return locations with expected fields', async () => {
      const created = await client.locations.create.mutate(locationScenarios.complete());
      cleanup.track('location', created.id);

      const result = await client.locations.list.query({});
      const location = result.find(l => l.id === created.id);

      expect(location).toBeDefined();
      expect(location).toHaveProperty('id');
      expect(location).toHaveProperty('name');
      expect(location).toHaveProperty('organizationId');
    });
  });

  test.describe('locations.get', () => {
    test('should get location by valid UUID', async () => {
      const locData = locationScenarios.complete();
      const created = await client.locations.create.mutate(locData);
      cleanup.track('location', created.id);

      const result = await client.locations.get.query({ id: created.id });

      expect(result).toBeDefined();
      expect(result.id).toBe(created.id);
      expect(result.name).toBe(locData.name);
    });

    test('should throw NOT_FOUND for non-existent UUID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.locations.get.query({ id: fakeId })
      ).rejects.toThrow();
    });
  });

  test.describe('locations.create', () => {
    test('should create location with minimal data', async () => {
      const locData = locationScenarios.minimal();
      const result = await client.locations.create.mutate(locData);
      cleanup.track('location', result.id);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe(locData.name);
      expect(result.organizationId).toBe(TEST_CONFIG.organizationId);
    });

    test('should create location with complete data', async () => {
      const locData = locationScenarios.complete();
      const result = await client.locations.create.mutate(locData);
      cleanup.track('location', result.id);

      expect(result.name).toBe(locData.name);
      expect(result.code).toBe(locData.code);
      expect(result.city).toBe(locData.city);
    });

    test('should reject empty name', async () => {
      await expect(
        client.locations.create.mutate({ name: '' })
      ).rejects.toThrow();
    });
  });

  test.describe('locations.update', () => {
    test('should update location name', async () => {
      const created = await client.locations.create.mutate(locationScenarios.minimal());
      cleanup.track('location', created.id);

      const newName = `Updated Location ${testId()}`;
      const updated = await client.locations.update.mutate({
        id: created.id,
        data: { name: newName },
      });

      expect(updated.name).toBe(newName);
    });

    test('should update location address', async () => {
      const created = await client.locations.create.mutate(locationScenarios.complete());
      cleanup.track('location', created.id);

      const newAddress = '789 New Street';
      const updated = await client.locations.update.mutate({
        id: created.id,
        data: { address: newAddress },
      });

      expect(updated.address).toBe(newAddress);
    });

    test('should throw NOT_FOUND for non-existent location', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.locations.update.mutate({
          id: fakeId,
          data: { name: 'New Name' },
        })
      ).rejects.toThrow();
    });
  });

  test.describe('locations.delete', () => {
    test('should delete location successfully', async () => {
      const created = await client.locations.create.mutate(locationScenarios.minimal());

      const result = await client.locations.delete.mutate({ id: created.id });
      expect(result).toEqual({ success: true });

      await expect(
        client.locations.get.query({ id: created.id })
      ).rejects.toThrow();
    });

    test('should throw NOT_FOUND for non-existent location', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.locations.delete.mutate({ id: fakeId })
      ).rejects.toThrow();
    });
  });
});
