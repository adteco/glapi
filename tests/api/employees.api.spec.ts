/**
 * Employees TRPC Router API Tests
 *
 * Tests all procedures in the employees router:
 * - list
 * - getById
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

const employeeScenarios = {
  minimal: () => ({
    firstName: `First${testId().slice(-4)}`,
    lastName: `Last${testId().slice(-4)}`,
  }),
  complete: () => ({
    firstName: `John${testId().slice(-4)}`,
    lastName: `Doe${testId().slice(-4)}`,
    email: `employee-${testId()}@test.example.com`,
    phone: '555-123-4567',
    title: 'Software Engineer',
    department: 'Engineering',
    hireDate: new Date().toISOString().split('T')[0],
    status: 'active' as const,
  }),
  inactive: () => ({
    firstName: `Inactive${testId().slice(-4)}`,
    lastName: `Employee${testId().slice(-4)}`,
    status: 'inactive' as const,
  }),
};

test.describe('Employees TRPC Router', () => {
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

  test.describe('employees.list', () => {
    test('should return array of employees', async () => {
      const result = await client.employees.list.query({});
      expect(Array.isArray(result)).toBe(true);
    });

    test('should return employees with expected fields', async () => {
      const created = await client.employees.create.mutate(employeeScenarios.complete());
      cleanup.track('employee', created.id);

      const result = await client.employees.list.query({});
      const employee = result.find(e => e.id === created.id);

      expect(employee).toBeDefined();
      expect(employee).toHaveProperty('id');
      expect(employee).toHaveProperty('firstName');
      expect(employee).toHaveProperty('lastName');
    });
  });

  test.describe('employees.getById', () => {
    test('should get employee by valid UUID', async () => {
      const empData = employeeScenarios.complete();
      const created = await client.employees.create.mutate(empData);
      cleanup.track('employee', created.id);

      const result = await client.employees.getById.query({ id: created.id });

      expect(result).toBeDefined();
      expect(result.id).toBe(created.id);
      expect(result.firstName).toBe(empData.firstName);
    });

    test('should throw NOT_FOUND for non-existent UUID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.employees.getById.query({ id: fakeId })
      ).rejects.toThrow();
    });
  });

  test.describe('employees.create', () => {
    test('should create employee with minimal data', async () => {
      const empData = employeeScenarios.minimal();
      const result = await client.employees.create.mutate(empData);
      cleanup.track('employee', result.id);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.firstName).toBe(empData.firstName);
      expect(result.lastName).toBe(empData.lastName);
    });

    test('should create employee with complete data', async () => {
      const empData = employeeScenarios.complete();
      const result = await client.employees.create.mutate(empData);
      cleanup.track('employee', result.id);

      expect(result.firstName).toBe(empData.firstName);
      expect(result.email).toBe(empData.email);
      expect(result.title).toBe(empData.title);
    });

    test('should reject empty first name', async () => {
      await expect(
        client.employees.create.mutate({ firstName: '', lastName: 'Test' })
      ).rejects.toThrow();
    });

    test('should reject empty last name', async () => {
      await expect(
        client.employees.create.mutate({ firstName: 'Test', lastName: '' })
      ).rejects.toThrow();
    });
  });

  test.describe('employees.update', () => {
    test('should update employee name', async () => {
      const created = await client.employees.create.mutate(employeeScenarios.minimal());
      cleanup.track('employee', created.id);

      const newFirstName = `Updated${testId().slice(-4)}`;
      const updated = await client.employees.update.mutate({
        id: created.id,
        data: { firstName: newFirstName },
      });

      expect(updated.firstName).toBe(newFirstName);
    });

    test('should update employee email and title', async () => {
      const created = await client.employees.create.mutate(employeeScenarios.complete());
      cleanup.track('employee', created.id);

      const newEmail = `updated-${testId()}@test.example.com`;
      const newTitle = 'Senior Engineer';
      const updated = await client.employees.update.mutate({
        id: created.id,
        data: { email: newEmail, title: newTitle },
      });

      expect(updated.email).toBe(newEmail);
      expect(updated.title).toBe(newTitle);
    });

    test('should update employee status', async () => {
      const created = await client.employees.create.mutate({
        ...employeeScenarios.minimal(),
        status: 'active',
      });
      cleanup.track('employee', created.id);

      const updated = await client.employees.update.mutate({
        id: created.id,
        data: { status: 'inactive' },
      });

      expect(updated.status).toBe('inactive');
    });

    test('should throw NOT_FOUND for non-existent employee', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.employees.update.mutate({
          id: fakeId,
          data: { firstName: 'New' },
        })
      ).rejects.toThrow();
    });
  });

  test.describe('employees.delete', () => {
    test('should delete employee successfully', async () => {
      const created = await client.employees.create.mutate(employeeScenarios.minimal());

      const result = await client.employees.delete.mutate({ id: created.id });
      expect(result).toEqual({ success: true });

      await expect(
        client.employees.getById.query({ id: created.id })
      ).rejects.toThrow();
    });

    test('should throw NOT_FOUND for non-existent employee', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.employees.delete.mutate({ id: fakeId })
      ).rejects.toThrow();
    });
  });
});
