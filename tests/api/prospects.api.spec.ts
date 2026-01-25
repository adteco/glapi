/**
 * Prospects TRPC Router API Tests
 *
 * Tests all procedures in the prospects router:
 * - list
 * - getById
 * - create
 * - update
 * - delete
 * - convertToLead
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

const prospectScenarios = {
  minimal: () => ({
    companyName: `Prospect Company ${testId()}`,
  }),
  complete: () => ({
    companyName: `Full Prospect ${testId()}`,
    contactName: `Prospect Contact ${testId().slice(-4)}`,
    email: `prospect-${testId()}@test.example.com`,
    phone: '555-PROS-001',
    source: 'Trade Show',
    industry: 'Manufacturing',
    notes: 'Initial contact made at conference',
    status: 'new' as const,
  }),
  qualified: () => ({
    companyName: `Qualified Prospect ${testId()}`,
    status: 'qualified' as const,
  }),
};

test.describe('Prospects TRPC Router', () => {
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

  test.describe('prospects.list', () => {
    test('should return array of prospects', async () => {
      const result = await client.prospects.list.query({});
      expect(Array.isArray(result)).toBe(true);
    });

    test('should return prospects with expected fields', async () => {
      const created = await client.prospects.create.mutate(prospectScenarios.complete());
      cleanup.track('prospect', created.id);

      const result = await client.prospects.list.query({});
      const prospect = result.find(p => p.id === created.id);

      expect(prospect).toBeDefined();
      expect(prospect).toHaveProperty('id');
      expect(prospect).toHaveProperty('companyName');
    });
  });

  test.describe('prospects.getById', () => {
    test('should get prospect by valid UUID', async () => {
      const prospectData = prospectScenarios.complete();
      const created = await client.prospects.create.mutate(prospectData);
      cleanup.track('prospect', created.id);

      const result = await client.prospects.getById.query({ id: created.id });

      expect(result).toBeDefined();
      expect(result.id).toBe(created.id);
      expect(result.companyName).toBe(prospectData.companyName);
    });

    test('should throw NOT_FOUND for non-existent UUID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.prospects.getById.query({ id: fakeId })
      ).rejects.toThrow();
    });
  });

  test.describe('prospects.create', () => {
    test('should create prospect with minimal data', async () => {
      const prospectData = prospectScenarios.minimal();
      const result = await client.prospects.create.mutate(prospectData);
      cleanup.track('prospect', result.id);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.companyName).toBe(prospectData.companyName);
    });

    test('should create prospect with complete data', async () => {
      const prospectData = prospectScenarios.complete();
      const result = await client.prospects.create.mutate(prospectData);
      cleanup.track('prospect', result.id);

      expect(result.companyName).toBe(prospectData.companyName);
      expect(result.email).toBe(prospectData.email);
      expect(result.source).toBe(prospectData.source);
    });

    test('should reject empty company name', async () => {
      await expect(
        client.prospects.create.mutate({ companyName: '' })
      ).rejects.toThrow();
    });
  });

  test.describe('prospects.update', () => {
    test('should update prospect company name', async () => {
      const created = await client.prospects.create.mutate(prospectScenarios.minimal());
      cleanup.track('prospect', created.id);

      const newName = `Updated Prospect ${testId()}`;
      const updated = await client.prospects.update.mutate({
        id: created.id,
        data: { companyName: newName },
      });

      expect(updated.companyName).toBe(newName);
    });

    test('should update prospect status', async () => {
      const created = await client.prospects.create.mutate(prospectScenarios.minimal());
      cleanup.track('prospect', created.id);

      const updated = await client.prospects.update.mutate({
        id: created.id,
        data: { status: 'qualified' },
      });

      expect(updated.status).toBe('qualified');
    });

    test('should update prospect notes', async () => {
      const created = await client.prospects.create.mutate(prospectScenarios.complete());
      cleanup.track('prospect', created.id);

      const newNotes = 'Updated notes for this prospect';
      const updated = await client.prospects.update.mutate({
        id: created.id,
        data: { notes: newNotes },
      });

      expect(updated.notes).toBe(newNotes);
    });

    test('should throw NOT_FOUND for non-existent prospect', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.prospects.update.mutate({
          id: fakeId,
          data: { companyName: 'New' },
        })
      ).rejects.toThrow();
    });
  });

  test.describe('prospects.delete', () => {
    test('should delete prospect successfully', async () => {
      const created = await client.prospects.create.mutate(prospectScenarios.minimal());

      const result = await client.prospects.delete.mutate({ id: created.id });
      expect(result).toEqual({ success: true });

      await expect(
        client.prospects.getById.query({ id: created.id })
      ).rejects.toThrow();
    });

    test('should throw NOT_FOUND for non-existent prospect', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.prospects.delete.mutate({ id: fakeId })
      ).rejects.toThrow();
    });
  });

  test.describe('prospects.convertToLead', () => {
    test('should convert prospect to lead', async () => {
      const created = await client.prospects.create.mutate(prospectScenarios.qualified());
      cleanup.track('prospect', created.id);

      const result = await client.prospects.convertToLead.mutate({
        id: created.id,
      });

      expect(result).toBeDefined();
      expect(result.leadId).toBeDefined();

      // Clean up created lead
      cleanup.track('lead', result.leadId);
    });
  });

  test.describe('prospects.convertToCustomer', () => {
    test('should convert prospect directly to customer', async () => {
      const created = await client.prospects.create.mutate(prospectScenarios.qualified());
      cleanup.track('prospect', created.id);

      const result = await client.prospects.convertToCustomer.mutate({
        id: created.id,
      });

      expect(result).toBeDefined();
      expect(result.customerId).toBeDefined();

      // Clean up created customer
      cleanup.track('customer', result.customerId);
    });
  });
});
