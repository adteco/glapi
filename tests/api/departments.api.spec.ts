/**
 * Departments TRPC Router API Tests
 *
 * Tests all procedures in the departments router:
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

const departmentScenarios = {
  minimal: () => ({
    name: `Dept ${testId()}`,
  }),
  complete: () => ({
    name: `Department ${testId()}`,
    code: `DEPT-${testId().slice(-6)}`,
    description: 'Test department for E2E testing',
    status: 'active' as const,
  }),
  inactive: () => ({
    name: `Inactive Dept ${testId()}`,
    status: 'inactive' as const,
  }),
};

test.describe('Departments TRPC Router', () => {
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

  test.describe('departments.list', () => {
    test('should return array of departments', async () => {
      const result = await client.departments.list.query({});
      expect(Array.isArray(result)).toBe(true);
    });

    test('should return departments with expected fields', async () => {
      const created = await client.departments.create.mutate(departmentScenarios.complete());
      cleanup.track('department', created.id);

      const result = await client.departments.list.query({});
      const dept = result.find(d => d.id === created.id);

      expect(dept).toBeDefined();
      expect(dept).toHaveProperty('id');
      expect(dept).toHaveProperty('name');
      expect(dept).toHaveProperty('organizationId');
    });
  });

  test.describe('departments.get', () => {
    test('should get department by valid UUID', async () => {
      const deptData = departmentScenarios.complete();
      const created = await client.departments.create.mutate(deptData);
      cleanup.track('department', created.id);

      const result = await client.departments.get.query({ id: created.id });

      expect(result).toBeDefined();
      expect(result.id).toBe(created.id);
      expect(result.name).toBe(deptData.name);
    });

    test('should throw NOT_FOUND for non-existent UUID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.departments.get.query({ id: fakeId })
      ).rejects.toThrow();
    });
  });

  test.describe('departments.create', () => {
    test('should create department with minimal data', async () => {
      const deptData = departmentScenarios.minimal();
      const result = await client.departments.create.mutate(deptData);
      cleanup.track('department', result.id);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe(deptData.name);
      expect(result.organizationId).toBe(TEST_CONFIG.organizationId);
    });

    test('should create department with complete data', async () => {
      const deptData = departmentScenarios.complete();
      const result = await client.departments.create.mutate(deptData);
      cleanup.track('department', result.id);

      expect(result.name).toBe(deptData.name);
      expect(result.code).toBe(deptData.code);
    });

    test('should reject empty name', async () => {
      await expect(
        client.departments.create.mutate({ name: '' })
      ).rejects.toThrow();
    });
  });

  test.describe('departments.update', () => {
    test('should update department name', async () => {
      const created = await client.departments.create.mutate(departmentScenarios.minimal());
      cleanup.track('department', created.id);

      const newName = `Updated Dept ${testId()}`;
      const updated = await client.departments.update.mutate({
        id: created.id,
        data: { name: newName },
      });

      expect(updated.name).toBe(newName);
    });

    test('should update department code', async () => {
      const created = await client.departments.create.mutate(departmentScenarios.complete());
      cleanup.track('department', created.id);

      const newCode = `NEW-${testId().slice(-6)}`;
      const updated = await client.departments.update.mutate({
        id: created.id,
        data: { code: newCode },
      });

      expect(updated.code).toBe(newCode);
    });

    test('should throw NOT_FOUND for non-existent department', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.departments.update.mutate({
          id: fakeId,
          data: { name: 'New Name' },
        })
      ).rejects.toThrow();
    });
  });

  test.describe('departments.delete', () => {
    test('should delete department successfully', async () => {
      const created = await client.departments.create.mutate(departmentScenarios.minimal());

      const result = await client.departments.delete.mutate({ id: created.id });
      expect(result).toEqual({ success: true });

      await expect(
        client.departments.get.query({ id: created.id })
      ).rejects.toThrow();
    });

    test('should throw NOT_FOUND for non-existent department', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.departments.delete.mutate({ id: fakeId })
      ).rejects.toThrow();
    });
  });
});
