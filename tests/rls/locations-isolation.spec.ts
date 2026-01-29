/**
 * RLS Isolation Test - Locations Table
 *
 * Verifies that Row Level Security properly isolates location data
 * between organizations.
 *
 * Table: locations
 * Migration: 0056_enable_rls_locations.sql
 */

import { test, expect } from '@playwright/test';
import {
  createTestTRPCClient,
  testId,
  waitForApi,
  TEST_CONFIG,
} from '../helpers/api-client';

// Organization configs with subsidiary IDs
const ORG_A_SUBSIDIARY_ID = 'd90771e4-e372-4089-a567-f2e5684c3427'; // Adteco Default Subsidiary
const ORG_B_SUBSIDIARY_ID = 'e5f2c7a8-1234-5678-90ab-cdef12345678'; // CJD-Consulting Default Subsidiary

const ORG_B_CONFIG = {
  organizationId: '456c2475-2277-4d90-929b-ae694a2a8577',
  userId: 'api-key-user',
  apiKey: 'glapi_test_sk_orgb_0987654321fedcba',
};

test.describe('Locations Table RLS Isolation', () => {
  let clientOrgA: ReturnType<typeof createTestTRPCClient>;
  let clientOrgB: ReturnType<typeof createTestTRPCClient>;
  let createdLocationId: string | null = null;

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
    if (createdLocationId) {
      try {
        await clientOrgA.locations.delete.mutate({ id: createdLocationId });
      } catch (error) {
        console.log(`Cleanup: Location ${createdLocationId} already deleted or not found`);
      }
    }
  });

  test('Org A can create location and Org B cannot see it', async () => {
    const locationName = `RLS-Test-Location-${testId()}`;
    const created = await clientOrgA.locations.create.mutate({
      name: locationName,
      code: `RLS-${Date.now()}`,
      subsidiaryId: ORG_A_SUBSIDIARY_ID,
      isActive: true,
    });

    expect(created).toBeDefined();
    expect(created.id).toBeDefined();
    expect(created.organizationId).toBe(TEST_CONFIG.organizationId);
    createdLocationId = created.id;

    // Org A can retrieve their own location
    const orgALocation = await clientOrgA.locations.get.query({ id: created.id });
    expect(orgALocation).toBeDefined();
    expect(orgALocation.name).toBe(locationName);

    // Org B cannot see Org A's location
    await expect(
      clientOrgB.locations.get.query({ id: created.id })
    ).rejects.toThrow();
  });

  test('Org B cannot list Org A locations', async () => {
    if (!createdLocationId) {
      const created = await clientOrgA.locations.create.mutate({
        name: `RLS-Test-Location-List-${testId()}`,
        code: `RLS-L-${Date.now()}`,
        subsidiaryId: ORG_A_SUBSIDIARY_ID,
        isActive: true,
      });
      createdLocationId = created.id;
    }

    // Org A should see their location in the list
    const orgAList = await clientOrgA.locations.list.query({});
    const orgALocationInList = orgAList.find(l => l.id === createdLocationId);
    expect(orgALocationInList).toBeDefined();

    // Org B should NOT see Org A's location in their list
    const orgBList = await clientOrgB.locations.list.query({});
    const orgBLocationInList = orgBList.find(l => l.id === createdLocationId);
    expect(orgBLocationInList).toBeUndefined();
  });

  test('Org B cannot update Org A location', async () => {
    if (!createdLocationId) {
      const created = await clientOrgA.locations.create.mutate({
        name: `RLS-Test-Location-Update-${testId()}`,
        code: `RLS-U-${Date.now()}`,
        subsidiaryId: ORG_A_SUBSIDIARY_ID,
        isActive: true,
      });
      createdLocationId = created.id;
    }

    // Org B should NOT be able to update Org A's location
    await expect(
      clientOrgB.locations.update.mutate({
        id: createdLocationId,
        data: { name: 'Hacked Name' },
      })
    ).rejects.toThrow();

    // Verify name was NOT changed
    const orgALocation = await clientOrgA.locations.get.query({ id: createdLocationId });
    expect(orgALocation.name).not.toBe('Hacked Name');
  });

  test('Org B cannot delete Org A location', async () => {
    const created = await clientOrgA.locations.create.mutate({
      name: `RLS-Test-Location-Delete-${testId()}`,
      code: `RLS-D-${Date.now()}`,
      subsidiaryId: ORG_A_SUBSIDIARY_ID,
      isActive: true,
    });

    // Org B should NOT be able to delete Org A's location
    await expect(
      clientOrgB.locations.delete.mutate({ id: created.id })
    ).rejects.toThrow();

    // Verify location still exists for Org A
    const orgALocation = await clientOrgA.locations.get.query({ id: created.id });
    expect(orgALocation).toBeDefined();

    // Clean up
    await clientOrgA.locations.delete.mutate({ id: created.id });
  });

  test('Each organization only sees their own locations', async () => {
    const orgALocationName = `RLS-OrgA-Location-${testId()}`;
    const orgBLocationName = `RLS-OrgB-Location-${testId()}`;

    const orgACreated = await clientOrgA.locations.create.mutate({
      name: orgALocationName,
      code: `RLS-A-${Date.now()}`,
      subsidiaryId: ORG_A_SUBSIDIARY_ID,
      isActive: true,
    });

    const orgBCreated = await clientOrgB.locations.create.mutate({
      name: orgBLocationName,
      code: `RLS-B-${Date.now()}`,
      subsidiaryId: ORG_B_SUBSIDIARY_ID,
      isActive: true,
    });

    try {
      // Org A list should contain their location but not Org B's
      const orgAList = await clientOrgA.locations.list.query({});
      expect(orgAList.some(l => l.id === orgACreated.id)).toBe(true);
      expect(orgAList.some(l => l.id === orgBCreated.id)).toBe(false);

      // Org B list should contain their location but not Org A's
      const orgBList = await clientOrgB.locations.list.query({});
      expect(orgBList.some(l => l.id === orgBCreated.id)).toBe(true);
      expect(orgBList.some(l => l.id === orgACreated.id)).toBe(false);
    } finally {
      await clientOrgA.locations.delete.mutate({ id: orgACreated.id });
      await clientOrgB.locations.delete.mutate({ id: orgBCreated.id });
    }
  });
});
