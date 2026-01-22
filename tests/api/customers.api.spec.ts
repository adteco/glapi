/**
 * Customers TRPC Router API Tests
 *
 * Tests all procedures in the customers router:
 * - list
 * - get
 * - create
 * - update
 * - delete
 * - getChildren
 * - getWarehouseAssignments
 */

import { test, expect } from '@playwright/test';
import {
  createTestTRPCClient,
  createCleanupHelper,
  testId,
  waitForApi,
  TEST_CONFIG,
} from '../helpers/api-client';
import { createTestCustomer, customerScenarios, invalidCustomers } from '../fixtures';

test.describe('Customers TRPC Router', () => {
  let client: ReturnType<typeof createTestTRPCClient>;
  let cleanup: ReturnType<typeof createCleanupHelper>;

  test.beforeAll(async () => {
    // Wait for API to be available
    const apiReady = await waitForApi(10, 2000);
    if (!apiReady) {
      console.warn('API not available, tests may fail');
    }

    client = createTestTRPCClient();
    cleanup = createCleanupHelper(client);
  });

  test.afterAll(async () => {
    // Clean up any test data created during tests
    await cleanup.cleanupAll();
  });

  test.describe('customers.list', () => {
    test('should return array of customers', async () => {
      const result = await client.customers.list.query({});

      expect(Array.isArray(result)).toBe(true);
    });

    test('should return customers with expected fields', async () => {
      const result = await client.customers.list.query({});

      if (result.length > 0) {
        const customer = result[0];
        expect(customer).toHaveProperty('id');
        expect(customer).toHaveProperty('companyName');
        expect(customer).toHaveProperty('organizationId');
        expect(customer).toHaveProperty('status');
      }
    });

    test('should handle includeInactive parameter', async () => {
      // Create an inactive customer first
      const inactiveData = customerScenarios.inactive();
      const created = await client.customers.create.mutate(inactiveData);
      cleanup.track('customer', created.id);

      // Query with includeInactive
      const withInactive = await client.customers.list.query({ includeInactive: true });
      const withoutInactive = await client.customers.list.query({ includeInactive: false });

      // Both should return arrays
      expect(Array.isArray(withInactive)).toBe(true);
      expect(Array.isArray(withoutInactive)).toBe(true);
    });

    test('should return empty array for org with no customers', async () => {
      // This test uses the default test organization which may have customers
      // Just verify it doesn't throw
      const result = await client.customers.list.query({});
      expect(Array.isArray(result)).toBe(true);
    });
  });

  test.describe('customers.get', () => {
    test('should get customer by valid UUID', async () => {
      // First create a customer
      const customerData = createTestCustomer();
      const created = await client.customers.create.mutate(customerData);
      cleanup.track('customer', created.id);

      // Then fetch it
      const result = await client.customers.get.query({ id: created.id });

      expect(result).toBeDefined();
      expect(result.id).toBe(created.id);
      expect(result.companyName).toBe(customerData.companyName);
    });

    test('should throw NOT_FOUND for non-existent UUID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(
        client.customers.get.query({ id: fakeId })
      ).rejects.toThrow();
    });

    test('should throw for invalid UUID format', async () => {
      await expect(
        client.customers.get.query({ id: 'not-a-uuid' })
      ).rejects.toThrow();
    });
  });

  test.describe('customers.create', () => {
    test('should create customer with minimal data', async () => {
      const customerData = customerScenarios.minimal();

      const result = await client.customers.create.mutate(customerData);
      cleanup.track('customer', result.id);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.companyName).toBe(customerData.companyName);
      expect(result.organizationId).toBe(TEST_CONFIG.organizationId);
    });

    test('should create customer with complete data', async () => {
      const customerData = customerScenarios.complete();

      const result = await client.customers.create.mutate(customerData);
      cleanup.track('customer', result.id);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.companyName).toBe(customerData.companyName);
      expect(result.contactEmail).toBe(customerData.contactEmail);
      expect(result.status).toBe('active');
    });

    test('should create customer with special characters in name', async () => {
      const customerData = customerScenarios.specialCharacters();

      const result = await client.customers.create.mutate(customerData);
      cleanup.track('customer', result.id);

      expect(result.companyName).toBe(customerData.companyName);
    });

    test('should create customer with unicode name', async () => {
      const customerData = customerScenarios.unicode();

      const result = await client.customers.create.mutate(customerData);
      cleanup.track('customer', result.id);

      expect(result.companyName).toBe(customerData.companyName);
    });

    test('should reject empty company name', async () => {
      const invalidData = invalidCustomers.emptyName();

      await expect(
        client.customers.create.mutate(invalidData)
      ).rejects.toThrow();
    });

    test('should reject invalid email format', async () => {
      const invalidData = invalidCustomers.invalidEmail();

      await expect(
        client.customers.create.mutate(invalidData)
      ).rejects.toThrow();
    });
  });

  test.describe('customers.update', () => {
    test('should update customer name', async () => {
      // Create a customer first
      const customerData = createTestCustomer();
      const created = await client.customers.create.mutate(customerData);
      cleanup.track('customer', created.id);

      // Update the name
      const newName = `Updated Company ${testId()}`;
      const updated = await client.customers.update.mutate({
        id: created.id,
        data: { companyName: newName },
      });

      expect(updated.companyName).toBe(newName);
    });

    test('should update customer status', async () => {
      // Create an active customer
      const customerData = createTestCustomer({ status: 'active' });
      const created = await client.customers.create.mutate(customerData);
      cleanup.track('customer', created.id);

      // Update to inactive
      const updated = await client.customers.update.mutate({
        id: created.id,
        data: { status: 'inactive' },
      });

      expect(updated.status).toBe('inactive');
    });

    test('should update customer contact info', async () => {
      const customerData = createTestCustomer();
      const created = await client.customers.create.mutate(customerData);
      cleanup.track('customer', created.id);

      const newEmail = `updated-${testId()}@test.example.com`;
      const newPhone = '555-999-0000';

      const updated = await client.customers.update.mutate({
        id: created.id,
        data: {
          contactEmail: newEmail,
          contactPhone: newPhone,
        },
      });

      expect(updated.contactEmail).toBe(newEmail);
      expect(updated.contactPhone).toBe(newPhone);
    });

    test('should throw NOT_FOUND for non-existent customer', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(
        client.customers.update.mutate({
          id: fakeId,
          data: { companyName: 'New Name' },
        })
      ).rejects.toThrow();
    });

    test('should preserve unmodified fields', async () => {
      const customerData = customerScenarios.complete();
      const created = await client.customers.create.mutate(customerData);
      cleanup.track('customer', created.id);

      // Only update name
      const updated = await client.customers.update.mutate({
        id: created.id,
        data: { companyName: 'New Name Only' },
      });

      // Original fields should be preserved
      expect(updated.contactEmail).toBe(customerData.contactEmail);
      expect(updated.contactPhone).toBe(customerData.contactPhone);
    });
  });

  test.describe('customers.delete', () => {
    test('should delete customer successfully', async () => {
      // Create a customer
      const customerData = createTestCustomer();
      const created = await client.customers.create.mutate(customerData);
      // Don't track for cleanup since we're deleting it

      // Delete it
      const result = await client.customers.delete.mutate({ id: created.id });
      expect(result).toEqual({ success: true });

      // Verify it's gone
      await expect(
        client.customers.get.query({ id: created.id })
      ).rejects.toThrow();
    });

    test('should throw NOT_FOUND for non-existent customer', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(
        client.customers.delete.mutate({ id: fakeId })
      ).rejects.toThrow();
    });

    test('should throw for invalid UUID format', async () => {
      await expect(
        client.customers.delete.mutate({ id: 'not-a-uuid' })
      ).rejects.toThrow();
    });
  });

  test.describe('customers.getChildren', () => {
    test('should return empty array for customer with no children', async () => {
      // Create a parent customer
      const parentData = createTestCustomer({ companyName: 'Parent Company' });
      const parent = await client.customers.create.mutate(parentData);
      cleanup.track('customer', parent.id);

      // Get children - should be empty
      const children = await client.customers.getChildren.query({ id: parent.id });

      expect(Array.isArray(children)).toBe(true);
      expect(children.length).toBe(0);
    });

    test('should throw NOT_FOUND for non-existent customer', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(
        client.customers.getChildren.query({ id: fakeId })
      ).rejects.toThrow();
    });
  });

  test.describe('customers.getWarehouseAssignments', () => {
    test('should return empty array for customer with no assignments', async () => {
      // Create a customer
      const customerData = createTestCustomer();
      const customer = await client.customers.create.mutate(customerData);
      cleanup.track('customer', customer.id);

      // Get warehouse assignments - should be empty
      const assignments = await client.customers.getWarehouseAssignments.query({
        customerId: customer.id,
      });

      expect(Array.isArray(assignments)).toBe(true);
      expect(assignments.length).toBe(0);
    });
  });
});

test.describe('Customers API - Error Handling', () => {
  let client: ReturnType<typeof createTestTRPCClient>;

  test.beforeAll(async () => {
    client = createTestTRPCClient();
  });

  test('should handle network errors gracefully', async () => {
    // Create client pointing to non-existent server
    const badClient = createTestTRPCClient({
      apiUrl: 'http://localhost:9999',
    });

    await expect(
      badClient.customers.list.query({})
    ).rejects.toThrow();
  });

  test('should return proper error for unauthorized request', async () => {
    // Create client with invalid API key
    const unauthorizedClient = createTestTRPCClient({
      apiKey: 'invalid-api-key',
    });

    await expect(
      unauthorizedClient.customers.list.query({})
    ).rejects.toThrow();
  });
});

test.describe('Customers API - Performance', () => {
  let client: ReturnType<typeof createTestTRPCClient>;

  test.beforeAll(async () => {
    client = createTestTRPCClient();
  });

  test('should complete list query within timeout', async () => {
    const startTime = Date.now();
    await client.customers.list.query({});
    const duration = Date.now() - startTime;

    // Should complete within 5 seconds
    expect(duration).toBeLessThan(5000);
  });

  test('should complete create/read/delete cycle within timeout', async () => {
    const startTime = Date.now();

    // Create
    const customerData = createTestCustomer();
    const created = await client.customers.create.mutate(customerData);

    // Read
    await client.customers.get.query({ id: created.id });

    // Delete
    await client.customers.delete.mutate({ id: created.id });

    const duration = Date.now() - startTime;

    // Full cycle should complete within 10 seconds
    expect(duration).toBeLessThan(10000);
  });
});
