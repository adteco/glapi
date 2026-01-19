# Financial Statement Reporting

This document describes the financial statement reporting system in GLAPI, including the query builder API and caching strategy.

## Overview

The financial statement reporting system provides:
- **Trial Balance** - Account balances by period with categorization
- **Income Statement** - Revenue, COGS, and expenses with margins
- **Balance Sheet** - Assets, liabilities, and equity position
- **Multi-Period Comparison** - Trend analysis across periods
- **Multi-Entity Support** - Subsidiary filtering and consolidation
- **Segment Filtering** - Class, department, and location filters
- **Result Caching** - In-memory cache with configurable TTL

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      API / TRPC Layer                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              FinancialStatementQueryBuilder                  │
│  ┌────────────────────┐  ┌────────────────────────────────┐ │
│  │ Fluent API         │  │ Caching Layer                  │ │
│  │ - forPeriod()      │  │ - 5 minute TTL                 │ │
│  │ - withSubsidiary() │  │ - Organization-based keys     │ │
│  │ - withSegments()   │  │ - Auto-invalidation on post   │ │
│  │ - compareTo()      │  │ - Manual invalidation API     │ │
│  └────────────────────┘  └────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              GlReportingRepository                           │
│  - getTrialBalance()    - getIncomeStatement()              │
│  - getBalanceSheet()    - getGeneralLedger()                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL (Drizzle ORM)                  │
│  - gl_account_balances   - accounts                          │
│  - gl_transactions       - accounting_periods                │
└─────────────────────────────────────────────────────────────┘
```

## Query Builder API

### Basic Usage

```typescript
import { createStatementQueryBuilder } from '@glapi/api-service';

const builder = createStatementQueryBuilder(organizationId)
  .forPeriod('period-2024-01')
  .withSubsidiary('sub-001')
  .withSegments({
    classId: 'cls-001',
    departmentId: 'dept-001'
  });

// Get statements
const trialBalance = await builder.getTrialBalance();
const incomeStatement = await builder.getIncomeStatement();
const balanceSheet = await builder.getBalanceSheet();
```

### Multi-Period Analysis

```typescript
const builder = createStatementQueryBuilder(organizationId)
  .forPeriod('period-2024-03')
  .withAdditionalPeriods([
    'period-2024-01',
    'period-2024-02',
  ]);

// Get multi-period results with trend analysis
const result = await builder.getMultiPeriodIncomeStatement();

// Result includes:
// - periods[]: Income statements for each period
// - trendAnalysis: Revenue growth, margin trends, net income growth
```

### Comparative Statements

```typescript
const builder = createStatementQueryBuilder(organizationId)
  .forPeriod('period-2024-01')
  .compareTo('period-2023-12'); // Add comparison period

const balanceSheet = await builder.getBalanceSheet();
// Result includes priorPeriod data when available
```

## Caching Strategy

### Overview

The caching system is designed to balance performance with data freshness for financial reporting workloads.

### Cache Characteristics

| Report Type      | Default TTL | Rationale                                    |
|------------------|-------------|----------------------------------------------|
| Trial Balance    | 5 minutes   | Frequently accessed, low change frequency    |
| Income Statement | 5 minutes   | Period-based, changes only with postings     |
| Balance Sheet    | 5 minutes   | Point-in-time snapshot, stable within period |

### Cache Key Structure

Cache keys are composed of:
```
{reportType}:{organizationId}:{periodId}:{subsidiaryId}:{classId}:{departmentId}:{locationId}:{includeInactive}:{comparePeriodId}:{additionalPeriods}
```

Example:
```
trial_balance:org-123:period-2024-01:sub-001:all:all:all:active:no-compare:no-multi
```

### Cache Invalidation

**Automatic Invalidation:**
- Cache entries expire after TTL (default 5 minutes)
- Call `invalidateStatementCache(organizationId)` after GL postings

**Manual Invalidation:**
```typescript
import {
  invalidateStatementCache,
  invalidateReportTypeCache,
  clearStatementCache
} from '@glapi/api-service';

// Invalidate all cached reports for an organization
invalidateStatementCache('org-123');

// Invalidate specific report type
invalidateReportTypeCache('trial_balance', 'org-123');

// Clear entire cache
clearStatementCache();
```

### Integration with GL Posting

The GL posting engine should invalidate the cache after successful postings:

```typescript
async postTransaction(transaction: Transaction) {
  // ... perform posting ...

  // Invalidate cached reports for this organization
  invalidateStatementCache(transaction.organizationId);
}
```

### Cache Monitoring

```typescript
import { getStatementCacheStats } from '@glapi/api-service';

const stats = getStatementCacheStats();
// {
//   size: 5,
//   entries: [
//     { key: 'trial_balance:org-123:...', expiresIn: 245000 },
//     ...
//   ]
// }
```

### Disabling Cache

For testing or real-time requirements:

```typescript
const builder = createStatementQueryBuilder(organizationId)
  .forPeriod('period-2024-01')
  .useCache(false); // Bypass cache
```

### Custom TTL

```typescript
const builder = createStatementQueryBuilder(organizationId)
  .forPeriod('period-2024-01')
  .withCacheTtl(60000); // 1 minute TTL
```

## Multi-Entity Support

### Subsidiary Consolidation

When no subsidiary is specified, results consolidate all accessible subsidiaries:

```typescript
const builder = createStatementQueryBuilder(organizationId)
  .forPeriod('period-2024-01');
// Results show "All Subsidiaries" and aggregate data

const builder = createStatementQueryBuilder(organizationId)
  .forPeriod('period-2024-01')
  .withSubsidiary('sub-001');
// Results filtered to single subsidiary
```

### Segment Filtering

Apply class, department, and location filters:

```typescript
const builder = createStatementQueryBuilder(organizationId)
  .forPeriod('period-2024-01')
  .withSegments({
    classId: 'cls-engineering',      // Filter by class
    departmentId: 'dept-operations', // Filter by department
    locationId: 'loc-west-coast',    // Filter by location
  });
```

## Trial Balance Categorization

The query builder automatically categorizes trial balance entries:

```typescript
const result = await builder.getTrialBalance();

// Categorized entries
result.assetAccounts      // Normal balance: DEBIT
result.liabilityAccounts  // Normal balance: CREDIT
result.equityAccounts     // Normal balance: CREDIT
result.revenueAccounts    // Normal balance: CREDIT
result.cogsAccounts       // Normal balance: DEBIT
result.expenseAccounts    // Normal balance: DEBIT

// Category totals
result.categoryTotals.assets      // { debit, credit, net }
result.categoryTotals.liabilities // { debit, credit, net }
// ...

// Overall totals (should balance)
result.totals.totalDebits
result.totals.totalCredits
result.totals.difference  // Should be 0
```

## Trend Analysis

Multi-period queries include automated trend analysis:

### Income Statement Trends
```typescript
const result = await builder.getMultiPeriodIncomeStatement();
result.trendAnalysis = {
  revenueGrowth: [10, 15, 8],        // % growth period over period
  grossProfitMarginTrend: [45, 47, 46], // Margin % per period
  netIncomeGrowth: [12, 18, 5],      // % growth period over period
};
```

### Balance Sheet Trends
```typescript
const result = await builder.getMultiPeriodBalanceSheet();
result.trendAnalysis = {
  assetGrowth: [5, 8, 3],      // % growth period over period
  liabilityGrowth: [2, 4, 1],  // % growth period over period
  equityGrowth: [8, 12, 5],    // % growth period over period
};
```

## Best Practices

1. **Use caching for repeated queries** - Default enabled, improves performance
2. **Invalidate cache after postings** - Call `invalidateStatementCache()` after GL posts
3. **Use segment filters** - Reduces data volume for large organizations
4. **Prefer multi-period API** - For trend analysis instead of multiple single queries
5. **Monitor cache stats** - Use `getStatementCacheStats()` for visibility

## API Reference

### FinancialStatementQueryBuilder Methods

| Method                     | Description                                    |
|----------------------------|------------------------------------------------|
| `forPeriod(id)`            | Set primary period (required)                  |
| `withSubsidiary(id)`       | Filter by subsidiary                           |
| `withSegments(obj)`        | Set class, department, location filters        |
| `withClass(id)`            | Filter by class                                |
| `withDepartment(id)`       | Filter by department                           |
| `withLocation(id)`         | Filter by location                             |
| `withInactiveAccounts()`   | Include inactive accounts                      |
| `compareTo(id)`            | Add comparison period                          |
| `withAdditionalPeriods([])` | Add periods for trend analysis                |
| `useCache(bool)`           | Enable/disable caching                         |
| `withCacheTtl(ms)`         | Set custom cache TTL                           |
| `getTrialBalance()`        | Execute trial balance query                    |
| `getIncomeStatement()`     | Execute income statement query                 |
| `getBalanceSheet()`        | Execute balance sheet query                    |
| `getMultiPeriodTrialBalance()` | Get trial balance for multiple periods     |
| `getMultiPeriodIncomeStatement()` | Get income statements with trends        |
| `getMultiPeriodBalanceSheet()` | Get balance sheets with trends              |

### Cache Management Functions

| Function                           | Description                                |
|------------------------------------|--------------------------------------------|
| `invalidateStatementCache(orgId)`  | Clear all cached reports for organization  |
| `invalidateReportTypeCache(type, orgId)` | Clear specific report type cache     |
| `clearStatementCache()`            | Clear entire cache                         |
| `getStatementCacheStats()`         | Get cache statistics for monitoring        |
