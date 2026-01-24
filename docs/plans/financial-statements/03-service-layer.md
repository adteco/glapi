# Phase 3: Service Layer

## Overview
Enhance the FinancialStatementsService with comprehensive business logic for all three statement types, including drill-down capabilities, export functionality, and saved configuration management.

---

## Task 3.1: Enhance FinancialStatementsService for Balance Sheet

**Description**: Extend the existing FinancialStatementsService with enhanced Balance Sheet generation including account hierarchy drill-down and improved categorization.

**Layer**: Service (`@glapi/api-service`)

**Estimated Time**: 4 hours

**File**: `/Users/fredpope/Development/glapi/packages/api-service/src/services/financial-statements-service.ts`

### Acceptance Criteria
- [ ] Enhance `generateBalanceSheet()` to use new repository method
- [ ] Add account hierarchy resolution (rollupAccountId traversal)
- [ ] Add drill-down state management (expanded account IDs)
- [ ] Calculate accurate balance check (Assets = Liabilities + Equity)
- [ ] Add working capital calculation (Current Assets - Current Liabilities)
- [ ] Add variance calculations when comparing periods

### TDD Test Cases

```typescript
// packages/api-service/src/services/__tests__/financial-statements-service.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FinancialStatementsService } from '../financial-statements-service';
import { glReportingRepository } from '@glapi/database';

vi.mock('@glapi/database');

describe('FinancialStatementsService', () => {
  let service: FinancialStatementsService;
  const mockContext = {
    organizationId: 'org-123',
    userId: 'user-123',
  };

  beforeEach(() => {
    service = new FinancialStatementsService(mockContext);
  });

  describe('generateBalanceSheet', () => {
    const mockBalanceSheetData = {
      assets: {
        current: [
          { accountId: 'acc-1', accountNumber: '1000', accountName: 'Cash', balance: 50000 },
          { accountId: 'acc-2', accountNumber: '1100', accountName: 'Accounts Receivable', balance: 25000 },
        ],
        nonCurrent: [
          { accountId: 'acc-3', accountNumber: '1500', accountName: 'Equipment', balance: 100000 },
        ],
        totalCurrent: 75000,
        totalNonCurrent: 100000,
      },
      liabilities: {
        current: [
          { accountId: 'acc-4', accountNumber: '2000', accountName: 'Accounts Payable', balance: 20000 },
        ],
        longTerm: [
          { accountId: 'acc-5', accountNumber: '2500', accountName: 'Long-term Debt', balance: 50000 },
        ],
        totalCurrent: 20000,
        totalLongTerm: 50000,
      },
      totalAssets: 175000,
      totalLiabilities: 70000,
      equity: {
        items: [
          { accountId: 'acc-6', accountNumber: '3000', accountName: 'Common Stock', balance: 50000 },
        ],
        retainedEarnings: 50000,
        currentPeriodNetIncome: 5000,
      },
      totalEquity: 105000,
    };

    beforeEach(() => {
      vi.mocked(glReportingRepository.getBalanceSheetData).mockResolvedValue(mockBalanceSheetData);
    });

    it('should generate balance sheet with all sections', async () => {
      const result = await service.generateBalanceSheet({
        organizationId: 'org-123',
        periodId: 'period-1',
      });

      expect(result.currentAssetsSection).toBeDefined();
      expect(result.nonCurrentAssetsSection).toBeDefined();
      expect(result.currentLiabilitiesSection).toBeDefined();
      expect(result.longTermLiabilitiesSection).toBeDefined();
      expect(result.equitySection).toBeDefined();
    });

    it('should calculate balance check correctly', async () => {
      const result = await service.generateBalanceSheet({
        organizationId: 'org-123',
        periodId: 'period-1',
      });

      const expectedBalanceCheck = result.totalAssets - result.totalLiabilitiesAndEquity;
      expect(result.balanceCheck).toBe(expectedBalanceCheck);
    });

    it('should calculate working capital', async () => {
      const result = await service.generateBalanceSheet({
        organizationId: 'org-123',
        periodId: 'period-1',
      });

      expect(result.workingCapital).toBe(
        result.totalCurrentAssets - result.totalCurrentLiabilities
      );
    });

    it('should include variance when comparing periods', async () => {
      const result = await service.generateBalanceSheet({
        organizationId: 'org-123',
        periodId: 'period-1',
        comparePeriodId: 'period-0',
      });

      expect(result.priorPeriod).toBeDefined();
      expect(result.currentAssetsSection.lineItems[0].variance).toBeDefined();
    });

    it('should resolve account hierarchy for drill-down', async () => {
      const result = await service.generateBalanceSheet({
        organizationId: 'org-123',
        periodId: 'period-1',
        showDrillDown: true,
        expandedAccountIds: ['acc-1'],
      });

      // Parent accounts should have childAccounts array
      const parentAccount = result.currentAssetsSection.lineItems.find(
        item => item.childAccounts && item.childAccounts.length > 0
      );
      // Test would depend on hierarchy data
    });

    it('should reject mismatched organization', async () => {
      await expect(
        service.generateBalanceSheet({
          organizationId: 'different-org',
          periodId: 'period-1',
        })
      ).rejects.toThrow('Organization mismatch');
    });

    it('should filter by dimensions', async () => {
      await service.generateBalanceSheet({
        organizationId: 'org-123',
        periodId: 'period-1',
        subsidiaryId: 'sub-1',
        departmentIds: ['dept-1'],
        classIds: ['class-1'],
      });

      expect(glReportingRepository.getBalanceSheetData).toHaveBeenCalledWith(
        expect.objectContaining({
          subsidiaryId: 'sub-1',
          departmentIds: ['dept-1'],
          classIds: ['class-1'],
        }),
        'org-123'
      );
    });
  });
});
```

### Implementation Updates

```typescript
// Enhance existing method in financial-statements-service.ts

async generateBalanceSheet(
  input: GenerateBalanceSheetInput
): Promise<BalanceSheet> {
  const organizationId = this.requireOrganizationContext();

  if (input.organizationId !== organizationId) {
    throw new ServiceError('Organization mismatch', 'ORGANIZATION_MISMATCH', 403);
  }

  // Get raw data from repository
  const data = await glReportingRepository.getBalanceSheetData(
    {
      periodId: input.periodId,
      subsidiaryId: input.subsidiaryId,
      departmentIds: input.departmentIds,
      classIds: input.classIds,
      locationIds: input.locationIds,
      includeInactive: input.includeInactive,
      comparePeriodId: input.comparePeriodId,
    },
    organizationId
  );

  // Transform to presentation format
  const currentAssetsSection = this.buildSection(
    'Current Assets',
    'Asset',
    'CURRENT',
    data.assets.current,
    input.showDrillDown,
    input.expandedAccountIds
  );

  const nonCurrentAssetsSection = this.buildSection(
    'Non-Current Assets',
    'Asset',
    'NON_CURRENT',
    data.assets.nonCurrent,
    input.showDrillDown,
    input.expandedAccountIds
  );

  // ... similar for liabilities and equity

  const totalAssets = data.totalAssets;
  const totalLiabilities = data.totalLiabilities;
  const totalEquity = data.totalEquity;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  return {
    reportName: 'Balance Sheet',
    periodName: data.periodName,
    subsidiaryName: data.subsidiaryName,
    asOfDate: data.asOfDate,
    currentAssetsSection,
    totalCurrentAssets: data.assets.totalCurrent,
    nonCurrentAssetsSection,
    totalNonCurrentAssets: data.assets.totalNonCurrent,
    totalAssets,
    currentLiabilitiesSection,
    totalCurrentLiabilities: data.liabilities.totalCurrent,
    longTermLiabilitiesSection,
    totalLongTermLiabilities: data.liabilities.totalLongTerm,
    totalLiabilities,
    equitySection,
    retainedEarnings: data.equity.retainedEarnings,
    currentPeriodNetIncome: data.equity.currentPeriodNetIncome,
    totalEquity,
    totalLiabilitiesAndEquity,
    balanceCheck: totalAssets - totalLiabilitiesAndEquity,
    workingCapital: data.assets.totalCurrent - data.liabilities.totalCurrent,
    priorPeriod: data.priorPeriod,
  };
}

private buildSection(
  name: string,
  category: AccountCategory,
  subcategory: string,
  accounts: AccountLineItem[],
  showDrillDown: boolean,
  expandedAccountIds?: string[]
): FinancialStatementSection {
  // Build hierarchical structure if drill-down enabled
  let lineItems: FinancialStatementLineItem[];

  if (showDrillDown) {
    lineItems = this.buildHierarchicalLineItems(accounts, expandedAccountIds);
  } else {
    lineItems = accounts.map(acc => ({
      accountId: acc.accountId,
      accountNumber: acc.accountNumber,
      accountName: acc.accountName,
      accountCategory: category,
      accountSubcategory: acc.accountSubcategory || subcategory,
      currentPeriodAmount: acc.balance,
      ytdAmount: acc.balance, // For balance sheet, balance is cumulative
      priorPeriodAmount: acc.priorBalance,
      variance: acc.variance,
      variancePercent: acc.priorBalance
        ? ((acc.balance - acc.priorBalance) / Math.abs(acc.priorBalance)) * 100
        : undefined,
    }));
  }

  return {
    name,
    category,
    subcategory,
    lineItems,
    sectionTotal: accounts.reduce((sum, acc) => sum + acc.balance, 0),
    priorPeriodTotal: accounts.reduce((sum, acc) => sum + (acc.priorBalance || 0), 0),
  };
}
```

---

## Task 3.2: Enhance FinancialStatementsService for Income Statement

**Description**: Enhance Income Statement generation with margin calculations, YTD support, and variance analysis.

**Layer**: Service (`@glapi/api-service`)

**Estimated Time**: 4 hours

**File**: `/Users/fredpope/Development/glapi/packages/api-service/src/services/financial-statements-service.ts`

### Acceptance Criteria
- [ ] Enhanced `generateIncomeStatement()` with all calculations
- [ ] Calculate and return gross margin, operating margin, net margin percentages
- [ ] Add YTD amounts alongside period amounts
- [ ] Add prior period comparison with variance
- [ ] Handle negative margins gracefully

### TDD Test Cases

```typescript
describe('generateIncomeStatement', () => {
  const mockIncomeData = {
    revenue: {
      items: [{ accountId: 'r1', accountName: 'Sales', periodAmount: 100000, ytdAmount: 500000 }],
      total: 100000,
    },
    cogs: {
      items: [{ accountId: 'c1', accountName: 'Cost of Goods', periodAmount: 40000, ytdAmount: 200000 }],
      total: 40000,
    },
    operatingExpenses: {
      items: [{ accountId: 'e1', accountName: 'Salaries', periodAmount: 30000, ytdAmount: 150000 }],
      total: 30000,
    },
  };

  it('should calculate gross profit correctly', async () => {
    const result = await service.generateIncomeStatement({
      organizationId: 'org-123',
      periodId: 'period-1',
    });

    expect(result.grossProfit).toBe(result.totalRevenue - result.totalCogs);
  });

  it('should calculate gross profit margin as percentage', async () => {
    const result = await service.generateIncomeStatement({
      organizationId: 'org-123',
      periodId: 'period-1',
    });

    expect(result.grossProfitMargin).toBe(
      (result.grossProfit / result.totalRevenue) * 100
    );
  });

  it('should calculate operating income correctly', async () => {
    const result = await service.generateIncomeStatement({
      organizationId: 'org-123',
      periodId: 'period-1',
    });

    expect(result.operatingIncome).toBe(
      result.grossProfit - result.totalOperatingExpenses
    );
  });

  it('should handle zero revenue gracefully', async () => {
    vi.mocked(glReportingRepository.getIncomeStatementData).mockResolvedValue({
      revenue: { items: [], total: 0 },
      cogs: { items: [], total: 0 },
      operatingExpenses: { items: [], total: 0 },
    });

    const result = await service.generateIncomeStatement({
      organizationId: 'org-123',
      periodId: 'period-1',
    });

    // Should not throw, margins should be 0
    expect(result.grossProfitMargin).toBe(0);
    expect(result.operatingMargin).toBe(0);
    expect(result.netProfitMargin).toBe(0);
  });

  it('should include YTD amounts when requested', async () => {
    const result = await service.generateIncomeStatement({
      organizationId: 'org-123',
      periodId: 'period-1',
      showYTD: true,
    });

    expect(result.revenueSection.lineItems[0].ytdAmount).toBeDefined();
  });

  it('should include variance when comparing periods', async () => {
    const result = await service.generateIncomeStatement({
      organizationId: 'org-123',
      periodId: 'period-1',
      comparePeriodId: 'period-0',
      showVariance: true,
    });

    expect(result.priorPeriod).toBeDefined();
    expect(result.revenueSection.lineItems[0].variance).toBeDefined();
  });
});
```

---

## Task 3.3: Implement Cash Flow Statement Service

**Description**: Create comprehensive Cash Flow Statement generation using the indirect method.

**Layer**: Service (`@glapi/api-service`)

**Estimated Time**: 5 hours

**File**: `/Users/fredpope/Development/glapi/packages/api-service/src/services/financial-statements-service.ts`

### Acceptance Criteria
- [ ] Add `generateCashFlowStatement()` method
- [ ] Implement indirect method (start with Net Income)
- [ ] Add non-cash adjustments (depreciation, amortization, deferred items)
- [ ] Calculate working capital changes
- [ ] Categorize by Operating, Investing, Financing
- [ ] Verify cash reconciliation (beginning + net change = ending)
- [ ] Handle accounts without cashFlowCategory (default to Operating)

### TDD Test Cases

```typescript
describe('generateCashFlowStatement', () => {
  const mockCashFlowData = {
    netIncome: 25000,
    operatingActivities: {
      items: [{ description: 'Net Income', amount: 25000 }],
      adjustments: [
        { description: 'Depreciation', amount: 5000 },
        { description: 'Amortization', amount: 2000 },
      ],
      workingCapitalChanges: [
        { description: 'Increase in A/R', amount: -8000 },
        { description: 'Increase in A/P', amount: 3000 },
      ],
      sectionTotal: 27000,
    },
    investingActivities: {
      items: [
        { description: 'Purchase of Equipment', amount: -15000 },
        { description: 'Sale of Investments', amount: 5000 },
      ],
      sectionTotal: -10000,
    },
    financingActivities: {
      items: [
        { description: 'Proceeds from Loan', amount: 20000 },
        { description: 'Dividend Payments', amount: -5000 },
      ],
      sectionTotal: 15000,
    },
    beginningCashBalance: 50000,
    endingCashBalance: 82000,
  };

  it('should generate all three activity sections', async () => {
    const result = await service.generateCashFlowStatement({
      organizationId: 'org-123',
      periodId: 'period-1',
    });

    expect(result.operatingActivities).toBeDefined();
    expect(result.investingActivities).toBeDefined();
    expect(result.financingActivities).toBeDefined();
  });

  it('should start operating section with net income', async () => {
    const result = await service.generateCashFlowStatement({
      organizationId: 'org-123',
      periodId: 'period-1',
    });

    const firstItem = result.operatingActivities.lineItems[0];
    expect(firstItem.description).toContain('Net Income');
  });

  it('should include non-cash adjustments in operating', async () => {
    const result = await service.generateCashFlowStatement({
      organizationId: 'org-123',
      periodId: 'period-1',
    });

    const depreciation = result.operatingActivities.lineItems.find(
      item => item.description.includes('Depreciation')
    );
    expect(depreciation).toBeDefined();
    expect(depreciation?.amount).toBeGreaterThan(0); // Added back
  });

  it('should calculate net cash from operations correctly', async () => {
    const result = await service.generateCashFlowStatement({
      organizationId: 'org-123',
      periodId: 'period-1',
    });

    const sumOfItems = result.operatingActivities.lineItems.reduce(
      (sum, item) => sum + item.amount,
      0
    );
    expect(result.netCashFromOperations).toBe(sumOfItems);
  });

  it('should reconcile to ending cash balance', async () => {
    const result = await service.generateCashFlowStatement({
      organizationId: 'org-123',
      periodId: 'period-1',
    });

    const calculatedEnding =
      result.beginningCashBalance +
      result.netCashFromOperations +
      result.netCashFromInvesting +
      result.netCashFromFinancing;

    expect(result.endingCashBalance).toBe(calculatedEnding);
  });

  it('should throw if reconciliation fails', async () => {
    // Mock data with inconsistent cash balances
    vi.mocked(glReportingRepository.getCashFlowStatementData).mockResolvedValue({
      ...mockCashFlowData,
      endingCashBalance: 999999, // Incorrect
    });

    await expect(
      service.generateCashFlowStatement({
        organizationId: 'org-123',
        periodId: 'period-1',
      })
    ).rejects.toThrow('Cash flow reconciliation failed');
  });

  it('should handle organizations with no cash activity', async () => {
    vi.mocked(glReportingRepository.getCashFlowStatementData).mockResolvedValue({
      netIncome: 0,
      operatingActivities: { items: [], adjustments: [], workingCapitalChanges: [], sectionTotal: 0 },
      investingActivities: { items: [], sectionTotal: 0 },
      financingActivities: { items: [], sectionTotal: 0 },
      beginningCashBalance: 0,
      endingCashBalance: 0,
    });

    const result = await service.generateCashFlowStatement({
      organizationId: 'org-123',
      periodId: 'period-1',
    });

    expect(result.netChangeInCash).toBe(0);
  });
});
```

### Implementation Skeleton

```typescript
async generateCashFlowStatement(
  input: GenerateCashFlowStatementInput
): Promise<CashFlowStatement> {
  const organizationId = this.requireOrganizationContext();

  if (input.organizationId !== organizationId) {
    throw new ServiceError('Organization mismatch', 'ORGANIZATION_MISMATCH', 403);
  }

  const data = await glReportingRepository.getCashFlowStatementData(
    {
      periodId: input.periodId,
      subsidiaryId: input.subsidiaryId,
      method: input.method || 'INDIRECT',
    },
    organizationId
  );

  // Build operating activities section
  const operatingActivities = this.buildCashFlowSection(
    'Cash Flows from Operating Activities',
    'OPERATING',
    [
      { description: 'Net Income', amount: data.netIncome },
      ...data.operatingActivities.adjustments,
      ...data.operatingActivities.workingCapitalChanges,
    ]
  );

  // Build investing activities section
  const investingActivities = this.buildCashFlowSection(
    'Cash Flows from Investing Activities',
    'INVESTING',
    data.investingActivities.items
  );

  // Build financing activities section
  const financingActivities = this.buildCashFlowSection(
    'Cash Flows from Financing Activities',
    'FINANCING',
    data.financingActivities.items
  );

  // Calculate totals
  const netCashFromOperations = operatingActivities.sectionTotal;
  const netCashFromInvesting = investingActivities.sectionTotal;
  const netCashFromFinancing = financingActivities.sectionTotal;
  const netChangeInCash = netCashFromOperations + netCashFromInvesting + netCashFromFinancing;

  // Verify reconciliation
  const calculatedEnding = data.beginningCashBalance + netChangeInCash;
  const tolerance = 0.01;

  if (Math.abs(calculatedEnding - data.endingCashBalance) > tolerance) {
    throw new ServiceError(
      `Cash flow reconciliation failed: calculated ${calculatedEnding}, actual ${data.endingCashBalance}`,
      'CASH_FLOW_RECONCILIATION_FAILED',
      500
    );
  }

  return {
    reportName: 'Statement of Cash Flows',
    periodName: await this.getPeriodName(input.periodId),
    subsidiaryName: input.subsidiaryId
      ? await this.getSubsidiaryName(input.subsidiaryId)
      : 'All Subsidiaries',
    asOfDate: await this.getPeriodEndDate(input.periodId),
    operatingActivities,
    netCashFromOperations,
    investingActivities,
    netCashFromInvesting,
    financingActivities,
    netCashFromFinancing,
    netChangeInCash,
    beginningCashBalance: data.beginningCashBalance,
    endingCashBalance: data.endingCashBalance,
  };
}

private buildCashFlowSection(
  name: string,
  category: 'OPERATING' | 'INVESTING' | 'FINANCING',
  items: Array<{ description: string; amount: number }>
): CashFlowSection {
  return {
    name,
    category,
    lineItems: items.map(item => ({
      description: item.description,
      amount: item.amount,
    })),
    sectionTotal: items.reduce((sum, item) => sum + item.amount, 0),
  };
}
```

---

## Task 3.4: Implement Report Export Service

**Description**: Add PDF and Excel export capabilities for financial statements.

**Layer**: Service (`@glapi/api-service`)

**Estimated Time**: 3 hours

**File**: `/Users/fredpope/Development/glapi/packages/api-service/src/services/report-export-service.ts`

### Acceptance Criteria
- [ ] Create `ReportExportService` class
- [ ] Implement PDF export using pdfmake or similar
- [ ] Implement Excel export using exceljs
- [ ] Support company logo inclusion
- [ ] Support landscape orientation for wide reports
- [ ] Include report metadata (date, user, filters)

### TDD Test Cases

```typescript
describe('ReportExportService', () => {
  describe('exportToPDF', () => {
    it('should generate valid PDF buffer', async () => {
      const result = await exportService.exportToPDF(mockBalanceSheet, {
        format: 'pdf',
        includeLogo: false,
        landscape: false,
      });

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.contentType).toBe('application/pdf');
      expect(result.filename).toContain('.pdf');
    });

    it('should include logo when requested', async () => {
      const result = await exportService.exportToPDF(mockBalanceSheet, {
        format: 'pdf',
        includeLogo: true,
      });

      // PDF should be generated without error
      expect(result.buffer.length).toBeGreaterThan(0);
    });
  });

  describe('exportToExcel', () => {
    it('should generate valid Excel buffer', async () => {
      const result = await exportService.exportToExcel(mockIncomeStatement, {
        format: 'xlsx',
      });

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.contentType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(result.filename).toContain('.xlsx');
    });

    it('should include comparison columns when requested', async () => {
      const result = await exportService.exportToExcel(mockIncomeStatement, {
        format: 'xlsx',
        includeComparison: true,
      });

      // Excel should include prior period columns
      expect(result.buffer.length).toBeGreaterThan(0);
    });
  });
});
```

---

## Commit Message

```
feat(service): implement comprehensive financial statement services

- Enhance Balance Sheet with drill-down and working capital
- Enhance Income Statement with margin calculations
- Add Cash Flow Statement generation (indirect method)
- Add ReportExportService for PDF/Excel export
- Add cash reconciliation validation
- Support variance calculations for period comparison
- Include comprehensive unit tests

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```
