/**
 * Bank Feed Service
 *
 * Orchestrates bank feed operations across multiple providers (Plaid, Yodlee).
 * Handles transaction deduplication, sync management, and GL mapping.
 */

import {
  ConnectorBaseService,
  ConnectorServiceContext,
  ConnectorServiceError,
} from './connector-framework';
import { PlaidConnector, PlaidConnectorConfig } from './plaid-connector';
import { YodleeConnector, YodleeConnectorConfig } from './yodlee-connector';

// Note: Use ServiceContext from common.types, ConnectorServiceContext is internal

import type {
  BankFeedProvider,
  BankAccount,
  BankTransaction,
  BankConnection,
  BankAccountBalance,
  BankFeedSyncCursor,
  BankFeedSyncOptions,
  BankFeedSyncResult,
  BankFeedSyncError,
  DeduplicationStrategy,
  DuplicateCheckResult,
  BankFeedGLMapping,
  BankFeedMappingRule,
  BankReconciliationSession,
  ReconciliationMatchSuggestion,
  PlaidLinkTokenRequest,
  PlaidLinkTokenResponse,
  YodleeFastLinkConfig,
} from '../types/bank-feed.types';

// ============================================================================
// Types
// ============================================================================

/**
 * Bank feed service configuration
 */
export interface BankFeedServiceConfig {
  /** Plaid configuration (optional) */
  plaid?: PlaidConnectorConfig;
  /** Yodlee configuration (optional) */
  yodlee?: YodleeConnectorConfig;
  /** Default deduplication strategy */
  deduplicationStrategy?: Partial<DeduplicationStrategy>;
  /** Auto-sync interval in minutes (0 = disabled) */
  autoSyncIntervalMinutes?: number;
  /** Maximum transactions per sync */
  maxTransactionsPerSync?: number;
}

/**
 * Stored sync state
 */
interface SyncState {
  cursors: Map<string, BankFeedSyncCursor>;
  lastSyncAt: Map<string, Date>;
  syncErrors: Map<string, BankFeedSyncError[]>;
}

/**
 * Transaction storage interface (would be backed by database)
 */
interface TransactionStore {
  getByDedupeHash(organizationId: string, hash: string): BankTransaction | undefined;
  getByProviderId(provider: BankFeedProvider, providerId: string): BankTransaction | undefined;
  upsert(transaction: BankTransaction): void;
  markRemoved(transactionId: string): void;
  getByAccountId(accountId: string, options?: { startDate?: Date; endDate?: Date }): BankTransaction[];
}

// ============================================================================
// Bank Feed Service Implementation
// ============================================================================

/**
 * Bank feed service for managing bank account connections and transaction sync
 */
export class BankFeedService extends ConnectorBaseService {
  private plaidConnector?: PlaidConnector;
  private yodleeConnector?: YodleeConnector;
  private config: BankFeedServiceConfig;
  private syncState: SyncState;
  private dedupeStrategy: DeduplicationStrategy;

  // In-memory stores (would be database-backed in production)
  private connections: Map<string, BankConnection> = new Map();
  private accounts: Map<string, BankAccount> = new Map();
  private transactions: Map<string, BankTransaction> = new Map();
  private dedupeIndex: Map<string, string> = new Map(); // hash -> transactionId
  private glMappings: Map<string, BankFeedGLMapping> = new Map();

  constructor(context: ConnectorServiceContext, config: BankFeedServiceConfig) {
    super(context);
    this.config = config;

    // Initialize connectors if configured
    if (config.plaid) {
      this.plaidConnector = new PlaidConnector(
        { organizationId: context.organizationId, userId: context.userId },
        config.plaid
      );
    }

    if (config.yodlee) {
      this.yodleeConnector = new YodleeConnector(
        { organizationId: context.organizationId, userId: context.userId },
        config.yodlee
      );
    }

    // Initialize sync state
    this.syncState = {
      cursors: new Map(),
      lastSyncAt: new Map(),
      syncErrors: new Map(),
    };

    // Initialize deduplication strategy
    this.dedupeStrategy = {
      useProviderTransactionId: true,
      useHashDedup: true,
      hashFields: ['accountId', 'date', 'amount', 'description'],
      fuzzyMatchWindowDays: 3,
      amountTolerancePercent: 0,
      ...config.deduplicationStrategy,
    };
  }

  /**
   * Create a service error
   */
  private createError(
    message: string,
    code: string,
    statusCode: number = 400
  ): ConnectorServiceError {
    return new ConnectorServiceError(message, code, statusCode);
  }

  // ============================================================================
  // Provider Access
  // ============================================================================

  /**
   * Get Plaid connector (throws if not configured)
   */
  getPlaidConnector(): PlaidConnector {
    if (!this.plaidConnector) {
      throw this.createError('Plaid connector not configured', 'PLAID_NOT_CONFIGURED', 400);
    }
    return this.plaidConnector;
  }

  /**
   * Get Yodlee connector (throws if not configured)
   */
  getYodleeConnector(): YodleeConnector {
    if (!this.yodleeConnector) {
      throw this.createError('Yodlee connector not configured', 'YODLEE_NOT_CONFIGURED', 400);
    }
    return this.yodleeConnector;
  }

  /**
   * Check if a provider is configured
   */
  isProviderConfigured(provider: BankFeedProvider): boolean {
    return provider === 'plaid' ? !!this.plaidConnector : !!this.yodleeConnector;
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Create a Plaid Link token for account linking
   */
  async createPlaidLinkToken(
    request: Omit<PlaidLinkTokenRequest, 'clientUserId'>
  ): Promise<PlaidLinkTokenResponse> {
    const userId = this.requireUserContext();
    const plaid = this.getPlaidConnector();

    return plaid.createLinkToken({
      ...request,
      clientUserId: userId,
    });
  }

  /**
   * Complete Plaid Link and create connection
   */
  async completePlaidLink(publicToken: string): Promise<BankConnection> {
    const organizationId = this.requireOrganizationContext();
    const plaid = this.getPlaidConnector();

    // Exchange public token for access token
    const { accessToken, itemId } = await plaid.exchangePublicToken(publicToken);

    // Get item and account details
    const item = await plaid.getItem(accessToken);
    const accounts = await plaid.getAccounts(accessToken);

    // Create connection record
    const connection: BankConnection = {
      id: `conn_${itemId}`,
      organizationId,
      provider: 'plaid',
      providerItemId: itemId,
      institutionId: item.institutionId,
      institutionName: accounts[0]?.institutionName ?? 'Unknown Institution',
      status: item.error ? 'error' : 'active',
      error: item.error
        ? {
            code: item.error.errorCode,
            message: item.error.errorMessage,
            displayMessage: item.error.displayMessage,
            requiresUserAction: item.updateType === 'user_present_required',
          }
        : undefined,
      consentExpiresAt: item.consentExpirationTime,
      accounts: accounts.map((a) => a.id),
      credentialsRef: `encrypted:${accessToken}`, // Would be encrypted in production
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store connection and accounts
    this.connections.set(connection.id, connection);
    for (const account of accounts) {
      this.accounts.set(account.id, account);
    }

    return connection;
  }

  /**
   * Get Yodlee FastLink configuration for account linking
   */
  async getYodleeFastLinkConfig(userLoginName: string): Promise<YodleeFastLinkConfig> {
    const yodlee = this.getYodleeConnector();
    return yodlee.getFastLinkConfig(userLoginName);
  }

  /**
   * Complete Yodlee FastLink and create connection
   */
  async completeYodleeLink(
    userLoginName: string,
    providerAccountId: number
  ): Promise<BankConnection> {
    const organizationId = this.requireOrganizationContext();
    const yodlee = this.getYodleeConnector();

    // Get provider account and accounts
    const providerAccount = await yodlee.getProviderAccount(userLoginName, providerAccountId);
    const accounts = await yodlee.getAccounts(userLoginName, providerAccountId);

    // Create connection record
    const connection: BankConnection = {
      id: `conn_${providerAccountId}`,
      organizationId,
      provider: 'yodlee',
      providerItemId: providerAccountId.toString(),
      institutionId: providerAccount.providerId.toString(),
      institutionName: providerAccount.providerName,
      status: providerAccount.status === 'SUCCESS' ? 'active' : 'error',
      error:
        providerAccount.status !== 'SUCCESS'
          ? {
              code: providerAccount.refreshInfo?.statusCode?.toString() ?? 'UNKNOWN',
              message: providerAccount.refreshInfo?.statusMessage ?? 'Unknown error',
              requiresUserAction: true,
            }
          : undefined,
      lastSuccessfulSync: providerAccount.refreshInfo?.lastRefreshed
        ? new Date(providerAccount.refreshInfo.lastRefreshed)
        : undefined,
      accounts: accounts.map((a) => a.id),
      credentialsRef: `yodlee:${userLoginName}:${providerAccountId}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store connection and accounts
    this.connections.set(connection.id, connection);
    for (const account of accounts) {
      this.accounts.set(account.id, account);
    }

    return connection;
  }

  /**
   * Get all connections for the organization
   */
  getConnections(): BankConnection[] {
    const organizationId = this.requireOrganizationContext();
    return Array.from(this.connections.values()).filter(
      (c) => c.organizationId === organizationId
    );
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): BankConnection | undefined {
    const connection = this.connections.get(connectionId);
    if (connection && connection.organizationId !== this.requireOrganizationContext()) {
      return undefined;
    }
    return connection;
  }

  /**
   * Remove a connection
   */
  async removeConnection(connectionId: string): Promise<void> {
    const connection = this.getConnection(connectionId);
    if (!connection) {
      throw this.createError('Connection not found', 'CONNECTION_NOT_FOUND', 404);
    }

    // Remove from provider
    if (connection.provider === 'plaid' && this.plaidConnector) {
      const accessToken = connection.credentialsRef.replace('encrypted:', '');
      await this.plaidConnector.removeItem(accessToken);
    } else if (connection.provider === 'yodlee' && this.yodleeConnector) {
      const [, userLoginName, providerAccountId] = connection.credentialsRef.split(':');
      await this.yodleeConnector.deleteProviderAccount(userLoginName, parseInt(providerAccountId));
    }

    // Remove local data
    this.connections.delete(connectionId);
    for (const accountId of connection.accounts) {
      this.accounts.delete(accountId);
    }
  }

  // ============================================================================
  // Account Operations
  // ============================================================================

  /**
   * Get all accounts for the organization
   */
  getAccounts(): BankAccount[] {
    const organizationId = this.requireOrganizationContext();
    return Array.from(this.accounts.values()).filter(
      (a) => a.organizationId === organizationId
    );
  }

  /**
   * Get account by ID
   */
  getAccount(accountId: string): BankAccount | undefined {
    const account = this.accounts.get(accountId);
    if (account && account.organizationId !== this.requireOrganizationContext()) {
      return undefined;
    }
    return account;
  }

  /**
   * Get account balances
   */
  async refreshAccountBalances(connectionId: string): Promise<BankAccountBalance[]> {
    const connection = this.getConnection(connectionId);
    if (!connection) {
      throw this.createError('Connection not found', 'CONNECTION_NOT_FOUND', 404);
    }

    if (connection.provider === 'plaid' && this.plaidConnector) {
      const accessToken = connection.credentialsRef.replace('encrypted:', '');
      return this.plaidConnector.getAccountBalances(accessToken);
    } else if (connection.provider === 'yodlee' && this.yodleeConnector) {
      const [, userLoginName] = connection.credentialsRef.split(':');
      return this.yodleeConnector.getAccountBalances(userLoginName);
    }

    throw this.createError('Provider not configured', 'PROVIDER_NOT_CONFIGURED', 400);
  }

  /**
   * Map bank account to GL account
   */
  mapAccountToGL(bankAccountId: string, glAccountId: string): void {
    const account = this.getAccount(bankAccountId);
    if (!account) {
      throw this.createError('Account not found', 'ACCOUNT_NOT_FOUND', 404);
    }

    account.glAccountId = glAccountId;
    account.updatedAt = new Date();
    this.accounts.set(bankAccountId, account);
  }

  // ============================================================================
  // Transaction Sync
  // ============================================================================

  /**
   * Sync transactions for a connection
   */
  async syncTransactions(
    connectionId: string,
    options: BankFeedSyncOptions = {}
  ): Promise<BankFeedSyncResult> {
    const connection = this.getConnection(connectionId);
    if (!connection) {
      throw this.createError('Connection not found', 'CONNECTION_NOT_FOUND', 404);
    }

    // Get cursor for incremental sync
    const cursor = this.syncState.cursors.get(connectionId);

    let result: BankFeedSyncResult;

    if (connection.provider === 'plaid' && this.plaidConnector) {
      const accessToken = connection.credentialsRef.replace('encrypted:', '');
      result = await this.plaidConnector.syncTransactions(accessToken, options, cursor);
    } else if (connection.provider === 'yodlee' && this.yodleeConnector) {
      const [, userLoginName] = connection.credentialsRef.split(':');
      result = await this.yodleeConnector.syncTransactions(userLoginName, options);
    } else {
      throw this.createError('Provider not configured', 'PROVIDER_NOT_CONFIGURED', 400);
    }

    // Process and deduplicate transactions
    const processedResult = await this.processTransactionSync(connection, result);

    // Update sync state
    if (result.newCursor) {
      this.syncState.cursors.set(connectionId, {
        provider: connection.provider,
        accountId: connectionId,
        cursor: result.newCursor,
        lastSyncAt: new Date(),
        transactionCount: processedResult.transactionsAdded,
      });
    }

    this.syncState.lastSyncAt.set(connectionId, new Date());
    if (result.errors.length > 0) {
      this.syncState.syncErrors.set(connectionId, result.errors);
    }

    // Update connection status
    connection.lastSuccessfulSync = result.success ? new Date() : connection.lastSuccessfulSync;
    connection.lastSyncAttempt = new Date();
    connection.status = result.success ? 'active' : 'error';
    connection.updatedAt = new Date();
    this.connections.set(connectionId, connection);

    return processedResult;
  }

  /**
   * Process synced transactions (deduplication, storage)
   */
  private async processTransactionSync(
    connection: BankConnection,
    syncResult: BankFeedSyncResult
  ): Promise<BankFeedSyncResult> {
    let duplicatesSkipped = 0;
    const organizationId = this.requireOrganizationContext();

    // This would process the raw sync result and store transactions
    // For now, we'll track duplicates skipped

    // In a real implementation, we would:
    // 1. Check each transaction against dedupe index
    // 2. Store new transactions
    // 3. Update modified transactions
    // 4. Mark removed transactions

    return {
      ...syncResult,
      duplicatesSkipped,
    };
  }

  /**
   * Check if a transaction is a duplicate
   */
  checkDuplicate(transaction: BankTransaction): DuplicateCheckResult {
    // Check by provider transaction ID
    if (this.dedupeStrategy.useProviderTransactionId) {
      const existingByProviderId = Array.from(this.transactions.values()).find(
        (t) =>
          t.provider === transaction.provider &&
          t.providerTransactionId === transaction.providerTransactionId
      );

      if (existingByProviderId) {
        return {
          isDuplicate: true,
          existingTransactionId: existingByProviderId.id,
          matchType: 'exact',
          confidence: 1.0,
        };
      }
    }

    // Check by dedupe hash
    if (this.dedupeStrategy.useHashDedup) {
      const existingId = this.dedupeIndex.get(transaction.dedupeHash);
      if (existingId) {
        return {
          isDuplicate: true,
          existingTransactionId: existingId,
          matchType: 'exact',
          confidence: 1.0,
        };
      }
    }

    // Fuzzy matching within date window
    const windowStart = new Date(transaction.date);
    windowStart.setDate(windowStart.getDate() - this.dedupeStrategy.fuzzyMatchWindowDays);
    const windowEnd = new Date(transaction.date);
    windowEnd.setDate(windowEnd.getDate() + this.dedupeStrategy.fuzzyMatchWindowDays);

    for (const existing of this.transactions.values()) {
      if (
        existing.accountId === transaction.accountId &&
        existing.date >= windowStart &&
        existing.date <= windowEnd
      ) {
        // Check amount tolerance
        const amountDiff = Math.abs(existing.amount - transaction.amount);
        const tolerance = Math.abs(existing.amount) * (this.dedupeStrategy.amountTolerancePercent / 100);

        if (amountDiff <= tolerance) {
          // Check description similarity (simple contains check)
          const existingDesc = existing.description.toLowerCase();
          const newDesc = transaction.description.toLowerCase();

          if (existingDesc.includes(newDesc) || newDesc.includes(existingDesc)) {
            return {
              isDuplicate: true,
              existingTransactionId: existing.id,
              matchType: 'probable',
              confidence: 0.8,
            };
          }
        }
      }
    }

    return {
      isDuplicate: false,
      matchType: 'none',
      confidence: 0,
    };
  }

  // ============================================================================
  // Transaction Retrieval
  // ============================================================================

  /**
   * Get transactions for an account
   */
  getTransactions(
    accountId: string,
    options: { startDate?: Date; endDate?: Date; status?: string; limit?: number } = {}
  ): BankTransaction[] {
    const organizationId = this.requireOrganizationContext();

    let transactions = Array.from(this.transactions.values()).filter(
      (t) => t.accountId === accountId && t.organizationId === organizationId
    );

    if (options.startDate) {
      transactions = transactions.filter((t) => t.date >= options.startDate!);
    }

    if (options.endDate) {
      transactions = transactions.filter((t) => t.date <= options.endDate!);
    }

    if (options.status) {
      transactions = transactions.filter((t) => t.status === options.status);
    }

    // Sort by date descending
    transactions.sort((a, b) => b.date.getTime() - a.date.getTime());

    if (options.limit) {
      transactions = transactions.slice(0, options.limit);
    }

    return transactions;
  }

  /**
   * Get a single transaction
   */
  getTransaction(transactionId: string): BankTransaction | undefined {
    const transaction = this.transactions.get(transactionId);
    if (transaction && transaction.organizationId !== this.requireOrganizationContext()) {
      return undefined;
    }
    return transaction;
  }

  /**
   * Mark transaction as reconciled
   */
  markTransactionReconciled(transactionId: string, glTransactionId: string): void {
    const transaction = this.getTransaction(transactionId);
    if (!transaction) {
      throw this.createError('Transaction not found', 'TRANSACTION_NOT_FOUND', 404);
    }

    transaction.isReconciled = true;
    transaction.glTransactionId = glTransactionId;
    transaction.updatedAt = new Date();
    this.transactions.set(transactionId, transaction);
  }

  // ============================================================================
  // GL Mapping
  // ============================================================================

  /**
   * Create or update GL mapping for a bank account
   */
  setGLMapping(mapping: Omit<BankFeedGLMapping, 'id' | 'createdAt' | 'updatedAt'>): BankFeedGLMapping {
    const organizationId = this.requireOrganizationContext();

    const existingMapping = Array.from(this.glMappings.values()).find(
      (m) => m.bankAccountId === mapping.bankAccountId && m.organizationId === organizationId
    );

    const fullMapping: BankFeedGLMapping = {
      ...mapping,
      id: existingMapping?.id ?? `mapping_${Date.now()}`,
      organizationId,
      createdAt: existingMapping?.createdAt ?? new Date(),
      updatedAt: new Date(),
    };

    this.glMappings.set(fullMapping.id, fullMapping);
    return fullMapping;
  }

  /**
   * Get GL mapping for a bank account
   */
  getGLMapping(bankAccountId: string): BankFeedGLMapping | undefined {
    const organizationId = this.requireOrganizationContext();
    return Array.from(this.glMappings.values()).find(
      (m) => m.bankAccountId === bankAccountId && m.organizationId === organizationId
    );
  }

  /**
   * Apply mapping rules to categorize a transaction
   */
  applyMappingRules(
    transaction: BankTransaction,
    mapping: BankFeedGLMapping
  ): string | undefined {
    // Sort rules by priority
    const sortedRules = [...mapping.rules].sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      if (!rule.isActive) continue;

      const matches = rule.conditions.every((condition) => {
        const value = transaction[condition.field as keyof BankTransaction];
        if (value === undefined) return false;

        switch (condition.operator) {
          case 'equals':
            return condition.caseSensitive
              ? String(value) === String(condition.value)
              : String(value).toLowerCase() === String(condition.value).toLowerCase();
          case 'contains':
            return condition.caseSensitive
              ? String(value).includes(String(condition.value))
              : String(value).toLowerCase().includes(String(condition.value).toLowerCase());
          case 'startsWith':
            return condition.caseSensitive
              ? String(value).startsWith(String(condition.value))
              : String(value).toLowerCase().startsWith(String(condition.value).toLowerCase());
          case 'endsWith':
            return condition.caseSensitive
              ? String(value).endsWith(String(condition.value))
              : String(value).toLowerCase().endsWith(String(condition.value).toLowerCase());
          case 'greaterThan':
            return Number(value) > Number(condition.value);
          case 'lessThan':
            return Number(value) < Number(condition.value);
          case 'regex':
            return new RegExp(String(condition.value), condition.caseSensitive ? '' : 'i').test(
              String(value)
            );
          default:
            return false;
        }
      });

      if (matches) {
        return rule.targetGLAccountId;
      }
    }

    // Return default account if no rules match
    return mapping.defaultCashAccountId;
  }

  // ============================================================================
  // Reconciliation Helpers
  // ============================================================================

  /**
   * Get reconciliation match suggestions
   */
  getReconciliationSuggestions(
    bankTransactionId: string,
    glTransactions: Array<{ id: string; amount: number; date: Date; description: string }>
  ): ReconciliationMatchSuggestion[] {
    const bankTxn = this.getTransaction(bankTransactionId);
    if (!bankTxn) {
      throw this.createError('Transaction not found', 'TRANSACTION_NOT_FOUND', 404);
    }

    const suggestions: ReconciliationMatchSuggestion[] = [];

    for (const glTxn of glTransactions) {
      const amountDiff = Math.abs(bankTxn.amount - glTxn.amount);
      const dateDiff = Math.abs(bankTxn.date.getTime() - glTxn.date.getTime()) / (1000 * 60 * 60 * 24);

      // Calculate match score
      let score = 0;
      const reasons: string[] = [];

      // Exact amount match
      if (amountDiff === 0) {
        score += 40;
        reasons.push('Exact amount match');
      } else if (amountDiff < Math.abs(bankTxn.amount) * 0.01) {
        score += 20;
        reasons.push('Amount within 1%');
      }

      // Date proximity
      if (dateDiff === 0) {
        score += 30;
        reasons.push('Same date');
      } else if (dateDiff <= 3) {
        score += 20;
        reasons.push('Within 3 days');
      } else if (dateDiff <= 7) {
        score += 10;
        reasons.push('Within 7 days');
      }

      // Description similarity
      const bankDesc = bankTxn.description.toLowerCase();
      const glDesc = glTxn.description.toLowerCase();
      if (bankDesc === glDesc) {
        score += 30;
        reasons.push('Exact description match');
      } else if (bankDesc.includes(glDesc) || glDesc.includes(bankDesc)) {
        score += 15;
        reasons.push('Partial description match');
      }

      if (score > 30) {
        suggestions.push({
          bankTransactionId,
          glTransactionId: glTxn.id,
          matchScore: score,
          matchReasons: reasons,
          amountDifference: amountDiff,
          dateDifference: dateDiff,
        });
      }
    }

    // Sort by score descending
    suggestions.sort((a, b) => b.matchScore - a.matchScore);

    return suggestions;
  }

  // ============================================================================
  // Health Checks
  // ============================================================================

  /**
   * Check health of all connections
   */
  async checkConnectionHealth(): Promise<Array<{ connectionId: string; healthy: boolean; error?: string }>> {
    const connections = this.getConnections();
    const results: Array<{ connectionId: string; healthy: boolean; error?: string }> = [];

    for (const connection of connections) {
      try {
        if (connection.provider === 'plaid' && this.plaidConnector) {
          const accessToken = connection.credentialsRef.replace('encrypted:', '');
          const item = await this.plaidConnector.getItem(accessToken);
          results.push({
            connectionId: connection.id,
            healthy: !item.error,
            error: item.error?.errorMessage,
          });
        } else if (connection.provider === 'yodlee' && this.yodleeConnector) {
          const [, userLoginName, providerAccountId] = connection.credentialsRef.split(':');
          const providerAccount = await this.yodleeConnector.getProviderAccount(
            userLoginName,
            parseInt(providerAccountId)
          );
          results.push({
            connectionId: connection.id,
            healthy: providerAccount.status === 'SUCCESS',
            error: providerAccount.refreshInfo?.statusMessage,
          });
        }
      } catch (error) {
        results.push({
          connectionId: connection.id,
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Get sync status for all connections
   */
  getSyncStatus(): Array<{
    connectionId: string;
    lastSyncAt?: Date;
    hasErrors: boolean;
    errorCount: number;
  }> {
    const connections = this.getConnections();

    return connections.map((connection) => ({
      connectionId: connection.id,
      lastSyncAt: this.syncState.lastSyncAt.get(connection.id),
      hasErrors: (this.syncState.syncErrors.get(connection.id)?.length ?? 0) > 0,
      errorCount: this.syncState.syncErrors.get(connection.id)?.length ?? 0,
    }));
  }
}
