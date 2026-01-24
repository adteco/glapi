/**
 * Financial Statements Types
 *
 * Types for Income Statement, Balance Sheet, and other financial reports.
 * These extend the GL reporting capabilities with proper accounting presentation.
 */

import type { AccountCategory } from './account.types';

/**
 * Common filters for financial statements
 */
export interface FinancialStatementFilters {
  periodId: string;
  subsidiaryId?: string;
  classId?: string;
  departmentId?: string;
  locationId?: string;
  includeInactive?: boolean;
  comparePeriodId?: string; // For comparative statements
}

/**
 * Line item in a financial statement
 */
export interface FinancialStatementLineItem {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountCategory: AccountCategory;
  accountSubcategory?: string;
  currentPeriodAmount: number;
  ytdAmount: number;
  priorPeriodAmount?: number;
  variance?: number;
  variancePercent?: number;
}

/**
 * Section in a financial statement (e.g., Current Assets, Revenue)
 */
export interface FinancialStatementSection {
  name: string;
  category: AccountCategory;
  subcategory?: string;
  lineItems: FinancialStatementLineItem[];
  sectionTotal: number;
  priorPeriodTotal?: number;
}

// ============================================
// INCOME STATEMENT TYPES
// ============================================

/**
 * Income Statement structure
 */
export interface IncomeStatement {
  reportName: string;
  periodName: string;
  subsidiaryName: string;
  asOfDate: string;

  // Revenue section
  revenueSection: FinancialStatementSection;
  totalRevenue: number;

  // Cost of Goods Sold section
  cogsSection: FinancialStatementSection;
  totalCogs: number;

  // Gross Profit
  grossProfit: number;
  grossProfitMargin: number; // Percentage

  // Operating Expenses section
  operatingExpensesSection: FinancialStatementSection;
  totalOperatingExpenses: number;

  // Operating Income
  operatingIncome: number;
  operatingMargin: number; // Percentage

  // Other Income/Expenses (if applicable)
  otherIncomeExpense?: number;

  // Net Income
  netIncome: number;
  netProfitMargin: number; // Percentage

  // Comparative period data (optional)
  priorPeriod?: {
    periodName: string;
    totalRevenue: number;
    totalCogs: number;
    grossProfit: number;
    totalOperatingExpenses: number;
    operatingIncome: number;
    netIncome: number;
  };
}

/**
 * Input for generating an Income Statement
 */
export interface GenerateIncomeStatementInput {
  organizationId: string;
  periodId: string;
  subsidiaryId?: string;
  classId?: string;
  departmentId?: string;
  locationId?: string;
  includeInactive?: boolean;
  includeComparison?: boolean;
  comparePeriodId?: string;
}

// ============================================
// BALANCE SHEET TYPES
// ============================================

/**
 * Balance Sheet structure
 */
export interface BalanceSheet {
  reportName: string;
  periodName: string;
  subsidiaryName: string;
  asOfDate: string;

  // Assets
  currentAssetsSection: FinancialStatementSection;
  totalCurrentAssets: number;

  nonCurrentAssetsSection: FinancialStatementSection;
  totalNonCurrentAssets: number;

  totalAssets: number;

  // Liabilities
  currentLiabilitiesSection: FinancialStatementSection;
  totalCurrentLiabilities: number;

  longTermLiabilitiesSection: FinancialStatementSection;
  totalLongTermLiabilities: number;

  totalLiabilities: number;

  // Equity
  equitySection: FinancialStatementSection;
  retainedEarnings: number;
  currentPeriodNetIncome: number;
  totalEquity: number;

  // Balance check (should equal 0)
  totalLiabilitiesAndEquity: number;
  balanceCheck: number; // Assets - (Liabilities + Equity)

  // Comparative period data (optional)
  priorPeriod?: {
    periodName: string;
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
  };
}

/**
 * Input for generating a Balance Sheet
 */
export interface GenerateBalanceSheetInput {
  organizationId: string;
  periodId: string;
  subsidiaryId?: string;
  classId?: string;
  departmentId?: string;
  locationId?: string;
  includeInactive?: boolean;
  includeComparison?: boolean;
  comparePeriodId?: string;
}

// ============================================
// STATEMENT OF CASH FLOWS TYPES
// ============================================

/**
 * Cash Flow Statement line item
 */
export interface CashFlowLineItem {
  description: string;
  amount: number;
  accountId?: string;
  accountNumber?: string;
  isSubtotal: boolean;
  priorPeriodAmount?: number;
}

/**
 * Cash Flow Statement section
 */
export interface CashFlowSection {
  sectionName: string;
  category: 'OPERATING' | 'INVESTING' | 'FINANCING';
  lineItems: CashFlowLineItem[];
  sectionTotal: number;
  priorPeriodTotal?: number;
}

/**
 * Statement of Cash Flows (Indirect Method)
 */
export interface CashFlowStatement {
  reportName: string;
  reportType: 'CASH_FLOW_STATEMENT';
  periodName: string;
  periodId: string;
  subsidiaryName: string | null;
  periodStartDate: string;
  periodEndDate: string;
  generatedAt: string;

  // Beginning Cash
  beginningCashBalance: number;

  // Operating Activities
  operatingActivities: CashFlowSection;
  netCashFromOperations: number;

  // Investing Activities
  investingActivities: CashFlowSection;
  netCashFromInvesting: number;

  // Financing Activities
  financingActivities: CashFlowSection;
  netCashFromFinancing: number;

  // Net Change and Ending Cash
  netChangeInCash: number;
  endingCashBalance: number;

  // Trend indicator
  cashFlowTrend: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';

  // Reconciliation check (should be ~0)
  reconciliationDifference: number;

  // Comparative period data (optional)
  priorPeriod?: {
    periodName: string;
    netCashFromOperations: number;
    netCashFromInvesting: number;
    netCashFromFinancing: number;
    netChangeInCash: number;
  };
}

/**
 * Input for generating a Cash Flow Statement
 */
export interface GenerateCashFlowStatementInput {
  organizationId: string;
  periodId: string;
  subsidiaryId?: string;
  classId?: string;
  departmentId?: string;
  locationId?: string;
  includeInactive?: boolean;
  includeComparison?: boolean;
  comparePeriodId?: string;
}

// ============================================
// TRIAL BALANCE TYPES (Extended)
// ============================================

/**
 * Extended Trial Balance entry with financial statement mapping
 */
export interface ExtendedTrialBalanceEntry {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountCategory: AccountCategory;
  accountSubcategory?: string;
  financialStatementLine?: string;
  normalBalance: 'DEBIT' | 'CREDIT';
  debitBalance: number;
  creditBalance: number;
  netBalance: number;
  periodActivity: {
    debits: number;
    credits: number;
    net: number;
  };
  ytdActivity: {
    debits: number;
    credits: number;
    net: number;
  };
}

/**
 * Trial Balance with categorization
 */
export interface CategorizedTrialBalance {
  periodName: string;
  subsidiaryName: string;
  asOfDate: string;

  // Categorized entries
  assetAccounts: ExtendedTrialBalanceEntry[];
  liabilityAccounts: ExtendedTrialBalanceEntry[];
  equityAccounts: ExtendedTrialBalanceEntry[];
  revenueAccounts: ExtendedTrialBalanceEntry[];
  cogsAccounts: ExtendedTrialBalanceEntry[];
  expenseAccounts: ExtendedTrialBalanceEntry[];

  // Summary by category
  categoryTotals: {
    assets: { debit: number; credit: number; net: number };
    liabilities: { debit: number; credit: number; net: number };
    equity: { debit: number; credit: number; net: number };
    revenue: { debit: number; credit: number; net: number };
    cogs: { debit: number; credit: number; net: number };
    expenses: { debit: number; credit: number; net: number };
  };

  // Overall totals
  totals: {
    totalDebits: number;
    totalCredits: number;
    difference: number;
  };
}

// ============================================
// REPORT EXPORT TYPES
// ============================================

/**
 * Export format options
 */
export type ExportFormat = 'pdf' | 'xlsx' | 'csv' | 'json';

/**
 * Export options for financial statements
 */
export interface FinancialStatementExportOptions {
  format: ExportFormat;
  includeComparison?: boolean;
  includeNotes?: boolean;
  includeLogo?: boolean;
  landscape?: boolean;
}

/**
 * Report metadata
 */
export interface ReportMetadata {
  reportId: string;
  reportType: 'INCOME_STATEMENT' | 'BALANCE_SHEET' | 'CASH_FLOW' | 'TRIAL_BALANCE';
  generatedAt: string;
  generatedBy: string;
  organizationId: string;
  periodId: string;
  subsidiaryId?: string;
  filters: Record<string, unknown>;
}
