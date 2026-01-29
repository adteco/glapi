/**
 * RLS Isolation Test - Entities Table (Customers)
 *
 * Verifies that Row Level Security properly isolates customer data
 * between organizations. One organization cannot see, modify, or
 * delete another organization's customers.
 *
 * Table: entities (backs customers, vendors, employees)
 * Migration: 0053_enable_rls_entities.sql
 */

import { test, expect } from '@playwright/test';
import {
  createTestTRPCClient,
  testId,
  waitForApi,
  TEST_CONFIG,
} from '../helpers/api-client';

// Second organization for isolation testing
// Uses a separate API key that is bound to CJD-Consulting org
const ORG_B_CONFIG = {
  organizationId: '456c2475-2277-4d90-929b-ae694a2a8577', // CJD-Consulting
  userId: 'api-key-user',
  apiKey: 'glapi_test_sk_orgb_0987654321fedcba', // API key bound to Org B
};

test.describe('Entities Table RLS Isolation', () => {
  let clientOrgA: ReturnType<typeof createTestTRPCClient>;
  let clientOrgB: ReturnType<typeof createTestTRPCClient>;
  let createdCustomerId: string | null = null;

  test.beforeAll(async () => {
    // Wait for API to be available
    const apiReady = await waitForApi(10, 2000);
    if (!apiReady) {
      console.warn('API not available, tests may fail');
    }

    // Create clients for two different organizations
    // Each org has its own API key that determines the organization context
    clientOrgA = createTestTRPCClient(); // Uses default Adteco org API key
    clientOrgB = createTestTRPCClient({
      organizationId: ORG_B_CONFIG.organizationId,
      userId: ORG_B_CONFIG.userId,
      apiKey: ORG_B_CONFIG.apiKey, // Use Org B's API key
    });
  });

  test.afterAll(async () => {
    // Clean up the test customer if created
    if (createdCustomerId) {
      try {
        await clientOrgA.customers.delete.mutate({ id: createdCustomerId });
      } catch (error) {
        console.log(`Cleanup: Customer ${createdCustomerId} already deleted or not found`);
      }
    }
  });

  test('Org A can create customer and Org B cannot see it', async () => {
    // Step 1: Org A creates a customer
    const customerName = `RLS-Test-Customer-${testId()}`;
    const createdCustomer = await clientOrgA.customers.create.mutate({
      companyName: customerName,
      status: 'active',
    });

    expect(createdCustomer).toBeDefined();
    expect(createdCustomer.id).toBeDefined();
    expect(createdCustomer.organizationId).toBe(TEST_CONFIG.organizationId);
    createdCustomerId = createdCustomer.id;

    // Step 2: Org A can retrieve their own customer
    const orgACustomer = await clientOrgA.customers.get.query({ id: createdCustomer.id });
    expect(orgACustomer).toBeDefined();
    expect(orgACustomer.companyName).toBe(customerName);

    // Step 3: Org B cannot see Org A's customer (should throw NOT_FOUND)
    await expect(
      clientOrgB.customers.get.query({ id: createdCustomer.id })
    ).rejects.toThrow();
  });

  test('Org B cannot list Org A customers', async () => {
    // Ensure we have a customer from Org A
    if (!createdCustomerId) {
      const customerName = `RLS-Test-Customer-List-${testId()}`;
      const created = await clientOrgA.customers.create.mutate({
        companyName: customerName,
        status: 'active',
      });
      createdCustomerId = created.id;
    }

    // Org A should see the customer in their list
    const orgAList = await clientOrgA.customers.list.query({});
    const orgACustomerInList = orgAList.find(c => c.id === createdCustomerId);
    expect(orgACustomerInList).toBeDefined();

    // Org B should NOT see Org A's customer in their list
    const orgBList = await clientOrgB.customers.list.query({});
    const orgBCustomerInList = orgBList.find(c => c.id === createdCustomerId);
    expect(orgBCustomerInList).toBeUndefined();
  });

  test('Org B cannot update Org A customer', async () => {
    // Ensure we have a customer from Org A
    if (!createdCustomerId) {
      const customerName = `RLS-Test-Customer-Update-${testId()}`;
      const created = await clientOrgA.customers.create.mutate({
        companyName: customerName,
        status: 'active',
      });
      createdCustomerId = created.id;
    }

    // Org B should NOT be able to update Org A's customer
    await expect(
      clientOrgB.customers.update.mutate({
        id: createdCustomerId,
        data: { companyName: 'Hacked Name' },
      })
    ).rejects.toThrow();

    // Verify the customer name was NOT changed
    const orgACustomer = await clientOrgA.customers.get.query({ id: createdCustomerId });
    expect(orgACustomer.companyName).not.toBe('Hacked Name');
  });

  test('Org B cannot delete Org A customer', async () => {
    // Create a fresh customer for delete test
    const customerName = `RLS-Test-Customer-Delete-${testId()}`;
    const created = await clientOrgA.customers.create.mutate({
      companyName: customerName,
      status: 'active',
    });
    const deleteTestCustomerId = created.id;

    // Org B should NOT be able to delete Org A's customer
    await expect(
      clientOrgB.customers.delete.mutate({ id: deleteTestCustomerId })
    ).rejects.toThrow();

    // Verify the customer still exists for Org A
    const orgACustomer = await clientOrgA.customers.get.query({ id: deleteTestCustomerId });
    expect(orgACustomer).toBeDefined();

    // Clean up
    await clientOrgA.customers.delete.mutate({ id: deleteTestCustomerId });
  });

  test('Each organization only sees their own customers', async () => {
    // Create customers in both organizations
    const orgACustomerName = `RLS-OrgA-${testId()}`;
    const orgBCustomerName = `RLS-OrgB-${testId()}`;

    const orgACreated = await clientOrgA.customers.create.mutate({
      companyName: orgACustomerName,
      status: 'active',
    });

    const orgBCreated = await clientOrgB.customers.create.mutate({
      companyName: orgBCustomerName,
      status: 'active',
    });

    try {
      // Org A list should contain their customer but not Org B's
      const orgAList = await clientOrgA.customers.list.query({});
      expect(orgAList.some(c => c.id === orgACreated.id)).toBe(true);
      expect(orgAList.some(c => c.id === orgBCreated.id)).toBe(false);

      // Org B list should contain their customer but not Org A's
      const orgBList = await clientOrgB.customers.list.query({});
      expect(orgBList.some(c => c.id === orgBCreated.id)).toBe(true);
      expect(orgBList.some(c => c.id === orgACreated.id)).toBe(false);
    } finally {
      // Clean up both customers
      await clientOrgA.customers.delete.mutate({ id: orgACreated.id });
      await clientOrgB.customers.delete.mutate({ id: orgBCreated.id });
    }
  });
});
