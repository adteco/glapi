/**
 * Vendors TRPC Router API Tests
 *
 * Tests all procedures in the vendors router:
 * - list
 * - getById
 * - create
 * - update
 * - delete
 * - findByEIN
 */

import { test, expect } from '@playwright/test';
import {
  createTestTRPCClient,
  createCleanupHelper,
  waitForApi,
  testId,
  TEST_CONFIG,
} from '../helpers/api-client';

// Test data scenarios for vendors
const vendorScenarios = {
  minimal: () => ({
    companyName: `Minimal Vendor ${testId()}`,
  }),
  complete: () => ({
    companyName: `Complete Vendor ${testId()}`,
    contactEmail: `vendor-${testId()}@test.example.com`,
    contactPhone: '555-123-4567',
    address: '123 Vendor St',
    city: 'Vendorville',
    state: 'CA',
    zip: '90210',
    ein: `${Math.floor(Math.random() * 900000000) + 100000000}`,
    status: 'active' as const,
  }),
  inactive: () => ({
    companyName: `Inactive Vendor ${testId()}`,
    status: 'inactive' as const,
  }),
};

test.describe('Vendors TRPC Router', () => {
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

  test.describe('vendors.list', () => {
    test('should return array of vendors', async () => {
      const result = await client.vendors.list.query({});

      expect(Array.isArray(result)).toBe(true);
    });

    test('should return vendors with expected fields', async () => {
      // Create a vendor first to ensure we have data
      const created = await client.vendors.create.mutate(vendorScenarios.complete());
      cleanup.track('vendor', created.id);

      const result = await client.vendors.list.query({});

      expect(result.length).toBeGreaterThan(0);
      const vendor = result.find(v => v.id === created.id);
      expect(vendor).toBeDefined();
      expect(vendor).toHaveProperty('id');
      expect(vendor).toHaveProperty('companyName');
      expect(vendor).toHaveProperty('organizationId');
    });

    test('should handle pagination', async () => {
      const result = await client.vendors.list.query({
        limit: 10,
        offset: 0,
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(10);
    });
  });

  test.describe('vendors.getById', () => {
    test('should get vendor by valid UUID', async () => {
      const vendorData = vendorScenarios.complete();
      const created = await client.vendors.create.mutate(vendorData);
      cleanup.track('vendor', created.id);

      const result = await client.vendors.getById.query({ id: created.id });

      expect(result).toBeDefined();
      expect(result.id).toBe(created.id);
      expect(result.companyName).toBe(vendorData.companyName);
    });

    test('should throw NOT_FOUND for non-existent UUID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(
        client.vendors.getById.query({ id: fakeId })
      ).rejects.toThrow();
    });

    test('should throw for invalid UUID format', async () => {
      await expect(
        client.vendors.getById.query({ id: 'not-a-uuid' })
      ).rejects.toThrow();
    });
  });

  test.describe('vendors.create', () => {
    test('should create vendor with minimal data', async () => {
      const vendorData = vendorScenarios.minimal();

      const result = await client.vendors.create.mutate(vendorData);
      cleanup.track('vendor', result.id);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.companyName).toBe(vendorData.companyName);
      expect(result.organizationId).toBe(TEST_CONFIG.organizationId);
    });

    test('should create vendor with complete data', async () => {
      const vendorData = vendorScenarios.complete();

      const result = await client.vendors.create.mutate(vendorData);
      cleanup.track('vendor', result.id);

      expect(result).toBeDefined();
      expect(result.companyName).toBe(vendorData.companyName);
      expect(result.contactEmail).toBe(vendorData.contactEmail);
      expect(result.status).toBe('active');
    });

    test('should create inactive vendor', async () => {
      const vendorData = vendorScenarios.inactive();

      const result = await client.vendors.create.mutate(vendorData);
      cleanup.track('vendor', result.id);

      expect(result.status).toBe('inactive');
    });

    test('should reject empty company name', async () => {
      await expect(
        client.vendors.create.mutate({ companyName: '' })
      ).rejects.toThrow();
    });
  });

  test.describe('vendors.update', () => {
    test('should update vendor name', async () => {
      const created = await client.vendors.create.mutate(vendorScenarios.minimal());
      cleanup.track('vendor', created.id);

      const newName = `Updated Vendor ${testId()}`;
      const updated = await client.vendors.update.mutate({
        id: created.id,
        data: { companyName: newName },
      });

      expect(updated.companyName).toBe(newName);
    });

    test('should update vendor status', async () => {
      const created = await client.vendors.create.mutate({
        ...vendorScenarios.minimal(),
        status: 'active',
      });
      cleanup.track('vendor', created.id);

      const updated = await client.vendors.update.mutate({
        id: created.id,
        data: { status: 'inactive' },
      });

      expect(updated.status).toBe('inactive');
    });

    test('should update vendor contact info', async () => {
      const created = await client.vendors.create.mutate(vendorScenarios.minimal());
      cleanup.track('vendor', created.id);

      const newEmail = `updated-${testId()}@test.example.com`;
      const newPhone = '555-999-8888';

      const updated = await client.vendors.update.mutate({
        id: created.id,
        data: {
          contactEmail: newEmail,
          contactPhone: newPhone,
        },
      });

      expect(updated.contactEmail).toBe(newEmail);
      expect(updated.contactPhone).toBe(newPhone);
    });

    test('should throw NOT_FOUND for non-existent vendor', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(
        client.vendors.update.mutate({
          id: fakeId,
          data: { companyName: 'New Name' },
        })
      ).rejects.toThrow();
    });
  });

  test.describe('vendors.delete', () => {
    test('should delete vendor successfully', async () => {
      const created = await client.vendors.create.mutate(vendorScenarios.minimal());

      const result = await client.vendors.delete.mutate({ id: created.id });
      expect(result).toEqual({ success: true });

      await expect(
        client.vendors.getById.query({ id: created.id })
      ).rejects.toThrow();
    });

    test('should throw NOT_FOUND for non-existent vendor', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(
        client.vendors.delete.mutate({ id: fakeId })
      ).rejects.toThrow();
    });
  });

  test.describe('vendors.findByEIN', () => {
    test('should find vendor by EIN', async () => {
      const vendorData = vendorScenarios.complete();
      const created = await client.vendors.create.mutate(vendorData);
      cleanup.track('vendor', created.id);

      if (vendorData.ein) {
        const result = await client.vendors.findByEIN.query({ ein: vendorData.ein });

        expect(result).toBeDefined();
        expect(result?.id).toBe(created.id);
      }
    });

    test('should return null for non-existent EIN', async () => {
      const result = await client.vendors.findByEIN.query({
        ein: '000000000',
      });

      expect(result === null || result === undefined).toBe(true);
    });
  });
});

test.describe('Vendors API - Error Handling', () => {
  let client: ReturnType<typeof createTestTRPCClient>;

  test.beforeAll(async () => {
    client = createTestTRPCClient();
  });

  test('should handle network errors gracefully', async () => {
    const badClient = createTestTRPCClient({
      apiUrl: 'http://localhost:9999',
    });

    await expect(
      badClient.vendors.list.query({})
    ).rejects.toThrow();
  });

  test('should return proper error for unauthorized request', async () => {
    const unauthorizedClient = createTestTRPCClient({
      apiKey: 'invalid-api-key',
    });

    await expect(
      unauthorizedClient.vendors.list.query({})
    ).rejects.toThrow();
  });
});

test.describe('Vendors API - Performance', () => {
  let client: ReturnType<typeof createTestTRPCClient>;

  test.beforeAll(async () => {
    client = createTestTRPCClient();
  });

  test('should complete list query within timeout', async () => {
    const startTime = Date.now();
    await client.vendors.list.query({});
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(5000);
  });

  test('should complete create/read/delete cycle within timeout', async () => {
    const startTime = Date.now();

    const created = await client.vendors.create.mutate({
      companyName: `Perf Test Vendor ${testId()}`,
    });
    await client.vendors.getById.query({ id: created.id });
    await client.vendors.delete.mutate({ id: created.id });

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(10000);
  });
});
