/**
 * Bank Feed Types
 *
 * Type definitions for bank feed integrations including Plaid and Yodlee.
 * Provides both provider-specific types and normalized/unified types.
 */

// ============================================================================
// Common Bank Feed Types
// ============================================================================

/**
 * Bank feed provider types
 */
export type BankFeedProvider = 'plaid' | 'yodlee';

/**
 * Account types supported by bank feeds
 */
export type BankAccountType =
  | 'checking'
  | 'savings'
  | 'money_market'
  | 'credit_card'
  | 'loan'
  | 'investment'
  | 'other';

/**
 * Account subtypes for more specific categorization
 */
export type BankAccountSubtype =
  | 'checking'
  | 'savings'
  | 'hsa'
  | 'cd'
  | 'money_market'
  | 'paypal'
  | 'prepaid'
  | 'cash_management'
  | 'credit_card'
  | 'auto'
  | 'mortgage'
  | 'home_equity'
  | 'line_of_credit'
  | 'student'
  | 'brokerage'
  | '401k'
  | 'ira'
  | 'roth'
  | 'other';

/**
 * Transaction status
 */
export type BankTransactionStatus = 'pending' | 'posted' | 'canceled';

/**
 * Transaction direction
 */
export type TransactionDirection = 'credit' | 'debit';

/**
 * Transaction category level 1 (high-level)
 */
export type TransactionCategoryPrimary =
  | 'income'
  | 'transfer'
  | 'loan_payments'
  | 'bank_fees'
  | 'entertainment'
  | 'food_and_drink'
  | 'general_merchandise'
  | 'general_services'
  | 'government_and_non_profit'
  | 'home_improvement'
  | 'medical'
  | 'personal_care'
  | 'rent_and_utilities'
  | 'transportation'
  | 'travel'
  | 'other';

// ============================================================================
// Normalized Bank Account Types
// ============================================================================

/**
 * Normalized bank account information
 */
export interface BankAccount {
  /** Internal ID */
  id: string;
  /** Provider-specific account ID */
  providerAccountId: string;
  /** Bank feed provider */
  provider: BankFeedProvider;
  /** Institution ID */
  institutionId: string;
  /** Institution name */
  institutionName: string;
  /** Account name (e.g., "Main Checking") */
  name: string;
  /** Official account name from the institution */
  officialName?: string;
  /** Account type */
  type: BankAccountType;
  /** Account subtype */
  subtype?: BankAccountSubtype;
  /** Account mask (last 4 digits) */
  mask?: string;
  /** Current balance */
  currentBalance?: number;
  /** Available balance */
  availableBalance?: number;
  /** Credit limit (for credit accounts) */
  creditLimit?: number;
  /** ISO currency code */
  currency: string;
  /** Whether account is active */
  isActive: boolean;
  /** Last sync timestamp */
  lastSyncAt?: Date;
  /** Organization ID */
  organizationId: string;
  /** Mapped GL cash account ID */
  glAccountId?: string;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Bank account balance snapshot
 */
export interface BankAccountBalance {
  accountId: string;
  current: number;
  available?: number;
  limit?: number;
  currency: string;
  timestamp: Date;
}

// ============================================================================
// Normalized Bank Transaction Types
// ============================================================================

/**
 * Normalized bank transaction
 */
export interface BankTransaction {
  /** Internal ID */
  id: string;
  /** Provider-specific transaction ID */
  providerTransactionId: string;
  /** Bank feed provider */
  provider: BankFeedProvider;
  /** Bank account ID (internal) */
  accountId: string;
  /** Transaction amount (positive for credits, negative for debits) */
  amount: number;
  /** Transaction direction */
  direction: TransactionDirection;
  /** ISO currency code */
  currency: string;
  /** Transaction date */
  date: Date;
  /** Authorized date (for pending transactions) */
  authorizedDate?: Date;
  /** Transaction status */
  status: BankTransactionStatus;
  /** Merchant name */
  merchantName?: string;
  /** Transaction description/memo */
  description: string;
  /** Primary category */
  categoryPrimary?: TransactionCategoryPrimary;
  /** Detailed category path */
  categoryDetailed?: string[];
  /** Payment channel (e.g., "online", "in_store", "other") */
  paymentChannel?: string;
  /** Check number (if applicable) */
  checkNumber?: string;
  /** Whether this is a transfer between accounts */
  isTransfer?: boolean;
  /** Location information */
  location?: BankTransactionLocation;
  /** Organization ID */
  organizationId: string;
  /** Deduplication hash */
  dedupeHash: string;
  /** Whether this has been reconciled */
  isReconciled: boolean;
  /** Linked GL transaction ID (after posting) */
  glTransactionId?: string;
  /** Raw provider data (for debugging) */
  rawData?: Record<string, unknown>;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Transaction location information
 */
export interface BankTransactionLocation {
  address?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  lat?: number;
  lon?: number;
  storeNumber?: string;
}

// ============================================================================
// Plaid-Specific Types
// ============================================================================

/**
 * Plaid Link token create request
 */
export interface PlaidLinkTokenRequest {
  clientUserId: string;
  clientName: string;
  products: PlaidProduct[];
  countryCodes: string[];
  language: string;
  webhook?: string;
  accessToken?: string; // For update mode
  linkCustomizationName?: string;
  redirectUri?: string;
  accountFilters?: PlaidAccountFilters;
}

/**
 * Plaid Link token response
 */
export interface PlaidLinkTokenResponse {
  linkToken: string;
  expiration: Date;
  requestId: string;
}

/**
 * Plaid product types
 */
export type PlaidProduct =
  | 'transactions'
  | 'auth'
  | 'identity'
  | 'investments'
  | 'liabilities'
  | 'assets'
  | 'balance';

/**
 * Plaid account filters for Link
 */
export interface PlaidAccountFilters {
  depository?: {
    accountSubtypes: string[];
  };
  credit?: {
    accountSubtypes: string[];
  };
  loan?: {
    accountSubtypes: string[];
  };
  investment?: {
    accountSubtypes: string[];
  };
}

/**
 * Plaid public token exchange request
 */
export interface PlaidTokenExchangeRequest {
  publicToken: string;
}

/**
 * Plaid access token response
 */
export interface PlaidAccessTokenResponse {
  accessToken: string;
  itemId: string;
  requestId: string;
}

/**
 * Plaid Item (connection to a financial institution)
 */
export interface PlaidItem {
  itemId: string;
  institutionId: string;
  webhook?: string;
  error?: PlaidError;
  availableProducts: PlaidProduct[];
  billedProducts: PlaidProduct[];
  consentExpirationTime?: Date;
  updateType: 'background' | 'user_present_required';
}

/**
 * Plaid error response
 */
export interface PlaidError {
  errorType: string;
  errorCode: string;
  errorMessage: string;
  displayMessage?: string;
  requestId?: string;
  causes?: unknown[];
  status?: number;
  documentationUrl?: string;
  suggestedAction?: string;
}

/**
 * Plaid account from API response
 */
export interface PlaidAccount {
  account_id: string;
  balances: {
    available: number | null;
    current: number | null;
    iso_currency_code: string | null;
    limit: number | null;
    unofficial_currency_code: string | null;
  };
  mask: string | null;
  name: string;
  official_name: string | null;
  type: string;
  subtype: string | null;
  verification_status?: string;
}

/**
 * Plaid transaction from API response
 */
export interface PlaidTransaction {
  transaction_id: string;
  account_id: string;
  amount: number;
  iso_currency_code: string | null;
  unofficial_currency_code: string | null;
  category: string[] | null;
  category_id: string | null;
  check_number: string | null;
  date: string;
  authorized_date: string | null;
  location: {
    address: string | null;
    city: string | null;
    region: string | null;
    postal_code: string | null;
    country: string | null;
    lat: number | null;
    lon: number | null;
    store_number: string | null;
  };
  name: string;
  merchant_name: string | null;
  payment_channel: string;
  pending: boolean;
  pending_transaction_id: string | null;
  account_owner: string | null;
  transaction_type: string;
  transaction_code: string | null;
  personal_finance_category?: {
    primary: string;
    detailed: string;
    confidence_level?: string;
  };
}

/**
 * Plaid transactions sync request
 */
export interface PlaidTransactionsSyncRequest {
  accessToken: string;
  cursor?: string;
  count?: number;
  options?: {
    includeOriginalDescription?: boolean;
    includePersonalFinanceCategory?: boolean;
  };
}

/**
 * Plaid transactions sync response
 */
export interface PlaidTransactionsSyncResponse {
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: { transaction_id: string }[];
  nextCursor: string;
  hasMore: boolean;
  accountsWithChanges?: string[];
  requestId: string;
}

/**
 * Plaid webhook types
 */
export type PlaidWebhookType =
  | 'TRANSACTIONS'
  | 'ITEM'
  | 'AUTH'
  | 'ASSETS'
  | 'INCOME'
  | 'IDENTITY'
  | 'LIABILITIES';

/**
 * Plaid webhook codes for transactions
 */
export type PlaidTransactionWebhookCode =
  | 'INITIAL_UPDATE'
  | 'HISTORICAL_UPDATE'
  | 'DEFAULT_UPDATE'
  | 'TRANSACTIONS_REMOVED'
  | 'SYNC_UPDATES_AVAILABLE';

/**
 * Plaid webhook payload
 */
export interface PlaidWebhookPayload {
  webhook_type: PlaidWebhookType;
  webhook_code: string;
  item_id: string;
  error?: PlaidError;
  new_transactions?: number;
  removed_transactions?: string[];
  consent_expiration_time?: string;
}

// ============================================================================
// Yodlee-Specific Types
// ============================================================================

/**
 * Yodlee provider account
 */
export interface YodleeProviderAccount {
  id: number;
  providerId: number;
  providerName: string;
  status: 'SUCCESS' | 'FAILED' | 'IN_PROGRESS' | 'PARTIAL_SUCCESS';
  refreshInfo?: {
    statusCode: number;
    statusMessage: string;
    lastRefreshed: string;
    nextRefreshScheduled: string;
    additionalStatus?: string;
  };
  dataset?: Array<{
    name: string;
    additionalStatus?: string;
    updateEligibility?: string;
    lastUpdated: string;
    lastUpdateAttempt: string;
    nextUpdateScheduled: string;
  }>;
  createdDate: string;
}

/**
 * Yodlee account from API
 */
export interface YodleeAccount {
  id: number;
  accountName: string;
  accountNumber: string;
  accountType: string;
  accountStatus: 'ACTIVE' | 'INACTIVE' | 'CLOSED';
  balance?: {
    amount: number;
    currency: string;
  };
  availableBalance?: {
    amount: number;
    currency: string;
  };
  currentBalance?: {
    amount: number;
    currency: string;
  };
  availableCash?: {
    amount: number;
    currency: string;
  };
  availableCredit?: {
    amount: number;
    currency: string;
  };
  totalCreditLine?: {
    amount: number;
    currency: string;
  };
  providerAccountId: number;
  providerId: number;
  providerName: string;
  displayedName: string;
  isAsset: boolean;
  includeInNetWorth: boolean;
  lastUpdated: string;
  createdDate: string;
  dataset?: Array<{
    name: string;
    lastUpdated: string;
    updateEligibility?: string;
    additionalStatus?: string;
  }>;
}

/**
 * Yodlee transaction from API
 */
export interface YodleeTransaction {
  id: number;
  accountId: number;
  amount: {
    amount: number;
    currency: string;
  };
  baseType: 'CREDIT' | 'DEBIT';
  categoryType: string;
  category: string;
  categoryId: number;
  checkNumber?: string;
  date: string;
  description: {
    original: string;
    consumer?: string;
    simple?: string;
  };
  isManual: boolean;
  merchant?: {
    id: string;
    name: string;
    categoryLabel?: string[];
    address?: {
      address1?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
    };
  };
  postDate?: string;
  status: 'PENDING' | 'POSTED' | 'SCHEDULED' | 'FAILED' | 'CLEARED';
  transactionDate: string;
  type: string;
  detailCategoryId?: number;
  highLevelCategoryId?: number;
  sourceId?: string;
  sourceType?: string;
  runningBalance?: {
    amount: number;
    currency: string;
  };
}

/**
 * Yodlee transactions request
 */
export interface YodleeTransactionsRequest {
  accountId?: string;
  baseType?: 'CREDIT' | 'DEBIT';
  categoryId?: number;
  categoryType?: string;
  container?: string;
  fromDate?: string;
  highLevelCategoryId?: number;
  keyword?: string;
  skip?: number;
  top?: number;
  toDate?: string;
  type?: string;
}

/**
 * Yodlee transactions response
 */
export interface YodleeTransactionsResponse {
  transaction: YodleeTransaction[];
}

/**
 * Yodlee FastLink configuration
 */
export interface YodleeFastLinkConfig {
  fastLinkUrl: string;
  accessToken: string;
  params: {
    configName: string;
    flow?: string;
    providerAccountId?: number;
    providerId?: number;
  };
}

/**
 * Yodlee webhook event types
 */
export type YodleeWebhookEvent =
  | 'DATA_UPDATES'
  | 'REFRESH'
  | 'AUTO_REFRESH_UPDATES'
  | 'LATEST_BALANCE_UPDATES';

/**
 * Yodlee webhook payload
 */
export interface YodleeWebhookPayload {
  event: {
    info: string;
    data: {
      providerAccountId: number;
      providerId?: number;
      providerName?: string;
      notificationType?: string;
      loginName: string;
    };
  };
}

// ============================================================================
// Sync and Deduplication Types
// ============================================================================

/**
 * Bank feed sync cursor for incremental sync
 */
export interface BankFeedSyncCursor {
  provider: BankFeedProvider;
  accountId: string;
  /** Provider-specific cursor/token */
  cursor: string;
  /** Last successful sync timestamp */
  lastSyncAt: Date;
  /** Count of transactions synced */
  transactionCount: number;
}

/**
 * Bank feed sync options
 */
export interface BankFeedSyncOptions {
  /** Force full refresh (ignore cursor) */
  forceFullRefresh?: boolean;
  /** Start date for transaction fetch */
  startDate?: Date;
  /** End date for transaction fetch */
  endDate?: Date;
  /** Maximum transactions to fetch */
  maxTransactions?: number;
  /** Include pending transactions */
  includePending?: boolean;
  /** Include removed transactions */
  includeRemoved?: boolean;
}

/**
 * Bank feed sync result
 */
export interface BankFeedSyncResult {
  provider: BankFeedProvider;
  accountId: string;
  success: boolean;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  transactionsAdded: number;
  transactionsModified: number;
  transactionsRemoved: number;
  duplicatesSkipped: number;
  errors: BankFeedSyncError[];
  newCursor?: string;
  hasMore: boolean;
}

/**
 * Bank feed sync error
 */
export interface BankFeedSyncError {
  code: string;
  message: string;
  transactionId?: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

/**
 * Duplicate detection result
 */
export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingTransactionId?: string;
  matchType?: 'exact' | 'probable' | 'none';
  confidence: number;
}

/**
 * Transaction deduplication strategy
 */
export interface DeduplicationStrategy {
  /** Use provider transaction ID for exact match */
  useProviderTransactionId: boolean;
  /** Use hash-based deduplication */
  useHashDedup: boolean;
  /** Fields to include in hash */
  hashFields: Array<keyof BankTransaction>;
  /** Window in days for fuzzy matching */
  fuzzyMatchWindowDays: number;
  /** Amount tolerance for fuzzy matching */
  amountTolerancePercent: number;
}

// ============================================================================
// GL Mapping Types
// ============================================================================

/**
 * Bank feed to GL account mapping rule
 */
export interface BankFeedGLMapping {
  id: string;
  organizationId: string;
  bankAccountId: string;
  /** Default GL cash account for this bank account */
  defaultCashAccountId: string;
  /** Mapping rules for automatic categorization */
  rules: BankFeedMappingRule[];
  /** Whether to auto-create GL transactions */
  autoPostEnabled: boolean;
  /** Minimum amount for auto-posting */
  autoPostMinAmount?: number;
  /** Maximum amount for auto-posting */
  autoPostMaxAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Individual mapping rule
 */
export interface BankFeedMappingRule {
  id: string;
  name: string;
  priority: number;
  conditions: BankFeedMappingCondition[];
  /** GL account to map to when conditions match */
  targetGLAccountId: string;
  /** Optional description for the GL transaction */
  transactionDescription?: string;
  /** Optional memo for the GL transaction */
  transactionMemo?: string;
  isActive: boolean;
}

/**
 * Mapping condition
 */
export interface BankFeedMappingCondition {
  field: 'merchantName' | 'description' | 'amount' | 'categoryPrimary' | 'direction';
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan' | 'regex';
  value: string | number;
  caseSensitive?: boolean;
}

// ============================================================================
// Reconciliation Types
// ============================================================================

/**
 * Bank reconciliation session
 */
export interface BankReconciliationSession {
  id: string;
  organizationId: string;
  bankAccountId: string;
  glAccountId: string;
  startDate: Date;
  endDate: Date;
  startingBalance: number;
  endingBalance: number;
  status: 'draft' | 'in_progress' | 'completed' | 'voided';
  matchedCount: number;
  unmatchedBankCount: number;
  unmatchedGLCount: number;
  adjustments: BankReconciliationAdjustment[];
  completedAt?: Date;
  completedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Reconciliation adjustment
 */
export interface BankReconciliationAdjustment {
  id: string;
  type: 'outstanding_check' | 'deposit_in_transit' | 'bank_error' | 'book_error' | 'other';
  description: string;
  amount: number;
  bankTransactionId?: string;
  glTransactionId?: string;
}

/**
 * Reconciliation match suggestion
 */
export interface ReconciliationMatchSuggestion {
  bankTransactionId: string;
  glTransactionId: string;
  matchScore: number;
  matchReasons: string[];
  amountDifference: number;
  dateDifference: number;
}

// ============================================================================
// Connection Types
// ============================================================================

/**
 * Bank connection (institution link)
 */
export interface BankConnection {
  id: string;
  organizationId: string;
  provider: BankFeedProvider;
  /** Provider-specific item/connection ID */
  providerItemId: string;
  institutionId: string;
  institutionName: string;
  status: 'active' | 'needs_attention' | 'error' | 'disconnected';
  error?: {
    code: string;
    message: string;
    displayMessage?: string;
    requiresUserAction: boolean;
  };
  lastSuccessfulSync?: Date;
  lastSyncAttempt?: Date;
  consentExpiresAt?: Date;
  accounts: string[]; // Account IDs
  /** Encrypted access token reference */
  credentialsRef: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Bank institution info
 */
export interface BankInstitution {
  id: string;
  provider: BankFeedProvider;
  providerInstitutionId: string;
  name: string;
  logoUrl?: string;
  primaryColor?: string;
  websiteUrl?: string;
  countryCodes: string[];
  products: string[];
  status: 'healthy' | 'degraded' | 'down';
}
