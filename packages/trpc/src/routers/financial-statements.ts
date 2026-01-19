import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import {
  createStatementQueryBuilder,
  invalidateStatementCache,
} from '@glapi/api-service';

// ============================================
// INPUT SCHEMAS
// ============================================

const statementFiltersSchema = z.object({
  periodId: z.string().uuid(),
  subsidiaryId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  includeInactive: z.boolean().optional().default(false),
  comparePeriodId: z.string().uuid().optional(),
});

const multiPeriodFiltersSchema = statementFiltersSchema.extend({
  additionalPeriodIds: z.array(z.string().uuid()).optional().default([]),
});

const exportFormatSchema = z.enum(['csv', 'json']);

// ============================================
// ROUTER DEFINITION
// ============================================

export const financialStatementsRouter = router({
  /**
   * Get Trial Balance for a period
   */
  trialBalance: authenticatedProcedure
    .input(statementFiltersSchema)
    .query(async ({ ctx, input }) => {
      const builder = createStatementQueryBuilder(ctx.organizationId)
        .forPeriod(input.periodId)
        .withSubsidiary(input.subsidiaryId ?? null)
        .withSegments({
          classId: input.classId ?? null,
          departmentId: input.departmentId ?? null,
          locationId: input.locationId ?? null,
        })
        .withInactiveAccounts(input.includeInactive ?? false);

      if (input.comparePeriodId) {
        builder.compareTo(input.comparePeriodId);
      }

      return builder.getTrialBalance();
    }),

  /**
   * Get Trial Balance for multiple periods (trend analysis)
   */
  trialBalanceMultiPeriod: authenticatedProcedure
    .input(multiPeriodFiltersSchema)
    .query(async ({ ctx, input }) => {
      const builder = createStatementQueryBuilder(ctx.organizationId)
        .forPeriod(input.periodId)
        .withSubsidiary(input.subsidiaryId ?? null)
        .withSegments({
          classId: input.classId ?? null,
          departmentId: input.departmentId ?? null,
          locationId: input.locationId ?? null,
        })
        .withInactiveAccounts(input.includeInactive ?? false)
        .withAdditionalPeriods(input.additionalPeriodIds ?? []);

      return builder.getMultiPeriodTrialBalance();
    }),

  /**
   * Get Income Statement for a period
   */
  incomeStatement: authenticatedProcedure
    .input(statementFiltersSchema)
    .query(async ({ ctx, input }) => {
      const builder = createStatementQueryBuilder(ctx.organizationId)
        .forPeriod(input.periodId)
        .withSubsidiary(input.subsidiaryId ?? null)
        .withSegments({
          classId: input.classId ?? null,
          departmentId: input.departmentId ?? null,
          locationId: input.locationId ?? null,
        })
        .withInactiveAccounts(input.includeInactive ?? false);

      if (input.comparePeriodId) {
        builder.compareTo(input.comparePeriodId);
      }

      return builder.getIncomeStatement();
    }),

  /**
   * Get Income Statement for multiple periods (trend analysis)
   */
  incomeStatementMultiPeriod: authenticatedProcedure
    .input(multiPeriodFiltersSchema)
    .query(async ({ ctx, input }) => {
      const builder = createStatementQueryBuilder(ctx.organizationId)
        .forPeriod(input.periodId)
        .withSubsidiary(input.subsidiaryId ?? null)
        .withSegments({
          classId: input.classId ?? null,
          departmentId: input.departmentId ?? null,
          locationId: input.locationId ?? null,
        })
        .withInactiveAccounts(input.includeInactive ?? false)
        .withAdditionalPeriods(input.additionalPeriodIds ?? []);

      return builder.getMultiPeriodIncomeStatement();
    }),

  /**
   * Get Balance Sheet for a period
   */
  balanceSheet: authenticatedProcedure
    .input(statementFiltersSchema)
    .query(async ({ ctx, input }) => {
      const builder = createStatementQueryBuilder(ctx.organizationId)
        .forPeriod(input.periodId)
        .withSubsidiary(input.subsidiaryId ?? null)
        .withSegments({
          classId: input.classId ?? null,
          departmentId: input.departmentId ?? null,
          locationId: input.locationId ?? null,
        })
        .withInactiveAccounts(input.includeInactive ?? false);

      if (input.comparePeriodId) {
        builder.compareTo(input.comparePeriodId);
      }

      return builder.getBalanceSheet();
    }),

  /**
   * Get Balance Sheet for multiple periods (trend analysis)
   */
  balanceSheetMultiPeriod: authenticatedProcedure
    .input(multiPeriodFiltersSchema)
    .query(async ({ ctx, input }) => {
      const builder = createStatementQueryBuilder(ctx.organizationId)
        .forPeriod(input.periodId)
        .withSubsidiary(input.subsidiaryId ?? null)
        .withSegments({
          classId: input.classId ?? null,
          departmentId: input.departmentId ?? null,
          locationId: input.locationId ?? null,
        })
        .withInactiveAccounts(input.includeInactive ?? false)
        .withAdditionalPeriods(input.additionalPeriodIds ?? []);

      return builder.getMultiPeriodBalanceSheet();
    }),

  /**
   * Export Trial Balance as CSV or JSON
   */
  exportTrialBalance: authenticatedProcedure
    .input(
      statementFiltersSchema.extend({
        format: exportFormatSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const builder = createStatementQueryBuilder(ctx.organizationId)
        .forPeriod(input.periodId)
        .withSubsidiary(input.subsidiaryId ?? null)
        .withSegments({
          classId: input.classId ?? null,
          departmentId: input.departmentId ?? null,
          locationId: input.locationId ?? null,
        })
        .withInactiveAccounts(input.includeInactive ?? false);

      const data = await builder.getTrialBalance();

      if (input.format === 'json') {
        return { format: 'json' as const, data };
      }

      // Generate CSV
      const csv = generateTrialBalanceCSV(data);
      return { format: 'csv' as const, data: csv };
    }),

  /**
   * Export Income Statement as CSV or JSON
   */
  exportIncomeStatement: authenticatedProcedure
    .input(
      statementFiltersSchema.extend({
        format: exportFormatSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const builder = createStatementQueryBuilder(ctx.organizationId)
        .forPeriod(input.periodId)
        .withSubsidiary(input.subsidiaryId ?? null)
        .withSegments({
          classId: input.classId ?? null,
          departmentId: input.departmentId ?? null,
          locationId: input.locationId ?? null,
        })
        .withInactiveAccounts(input.includeInactive ?? false);

      if (input.comparePeriodId) {
        builder.compareTo(input.comparePeriodId);
      }

      const data = await builder.getIncomeStatement();

      if (input.format === 'json') {
        return { format: 'json' as const, data };
      }

      // Generate CSV
      const csv = generateIncomeStatementCSV(data);
      return { format: 'csv' as const, data: csv };
    }),

  /**
   * Export Balance Sheet as CSV or JSON
   */
  exportBalanceSheet: authenticatedProcedure
    .input(
      statementFiltersSchema.extend({
        format: exportFormatSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const builder = createStatementQueryBuilder(ctx.organizationId)
        .forPeriod(input.periodId)
        .withSubsidiary(input.subsidiaryId ?? null)
        .withSegments({
          classId: input.classId ?? null,
          departmentId: input.departmentId ?? null,
          locationId: input.locationId ?? null,
        })
        .withInactiveAccounts(input.includeInactive ?? false);

      if (input.comparePeriodId) {
        builder.compareTo(input.comparePeriodId);
      }

      const data = await builder.getBalanceSheet();

      if (input.format === 'json') {
        return { format: 'json' as const, data };
      }

      // Generate CSV
      const csv = generateBalanceSheetCSV(data);
      return { format: 'csv' as const, data: csv };
    }),

  /**
   * Invalidate statement cache for the organization
   * Useful after GL postings or when fresh data is needed
   */
  invalidateCache: authenticatedProcedure.mutation(async ({ ctx }) => {
    const count = invalidateStatementCache(ctx.organizationId);
    return { invalidated: count };
  }),
});

// ============================================
// CSV GENERATION HELPERS
// ============================================

/**
 * Format currency values with proper accounting format
 */
function formatCurrency(value: number): string {
  if (value < 0) {
    return `(${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  }
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Escape CSV field values
 */
function escapeCSV(value: string | number | undefined): string {
  if (value === undefined || value === null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generate CSV for Trial Balance
 */
function generateTrialBalanceCSV(data: Awaited<ReturnType<ReturnType<typeof createStatementQueryBuilder>['getTrialBalance']>>): string {
  const lines: string[] = [];

  // Header info
  lines.push(`Trial Balance`);
  lines.push(`Period: ${escapeCSV(data.periodName)}`);
  lines.push(`Subsidiary: ${escapeCSV(data.subsidiaryName)}`);
  lines.push(`As of Date: ${escapeCSV(data.asOfDate)}`);
  lines.push('');

  // Column headers
  lines.push('Account Number,Account Name,Category,Debit Balance,Credit Balance,Net Balance');

  // Combine all accounts
  const allAccounts = [
    ...data.assetAccounts,
    ...data.liabilityAccounts,
    ...data.equityAccounts,
    ...data.revenueAccounts,
    ...data.cogsAccounts,
    ...data.expenseAccounts,
  ].sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));

  for (const account of allAccounts) {
    lines.push([
      escapeCSV(account.accountNumber),
      escapeCSV(account.accountName),
      escapeCSV(account.accountCategory),
      formatCurrency(account.debitBalance),
      formatCurrency(account.creditBalance),
      formatCurrency(account.netBalance),
    ].join(','));
  }

  // Totals
  lines.push('');
  lines.push(`TOTALS,,,${formatCurrency(data.totals.totalDebits)},${formatCurrency(data.totals.totalCredits)},${formatCurrency(data.totals.difference)}`);

  return lines.join('\n');
}

/**
 * Generate CSV for Income Statement
 */
function generateIncomeStatementCSV(data: Awaited<ReturnType<ReturnType<typeof createStatementQueryBuilder>['getIncomeStatement']>>): string {
  const lines: string[] = [];

  // Header info
  lines.push(`Income Statement`);
  lines.push(`Period: ${escapeCSV(data.periodName)}`);
  lines.push(`Subsidiary: ${escapeCSV(data.subsidiaryName)}`);
  lines.push(`As of Date: ${escapeCSV(data.asOfDate)}`);
  lines.push('');

  // Column headers
  lines.push('Description,Current Period,YTD');

  // Revenue section
  lines.push('REVENUE,,');
  for (const item of data.revenueSection.lineItems) {
    lines.push([
      `  ${escapeCSV(item.accountName)}`,
      formatCurrency(item.currentPeriodAmount),
      formatCurrency(item.ytdAmount),
    ].join(','));
  }
  lines.push(`Total Revenue,${formatCurrency(data.revenueSection.sectionTotal)},${formatCurrency(data.totalRevenue)}`);
  lines.push('');

  // COGS section
  lines.push('COST OF GOODS SOLD,,');
  for (const item of data.cogsSection.lineItems) {
    lines.push([
      `  ${escapeCSV(item.accountName)}`,
      formatCurrency(item.currentPeriodAmount),
      formatCurrency(item.ytdAmount),
    ].join(','));
  }
  lines.push(`Total COGS,${formatCurrency(data.cogsSection.sectionTotal)},${formatCurrency(data.totalCogs)}`);
  lines.push('');

  // Gross Profit
  lines.push(`GROSS PROFIT,${formatCurrency(data.grossProfit)},`);
  lines.push(`Gross Profit Margin,${data.grossProfitMargin.toFixed(1)}%,`);
  lines.push('');

  // Operating Expenses section
  lines.push('OPERATING EXPENSES,,');
  for (const item of data.operatingExpensesSection.lineItems) {
    lines.push([
      `  ${escapeCSV(item.accountName)}`,
      formatCurrency(item.currentPeriodAmount),
      formatCurrency(item.ytdAmount),
    ].join(','));
  }
  lines.push(`Total Operating Expenses,${formatCurrency(data.operatingExpensesSection.sectionTotal)},${formatCurrency(data.totalOperatingExpenses)}`);
  lines.push('');

  // Operating Income & Net Income
  lines.push(`OPERATING INCOME,${formatCurrency(data.operatingIncome)},`);
  lines.push(`Operating Margin,${data.operatingMargin.toFixed(1)}%,`);
  lines.push('');
  lines.push(`NET INCOME,${formatCurrency(data.netIncome)},`);
  lines.push(`Net Profit Margin,${data.netProfitMargin.toFixed(1)}%,`);

  return lines.join('\n');
}

/**
 * Generate CSV for Balance Sheet
 */
function generateBalanceSheetCSV(data: Awaited<ReturnType<ReturnType<typeof createStatementQueryBuilder>['getBalanceSheet']>>): string {
  const lines: string[] = [];

  // Header info
  lines.push(`Balance Sheet`);
  lines.push(`Period: ${escapeCSV(data.periodName)}`);
  lines.push(`Subsidiary: ${escapeCSV(data.subsidiaryName)}`);
  lines.push(`As of Date: ${escapeCSV(data.asOfDate)}`);
  lines.push('');

  // Column headers
  lines.push('Description,Amount');

  // Assets
  lines.push('ASSETS,');
  lines.push('Current Assets,');
  for (const item of data.currentAssetsSection.lineItems) {
    lines.push(`  ${escapeCSV(item.accountName)},${formatCurrency(item.currentPeriodAmount)}`);
  }
  lines.push(`Total Current Assets,${formatCurrency(data.totalCurrentAssets)}`);
  lines.push('');

  lines.push('Non-Current Assets,');
  for (const item of data.nonCurrentAssetsSection.lineItems) {
    lines.push(`  ${escapeCSV(item.accountName)},${formatCurrency(item.currentPeriodAmount)}`);
  }
  lines.push(`Total Non-Current Assets,${formatCurrency(data.totalNonCurrentAssets)}`);
  lines.push('');
  lines.push(`TOTAL ASSETS,${formatCurrency(data.totalAssets)}`);
  lines.push('');

  // Liabilities
  lines.push('LIABILITIES,');
  lines.push('Current Liabilities,');
  for (const item of data.currentLiabilitiesSection.lineItems) {
    lines.push(`  ${escapeCSV(item.accountName)},${formatCurrency(item.currentPeriodAmount)}`);
  }
  lines.push(`Total Current Liabilities,${formatCurrency(data.totalCurrentLiabilities)}`);
  lines.push('');

  lines.push('Long-Term Liabilities,');
  for (const item of data.longTermLiabilitiesSection.lineItems) {
    lines.push(`  ${escapeCSV(item.accountName)},${formatCurrency(item.currentPeriodAmount)}`);
  }
  lines.push(`Total Long-Term Liabilities,${formatCurrency(data.totalLongTermLiabilities)}`);
  lines.push('');
  lines.push(`TOTAL LIABILITIES,${formatCurrency(data.totalLiabilities)}`);
  lines.push('');

  // Equity
  lines.push('EQUITY,');
  for (const item of data.equitySection.lineItems) {
    lines.push(`  ${escapeCSV(item.accountName)},${formatCurrency(item.currentPeriodAmount)}`);
  }
  lines.push(`Retained Earnings,${formatCurrency(data.retainedEarnings)}`);
  lines.push(`Current Period Net Income,${formatCurrency(data.currentPeriodNetIncome)}`);
  lines.push(`TOTAL EQUITY,${formatCurrency(data.totalEquity)}`);
  lines.push('');

  // Balance check
  lines.push(`TOTAL LIABILITIES & EQUITY,${formatCurrency(data.totalLiabilitiesAndEquity)}`);
  lines.push('');
  if (data.balanceCheck !== 0) {
    lines.push(`Balance Check (should be 0),${formatCurrency(data.balanceCheck)}`);
  }

  return lines.join('\n');
}
