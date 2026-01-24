# Phase 7: Documentation

## Overview
Update API documentation and create user guides for the financial statements feature.

---

## Task 7.1: Update API Documentation

**Description**: Add financial statements endpoints to the API documentation.

**Layer**: Documentation (`apps/docs`)

**Estimated Time**: 2 hours

**File**: `/Users/fredpope/Development/glapi/apps/docs/content/api/financial-statements.mdx`

### Acceptance Criteria
- [ ] Document all TRPC procedures with examples
- [ ] Include request/response schemas
- [ ] Add error code documentation
- [ ] Include dimension filtering examples

### Implementation

```mdx
---
title: Financial Statements API
description: Generate Balance Sheet, Income Statement, and Cash Flow Statement reports
---

# Financial Statements API

The Financial Statements API provides endpoints for generating standard financial reports with dimension filtering and comparison capabilities.

## Overview

| Endpoint | Description |
|----------|-------------|
| `financialStatements.balanceSheet` | Generate Balance Sheet (Statement of Financial Position) |
| `financialStatements.incomeStatement` | Generate Income Statement (P&L) |
| `financialStatements.cashFlowStatement` | Generate Statement of Cash Flows |
| `financialStatements.export` | Export report to PDF/Excel/CSV |

## Authentication

All endpoints require authentication. Include your API key or session token in the request.

## Common Parameters

### Dimension Filters

All financial statement endpoints support filtering by accounting dimensions:

| Parameter | Type | Description |
|-----------|------|-------------|
| `periodId` | `string` (UUID) | **Required**. Accounting period for the report |
| `subsidiaryId` | `string` (UUID) | Filter to specific subsidiary |
| `departmentIds` | `string[]` | Filter to specific departments |
| `classIds` | `string[]` | Filter to specific classes |
| `locationIds` | `string[]` | Filter to specific locations |
| `includeInactive` | `boolean` | Include inactive accounts (default: false) |
| `comparePeriodId` | `string` (UUID) | Prior period for comparison |

## Balance Sheet

Generate a Balance Sheet showing Assets, Liabilities, and Equity at a point in time.

### Request

```typescript
trpc.financialStatements.balanceSheet.query({
  periodId: "550e8400-e29b-41d4-a716-446655440000",
  subsidiaryId: "550e8400-e29b-41d4-a716-446655440001", // optional
  showDrillDown: true, // optional - enable account hierarchy
  groupBySubcategory: true, // optional - group by current/non-current
  comparePeriodId: "550e8400-e29b-41d4-a716-446655440002", // optional
})
```

### Response

```typescript
{
  reportName: "Balance Sheet",
  periodName: "January 2024",
  subsidiaryName: "All Subsidiaries",
  asOfDate: "2024-01-31",

  currentAssetsSection: {
    name: "Current Assets",
    lineItems: [
      {
        accountId: "...",
        accountNumber: "1000",
        accountName: "Cash and Cash Equivalents",
        currentPeriodAmount: 150000,
        priorPeriodAmount: 125000, // if comparison requested
        variance: 25000,
        variancePercent: 20,
        childAccounts: [] // if drill-down enabled
      }
    ],
    sectionTotal: 500000
  },
  totalCurrentAssets: 500000,

  nonCurrentAssetsSection: { ... },
  totalNonCurrentAssets: 300000,

  totalAssets: 800000,

  currentLiabilitiesSection: { ... },
  totalCurrentLiabilities: 200000,

  longTermLiabilitiesSection: { ... },
  totalLongTermLiabilities: 150000,

  totalLiabilities: 350000,

  equitySection: { ... },
  retainedEarnings: 350000,
  currentPeriodNetIncome: 100000,
  totalEquity: 450000,

  totalLiabilitiesAndEquity: 800000,
  balanceCheck: 0, // Assets - (Liabilities + Equity)
  workingCapital: 300000, // Current Assets - Current Liabilities

  priorPeriod: { // if comparison requested
    periodName: "December 2023",
    totalAssets: 750000,
    totalLiabilities: 330000,
    totalEquity: 420000
  }
}
```

## Income Statement

Generate an Income Statement showing Revenue, Expenses, and Profit/Loss for a period.

### Request

```typescript
trpc.financialStatements.incomeStatement.query({
  periodId: "550e8400-e29b-41d4-a716-446655440000",
  showMargins: true, // optional - include margin percentages
  showYTD: true, // optional - include YTD amounts
  showPriorPeriod: true, // optional - compare to prior period
  showVariance: true, // optional - show variance calculations
})
```

### Response

```typescript
{
  reportName: "Income Statement",
  periodName: "January 2024",
  subsidiaryName: "All Subsidiaries",
  asOfDate: "2024-01-31",

  revenueSection: {
    name: "Revenue",
    lineItems: [
      {
        accountId: "...",
        accountNumber: "4000",
        accountName: "Product Sales",
        currentPeriodAmount: 500000,
        ytdAmount: 500000,
        priorPeriodAmount: 450000,
        variance: 50000,
        variancePercent: 11.1
      }
    ],
    sectionTotal: 500000
  },
  totalRevenue: 500000,

  cogsSection: { ... },
  totalCogs: 200000,

  grossProfit: 300000,
  grossProfitMargin: 60.0, // percentage

  operatingExpensesSection: { ... },
  totalOperatingExpenses: 150000,

  operatingIncome: 150000,
  operatingMargin: 30.0, // percentage

  otherIncomeExpense: -10000,

  netIncome: 140000,
  netProfitMargin: 28.0, // percentage

  priorPeriod: { ... } // if comparison requested
}
```

## Cash Flow Statement

Generate a Statement of Cash Flows using the indirect method.

### Request

```typescript
trpc.financialStatements.cashFlowStatement.query({
  periodId: "550e8400-e29b-41d4-a716-446655440000",
  method: "INDIRECT", // or "DIRECT" (future)
  showReconciliation: true, // optional
})
```

### Response

```typescript
{
  reportName: "Statement of Cash Flows",
  periodName: "January 2024",
  subsidiaryName: "All Subsidiaries",
  asOfDate: "2024-01-31",

  operatingActivities: {
    name: "Cash Flows from Operating Activities",
    category: "OPERATING",
    lineItems: [
      { description: "Net Income", amount: 140000 },
      { description: "Depreciation and Amortization", amount: 15000 },
      { description: "Increase in Accounts Receivable", amount: -25000 },
      { description: "Increase in Accounts Payable", amount: 10000 }
    ],
    sectionTotal: 140000
  },
  netCashFromOperations: 140000,

  investingActivities: {
    name: "Cash Flows from Investing Activities",
    category: "INVESTING",
    lineItems: [
      { description: "Purchase of Equipment", amount: -50000 },
      { description: "Sale of Investments", amount: 20000 }
    ],
    sectionTotal: -30000
  },
  netCashFromInvesting: -30000,

  financingActivities: {
    name: "Cash Flows from Financing Activities",
    category: "FINANCING",
    lineItems: [
      { description: "Proceeds from Long-term Debt", amount: 100000 },
      { description: "Dividend Payments", amount: -25000 }
    ],
    sectionTotal: 75000
  },
  netCashFromFinancing: 75000,

  netChangeInCash: 185000,
  beginningCashBalance: 100000,
  endingCashBalance: 285000
}
```

## Export

Export a financial statement to PDF, Excel, or CSV format.

### Request

```typescript
trpc.financialStatements.export.mutate({
  reportType: "BALANCE_SHEET", // or "INCOME_STATEMENT", "CASH_FLOW"
  periodId: "550e8400-e29b-41d4-a716-446655440000",
  format: "pdf", // or "xlsx", "csv", "json"
  includeComparison: true, // optional
  includeLogo: true, // optional
  landscape: false, // optional - for wide reports
})
```

### Response

```typescript
{
  buffer: "base64-encoded-file-content",
  contentType: "application/pdf", // or appropriate MIME type
  filename: "balance-sheet-2024-01-31.pdf"
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `FORBIDDEN` | User does not have access to this organization |
| `NOT_FOUND` | Period or subsidiary not found |
| `BAD_REQUEST` | Invalid input parameters |
| `INTERNAL_SERVER_ERROR` | Server error generating report |

### Cash Flow Reconciliation Error

If the cash flow statement fails to reconcile:

```json
{
  "code": "INTERNAL_SERVER_ERROR",
  "message": "Cash flow reconciliation failed. Please verify GL balances."
}
```

## Examples

### Generate Quarterly Income Statement with Comparison

```typescript
const incomeStatement = await trpc.financialStatements.incomeStatement.query({
  periodId: "q4-2023",
  comparePeriodId: "q4-2022",
  showMargins: true,
  showVariance: true,
  departmentIds: ["sales", "marketing"],
});

console.log(`Revenue: $${incomeStatement.totalRevenue.toLocaleString()}`);
console.log(`Net Margin: ${incomeStatement.netProfitMargin}%`);
```

### Export Balance Sheet to Excel

```typescript
const { buffer, filename } = await trpc.financialStatements.export.mutate({
  reportType: "BALANCE_SHEET",
  periodId: "period-123",
  format: "xlsx",
  includeComparison: true,
});

// Decode and download
const blob = new Blob([Buffer.from(buffer, 'base64')], {
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
});
saveAs(blob, filename);
```

## Related Endpoints

- [Accounting Periods](/api/accounting-periods) - List and manage accounting periods
- [Accounts](/api/accounts) - Account chart management
- [GL Reporting](/api/gl-reporting) - Trial balance and general ledger
```

---

## Task 7.2: Update README and Feature Documentation

**Description**: Update project documentation with financial statements feature overview.

**Layer**: Project Root

**Estimated Time**: 2 hours

**Files**:
- `/Users/fredpope/Development/glapi/README.md` (update)
- `/Users/fredpope/Development/glapi/docs/features/financial-statements.md` (new)

### Acceptance Criteria
- [ ] Add Financial Statements section to README features list
- [ ] Create detailed feature documentation
- [ ] Include screenshots/diagrams
- [ ] Add troubleshooting guide

### Implementation

```markdown
<!-- Add to README.md features section -->

### Financial Reporting

- **Balance Sheet**: Generate Balance Sheet with drill-down by account hierarchy
- **Income Statement**: Profit & Loss with margin calculations and period comparison
- **Cash Flow Statement**: Indirect method with operating/investing/financing sections
- **Dimension Filtering**: Filter reports by subsidiary, department, class, location
- **Export**: PDF, Excel, and CSV export with customizable formatting
- **Saved Configurations**: Save and load report configurations per user
```

```markdown
<!-- docs/features/financial-statements.md -->

# Financial Statements

GLAPI provides comprehensive financial statement generation with support for all three primary financial statements required by GAAP.

## Overview

| Statement | Purpose | Key Metrics |
|-----------|---------|-------------|
| Balance Sheet | Financial position at a point in time | Working Capital, Current Ratio |
| Income Statement | Profitability over a period | Gross Margin, Net Margin |
| Cash Flow Statement | Cash movements over a period | Free Cash Flow |

## Features

### 1. Balance Sheet

The Balance Sheet (Statement of Financial Position) shows:
- **Assets**: Grouped into Current and Non-Current
- **Liabilities**: Grouped into Current and Long-Term
- **Equity**: Including retained earnings and current period net income

**Key Capabilities**:
- Account hierarchy drill-down (expand/collapse parent accounts)
- Working capital calculation (Current Assets - Current Liabilities)
- Balance check validation (Assets = Liabilities + Equity)
- Prior period comparison with variance calculations

### 2. Income Statement

The Income Statement (Profit & Loss) shows:
- Revenue by account
- Cost of Goods Sold
- Gross Profit
- Operating Expenses
- Operating Income
- Net Income

**Key Capabilities**:
- Margin calculations (Gross, Operating, Net)
- YTD amounts alongside period amounts
- Prior period comparison
- Trend indicators (up/down arrows)

### 3. Cash Flow Statement

The Statement of Cash Flows (Indirect Method) shows:
- **Operating Activities**: Starting from Net Income with adjustments
- **Investing Activities**: Capital expenditures, asset sales
- **Financing Activities**: Debt, equity, dividends

**Key Capabilities**:
- Automatic reconciliation to ending cash balance
- Non-cash adjustment identification
- Working capital change calculations

### 4. Dimension Filtering

All statements support filtering by:
- **Subsidiary**: Single select for legal entity
- **Departments**: Multi-select
- **Classes**: Multi-select
- **Locations**: Multi-select

Filters are remembered in localStorage and can be saved as configurations.

### 5. Export Options

| Format | Use Case |
|--------|----------|
| PDF | Print-ready reports with company logo |
| Excel | Data analysis and manipulation |
| CSV | System integration and imports |

### 6. Saved Configurations

Users can:
- Save current filter settings with a custom name
- Set a default configuration per report type
- Share configurations (future enhancement)

## Account Setup Requirements

For accurate financial statements, accounts must have:

| Field | Purpose |
|-------|---------|
| `accountCategory` | Asset, Liability, Equity, Revenue, COGS, Expense |
| `accountSubcategory` | CURRENT_ASSETS, NON_CURRENT_ASSETS, etc. |
| `cashFlowCategory` | OPERATING, INVESTING, FINANCING |
| `rollupAccountId` | Parent account for hierarchy |

## Troubleshooting

### Balance Sheet Not Balancing

1. Check that all GL entries are balanced (debits = credits)
2. Verify period is closed or includes all pending entries
3. Run Trial Balance to identify discrepancies

### Cash Flow Reconciliation Failed

1. Verify beginning cash balance matches prior period ending
2. Check that all cash accounts have `cashFlowCategory` = OPERATING
3. Verify non-cash accounts (depreciation) are properly categorized

### Missing Account Data

1. Ensure accounts have `accountCategory` set
2. For Balance Sheet subcategories, set `accountSubcategory`
3. For Cash Flow, set `cashFlowCategory`

## API Reference

See [Financial Statements API](/api/financial-statements) for full endpoint documentation.
```

---

## Commit Messages

```
docs(api): add financial statements API documentation

- Document balanceSheet, incomeStatement, cashFlowStatement endpoints
- Include request/response schemas with examples
- Add error code documentation
- Document export functionality

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

```
docs: add financial statements feature documentation

- Update README with financial reporting features
- Create detailed feature documentation
- Add account setup requirements
- Include troubleshooting guide

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```
