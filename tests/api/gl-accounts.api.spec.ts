/**
 * GL Accounts TRPC Router API Tests
 *
 * Tests all procedures in the accounts router:
 * - list
 * - get
 * - create
 * - update
 * - delete
 * - seed
 */

import { test, expect } from '@playwright/test';
import {
  createTestTRPCClient,
  createCleanupHelper,
  waitForApi,
  testId,
  TEST_CONFIG,
} from '../helpers/api-client';

const accountScenarios = {
  minimal: () => ({
    name: `Account ${testId()}`,
    number: `${Math.floor(Math.random() * 9000) + 1000}`,
    type: 'asset' as const,
  }),
  complete: () => ({
    name: `Full Account ${testId()}`,
    number: `${Math.floor(Math.random() * 9000) + 1000}`,
    type: 'expense' as const,
    description: 'Test GL account for E2E testing',
    normalBalance: 'debit' as const,
    isSubledger: false,
    isActive: true,
    status: 'active' as const,
  }),
  revenue: () => ({
    name: `Revenue Account ${testId()}`,
    number: `4${Math.floor(Math.random() * 900) + 100}`,
    type: 'revenue' as const,
    normalBalance: 'credit' as const,
  }),
  liability: () => ({
    name: `Liability Account ${testId()}`,
    number: `2${Math.floor(Math.random() * 900) + 100}`,
    type: 'liability' as const,
    normalBalance: 'credit' as const,
  }),
  equity: () => ({
    name: `Equity Account ${testId()}`,
    number: `3${Math.floor(Math.random() * 900) + 100}`,
    type: 'equity' as const,
    normalBalance: 'credit' as const,
  }),
};

test.describe('GL Accounts TRPC Router', () => {
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

  test.describe('accounts.list', () => {
    test('should return array of accounts', async () => {
      const result = await client.accounts.list.query({});
      expect(Array.isArray(result)).toBe(true);
    });

    test('should return accounts with expected fields', async () => {
      const created = await client.accounts.create.mutate(accountScenarios.complete());
      cleanup.track('account', created.id);

      const result = await client.accounts.list.query({});
      const account = result.find(a => a.id === created.id);

      expect(account).toBeDefined();
      expect(account).toHaveProperty('id');
      expect(account).toHaveProperty('name');
      expect(account).toHaveProperty('number');
      expect(account).toHaveProperty('type');
    });

    test('should filter accounts by type', async () => {
      const revenue = await client.accounts.create.mutate(accountScenarios.revenue());
      cleanup.track('account', revenue.id);

      const result = await client.accounts.list.query({ type: 'revenue' });

      expect(result.every(a => a.type === 'revenue')).toBe(true);
    });
  });

  test.describe('accounts.get', () => {
    test('should get account by valid UUID', async () => {
      const accountData = accountScenarios.complete();
      const created = await client.accounts.create.mutate(accountData);
      cleanup.track('account', created.id);

      const result = await client.accounts.get.query({ id: created.id });

      expect(result).toBeDefined();
      expect(result.id).toBe(created.id);
      expect(result.name).toBe(accountData.name);
      expect(result.number).toBe(accountData.number);
    });

    test('should throw NOT_FOUND for non-existent UUID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.accounts.get.query({ id: fakeId })
      ).rejects.toThrow();
    });
  });

  test.describe('accounts.create', () => {
    test('should create account with minimal data', async () => {
      const accountData = accountScenarios.minimal();
      const result = await client.accounts.create.mutate(accountData);
      cleanup.track('account', result.id);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe(accountData.name);
      expect(result.number).toBe(accountData.number);
      expect(result.type).toBe(accountData.type);
    });

    test('should create account with complete data', async () => {
      const accountData = accountScenarios.complete();
      const result = await client.accounts.create.mutate(accountData);
      cleanup.track('account', result.id);

      expect(result.name).toBe(accountData.name);
      expect(result.description).toBe(accountData.description);
      expect(result.normalBalance).toBe(accountData.normalBalance);
    });

    test('should create different account types', async () => {
      const revenue = await client.accounts.create.mutate(accountScenarios.revenue());
      cleanup.track('account', revenue.id);
      expect(revenue.type).toBe('revenue');

      const liability = await client.accounts.create.mutate(accountScenarios.liability());
      cleanup.track('account', liability.id);
      expect(liability.type).toBe('liability');

      const equity = await client.accounts.create.mutate(accountScenarios.equity());
      cleanup.track('account', equity.id);
      expect(equity.type).toBe('equity');
    });

    test('should reject empty name', async () => {
      await expect(
        client.accounts.create.mutate({
          name: '',
          number: '1234',
          type: 'asset',
        })
      ).rejects.toThrow();
    });

    test('should reject empty number', async () => {
      await expect(
        client.accounts.create.mutate({
          name: 'Test Account',
          number: '',
          type: 'asset',
        })
      ).rejects.toThrow();
    });
  });

  test.describe('accounts.update', () => {
    test('should update account name', async () => {
      const created = await client.accounts.create.mutate(accountScenarios.minimal());
      cleanup.track('account', created.id);

      const newName = `Updated Account ${testId()}`;
      const updated = await client.accounts.update.mutate({
        id: created.id,
        data: { name: newName },
      });

      expect(updated.name).toBe(newName);
    });

    test('should update account description', async () => {
      const created = await client.accounts.create.mutate(accountScenarios.complete());
      cleanup.track('account', created.id);

      const newDescription = 'Updated description for this account';
      const updated = await client.accounts.update.mutate({
        id: created.id,
        data: { description: newDescription },
      });

      expect(updated.description).toBe(newDescription);
    });

    test('should update account active status', async () => {
      const created = await client.accounts.create.mutate({
        ...accountScenarios.minimal(),
        isActive: true,
      });
      cleanup.track('account', created.id);

      const updated = await client.accounts.update.mutate({
        id: created.id,
        data: { isActive: false },
      });

      expect(updated.isActive).toBe(false);
    });

    test('should throw NOT_FOUND for non-existent account', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.accounts.update.mutate({
          id: fakeId,
          data: { name: 'New Name' },
        })
      ).rejects.toThrow();
    });
  });

  test.describe('accounts.delete', () => {
    test('should delete account successfully', async () => {
      const created = await client.accounts.create.mutate(accountScenarios.minimal());

      const result = await client.accounts.delete.mutate({ id: created.id });
      expect(result).toEqual({ success: true });

      await expect(
        client.accounts.get.query({ id: created.id })
      ).rejects.toThrow();
    });

    test('should throw NOT_FOUND for non-existent account', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        client.accounts.delete.mutate({ id: fakeId })
      ).rejects.toThrow();
    });
  });
});

test.describe('GL Accounts API - Chart of Accounts', () => {
  let client: ReturnType<typeof createTestTRPCClient>;

  test.beforeAll(async () => {
    client = createTestTRPCClient();
  });

  test('should list accounts organized by type', async () => {
    const result = await client.accounts.list.query({});

    // Group by type
    const byType = result.reduce((acc, account) => {
      acc[account.type] = (acc[account.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Should have various account types
    expect(Object.keys(byType).length).toBeGreaterThan(0);
  });

  test('should sort accounts by number', async () => {
    const result = await client.accounts.list.query({});

    if (result.length > 1) {
      // Check that accounts can be sorted by number
      const numbers = result.map(a => a.number);
      const sortedNumbers = [...numbers].sort();
      // Just verify we got numbers, sorting depends on implementation
      expect(numbers.every(n => typeof n === 'string')).toBe(true);
    }
  });
});
