/**
 * RLS Isolation Test - Subsidiaries Table
 *
 * Verifies that Row Level Security properly isolates subsidiary data
 * between organizations.
 *
 * Table: subsidiaries
 * Migration: 0057_enable_rls_subsidiaries.sql
 *
 * Note: Subsidiaries don't have a subsidiaryId field (they ARE subsidiaries)
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

test.describe('Subsidiaries Table RLS Isolation', () => {
  let clientOrgA: ReturnType<typeof createTestTRPCClient>;
  let clientOrgB: ReturnType<typeof createTestTRPCClient>;
  let createdSubsidiaryId: string | null = null;

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
    if (createdSubsidiaryId) {
      try {
        await clientOrgA.subsidiaries.delete.mutate({ id: createdSubsidiaryId });
      } catch (error) {
        console.log(`Cleanup: Subsidiary ${createdSubsidiaryId} already deleted or not found`);
      }
    }
  });

  test('Org A can create subsidiary and Org B cannot see it', async () => {
    const subsidiaryName = `RLS-Test-Subsidiary-${testId()}`;
    const created = await clientOrgA.subsidiaries.create.mutate({
      name: subsidiaryName,
      code: `RLS-${Date.now()}`,
      isActive: true,
    });

    expect(created).toBeDefined();
    expect(created.id).toBeDefined();
    expect(created.organizationId).toBe(TEST_CONFIG.organizationId);
    createdSubsidiaryId = created.id;

    // Org A can retrieve their own subsidiary
    const orgASubsidiary = await clientOrgA.subsidiaries.get.query({ id: created.id });
    expect(orgASubsidiary).toBeDefined();
    expect(orgASubsidiary.name).toBe(subsidiaryName);

    // Org B cannot see Org A's subsidiary
    await expect(
      clientOrgB.subsidiaries.get.query({ id: created.id })
    ).rejects.toThrow();
  });

  test('Org B cannot list Org A subsidiaries', async () => {
    if (!createdSubsidiaryId) {
      const created = await clientOrgA.subsidiaries.create.mutate({
        name: `RLS-Test-Subsidiary-List-${testId()}`,
        code: `RLS-L-${Date.now()}`,
        isActive: true,
      });
      createdSubsidiaryId = created.id;
    }

    // Org A should see their subsidiary in the list
    const orgAList = await clientOrgA.subsidiaries.list.query({});
    const orgASubsidiaryInList = orgAList.find(s => s.id === createdSubsidiaryId);
    expect(orgASubsidiaryInList).toBeDefined();

    // Org B should NOT see Org A's subsidiary in their list
    const orgBList = await clientOrgB.subsidiaries.list.query({});
    const orgBSubsidiaryInList = orgBList.find(s => s.id === createdSubsidiaryId);
    expect(orgBSubsidiaryInList).toBeUndefined();
  });

  test('Org B cannot update Org A subsidiary', async () => {
    if (!createdSubsidiaryId) {
      const created = await clientOrgA.subsidiaries.create.mutate({
        name: `RLS-Test-Subsidiary-Update-${testId()}`,
        code: `RLS-U-${Date.now()}`,
        isActive: true,
      });
      createdSubsidiaryId = created.id;
    }

    // Org B should NOT be able to update Org A's subsidiary
    await expect(
      clientOrgB.subsidiaries.update.mutate({
        id: createdSubsidiaryId,
        data: { name: 'Hacked Name' },
      })
    ).rejects.toThrow();

    // Verify name was NOT changed
    const orgASubsidiary = await clientOrgA.subsidiaries.get.query({ id: createdSubsidiaryId });
    expect(orgASubsidiary.name).not.toBe('Hacked Name');
  });

  test('Org B cannot delete Org A subsidiary', async () => {
    const created = await clientOrgA.subsidiaries.create.mutate({
      name: `RLS-Test-Subsidiary-Delete-${testId()}`,
      code: `RLS-D-${Date.now()}`,
      isActive: true,
    });

    // Org B should NOT be able to delete Org A's subsidiary
    await expect(
      clientOrgB.subsidiaries.delete.mutate({ id: created.id })
    ).rejects.toThrow();

    // Verify subsidiary still exists for Org A
    const orgASubsidiary = await clientOrgA.subsidiaries.get.query({ id: created.id });
    expect(orgASubsidiary).toBeDefined();

    // Clean up
    await clientOrgA.subsidiaries.delete.mutate({ id: created.id });
  });

  test('Each organization only sees their own subsidiaries', async () => {
    const orgASubsidiaryName = `RLS-OrgA-Subsidiary-${testId()}`;
    const orgBSubsidiaryName = `RLS-OrgB-Subsidiary-${testId()}`;

    const orgACreated = await clientOrgA.subsidiaries.create.mutate({
      name: orgASubsidiaryName,
      code: `RLS-A-${Date.now()}`,
      isActive: true,
    });

    const orgBCreated = await clientOrgB.subsidiaries.create.mutate({
      name: orgBSubsidiaryName,
      code: `RLS-B-${Date.now()}`,
      isActive: true,
    });

    try {
      // Org A list should contain their subsidiary but not Org B's
      const orgAList = await clientOrgA.subsidiaries.list.query({});
      expect(orgAList.some(s => s.id === orgACreated.id)).toBe(true);
      expect(orgAList.some(s => s.id === orgBCreated.id)).toBe(false);

      // Org B list should contain their subsidiary but not Org A's
      const orgBList = await clientOrgB.subsidiaries.list.query({});
      expect(orgBList.some(s => s.id === orgBCreated.id)).toBe(true);
      expect(orgBList.some(s => s.id === orgACreated.id)).toBe(false);
    } finally {
      await clientOrgA.subsidiaries.delete.mutate({ id: orgACreated.id });
      await clientOrgB.subsidiaries.delete.mutate({ id: orgBCreated.id });
    }
  });
});
