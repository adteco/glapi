/**
 * RLS Isolation Test - Accounts Table
 *
 * Verifies that Row Level Security properly isolates account data
 * between organizations.
 *
 * Table: accounts
 * Migration: 0058_enable_rls_accounts.sql
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

test.describe('Accounts Table RLS Isolation', () => {
  let clientOrgA: ReturnType<typeof createTestTRPCClient>;
  let clientOrgB: ReturnType<typeof createTestTRPCClient>;
  let createdAccountId: string | null = null;

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
    if (createdAccountId) {
      try {
        await clientOrgA.accounts.delete.mutate({ id: createdAccountId });
      } catch (error) {
        console.log(`Cleanup: Account ${createdAccountId} already deleted or not found`);
      }
    }
  });

  test('Org A can create account and Org B cannot see it', async () => {
    const accountNumber = `RLS-${Date.now()}`;
    const accountName = `RLS-Test-Account-${testId()}`;
    const created = await clientOrgA.accounts.create.mutate({
      accountNumber,
      accountName,
      accountCategory: 'Asset',
      isActive: true,
    });

    expect(created).toBeDefined();
    expect(created.id).toBeDefined();
    expect(created.organizationId).toBe(TEST_CONFIG.organizationId);
    createdAccountId = created.id;

    // Org A can retrieve their own account
    const orgAAccount = await clientOrgA.accounts.get.query({ id: created.id });
    expect(orgAAccount).toBeDefined();
    expect(orgAAccount.accountName).toBe(accountName);

    // Org B cannot see Org A's account
    await expect(
      clientOrgB.accounts.get.query({ id: created.id })
    ).rejects.toThrow();
  });

  test('Org B cannot list Org A accounts', async () => {
    if (!createdAccountId) {
      const created = await clientOrgA.accounts.create.mutate({
        accountNumber: `RLS-L-${Date.now()}`,
        accountName: `RLS-Test-Account-List-${testId()}`,
        accountCategory: 'Asset',
        isActive: true,
      });
      createdAccountId = created.id;
    }

    // Org A should see their account in the list (accounts returns paginated result with .data)
    // Use limit: 100 and orderBy: createdAt desc to ensure we see newly created accounts
    const orgAList = await clientOrgA.accounts.list.query({ limit: 100, orderBy: 'createdAt', orderDirection: 'desc' });
    const orgAAccountInList = orgAList.data.find(a => a.id === createdAccountId);
    expect(orgAAccountInList).toBeDefined();

    // Org B should NOT see Org A's account in their list
    const orgBList = await clientOrgB.accounts.list.query({ limit: 100, orderBy: 'createdAt', orderDirection: 'desc' });
    const orgBAccountInList = orgBList.data.find(a => a.id === createdAccountId);
    expect(orgBAccountInList).toBeUndefined();
  });

  test('Org B cannot update Org A account', async () => {
    if (!createdAccountId) {
      const created = await clientOrgA.accounts.create.mutate({
        accountNumber: `RLS-U-${Date.now()}`,
        accountName: `RLS-Test-Account-Update-${testId()}`,
        accountCategory: 'Asset',
        isActive: true,
      });
      createdAccountId = created.id;
    }

    // Org B should NOT be able to update Org A's account
    await expect(
      clientOrgB.accounts.update.mutate({
        id: createdAccountId,
        data: { accountName: 'Hacked Name' },
      })
    ).rejects.toThrow();

    // Verify name was NOT changed
    const orgAAccount = await clientOrgA.accounts.get.query({ id: createdAccountId });
    expect(orgAAccount.accountName).not.toBe('Hacked Name');
  });

  test('Org B cannot delete Org A account', async () => {
    const created = await clientOrgA.accounts.create.mutate({
      accountNumber: `RLS-D-${Date.now()}`,
      accountName: `RLS-Test-Account-Delete-${testId()}`,
      accountCategory: 'Asset',
      isActive: true,
    });

    // Org B should NOT be able to delete Org A's account
    await expect(
      clientOrgB.accounts.delete.mutate({ id: created.id })
    ).rejects.toThrow();

    // Verify account still exists for Org A
    const orgAAccount = await clientOrgA.accounts.get.query({ id: created.id });
    expect(orgAAccount).toBeDefined();

    // Clean up
    await clientOrgA.accounts.delete.mutate({ id: created.id });
  });

  test('Each organization only sees their own accounts', async () => {
    const orgAAccountName = `RLS-OrgA-Account-${testId()}`;
    const orgBAccountName = `RLS-OrgB-Account-${testId()}`;

    const orgACreated = await clientOrgA.accounts.create.mutate({
      accountNumber: `RLS-A-${Date.now()}`,
      accountName: orgAAccountName,
      accountCategory: 'Asset',
      isActive: true,
    });

    const orgBCreated = await clientOrgB.accounts.create.mutate({
      accountNumber: `RLS-B-${Date.now()}`,
      accountName: orgBAccountName,
      accountCategory: 'Asset',
      isActive: true,
    });

    try {
      // Org A list should contain their account but not Org B's (accounts returns paginated result with .data)
      // Use limit: 100 and orderBy: createdAt desc to ensure we see newly created accounts
      const orgAList = await clientOrgA.accounts.list.query({ limit: 100, orderBy: 'createdAt', orderDirection: 'desc' });
      expect(orgAList.data.some(a => a.id === orgACreated.id)).toBe(true);
      expect(orgAList.data.some(a => a.id === orgBCreated.id)).toBe(false);

      // Org B list should contain their account but not Org A's
      const orgBList = await clientOrgB.accounts.list.query({ limit: 100, orderBy: 'createdAt', orderDirection: 'desc' });
      expect(orgBList.data.some(a => a.id === orgBCreated.id)).toBe(true);
      expect(orgBList.data.some(a => a.id === orgACreated.id)).toBe(false);
    } finally {
      await clientOrgA.accounts.delete.mutate({ id: orgACreated.id });
      await clientOrgB.accounts.delete.mutate({ id: orgBCreated.id });
    }
  });
});
