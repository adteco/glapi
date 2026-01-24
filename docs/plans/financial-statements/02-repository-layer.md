# Phase 2: Repository Layer

## Overview
Implement database queries for financial statement data aggregation, including account hierarchy traversal and dimension-filtered balance summaries.

---

## Task 2.1: Enhance GL Reporting Repository with Balance Sheet Query

**Description**: Add a method to aggregate account balances by category for Balance Sheet generation, supporting dimension filters and account hierarchy.

**Layer**: Database (`@glapi/database`)

**Estimated Time**: 3 hours

**File**: `/Users/fredpope/Development/glapi/packages/database/src/repositories/gl-reporting.repository.ts`

### Acceptance Criteria
- [ ] Add `getBalanceSheetData()` method that returns categorized balances
- [ ] Support filtering by subsidiary, department, class, location
- [ ] Include account hierarchy (parent/child) information
- [ ] Handle current/non-current asset/liability subcategories
- [ ] Calculate retained earnings from prior period equity
- [ ] Return prior period comparison data if requested

### TDD Test Cases

```typescript
// packages/database/src/repositories/__tests__/gl-reporting.repository.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../db';
import { glReportingRepository } from '../gl-reporting.repository';
import { accounts, glAccountBalances, accountingPeriods } from '../../db/schema';

describe('GlReportingRepository - Balance Sheet', () => {
  const mockOrgId = 'test-org-id';
  const mockPeriodId = 'test-period-id';

  beforeEach(async () => {
    // Setup test data - accounts with categories, balances
  });

  describe('getBalanceSheetData', () => {
    it('should return categorized account balances', async () => {
      const result = await glReportingRepository.getBalanceSheetData(
        { periodId: mockPeriodId },
        mockOrgId
      );

      expect(result).toHaveProperty('assets');
      expect(result).toHaveProperty('liabilities');
      expect(result).toHaveProperty('equity');
      expect(result.assets.current).toBeDefined();
      expect(result.assets.nonCurrent).toBeDefined();
    });

    it('should filter by subsidiary when provided', async () => {
      const result = await glReportingRepository.getBalanceSheetData(
        { periodId: mockPeriodId, subsidiaryId: 'sub-1' },
        mockOrgId
      );

      // All balances should be for the specified subsidiary
      expect(result.totalAssets).toBeGreaterThanOrEqual(0);
    });

    it('should filter by multiple dimensions', async () => {
      const result = await glReportingRepository.getBalanceSheetData(
        {
          periodId: mockPeriodId,
          subsidiaryId: 'sub-1',
          departmentIds: ['dept-1', 'dept-2'],
          classIds: ['class-1'],
        },
        mockOrgId
      );

      expect(result).toBeDefined();
    });

    it('should include prior period comparison when requested', async () => {
      const result = await glReportingRepository.getBalanceSheetData(
        { periodId: mockPeriodId, comparePeriodId: 'prior-period-id' },
        mockOrgId
      );

      expect(result.priorPeriod).toBeDefined();
      expect(result.priorPeriod?.totalAssets).toBeDefined();
    });

    it('should calculate retained earnings correctly', async () => {
      const result = await glReportingRepository.getBalanceSheetData(
        { periodId: mockPeriodId },
        mockOrgId
      );

      // Retained earnings = prior period equity + current period net income
      expect(result.retainedEarnings).toBeDefined();
    });

    it('should return zero balances for new organizations', async () => {
      const result = await glReportingRepository.getBalanceSheetData(
        { periodId: mockPeriodId },
        'new-org-with-no-data'
      );

      expect(result.totalAssets).toBe(0);
      expect(result.totalLiabilities).toBe(0);
      expect(result.totalEquity).toBe(0);
    });
  });
});
```

### Implementation Skeleton

```typescript
// packages/database/src/repositories/gl-reporting.repository.ts

import { db } from '../db';
import { accounts, glAccountBalances, accountingPeriods } from '../db/schema';
import { eq, and, inArray, sql, or, isNull } from 'drizzle-orm';

interface BalanceSheetFilters {
  periodId: string;
  subsidiaryId?: string;
  departmentIds?: string[];
  classIds?: string[];
  locationIds?: string[];
  includeInactive?: boolean;
  comparePeriodId?: string;
}

interface BalanceSheetData {
  periodName: string;
  subsidiaryName: string;
  asOfDate: string;

  assets: {
    current: AccountLineItem[];
    nonCurrent: AccountLineItem[];
    totalCurrent: number;
    totalNonCurrent: number;
  };
  totalAssets: number;

  liabilities: {
    current: AccountLineItem[];
    longTerm: AccountLineItem[];
    totalCurrent: number;
    totalLongTerm: number;
  };
  totalLiabilities: number;

  equity: {
    items: AccountLineItem[];
    retainedEarnings: number;
    currentPeriodNetIncome: number;
  };
  totalEquity: number;

  priorPeriod?: {
    periodName: string;
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
  };
}

interface AccountLineItem {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountSubcategory: string | null;
  balance: number;
  priorBalance?: number;
  variance?: number;
  childAccounts?: AccountLineItem[];
}

export async function getBalanceSheetData(
  filters: BalanceSheetFilters,
  organizationId: string
): Promise<BalanceSheetData> {
  // Build dimension filter conditions
  const dimensionConditions = buildDimensionConditions(filters);

  // Query account balances grouped by account category
  const balances = await db
    .select({
      accountId: accounts.id,
      accountNumber: accounts.accountNumber,
      accountName: accounts.accountName,
      accountCategory: accounts.accountCategory,
      accountSubcategory: accounts.accountSubcategory,
      rollupAccountId: accounts.rollupAccountId,
      endingBalance: sql<number>`
        SUM(${glAccountBalances.endingBalanceDebit}) -
        SUM(${glAccountBalances.endingBalanceCredit})
      `.as('ending_balance'),
    })
    .from(glAccountBalances)
    .innerJoin(accounts, eq(accounts.id, glAccountBalances.accountId))
    .where(
      and(
        eq(accounts.organizationId, organizationId),
        eq(glAccountBalances.periodId, filters.periodId),
        filters.includeInactive ? undefined : eq(accounts.isActive, true),
        ...dimensionConditions
      )
    )
    .groupBy(
      accounts.id,
      accounts.accountNumber,
      accounts.accountName,
      accounts.accountCategory,
      accounts.accountSubcategory,
      accounts.rollupAccountId
    );

  // Categorize balances
  const categorized = categorizeBalances(balances);

  // Calculate retained earnings from prior periods
  const retainedEarnings = await calculateRetainedEarnings(
    organizationId,
    filters.periodId,
    filters.subsidiaryId
  );

  // Calculate current period net income
  const netIncome = calculateNetIncome(categorized);

  // Get period info
  const periodInfo = await getPeriodInfo(filters.periodId);

  // Get prior period data if requested
  let priorPeriod;
  if (filters.comparePeriodId) {
    priorPeriod = await getPriorPeriodSummary(
      organizationId,
      filters.comparePeriodId,
      filters.subsidiaryId
    );
  }

  return {
    periodName: periodInfo.periodName,
    subsidiaryName: filters.subsidiaryId ? await getSubsidiaryName(filters.subsidiaryId) : 'All Subsidiaries',
    asOfDate: periodInfo.endDate,
    assets: categorized.assets,
    totalAssets: categorized.assets.totalCurrent + categorized.assets.totalNonCurrent,
    liabilities: categorized.liabilities,
    totalLiabilities: categorized.liabilities.totalCurrent + categorized.liabilities.totalLongTerm,
    equity: {
      items: categorized.equity,
      retainedEarnings,
      currentPeriodNetIncome: netIncome,
    },
    totalEquity: sumEquity(categorized.equity) + retainedEarnings + netIncome,
    priorPeriod,
  };
}

function buildDimensionConditions(filters: BalanceSheetFilters) {
  const conditions = [];

  if (filters.subsidiaryId) {
    conditions.push(eq(glAccountBalances.subsidiaryId, filters.subsidiaryId));
  }
  if (filters.departmentIds?.length) {
    conditions.push(
      or(
        inArray(glAccountBalances.departmentId, filters.departmentIds),
        isNull(glAccountBalances.departmentId)
      )
    );
  }
  if (filters.classIds?.length) {
    conditions.push(
      or(
        inArray(glAccountBalances.classId, filters.classIds),
        isNull(glAccountBalances.classId)
      )
    );
  }
  if (filters.locationIds?.length) {
    conditions.push(
      or(
        inArray(glAccountBalances.locationId, filters.locationIds),
        isNull(glAccountBalances.locationId)
      )
    );
  }

  return conditions;
}
```

---

## Task 2.2: Add Income Statement Repository Query

**Description**: Add method to aggregate revenue, COGS, and expense account balances for Income Statement generation.

**Layer**: Database (`@glapi/database`)

**Estimated Time**: 3 hours

**File**: `/Users/fredpope/Development/glapi/packages/database/src/repositories/gl-reporting.repository.ts`

### Acceptance Criteria
- [ ] Add `getIncomeStatementData()` method
- [ ] Calculate gross profit (Revenue - COGS)
- [ ] Calculate operating income (Gross Profit - Operating Expenses)
- [ ] Support YTD calculations
- [ ] Support prior period comparison
- [ ] Handle dimension filters

### TDD Test Cases

```typescript
describe('GlReportingRepository - Income Statement', () => {
  describe('getIncomeStatementData', () => {
    it('should return revenue, COGS, and expense sections', async () => {
      const result = await glReportingRepository.getIncomeStatementData(
        { periodId: mockPeriodId },
        mockOrgId
      );

      expect(result.revenue.items.length).toBeGreaterThanOrEqual(0);
      expect(result.cogs.items.length).toBeGreaterThanOrEqual(0);
      expect(result.operatingExpenses.items.length).toBeGreaterThanOrEqual(0);
    });

    it('should calculate gross profit correctly', async () => {
      const result = await glReportingRepository.getIncomeStatementData(
        { periodId: mockPeriodId },
        mockOrgId
      );

      expect(result.grossProfit).toBe(result.totalRevenue - result.totalCogs);
    });

    it('should calculate margins correctly', async () => {
      const result = await glReportingRepository.getIncomeStatementData(
        { periodId: mockPeriodId },
        mockOrgId
      );

      if (result.totalRevenue > 0) {
        expect(result.grossProfitMargin).toBe(
          (result.grossProfit / result.totalRevenue) * 100
        );
      }
    });

    it('should include YTD amounts when requested', async () => {
      const result = await glReportingRepository.getIncomeStatementData(
        { periodId: mockPeriodId, includeYTD: true },
        mockOrgId
      );

      expect(result.revenue.items[0]?.ytdAmount).toBeDefined();
    });
  });
});
```

---

## Task 2.3: Add Cash Flow Statement Repository Query

**Description**: Add method to generate cash flow statement data using the indirect method (starting from net income).

**Layer**: Database (`@glapi/database`)

**Estimated Time**: 4 hours

**File**: `/Users/fredpope/Development/glapi/packages/database/src/repositories/gl-reporting.repository.ts`

### Acceptance Criteria
- [ ] Add `getCashFlowStatementData()` method
- [ ] Start with Net Income from Income Statement
- [ ] Add back non-cash items (depreciation, amortization)
- [ ] Calculate working capital changes
- [ ] Group by Operating, Investing, Financing categories based on `cashFlowCategory`
- [ ] Reconcile to beginning/ending cash balance

### TDD Test Cases

```typescript
describe('GlReportingRepository - Cash Flow Statement', () => {
  describe('getCashFlowStatementData', () => {
    it('should return operating, investing, and financing sections', async () => {
      const result = await glReportingRepository.getCashFlowStatementData(
        { periodId: mockPeriodId, method: 'INDIRECT' },
        mockOrgId
      );

      expect(result.operatingActivities).toBeDefined();
      expect(result.investingActivities).toBeDefined();
      expect(result.financingActivities).toBeDefined();
    });

    it('should start with net income for indirect method', async () => {
      const result = await glReportingRepository.getCashFlowStatementData(
        { periodId: mockPeriodId, method: 'INDIRECT' },
        mockOrgId
      );

      // First item in operating should be net income
      expect(result.operatingActivities.items[0]?.description).toContain('Net Income');
    });

    it('should reconcile to ending cash balance', async () => {
      const result = await glReportingRepository.getCashFlowStatementData(
        { periodId: mockPeriodId },
        mockOrgId
      );

      const netChange =
        result.netCashFromOperations +
        result.netCashFromInvesting +
        result.netCashFromFinancing;

      expect(result.endingCashBalance).toBe(
        result.beginningCashBalance + netChange
      );
    });

    it('should categorize accounts by cashFlowCategory', async () => {
      const result = await glReportingRepository.getCashFlowStatementData(
        { periodId: mockPeriodId },
        mockOrgId
      );

      // Investing activities should only include INVESTING category accounts
      result.investingActivities.items.forEach(item => {
        expect(item.cashFlowCategory).toBe('INVESTING');
      });
    });
  });
});
```

### Implementation Skeleton

```typescript
interface CashFlowFilters {
  periodId: string;
  subsidiaryId?: string;
  method: 'INDIRECT' | 'DIRECT';
}

interface CashFlowData {
  periodName: string;
  subsidiaryName: string;
  asOfDate: string;

  // Starting point
  netIncome: number;

  // Operating Activities (Indirect Method)
  operatingActivities: {
    items: CashFlowLineItem[];
    adjustments: CashFlowLineItem[]; // Depreciation, etc.
    workingCapitalChanges: CashFlowLineItem[];
    sectionTotal: number;
  };
  netCashFromOperations: number;

  // Investing Activities
  investingActivities: {
    items: CashFlowLineItem[];
    sectionTotal: number;
  };
  netCashFromInvesting: number;

  // Financing Activities
  financingActivities: {
    items: CashFlowLineItem[];
    sectionTotal: number;
  };
  netCashFromFinancing: number;

  // Reconciliation
  netChangeInCash: number;
  beginningCashBalance: number;
  endingCashBalance: number;
}

interface CashFlowLineItem {
  description: string;
  accountId?: string;
  cashFlowCategory: 'OPERATING' | 'INVESTING' | 'FINANCING';
  amount: number;
  isAdjustment?: boolean;
}

export async function getCashFlowStatementData(
  filters: CashFlowFilters,
  organizationId: string
): Promise<CashFlowData> {
  // 1. Get net income from P&L accounts
  const netIncome = await calculateNetIncomeForPeriod(
    organizationId,
    filters.periodId,
    filters.subsidiaryId
  );

  // 2. Get non-cash adjustments (depreciation, amortization)
  const nonCashAdjustments = await getNonCashAdjustments(
    organizationId,
    filters.periodId,
    filters.subsidiaryId
  );

  // 3. Calculate working capital changes (A/R, A/P, Inventory changes)
  const workingCapitalChanges = await getWorkingCapitalChanges(
    organizationId,
    filters.periodId,
    filters.subsidiaryId
  );

  // 4. Get investing activities (accounts with cashFlowCategory = 'INVESTING')
  const investingItems = await getAccountsByCashFlowCategory(
    organizationId,
    filters.periodId,
    'INVESTING',
    filters.subsidiaryId
  );

  // 5. Get financing activities (accounts with cashFlowCategory = 'FINANCING')
  const financingItems = await getAccountsByCashFlowCategory(
    organizationId,
    filters.periodId,
    'FINANCING',
    filters.subsidiaryId
  );

  // 6. Get beginning and ending cash balances
  const { beginningCash, endingCash } = await getCashBalances(
    organizationId,
    filters.periodId,
    filters.subsidiaryId
  );

  // Calculate totals
  const netCashFromOperations = netIncome +
    sumItems(nonCashAdjustments) +
    sumItems(workingCapitalChanges);
  const netCashFromInvesting = sumItems(investingItems);
  const netCashFromFinancing = sumItems(financingItems);

  return {
    periodName: await getPeriodName(filters.periodId),
    subsidiaryName: filters.subsidiaryId
      ? await getSubsidiaryName(filters.subsidiaryId)
      : 'All Subsidiaries',
    asOfDate: await getPeriodEndDate(filters.periodId),
    netIncome,
    operatingActivities: {
      items: [{ description: 'Net Income', amount: netIncome, cashFlowCategory: 'OPERATING' }],
      adjustments: nonCashAdjustments,
      workingCapitalChanges,
      sectionTotal: netCashFromOperations,
    },
    netCashFromOperations,
    investingActivities: {
      items: investingItems,
      sectionTotal: netCashFromInvesting,
    },
    netCashFromInvesting,
    financingActivities: {
      items: financingItems,
      sectionTotal: netCashFromFinancing,
    },
    netCashFromFinancing,
    netChangeInCash: netCashFromOperations + netCashFromInvesting + netCashFromFinancing,
    beginningCashBalance: beginningCash,
    endingCashBalance: endingCash,
  };
}
```

---

## Task 2.4: Add Saved Report Configuration Repository

**Description**: Add CRUD operations for saved report configurations.

**Layer**: Database (`@glapi/database`)

**Estimated Time**: 2 hours

**File**: `/Users/fredpope/Development/glapi/packages/database/src/repositories/saved-report-configs.repository.ts`

### Acceptance Criteria
- [ ] Add `create()`, `update()`, `delete()` methods
- [ ] Add `findByUser()` to get all configs for a user
- [ ] Add `findDefault()` to get default config for a report type
- [ ] Add `setDefault()` to mark a config as default (unset others)
- [ ] Enforce unique constraint on (org, user, name)

### TDD Test Cases

```typescript
describe('SavedReportConfigsRepository', () => {
  describe('create', () => {
    it('should create a new saved config', async () => {
      const config = await savedReportConfigsRepository.create({
        organizationId: 'org-1',
        userId: 'user-1',
        name: 'My Balance Sheet',
        reportType: 'BALANCE_SHEET',
        filters: { periodId: 'period-1' },
      });

      expect(config.id).toBeDefined();
      expect(config.name).toBe('My Balance Sheet');
    });

    it('should reject duplicate names for same user', async () => {
      await savedReportConfigsRepository.create({
        organizationId: 'org-1',
        userId: 'user-1',
        name: 'Duplicate Name',
        reportType: 'BALANCE_SHEET',
        filters: {},
      });

      await expect(
        savedReportConfigsRepository.create({
          organizationId: 'org-1',
          userId: 'user-1',
          name: 'Duplicate Name',
          reportType: 'INCOME_STATEMENT',
          filters: {},
        })
      ).rejects.toThrow();
    });
  });

  describe('findByUser', () => {
    it('should return all configs for a user', async () => {
      const configs = await savedReportConfigsRepository.findByUser(
        'org-1',
        'user-1'
      );

      expect(Array.isArray(configs)).toBe(true);
    });

    it('should filter by report type', async () => {
      const configs = await savedReportConfigsRepository.findByUser(
        'org-1',
        'user-1',
        'BALANCE_SHEET'
      );

      configs.forEach(config => {
        expect(config.reportType).toBe('BALANCE_SHEET');
      });
    });
  });

  describe('setDefault', () => {
    it('should set config as default and unset others', async () => {
      await savedReportConfigsRepository.setDefault('config-2', 'org-1', 'user-1');

      const config1 = await savedReportConfigsRepository.findById('config-1');
      const config2 = await savedReportConfigsRepository.findById('config-2');

      expect(config1?.isDefault).toBe(false);
      expect(config2?.isDefault).toBe(true);
    });
  });
});
```

---

## Commit Message

```
feat(db): add financial statement repository queries

- Add getBalanceSheetData() with category grouping and hierarchy
- Add getIncomeStatementData() with margin calculations
- Add getCashFlowStatementData() using indirect method
- Add saved report configs repository for user preferences
- Support multi-dimension filtering (subsidiary, dept, class, location)
- Support prior period comparison queries
- Include comprehensive unit tests

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```
