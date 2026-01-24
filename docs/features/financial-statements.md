# Financial Statements

GLAPI provides comprehensive financial statement generation capabilities including Balance Sheet, Income Statement, and Cash Flow Statement reports.

## Overview

The Financial Statements module enables organizations to generate standard financial reports with:
- Multi-dimensional filtering (subsidiary, department, class, location)
- Period-over-period comparison
- Drill-down capabilities
- Multiple export formats (PDF, Excel, CSV, JSON)
- Saved configuration management

## Available Reports

### Balance Sheet

Displays the organization's financial position at a specific point in time.

**Features:**
- Current and Non-Current Asset sections
- Current and Long-Term Liability sections
- Equity section with retained earnings
- Balance check indicator (Assets = Liabilities + Equity)
- Working capital calculation

### Income Statement (Profit & Loss)

Shows revenue, expenses, and profitability for a specified period.

**Features:**
- Revenue section
- Cost of Goods Sold (COGS) section
- Gross profit with margin percentage
- Operating expenses section
- Operating income and net income calculations
- YTD (Year-to-Date) amounts

### Cash Flow Statement

Presents cash inflows and outflows using the indirect method.

**Features:**
- Operating activities (starting from net income)
- Investing activities
- Financing activities
- Beginning and ending cash balances
- Net change in cash
- Cash flow trend indicator

## Dimension Filtering

All financial statements support filtering by:

| Dimension | Type | Description |
|-----------|------|-------------|
| Subsidiary | Single-select | Filter to a specific subsidiary |
| Department | Multi-select | Filter by one or more departments |
| Class | Multi-select | Filter by one or more classes |
| Location | Multi-select | Filter by one or more locations |

## Report Options

| Option | Default | Description |
|--------|---------|-------------|
| Include Inactive | false | Include inactive accounts in reports |
| Show Account Hierarchy | true | Display accounts in hierarchical structure |
| Show Zero Balances | false | Include accounts with zero balances |
| Include YTD | true | Show year-to-date amounts (Income Statement) |
| Compare with Prior Period | false | Show comparative period data |

## Export Formats

### PDF
- Best for printing and sharing
- Professional formatting with headers
- Landscape option for wide reports

### Excel (XLSX)
- Editable spreadsheet format
- Multiple worksheets for complex reports
- Styled headers and totals

### CSV
- Plain text, comma-separated
- Easy import to other systems
- Lightweight file size

### JSON
- For programmatic access
- Complete data structure
- API integration friendly

## Saved Configurations

Users can save their preferred report settings for quick access:

- Save current filter settings with a custom name
- Set a default configuration per report type
- Load saved configurations in one click
- Edit or delete saved configurations

## API Usage

### Generate Balance Sheet

```typescript
const balanceSheet = await trpc.financialStatements.balanceSheet.query({
  periodId: 'period-uuid',
  subsidiaryId: 'subsidiary-uuid', // optional
  departmentIds: ['dept-1', 'dept-2'], // optional
  showZeroBalances: false,
});
```

### Generate Income Statement

```typescript
const incomeStatement = await trpc.financialStatements.incomeStatement.query({
  periodId: 'period-uuid',
  includeYTD: true,
  comparePeriodId: 'prior-period-uuid', // optional
});
```

### Generate Cash Flow Statement

```typescript
const cashFlow = await trpc.financialStatements.cashFlowStatement.query({
  periodId: 'period-uuid',
  subsidiaryId: 'subsidiary-uuid', // optional
});
```

### Export Report

```typescript
const exportResult = await trpc.financialStatements.export.mutate({
  reportType: 'INCOME_STATEMENT',
  reportData: incomeStatement,
  format: 'pdf',
  landscape: true,
});

// Decode and save
const buffer = Buffer.from(exportResult.content, 'base64');
fs.writeFileSync(exportResult.filename, buffer);
```

## UI Components

### Report Pages
- `/reports/financial/balance-sheet`
- `/reports/financial/income-statement`
- `/reports/financial/cash-flow-statement`

### Shared Components
- `PeriodSelector` - Accounting period selection
- `DimensionFilters` - Multi-dimensional filter panel
- `ExportDropdown` - Export format selection
- `SavedConfigSelector` - Saved configuration management

## Best Practices

1. **Period Selection**: Always select an accounting period before generating reports.

2. **Dimension Filtering**: Use filters to focus on specific business segments.

3. **Saved Configurations**: Save frequently used filter combinations for quick access.

4. **Export Format Selection**:
   - Use PDF for printing or email attachments
   - Use Excel for further analysis or modifications
   - Use CSV for data imports
   - Use JSON for API integrations

5. **Performance**: For large organizations, filter by subsidiary to improve report generation speed.

## Troubleshooting

### Report Shows "No Data"
- Verify the selected period has posted transactions
- Check if dimension filters are too restrictive
- Ensure accounts are set up with correct categories

### Balance Sheet Doesn't Balance
- Review unposted transactions
- Check for accounts with incorrect normal balance settings
- Verify retained earnings calculation

### Export Fails
- Check network connectivity
- Verify sufficient disk space for download
- Try a different export format

### Saved Configuration Not Loading
- Refresh the page
- Check if the configuration was deleted
- Verify dimension references still exist

## Related Documentation

- [API Reference: Financial Statements](/docs/api/endpoints/financial-statements)
- [Chart of Accounts](/docs/api/endpoints/accounts)
- [Accounting Periods](/docs/api/objects/accounting-periods)
