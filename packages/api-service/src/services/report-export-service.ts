/**
 * Report Export Service
 *
 * Provides PDF, Excel, CSV, and JSON export functionality for financial statements.
 * Uses pdfmake for PDF generation and exceljs for Excel spreadsheets.
 */

import ExcelJS from 'exceljs';
import type { TDocumentDefinitions, Content, StyleDictionary } from 'pdfmake/interfaces';
import type {
  IncomeStatement,
  BalanceSheet,
  CashFlowStatement,
  FinancialStatementExportOptions,
  FinancialStatementLineItem,
} from '../types/financial-statements.types';

export type ExportableReport = IncomeStatement | BalanceSheet | CashFlowStatement;
export type ReportType = 'INCOME_STATEMENT' | 'BALANCE_SHEET' | 'CASH_FLOW_STATEMENT';

export interface ExportResult {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

export interface ReportExportOptions extends FinancialStatementExportOptions {
  companyName?: string;
  companyLogo?: string; // Base64 encoded image
}

/**
 * Format a number as currency
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a percentage
 */
function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

/**
 * Get current date string for filenames
 */
function getDateString(): string {
  return new Date().toISOString().split('T')[0];
}

export class ReportExportService {
  /**
   * Export a financial report to the specified format
   */
  async exportReport(
    reportType: ReportType,
    reportData: ExportableReport,
    options: ReportExportOptions
  ): Promise<ExportResult> {
    const dateStr = getDateString();
    const baseFilename = `${reportType.toLowerCase().replace(/_/g, '-')}_${dateStr}`;

    switch (options.format) {
      case 'json':
        return this.exportToJson(reportData, baseFilename);

      case 'csv':
        return this.exportToCsv(reportType, reportData, baseFilename);

      case 'xlsx':
        return this.exportToExcel(reportType, reportData, baseFilename, options);

      case 'pdf':
        return this.exportToPdf(reportType, reportData, baseFilename, options);

      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  /**
   * Export to JSON format
   */
  private async exportToJson(reportData: ExportableReport, baseFilename: string): Promise<ExportResult> {
    const json = JSON.stringify(reportData, null, 2);
    const buffer = Buffer.from(json, 'utf-8');

    return {
      buffer,
      contentType: 'application/json',
      filename: `${baseFilename}.json`,
    };
  }

  /**
   * Export to CSV format
   */
  private async exportToCsv(
    reportType: ReportType,
    reportData: ExportableReport,
    baseFilename: string
  ): Promise<ExportResult> {
    let csv: string;

    switch (reportType) {
      case 'INCOME_STATEMENT':
        csv = this.incomeStatementToCsv(reportData as IncomeStatement);
        break;
      case 'BALANCE_SHEET':
        csv = this.balanceSheetToCsv(reportData as BalanceSheet);
        break;
      case 'CASH_FLOW_STATEMENT':
        csv = this.cashFlowStatementToCsv(reportData as CashFlowStatement);
        break;
      default:
        throw new Error(`CSV export not supported for report type: ${reportType}`);
    }

    const buffer = Buffer.from(csv, 'utf-8');

    return {
      buffer,
      contentType: 'text/csv',
      filename: `${baseFilename}.csv`,
    };
  }

  /**
   * Export to Excel format using exceljs
   */
  private async exportToExcel(
    reportType: ReportType,
    reportData: ExportableReport,
    baseFilename: string,
    options: ReportExportOptions
  ): Promise<ExportResult> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GLAPI Financial Reporting';
    workbook.created = new Date();

    switch (reportType) {
      case 'INCOME_STATEMENT':
        this.createIncomeStatementWorksheet(workbook, reportData as IncomeStatement, options);
        break;
      case 'BALANCE_SHEET':
        this.createBalanceSheetWorksheet(workbook, reportData as BalanceSheet, options);
        break;
      case 'CASH_FLOW_STATEMENT':
        this.createCashFlowStatementWorksheet(workbook, reportData as CashFlowStatement, options);
        break;
      default:
        throw new Error(`Excel export not supported for report type: ${reportType}`);
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return {
      buffer: Buffer.from(buffer),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `${baseFilename}.xlsx`,
    };
  }

  /**
   * Export to PDF format using pdfmake
   */
  private async exportToPdf(
    reportType: ReportType,
    reportData: ExportableReport,
    baseFilename: string,
    options: ReportExportOptions
  ): Promise<ExportResult> {
    // Dynamic import for pdfmake to avoid issues with fonts
    const PdfPrinter = (await import('pdfmake')).default;

    // Define fonts
    const fonts = {
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
    };

    const printer = new PdfPrinter(fonts);

    let docDefinition: TDocumentDefinitions;

    switch (reportType) {
      case 'INCOME_STATEMENT':
        docDefinition = this.createIncomeStatementPdf(reportData as IncomeStatement, options);
        break;
      case 'BALANCE_SHEET':
        docDefinition = this.createBalanceSheetPdf(reportData as BalanceSheet, options);
        break;
      case 'CASH_FLOW_STATEMENT':
        docDefinition = this.createCashFlowStatementPdf(reportData as CashFlowStatement, options);
        break;
      default:
        throw new Error(`PDF export not supported for report type: ${reportType}`);
    }

    return new Promise((resolve, reject) => {
      try {
        const pdfDoc = printer.createPdfKitDocument(docDefinition);
        const chunks: Buffer[] = [];

        pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
        pdfDoc.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            buffer,
            contentType: 'application/pdf',
            filename: `${baseFilename}.pdf`,
          });
        });
        pdfDoc.on('error', reject);

        pdfDoc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  // ============================================================================
  // CSV Generation Methods
  // ============================================================================

  private incomeStatementToCsv(data: IncomeStatement): string {
    const lines: string[] = [];

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
    lines.push(`"","Gross Profit Margin",${formatPercent(data.grossProfitMargin)},`);
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
    lines.push(`"","Net Profit Margin",${formatPercent(data.netProfitMargin)},`);

    return lines.join('\n');
  }

  private balanceSheetToCsv(data: BalanceSheet): string {
    const lines: string[] = [];

    lines.push(`"${data.reportName}"`);
    lines.push(`"Period: ${data.periodName}"`);
    lines.push(`"Subsidiary: ${data.subsidiaryName}"`);
    lines.push(`"As of: ${data.asOfDate}"`);
    lines.push('');
    lines.push('"Account Number","Account Name","Balance"');

    // Assets
    lines.push('"","ASSETS",""');
    lines.push('"","Current Assets",""');
    for (const item of data.currentAssetsSection.lineItems) {
      lines.push(`"${item.accountNumber}","${item.accountName}",${item.currentPeriodAmount}`);
    }
    lines.push(`"","Total Current Assets",${data.totalCurrentAssets}`);
    lines.push('');

    lines.push('"","Non-Current Assets",""');
    for (const item of data.nonCurrentAssetsSection.lineItems) {
      lines.push(`"${item.accountNumber}","${item.accountName}",${item.currentPeriodAmount}`);
    }
    lines.push(`"","Total Non-Current Assets",${data.totalNonCurrentAssets}`);
    lines.push(`"","TOTAL ASSETS",${data.totalAssets}`);
    lines.push('');

    // Liabilities
    lines.push('"","LIABILITIES",""');
    lines.push('"","Current Liabilities",""');
    for (const item of data.currentLiabilitiesSection.lineItems) {
      lines.push(`"${item.accountNumber}","${item.accountName}",${item.currentPeriodAmount}`);
    }
    lines.push(`"","Total Current Liabilities",${data.totalCurrentLiabilities}`);
    lines.push('');

    lines.push('"","Non-Current Liabilities",""');
    for (const item of data.longTermLiabilitiesSection.lineItems) {
      lines.push(`"${item.accountNumber}","${item.accountName}",${item.currentPeriodAmount}`);
    }
    lines.push(`"","Total Non-Current Liabilities",${data.totalLongTermLiabilities}`);
    lines.push(`"","TOTAL LIABILITIES",${data.totalLiabilities}`);
    lines.push('');

    // Equity
    lines.push('"","EQUITY",""');
    for (const item of data.equitySection.lineItems) {
      lines.push(`"${item.accountNumber}","${item.accountName}",${item.currentPeriodAmount}`);
    }
    lines.push(`"","TOTAL EQUITY",${data.totalEquity}`);
    lines.push('');

    lines.push(`"","TOTAL LIABILITIES AND EQUITY",${data.totalLiabilitiesAndEquity}`);

    return lines.join('\n');
  }

  private cashFlowStatementToCsv(data: CashFlowStatement): string {
    const lines: string[] = [];

    lines.push(`"${data.reportName}"`);
    lines.push(`"Period: ${data.periodName}"`);
    lines.push(`"Subsidiary: ${data.subsidiaryName || 'All'}"`);
    lines.push(`"Period End: ${data.periodEndDate}"`);
    lines.push('');
    lines.push('"Description","Amount"');

    // Operating Activities
    lines.push('"CASH FLOWS FROM OPERATING ACTIVITIES",""');
    lines.push('"Adjustments:",""');
    for (const item of data.operatingActivities.lineItems) {
      lines.push(`"${item.description}",${item.amount}`);
    }
    lines.push(`"Net Cash from Operating Activities",${data.netCashFromOperations}`);
    lines.push('');

    // Investing Activities
    lines.push('"CASH FLOWS FROM INVESTING ACTIVITIES",""');
    for (const item of data.investingActivities.lineItems) {
      lines.push(`"${item.description}",${item.amount}`);
    }
    lines.push(`"Net Cash from Investing Activities",${data.netCashFromInvesting}`);
    lines.push('');

    // Financing Activities
    lines.push('"CASH FLOWS FROM FINANCING ACTIVITIES",""');
    for (const item of data.financingActivities.lineItems) {
      lines.push(`"${item.description}",${item.amount}`);
    }
    lines.push(`"Net Cash from Financing Activities",${data.netCashFromFinancing}`);
    lines.push('');

    // Summary
    lines.push(`"Net Change in Cash",${data.netChangeInCash}`);
    lines.push(`"Beginning Cash Balance",${data.beginningCashBalance}`);
    lines.push(`"Ending Cash Balance",${data.endingCashBalance}`);

    return lines.join('\n');
  }

  // ============================================================================
  // Excel Generation Methods
  // ============================================================================

  private createIncomeStatementWorksheet(
    workbook: ExcelJS.Workbook,
    data: IncomeStatement,
    options: ReportExportOptions
  ): void {
    const sheet = workbook.addWorksheet('Income Statement');

    // Set column widths
    sheet.columns = [
      { width: 15 }, // Account Number
      { width: 40 }, // Account Name
      { width: 18 }, // Current Period
      { width: 18 }, // YTD
    ];

    // Add header
    this.addExcelHeader(sheet, data.reportName, data.periodName, data.subsidiaryName, data.asOfDate, options);

    // Add column headers
    const headerRow = sheet.addRow(['Account Number', 'Account Name', 'Current Period', 'YTD']);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    sheet.addRow([]);

    // Revenue Section
    this.addExcelSection(sheet, 'REVENUE', data.revenueSection.lineItems, true);
    const revRow = sheet.addRow(['', 'Total Revenue', data.totalRevenue, '']);
    revRow.font = { bold: true };
    sheet.addRow([]);

    // COGS Section
    this.addExcelSection(sheet, 'COST OF GOODS SOLD', data.cogsSection.lineItems, true);
    const cogsRow = sheet.addRow(['', 'Total COGS', data.totalCogs, '']);
    cogsRow.font = { bold: true };
    sheet.addRow([]);

    // Gross Profit
    const gpRow = sheet.addRow(['', 'Gross Profit', data.grossProfit, '']);
    gpRow.font = { bold: true };
    sheet.addRow(['', 'Gross Profit Margin', formatPercent(data.grossProfitMargin), '']);
    sheet.addRow([]);

    // Operating Expenses Section
    this.addExcelSection(sheet, 'OPERATING EXPENSES', data.operatingExpensesSection.lineItems, true);
    const opExpRow = sheet.addRow(['', 'Total Operating Expenses', data.totalOperatingExpenses, '']);
    opExpRow.font = { bold: true };
    sheet.addRow([]);

    // Net Income
    sheet.addRow(['', 'Operating Income', data.operatingIncome, '']);
    const niRow = sheet.addRow(['', 'Net Income', data.netIncome, '']);
    niRow.font = { bold: true };
    niRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD0FFD0' } };
    sheet.addRow(['', 'Net Profit Margin', formatPercent(data.netProfitMargin), '']);

    // Format currency columns
    sheet.getColumn(3).numFmt = '"$"#,##0.00';
    sheet.getColumn(4).numFmt = '"$"#,##0.00';
  }

  private createBalanceSheetWorksheet(
    workbook: ExcelJS.Workbook,
    data: BalanceSheet,
    options: ReportExportOptions
  ): void {
    const sheet = workbook.addWorksheet('Balance Sheet');

    sheet.columns = [
      { width: 15 },
      { width: 40 },
      { width: 18 },
    ];

    this.addExcelHeader(sheet, data.reportName, data.periodName, data.subsidiaryName, data.asOfDate, options);

    const headerRow = sheet.addRow(['Account Number', 'Account Name', 'Balance']);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    sheet.addRow([]);

    // Assets
    const assetsRow = sheet.addRow(['', 'ASSETS', '']);
    assetsRow.font = { bold: true };

    sheet.addRow(['', 'Current Assets', '']);
    this.addExcelBalanceSection(sheet, data.currentAssetsSection.lineItems);
    const tcaRow = sheet.addRow(['', 'Total Current Assets', data.totalCurrentAssets]);
    tcaRow.font = { bold: true };
    sheet.addRow([]);

    sheet.addRow(['', 'Non-Current Assets', '']);
    this.addExcelBalanceSection(sheet, data.nonCurrentAssetsSection.lineItems);
    const tncaRow = sheet.addRow(['', 'Total Non-Current Assets', data.totalNonCurrentAssets]);
    tncaRow.font = { bold: true };

    const taRow = sheet.addRow(['', 'TOTAL ASSETS', data.totalAssets]);
    taRow.font = { bold: true };
    taRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD0D0FF' } };
    sheet.addRow([]);

    // Liabilities
    const liabRow = sheet.addRow(['', 'LIABILITIES', '']);
    liabRow.font = { bold: true };

    sheet.addRow(['', 'Current Liabilities', '']);
    this.addExcelBalanceSection(sheet, data.currentLiabilitiesSection.lineItems);
    const tclRow = sheet.addRow(['', 'Total Current Liabilities', data.totalCurrentLiabilities]);
    tclRow.font = { bold: true };
    sheet.addRow([]);

    sheet.addRow(['', 'Non-Current Liabilities', '']);
    this.addExcelBalanceSection(sheet, data.longTermLiabilitiesSection.lineItems);
    const tnclRow = sheet.addRow(['', 'Total Non-Current Liabilities', data.totalLongTermLiabilities]);
    tnclRow.font = { bold: true };

    const tlRow = sheet.addRow(['', 'TOTAL LIABILITIES', data.totalLiabilities]);
    tlRow.font = { bold: true };
    sheet.addRow([]);

    // Equity
    const eqRow = sheet.addRow(['', 'EQUITY', '']);
    eqRow.font = { bold: true };
    this.addExcelBalanceSection(sheet, data.equitySection.lineItems);
    const teRow = sheet.addRow(['', 'TOTAL EQUITY', data.totalEquity]);
    teRow.font = { bold: true };
    sheet.addRow([]);

    const tleRow = sheet.addRow(['', 'TOTAL LIABILITIES AND EQUITY', data.totalLiabilitiesAndEquity]);
    tleRow.font = { bold: true };
    tleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD0FFD0' } };

    sheet.getColumn(3).numFmt = '"$"#,##0.00';
  }

  private createCashFlowStatementWorksheet(
    workbook: ExcelJS.Workbook,
    data: CashFlowStatement,
    options: ReportExportOptions
  ): void {
    const sheet = workbook.addWorksheet('Cash Flow Statement');

    sheet.columns = [
      { width: 50 },
      { width: 18 },
    ];

    this.addExcelHeader(sheet, data.reportName, data.periodName, data.subsidiaryName || 'All', data.periodEndDate, options);

    const headerRow = sheet.addRow(['Description', 'Amount']);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    sheet.addRow([]);

    // Operating Activities
    const opRow = sheet.addRow(['CASH FLOWS FROM OPERATING ACTIVITIES', '']);
    opRow.font = { bold: true };
    sheet.addRow(['Adjustments:', '']);
    for (const item of data.operatingActivities.lineItems) {
      sheet.addRow([`  ${item.description}`, item.amount]);
    }
    const opTotalRow = sheet.addRow(['Net Cash from Operating Activities', data.netCashFromOperations]);
    opTotalRow.font = { bold: true };
    sheet.addRow([]);

    // Investing Activities
    const invRow = sheet.addRow(['CASH FLOWS FROM INVESTING ACTIVITIES', '']);
    invRow.font = { bold: true };
    for (const item of data.investingActivities.lineItems) {
      sheet.addRow([`  ${item.description}`, item.amount]);
    }
    const invTotalRow = sheet.addRow(['Net Cash from Investing Activities', data.netCashFromInvesting]);
    invTotalRow.font = { bold: true };
    sheet.addRow([]);

    // Financing Activities
    const finRow = sheet.addRow(['CASH FLOWS FROM FINANCING ACTIVITIES', '']);
    finRow.font = { bold: true };
    for (const item of data.financingActivities.lineItems) {
      sheet.addRow([`  ${item.description}`, item.amount]);
    }
    const finTotalRow = sheet.addRow(['Net Cash from Financing Activities', data.netCashFromFinancing]);
    finTotalRow.font = { bold: true };
    sheet.addRow([]);

    // Summary
    sheet.addRow(['Net Change in Cash', data.netChangeInCash]);
    sheet.addRow(['Beginning Cash Balance', data.beginningCashBalance]);
    const endRow = sheet.addRow(['Ending Cash Balance', data.endingCashBalance]);
    endRow.font = { bold: true };
    endRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD0FFD0' } };

    sheet.getColumn(2).numFmt = '"$"#,##0.00';
  }

  private addExcelHeader(
    sheet: ExcelJS.Worksheet,
    reportName: string,
    periodName: string,
    subsidiaryName: string | null,
    asOfDate: string,
    options: ReportExportOptions
  ): void {
    const titleRow = sheet.addRow([reportName]);
    titleRow.font = { bold: true, size: 16 };
    sheet.addRow([`Period: ${periodName}`]);
    sheet.addRow([`Subsidiary: ${subsidiaryName || 'All'}`]);
    sheet.addRow([`As of: ${asOfDate}`]);
    if (options.companyName) {
      sheet.addRow([`Company: ${options.companyName}`]);
    }
    sheet.addRow([]);
  }

  private addExcelSection(
    sheet: ExcelJS.Worksheet,
    sectionName: string,
    lineItems: Array<{ accountNumber: string; accountName: string; currentPeriodAmount: number; ytdAmount: number }>,
    _includeYtd: boolean
  ): void {
    const sectionRow = sheet.addRow(['', sectionName, '', '']);
    sectionRow.font = { bold: true };

    for (const item of lineItems) {
      sheet.addRow([item.accountNumber, item.accountName, item.currentPeriodAmount, item.ytdAmount]);
    }
  }

  private addExcelBalanceSection(
    sheet: ExcelJS.Worksheet,
    lineItems: FinancialStatementLineItem[]
  ): void {
    for (const item of lineItems) {
      sheet.addRow([item.accountNumber, item.accountName, item.currentPeriodAmount]);
    }
  }

  // ============================================================================
  // PDF Generation Methods
  // ============================================================================

  private getPdfStyles(): StyleDictionary {
    return {
      header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] as [number, number, number, number] },
      subheader: { fontSize: 12, margin: [0, 0, 0, 5] as [number, number, number, number] },
      sectionHeader: { fontSize: 12, bold: true, margin: [0, 10, 0, 5] as [number, number, number, number] },
      tableHeader: { bold: true, fillColor: '#EEEEEE' },
      totalRow: { bold: true, fillColor: '#E0FFE0' },
      currency: { alignment: 'right' as const },
    };
  }

  private createIncomeStatementPdf(
    data: IncomeStatement,
    options: ReportExportOptions
  ): TDocumentDefinitions {
    const content: Content[] = [
      { text: data.reportName, style: 'header' },
      { text: `Period: ${data.periodName}`, style: 'subheader' },
      { text: `Subsidiary: ${data.subsidiaryName}`, style: 'subheader' },
      { text: `As of: ${data.asOfDate}`, style: 'subheader' },
    ];

    if (options.companyName) {
      content.push({ text: `Company: ${options.companyName}`, style: 'subheader' });
    }

    // Build table with simple string/object array for better type compatibility
    const tableBody: (string | { text: string; bold?: boolean; alignment?: string; fillColor?: string })[][] = [
      [
        { text: 'Account #', bold: true },
        { text: 'Account Name', bold: true },
        { text: 'Current Period', bold: true },
        { text: 'YTD', bold: true },
      ],
    ];

    // Revenue Section
    tableBody.push([{ text: 'REVENUE', bold: true }, '', '', '']);
    for (const item of data.revenueSection.lineItems) {
      tableBody.push([
        item.accountNumber,
        item.accountName,
        { text: formatCurrency(item.currentPeriodAmount), alignment: 'right' },
        { text: formatCurrency(item.ytdAmount), alignment: 'right' },
      ]);
    }
    tableBody.push([
      '',
      { text: 'Total Revenue', bold: true },
      { text: formatCurrency(data.totalRevenue), alignment: 'right', bold: true },
      '',
    ]);

    // COGS Section
    tableBody.push(['', '', '', '']);
    tableBody.push([{ text: 'COST OF GOODS SOLD', bold: true }, '', '', '']);
    for (const item of data.cogsSection.lineItems) {
      tableBody.push([
        item.accountNumber,
        item.accountName,
        { text: formatCurrency(item.currentPeriodAmount), alignment: 'right' },
        { text: formatCurrency(item.ytdAmount), alignment: 'right' },
      ]);
    }
    tableBody.push([
      '',
      { text: 'Total COGS', bold: true },
      { text: formatCurrency(data.totalCogs), alignment: 'right', bold: true },
      '',
    ]);

    // Gross Profit
    tableBody.push(['', '', '', '']);
    tableBody.push([
      '',
      { text: 'Gross Profit', bold: true },
      { text: formatCurrency(data.grossProfit), alignment: 'right', bold: true },
      '',
    ]);
    tableBody.push([
      '',
      'Gross Profit Margin',
      { text: formatPercent(data.grossProfitMargin), alignment: 'right' },
      '',
    ]);

    // Operating Expenses
    tableBody.push(['', '', '', '']);
    tableBody.push([{ text: 'OPERATING EXPENSES', bold: true }, '', '', '']);
    for (const item of data.operatingExpensesSection.lineItems) {
      tableBody.push([
        item.accountNumber,
        item.accountName,
        { text: formatCurrency(item.currentPeriodAmount), alignment: 'right' },
        { text: formatCurrency(item.ytdAmount), alignment: 'right' },
      ]);
    }
    tableBody.push([
      '',
      { text: 'Total Operating Expenses', bold: true },
      { text: formatCurrency(data.totalOperatingExpenses), alignment: 'right', bold: true },
      '',
    ]);

    // Net Income
    tableBody.push(['', '', '', '']);
    tableBody.push([
      '',
      'Operating Income',
      { text: formatCurrency(data.operatingIncome), alignment: 'right' },
      '',
    ]);
    tableBody.push([
      '',
      { text: 'Net Income', bold: true, fillColor: '#D0FFD0' },
      { text: formatCurrency(data.netIncome), alignment: 'right', bold: true, fillColor: '#D0FFD0' },
      { text: '', fillColor: '#D0FFD0' },
    ]);
    tableBody.push([
      '',
      'Net Profit Margin',
      { text: formatPercent(data.netProfitMargin), alignment: 'right' },
      '',
    ]);

    content.push({
      table: {
        headerRows: 1,
        widths: [60, '*', 80, 80],
        body: tableBody as Content[][],
      },
      layout: 'lightHorizontalLines',
      margin: [0, 20, 0, 0] as [number, number, number, number],
    });

    return {
      content,
      styles: this.getPdfStyles(),
      defaultStyle: { font: 'Helvetica', fontSize: 10 },
      pageOrientation: options.landscape ? 'landscape' : 'portrait',
    };
  }

  private createBalanceSheetPdf(
    data: BalanceSheet,
    options: ReportExportOptions
  ): TDocumentDefinitions {
    const content: Content[] = [
      { text: data.reportName, style: 'header' },
      { text: `Period: ${data.periodName}`, style: 'subheader' },
      { text: `Subsidiary: ${data.subsidiaryName}`, style: 'subheader' },
      { text: `As of: ${data.asOfDate}`, style: 'subheader' },
    ];

    if (options.companyName) {
      content.push({ text: `Company: ${options.companyName}`, style: 'subheader' });
    }

    // Build table with simple string/object array for better type compatibility
    const tableBody: (string | { text: string; bold?: boolean; alignment?: string; fillColor?: string })[][] = [
      [
        { text: 'Account #', bold: true },
        { text: 'Account Name', bold: true },
        { text: 'Balance', bold: true },
      ],
    ];

    // Assets
    tableBody.push([{ text: 'ASSETS', bold: true }, '', '']);
    tableBody.push([{ text: 'Current Assets', bold: true }, '', '']);
    for (const item of data.currentAssetsSection.lineItems) {
      tableBody.push([item.accountNumber, item.accountName, { text: formatCurrency(item.currentPeriodAmount), alignment: 'right' }]);
    }
    tableBody.push(['', { text: 'Total Current Assets', bold: true }, { text: formatCurrency(data.totalCurrentAssets), alignment: 'right', bold: true }]);

    tableBody.push(['', '', '']);
    tableBody.push([{ text: 'Non-Current Assets', bold: true }, '', '']);
    for (const item of data.nonCurrentAssetsSection.lineItems) {
      tableBody.push([item.accountNumber, item.accountName, { text: formatCurrency(item.currentPeriodAmount), alignment: 'right' }]);
    }
    tableBody.push(['', { text: 'Total Non-Current Assets', bold: true }, { text: formatCurrency(data.totalNonCurrentAssets), alignment: 'right', bold: true }]);

    tableBody.push([
      { text: '', fillColor: '#D0D0FF' },
      { text: 'TOTAL ASSETS', bold: true, fillColor: '#D0D0FF' },
      { text: formatCurrency(data.totalAssets), alignment: 'right', bold: true, fillColor: '#D0D0FF' },
    ]);

    // Liabilities
    tableBody.push(['', '', '']);
    tableBody.push([{ text: 'LIABILITIES', bold: true }, '', '']);
    tableBody.push([{ text: 'Current Liabilities', bold: true }, '', '']);
    for (const item of data.currentLiabilitiesSection.lineItems) {
      tableBody.push([item.accountNumber, item.accountName, { text: formatCurrency(item.currentPeriodAmount), alignment: 'right' }]);
    }
    tableBody.push(['', { text: 'Total Current Liabilities', bold: true }, { text: formatCurrency(data.totalCurrentLiabilities), alignment: 'right', bold: true }]);

    tableBody.push(['', '', '']);
    tableBody.push([{ text: 'Long-Term Liabilities', bold: true }, '', '']);
    for (const item of data.longTermLiabilitiesSection.lineItems) {
      tableBody.push([item.accountNumber, item.accountName, { text: formatCurrency(item.currentPeriodAmount), alignment: 'right' }]);
    }
    tableBody.push(['', { text: 'Total Long-Term Liabilities', bold: true }, { text: formatCurrency(data.totalLongTermLiabilities), alignment: 'right', bold: true }]);
    tableBody.push(['', { text: 'TOTAL LIABILITIES', bold: true }, { text: formatCurrency(data.totalLiabilities), alignment: 'right', bold: true }]);

    // Equity
    tableBody.push(['', '', '']);
    tableBody.push([{ text: 'EQUITY', bold: true }, '', '']);
    for (const item of data.equitySection.lineItems) {
      tableBody.push([item.accountNumber, item.accountName, { text: formatCurrency(item.currentPeriodAmount), alignment: 'right' }]);
    }
    tableBody.push(['', { text: 'TOTAL EQUITY', bold: true }, { text: formatCurrency(data.totalEquity), alignment: 'right', bold: true }]);

    tableBody.push(['', '', '']);
    tableBody.push([
      { text: '', fillColor: '#D0FFD0' },
      { text: 'TOTAL LIABILITIES AND EQUITY', bold: true, fillColor: '#D0FFD0' },
      { text: formatCurrency(data.totalLiabilitiesAndEquity), alignment: 'right', bold: true, fillColor: '#D0FFD0' },
    ]);

    content.push({
      table: {
        headerRows: 1,
        widths: [60, '*', 100],
        body: tableBody as Content[][],
      },
      layout: 'lightHorizontalLines',
      margin: [0, 20, 0, 0] as [number, number, number, number],
    });

    return {
      content,
      styles: this.getPdfStyles(),
      defaultStyle: { font: 'Helvetica', fontSize: 10 },
      pageOrientation: options.landscape ? 'landscape' : 'portrait',
    };
  }

  private createCashFlowStatementPdf(
    data: CashFlowStatement,
    options: ReportExportOptions
  ): TDocumentDefinitions {
    const content: Content[] = [
      { text: data.reportName, style: 'header' },
      { text: `Period: ${data.periodName}`, style: 'subheader' },
      { text: `Subsidiary: ${data.subsidiaryName || 'All'}`, style: 'subheader' },
      { text: `Period End: ${data.periodEndDate}`, style: 'subheader' },
    ];

    if (options.companyName) {
      content.push({ text: `Company: ${options.companyName}`, style: 'subheader' });
    }

    // Build table as simple array without colSpan for better type compatibility
    const tableBody: (string | { text: string; bold?: boolean; alignment?: string; fillColor?: string })[][] = [
      [
        { text: 'Description', bold: true },
        { text: 'Amount', bold: true },
      ],
    ];

    // Operating Activities
    tableBody.push([{ text: 'CASH FLOWS FROM OPERATING ACTIVITIES', bold: true }, '']);
    tableBody.push(['Adjustments:', '']);
    for (const item of data.operatingActivities.lineItems) {
      tableBody.push([`  ${item.description}`, { text: formatCurrency(item.amount), alignment: 'right' }]);
    }
    tableBody.push([{ text: 'Net Cash from Operating Activities', bold: true }, { text: formatCurrency(data.netCashFromOperations), alignment: 'right', bold: true }]);

    // Investing Activities
    tableBody.push(['', '']);
    tableBody.push([{ text: 'CASH FLOWS FROM INVESTING ACTIVITIES', bold: true }, '']);
    for (const item of data.investingActivities.lineItems) {
      tableBody.push([`  ${item.description}`, { text: formatCurrency(item.amount), alignment: 'right' }]);
    }
    tableBody.push([{ text: 'Net Cash from Investing Activities', bold: true }, { text: formatCurrency(data.netCashFromInvesting), alignment: 'right', bold: true }]);

    // Financing Activities
    tableBody.push(['', '']);
    tableBody.push([{ text: 'CASH FLOWS FROM FINANCING ACTIVITIES', bold: true }, '']);
    for (const item of data.financingActivities.lineItems) {
      tableBody.push([`  ${item.description}`, { text: formatCurrency(item.amount), alignment: 'right' }]);
    }
    tableBody.push([{ text: 'Net Cash from Financing Activities', bold: true }, { text: formatCurrency(data.netCashFromFinancing), alignment: 'right', bold: true }]);

    // Summary
    tableBody.push(['', '']);
    tableBody.push(['Net Change in Cash', { text: formatCurrency(data.netChangeInCash), alignment: 'right' }]);
    tableBody.push(['Beginning Cash Balance', { text: formatCurrency(data.beginningCashBalance), alignment: 'right' }]);
    tableBody.push([
      { text: 'Ending Cash Balance', bold: true, fillColor: '#D0FFD0' },
      { text: formatCurrency(data.endingCashBalance), alignment: 'right', bold: true, fillColor: '#D0FFD0' },
    ]);

    content.push({
      table: {
        headerRows: 1,
        widths: ['*', 120],
        body: tableBody as Content[][],
      },
      layout: 'lightHorizontalLines',
      margin: [0, 20, 0, 0] as [number, number, number, number],
    });

    return {
      content,
      styles: this.getPdfStyles(),
      defaultStyle: { font: 'Helvetica', fontSize: 10 },
      pageOrientation: options.landscape ? 'landscape' : 'portrait',
    };
  }
}
