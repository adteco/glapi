/**
 * Yodlee Bank Connector
 *
 * Implements the Yodlee API integration for bank feed synchronization.
 * Uses the connector framework for auth, rate limiting, retries, and monitoring.
 */

import {
  BaseConnector,
  ConnectorServiceContext,
  ConnectorConfig,
  HttpClientInterface,
  DefaultHttpClient,
  connectorRegistry,
} from './connector-framework';

import type {
  BankFeedProvider,
  BankAccount,
  BankTransaction,
  BankAccountType,
  BankAccountSubtype,
  TransactionDirection,
  BankTransactionStatus,
  TransactionCategoryPrimary,
  YodleeProviderAccount,
  YodleeAccount,
  YodleeTransaction,
  YodleeTransactionsRequest,
  YodleeTransactionsResponse,
  YodleeFastLinkConfig,
  BankFeedSyncOptions,
  BankFeedSyncResult,
  BankAccountBalance,
} from '../types/bank-feed.types';

import type { ConnectionTestResult } from '../types/connector.types';

// ============================================================================
// Yodlee API Response Types
// ============================================================================

interface YodleeApiResponse<T> {
  [key: string]: T;
}

interface YodleeProviderAccountsResponse {
  providerAccount: YodleeProviderAccount[];
}

interface YodleeAccountsResponse {
  account: YodleeAccount[];
}

interface YodleeUserResponse {
  user: {
    id: number;
    loginName: string;
    email?: string;
    name?: {
      first: string;
      last: string;
    };
    preferences?: {
      currency: string;
      locale: string;
    };
  };
}

interface YodleeTokenResponse {
  token: {
    accessToken: string;
    issuedAt: string;
    expiresIn: number;
  };
}

// ============================================================================
// Yodlee Connector Configuration
// ============================================================================

/**
 * Yodlee-specific connector configuration
 */
export interface YodleeConnectorConfig extends Omit<ConnectorConfig, 'credentials' | 'type'> {
  /** Yodlee client ID */
  clientId: string;
  /** Yodlee client secret */
  clientSecret: string;
  /** Admin login name for API access */
  adminLoginName: string;
  /** Yodlee environment */
  environment: 'sandbox' | 'development' | 'production';
  /** FastLink callback URL */
  fastLinkCallbackUrl?: string;
  /** FastLink configuration name */
  fastLinkConfigName?: string;
}

/**
 * Get base URL for Yodlee environment
 */
function getYodleeBaseUrl(environment: YodleeConnectorConfig['environment']): string {
  switch (environment) {
    case 'sandbox':
      return 'https://sandbox.api.yodlee.com/ysl';
    case 'development':
      return 'https://development.api.yodlee.com/ysl';
    case 'production':
      return 'https://api.yodlee.com/ysl';
    default:
      return 'https://sandbox.api.yodlee.com/ysl';
  }
}

// ============================================================================
// Yodlee Connector Implementation
// ============================================================================

/**
 * Yodlee bank connector for bank feed integration
 */
export class YodleeConnector extends BaseConnector {
  private clientId: string;
  private clientSecret: string;
  private adminLoginName: string;
  private environment: YodleeConnectorConfig['environment'];
  private fastLinkCallbackUrl?: string;
  private fastLinkConfigName: string;
  private userAccessToken?: string;
  private tokenExpiresAt?: Date;
  private currentUserLoginName?: string;

  constructor(
    context: ConnectorServiceContext,
    config: YodleeConnectorConfig,
    httpClient?: HttpClientInterface
  ) {
    // Convert to full ConnectorConfig
    const fullConfig: ConnectorConfig = {
      ...config,
      type: 'yodlee',
      baseUrl: getYodleeBaseUrl(config.environment),
      apiVersion: 'v1',
      defaultTimeoutMs: config.defaultTimeoutMs ?? 30000,
      credentials: {
        method: 'custom',
        customData: {
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          adminLoginName: config.adminLoginName,
        },
      },
      rateLimit: config.rateLimit ?? {
        maxRequests: 10,
        window: 'second',
        queueWhenLimited: true,
        respectRetryAfter: true,
      },
      retryPolicy: config.retryPolicy ?? {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        backoffStrategy: 'exponential',
        retryableStatusCodes: [429, 500, 502, 503, 504],
      },
      circuitBreaker: config.circuitBreaker ?? {
        enabled: true,
        failureThreshold: 5,
        successThreshold: 3,
        resetTimeoutMs: 30000,
        windowSize: 10,
      },
    };

    super(context, fullConfig, httpClient);

    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.adminLoginName = config.adminLoginName;
    this.environment = config.environment;
    this.fastLinkCallbackUrl = config.fastLinkCallbackUrl;
    this.fastLinkConfigName = config.fastLinkConfigName ?? 'Aggregation';
  }

  /**
   * Test connection to Yodlee API
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    try {
      // Test by getting an admin token
      const token = await this.getAdminToken();
      return {
        success: !!token,
        latencyMs: Date.now() - startTime,
        message: 'Successfully connected to Yodlee API',
        details: { environment: this.environment },
      };
    } catch (error) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        message: error instanceof Error ? error.message : 'Failed to connect to Yodlee',
        details: { error },
      };
    }
  }

  // ============================================================================
  // Authentication
  // ============================================================================

  /**
   * Get admin access token (for admin operations)
   */
  private async getAdminToken(): Promise<string> {
    const httpClient = this.httpClient;

    const body = new URLSearchParams({
      clientId: this.clientId,
      secret: this.clientSecret,
    }).toString();

    const response = await httpClient.post(`${this.config.baseUrl}/auth/token`, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Api-Version': '1.1',
        loginName: this.adminLoginName,
      },
      body,
    });

    if (response.status !== 200) {
      throw new Error(`Failed to get admin token: ${response.body}`);
    }

    const data: YodleeTokenResponse = JSON.parse(response.body);
    return data.token.accessToken;
  }

  /**
   * Get user access token for API calls on behalf of a user
   */
  async getUserToken(userLoginName: string): Promise<string> {
    // Return cached token if still valid
    if (
      this.userAccessToken &&
      this.tokenExpiresAt &&
      this.currentUserLoginName === userLoginName &&
      Date.now() < this.tokenExpiresAt.getTime() - 60000 // 1 minute buffer
    ) {
      return this.userAccessToken;
    }

    const httpClient = this.httpClient;

    const body = new URLSearchParams({
      clientId: this.clientId,
      secret: this.clientSecret,
    }).toString();

    const response = await httpClient.post(`${this.config.baseUrl}/auth/token`, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Api-Version': '1.1',
        loginName: userLoginName,
      },
      body,
    });

    if (response.status !== 200) {
      throw new Error(`Failed to get user token: ${response.body}`);
    }

    const data: YodleeTokenResponse = JSON.parse(response.body);
    this.userAccessToken = data.token.accessToken;
    this.tokenExpiresAt = new Date(Date.now() + data.token.expiresIn * 1000);
    this.currentUserLoginName = userLoginName;

    return this.userAccessToken;
  }

  /**
   * Make authenticated Yodlee API request
   */
  private async yodleeRequest<T>(
    path: string,
    userLoginName: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: Record<string, unknown>;
      params?: Record<string, string | number | boolean>;
    } = {}
  ): Promise<T> {
    const token = await this.getUserToken(userLoginName);
    const method = options.method ?? 'GET';

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Api-Version': '1.1',
    };

    if (method !== 'GET' && options.body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await this.request<T>({
      method,
      path,
      headers,
      params: options.params as Record<string, string | number | boolean | undefined>,
      body: options.body,
      skipAuth: true,
    });

    return response.data;
  }

  // ============================================================================
  // User Management
  // ============================================================================

  /**
   * Register a new Yodlee user
   */
  async registerUser(userLoginName: string, email?: string): Promise<YodleeUserResponse['user']> {
    const adminToken = await this.getAdminToken();
    const httpClient = this.httpClient;

    const body: Record<string, unknown> = {
      user: {
        loginName: userLoginName,
      },
    };

    if (email) {
      (body.user as Record<string, unknown>).email = email;
    }

    const response = await httpClient.post(`${this.config.baseUrl}/user/register`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Api-Version': '1.1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (response.status !== 200 && response.status !== 201) {
      throw new Error(`Failed to register user: ${response.body}`);
    }

    const data: YodleeUserResponse = JSON.parse(response.body);
    return data.user;
  }

  /**
   * Get user details
   */
  async getUser(userLoginName: string): Promise<YodleeUserResponse['user']> {
    const response = await this.yodleeRequest<YodleeUserResponse>('/user', userLoginName);
    return response.user;
  }

  /**
   * Delete a Yodlee user
   */
  async deleteUser(userLoginName: string): Promise<void> {
    await this.yodleeRequest('/user/unregister', userLoginName, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // FastLink Configuration
  // ============================================================================

  /**
   * Get FastLink configuration for linking accounts
   */
  async getFastLinkConfig(userLoginName: string): Promise<YodleeFastLinkConfig> {
    const token = await this.getUserToken(userLoginName);

    const fastLinkUrl = this.environment === 'sandbox'
      ? 'https://fl4.sandbox.yodlee.com/authenticate/restserver/'
      : this.environment === 'development'
      ? 'https://fl4.preprod.yodlee.com/authenticate/restserver/'
      : 'https://fl4.yodlee.com/authenticate/restserver/';

    return {
      fastLinkUrl,
      accessToken: token,
      params: {
        configName: this.fastLinkConfigName,
      },
    };
  }

  /**
   * Get FastLink config for updating a provider account
   */
  async getFastLinkUpdateConfig(
    userLoginName: string,
    providerAccountId: number
  ): Promise<YodleeFastLinkConfig> {
    const config = await this.getFastLinkConfig(userLoginName);
    return {
      ...config,
      params: {
        ...config.params,
        flow: 'edit',
        providerAccountId,
      },
    };
  }

  /**
   * Get FastLink config for refreshing a provider account
   */
  async getFastLinkRefreshConfig(
    userLoginName: string,
    providerAccountId: number
  ): Promise<YodleeFastLinkConfig> {
    const config = await this.getFastLinkConfig(userLoginName);
    return {
      ...config,
      params: {
        ...config.params,
        flow: 'refresh',
        providerAccountId,
      },
    };
  }

  // ============================================================================
  // Provider Account Operations
  // ============================================================================

  /**
   * Get all provider accounts for a user
   */
  async getProviderAccounts(userLoginName: string): Promise<YodleeProviderAccount[]> {
    const response = await this.yodleeRequest<YodleeProviderAccountsResponse>(
      '/providerAccounts',
      userLoginName
    );
    return response.providerAccount || [];
  }

  /**
   * Get a specific provider account
   */
  async getProviderAccount(
    userLoginName: string,
    providerAccountId: number
  ): Promise<YodleeProviderAccount> {
    const response = await this.yodleeRequest<{ providerAccount: YodleeProviderAccount[] }>(
      `/providerAccounts/${providerAccountId}`,
      userLoginName
    );
    return response.providerAccount[0];
  }

  /**
   * Delete a provider account
   */
  async deleteProviderAccount(userLoginName: string, providerAccountId: number): Promise<void> {
    await this.yodleeRequest(`/providerAccounts/${providerAccountId}`, userLoginName, {
      method: 'DELETE',
    });
  }

  /**
   * Refresh a provider account
   */
  async refreshProviderAccount(
    userLoginName: string,
    providerAccountId: number
  ): Promise<YodleeProviderAccount> {
    const response = await this.yodleeRequest<{ providerAccount: YodleeProviderAccount[] }>(
      `/providerAccounts/${providerAccountId}`,
      userLoginName,
      { method: 'PUT' }
    );
    return response.providerAccount[0];
  }

  // ============================================================================
  // Account Operations
  // ============================================================================

  /**
   * Get all accounts for a user
   */
  async getAccounts(userLoginName: string, providerAccountId?: number): Promise<BankAccount[]> {
    const params: Record<string, string | number | boolean> = {};
    if (providerAccountId) {
      params.providerAccountId = providerAccountId;
    }

    const response = await this.yodleeRequest<YodleeAccountsResponse>(
      '/accounts',
      userLoginName,
      { params }
    );

    return (response.account || []).map((account) => this.normalizeAccount(account));
  }

  /**
   * Get account balances
   */
  async getAccountBalances(
    userLoginName: string,
    accountIds?: number[]
  ): Promise<BankAccountBalance[]> {
    const params: Record<string, string | number | boolean> = {};
    if (accountIds?.length) {
      params.accountId = accountIds.join(',');
    }

    const response = await this.yodleeRequest<YodleeAccountsResponse>(
      '/accounts',
      userLoginName,
      { params }
    );

    return (response.account || []).map((account) => ({
      accountId: account.id.toString(),
      current: account.currentBalance?.amount ?? account.balance?.amount ?? 0,
      available: account.availableBalance?.amount,
      limit: account.totalCreditLine?.amount,
      currency: account.currentBalance?.currency ?? account.balance?.currency ?? 'USD',
      timestamp: new Date(),
    }));
  }

  // ============================================================================
  // Transaction Operations
  // ============================================================================

  /**
   * Get transactions for a user
   */
  async getTransactions(
    userLoginName: string,
    request: YodleeTransactionsRequest = {}
  ): Promise<BankTransaction[]> {
    const params: Record<string, string | number | boolean> = {};

    if (request.accountId) params.accountId = request.accountId;
    if (request.fromDate) params.fromDate = request.fromDate;
    if (request.toDate) params.toDate = request.toDate;
    if (request.categoryId) params.categoryId = request.categoryId;
    if (request.categoryType) params.categoryType = request.categoryType;
    if (request.baseType) params.baseType = request.baseType;
    if (request.keyword) params.keyword = request.keyword;
    if (request.skip) params.skip = request.skip;
    if (request.top) params.top = request.top;

    const response = await this.yodleeRequest<YodleeTransactionsResponse>(
      '/transactions',
      userLoginName,
      { params }
    );

    return (response.transaction || []).map((txn) => this.normalizeTransaction(txn));
  }

  /**
   * Sync transactions with date range
   */
  async syncTransactions(
    userLoginName: string,
    options: BankFeedSyncOptions = {}
  ): Promise<BankFeedSyncResult> {
    const startedAt = new Date();
    const transactions: BankTransaction[] = [];
    const errors: BankFeedSyncResult['errors'] = [];
    let hasMore = true;
    let skip = 0;
    const top = 500;
    let duplicatesSkipped = 0;

    const fromDate = options.startDate?.toISOString().split('T')[0];
    const toDate = options.endDate?.toISOString().split('T')[0];

    try {
      while (hasMore) {
        const request: YodleeTransactionsRequest = {
          skip,
          top,
        };
        if (fromDate) request.fromDate = fromDate;
        if (toDate) request.toDate = toDate;

        const batch = await this.getTransactions(userLoginName, request);

        for (const txn of batch) {
          // Filter pending if not requested
          if (!options.includePending && txn.status === 'pending') continue;
          transactions.push(txn);
        }

        skip += batch.length;
        hasMore = batch.length === top;

        // Check max
        if (options.maxTransactions && transactions.length >= options.maxTransactions) {
          hasMore = false;
        }
      }
    } catch (error) {
      errors.push({
        code: 'SYNC_ERROR',
        message: error instanceof Error ? error.message : 'Unknown sync error',
        retryable: true,
        details: { error },
      });
    }

    return {
      provider: 'yodlee',
      accountId: userLoginName, // Use login name as account identifier
      success: errors.length === 0,
      startedAt,
      completedAt: new Date(),
      durationMs: Date.now() - startedAt.getTime(),
      transactionsAdded: transactions.length,
      transactionsModified: 0, // Yodlee doesn't have cursor-based sync like Plaid
      transactionsRemoved: 0,
      duplicatesSkipped,
      errors,
      hasMore: false,
    };
  }

  /**
   * Get transaction count
   */
  async getTransactionCount(
    userLoginName: string,
    fromDate?: string,
    toDate?: string
  ): Promise<number> {
    const params: Record<string, string | number | boolean> = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;

    const response = await this.yodleeRequest<{ transaction: { TOTAL: { count: number } } }>(
      '/transactions/count',
      userLoginName,
      { params }
    );

    return response.transaction?.TOTAL?.count ?? 0;
  }

  // ============================================================================
  // Webhook Registration
  // ============================================================================

  /**
   * Register webhook for updates
   */
  async registerWebhook(callbackUrl: string, eventTypes: string[]): Promise<void> {
    const adminToken = await this.getAdminToken();
    const httpClient = this.httpClient;

    await httpClient.post(`${this.config.baseUrl}/cobrand/config/notifications/events`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Api-Version': '1.1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event: eventTypes.map((event) => ({
          callbackUrl,
          event,
        })),
      }),
    });
  }

  /**
   * Get registered webhooks
   */
  async getWebhooks(): Promise<Array<{ event: string; callbackUrl: string }>> {
    const adminToken = await this.getAdminToken();
    const httpClient = this.httpClient;

    const response = await httpClient.get(
      `${this.config.baseUrl}/cobrand/config/notifications/events`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Api-Version': '1.1',
        },
      }
    );

    if (response.status !== 200) {
      throw new Error(`Failed to get webhooks: ${response.body}`);
    }

    const data = JSON.parse(response.body);
    return data.event || [];
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(event: string): Promise<void> {
    const adminToken = await this.getAdminToken();
    const httpClient = this.httpClient;

    await httpClient.request(
      'DELETE',
      `${this.config.baseUrl}/cobrand/config/notifications/events/${event}`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Api-Version': '1.1',
        },
      }
    );
  }

  // ============================================================================
  // Normalization Helpers
  // ============================================================================

  /**
   * Normalize Yodlee account to standard BankAccount
   */
  private normalizeAccount(account: YodleeAccount): BankAccount {
    const organizationId = this.requireOrganizationContext();

    return {
      id: `yodlee_${account.id}`,
      providerAccountId: account.id.toString(),
      provider: 'yodlee',
      institutionId: account.providerId.toString(),
      institutionName: account.providerName,
      name: account.accountName || account.displayedName,
      officialName: account.displayedName,
      type: this.mapAccountType(account.accountType),
      subtype: this.mapAccountSubtype(account.accountType),
      mask: account.accountNumber?.slice(-4),
      currentBalance: account.currentBalance?.amount ?? account.balance?.amount,
      availableBalance: account.availableBalance?.amount,
      creditLimit: account.totalCreditLine?.amount,
      currency: account.currentBalance?.currency ?? account.balance?.currency ?? 'USD',
      isActive: account.accountStatus === 'ACTIVE',
      lastSyncAt: account.lastUpdated ? new Date(account.lastUpdated) : undefined,
      organizationId,
      createdAt: new Date(account.createdDate),
      updatedAt: new Date(account.lastUpdated || account.createdDate),
    };
  }

  /**
   * Normalize Yodlee transaction to standard BankTransaction
   */
  private normalizeTransaction(txn: YodleeTransaction): BankTransaction {
    const organizationId = this.requireOrganizationContext();

    const amount = txn.baseType === 'CREDIT' ? txn.amount.amount : -txn.amount.amount;
    const direction: TransactionDirection = txn.baseType === 'CREDIT' ? 'credit' : 'debit';

    // Generate deduplication hash
    const dedupeHash = this.generateDedupeHash(txn);

    return {
      id: `yodlee_${txn.id}`,
      providerTransactionId: txn.id.toString(),
      provider: 'yodlee',
      accountId: txn.accountId.toString(),
      amount,
      direction,
      currency: txn.amount.currency,
      date: new Date(txn.transactionDate || txn.date),
      authorizedDate: txn.date !== txn.transactionDate ? new Date(txn.date) : undefined,
      status: this.mapTransactionStatus(txn.status),
      merchantName: txn.merchant?.name,
      description: txn.description.consumer || txn.description.original,
      categoryPrimary: this.mapCategoryPrimary(txn.categoryType),
      categoryDetailed: [txn.categoryType, txn.category],
      paymentChannel: txn.type,
      checkNumber: txn.checkNumber,
      isTransfer: txn.categoryType?.toLowerCase().includes('transfer') ?? false,
      location: txn.merchant?.address
        ? {
            address: txn.merchant.address.address1,
            city: txn.merchant.address.city,
            region: txn.merchant.address.state,
            postalCode: txn.merchant.address.zip,
            country: txn.merchant.address.country,
          }
        : undefined,
      organizationId,
      dedupeHash,
      isReconciled: false,
      rawData: txn as unknown as Record<string, unknown>,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Generate deduplication hash
   */
  private generateDedupeHash(txn: YodleeTransaction): string {
    const hashSource = [
      txn.accountId,
      txn.transactionDate || txn.date,
      txn.amount.amount.toFixed(2),
      txn.description.original,
      txn.merchant?.name ?? '',
    ].join('|');

    let hash = 0;
    for (let i = 0; i < hashSource.length; i++) {
      const char = hashSource.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `yodlee_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Map Yodlee account type to standard type
   */
  private mapAccountType(type: string): BankAccountType {
    const normalizedType = type.toLowerCase();
    if (normalizedType.includes('checking')) return 'checking';
    if (normalizedType.includes('saving')) return 'savings';
    if (normalizedType.includes('money_market')) return 'money_market';
    if (normalizedType.includes('credit')) return 'credit_card';
    if (normalizedType.includes('loan') || normalizedType.includes('mortgage')) return 'loan';
    if (normalizedType.includes('investment') || normalizedType.includes('brokerage')) return 'investment';
    return 'other';
  }

  /**
   * Map Yodlee account type to subtype
   */
  private mapAccountSubtype(type: string): BankAccountSubtype | undefined {
    const normalizedType = type.toLowerCase();
    if (normalizedType.includes('checking')) return 'checking';
    if (normalizedType.includes('saving')) return 'savings';
    if (normalizedType.includes('money_market')) return 'money_market';
    if (normalizedType.includes('hsa')) return 'hsa';
    if (normalizedType.includes('cd')) return 'cd';
    if (normalizedType.includes('credit')) return 'credit_card';
    if (normalizedType.includes('auto')) return 'auto';
    if (normalizedType.includes('mortgage')) return 'mortgage';
    if (normalizedType.includes('home_equity')) return 'home_equity';
    if (normalizedType.includes('student')) return 'student';
    if (normalizedType.includes('brokerage')) return 'brokerage';
    if (normalizedType.includes('401k') || normalizedType.includes('401(k)')) return '401k';
    if (normalizedType.includes('ira')) return 'ira';
    if (normalizedType.includes('roth')) return 'roth';
    return 'other';
  }

  /**
   * Map Yodlee transaction status
   */
  private mapTransactionStatus(status: string): BankTransactionStatus {
    const statusMap: Record<string, BankTransactionStatus> = {
      PENDING: 'pending',
      POSTED: 'posted',
      SCHEDULED: 'pending',
      FAILED: 'canceled',
      CLEARED: 'posted',
    };
    return statusMap[status.toUpperCase()] ?? 'posted';
  }

  /**
   * Map Yodlee category to standard category
   */
  private mapCategoryPrimary(category?: string): TransactionCategoryPrimary | undefined {
    if (!category) return undefined;
    const normalizedCategory = category.toLowerCase();

    if (normalizedCategory.includes('income') || normalizedCategory.includes('salary')) return 'income';
    if (normalizedCategory.includes('transfer')) return 'transfer';
    if (normalizedCategory.includes('loan') || normalizedCategory.includes('payment')) return 'loan_payments';
    if (normalizedCategory.includes('fee') || normalizedCategory.includes('charge')) return 'bank_fees';
    if (normalizedCategory.includes('entertainment') || normalizedCategory.includes('recreation')) return 'entertainment';
    if (normalizedCategory.includes('food') || normalizedCategory.includes('restaurant') || normalizedCategory.includes('dining')) return 'food_and_drink';
    if (normalizedCategory.includes('merchandise') || normalizedCategory.includes('shopping')) return 'general_merchandise';
    if (normalizedCategory.includes('service')) return 'general_services';
    if (normalizedCategory.includes('government') || normalizedCategory.includes('tax')) return 'government_and_non_profit';
    if (normalizedCategory.includes('home') || normalizedCategory.includes('hardware')) return 'home_improvement';
    if (normalizedCategory.includes('medical') || normalizedCategory.includes('health')) return 'medical';
    if (normalizedCategory.includes('personal') || normalizedCategory.includes('beauty')) return 'personal_care';
    if (normalizedCategory.includes('rent') || normalizedCategory.includes('utilities')) return 'rent_and_utilities';
    if (normalizedCategory.includes('transportation') || normalizedCategory.includes('auto') || normalizedCategory.includes('gas')) return 'transportation';
    if (normalizedCategory.includes('travel') || normalizedCategory.includes('hotel') || normalizedCategory.includes('airline')) return 'travel';

    return 'other';
  }
}

// ============================================================================
// Register Connector Type
// ============================================================================

connectorRegistry.register({
  type: 'yodlee',
  name: 'Yodlee',
  description: 'Bank account aggregation and transaction sync via Yodlee',
  category: 'banking',
  supportedAuthMethods: ['custom'],
  defaultConfig: {
    defaultTimeoutMs: 30000,
    rateLimit: {
      maxRequests: 10,
      window: 'second',
      queueWhenLimited: true,
      respectRetryAfter: true,
    },
  },
  requiredCredentialFields: ['clientId', 'clientSecret', 'adminLoginName'],
  optionalCredentialFields: ['environment', 'fastLinkCallbackUrl', 'fastLinkConfigName'],
  documentationUrl: 'https://developer.yodlee.com/api-reference',
});
