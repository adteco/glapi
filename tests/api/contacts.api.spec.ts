/**
 * Contacts TRPC Router API Tests
 *
 * Tests all procedures in the contacts router:
 * - list
 * - getById
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

const contactScenarios = {
  minimal: () => ({
    firstName: `Contact${testId().slice(-4)}`,
    lastName: `Person${testId().slice(-4)}`,
  }),
  complete: () => ({
    firstName: `Jane${testId().slice(-4)}`,
    lastName: `Smith${testId().slice(-4)}`,
    email: `contact-${testId()}@test.example.com`,
    phone: '555-987-6543',
    title: 'Account Manager',
    company: `Test Company ${testId()}`,
    status: 'active' as const,
  }),
  inactive: () => ({
    firstName: `Inactive${testId().slice(-4)}`,
    lastName: `Contact${testId().slice(-4)}`,
    status: 'inactive' as const,
  }),
};

test.describe('Contacts TRPC Router', () => {
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

  test.describe('contacts.list', () => {
    test('should return array of contacts', async () => {
      const result = await client.contacts.list.query({});
      expect(Array.isArray(result)).toBe(true);
    });

    test('should return contacts with expected fields', async () => {
      const created = await client.contacts.create.mutate(contactScenarios.complete());
      cleanup.track('contact', created.id);

      const result = await client.contacts.list.query({});
      const contact = result.find(c => c.id === created.id);

      expect(contact).toBeDefined();
      expect(contact).toHaveProperty('id');
      expect(contact).toHaveProperty('firstName');
      expect(contact).toHaveProperty('lastName');
    });
  });

  test.describe('contacts.getById', () => {
    test('should get contact by valid UUID', async () => {
      const contactData = contactScenarios.complete();
      const created = await client.contacts.create.mutate(contactData);
      cleanup.track('contact', created.id);

      const result = await client.contacts.getById.query({ id: created.id });

      expect(result).toBeDefined();
      expect(result.id).toBe(created.id);
      expect(result.firstName).toBe(contactData.firstName);
    });

    test('should throw NOT_FOUND for non-existent UUID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.contacts.getById.query({ id: fakeId })
      ).rejects.toThrow();
    });
  });

  test.describe('contacts.create', () => {
    test('should create contact with minimal data', async () => {
      const contactData = contactScenarios.minimal();
      const result = await client.contacts.create.mutate(contactData);
      cleanup.track('contact', result.id);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.firstName).toBe(contactData.firstName);
      expect(result.lastName).toBe(contactData.lastName);
    });

    test('should create contact with complete data', async () => {
      const contactData = contactScenarios.complete();
      const result = await client.contacts.create.mutate(contactData);
      cleanup.track('contact', result.id);

      expect(result.firstName).toBe(contactData.firstName);
      expect(result.email).toBe(contactData.email);
      expect(result.company).toBe(contactData.company);
    });

    test('should reject empty first name', async () => {
      await expect(
        client.contacts.create.mutate({ firstName: '', lastName: 'Test' })
      ).rejects.toThrow();
    });
  });

  test.describe('contacts.update', () => {
    test('should update contact name', async () => {
      const created = await client.contacts.create.mutate(contactScenarios.minimal());
      cleanup.track('contact', created.id);

      const newFirstName = `Updated${testId().slice(-4)}`;
      const updated = await client.contacts.update.mutate({
        id: created.id,
        data: { firstName: newFirstName },
      });

      expect(updated.firstName).toBe(newFirstName);
    });

    test('should update contact email and company', async () => {
      const created = await client.contacts.create.mutate(contactScenarios.complete());
      cleanup.track('contact', created.id);

      const newEmail = `updated-${testId()}@test.example.com`;
      const newCompany = `New Company ${testId()}`;
      const updated = await client.contacts.update.mutate({
        id: created.id,
        data: { email: newEmail, company: newCompany },
      });

      expect(updated.email).toBe(newEmail);
      expect(updated.company).toBe(newCompany);
    });

    test('should throw NOT_FOUND for non-existent contact', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.contacts.update.mutate({
          id: fakeId,
          data: { firstName: 'New' },
        })
      ).rejects.toThrow();
    });
  });

  test.describe('contacts.delete', () => {
    test('should delete contact successfully', async () => {
      const created = await client.contacts.create.mutate(contactScenarios.minimal());

      const result = await client.contacts.delete.mutate({ id: created.id });
      expect(result).toEqual({ success: true });

      await expect(
        client.contacts.getById.query({ id: created.id })
      ).rejects.toThrow();
    });

    test('should throw NOT_FOUND for non-existent contact', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.contacts.delete.mutate({ id: fakeId })
      ).rejects.toThrow();
    });
  });
});
