/**
 * Chart of Accounts Types and Metadata
 *
 * Defines the structure for chart of accounts configuration, account
 * classifications, and GAAP compliance mappings.
 */

// ============================================================================
// Account Classification Enums
// ============================================================================

/**
 * High-level account categories per GAAP
 */
export const AccountCategory = {
  ASSETS: 'ASSETS',
  LIABILITIES: 'LIABILITIES',
  EQUITY: 'EQUITY',
  REVENUE: 'REVENUE',
  EXPENSES: 'EXPENSES',
} as const;

export type AccountCategoryType = (typeof AccountCategory)[keyof typeof AccountCategory];

/**
 * Account subcategories for detailed classification
 */
export const AccountSubcategory = {
  // Assets
  CURRENT_ASSETS: 'CURRENT_ASSETS',
  CASH_AND_EQUIVALENTS: 'CASH_AND_EQUIVALENTS',
  ACCOUNTS_RECEIVABLE: 'ACCOUNTS_RECEIVABLE',
  INVENTORY: 'INVENTORY',
  PREPAID_EXPENSES: 'PREPAID_EXPENSES',
  FIXED_ASSETS: 'FIXED_ASSETS',
  INTANGIBLE_ASSETS: 'INTANGIBLE_ASSETS',
  OTHER_ASSETS: 'OTHER_ASSETS',

  // Liabilities
  CURRENT_LIABILITIES: 'CURRENT_LIABILITIES',
  ACCOUNTS_PAYABLE: 'ACCOUNTS_PAYABLE',
  ACCRUED_LIABILITIES: 'ACCRUED_LIABILITIES',
  DEFERRED_REVENUE: 'DEFERRED_REVENUE',
  SHORT_TERM_DEBT: 'SHORT_TERM_DEBT',
  LONG_TERM_LIABILITIES: 'LONG_TERM_LIABILITIES',
  LONG_TERM_DEBT: 'LONG_TERM_DEBT',

  // Equity
  COMMON_STOCK: 'COMMON_STOCK',
  RETAINED_EARNINGS: 'RETAINED_EARNINGS',
  ADDITIONAL_PAID_IN_CAPITAL: 'ADDITIONAL_PAID_IN_CAPITAL',
  TREASURY_STOCK: 'TREASURY_STOCK',
  OTHER_EQUITY: 'OTHER_EQUITY',

  // Revenue
  OPERATING_REVENUE: 'OPERATING_REVENUE',
  SERVICE_REVENUE: 'SERVICE_REVENUE',
  PRODUCT_REVENUE: 'PRODUCT_REVENUE',
  SUBSCRIPTION_REVENUE: 'SUBSCRIPTION_REVENUE',
  OTHER_INCOME: 'OTHER_INCOME',

  // Expenses
  COST_OF_GOODS_SOLD: 'COST_OF_GOODS_SOLD',
  COST_OF_SERVICES: 'COST_OF_SERVICES',
  OPERATING_EXPENSES: 'OPERATING_EXPENSES',
  SALARIES_AND_WAGES: 'SALARIES_AND_WAGES',
  DEPRECIATION: 'DEPRECIATION',
  AMORTIZATION: 'AMORTIZATION',
  INTEREST_EXPENSE: 'INTEREST_EXPENSE',
  TAX_EXPENSE: 'TAX_EXPENSE',
  OTHER_EXPENSES: 'OTHER_EXPENSES',
} as const;

export type AccountSubcategoryType = (typeof AccountSubcategory)[keyof typeof AccountSubcategory];

/**
 * Normal balance type for accounts
 */
export const NormalBalance = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
} as const;

export type NormalBalanceType = (typeof NormalBalance)[keyof typeof NormalBalance];

/**
 * Cash flow statement categories
 */
export const CashFlowCategory = {
  OPERATING: 'OPERATING',
  INVESTING: 'INVESTING',
  FINANCING: 'FINANCING',
  NONE: 'NONE',
} as const;

export type CashFlowCategoryType = (typeof CashFlowCategory)[keyof typeof CashFlowCategory];

// ============================================================================
// Account Metadata Types
// ============================================================================

/**
 * Chart of Accounts entry with full metadata
 */
export interface AccountMetadata {
  /** Unique account number (e.g., "1000", "4100") */
  accountNumber: string;

  /** Account display name */
  accountName: string;

  /** Optional description */
  description?: string;

  /** High-level category (ASSETS, LIABILITIES, etc.) */
  category: AccountCategoryType;

  /** Detailed subcategory */
  subcategory: AccountSubcategoryType;

  /** Normal balance type */
  normalBalance: NormalBalanceType;

  /** Cash flow statement category */
  cashFlowCategory: CashFlowCategoryType;

  /** Whether this is a control account (summary level) */
  isControlAccount: boolean;

  /** Parent account for hierarchy (null for top-level) */
  parentAccountNumber?: string;

  /** Financial statement line item mapping */
  financialStatementLine?: string;

  /** GAAP-specific classification code */
  gaapClassification?: string;

  /** Whether account is active for posting */
  isActive: boolean;

  /** Whether account allows direct posting (vs summary only) */
  allowPosting: boolean;

  /** Currency restrictions (empty = all currencies) */
  restrictedCurrencies?: string[];

  /** Required dimensions for this account */
  requiredDimensions?: AccountDimension[];

  /** Custom tags for reporting */
  tags?: string[];
}

/**
 * Accounting dimensions that can be required for certain accounts
 */
export const AccountDimension = {
  SUBSIDIARY: 'SUBSIDIARY',
  DEPARTMENT: 'DEPARTMENT',
  LOCATION: 'LOCATION',
  CLASS: 'CLASS',
  PROJECT: 'PROJECT',
  CUSTOMER: 'CUSTOMER',
  VENDOR: 'VENDOR',
  EMPLOYEE: 'EMPLOYEE',
  ITEM: 'ITEM',
} as const;

export type AccountDimension = (typeof AccountDimension)[keyof typeof AccountDimension];

// ============================================================================
// Chart of Accounts Configuration
// ============================================================================

/**
 * Configuration for a chart of accounts template
 */
export interface ChartOfAccountsConfig {
  /** Configuration name */
  name: string;

  /** Configuration version */
  version: string;

  /** Description */
  description?: string;

  /** Base currency for the chart */
  baseCurrency: string;

  /** Account numbering scheme */
  numberingScheme: AccountNumberingScheme;

  /** Default accounts for common operations */
  defaultAccounts: DefaultAccountMappings;

  /** Account definitions */
  accounts: AccountMetadata[];

  /** Account hierarchies for reporting */
  hierarchies?: AccountHierarchy[];
}

/**
 * Account numbering scheme configuration
 */
export interface AccountNumberingScheme {
  /** Number of digits in account number */
  digits: number;

  /** Segment configuration */
  segments?: AccountNumberSegment[];

  /** Range assignments by category */
  categoryRanges: {
    [K in AccountCategoryType]?: {
      start: string;
      end: string;
    };
  };
}

/**
 * Segment definition for structured account numbers
 */
export interface AccountNumberSegment {
  /** Segment name (e.g., "main", "sub", "detail") */
  name: string;

  /** Starting position (1-based) */
  position: number;

  /** Length of segment */
  length: number;

  /** Separator character (e.g., "-", ".") */
  separator?: string;
}

/**
 * Default account mappings for common operations
 */
export interface DefaultAccountMappings {
  /** Accounts Receivable control account */
  accountsReceivable: string;

  /** Accounts Payable control account */
  accountsPayable: string;

  /** Deferred Revenue account */
  deferredRevenue: string;

  /** Recognized Revenue account */
  revenue: string;

  /** Unearned Revenue account */
  unearnedRevenue?: string;

  /** Cost of Goods Sold account */
  costOfGoodsSold: string;

  /** Cost of Services account */
  costOfServices?: string;

  /** Inventory account */
  inventory: string;

  /** Cash account */
  cash: string;

  /** Retained Earnings account */
  retainedEarnings: string;

  /** FX Gain/Loss account */
  fxGainLoss?: string;

  /** Rounding adjustment account */
  roundingAdjustment?: string;

  /** Suspense account for unbalanced entries */
  suspense?: string;

  /** Intercompany receivable (for multi-subsidiary) */
  intercompanyReceivable?: string;

  /** Intercompany payable (for multi-subsidiary) */
  intercompanyPayable?: string;
}

/**
 * Account hierarchy for roll-up reporting
 */
export interface AccountHierarchy {
  /** Hierarchy name (e.g., "Balance Sheet", "Income Statement") */
  name: string;

  /** Description */
  description?: string;

  /** Root nodes of the hierarchy */
  nodes: AccountHierarchyNode[];
}

/**
 * Node in an account hierarchy
 */
export interface AccountHierarchyNode {
  /** Node identifier */
  id: string;

  /** Display name */
  name: string;

  /** Account numbers included at this level */
  accountNumbers?: string[];

  /** Account number range (alternative to explicit list) */
  accountRange?: {
    start: string;
    end: string;
  };

  /** Child nodes */
  children?: AccountHierarchyNode[];

  /** Whether to show subtotal */
  showSubtotal?: boolean;

  /** Subtotal label */
  subtotalLabel?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get normal balance for an account category
 */
export function getNormalBalanceForCategory(category: AccountCategoryType): NormalBalanceType {
  switch (category) {
    case AccountCategory.ASSETS:
    case AccountCategory.EXPENSES:
      return NormalBalance.DEBIT;
    case AccountCategory.LIABILITIES:
    case AccountCategory.EQUITY:
    case AccountCategory.REVENUE:
      return NormalBalance.CREDIT;
    default:
      return NormalBalance.DEBIT;
  }
}

/**
 * Check if an account increase is a debit
 */
export function isDebitIncrease(category: AccountCategoryType): boolean {
  return getNormalBalanceForCategory(category) === NormalBalance.DEBIT;
}

/**
 * Get cash flow category based on account subcategory
 */
export function getDefaultCashFlowCategory(subcategory: AccountSubcategoryType): CashFlowCategoryType {
  switch (subcategory) {
    // Operating activities
    case AccountSubcategory.ACCOUNTS_RECEIVABLE:
    case AccountSubcategory.ACCOUNTS_PAYABLE:
    case AccountSubcategory.INVENTORY:
    case AccountSubcategory.PREPAID_EXPENSES:
    case AccountSubcategory.ACCRUED_LIABILITIES:
    case AccountSubcategory.DEFERRED_REVENUE:
    case AccountSubcategory.OPERATING_REVENUE:
    case AccountSubcategory.SERVICE_REVENUE:
    case AccountSubcategory.PRODUCT_REVENUE:
    case AccountSubcategory.SUBSCRIPTION_REVENUE:
    case AccountSubcategory.COST_OF_GOODS_SOLD:
    case AccountSubcategory.COST_OF_SERVICES:
    case AccountSubcategory.OPERATING_EXPENSES:
    case AccountSubcategory.SALARIES_AND_WAGES:
      return CashFlowCategory.OPERATING;

    // Investing activities
    case AccountSubcategory.FIXED_ASSETS:
    case AccountSubcategory.INTANGIBLE_ASSETS:
      return CashFlowCategory.INVESTING;

    // Financing activities
    case AccountSubcategory.SHORT_TERM_DEBT:
    case AccountSubcategory.LONG_TERM_DEBT:
    case AccountSubcategory.COMMON_STOCK:
    case AccountSubcategory.TREASURY_STOCK:
    case AccountSubcategory.ADDITIONAL_PAID_IN_CAPITAL:
      return CashFlowCategory.FINANCING;

    // Cash itself and others
    case AccountSubcategory.CASH_AND_EQUIVALENTS:
    case AccountSubcategory.RETAINED_EARNINGS:
    case AccountSubcategory.OTHER_EQUITY:
    default:
      return CashFlowCategory.NONE;
  }
}

/**
 * Validate account number format
 */
export function validateAccountNumber(
  accountNumber: string,
  scheme: AccountNumberingScheme
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check length
  const cleanNumber = accountNumber.replace(/[^0-9]/g, '');
  if (cleanNumber.length !== scheme.digits) {
    errors.push(`Account number must have ${scheme.digits} digits, got ${cleanNumber.length}`);
  }

  // Check category range if defined
  for (const [category, range] of Object.entries(scheme.categoryRanges)) {
    if (range && accountNumber >= range.start && accountNumber <= range.end) {
      // Found matching category - this is valid
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Determine account category from account number based on numbering scheme
 */
export function getCategoryFromAccountNumber(
  accountNumber: string,
  scheme: AccountNumberingScheme
): AccountCategoryType | null {
  for (const [category, range] of Object.entries(scheme.categoryRanges)) {
    if (range && accountNumber >= range.start && accountNumber <= range.end) {
      return category as AccountCategoryType;
    }
  }
  return null;
}
