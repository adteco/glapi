/**
 * Bank Feed Connector Tests
 *
 * Tests for Plaid and Yodlee bank feed connectors.
 * Uses mock HTTP clients for unit tests with sandbox API patterns.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlaidConnector, PlaidConnectorConfig } from '../plaid-connector';
import { YodleeConnector, YodleeConnectorConfig } from '../yodlee-connector';
import { BankFeedService, BankFeedServiceConfig } from '../bank-feed-service';
import type { HttpClientInterface } from '../connector-framework';

// ============================================================================
// Mock HTTP Client
// ============================================================================

class MockHttpClient implements HttpClientInterface {
  public requests: Array<{
    method: string;
    url: string;
    options: { headers?: Record<string, string>; body?: string; timeout?: number };
  }> = [];
  private responses: Array<{ status: number; body: string; headers: Record<string, string> }> = [];
  private requestCount = 0;

  setResponses(responses: Array<{ status: number; body: string; headers?: Record<string, string> }>) {
    this.responses = responses.map((r) => ({
      ...r,
      headers: r.headers ?? {},
    }));
    this.requestCount = 0;
  }

  addResponse(status: number, body: unknown, headers?: Record<string, string>) {
    this.responses.push({
      status,
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: headers ?? {},
    });
  }

  async request(
    method: string,
    url: string,
    options: { headers?: Record<string, string>; body?: string; timeout?: number }
  ): Promise<{ status: number; body: string; headers: Record<string, string> }> {
    this.requests.push({ method, url, options });
    const response = this.responses[this.requestCount] ?? { status: 200, body: '{}', headers: {} };
    this.requestCount++;
    return response;
  }

  async post(
    url: string,
    options: { headers?: Record<string, string>; body?: string; timeout?: number }
  ): Promise<{ status: number; body: string; headers: Record<string, string> }> {
    return this.request('POST', url, options);
  }

  async get(
    url: string,
    options?: { headers?: Record<string, string>; timeout?: number }
  ): Promise<{ status: number; body: string; headers: Record<string, string> }> {
    return this.request('GET', url, options ?? {});
  }

  reset() {
    this.requests = [];
    this.responses = [];
    this.requestCount = 0;
  }

  getLastRequest() {
    return this.requests[this.requests.length - 1];
  }
}

// ============================================================================
// Test Data Fixtures
// ============================================================================

const mockPlaidAccount = {
  account_id: 'acc_123',
  balances: {
    available: 1000.0,
    current: 1100.0,
    iso_currency_code: 'USD',
    limit: null,
    unofficial_currency_code: null,
  },
  mask: '1234',
  name: 'Checking Account',
  official_name: 'Plaid Gold Checking',
  type: 'depository',
  subtype: 'checking',
};

const mockPlaidTransaction = {
  transaction_id: 'txn_123',
  account_id: 'acc_123',
  amount: -50.0, // Plaid: negative = credit to user
  iso_currency_code: 'USD',
  unofficial_currency_code: null,
  category: ['Food and Drink', 'Restaurants'],
  category_id: '13005000',
  check_number: null,
  date: '2024-01-15',
  authorized_date: '2024-01-14',
  location: {
    address: '123 Main St',
    city: 'San Francisco',
    region: 'CA',
    postal_code: '94102',
    country: 'US',
    lat: 37.7749,
    lon: -122.4194,
    store_number: '001',
  },
  name: 'UBER EATS',
  merchant_name: 'Uber Eats',
  payment_channel: 'online',
  pending: false,
  pending_transaction_id: null,
  account_owner: null,
  transaction_type: 'special',
  transaction_code: null,
  personal_finance_category: {
    primary: 'FOOD_AND_DRINK',
    detailed: 'FOOD_AND_DRINK_RESTAURANT',
    confidence_level: 'VERY_HIGH',
  },
};

const mockYodleeAccount = {
  id: 456,
  accountName: 'My Checking',
  accountNumber: '****5678',
  accountType: 'CHECKING',
  accountStatus: 'ACTIVE',
  balance: { amount: 2500.0, currency: 'USD' },
  currentBalance: { amount: 2500.0, currency: 'USD' },
  availableBalance: { amount: 2400.0, currency: 'USD' },
  providerAccountId: 789,
  providerId: 123,
  providerName: 'Chase Bank',
  displayedName: 'Chase Checking',
  isAsset: true,
  includeInNetWorth: true,
  lastUpdated: '2024-01-15T10:00:00Z',
  createdDate: '2023-01-01T00:00:00Z',
};

const mockYodleeTransaction = {
  id: 1001,
  accountId: 456,
  amount: { amount: 75.5, currency: 'USD' },
  baseType: 'DEBIT',
  categoryType: 'Shopping',
  category: 'Merchandise',
  categoryId: 1,
  date: '2024-01-15',
  description: {
    original: 'AMAZON MARKETPLACE',
    consumer: 'Amazon Purchase',
    simple: 'Amazon',
  },
  isManual: false,
  merchant: {
    id: 'amzn_123',
    name: 'Amazon',
    categoryLabel: ['Shopping', 'Online'],
    address: {
      city: 'Seattle',
      state: 'WA',
      country: 'US',
    },
  },
  postDate: '2024-01-15',
  status: 'POSTED',
  transactionDate: '2024-01-15',
  type: 'PURCHASE',
};

// ============================================================================
// Plaid Connector Tests
// ============================================================================

describe('PlaidConnector', () => {
  let mockClient: MockHttpClient;
  let connector: PlaidConnector;
  const config: PlaidConnectorConfig = {
    id: 'plaid-test',
    name: 'Test Plaid',
    baseUrl: 'https://sandbox.plaid.com',
    clientId: 'test_client_id',
    secret: 'test_secret',
    environment: 'sandbox',
    webhookUrl: 'https://example.com/webhook',
  };

  beforeEach(() => {
    mockClient = new MockHttpClient();
    connector = new PlaidConnector({ organizationId: 'org_123', userId: 'user_456' }, config, mockClient);
  });

  describe('testConnection', () => {
    it('should return success when API responds', async () => {
      mockClient.addResponse(200, { categories: [] });

      const result = await connector.testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully connected');
      expect(mockClient.requests.length).toBe(1);
    });

    it('should return failure on API error', async () => {
      // Add multiple 500 responses to handle retry attempts
      mockClient.addResponse(500, { error: 'Internal error' });
      mockClient.addResponse(500, { error: 'Internal error' });
      mockClient.addResponse(500, { error: 'Internal error' });

      const result = await connector.testConnection();

      expect(result.success).toBe(false);
    });
  });

  describe('createLinkToken', () => {
    it('should create link token with correct parameters', async () => {
      const mockResponse = {
        link_token: 'link-sandbox-abc123',
        expiration: '2024-01-16T00:00:00Z',
        request_id: 'req_123',
      };
      mockClient.addResponse(200, mockResponse);

      const result = await connector.createLinkToken({
        clientUserId: 'user_123',
        clientName: 'Test App',
        products: ['transactions'],
        countryCodes: ['US'],
        language: 'en',
      });

      expect(result.linkToken).toBe('link-sandbox-abc123');
      expect(result.expiration).toBeInstanceOf(Date);

      const lastRequest = mockClient.getLastRequest();
      expect(lastRequest.url).toContain('/link/token/create');
      const body = JSON.parse(lastRequest.options.body ?? '{}');
      expect(body.user.client_user_id).toBe('user_123');
    });
  });

  describe('exchangePublicToken', () => {
    it('should exchange public token for access token', async () => {
      mockClient.addResponse(200, {
        access_token: 'access-sandbox-abc123',
        item_id: 'item_123',
        request_id: 'req_123',
      });

      const result = await connector.exchangePublicToken('public-sandbox-xyz');

      expect(result.accessToken).toBe('access-sandbox-abc123');
      expect(result.itemId).toBe('item_123');
    });
  });

  describe('getAccounts', () => {
    it('should fetch and normalize accounts', async () => {
      // First response: accounts/get
      mockClient.addResponse(200, {
        accounts: [mockPlaidAccount],
        item: { institution_id: 'ins_1' },
        request_id: 'req_123',
      });
      // Second response: institutions/get_by_id
      mockClient.addResponse(200, {
        institution: {
          institution_id: 'ins_1',
          name: 'Chase Bank',
          products: ['transactions'],
          country_codes: ['US'],
        },
        request_id: 'req_456',
      });

      const accounts = await connector.getAccounts('access-token');

      expect(accounts.length).toBe(1);
      expect(accounts[0].providerAccountId).toBe('acc_123');
      expect(accounts[0].provider).toBe('plaid');
      expect(accounts[0].name).toBe('Checking Account');
      expect(accounts[0].type).toBe('checking');
      expect(accounts[0].currentBalance).toBe(1100.0);
      expect(accounts[0].availableBalance).toBe(1000.0);
    });
  });

  describe('syncTransactions', () => {
    it('should sync transactions with cursor-based pagination', async () => {
      // accounts/get response
      mockClient.addResponse(200, {
        accounts: [mockPlaidAccount],
        item: { institution_id: 'ins_1', item_id: 'item_123' },
        request_id: 'req_123',
      });
      // transactions/sync response
      mockClient.addResponse(200, {
        added: [mockPlaidTransaction],
        modified: [],
        removed: [],
        next_cursor: 'cursor_abc',
        has_more: false,
        request_id: 'req_456',
      });

      const result = await connector.syncTransactions('access-token');

      expect(result.success).toBe(true);
      expect(result.transactionsAdded).toBe(1);
      expect(result.newCursor).toBe('cursor_abc');
      expect(result.hasMore).toBe(false);
      expect(result.provider).toBe('plaid');
    });

    it('should filter pending transactions when not requested', async () => {
      const pendingTxn = { ...mockPlaidTransaction, pending: true };
      mockClient.addResponse(200, {
        accounts: [mockPlaidAccount],
        item: { institution_id: 'ins_1', item_id: 'item_123' },
      });
      mockClient.addResponse(200, {
        added: [pendingTxn],
        modified: [],
        removed: [],
        next_cursor: 'cursor_xyz',
        has_more: false,
      });

      const result = await connector.syncTransactions('access-token', { includePending: false });

      expect(result.transactionsAdded).toBe(0);
    });

    it('should include pending transactions when requested', async () => {
      const pendingTxn = { ...mockPlaidTransaction, pending: true };
      mockClient.addResponse(200, {
        accounts: [mockPlaidAccount],
        item: { institution_id: 'ins_1', item_id: 'item_123' },
      });
      mockClient.addResponse(200, {
        added: [pendingTxn],
        modified: [],
        removed: [],
        next_cursor: 'cursor_xyz',
        has_more: false,
      });

      const result = await connector.syncTransactions('access-token', { includePending: true });

      expect(result.transactionsAdded).toBe(1);
    });
  });

  describe('transaction normalization', () => {
    it('should correctly normalize Plaid transaction amounts', async () => {
      // Plaid: negative amount = credit to user (e.g., refund)
      const creditTxn = { ...mockPlaidTransaction, amount: -50.0 };
      // Plaid: positive amount = debit from user (e.g., purchase)
      const debitTxn = { ...mockPlaidTransaction, transaction_id: 'txn_456', amount: 100.0 };

      mockClient.addResponse(200, {
        accounts: [mockPlaidAccount],
        item: { institution_id: 'ins_1', item_id: 'item_123' },
      });
      mockClient.addResponse(200, {
        added: [creditTxn, debitTxn],
        modified: [],
        removed: [],
        next_cursor: 'cursor_xyz',
        has_more: false,
      });

      const result = await connector.syncTransactions('access-token');

      expect(result.transactionsAdded).toBe(2);
      // After normalization: credit should be positive, debit should be negative
    });
  });

  describe('sandbox helpers', () => {
    it('should create sandbox public token', async () => {
      mockClient.addResponse(200, {
        public_token: 'public-sandbox-abc',
        request_id: 'req_123',
      });

      const publicToken = await connector.createSandboxPublicToken();

      expect(publicToken).toBe('public-sandbox-abc');
    });

    it('should throw error for sandbox methods in non-sandbox environment', async () => {
      const prodConnector = new PlaidConnector(
        { organizationId: 'org_123' },
        { ...config, environment: 'production' },
        mockClient
      );

      await expect(prodConnector.createSandboxPublicToken()).rejects.toThrow('sandbox');
    });
  });
});

// ============================================================================
// Yodlee Connector Tests
// ============================================================================

describe('YodleeConnector', () => {
  let mockClient: MockHttpClient;
  let connector: YodleeConnector;
  const config: YodleeConnectorConfig = {
    id: 'yodlee-test',
    name: 'Test Yodlee',
    baseUrl: 'https://sandbox.api.yodlee.com/ysl',
    clientId: 'test_client_id',
    clientSecret: 'test_secret',
    adminLoginName: 'admin_user',
    environment: 'sandbox',
  };

  beforeEach(() => {
    mockClient = new MockHttpClient();
    connector = new YodleeConnector({ organizationId: 'org_123', userId: 'user_456' }, config, mockClient);
  });

  describe('testConnection', () => {
    it('should return success when token is obtained', async () => {
      mockClient.addResponse(200, {
        token: {
          accessToken: 'admin_token_123',
          issuedAt: new Date().toISOString(),
          expiresIn: 1800,
        },
      });

      const result = await connector.testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully connected');
    });

    it('should return failure on token error', async () => {
      mockClient.addResponse(401, { error: 'Invalid credentials' });

      const result = await connector.testConnection();

      expect(result.success).toBe(false);
    });
  });

  describe('getUserToken', () => {
    it('should get and cache user token', async () => {
      mockClient.addResponse(200, {
        token: {
          accessToken: 'user_token_123',
          issuedAt: new Date().toISOString(),
          expiresIn: 1800,
        },
      });

      const token1 = await connector.getUserToken('test_user');
      expect(token1).toBe('user_token_123');

      // Should use cached token
      const token2 = await connector.getUserToken('test_user');
      expect(token2).toBe('user_token_123');
      expect(mockClient.requests.length).toBe(1); // Only one request made
    });

    it('should get new token for different user', async () => {
      mockClient.addResponse(200, {
        token: { accessToken: 'token_user1', issuedAt: new Date().toISOString(), expiresIn: 1800 },
      });
      mockClient.addResponse(200, {
        token: { accessToken: 'token_user2', issuedAt: new Date().toISOString(), expiresIn: 1800 },
      });

      const token1 = await connector.getUserToken('user1');
      const token2 = await connector.getUserToken('user2');

      expect(token1).toBe('token_user1');
      expect(token2).toBe('token_user2');
      expect(mockClient.requests.length).toBe(2);
    });
  });

  describe('getAccounts', () => {
    it('should fetch and normalize accounts', async () => {
      // Token response
      mockClient.addResponse(200, {
        token: { accessToken: 'user_token', issuedAt: new Date().toISOString(), expiresIn: 1800 },
      });
      // Accounts response
      mockClient.addResponse(200, { account: [mockYodleeAccount] });

      const accounts = await connector.getAccounts('test_user');

      expect(accounts.length).toBe(1);
      expect(accounts[0].providerAccountId).toBe('456');
      expect(accounts[0].provider).toBe('yodlee');
      expect(accounts[0].name).toBe('My Checking');
      expect(accounts[0].type).toBe('checking');
    });
  });

  describe('getTransactions', () => {
    it('should fetch and normalize transactions', async () => {
      mockClient.addResponse(200, {
        token: { accessToken: 'user_token', issuedAt: new Date().toISOString(), expiresIn: 1800 },
      });
      mockClient.addResponse(200, { transaction: [mockYodleeTransaction] });

      const transactions = await connector.getTransactions('test_user');

      expect(transactions.length).toBe(1);
      expect(transactions[0].providerTransactionId).toBe('1001');
      expect(transactions[0].provider).toBe('yodlee');
      expect(transactions[0].merchantName).toBe('Amazon');
      expect(transactions[0].amount).toBe(-75.5); // Debit should be negative
    });

    it('should apply date filters', async () => {
      mockClient.addResponse(200, {
        token: { accessToken: 'user_token', issuedAt: new Date().toISOString(), expiresIn: 1800 },
      });
      mockClient.addResponse(200, { transaction: [mockYodleeTransaction] });

      await connector.getTransactions('test_user', {
        fromDate: '2024-01-01',
        toDate: '2024-01-31',
      });

      const lastRequest = mockClient.getLastRequest();
      expect(lastRequest.url).toContain('fromDate');
      expect(lastRequest.url).toContain('toDate');
    });
  });

  describe('syncTransactions', () => {
    it('should sync transactions with pagination', async () => {
      // Token
      mockClient.addResponse(200, {
        token: { accessToken: 'user_token', issuedAt: new Date().toISOString(), expiresIn: 1800 },
      });
      // Transactions
      mockClient.addResponse(200, { transaction: [mockYodleeTransaction] });

      const result = await connector.syncTransactions('test_user', {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      });

      expect(result.success).toBe(true);
      expect(result.transactionsAdded).toBe(1);
      expect(result.provider).toBe('yodlee');
    });
  });

  describe('FastLink configuration', () => {
    it('should generate FastLink config', async () => {
      mockClient.addResponse(200, {
        token: { accessToken: 'user_token', issuedAt: new Date().toISOString(), expiresIn: 1800 },
      });

      const config = await connector.getFastLinkConfig('test_user');

      expect(config.fastLinkUrl).toContain('sandbox');
      expect(config.accessToken).toBe('user_token');
      expect(config.params.configName).toBe('Aggregation');
    });
  });
});

// ============================================================================
// Bank Feed Service Tests
// ============================================================================

describe('BankFeedService', () => {
  let mockPlaidClient: MockHttpClient;
  let mockYodleeClient: MockHttpClient;
  let service: BankFeedService;

  const plaidConfig: PlaidConnectorConfig = {
    id: 'plaid-test',
    name: 'Test Plaid',
    baseUrl: 'https://sandbox.plaid.com',
    clientId: 'test_client_id',
    secret: 'test_secret',
    environment: 'sandbox',
  };

  const yodleeConfig: YodleeConnectorConfig = {
    id: 'yodlee-test',
    name: 'Test Yodlee',
    baseUrl: 'https://sandbox.api.yodlee.com/ysl',
    clientId: 'test_client_id',
    clientSecret: 'test_secret',
    adminLoginName: 'admin_user',
    environment: 'sandbox',
  };

  beforeEach(() => {
    mockPlaidClient = new MockHttpClient();
    mockYodleeClient = new MockHttpClient();

    service = new BankFeedService(
      { organizationId: 'org_123', userId: 'user_456' },
      {
        plaid: plaidConfig,
        yodlee: yodleeConfig,
      }
    );
  });

  describe('provider configuration', () => {
    it('should report configured providers', () => {
      expect(service.isProviderConfigured('plaid')).toBe(true);
      expect(service.isProviderConfigured('yodlee')).toBe(true);
    });

    it('should throw for unconfigured provider access', () => {
      const serviceWithoutYodlee = new BankFeedService(
        { organizationId: 'org_123' },
        { plaid: plaidConfig }
      );

      expect(() => serviceWithoutYodlee.getYodleeConnector()).toThrow('not configured');
    });
  });

  describe('deduplication', () => {
    it('should detect exact duplicate by provider transaction ID', () => {
      // Manually add a transaction to the service's internal store
      // Note: In production, this would be database-backed
      const existingTxn = {
        id: 'txn_existing',
        providerTransactionId: 'plaid_txn_123',
        provider: 'plaid' as const,
        accountId: 'acc_123',
        amount: 50.0,
        direction: 'credit' as const,
        currency: 'USD',
        date: new Date('2024-01-15'),
        status: 'posted' as const,
        description: 'Test Transaction',
        organizationId: 'org_123',
        dedupeHash: 'hash_123',
        isReconciled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Access internal transactions map for testing
      (service as any).transactions.set(existingTxn.id, existingTxn);
      (service as any).dedupeIndex.set(existingTxn.dedupeHash, existingTxn.id);

      const newTxn = { ...existingTxn, id: 'new_id' };
      const result = service.checkDuplicate(newTxn);

      expect(result.isDuplicate).toBe(true);
      expect(result.matchType).toBe('exact');
      expect(result.confidence).toBe(1.0);
    });

    it('should detect probable duplicate by fuzzy match', () => {
      const existingTxn = {
        id: 'txn_existing',
        providerTransactionId: 'plaid_txn_old',
        provider: 'plaid' as const,
        accountId: 'acc_123',
        amount: 50.0,
        direction: 'credit' as const,
        currency: 'USD',
        date: new Date('2024-01-15'),
        status: 'posted' as const,
        description: 'UBER EATS payment',
        organizationId: 'org_123',
        dedupeHash: 'hash_old',
        isReconciled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (service as any).transactions.set(existingTxn.id, existingTxn);

      const newTxn = {
        ...existingTxn,
        id: 'new_id',
        providerTransactionId: 'plaid_txn_new', // Different provider ID
        dedupeHash: 'hash_new', // Different hash
        date: new Date('2024-01-16'), // Within fuzzy window
        description: 'UBER EATS', // Similar description
      };

      const result = service.checkDuplicate(newTxn);

      expect(result.isDuplicate).toBe(true);
      expect(result.matchType).toBe('probable');
    });

    it('should not detect duplicate for different transactions', () => {
      const existingTxn = {
        id: 'txn_existing',
        providerTransactionId: 'plaid_txn_123',
        provider: 'plaid' as const,
        accountId: 'acc_123',
        amount: 50.0,
        direction: 'credit' as const,
        currency: 'USD',
        date: new Date('2024-01-15'),
        status: 'posted' as const,
        description: 'UBER EATS',
        organizationId: 'org_123',
        dedupeHash: 'hash_123',
        isReconciled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (service as any).transactions.set(existingTxn.id, existingTxn);

      const newTxn = {
        ...existingTxn,
        id: 'new_id',
        providerTransactionId: 'plaid_txn_456',
        dedupeHash: 'hash_456',
        amount: 200.0, // Different amount
        description: 'AMAZON', // Different merchant
        date: new Date('2024-02-01'), // Outside fuzzy window
      };

      const result = service.checkDuplicate(newTxn);

      expect(result.isDuplicate).toBe(false);
    });
  });

  describe('GL mapping rules', () => {
    it('should apply mapping rules correctly', () => {
      const mapping = service.setGLMapping({
        bankAccountId: 'acc_123',
        defaultCashAccountId: 'gl_cash_123',
        rules: [
          {
            id: 'rule_1',
            name: 'Amazon purchases',
            priority: 1,
            conditions: [
              { field: 'merchantName', operator: 'contains', value: 'Amazon', caseSensitive: false },
            ],
            targetGLAccountId: 'gl_supplies_456',
            isActive: true,
          },
          {
            id: 'rule_2',
            name: 'Food expenses',
            priority: 2,
            conditions: [
              { field: 'categoryPrimary', operator: 'equals', value: 'food_and_drink', caseSensitive: false },
            ],
            targetGLAccountId: 'gl_meals_789',
            isActive: true,
          },
        ],
        autoPostEnabled: true,
      });

      const amazonTxn = {
        id: 'txn_1',
        providerTransactionId: 'plaid_1',
        provider: 'plaid' as const,
        accountId: 'acc_123',
        amount: -100,
        direction: 'debit' as const,
        currency: 'USD',
        date: new Date(),
        status: 'posted' as const,
        merchantName: 'AMAZON.COM',
        description: 'Amazon Purchase',
        organizationId: 'org_123',
        dedupeHash: 'hash_1',
        isReconciled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const glAccountId = service.applyMappingRules(amazonTxn, mapping);
      expect(glAccountId).toBe('gl_supplies_456');

      const foodTxn = {
        ...amazonTxn,
        merchantName: 'STARBUCKS',
        categoryPrimary: 'food_and_drink' as const,
      };

      const foodGlAccountId = service.applyMappingRules(foodTxn, mapping);
      expect(foodGlAccountId).toBe('gl_meals_789');
    });

    it('should return default account when no rules match', () => {
      const mapping = service.setGLMapping({
        bankAccountId: 'acc_123',
        defaultCashAccountId: 'gl_cash_123',
        rules: [],
        autoPostEnabled: false,
      });

      const txn = {
        id: 'txn_1',
        providerTransactionId: 'plaid_1',
        provider: 'plaid' as const,
        accountId: 'acc_123',
        amount: -50,
        direction: 'debit' as const,
        currency: 'USD',
        date: new Date(),
        status: 'posted' as const,
        description: 'Random Transaction',
        organizationId: 'org_123',
        dedupeHash: 'hash_1',
        isReconciled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const glAccountId = service.applyMappingRules(txn, mapping);
      expect(glAccountId).toBe('gl_cash_123');
    });
  });

  describe('reconciliation suggestions', () => {
    it('should suggest matches based on amount and date', () => {
      const bankTxn = {
        id: 'bank_txn_1',
        providerTransactionId: 'plaid_1',
        provider: 'plaid' as const,
        accountId: 'acc_123',
        amount: 100.0,
        direction: 'credit' as const,
        currency: 'USD',
        date: new Date('2024-01-15'),
        status: 'posted' as const,
        description: 'Client Payment',
        organizationId: 'org_123',
        dedupeHash: 'hash_1',
        isReconciled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (service as any).transactions.set(bankTxn.id, bankTxn);

      const glTransactions = [
        { id: 'gl_1', amount: 100.0, date: new Date('2024-01-15'), description: 'Client Payment' },
        { id: 'gl_2', amount: 100.0, date: new Date('2024-01-20'), description: 'Other Payment' },
        { id: 'gl_3', amount: 50.0, date: new Date('2024-01-15'), description: 'Client Payment' },
      ];

      const suggestions = service.getReconciliationSuggestions('bank_txn_1', glTransactions);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].glTransactionId).toBe('gl_1'); // Best match
      expect(suggestions[0].matchScore).toBeGreaterThan(suggestions[1]?.matchScore ?? 0);
    });
  });
});
