/**
 * Financial Statement Types
 *
 * This module contains type definitions for financial statements:
 * Balance Sheet, Income Statement, and Cash Flow Statement.
 * Includes schemas for report inputs, outputs, saved configurations, and exports.
 */

import { z } from 'zod';
import { uuidSchema } from '../common';

// ============================================================================
// Enums
// ============================================================================

/**
 * Financial statement report types
 */
export const ReportTypeEnum = z.enum([
  'BALANCE_SHEET',
  'INCOME_STATEMENT',
  'CASH_FLOW_STATEMENT',
]);
export type ReportType = z.infer<typeof ReportTypeEnum>;

/**
 * Cash flow statement activity categories
 */
export const CashFlowCategoryEnum = z.enum([
  'OPERATING',
  'INVESTING',
  'FINANCING',
]);
export type CashFlowCategory = z.infer<typeof CashFlowCategoryEnum>;

/**
 * Export format types
 */
export const ExportFormatEnum = z.enum(['PDF', 'EXCEL', 'CSV', 'JSON']);
export type ExportFormat = z.infer<typeof ExportFormatEnum>;

/**
 * Cash flow trend indicators
 */
export const CashFlowTrendEnum = z.enum(['POSITIVE', 'NEGATIVE', 'NEUTRAL']);
export type CashFlowTrend = z.infer<typeof CashFlowTrendEnum>;

// ============================================================================
// Dimension Filters
// ============================================================================

/**
 * Common dimension filters for financial statements
 * Supports filtering by accounting dimensions with multi-select
 */
export const financialReportFiltersSchema = z.object({
  subsidiaryId: uuidSchema.optional(),
  departmentIds: z.array(uuidSchema).optional(),
  classIds: z.array(uuidSchema).optional(),
  locationIds: z.array(uuidSchema).optional(),
});

export type FinancialReportFilters = z.infer<typeof financialReportFiltersSchema>;

// ============================================================================
// Line Items and Sections (Interface types for recursive structures)
// ============================================================================

/**
 * Single line item in a financial statement section
 * Note: Uses interface type to support recursive children
 */
export interface LineItem {
  accountId: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  ytdAmount?: number;
  priorPeriodAmount?: number;
  variance?: number;
  variancePercent?: number;
  isParent: boolean;
  parentAccountId?: string | null;
  depth: number;
  children?: LineItem[];
}

/**
 * Section of a financial statement (e.g., Current Assets, Long-term Liabilities)
 */
export interface FinancialStatementSection {
  sectionName: string;
  sectionCode?: string;
  lineItems: LineItem[];
  sectionTotal: number;
  priorPeriodTotal?: number;
  variance?: number;
  variancePercent?: number;
}

// ============================================================================
// Balance Sheet
// ============================================================================

/**
 * Balance Sheet input parameters
 */
export const balanceSheetInputSchema = z.object({
  periodId: uuidSchema,
  comparePeriodId: uuidSchema.optional(),
  includeInactive: z.boolean().default(false),
  showAccountHierarchy: z.boolean().default(true),
  showZeroBalances: z.boolean().default(false),
  ...financialReportFiltersSchema.shape,
});

export type BalanceSheetInput = z.infer<typeof balanceSheetInputSchema>;

/**
 * Balance Sheet response structure
 */
export interface BalanceSheetResponse {
  reportName: string;
  reportType: 'BALANCE_SHEET';
  periodName: string;
  periodId: string;
  subsidiaryName: string | null;
  asOfDate: string;
  generatedAt: string;

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
  totalEquity: number;

  // Totals
  totalLiabilitiesAndEquity: number;
  workingCapital: number;

  // Validation
  balanceCheck: number; // Should be 0 or near 0

  // Prior period comparison (if requested)
  priorPeriod?: {
    periodName: string;
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
  };
}

// ============================================================================
// Income Statement
// ============================================================================

/**
 * Income Statement input parameters
 */
export const incomeStatementInputSchema = z.object({
  periodId: uuidSchema,
  comparePeriodId: uuidSchema.optional(),
  includeYTD: z.boolean().default(true),
  includeInactive: z.boolean().default(false),
  showAccountHierarchy: z.boolean().default(true),
  showZeroBalances: z.boolean().default(false),
  ...financialReportFiltersSchema.shape,
});

export type IncomeStatementInput = z.infer<typeof incomeStatementInputSchema>;

/**
 * Income Statement response structure
 */
export interface IncomeStatementResponse {
  reportName: string;
  reportType: 'INCOME_STATEMENT';
  periodName: string;
  periodId: string;
  subsidiaryName: string | null;
  periodStartDate: string;
  periodEndDate: string;
  generatedAt: string;

  // Revenue
  revenueSection: FinancialStatementSection;
  totalRevenue: number;

  // Cost of Goods Sold
  cogsSection: FinancialStatementSection;
  totalCogs: number;

  // Gross Profit
  grossProfit: number;
  grossProfitMargin: number; // percentage

  // Operating Expenses
  operatingExpensesSection: FinancialStatementSection;
  totalOperatingExpenses: number;

  // Operating Income
  operatingIncome: number;
  operatingMargin: number; // percentage

  // Other Income/Expense
  otherIncomeSection?: FinancialStatementSection;
  otherExpenseSection?: FinancialStatementSection;
  netOtherIncomeExpense?: number;

  // Net Income
  netIncome: number;
  netProfitMargin: number; // percentage

  // YTD amounts (if requested)
  ytd?: {
    totalRevenue: number;
    totalCogs: number;
    grossProfit: number;
    totalOperatingExpenses: number;
    operatingIncome: number;
    netIncome: number;
  };

  // Prior period comparison (if requested)
  priorPeriod?: {
    periodName: string;
    totalRevenue: number;
    netIncome: number;
    grossProfitMargin: number;
    netProfitMargin: number;
  };
}

// ============================================================================
// Cash Flow Statement
// ============================================================================

/**
 * Cash Flow Statement input parameters (indirect method)
 */
export const cashFlowStatementInputSchema = z.object({
  periodId: uuidSchema,
  comparePeriodId: uuidSchema.optional(),
  includeInactive: z.boolean().default(false),
  ...financialReportFiltersSchema.shape,
});

export type CashFlowStatementInput = z.infer<typeof cashFlowStatementInputSchema>;

/**
 * Cash flow line item with category
 */
export interface CashFlowLineItem {
  description: string;
  amount: number;
  category?: CashFlowCategory;
  accountId?: string;
  accountNumber?: string;
  isSubtotal: boolean;
  priorPeriodAmount?: number;
}

/**
 * Cash flow activity section
 */
export interface CashFlowSection {
  sectionName: string;
  category: CashFlowCategory;
  lineItems: CashFlowLineItem[];
  sectionTotal: number;
  priorPeriodTotal?: number;
}

/**
 * Cash Flow Statement response structure (indirect method)
 */
export interface CashFlowStatementResponse {
  reportName: string;
  reportType: 'CASH_FLOW_STATEMENT';
  periodName: string;
  periodId: string;
  subsidiaryName: string | null;
  periodStartDate: string;
  periodEndDate: string;
  generatedAt: string;

  // Beginning cash
  beginningCashBalance: number;

  // Operating Activities (Indirect Method)
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
  cashFlowTrend: CashFlowTrend;

  // Reconciliation check (should be ~0)
  reconciliationDifference: number;

  // Prior period comparison (if requested)
  priorPeriod?: {
    periodName: string;
    netCashFromOperations: number;
    netCashFromInvesting: number;
    netCashFromFinancing: number;
    netChangeInCash: number;
  };
}

// ============================================================================
// Export Options
// ============================================================================

/**
 * Report export options
 */
export const reportExportOptionsSchema = z.object({
  format: ExportFormatEnum,
  includeLogo: z.boolean().default(true),
  includeHeader: z.boolean().default(true),
  includeFooter: z.boolean().default(true),
  paperSize: z.enum(['LETTER', 'A4', 'LEGAL']).default('LETTER'),
  orientation: z.enum(['PORTRAIT', 'LANDSCAPE']).default('PORTRAIT'),
  fontSize: z.enum(['SMALL', 'MEDIUM', 'LARGE']).default('MEDIUM'),
});

export type ReportExportOptions = z.infer<typeof reportExportOptionsSchema>;

/**
 * Export request schema
 */
export const exportReportInputSchema = z.object({
  reportType: ReportTypeEnum,
  reportData: z.unknown(), // The actual report response data
  options: reportExportOptionsSchema,
});

export type ExportReportInput = z.infer<typeof exportReportInputSchema>;

/**
 * Export response
 */
export interface ExportReportResponse {
  filename: string;
  contentType: string;
  buffer?: Buffer; // Server-side only
  downloadUrl?: string; // Client-side download URL
}

// ============================================================================
// Saved Report Configurations
// ============================================================================

/**
 * Report config settings that can be saved
 */
export const reportConfigSettingsSchema = z.object({
  // Dimension filters
  subsidiaryId: uuidSchema.optional().nullable(),
  departmentIds: z.array(uuidSchema).optional(),
  classIds: z.array(uuidSchema).optional(),
  locationIds: z.array(uuidSchema).optional(),
  // Display options
  includeInactive: z.boolean().optional(),
  showAccountHierarchy: z.boolean().optional(),
  showZeroBalances: z.boolean().optional(),
  includeYTD: z.boolean().optional(),
  // Comparison settings
  compareWithPriorPeriod: z.boolean().optional(),
  // Export preferences
  defaultExportFormat: ExportFormatEnum.optional(),
});

export type ReportConfigSettings = z.infer<typeof reportConfigSettingsSchema>;

/**
 * Saved report configuration schema for persisting user preferences
 */
export const savedReportConfigSchema = z.object({
  id: uuidSchema.optional(),
  organizationId: z.string(),
  userId: uuidSchema,
  name: z.string().min(1).max(100),
  reportType: ReportTypeEnum,
  config: reportConfigSettingsSchema,
  isDefault: z.boolean().default(false),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type SavedReportConfigType = z.infer<typeof savedReportConfigSchema>;

/**
 * Schema for creating a saved configuration
 */
export const createSavedReportConfigSchema = savedReportConfigSchema.omit({
  id: true,
  organizationId: true, // Set from context
  createdAt: true,
  updatedAt: true,
});

export type CreateSavedReportConfigInput = z.infer<typeof createSavedReportConfigSchema>;

/**
 * Schema for updating a saved configuration
 */
export const updateSavedReportConfigSchema = createSavedReportConfigSchema
  .omit({ userId: true })
  .partial();

export type UpdateSavedReportConfigInput = z.infer<typeof updateSavedReportConfigSchema>;

// ============================================================================
// Filter Schemas for Querying
// ============================================================================

/**
 * Filters for listing saved configurations
 */
export const savedReportConfigFiltersSchema = z.object({
  reportType: ReportTypeEnum.optional(),
  isDefault: z.boolean().optional(),
});

export type SavedReportConfigFilters = z.infer<typeof savedReportConfigFiltersSchema>;

// ============================================================================
// Account Balance Query Types (for repository layer)
// ============================================================================

/**
 * Account balance with dimension context
 */
export interface AccountBalance {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountCategory: string;
  accountSubcategory: string | null;
  financialStatementLine: string | null;
  normalBalance: string | null;
  cashFlowCategory: string | null;
  isControlAccount: boolean;
  rollupAccountId: string | null;
  balance: number;
  priorBalance?: number;
  ytdBalance?: number;
}

/**
 * Grouped account balances by category
 */
export interface GroupedBalances {
  category: string;
  subcategory: string | null;
  accounts: AccountBalance[];
  total: number;
}
