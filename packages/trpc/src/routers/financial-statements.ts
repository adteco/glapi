import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { FinancialStatementsService } from '@glapi/api-service';
import { createReadOnlyAIMeta } from '../ai-meta';

// Common dimension filters for all financial statements
const dimensionFiltersSchema = z.object({
  subsidiaryId: z.string().uuid().optional(),
  departmentIds: z.array(z.string().uuid()).optional(),
  classIds: z.array(z.string().uuid()).optional(),
  locationIds: z.array(z.string().uuid()).optional(),
});

// Common report options
const reportOptionsSchema = z.object({
  includeInactive: z.boolean().default(false),
  showAccountHierarchy: z.boolean().default(true),
  showZeroBalances: z.boolean().default(false),
});

export const financialStatementsRouter = router({
  /**
   * Generate a Balance Sheet for the specified period
   * Includes current assets, non-current assets, liabilities, and equity
   */
  balanceSheet: protectedProcedure
    .meta({ ai: createReadOnlyAIMeta('generate_balance_sheet', 'Generate a Balance Sheet for the specified period', {
      scopes: ['financial-statements', 'reporting', 'accounting'],
      permissions: ['read:financial-statements'],
    }) })
    .input(
      z.object({
        periodId: z.string().uuid(),
        comparePeriodId: z.string().uuid().optional(),
        ...dimensionFiltersSchema.shape,
        ...reportOptionsSchema.shape,
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new FinancialStatementsService({ organizationId: ctx.organizationId });
      return service.generateBalanceSheet({
        organizationId: ctx.organizationId,
        periodId: input.periodId,
        subsidiaryId: input.subsidiaryId,
        classId: input.classIds?.[0], // For now, take the first class
        departmentId: input.departmentIds?.[0],
        locationId: input.locationIds?.[0],
        includeInactive: input.includeInactive,
        comparePeriodId: input.comparePeriodId,
      });
    }),

  /**
   * Generate an Income Statement for the specified period
   * Shows revenue, COGS, gross profit, operating expenses, and net income
   */
  incomeStatement: protectedProcedure
    .meta({ ai: createReadOnlyAIMeta('generate_income_statement', 'Generate an Income Statement for the specified period', {
      scopes: ['financial-statements', 'reporting', 'accounting'],
      permissions: ['read:financial-statements'],
    }) })
    .input(
      z.object({
        periodId: z.string().uuid(),
        comparePeriodId: z.string().uuid().optional(),
        includeYTD: z.boolean().default(true),
        ...dimensionFiltersSchema.shape,
        ...reportOptionsSchema.shape,
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new FinancialStatementsService({ organizationId: ctx.organizationId });
      return service.generateIncomeStatement({
        organizationId: ctx.organizationId,
        periodId: input.periodId,
        subsidiaryId: input.subsidiaryId,
        classId: input.classIds?.[0],
        departmentId: input.departmentIds?.[0],
        locationId: input.locationIds?.[0],
        includeInactive: input.includeInactive,
        comparePeriodId: input.comparePeriodId,
      });
    }),

  /**
   * Generate a Cash Flow Statement for the specified period (Indirect Method)
   * Shows operating, investing, and financing activities
   */
  cashFlowStatement: protectedProcedure
    .meta({ ai: createReadOnlyAIMeta('generate_cash_flow_statement', 'Generate a Cash Flow Statement for the specified period (Indirect Method)', {
      scopes: ['financial-statements', 'reporting', 'accounting'],
      permissions: ['read:financial-statements'],
    }) })
    .input(
      z.object({
        periodId: z.string().uuid(),
        comparePeriodId: z.string().uuid().optional(),
        ...dimensionFiltersSchema.shape,
        ...reportOptionsSchema.pick({ includeInactive: true }).shape,
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new FinancialStatementsService({ organizationId: ctx.organizationId });
      return service.generateCashFlowStatement({
        organizationId: ctx.organizationId,
        periodId: input.periodId,
        subsidiaryId: input.subsidiaryId,
        classId: input.classIds?.[0],
        departmentId: input.departmentIds?.[0],
        locationId: input.locationIds?.[0],
        includeInactive: input.includeInactive,
        comparePeriodId: input.comparePeriodId,
      });
    }),

  /**
   * Generate a Trial Balance for the specified period
   * Shows all accounts with their debit/credit balances
   */
  trialBalance: protectedProcedure
    .meta({ ai: createReadOnlyAIMeta('generate_trial_balance', 'Generate a Trial Balance for the specified period', {
      scopes: ['financial-statements', 'reporting', 'accounting'],
      permissions: ['read:financial-statements'],
    }) })
    .input(
      z.object({
        periodId: z.string().uuid(),
        ...dimensionFiltersSchema.shape,
        ...reportOptionsSchema.pick({ includeInactive: true }).shape,
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new FinancialStatementsService({ organizationId: ctx.organizationId });
      return service.generateTrialBalance({
        organizationId: ctx.organizationId,
        periodId: input.periodId,
        subsidiaryId: input.subsidiaryId,
        classId: input.classIds?.[0],
        departmentId: input.departmentIds?.[0],
        locationId: input.locationIds?.[0],
        includeInactive: input.includeInactive,
      });
    }),

  /**
   * Export a financial statement to various formats
   */
  export: protectedProcedure
    .meta({ ai: createReadOnlyAIMeta('export_financial_statement', 'Export a financial statement to various formats (pdf, xlsx, csv, json)', {
      scopes: ['financial-statements', 'reporting', 'accounting'],
      permissions: ['read:financial-statements'],
    }) })
    .input(
      z.object({
        reportType: z.enum(['INCOME_STATEMENT', 'BALANCE_SHEET', 'CASH_FLOW_STATEMENT']),
        reportData: z.unknown(), // The actual report data (already generated)
        format: z.enum(['pdf', 'xlsx', 'csv', 'json']),
        includeComparison: z.boolean().default(false),
        includeNotes: z.boolean().default(false),
        includeLogo: z.boolean().default(true),
        landscape: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new FinancialStatementsService({ organizationId: ctx.organizationId });

      // Currently only supports Income Statement and Balance Sheet exports
      if (input.reportType === 'CASH_FLOW_STATEMENT') {
        // TODO: Implement cash flow statement export
        throw new Error('Cash Flow Statement export not yet implemented');
      }

      const result = await service.exportReport(
        input.reportType as 'INCOME_STATEMENT' | 'BALANCE_SHEET',
        input.reportData as any,
        {
          format: input.format,
          includeComparison: input.includeComparison,
          includeNotes: input.includeNotes,
          includeLogo: input.includeLogo,
          landscape: input.landscape,
        }
      );

      // Return base64 encoded buffer for transfer
      return {
        filename: result.filename,
        contentType: result.contentType,
        content: result.buffer.toString('base64'),
      };
    }),

  /**
   * Generate report metadata for audit trail
   */
  metadata: protectedProcedure
    .meta({ ai: createReadOnlyAIMeta('get_report_metadata', 'Generate report metadata for audit trail', {
      scopes: ['financial-statements', 'reporting', 'accounting'],
      permissions: ['read:financial-statements'],
    }) })
    .input(
      z.object({
        reportType: z.enum(['INCOME_STATEMENT', 'BALANCE_SHEET', 'CASH_FLOW', 'TRIAL_BALANCE']),
        periodId: z.string().uuid(),
        subsidiaryId: z.string().uuid().optional(),
        filters: z.record(z.unknown()).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new FinancialStatementsService({ organizationId: ctx.organizationId });
      return service.generateReportMetadata(
        input.reportType,
        input.periodId,
        input.subsidiaryId,
        input.filters
      );
    }),
});
