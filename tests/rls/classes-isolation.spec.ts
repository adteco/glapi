/**
 * RLS Isolation Test - Classes Table
 *
 * Verifies that Row Level Security properly isolates class data
 * between organizations.
 *
 * Table: classes
 * Migration: 0055_enable_rls_classes.sql
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

test.describe('Classes Table RLS Isolation', () => {
  let clientOrgA: ReturnType<typeof createTestTRPCClient>;
  let clientOrgB: ReturnType<typeof createTestTRPCClient>;
  let createdClassId: string | null = null;

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
    if (createdClassId) {
      try {
        await clientOrgA.classes.delete.mutate({ id: createdClassId });
      } catch (error) {
        console.log(`Cleanup: Class ${createdClassId} already deleted or not found`);
      }
    }
  });

  test('Org A can create class and Org B cannot see it', async () => {
    const className = `RLS-Test-Class-${testId()}`;
    const created = await clientOrgA.classes.create.mutate({
      name: className,
      code: `RLS-${Date.now()}`,
      subsidiaryId: ORG_A_SUBSIDIARY_ID,
      isActive: true,
    });

    expect(created).toBeDefined();
    expect(created.id).toBeDefined();
    expect(created.organizationId).toBe(TEST_CONFIG.organizationId);
    createdClassId = created.id;

    // Org A can retrieve their own class
    const orgAClass = await clientOrgA.classes.get.query({ id: created.id });
    expect(orgAClass).toBeDefined();
    expect(orgAClass.name).toBe(className);

    // Org B cannot see Org A's class
    await expect(
      clientOrgB.classes.get.query({ id: created.id })
    ).rejects.toThrow();
  });

  test('Org B cannot list Org A classes', async () => {
    if (!createdClassId) {
      const created = await clientOrgA.classes.create.mutate({
        name: `RLS-Test-Class-List-${testId()}`,
        code: `RLS-L-${Date.now()}`,
        subsidiaryId: ORG_A_SUBSIDIARY_ID,
        isActive: true,
      });
      createdClassId = created.id;
    }

    // Org A should see their class in the list
    const orgAList = await clientOrgA.classes.list.query({});
    const orgAClassInList = orgAList.find(c => c.id === createdClassId);
    expect(orgAClassInList).toBeDefined();

    // Org B should NOT see Org A's class in their list
    const orgBList = await clientOrgB.classes.list.query({});
    const orgBClassInList = orgBList.find(c => c.id === createdClassId);
    expect(orgBClassInList).toBeUndefined();
  });

  test('Org B cannot update Org A class', async () => {
    if (!createdClassId) {
      const created = await clientOrgA.classes.create.mutate({
        name: `RLS-Test-Class-Update-${testId()}`,
        code: `RLS-U-${Date.now()}`,
        subsidiaryId: ORG_A_SUBSIDIARY_ID,
        isActive: true,
      });
      createdClassId = created.id;
    }

    // Org B should NOT be able to update Org A's class
    await expect(
      clientOrgB.classes.update.mutate({
        id: createdClassId,
        data: { name: 'Hacked Name' },
      })
    ).rejects.toThrow();

    // Verify name was NOT changed
    const orgAClass = await clientOrgA.classes.get.query({ id: createdClassId });
    expect(orgAClass.name).not.toBe('Hacked Name');
  });

  test('Org B cannot delete Org A class', async () => {
    const created = await clientOrgA.classes.create.mutate({
      name: `RLS-Test-Class-Delete-${testId()}`,
      code: `RLS-D-${Date.now()}`,
      subsidiaryId: ORG_A_SUBSIDIARY_ID,
      isActive: true,
    });

    // Org B should NOT be able to delete Org A's class
    await expect(
      clientOrgB.classes.delete.mutate({ id: created.id })
    ).rejects.toThrow();

    // Verify class still exists for Org A
    const orgAClass = await clientOrgA.classes.get.query({ id: created.id });
    expect(orgAClass).toBeDefined();

    // Clean up
    await clientOrgA.classes.delete.mutate({ id: created.id });
  });

  test('Each organization only sees their own classes', async () => {
    const orgAClassName = `RLS-OrgA-Class-${testId()}`;
    const orgBClassName = `RLS-OrgB-Class-${testId()}`;

    const orgACreated = await clientOrgA.classes.create.mutate({
      name: orgAClassName,
      code: `RLS-A-${Date.now()}`,
      subsidiaryId: ORG_A_SUBSIDIARY_ID,
      isActive: true,
    });

    const orgBCreated = await clientOrgB.classes.create.mutate({
      name: orgBClassName,
      code: `RLS-B-${Date.now()}`,
      subsidiaryId: ORG_B_SUBSIDIARY_ID,
      isActive: true,
    });

    try {
      // Org A list should contain their class but not Org B's
      const orgAList = await clientOrgA.classes.list.query({});
      expect(orgAList.some(c => c.id === orgACreated.id)).toBe(true);
      expect(orgAList.some(c => c.id === orgBCreated.id)).toBe(false);

      // Org B list should contain their class but not Org A's
      const orgBList = await clientOrgB.classes.list.query({});
      expect(orgBList.some(c => c.id === orgBCreated.id)).toBe(true);
      expect(orgBList.some(c => c.id === orgACreated.id)).toBe(false);
    } finally {
      await clientOrgA.classes.delete.mutate({ id: orgACreated.id });
      await clientOrgB.classes.delete.mutate({ id: orgBCreated.id });
    }
  });
});
