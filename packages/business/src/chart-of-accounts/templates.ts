/**
 * Standard Chart of Accounts Templates
 *
 * Pre-configured chart of accounts templates for common use cases.
 */

import {
  ChartOfAccountsConfig,
  AccountCategory,
  AccountSubcategory,
  NormalBalance,
  CashFlowCategory,
  AccountMetadata,
  getNormalBalanceForCategory,
  getDefaultCashFlowCategory,
} from './types';

// ============================================================================
// Helper to create account metadata
// ============================================================================

function createAccount(
  accountNumber: string,
  accountName: string,
  category: keyof typeof AccountCategory,
  subcategory: keyof typeof AccountSubcategory,
  options: Partial<AccountMetadata> = {}
): AccountMetadata {
  const cat = AccountCategory[category];
  const subcat = AccountSubcategory[subcategory];

  return {
    accountNumber,
    accountName,
    category: cat,
    subcategory: subcat,
    normalBalance: getNormalBalanceForCategory(cat),
    cashFlowCategory: getDefaultCashFlowCategory(subcat),
    isControlAccount: false,
    isActive: true,
    allowPosting: true,
    ...options,
  };
}

// ============================================================================
// Standard SaaS/Subscription Revenue Template
// ============================================================================

/**
 * Standard chart of accounts template for SaaS/Subscription businesses
 * with ASC 606 revenue recognition support.
 */
export const SAAS_CHART_OF_ACCOUNTS: ChartOfAccountsConfig = {
  name: 'SaaS Standard Chart of Accounts',
  version: '1.0.0',
  description: 'Chart of accounts template for SaaS/subscription businesses with ASC 606 support',
  baseCurrency: 'USD',

  numberingScheme: {
    digits: 4,
    categoryRanges: {
      ASSETS: { start: '1000', end: '1999' },
      LIABILITIES: { start: '2000', end: '2999' },
      EQUITY: { start: '3000', end: '3999' },
      REVENUE: { start: '4000', end: '4999' },
      EXPENSES: { start: '5000', end: '9999' },
    },
  },

  defaultAccounts: {
    accountsReceivable: '1200',
    accountsPayable: '2000',
    deferredRevenue: '2100',
    unearnedRevenue: '2110',
    revenue: '4000',
    costOfGoodsSold: '5000',
    costOfServices: '5030', // Customer Support Costs (service delivery costs)
    inventory: '1300',
    cash: '1000',
    retainedEarnings: '3200',
    fxGainLoss: '8500',
    roundingAdjustment: '8600',
    suspense: '1900',
    intercompanyReceivable: '1800',
    intercompanyPayable: '2800',
  },

  accounts: [
    // ========== ASSETS (1000-1999) ==========
    // Cash & Equivalents
    createAccount('1000', 'Cash - Operating Account', 'ASSETS', 'CASH_AND_EQUIVALENTS'),
    createAccount('1010', 'Cash - Payroll Account', 'ASSETS', 'CASH_AND_EQUIVALENTS'),
    createAccount('1050', 'Petty Cash', 'ASSETS', 'CASH_AND_EQUIVALENTS'),
    createAccount('1090', 'Short-Term Investments', 'ASSETS', 'CASH_AND_EQUIVALENTS'),

    // Accounts Receivable
    createAccount('1200', 'Accounts Receivable', 'ASSETS', 'ACCOUNTS_RECEIVABLE', {
      isControlAccount: true,
      allowPosting: false,
    }),
    createAccount('1210', 'Accounts Receivable - Trade', 'ASSETS', 'ACCOUNTS_RECEIVABLE', {
      parentAccountNumber: '1200',
    }),
    createAccount('1220', 'Accounts Receivable - Other', 'ASSETS', 'ACCOUNTS_RECEIVABLE', {
      parentAccountNumber: '1200',
    }),
    createAccount('1250', 'Allowance for Doubtful Accounts', 'ASSETS', 'ACCOUNTS_RECEIVABLE', {
      normalBalance: NormalBalance.CREDIT, // Contra-asset
      parentAccountNumber: '1200',
    }),

    // Prepaid & Other Current Assets
    createAccount('1300', 'Prepaid Expenses', 'ASSETS', 'PREPAID_EXPENSES'),
    createAccount('1310', 'Prepaid Software Licenses', 'ASSETS', 'PREPAID_EXPENSES'),
    createAccount('1320', 'Prepaid Insurance', 'ASSETS', 'PREPAID_EXPENSES'),
    createAccount('1400', 'Employee Advances', 'ASSETS', 'OTHER_ASSETS'),
    createAccount('1500', 'Security Deposits', 'ASSETS', 'OTHER_ASSETS'),

    // Intercompany
    createAccount('1800', 'Intercompany Receivable', 'ASSETS', 'OTHER_ASSETS'),

    // Suspense
    createAccount('1900', 'Suspense Account', 'ASSETS', 'OTHER_ASSETS', {
      description: 'Temporary holding account for unbalanced entries',
    }),

    // Fixed Assets
    createAccount('1600', 'Computer Equipment', 'ASSETS', 'FIXED_ASSETS'),
    createAccount('1610', 'Furniture & Fixtures', 'ASSETS', 'FIXED_ASSETS'),
    createAccount('1620', 'Leasehold Improvements', 'ASSETS', 'FIXED_ASSETS'),
    createAccount('1650', 'Accumulated Depreciation - Equipment', 'ASSETS', 'FIXED_ASSETS', {
      normalBalance: NormalBalance.CREDIT, // Contra-asset
    }),
    createAccount('1660', 'Accumulated Depreciation - Furniture', 'ASSETS', 'FIXED_ASSETS', {
      normalBalance: NormalBalance.CREDIT,
    }),

    // Intangible Assets
    createAccount('1700', 'Capitalized Software Development', 'ASSETS', 'INTANGIBLE_ASSETS'),
    createAccount('1710', 'Patents & Trademarks', 'ASSETS', 'INTANGIBLE_ASSETS'),
    createAccount('1750', 'Accumulated Amortization', 'ASSETS', 'INTANGIBLE_ASSETS', {
      normalBalance: NormalBalance.CREDIT,
    }),

    // ========== LIABILITIES (2000-2999) ==========
    // Accounts Payable
    createAccount('2000', 'Accounts Payable', 'LIABILITIES', 'ACCOUNTS_PAYABLE', {
      isControlAccount: true,
      allowPosting: false,
    }),
    createAccount('2010', 'Accounts Payable - Trade', 'LIABILITIES', 'ACCOUNTS_PAYABLE', {
      parentAccountNumber: '2000',
    }),
    createAccount('2020', 'Accounts Payable - Other', 'LIABILITIES', 'ACCOUNTS_PAYABLE', {
      parentAccountNumber: '2000',
    }),

    // Deferred Revenue (Critical for SaaS/ASC 606)
    createAccount('2100', 'Deferred Revenue', 'LIABILITIES', 'DEFERRED_REVENUE', {
      isControlAccount: true,
      allowPosting: false,
      description: 'Contract liability - revenue deferred under ASC 606',
    }),
    createAccount('2110', 'Deferred Revenue - Subscriptions', 'LIABILITIES', 'DEFERRED_REVENUE', {
      parentAccountNumber: '2100',
      description: 'Deferred subscription revenue - current portion',
    }),
    createAccount('2120', 'Deferred Revenue - Professional Services', 'LIABILITIES', 'DEFERRED_REVENUE', {
      parentAccountNumber: '2100',
      description: 'Deferred professional services revenue',
    }),
    createAccount('2130', 'Deferred Revenue - Long-term', 'LIABILITIES', 'LONG_TERM_LIABILITIES', {
      description: 'Deferred revenue - non-current portion (>12 months)',
    }),

    // Accrued Liabilities
    createAccount('2200', 'Accrued Expenses', 'LIABILITIES', 'ACCRUED_LIABILITIES'),
    createAccount('2210', 'Accrued Salaries & Wages', 'LIABILITIES', 'ACCRUED_LIABILITIES'),
    createAccount('2220', 'Accrued Payroll Taxes', 'LIABILITIES', 'ACCRUED_LIABILITIES'),
    createAccount('2230', 'Accrued Vacation', 'LIABILITIES', 'ACCRUED_LIABILITIES'),
    createAccount('2240', 'Accrued Commissions', 'LIABILITIES', 'ACCRUED_LIABILITIES'),
    createAccount('2250', 'Customer Deposits', 'LIABILITIES', 'ACCRUED_LIABILITIES'),

    // Taxes Payable
    createAccount('2300', 'Sales Tax Payable', 'LIABILITIES', 'CURRENT_LIABILITIES'),
    createAccount('2310', 'Income Tax Payable', 'LIABILITIES', 'CURRENT_LIABILITIES'),

    // Debt
    createAccount('2400', 'Credit Card Payable', 'LIABILITIES', 'SHORT_TERM_DEBT'),
    createAccount('2500', 'Line of Credit', 'LIABILITIES', 'SHORT_TERM_DEBT'),
    createAccount('2600', 'Notes Payable - Current', 'LIABILITIES', 'SHORT_TERM_DEBT'),
    createAccount('2700', 'Notes Payable - Long-term', 'LIABILITIES', 'LONG_TERM_DEBT'),

    // Intercompany
    createAccount('2800', 'Intercompany Payable', 'LIABILITIES', 'CURRENT_LIABILITIES'),

    // ========== EQUITY (3000-3999) ==========
    createAccount('3000', 'Common Stock', 'EQUITY', 'COMMON_STOCK'),
    createAccount('3100', 'Additional Paid-in Capital', 'EQUITY', 'ADDITIONAL_PAID_IN_CAPITAL'),
    createAccount('3200', 'Retained Earnings', 'EQUITY', 'RETAINED_EARNINGS'),
    createAccount('3300', 'Treasury Stock', 'EQUITY', 'TREASURY_STOCK', {
      normalBalance: NormalBalance.DEBIT, // Contra-equity
    }),
    createAccount('3400', 'Accumulated Other Comprehensive Income', 'EQUITY', 'OTHER_EQUITY'),

    // ========== REVENUE (4000-4999) ==========
    // Subscription Revenue (Primary for SaaS)
    createAccount('4000', 'Subscription Revenue', 'REVENUE', 'SUBSCRIPTION_REVENUE', {
      isControlAccount: true,
      allowPosting: false,
      description: 'Recognized subscription revenue per ASC 606',
    }),
    createAccount('4010', 'Subscription Revenue - SaaS', 'REVENUE', 'SUBSCRIPTION_REVENUE', {
      parentAccountNumber: '4000',
    }),
    createAccount('4020', 'Subscription Revenue - Support', 'REVENUE', 'SUBSCRIPTION_REVENUE', {
      parentAccountNumber: '4000',
    }),
    createAccount('4030', 'Subscription Revenue - Usage-Based', 'REVENUE', 'SUBSCRIPTION_REVENUE', {
      parentAccountNumber: '4000',
    }),

    // Professional Services Revenue
    createAccount('4100', 'Professional Services Revenue', 'REVENUE', 'SERVICE_REVENUE', {
      isControlAccount: true,
      allowPosting: false,
    }),
    createAccount('4110', 'Implementation Services', 'REVENUE', 'SERVICE_REVENUE', {
      parentAccountNumber: '4100',
    }),
    createAccount('4120', 'Training Services', 'REVENUE', 'SERVICE_REVENUE', {
      parentAccountNumber: '4100',
    }),
    createAccount('4130', 'Consulting Services', 'REVENUE', 'SERVICE_REVENUE', {
      parentAccountNumber: '4100',
    }),

    // Other Revenue
    createAccount('4500', 'Other Revenue', 'REVENUE', 'OTHER_INCOME'),
    createAccount('4510', 'Interest Income', 'REVENUE', 'OTHER_INCOME'),

    // ========== COST OF REVENUE (5000-5999) ==========
    createAccount('5000', 'Cost of Revenue', 'EXPENSES', 'COST_OF_SERVICES', {
      isControlAccount: true,
      allowPosting: false,
    }),
    createAccount('5010', 'Hosting & Infrastructure', 'EXPENSES', 'COST_OF_SERVICES', {
      parentAccountNumber: '5000',
    }),
    createAccount('5020', 'Third-Party Software Costs', 'EXPENSES', 'COST_OF_SERVICES', {
      parentAccountNumber: '5000',
    }),
    createAccount('5030', 'Customer Support Costs', 'EXPENSES', 'COST_OF_SERVICES', {
      parentAccountNumber: '5000',
    }),
    createAccount('5040', 'Professional Services Cost', 'EXPENSES', 'COST_OF_SERVICES', {
      parentAccountNumber: '5000',
    }),

    // ========== OPERATING EXPENSES (6000-8999) ==========
    // Sales & Marketing
    createAccount('6000', 'Sales & Marketing Expense', 'EXPENSES', 'OPERATING_EXPENSES', {
      isControlAccount: true,
      allowPosting: false,
    }),
    createAccount('6010', 'Sales Salaries', 'EXPENSES', 'SALARIES_AND_WAGES', {
      parentAccountNumber: '6000',
    }),
    createAccount('6020', 'Sales Commissions', 'EXPENSES', 'OPERATING_EXPENSES', {
      parentAccountNumber: '6000',
    }),
    createAccount('6030', 'Marketing Programs', 'EXPENSES', 'OPERATING_EXPENSES', {
      parentAccountNumber: '6000',
    }),
    createAccount('6040', 'Advertising', 'EXPENSES', 'OPERATING_EXPENSES', {
      parentAccountNumber: '6000',
    }),

    // Research & Development
    createAccount('6500', 'Research & Development', 'EXPENSES', 'OPERATING_EXPENSES', {
      isControlAccount: true,
      allowPosting: false,
    }),
    createAccount('6510', 'Engineering Salaries', 'EXPENSES', 'SALARIES_AND_WAGES', {
      parentAccountNumber: '6500',
    }),
    createAccount('6520', 'Software & Tools', 'EXPENSES', 'OPERATING_EXPENSES', {
      parentAccountNumber: '6500',
    }),
    createAccount('6530', 'Cloud Development Costs', 'EXPENSES', 'OPERATING_EXPENSES', {
      parentAccountNumber: '6500',
    }),

    // General & Administrative
    createAccount('7000', 'General & Administrative', 'EXPENSES', 'OPERATING_EXPENSES', {
      isControlAccount: true,
      allowPosting: false,
    }),
    createAccount('7010', 'Administrative Salaries', 'EXPENSES', 'SALARIES_AND_WAGES', {
      parentAccountNumber: '7000',
    }),
    createAccount('7020', 'Professional Fees', 'EXPENSES', 'OPERATING_EXPENSES', {
      parentAccountNumber: '7000',
      description: 'Legal, accounting, consulting fees',
    }),
    createAccount('7030', 'Insurance', 'EXPENSES', 'OPERATING_EXPENSES', {
      parentAccountNumber: '7000',
    }),
    createAccount('7040', 'Rent & Facilities', 'EXPENSES', 'OPERATING_EXPENSES', {
      parentAccountNumber: '7000',
    }),
    createAccount('7050', 'Office Supplies', 'EXPENSES', 'OPERATING_EXPENSES', {
      parentAccountNumber: '7000',
    }),
    createAccount('7060', 'Travel & Entertainment', 'EXPENSES', 'OPERATING_EXPENSES', {
      parentAccountNumber: '7000',
    }),

    // Depreciation & Amortization
    createAccount('7500', 'Depreciation Expense', 'EXPENSES', 'DEPRECIATION'),
    createAccount('7510', 'Amortization Expense', 'EXPENSES', 'AMORTIZATION'),

    // Other Expenses
    createAccount('8000', 'Interest Expense', 'EXPENSES', 'INTEREST_EXPENSE'),
    createAccount('8100', 'Bank Fees', 'EXPENSES', 'OTHER_EXPENSES'),
    createAccount('8200', 'Bad Debt Expense', 'EXPENSES', 'OTHER_EXPENSES'),
    createAccount('8500', 'Foreign Exchange Gain/Loss', 'EXPENSES', 'OTHER_EXPENSES', {
      description: 'Realized and unrealized FX gains and losses',
    }),
    createAccount('8600', 'Rounding Adjustment', 'EXPENSES', 'OTHER_EXPENSES'),

    // Income Tax
    createAccount('9000', 'Income Tax Expense', 'EXPENSES', 'TAX_EXPENSE'),
  ],

  hierarchies: [
    {
      name: 'Balance Sheet',
      description: 'Standard balance sheet hierarchy',
      nodes: [
        {
          id: 'assets',
          name: 'ASSETS',
          children: [
            {
              id: 'current-assets',
              name: 'Current Assets',
              children: [
                { id: 'cash', name: 'Cash and Cash Equivalents', accountRange: { start: '1000', end: '1099' } },
                { id: 'ar', name: 'Accounts Receivable, net', accountRange: { start: '1200', end: '1299' } },
                { id: 'prepaid', name: 'Prepaid Expenses', accountRange: { start: '1300', end: '1399' } },
              ],
              showSubtotal: true,
              subtotalLabel: 'Total Current Assets',
            },
            {
              id: 'fixed-assets',
              name: 'Property and Equipment, net',
              accountRange: { start: '1600', end: '1699' },
            },
            {
              id: 'intangibles',
              name: 'Intangible Assets, net',
              accountRange: { start: '1700', end: '1799' },
            },
          ],
          showSubtotal: true,
          subtotalLabel: 'TOTAL ASSETS',
        },
        {
          id: 'liabilities-equity',
          name: 'LIABILITIES AND STOCKHOLDERS\' EQUITY',
          children: [
            {
              id: 'current-liabilities',
              name: 'Current Liabilities',
              children: [
                { id: 'ap', name: 'Accounts Payable', accountRange: { start: '2000', end: '2099' } },
                { id: 'deferred', name: 'Deferred Revenue', accountRange: { start: '2100', end: '2199' } },
                { id: 'accrued', name: 'Accrued Liabilities', accountRange: { start: '2200', end: '2399' } },
              ],
              showSubtotal: true,
              subtotalLabel: 'Total Current Liabilities',
            },
            {
              id: 'equity',
              name: 'Stockholders\' Equity',
              accountRange: { start: '3000', end: '3999' },
              showSubtotal: true,
              subtotalLabel: 'Total Stockholders\' Equity',
            },
          ],
          showSubtotal: true,
          subtotalLabel: 'TOTAL LIABILITIES AND STOCKHOLDERS\' EQUITY',
        },
      ],
    },
    {
      name: 'Income Statement',
      description: 'Standard SaaS income statement hierarchy',
      nodes: [
        {
          id: 'revenue',
          name: 'Revenue',
          children: [
            { id: 'subscription-rev', name: 'Subscription Revenue', accountRange: { start: '4000', end: '4099' } },
            { id: 'services-rev', name: 'Professional Services Revenue', accountRange: { start: '4100', end: '4199' } },
          ],
          showSubtotal: true,
          subtotalLabel: 'Total Revenue',
        },
        {
          id: 'cost-of-revenue',
          name: 'Cost of Revenue',
          accountRange: { start: '5000', end: '5999' },
          showSubtotal: true,
          subtotalLabel: 'Total Cost of Revenue',
        },
        {
          id: 'gross-profit',
          name: 'Gross Profit',
          showSubtotal: true,
          subtotalLabel: 'Gross Profit',
        },
        {
          id: 'operating-expenses',
          name: 'Operating Expenses',
          children: [
            { id: 'sales-marketing', name: 'Sales and Marketing', accountRange: { start: '6000', end: '6499' } },
            { id: 'rd', name: 'Research and Development', accountRange: { start: '6500', end: '6999' } },
            { id: 'ga', name: 'General and Administrative', accountRange: { start: '7000', end: '7999' } },
          ],
          showSubtotal: true,
          subtotalLabel: 'Total Operating Expenses',
        },
        {
          id: 'operating-income',
          name: 'Operating Income (Loss)',
          showSubtotal: true,
        },
        {
          id: 'other-income-expense',
          name: 'Other Income (Expense)',
          accountRange: { start: '8000', end: '8999' },
        },
        {
          id: 'pretax-income',
          name: 'Income Before Income Taxes',
          showSubtotal: true,
        },
        {
          id: 'income-tax',
          name: 'Income Tax Expense',
          accountRange: { start: '9000', end: '9099' },
        },
        {
          id: 'net-income',
          name: 'Net Income (Loss)',
          showSubtotal: true,
          subtotalLabel: 'Net Income (Loss)',
        },
      ],
    },
  ],
};

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Get the default SaaS chart of accounts template
 */
export function getSaaSChartOfAccounts(): ChartOfAccountsConfig {
  return SAAS_CHART_OF_ACCOUNTS;
}

/**
 * Create a custom chart of accounts based on the SaaS template
 */
export function createCustomChartOfAccounts(
  overrides: Partial<ChartOfAccountsConfig> & { name: string }
): ChartOfAccountsConfig {
  return {
    ...SAAS_CHART_OF_ACCOUNTS,
    ...overrides,
    accounts: overrides.accounts || SAAS_CHART_OF_ACCOUNTS.accounts,
    defaultAccounts: {
      ...SAAS_CHART_OF_ACCOUNTS.defaultAccounts,
      ...overrides.defaultAccounts,
    },
  };
}

/**
 * Find an account by number in a chart of accounts
 */
export function findAccountByNumber(
  config: ChartOfAccountsConfig,
  accountNumber: string
): AccountMetadata | undefined {
  return config.accounts.find((a) => a.accountNumber === accountNumber);
}

/**
 * Get an account by number (alias for findAccountByNumber)
 */
export function getAccountByNumber(
  config: ChartOfAccountsConfig,
  accountNumber: string
): AccountMetadata | undefined {
  return findAccountByNumber(config, accountNumber);
}

/**
 * Get all accounts in a category
 */
export function getAccountsByCategory(
  config: ChartOfAccountsConfig,
  category: keyof typeof AccountCategory
): AccountMetadata[] {
  return config.accounts.filter((a) => a.category === AccountCategory[category]);
}

/**
 * Get all accounts in a subcategory
 */
export function getAccountsBySubcategory(
  config: ChartOfAccountsConfig,
  subcategory: keyof typeof AccountSubcategory
): AccountMetadata[] {
  return config.accounts.filter((a) => a.subcategory === AccountSubcategory[subcategory]);
}

/**
 * Validate a chart of accounts configuration
 */
export function validateChartOfAccounts(config: ChartOfAccountsConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!config.name) errors.push('Chart name is required');
  if (!config.baseCurrency) errors.push('Base currency is required');
  if (!config.accounts?.length) errors.push('At least one account is required');

  // Check default accounts exist
  const accountNumbers = new Set(config.accounts.map((a) => a.accountNumber));
  for (const [key, accountNumber] of Object.entries(config.defaultAccounts)) {
    if (accountNumber && !accountNumbers.has(accountNumber)) {
      errors.push(`Default account ${key} (${accountNumber}) not found in chart`);
    }
  }

  // Check for duplicate account numbers
  const seen = new Set<string>();
  for (const account of config.accounts) {
    if (seen.has(account.accountNumber)) {
      errors.push(`Duplicate account number: ${account.accountNumber}`);
    }
    seen.add(account.accountNumber);
  }

  // Check parent accounts exist
  for (const account of config.accounts) {
    if (account.parentAccountNumber && !accountNumbers.has(account.parentAccountNumber)) {
      errors.push(`Parent account ${account.parentAccountNumber} for ${account.accountNumber} not found`);
    }
  }

  // Warnings for best practices
  const controlAccounts = config.accounts.filter((a) => a.isControlAccount);
  if (controlAccounts.length === 0) {
    warnings.push('No control accounts defined - consider using account hierarchies');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
