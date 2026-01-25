/**
 * Classes TRPC Router API Tests
 *
 * Tests all procedures in the classes router:
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

const classScenarios = {
  minimal: () => ({
    name: `Class ${testId()}`,
  }),
  complete: () => ({
    name: `Full Class ${testId()}`,
    code: `CLS-${testId().slice(-6)}`,
    description: 'Test class for E2E testing',
    status: 'active' as const,
  }),
  inactive: () => ({
    name: `Inactive Class ${testId()}`,
    status: 'inactive' as const,
  }),
};

test.describe('Classes TRPC Router', () => {
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

  test.describe('classes.list', () => {
    test('should return array of classes', async () => {
      const result = await client.classes.list.query({});
      expect(Array.isArray(result)).toBe(true);
    });

    test('should return classes with expected fields', async () => {
      const created = await client.classes.create.mutate(classScenarios.complete());
      cleanup.track('class', created.id);

      const result = await client.classes.list.query({});
      const cls = result.find(c => c.id === created.id);

      expect(cls).toBeDefined();
      expect(cls).toHaveProperty('id');
      expect(cls).toHaveProperty('name');
      expect(cls).toHaveProperty('organizationId');
    });
  });

  test.describe('classes.get', () => {
    test('should get class by valid UUID', async () => {
      const classData = classScenarios.complete();
      const created = await client.classes.create.mutate(classData);
      cleanup.track('class', created.id);

      const result = await client.classes.get.query({ id: created.id });

      expect(result).toBeDefined();
      expect(result.id).toBe(created.id);
      expect(result.name).toBe(classData.name);
    });

    test('should throw NOT_FOUND for non-existent UUID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.classes.get.query({ id: fakeId })
      ).rejects.toThrow();
    });
  });

  test.describe('classes.create', () => {
    test('should create class with minimal data', async () => {
      const classData = classScenarios.minimal();
      const result = await client.classes.create.mutate(classData);
      cleanup.track('class', result.id);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe(classData.name);
      expect(result.organizationId).toBe(TEST_CONFIG.organizationId);
    });

    test('should create class with complete data', async () => {
      const classData = classScenarios.complete();
      const result = await client.classes.create.mutate(classData);
      cleanup.track('class', result.id);

      expect(result.name).toBe(classData.name);
      expect(result.code).toBe(classData.code);
    });

    test('should reject empty name', async () => {
      await expect(
        client.classes.create.mutate({ name: '' })
      ).rejects.toThrow();
    });
  });

  test.describe('classes.update', () => {
    test('should update class name', async () => {
      const created = await client.classes.create.mutate(classScenarios.minimal());
      cleanup.track('class', created.id);

      const newName = `Updated Class ${testId()}`;
      const updated = await client.classes.update.mutate({
        id: created.id,
        data: { name: newName },
      });

      expect(updated.name).toBe(newName);
    });

    test('should update class code', async () => {
      const created = await client.classes.create.mutate(classScenarios.complete());
      cleanup.track('class', created.id);

      const newCode = `NEW-${testId().slice(-6)}`;
      const updated = await client.classes.update.mutate({
        id: created.id,
        data: { code: newCode },
      });

      expect(updated.code).toBe(newCode);
    });

    test('should throw NOT_FOUND for non-existent class', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.classes.update.mutate({
          id: fakeId,
          data: { name: 'New Name' },
        })
      ).rejects.toThrow();
    });
  });

  test.describe('classes.delete', () => {
    test('should delete class successfully', async () => {
      const created = await client.classes.create.mutate(classScenarios.minimal());

      const result = await client.classes.delete.mutate({ id: created.id });
      expect(result).toEqual({ success: true });

      await expect(
        client.classes.get.query({ id: created.id })
      ).rejects.toThrow();
    });

    test('should throw NOT_FOUND for non-existent class', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.classes.delete.mutate({ id: fakeId })
      ).rejects.toThrow();
    });
  });
});
