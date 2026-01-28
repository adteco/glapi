/**
 * RLS Isolation Test - Units of Measure Table
 *
 * Verifies that Row Level Security properly isolates unit of measure data
 * between organizations.
 */

import { test, expect } from '@playwright/test';
import {
  createTestTRPCClient,
  testId,
  waitForApi,
  TEST_CONFIG,
} from '../helpers/api-client';

const ORG_B_CONFIG = {
  organizationId: '456c2475-2277-4d90-929b-ae694a2a8577',
  userId: 'api-key-user',
  apiKey: 'glapi_test_sk_orgb_0987654321fedcba',
};

test.describe('Units of Measure Table RLS Isolation', () => {
  let clientOrgA: ReturnType<typeof createTestTRPCClient>;
  let clientOrgB: ReturnType<typeof createTestTRPCClient>;
  let createdUomId: string | null = null;

  test.beforeAll(async () => {
    const apiReady = await waitForApi(10, 2000);
    if (!apiReady) {
      console.warn('API not available, tests may fail');
    }

    clientOrgA = createTestTRPCClient();
    clientOrgB = createTestTRPCClient({
      organizationId: ORG_B_CONFIG.organizationId,
      userId: ORG_B_CONFIG.userId,
      apiKey: ORG_B_CONFIG.apiKey,
    });
  });

  test.afterAll(async () => {
    if (createdUomId) {
      try {
        await clientOrgA.unitsOfMeasure.delete.mutate({ id: createdUomId });
      } catch (error) {
        console.log(`Cleanup: Unit of Measure ${createdUomId} already deleted or not found`);
      }
    }
  });

  test('Org A can create unit of measure and Org B cannot see it', async () => {
    const code = `RLS-UOM-${Date.now()}`;
    const name = `RLS-Test-UoM-${testId()}`;
    const abbreviation = `RLS${Date.now() % 1000}`;
    const created = await clientOrgA.unitsOfMeasure.create.mutate({
      code,
      name,
      abbreviation,
    });

    expect(created).toBeDefined();
    expect(created.id).toBeDefined();
    createdUomId = created.id;

    // Org A can retrieve their own unit of measure
    const orgAUom = await clientOrgA.unitsOfMeasure.get.query({ id: created.id });
    expect(orgAUom).toBeDefined();
    expect(orgAUom.name).toBe(name);

    // Org B cannot see Org A's unit of measure
    await expect(
      clientOrgB.unitsOfMeasure.get.query({ id: created.id })
    ).rejects.toThrow();
  });

  test('Org B cannot list Org A units of measure', async () => {
    if (!createdUomId) {
      const created = await clientOrgA.unitsOfMeasure.create.mutate({
        code: `RLS-UOM-L-${Date.now()}`,
        name: `RLS-Test-UoM-List-${testId()}`,
        abbreviation: `RLS${Date.now() % 1000}`,
      });
      createdUomId = created.id;
    }

    // Org A should see their unit of measure in the list
    const orgAList = await clientOrgA.unitsOfMeasure.list.query({ limit: 100 });
    const orgAUomInList = orgAList.data.find(uom => uom.id === createdUomId);
    expect(orgAUomInList).toBeDefined();

    // Org B should NOT see Org A's unit of measure in their list
    const orgBList = await clientOrgB.unitsOfMeasure.list.query({ limit: 100 });
    const orgBUomInList = orgBList.data.find(uom => uom.id === createdUomId);
    expect(orgBUomInList).toBeUndefined();
  });

  test('Org B cannot update Org A unit of measure', async () => {
    if (!createdUomId) {
      const created = await clientOrgA.unitsOfMeasure.create.mutate({
        code: `RLS-UOM-U-${Date.now()}`,
        name: `RLS-Test-UoM-Update-${testId()}`,
        abbreviation: `RLS${Date.now() % 1000}`,
      });
      createdUomId = created.id;
    }

    // Org B should NOT be able to update Org A's unit of measure
    await expect(
      clientOrgB.unitsOfMeasure.update.mutate({
        id: createdUomId,
        data: { name: 'Hacked Name' },
      })
    ).rejects.toThrow();

    // Verify name was NOT changed
    const orgAUom = await clientOrgA.unitsOfMeasure.get.query({ id: createdUomId });
    expect(orgAUom.name).not.toBe('Hacked Name');
  });

  test('Org B cannot delete Org A unit of measure', async () => {
    const created = await clientOrgA.unitsOfMeasure.create.mutate({
      code: `RLS-UOM-D-${Date.now()}`,
      name: `RLS-Test-UoM-Delete-${testId()}`,
      abbreviation: `RLS${Date.now() % 1000}`,
    });

    // Org B should NOT be able to delete Org A's unit of measure
    await expect(
      clientOrgB.unitsOfMeasure.delete.mutate({ id: created.id })
    ).rejects.toThrow();

    // Verify unit of measure still exists for Org A
    const orgAUom = await clientOrgA.unitsOfMeasure.get.query({ id: created.id });
    expect(orgAUom).toBeDefined();

    // Clean up
    await clientOrgA.unitsOfMeasure.delete.mutate({ id: created.id });
  });

  test('Each organization only sees their own units of measure', async () => {
    const orgAUomName = `RLS-OrgA-UoM-${testId()}`;
    const orgBUomName = `RLS-OrgB-UoM-${testId()}`;

    const orgACreated = await clientOrgA.unitsOfMeasure.create.mutate({
      code: `RLS-UOM-A-${Date.now()}`,
      name: orgAUomName,
      abbreviation: `RLSA${Date.now() % 100}`,
    });

    const orgBCreated = await clientOrgB.unitsOfMeasure.create.mutate({
      code: `RLS-UOM-B-${Date.now()}`,
      name: orgBUomName,
      abbreviation: `RLSB${Date.now() % 100}`,
    });

    try {
      // Org A list should contain their unit of measure but not Org B's
      const orgAList = await clientOrgA.unitsOfMeasure.list.query({ limit: 100 });
      expect(orgAList.data.some(uom => uom.id === orgACreated.id)).toBe(true);
      expect(orgAList.data.some(uom => uom.id === orgBCreated.id)).toBe(false);

      // Org B list should contain their unit of measure but not Org A's
      const orgBList = await clientOrgB.unitsOfMeasure.list.query({ limit: 100 });
      expect(orgBList.data.some(uom => uom.id === orgBCreated.id)).toBe(true);
      expect(orgBList.data.some(uom => uom.id === orgACreated.id)).toBe(false);
    } finally {
      await clientOrgA.unitsOfMeasure.delete.mutate({ id: orgACreated.id });
      await clientOrgB.unitsOfMeasure.delete.mutate({ id: orgBCreated.id });
    }
  });
});
