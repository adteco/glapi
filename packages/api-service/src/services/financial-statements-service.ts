/**
 * Financial Statements Service
 *
 * Provides business logic for generating Income Statements, Balance Sheets,
 * and other financial reports with proper access control.
 */

import { BaseService } from './base-service';
import { glReportingRepository } from '@glapi/database';
import { ServiceError } from '../types';
import type {
  GenerateIncomeStatementInput,
  GenerateBalanceSheetInput,
  IncomeStatement,
  BalanceSheet,
  FinancialStatementExportOptions,
  ReportMetadata,
} from '../types/financial-statements.types';

export class FinancialStatementsService extends BaseService {
  /**
   * Generate an Income Statement for the specified period
   */
  async generateIncomeStatement(
    input: GenerateIncomeStatementInput
  ): Promise<IncomeStatement> {
    const organizationId = this.requireOrganizationContext();

    // Validate input organization matches context
    if (input.organizationId !== organizationId) {
      throw new ServiceError(
        'Organization mismatch',
        'ORGANIZATION_MISMATCH',
        403
      );
    }

    const result = await glReportingRepository.getIncomeStatement(
      {
        periodId: input.periodId,
        subsidiaryId: input.subsidiaryId,
        classId: input.classId,
        departmentId: input.departmentId,
        locationId: input.locationId,
        includeInactive: input.includeInactive,
        comparePeriodId: input.comparePeriodId,
      },
      organizationId
    );

    return result as IncomeStatement;
  }

  /**
   * Generate a Balance Sheet for the specified period
   */
  async generateBalanceSheet(
    input: GenerateBalanceSheetInput
  ): Promise<BalanceSheet> {
    const organizationId = this.requireOrganizationContext();

    // Validate input organization matches context
    if (input.organizationId !== organizationId) {
      throw new ServiceError(
        'Organization mismatch',
        'ORGANIZATION_MISMATCH',
        403
      );
    }

    const result = await glReportingRepository.getBalanceSheet(
      {
        periodId: input.periodId,
        subsidiaryId: input.subsidiaryId,
        classId: input.classId,
        departmentId: input.departmentId,
        locationId: input.locationId,
        includeInactive: input.includeInactive,
        comparePeriodId: input.comparePeriodId,
      },
      organizationId
    );

    return result as BalanceSheet;
  }

  /**
   * Generate a Trial Balance for the specified period
   */
  async generateTrialBalance(input: {
    organizationId: string;
    periodId: string;
    subsidiaryId?: string;
    classId?: string;
    departmentId?: string;
    locationId?: string;
    includeInactive?: boolean;
  }) {
    const organizationId = this.requireOrganizationContext();

    if (input.organizationId !== organizationId) {
      throw new ServiceError(
        'Organization mismatch',
        'ORGANIZATION_MISMATCH',
        403
      );
    }

    return glReportingRepository.getTrialBalance(
      {
        periodId: input.periodId,
        subsidiaryId: input.subsidiaryId,
        classId: input.classId,
        departmentId: input.departmentId,
        locationId: input.locationId,
        includeInactive: input.includeInactive,
      },
      organizationId
    );
  }

  /**
   * Generate report metadata for tracking and audit purposes
   */
  generateReportMetadata(
    reportType: 'INCOME_STATEMENT' | 'BALANCE_SHEET' | 'CASH_FLOW' | 'TRIAL_BALANCE',
    periodId: string,
    subsidiaryId?: string,
    filters?: Record<string, unknown>
  ): ReportMetadata {
    const organizationId = this.requireOrganizationContext();
    const userId = this.context.userId || 'system';

    return {
      reportId: crypto.randomUUID(),
      reportType,
      generatedAt: new Date().toISOString(),
      generatedBy: userId,
      organizationId,
      periodId,
      subsidiaryId,
      filters: filters || {},
    };
  }

  /**
   * Export a financial statement to the specified format
   * Note: Actual export implementation would involve PDF/Excel libraries
   */
  async exportReport(
    reportType: 'INCOME_STATEMENT' | 'BALANCE_SHEET',
    reportData: IncomeStatement | BalanceSheet,
    options: FinancialStatementExportOptions
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const organizationId = this.requireOrganizationContext();

    // For now, return JSON format
    // Full implementation would use libraries like pdfmake, exceljs, etc.
    if (options.format === 'json') {
      const json = JSON.stringify(reportData, null, 2);
      const buffer = Buffer.from(json, 'utf-8');
      const date = new Date().toISOString().split('T')[0];
      const filename = `${reportType.toLowerCase()}_${date}.json`;

      return {
        buffer,
        contentType: 'application/json',
        filename,
      };
    }

    // CSV export - basic implementation
    if (options.format === 'csv') {
      const csv = this.convertToCSV(reportType, reportData);
      const buffer = Buffer.from(csv, 'utf-8');
      const date = new Date().toISOString().split('T')[0];
      const filename = `${reportType.toLowerCase()}_${date}.csv`;

      return {
        buffer,
        contentType: 'text/csv',
        filename,
      };
    }

    throw new ServiceError(
      `Export format ${options.format} not yet implemented`,
      'EXPORT_FORMAT_NOT_IMPLEMENTED',
      501
    );
  }

  /**
   * Convert report data to CSV format
   */
  private convertToCSV(
    reportType: 'INCOME_STATEMENT' | 'BALANCE_SHEET',
    reportData: IncomeStatement | BalanceSheet
  ): string {
    const lines: string[] = [];

    if (reportType === 'INCOME_STATEMENT') {
      const data = reportData as IncomeStatement;
      lines.push(`"${data.reportName}"`);
      lines.push(`"Period: ${data.periodName}"`);
      lines.push(`"Subsidiary: ${data.subsidiaryName}"`);
      lines.push(`"As of: ${data.asOfDate}"`);
      lines.push('');
      lines.push('"Account Number","Account Name","Current Period","YTD"');

      // Revenue
      lines.push('"","REVENUE","",""');
      for (const item of data.revenueSection.lineItems) {
        lines.push(`"${item.accountNumber}","${item.accountName}",${item.currentPeriodAmount},${item.ytdAmount}`);
      }
      lines.push(`"","Total Revenue",${data.totalRevenue},`);
      lines.push('');

      // COGS
      lines.push('"","COST OF GOODS SOLD","",""');
      for (const item of data.cogsSection.lineItems) {
        lines.push(`"${item.accountNumber}","${item.accountName}",${item.currentPeriodAmount},${item.ytdAmount}`);
      }
      lines.push(`"","Total COGS",${data.totalCogs},`);
      lines.push('');

      // Gross Profit
      lines.push(`"","Gross Profit",${data.grossProfit},`);
      lines.push(`"","Gross Profit Margin",${data.grossProfitMargin.toFixed(2)}%,`);
      lines.push('');

      // Operating Expenses
      lines.push('"","OPERATING EXPENSES","",""');
      for (const item of data.operatingExpensesSection.lineItems) {
        lines.push(`"${item.accountNumber}","${item.accountName}",${item.currentPeriodAmount},${item.ytdAmount}`);
      }
      lines.push(`"","Total Operating Expenses",${data.totalOperatingExpenses},`);
      lines.push('');

      // Net Income
      lines.push(`"","Operating Income",${data.operatingIncome},`);
      lines.push(`"","Net Income",${data.netIncome},`);
      lines.push(`"","Net Profit Margin",${data.netProfitMargin.toFixed(2)}%,`);
    } else {
      const data = reportData as BalanceSheet;
      lines.push(`"${data.reportName}"`);
      lines.push(`"Period: ${data.periodName}"`);
      lines.push(`"Subsidiary: ${data.subsidiaryName}"`);
      lines.push(`"As of: ${data.asOfDate}"`);
      lines.push('');
      lines.push('"Account Number","Account Name","Balance","YTD"');

      // Assets
      lines.push('"","ASSETS","",""');
      lines.push('"","Current Assets","",""');
      for (const item of data.currentAssetsSection.lineItems) {
        lines.push(`"${item.accountNumber}","${item.accountName}",${item.currentPeriodAmount},${item.ytdAmount}`);
      }
      lines.push(`"","Total Current Assets",${data.totalCurrentAssets},`);

      lines.push('"","Non-Current Assets","",""');
      for (const item of data.nonCurrentAssetsSection.lineItems) {
        lines.push(`"${item.accountNumber}","${item.accountName}",${item.currentPeriodAmount},${item.ytdAmount}`);
      }
      lines.push(`"","Total Non-Current Assets",${data.totalNonCurrentAssets},`);
      lines.push(`"","TOTAL ASSETS",${data.totalAssets},`);
      lines.push('');

      // Liabilities
      lines.push('"","LIABILITIES","",""');
      lines.push('"","Current Liabilities","",""');
      for (const item of data.currentLiabilitiesSection.lineItems) {
        lines.push(`"${item.accountNumber}","${item.accountName}",${item.currentPeriodAmount},${item.ytdAmount}`);
      }
      lines.push(`"","Total Current Liabilities",${data.totalCurrentLiabilities},`);

      lines.push('"","Long-Term Liabilities","",""');
      for (const item of data.longTermLiabilitiesSection.lineItems) {
        lines.push(`"${item.accountNumber}","${item.accountName}",${item.currentPeriodAmount},${item.ytdAmount}`);
      }
      lines.push(`"","Total Long-Term Liabilities",${data.totalLongTermLiabilities},`);
      lines.push(`"","TOTAL LIABILITIES",${data.totalLiabilities},`);
      lines.push('');

      // Equity
      lines.push('"","EQUITY","",""');
      for (const item of data.equitySection.lineItems) {
        lines.push(`"${item.accountNumber}","${item.accountName}",${item.currentPeriodAmount},${item.ytdAmount}`);
      }
      lines.push(`"","Current Period Net Income",${data.currentPeriodNetIncome},`);
      lines.push(`"","TOTAL EQUITY",${data.totalEquity},`);
      lines.push('');

      lines.push(`"","TOTAL LIABILITIES & EQUITY",${data.totalLiabilitiesAndEquity},`);
      lines.push(`"","Balance Check (should be 0)",${data.balanceCheck},`);
    }

    return lines.join('\n');
  }
}
