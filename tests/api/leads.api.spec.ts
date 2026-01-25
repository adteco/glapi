/**
 * Leads TRPC Router API Tests
 *
 * Tests all procedures in the leads router:
 * - list
 * - getById
 * - get
 * - create
 * - update
 * - delete
 * - convertToCustomer
 */

import { test, expect } from '@playwright/test';
import {
  createTestTRPCClient,
  createCleanupHelper,
  waitForApi,
  testId,
  TEST_CONFIG,
} from '../helpers/api-client';

const leadScenarios = {
  minimal: () => ({
    companyName: `Lead Company ${testId()}`,
  }),
  complete: () => ({
    companyName: `Full Lead ${testId()}`,
    contactName: `Lead Contact ${testId().slice(-4)}`,
    email: `lead-${testId()}@test.example.com`,
    phone: '555-LEAD-001',
    source: 'Website',
    industry: 'Technology',
    estimatedValue: 50000,
    status: 'new' as const,
  }),
  qualified: () => ({
    companyName: `Qualified Lead ${testId()}`,
    status: 'qualified' as const,
    estimatedValue: 100000,
  }),
};

test.describe('Leads TRPC Router', () => {
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

  test.describe('leads.list', () => {
    test('should return array of leads', async () => {
      const result = await client.leads.list.query({});
      expect(Array.isArray(result)).toBe(true);
    });

    test('should return leads with expected fields', async () => {
      const created = await client.leads.create.mutate(leadScenarios.complete());
      cleanup.track('lead', created.id);

      const result = await client.leads.list.query({});
      const lead = result.find(l => l.id === created.id);

      expect(lead).toBeDefined();
      expect(lead).toHaveProperty('id');
      expect(lead).toHaveProperty('companyName');
    });
  });

  test.describe('leads.getById', () => {
    test('should get lead by valid UUID', async () => {
      const leadData = leadScenarios.complete();
      const created = await client.leads.create.mutate(leadData);
      cleanup.track('lead', created.id);

      const result = await client.leads.getById.query({ id: created.id });

      expect(result).toBeDefined();
      expect(result.id).toBe(created.id);
      expect(result.companyName).toBe(leadData.companyName);
    });

    test('should throw NOT_FOUND for non-existent UUID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.leads.getById.query({ id: fakeId })
      ).rejects.toThrow();
    });
  });

  test.describe('leads.create', () => {
    test('should create lead with minimal data', async () => {
      const leadData = leadScenarios.minimal();
      const result = await client.leads.create.mutate(leadData);
      cleanup.track('lead', result.id);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.companyName).toBe(leadData.companyName);
    });

    test('should create lead with complete data', async () => {
      const leadData = leadScenarios.complete();
      const result = await client.leads.create.mutate(leadData);
      cleanup.track('lead', result.id);

      expect(result.companyName).toBe(leadData.companyName);
      expect(result.email).toBe(leadData.email);
      expect(result.source).toBe(leadData.source);
    });

    test('should reject empty company name', async () => {
      await expect(
        client.leads.create.mutate({ companyName: '' })
      ).rejects.toThrow();
    });
  });

  test.describe('leads.update', () => {
    test('should update lead company name', async () => {
      const created = await client.leads.create.mutate(leadScenarios.minimal());
      cleanup.track('lead', created.id);

      const newName = `Updated Lead ${testId()}`;
      const updated = await client.leads.update.mutate({
        id: created.id,
        data: { companyName: newName },
      });

      expect(updated.companyName).toBe(newName);
    });

    test('should update lead status', async () => {
      const created = await client.leads.create.mutate(leadScenarios.minimal());
      cleanup.track('lead', created.id);

      const updated = await client.leads.update.mutate({
        id: created.id,
        data: { status: 'qualified' },
      });

      expect(updated.status).toBe('qualified');
    });

    test('should update lead estimated value', async () => {
      const created = await client.leads.create.mutate(leadScenarios.complete());
      cleanup.track('lead', created.id);

      const newValue = 75000;
      const updated = await client.leads.update.mutate({
        id: created.id,
        data: { estimatedValue: newValue },
      });

      expect(updated.estimatedValue).toBe(newValue);
    });

    test('should throw NOT_FOUND for non-existent lead', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.leads.update.mutate({
          id: fakeId,
          data: { companyName: 'New' },
        })
      ).rejects.toThrow();
    });
  });

  test.describe('leads.delete', () => {
    test('should delete lead successfully', async () => {
      const created = await client.leads.create.mutate(leadScenarios.minimal());

      const result = await client.leads.delete.mutate({ id: created.id });
      expect(result).toEqual({ success: true });

      await expect(
        client.leads.getById.query({ id: created.id })
      ).rejects.toThrow();
    });

    test('should throw NOT_FOUND for non-existent lead', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.leads.delete.mutate({ id: fakeId })
      ).rejects.toThrow();
    });
  });

  test.describe('leads.convertToCustomer', () => {
    test('should convert qualified lead to customer', async () => {
      const created = await client.leads.create.mutate(leadScenarios.qualified());
      cleanup.track('lead', created.id);

      const result = await client.leads.convertToCustomer.mutate({
        id: created.id,
      });

      expect(result).toBeDefined();
      expect(result.customerId).toBeDefined();

      // Clean up created customer
      cleanup.track('customer', result.customerId);
    });
  });
});
