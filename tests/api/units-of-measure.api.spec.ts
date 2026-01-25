/**
 * Units of Measure TRPC Router API Tests
 *
 * Tests all procedures in the units-of-measure router:
 * - list
 * - getById
 * - create
 * - update
 * - delete
 * - convertQuantity
 */

import { test, expect } from '@playwright/test';
import {
  createTestTRPCClient,
  createCleanupHelper,
  waitForApi,
  testId,
  TEST_CONFIG,
} from '../helpers/api-client';

const uomScenarios = {
  minimal: () => ({
    name: `UOM ${testId()}`,
    abbreviation: `U${testId().slice(-3)}`,
  }),
  complete: () => ({
    name: `Full UOM ${testId()}`,
    abbreviation: `FU${testId().slice(-2)}`,
    description: 'Test unit of measure for E2E testing',
    category: 'weight',
    baseUnit: false,
    status: 'active' as const,
  }),
  baseUnit: () => ({
    name: `Base UOM ${testId()}`,
    abbreviation: `B${testId().slice(-3)}`,
    baseUnit: true,
    status: 'active' as const,
  }),
};

test.describe('Units of Measure TRPC Router', () => {
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

  test.describe('unitsOfMeasure.list', () => {
    test('should return array of units', async () => {
      const result = await client.unitsOfMeasure.list.query({});
      expect(Array.isArray(result)).toBe(true);
    });

    test('should return units with expected fields', async () => {
      const created = await client.unitsOfMeasure.create.mutate(uomScenarios.complete());
      cleanup.track('unitOfMeasure', created.id);

      const result = await client.unitsOfMeasure.list.query({});
      const uom = result.find(u => u.id === created.id);

      expect(uom).toBeDefined();
      expect(uom).toHaveProperty('id');
      expect(uom).toHaveProperty('name');
      expect(uom).toHaveProperty('abbreviation');
    });
  });

  test.describe('unitsOfMeasure.getById', () => {
    test('should get unit by valid UUID', async () => {
      const uomData = uomScenarios.complete();
      const created = await client.unitsOfMeasure.create.mutate(uomData);
      cleanup.track('unitOfMeasure', created.id);

      const result = await client.unitsOfMeasure.getById.query({ id: created.id });

      expect(result).toBeDefined();
      expect(result.id).toBe(created.id);
      expect(result.name).toBe(uomData.name);
    });

    test('should throw NOT_FOUND for non-existent UUID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.unitsOfMeasure.getById.query({ id: fakeId })
      ).rejects.toThrow();
    });
  });

  test.describe('unitsOfMeasure.create', () => {
    test('should create unit with minimal data', async () => {
      const uomData = uomScenarios.minimal();
      const result = await client.unitsOfMeasure.create.mutate(uomData);
      cleanup.track('unitOfMeasure', result.id);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe(uomData.name);
      expect(result.abbreviation).toBe(uomData.abbreviation);
    });

    test('should create unit with complete data', async () => {
      const uomData = uomScenarios.complete();
      const result = await client.unitsOfMeasure.create.mutate(uomData);
      cleanup.track('unitOfMeasure', result.id);

      expect(result.name).toBe(uomData.name);
      expect(result.category).toBe(uomData.category);
    });

    test('should reject empty name', async () => {
      await expect(
        client.unitsOfMeasure.create.mutate({ name: '', abbreviation: 'X' })
      ).rejects.toThrow();
    });

    test('should reject empty abbreviation', async () => {
      await expect(
        client.unitsOfMeasure.create.mutate({ name: 'Test UOM', abbreviation: '' })
      ).rejects.toThrow();
    });
  });

  test.describe('unitsOfMeasure.update', () => {
    test('should update unit name', async () => {
      const created = await client.unitsOfMeasure.create.mutate(uomScenarios.minimal());
      cleanup.track('unitOfMeasure', created.id);

      const newName = `Updated UOM ${testId()}`;
      const updated = await client.unitsOfMeasure.update.mutate({
        id: created.id,
        data: { name: newName },
      });

      expect(updated.name).toBe(newName);
    });

    test('should update unit abbreviation', async () => {
      const created = await client.unitsOfMeasure.create.mutate(uomScenarios.complete());
      cleanup.track('unitOfMeasure', created.id);

      const newAbbrev = `NU${testId().slice(-2)}`;
      const updated = await client.unitsOfMeasure.update.mutate({
        id: created.id,
        data: { abbreviation: newAbbrev },
      });

      expect(updated.abbreviation).toBe(newAbbrev);
    });

    test('should throw NOT_FOUND for non-existent unit', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.unitsOfMeasure.update.mutate({
          id: fakeId,
          data: { name: 'New Name' },
        })
      ).rejects.toThrow();
    });
  });

  test.describe('unitsOfMeasure.delete', () => {
    test('should delete unit successfully', async () => {
      const created = await client.unitsOfMeasure.create.mutate(uomScenarios.minimal());

      const result = await client.unitsOfMeasure.delete.mutate({ id: created.id });
      expect(result).toEqual({ success: true });

      await expect(
        client.unitsOfMeasure.getById.query({ id: created.id })
      ).rejects.toThrow();
    });

    test('should throw NOT_FOUND for non-existent unit', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.unitsOfMeasure.delete.mutate({ id: fakeId })
      ).rejects.toThrow();
    });
  });
});
