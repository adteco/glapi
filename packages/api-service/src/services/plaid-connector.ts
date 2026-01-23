/**
 * Plaid Bank Connector
 *
 * Implements the Plaid API integration for bank feed synchronization.
 * Uses the connector framework for auth, rate limiting, retries, and monitoring.
 */

import {
  BaseConnector,
  ConnectorServiceContext,
  ConnectorConfig,
  HttpClientInterface,
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
  PlaidLinkTokenRequest,
  PlaidLinkTokenResponse,
  PlaidAccessTokenResponse,
  PlaidItem,
  PlaidAccount,
  PlaidTransaction,
  PlaidTransactionsSyncRequest,
  PlaidTransactionsSyncResponse,
  PlaidProduct,
  BankFeedSyncCursor,
  BankFeedSyncOptions,
  BankFeedSyncResult,
  BankAccountBalance,
  BankConnection,
} from '../types/bank-feed.types';

import type { ConnectionTestResult } from '../types/connector.types';

// ============================================================================
// Plaid API Response Types
// ============================================================================

interface PlaidApiResponse<T> {
  request_id: string;
  [key: string]: unknown;
}

interface PlaidLinkTokenCreateResponse extends PlaidApiResponse<void> {
  link_token: string;
  expiration: string;
}

interface PlaidItemGetResponse extends PlaidApiResponse<void> {
  item: {
    item_id: string;
    institution_id: string;
    webhook: string | null;
    error: {
      error_type: string;
      error_code: string;
      error_message: string;
      display_message: string | null;
    } | null;
    available_products: string[];
    billed_products: string[];
    consent_expiration_time: string | null;
    update_type: string;
  };
  status: {
    transactions: {
      last_successful_update: string | null;
      last_failed_update: string | null;
    };
  };
}

interface PlaidAccountsGetResponse extends PlaidApiResponse<void> {
  accounts: PlaidAccount[];
  item: PlaidItemGetResponse['item'];
}

interface PlaidAccountsBalanceResponse extends PlaidApiResponse<void> {
  accounts: PlaidAccount[];
}

interface PlaidTransactionsSyncApiResponse extends PlaidApiResponse<void> {
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: Array<{ transaction_id: string }>;
  next_cursor: string;
  has_more: boolean;
}

interface PlaidInstitutionGetResponse extends PlaidApiResponse<void> {
  institution: {
    institution_id: string;
    name: string;
    products: string[];
    country_codes: string[];
    url: string | null;
    primary_color: string | null;
    logo: string | null;
    routing_numbers: string[];
    oauth: boolean;
    status: {
      item_logins: { status: string; last_status_change: string };
      transactions_updates: { status: string; last_status_change: string };
      auth: { status: string; last_status_change: string };
      balance: { status: string; last_status_change: string };
    } | null;
  };
}

// ============================================================================
// Plaid Connector Configuration
// ============================================================================

/**
 * Plaid-specific connector configuration
 */
export interface PlaidConnectorConfig extends Omit<ConnectorConfig, 'credentials' | 'type'> {
  /** Plaid client ID */
  clientId: string;
  /** Plaid secret (environment-specific) */
  secret: string;
  /** Plaid environment */
  environment: 'sandbox' | 'development' | 'production';
  /** Webhook URL for Plaid notifications */
  webhookUrl?: string;
  /** Products to enable */
  products?: PlaidProduct[];
  /** Country codes to support */
  countryCodes?: string[];
  /** Custom Link configuration name */
  linkCustomizationName?: string;
}

/**
 * Get base URL for Plaid environment
 */
function getPlaidBaseUrl(environment: PlaidConnectorConfig['environment']): string {
  switch (environment) {
    case 'sandbox':
      return 'https://sandbox.plaid.com';
    case 'development':
      return 'https://development.plaid.com';
    case 'production':
      return 'https://production.plaid.com';
    default:
      return 'https://sandbox.plaid.com';
  }
}

// ============================================================================
// Plaid Connector Implementation
// ============================================================================

/**
 * Plaid bank connector for bank feed integration
 */
export class PlaidConnector extends BaseConnector {
  private clientId: string;
  private secret: string;
  private environment: PlaidConnectorConfig['environment'];
  private webhookUrl?: string;
  private products: PlaidProduct[];
  private countryCodes: string[];
  private linkCustomizationName?: string;

  constructor(
    context: ConnectorServiceContext,
    config: PlaidConnectorConfig,
    httpClient?: HttpClientInterface
  ) {
    // Convert to full ConnectorConfig
    const fullConfig: ConnectorConfig = {
      ...config,
      type: 'plaid',
      baseUrl: getPlaidBaseUrl(config.environment),
      defaultTimeoutMs: config.defaultTimeoutMs ?? 30000,
      credentials: {
        method: 'custom',
        customData: {
          clientId: config.clientId,
          secret: config.secret,
        },
      },
      rateLimit: config.rateLimit ?? {
        maxRequests: 100,
        window: 'minute',
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
    this.secret = config.secret;
    this.environment = config.environment;
    this.webhookUrl = config.webhookUrl;
    this.products = config.products ?? ['transactions'];
    this.countryCodes = config.countryCodes ?? ['US'];
    this.linkCustomizationName = config.linkCustomizationName;
  }

  /**
   * Override auth headers since Plaid uses client_id/secret in request body
   */
  protected async getPlaidHeaders(): Promise<Record<string, string>> {
    return {
      'Content-Type': 'application/json',
      'PLAID-CLIENT-ID': this.clientId,
      'PLAID-SECRET': this.secret,
    };
  }

  /**
   * Make a Plaid API request
   */
  private async plaidRequest<T>(
    path: string,
    body: Record<string, unknown>
  ): Promise<T> {
    const response = await this.post<T>(path, body, {
      headers: await this.getPlaidHeaders(),
      skipAuth: true, // We handle auth via headers
    });
    return response.data;
  }

  /**
   * Test connection to Plaid API
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    try {
      // Use categories endpoint as a simple test
      await this.plaidRequest('/categories/get', {});
      return {
        success: true,
        latencyMs: Date.now() - startTime,
        message: 'Successfully connected to Plaid API',
        details: { environment: this.environment },
      };
    } catch (error) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        message: error instanceof Error ? error.message : 'Failed to connect to Plaid',
        details: { error },
      };
    }
  }

  // ============================================================================
  // Link Token Management
  // ============================================================================

  /**
   * Create a Link token for initializing Plaid Link
   */
  async createLinkToken(request: PlaidLinkTokenRequest): Promise<PlaidLinkTokenResponse> {
    const response = await this.plaidRequest<PlaidLinkTokenCreateResponse>('/link/token/create', {
      client_id: this.clientId,
      secret: this.secret,
      client_name: request.clientName,
      user: {
        client_user_id: request.clientUserId,
      },
      products: request.products ?? this.products,
      country_codes: request.countryCodes ?? this.countryCodes,
      language: request.language ?? 'en',
      webhook: request.webhook ?? this.webhookUrl,
      access_token: request.accessToken,
      link_customization_name: request.linkCustomizationName ?? this.linkCustomizationName,
      redirect_uri: request.redirectUri,
      account_filters: request.accountFilters,
    });

    return {
      linkToken: response.link_token,
      expiration: new Date(response.expiration),
      requestId: response.request_id,
    };
  }

  /**
   * Exchange a public token for an access token
   */
  async exchangePublicToken(publicToken: string): Promise<PlaidAccessTokenResponse> {
    const response = await this.plaidRequest<{
      access_token: string;
      item_id: string;
      request_id: string;
    }>('/item/public_token/exchange', {
      public_token: publicToken,
    });

    return {
      accessToken: response.access_token,
      itemId: response.item_id,
      requestId: response.request_id,
    };
  }

  /**
   * Create a public token from an access token (for testing)
   */
  async createPublicToken(accessToken: string): Promise<string> {
    const response = await this.plaidRequest<{
      public_token: string;
      request_id: string;
    }>('/item/public_token/create', {
      access_token: accessToken,
    });

    return response.public_token;
  }

  // ============================================================================
  // Item Management
  // ============================================================================

  /**
   * Get item details
   */
  async getItem(accessToken: string): Promise<PlaidItem> {
    const response = await this.plaidRequest<PlaidItemGetResponse>('/item/get', {
      access_token: accessToken,
    });

    const item = response.item;
    return {
      itemId: item.item_id,
      institutionId: item.institution_id,
      webhook: item.webhook ?? undefined,
      error: item.error
        ? {
            errorType: item.error.error_type,
            errorCode: item.error.error_code,
            errorMessage: item.error.error_message,
            displayMessage: item.error.display_message ?? undefined,
          }
        : undefined,
      availableProducts: item.available_products as PlaidProduct[],
      billedProducts: item.billed_products as PlaidProduct[],
      consentExpirationTime: item.consent_expiration_time
        ? new Date(item.consent_expiration_time)
        : undefined,
      updateType: item.update_type as 'background' | 'user_present_required',
    };
  }

  /**
   * Update item webhook
   */
  async updateItemWebhook(accessToken: string, webhookUrl: string): Promise<PlaidItem> {
    const response = await this.plaidRequest<PlaidItemGetResponse>('/item/webhook/update', {
      access_token: accessToken,
      webhook: webhookUrl,
    });

    const item = response.item;
    return {
      itemId: item.item_id,
      institutionId: item.institution_id,
      webhook: item.webhook ?? undefined,
      error: undefined,
      availableProducts: item.available_products as PlaidProduct[],
      billedProducts: item.billed_products as PlaidProduct[],
      consentExpirationTime: item.consent_expiration_time
        ? new Date(item.consent_expiration_time)
        : undefined,
      updateType: item.update_type as 'background' | 'user_present_required',
    };
  }

  /**
   * Remove an item (disconnect)
   */
  async removeItem(accessToken: string): Promise<void> {
    await this.plaidRequest('/item/remove', {
      access_token: accessToken,
    });
  }

  // ============================================================================
  // Account Operations
  // ============================================================================

  /**
   * Get accounts for an item
   */
  async getAccounts(accessToken: string): Promise<BankAccount[]> {
    const response = await this.plaidRequest<PlaidAccountsGetResponse>('/accounts/get', {
      access_token: accessToken,
    });

    // Get institution info
    let institutionName = 'Unknown Institution';
    try {
      const institution = await this.getInstitution(response.item.institution_id);
      institutionName = institution.name;
    } catch {
      // Ignore institution lookup failure
    }

    return response.accounts.map((account) =>
      this.normalizeAccount(account, response.item.institution_id, institutionName)
    );
  }

  /**
   * Get account balances
   */
  async getAccountBalances(
    accessToken: string,
    accountIds?: string[]
  ): Promise<BankAccountBalance[]> {
    const body: Record<string, unknown> = {
      access_token: accessToken,
    };
    if (accountIds?.length) {
      body.options = { account_ids: accountIds };
    }

    const response = await this.plaidRequest<PlaidAccountsBalanceResponse>(
      '/accounts/balance/get',
      body
    );

    return response.accounts.map((account) => ({
      accountId: account.account_id,
      current: account.balances.current ?? 0,
      available: account.balances.available ?? undefined,
      limit: account.balances.limit ?? undefined,
      currency: account.balances.iso_currency_code ?? 'USD',
      timestamp: new Date(),
    }));
  }

  /**
   * Get institution details
   */
  async getInstitution(
    institutionId: string,
    countryCodes?: string[]
  ): Promise<PlaidInstitutionGetResponse['institution']> {
    const response = await this.plaidRequest<PlaidInstitutionGetResponse>('/institutions/get_by_id', {
      institution_id: institutionId,
      country_codes: countryCodes ?? this.countryCodes,
      options: {
        include_optional_metadata: true,
        include_status: true,
      },
    });

    return response.institution;
  }

  // ============================================================================
  // Transaction Sync
  // ============================================================================

  /**
   * Sync transactions using cursor-based pagination
   */
  async syncTransactions(
    accessToken: string,
    options: BankFeedSyncOptions = {},
    cursor?: BankFeedSyncCursor
  ): Promise<BankFeedSyncResult> {
    const startedAt = new Date();
    const added: BankTransaction[] = [];
    const modified: BankTransaction[] = [];
    const removed: string[] = [];
    const errors: BankFeedSyncResult['errors'] = [];
    let currentCursor = cursor?.cursor || '';
    let hasMore = true;
    const duplicatesSkipped = 0;

    // Get accounts for normalization context
    const accountsResponse = await this.plaidRequest<PlaidAccountsGetResponse>('/accounts/get', {
      access_token: accessToken,
    });

    // Build account lookup
    const accountLookup = new Map<string, { institutionId: string; institutionName: string }>();
    for (const account of accountsResponse.accounts) {
      accountLookup.set(account.account_id, {
        institutionId: accountsResponse.item.institution_id,
        institutionName: 'Unknown', // Would need institution lookup
      });
    }

    try {
      while (hasMore) {
        const syncResponse = await this.plaidRequest<PlaidTransactionsSyncApiResponse>(
          '/transactions/sync',
          {
            access_token: accessToken,
            cursor: currentCursor || undefined,
            count: options.maxTransactions ? Math.min(options.maxTransactions, 500) : 500,
            options: {
              include_original_description: true,
              include_personal_finance_category: true,
            },
          }
        );

        // Process added transactions
        for (const txn of syncResponse.added) {
          const normalized = this.normalizeTransaction(txn);

          // Filter by date if specified
          if (options.startDate && normalized.date < options.startDate) continue;
          if (options.endDate && normalized.date > options.endDate) continue;

          // Filter pending if not requested
          if (!options.includePending && normalized.status === 'pending') continue;

          added.push(normalized);
        }

        // Process modified transactions
        for (const txn of syncResponse.modified) {
          const normalized = this.normalizeTransaction(txn);
          modified.push(normalized);
        }

        // Process removed transactions
        if (options.includeRemoved) {
          for (const txn of syncResponse.removed) {
            removed.push(txn.transaction_id);
          }
        }

        currentCursor = syncResponse.next_cursor;
        hasMore = syncResponse.has_more;

        // Check if we've hit the max
        if (options.maxTransactions && added.length >= options.maxTransactions) {
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
      provider: 'plaid',
      accountId: accountsResponse.item.item_id,
      success: errors.length === 0,
      startedAt,
      completedAt: new Date(),
      durationMs: Date.now() - startedAt.getTime(),
      transactionsAdded: added.length,
      transactionsModified: modified.length,
      transactionsRemoved: removed.length,
      duplicatesSkipped,
      errors,
      newCursor: currentCursor,
      hasMore,
    };
  }

  /**
   * Get transactions (non-incremental, date-based)
   */
  async getTransactions(
    accessToken: string,
    startDate: Date,
    endDate: Date,
    accountIds?: string[]
  ): Promise<BankTransaction[]> {
    const transactions: BankTransaction[] = [];
    let offset = 0;
    const count = 500;
    let hasMore = true;

    while (hasMore) {
      const body: Record<string, unknown> = {
        access_token: accessToken,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        options: {
          count,
          offset,
          include_original_description: true,
          include_personal_finance_category: true,
        },
      };

      if (accountIds?.length) {
        (body.options as Record<string, unknown>).account_ids = accountIds;
      }

      const response = await this.plaidRequest<{
        accounts: PlaidAccount[];
        transactions: PlaidTransaction[];
        total_transactions: number;
        request_id: string;
      }>('/transactions/get', body);

      for (const txn of response.transactions) {
        transactions.push(this.normalizeTransaction(txn));
      }

      offset += response.transactions.length;
      hasMore = offset < response.total_transactions;
    }

    return transactions;
  }

  /**
   * Refresh transactions (trigger update)
   */
  async refreshTransactions(accessToken: string): Promise<void> {
    await this.plaidRequest('/transactions/refresh', {
      access_token: accessToken,
    });
  }

  // ============================================================================
  // Webhook Verification
  // ============================================================================

  /**
   * Verify a Plaid webhook
   */
  async verifyWebhook(
    webhookBody: string,
    plaidVerificationHeader: string
  ): Promise<boolean> {
    try {
      const response = await this.plaidRequest<{
        request_id: string;
        verification_state: 'verified' | 'pending_verification' | 'verification_failed';
      }>('/webhook_verification_key/get', {
        key_id: plaidVerificationHeader,
      });

      return response.verification_state === 'verified';
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Sandbox Helpers (for testing)
  // ============================================================================

  /**
   * Create a sandbox public token for testing
   */
  async createSandboxPublicToken(
    institutionId: string = 'ins_109508',
    initialProducts?: PlaidProduct[]
  ): Promise<string> {
    if (this.environment !== 'sandbox') {
      throw new Error('Sandbox methods only available in sandbox environment');
    }

    const response = await this.plaidRequest<{
      public_token: string;
      request_id: string;
    }>('/sandbox/public_token/create', {
      institution_id: institutionId,
      initial_products: initialProducts ?? this.products,
    });

    return response.public_token;
  }

  /**
   * Fire a sandbox webhook for testing
   */
  async fireSandboxWebhook(
    accessToken: string,
    webhookType: string,
    webhookCode: string
  ): Promise<void> {
    if (this.environment !== 'sandbox') {
      throw new Error('Sandbox methods only available in sandbox environment');
    }

    await this.plaidRequest('/sandbox/item/fire_webhook', {
      access_token: accessToken,
      webhook_type: webhookType,
      webhook_code: webhookCode,
    });
  }

  /**
   * Reset login for sandbox item (simulates credential change)
   */
  async resetSandboxLogin(accessToken: string): Promise<void> {
    if (this.environment !== 'sandbox') {
      throw new Error('Sandbox methods only available in sandbox environment');
    }

    await this.plaidRequest('/sandbox/item/reset_login', {
      access_token: accessToken,
    });
  }

  // ============================================================================
  // Normalization Helpers
  // ============================================================================

  /**
   * Normalize Plaid account to standard BankAccount
   */
  private normalizeAccount(
    account: PlaidAccount,
    institutionId: string,
    institutionName: string
  ): BankAccount {
    const organizationId = this.requireOrganizationContext();

    return {
      id: `plaid_${account.account_id}`,
      providerAccountId: account.account_id,
      provider: 'plaid',
      institutionId,
      institutionName,
      name: account.name,
      officialName: account.official_name ?? undefined,
      type: this.mapAccountType(account.type),
      subtype: this.mapAccountSubtype(account.subtype),
      mask: account.mask ?? undefined,
      currentBalance: account.balances.current ?? undefined,
      availableBalance: account.balances.available ?? undefined,
      creditLimit: account.balances.limit ?? undefined,
      currency: account.balances.iso_currency_code ?? 'USD',
      isActive: true,
      organizationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Normalize Plaid transaction to standard BankTransaction
   */
  private normalizeTransaction(txn: PlaidTransaction): BankTransaction {
    const organizationId = this.requireOrganizationContext();

    // Plaid amounts are positive for debits, negative for credits
    // We want positive for credits, negative for debits
    const amount = -txn.amount;
    const direction: TransactionDirection = amount >= 0 ? 'credit' : 'debit';

    // Generate deduplication hash
    const dedupeHash = this.generateDedupeHash(txn);

    return {
      id: `plaid_${txn.transaction_id}`,
      providerTransactionId: txn.transaction_id,
      provider: 'plaid',
      accountId: txn.account_id,
      amount,
      direction,
      currency: txn.iso_currency_code ?? 'USD',
      date: new Date(txn.date),
      authorizedDate: txn.authorized_date ? new Date(txn.authorized_date) : undefined,
      status: this.mapTransactionStatus(txn.pending),
      merchantName: txn.merchant_name ?? undefined,
      description: txn.name,
      categoryPrimary: this.mapCategoryPrimary(txn.personal_finance_category?.primary),
      categoryDetailed: txn.personal_finance_category
        ? [txn.personal_finance_category.primary, txn.personal_finance_category.detailed]
        : txn.category ?? undefined,
      paymentChannel: txn.payment_channel,
      checkNumber: txn.check_number ?? undefined,
      isTransfer: txn.category?.includes('Transfer') ?? false,
      location:
        txn.location.city || txn.location.address
          ? {
              address: txn.location.address ?? undefined,
              city: txn.location.city ?? undefined,
              region: txn.location.region ?? undefined,
              postalCode: txn.location.postal_code ?? undefined,
              country: txn.location.country ?? undefined,
              lat: txn.location.lat ?? undefined,
              lon: txn.location.lon ?? undefined,
              storeNumber: txn.location.store_number ?? undefined,
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
   * Generate a deduplication hash for a transaction
   */
  private generateDedupeHash(txn: PlaidTransaction): string {
    // Use a combination of stable fields for deduplication
    const hashSource = [
      txn.account_id,
      txn.date,
      txn.amount.toFixed(2),
      txn.name,
      txn.merchant_name ?? '',
    ].join('|');

    // Simple hash function (would use crypto in production)
    let hash = 0;
    for (let i = 0; i < hashSource.length; i++) {
      const char = hashSource.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `plaid_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Map Plaid account type to standard type
   */
  private mapAccountType(type: string): BankAccountType {
    const typeMap: Record<string, BankAccountType> = {
      depository: 'checking',
      credit: 'credit_card',
      loan: 'loan',
      investment: 'investment',
      other: 'other',
    };
    return typeMap[type.toLowerCase()] ?? 'other';
  }

  /**
   * Map Plaid account subtype to standard subtype
   */
  private mapAccountSubtype(subtype: string | null): BankAccountSubtype | undefined {
    if (!subtype) return undefined;
    const subtypeMap: Record<string, BankAccountSubtype> = {
      checking: 'checking',
      savings: 'savings',
      hsa: 'hsa',
      cd: 'cd',
      'money market': 'money_market',
      paypal: 'paypal',
      prepaid: 'prepaid',
      'cash management': 'cash_management',
      'credit card': 'credit_card',
      auto: 'auto',
      mortgage: 'mortgage',
      'home equity': 'home_equity',
      'line of credit': 'line_of_credit',
      student: 'student',
      brokerage: 'brokerage',
      '401k': '401k',
      ira: 'ira',
      roth: 'roth',
    };
    return subtypeMap[subtype.toLowerCase()] ?? 'other';
  }

  /**
   * Map pending status to transaction status
   */
  private mapTransactionStatus(pending: boolean): BankTransactionStatus {
    return pending ? 'pending' : 'posted';
  }

  /**
   * Map Plaid category to standard category
   */
  private mapCategoryPrimary(category?: string): TransactionCategoryPrimary | undefined {
    if (!category) return undefined;
    const categoryMap: Record<string, TransactionCategoryPrimary> = {
      INCOME: 'income',
      TRANSFER_IN: 'transfer',
      TRANSFER_OUT: 'transfer',
      LOAN_PAYMENTS: 'loan_payments',
      BANK_FEES: 'bank_fees',
      ENTERTAINMENT: 'entertainment',
      FOOD_AND_DRINK: 'food_and_drink',
      GENERAL_MERCHANDISE: 'general_merchandise',
      GENERAL_SERVICES: 'general_services',
      GOVERNMENT_AND_NON_PROFIT: 'government_and_non_profit',
      HOME_IMPROVEMENT: 'home_improvement',
      MEDICAL: 'medical',
      PERSONAL_CARE: 'personal_care',
      RENT_AND_UTILITIES: 'rent_and_utilities',
      TRANSPORTATION: 'transportation',
      TRAVEL: 'travel',
    };
    return categoryMap[category.toUpperCase()] ?? 'other';
  }
}

// ============================================================================
// Register Connector Type
// ============================================================================

connectorRegistry.register({
  type: 'plaid',
  name: 'Plaid',
  description: 'Bank account aggregation and transaction sync via Plaid',
  category: 'banking',
  supportedAuthMethods: ['custom'],
  defaultConfig: {
    defaultTimeoutMs: 30000,
    rateLimit: {
      maxRequests: 100,
      window: 'minute',
      queueWhenLimited: true,
      respectRetryAfter: true,
    },
  },
  requiredCredentialFields: ['clientId', 'secret'],
  optionalCredentialFields: ['webhookUrl', 'environment'],
  documentationUrl: 'https://plaid.com/docs/',
});
