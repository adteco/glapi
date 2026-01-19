/**
 * Financial Statement Query Builder
 *
 * Provides a fluent API for building financial statement queries with support for:
 * - Multi-entity consolidation (subsidiary filtering)
 * - Multi-period comparison (comparative statements)
 * - Segment filtering (class, department, location)
 * - Result caching with configurable TTL
 *
 * @module financial-statement-query-builder
 */

import { glReportingRepository } from '@glapi/database';
import type {
  FinancialStatementFilters,
  IncomeStatement,
  BalanceSheet,
  CategorizedTrialBalance,
} from '../types/financial-statements.types';
import type { AccountCategory } from '../types/account.types';

// ============================================
// CACHE TYPES AND IMPLEMENTATION
// ============================================

/**
 * Cache entry with TTL tracking
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * In-memory cache for financial statement queries
 *
 * Caching Strategy:
 * - Trial Balance: 5 minute TTL (frequently accessed, low data change)
 * - Income Statement: 5 minute TTL (period-based, changes infrequently)
 * - Balance Sheet: 5 minute TTL (point-in-time, changes with postings)
 *
 * Cache invalidation occurs:
 * - On TTL expiration
 * - When GL postings occur (via invalidateForOrganization)
 * - On manual cache clear
 */
class FinancialStatementCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Generate cache key from query parameters
   */
  generateKey(
    reportType: 'trial_balance' | 'income_statement' | 'balance_sheet',
    organizationId: string,
    filters: FinancialStatementFilters,
    additionalPeriods?: string[]
  ): string {
    const keyParts = [
      reportType,
      organizationId,
      filters.periodId,
      filters.subsidiaryId || 'all',
      filters.classId || 'all',
      filters.departmentId || 'all',
      filters.locationId || 'all',
      filters.includeInactive ? 'inactive' : 'active',
      filters.comparePeriodId || 'no-compare',
      additionalPeriods?.sort().join(',') || 'no-multi',
    ];
    return keyParts.join(':');
  }

  /**
   * Get cached entry if valid
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cache entry with TTL
   */
  set<T>(key: string, data: T, ttlMs: number = this.DEFAULT_TTL_MS): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttlMs,
    });
  }

  /**
   * Invalidate all cache entries for an organization
   * Should be called after GL postings
   */
  invalidateForOrganization(organizationId: string): number {
    let invalidated = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(organizationId)) {
        this.cache.delete(key);
        invalidated++;
      }
    }
    return invalidated;
  }

  /**
   * Invalidate specific report type for organization
   */
  invalidateReportType(
    reportType: 'trial_balance' | 'income_statement' | 'balance_sheet',
    organizationId: string
  ): number {
    let invalidated = 0;
    const prefix = `${reportType}:${organizationId}`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        invalidated++;
      }
    }
    return invalidated;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; entries: { key: string; expiresIn: number }[] } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      expiresIn: Math.max(0, entry.expiresAt - now),
    }));
    return { size: this.cache.size, entries };
  }
}

// Singleton cache instance
const statementCache = new FinancialStatementCache();

// ============================================
// MULTI-PERIOD RESULT TYPES
// ============================================

/**
 * Multi-period trial balance result
 */
export interface MultiPeriodTrialBalance {
  periods: Array<{
    periodId: string;
    periodName: string;
    trialBalance: CategorizedTrialBalance;
  }>;
  periodComparison: {
    periodIds: string[];
    totalAssetsChange: number;
    totalLiabilitiesChange: number;
    totalEquityChange: number;
    revenueChange: number;
    expensesChange: number;
  } | null;
}

/**
 * Multi-period income statement result
 */
export interface MultiPeriodIncomeStatement {
  periods: Array<{
    periodId: string;
    periodName: string;
    incomeStatement: IncomeStatement;
  }>;
  trendAnalysis: {
    revenueGrowth: number[];
    grossProfitMarginTrend: number[];
    netIncomeGrowth: number[];
  } | null;
}

/**
 * Multi-period balance sheet result
 */
export interface MultiPeriodBalanceSheet {
  periods: Array<{
    periodId: string;
    periodName: string;
    balanceSheet: BalanceSheet;
  }>;
  trendAnalysis: {
    assetGrowth: number[];
    liabilityGrowth: number[];
    equityGrowth: number[];
  } | null;
}

// ============================================
// QUERY BUILDER CLASS
// ============================================

/**
 * Fluent query builder for financial statements
 *
 * Usage:
 * ```typescript
 * const builder = new FinancialStatementQueryBuilder(organizationId)
 *   .forPeriod('period-2024-01')
 *   .withSubsidiary('sub-001')
 *   .withSegments({ classId: 'cls-001' })
 *   .compareTo('period-2023-12')
 *   .useCache(true);
 *
 * const trialBalance = await builder.getTrialBalance();
 * const incomeStatement = await builder.getIncomeStatement();
 * ```
 */
export class FinancialStatementQueryBuilder {
  private organizationId: string;
  private periodId: string | null = null;
  private subsidiaryId: string | null = null;
  private classId: string | null = null;
  private departmentId: string | null = null;
  private locationId: string | null = null;
  private includeInactive: boolean = false;
  private comparePeriodId: string | null = null;
  private additionalPeriodIds: string[] = [];
  private cacheEnabled: boolean = true;
  private cacheTtlMs: number = 5 * 60 * 1000; // 5 minutes default

  constructor(organizationId: string) {
    this.organizationId = organizationId;
  }

  // ============================================
  // FLUENT CONFIGURATION METHODS
  // ============================================

  /**
   * Set the primary period for the statement
   */
  forPeriod(periodId: string): this {
    this.periodId = periodId;
    return this;
  }

  /**
   * Filter by subsidiary (multi-entity support)
   * Pass null or omit to consolidate all subsidiaries
   */
  withSubsidiary(subsidiaryId: string | null): this {
    this.subsidiaryId = subsidiaryId;
    return this;
  }

  /**
   * Filter by multiple segments at once
   */
  withSegments(segments: {
    classId?: string | null;
    departmentId?: string | null;
    locationId?: string | null;
  }): this {
    if (segments.classId !== undefined) this.classId = segments.classId;
    if (segments.departmentId !== undefined) this.departmentId = segments.departmentId;
    if (segments.locationId !== undefined) this.locationId = segments.locationId;
    return this;
  }

  /**
   * Set class segment filter
   */
  withClass(classId: string | null): this {
    this.classId = classId;
    return this;
  }

  /**
   * Set department segment filter
   */
  withDepartment(departmentId: string | null): this {
    this.departmentId = departmentId;
    return this;
  }

  /**
   * Set location segment filter
   */
  withLocation(locationId: string | null): this {
    this.locationId = locationId;
    return this;
  }

  /**
   * Include inactive accounts in results
   */
  withInactiveAccounts(include: boolean = true): this {
    this.includeInactive = include;
    return this;
  }

  /**
   * Add a comparison period (for comparative statements)
   */
  compareTo(periodId: string): this {
    this.comparePeriodId = periodId;
    return this;
  }

  /**
   * Add multiple periods for trend analysis
   * These are in addition to the primary period
   */
  withAdditionalPeriods(periodIds: string[]): this {
    this.additionalPeriodIds = [...periodIds];
    return this;
  }

  /**
   * Enable or disable caching
   */
  useCache(enabled: boolean = true): this {
    this.cacheEnabled = enabled;
    return this;
  }

  /**
   * Set custom cache TTL in milliseconds
   */
  withCacheTtl(ttlMs: number): this {
    this.cacheTtlMs = ttlMs;
    return this;
  }

  // ============================================
  // QUERY EXECUTION METHODS
  // ============================================

  /**
   * Build filters object from builder state
   */
  private buildFilters(): FinancialStatementFilters {
    if (!this.periodId) {
      throw new Error('Period ID is required. Call forPeriod() before executing query.');
    }

    return {
      periodId: this.periodId,
      subsidiaryId: this.subsidiaryId ?? undefined,
      classId: this.classId ?? undefined,
      departmentId: this.departmentId ?? undefined,
      locationId: this.locationId ?? undefined,
      includeInactive: this.includeInactive,
      comparePeriodId: this.comparePeriodId ?? undefined,
    };
  }

  /**
   * Get Trial Balance for configured filters
   */
  async getTrialBalance(): Promise<CategorizedTrialBalance> {
    const filters = this.buildFilters();
    const cacheKey = statementCache.generateKey(
      'trial_balance',
      this.organizationId,
      filters
    );

    // Check cache
    if (this.cacheEnabled) {
      const cached = statementCache.get<CategorizedTrialBalance>(cacheKey);
      if (cached) return cached;
    }

    // Execute query
    const result = await glReportingRepository.getTrialBalance(
      {
        periodId: filters.periodId,
        subsidiaryId: filters.subsidiaryId,
        classId: filters.classId,
        departmentId: filters.departmentId,
        locationId: filters.locationId,
        includeInactive: filters.includeInactive,
      },
      this.organizationId
    );

    // Categorize the trial balance
    const categorized = this.categorizeTrialBalance(result, filters);

    // Cache result
    if (this.cacheEnabled) {
      statementCache.set(cacheKey, categorized, this.cacheTtlMs);
    }

    return categorized;
  }

  /**
   * Get Trial Balance for multiple periods
   */
  async getMultiPeriodTrialBalance(): Promise<MultiPeriodTrialBalance> {
    const allPeriods = [this.periodId!, ...this.additionalPeriodIds].filter(Boolean);

    if (allPeriods.length === 0) {
      throw new Error('At least one period is required');
    }

    // Fetch trial balance for each period
    const periodResults = await Promise.all(
      allPeriods.map(async (periodId) => {
        const builder = new FinancialStatementQueryBuilder(this.organizationId)
          .forPeriod(periodId)
          .withSubsidiary(this.subsidiaryId)
          .withSegments({
            classId: this.classId,
            departmentId: this.departmentId,
            locationId: this.locationId,
          })
          .withInactiveAccounts(this.includeInactive)
          .useCache(this.cacheEnabled);

        const trialBalance = await builder.getTrialBalance();
        return {
          periodId,
          periodName: trialBalance.periodName,
          trialBalance,
        };
      })
    );

    // Calculate period comparison if multiple periods
    let periodComparison = null;
    if (periodResults.length >= 2) {
      const first = periodResults[0].trialBalance;
      const last = periodResults[periodResults.length - 1].trialBalance;

      periodComparison = {
        periodIds: allPeriods,
        totalAssetsChange:
          last.categoryTotals.assets.net - first.categoryTotals.assets.net,
        totalLiabilitiesChange:
          last.categoryTotals.liabilities.net - first.categoryTotals.liabilities.net,
        totalEquityChange:
          last.categoryTotals.equity.net - first.categoryTotals.equity.net,
        revenueChange:
          last.categoryTotals.revenue.net - first.categoryTotals.revenue.net,
        expensesChange:
          last.categoryTotals.expenses.net - first.categoryTotals.expenses.net,
      };
    }

    return { periods: periodResults, periodComparison };
  }

  /**
   * Get Income Statement for configured filters
   */
  async getIncomeStatement(): Promise<IncomeStatement> {
    const filters = this.buildFilters();
    const cacheKey = statementCache.generateKey(
      'income_statement',
      this.organizationId,
      filters
    );

    // Check cache
    if (this.cacheEnabled) {
      const cached = statementCache.get<IncomeStatement>(cacheKey);
      if (cached) return cached;
    }

    // Execute query
    const result = await glReportingRepository.getIncomeStatement(
      {
        periodId: filters.periodId,
        subsidiaryId: filters.subsidiaryId,
        classId: filters.classId,
        departmentId: filters.departmentId,
        locationId: filters.locationId,
        includeInactive: filters.includeInactive,
        comparePeriodId: filters.comparePeriodId,
      },
      this.organizationId
    );

    // Cache result
    if (this.cacheEnabled) {
      statementCache.set(cacheKey, result, this.cacheTtlMs);
    }

    return result;
  }

  /**
   * Get Income Statement for multiple periods (trend analysis)
   */
  async getMultiPeriodIncomeStatement(): Promise<MultiPeriodIncomeStatement> {
    const allPeriods = [this.periodId!, ...this.additionalPeriodIds].filter(Boolean);

    if (allPeriods.length === 0) {
      throw new Error('At least one period is required');
    }

    // Fetch income statement for each period
    const periodResults = await Promise.all(
      allPeriods.map(async (periodId) => {
        const builder = new FinancialStatementQueryBuilder(this.organizationId)
          .forPeriod(periodId)
          .withSubsidiary(this.subsidiaryId)
          .withSegments({
            classId: this.classId,
            departmentId: this.departmentId,
            locationId: this.locationId,
          })
          .withInactiveAccounts(this.includeInactive)
          .useCache(this.cacheEnabled);

        const incomeStatement = await builder.getIncomeStatement();
        return {
          periodId,
          periodName: incomeStatement.periodName,
          incomeStatement,
        };
      })
    );

    // Calculate trend analysis if multiple periods
    let trendAnalysis = null;
    if (periodResults.length >= 2) {
      trendAnalysis = {
        revenueGrowth: this.calculateGrowthRates(
          periodResults.map((p) => p.incomeStatement.totalRevenue)
        ),
        grossProfitMarginTrend: periodResults.map(
          (p) => p.incomeStatement.grossProfitMargin
        ),
        netIncomeGrowth: this.calculateGrowthRates(
          periodResults.map((p) => p.incomeStatement.netIncome)
        ),
      };
    }

    return { periods: periodResults, trendAnalysis };
  }

  /**
   * Get Balance Sheet for configured filters
   */
  async getBalanceSheet(): Promise<BalanceSheet> {
    const filters = this.buildFilters();
    const cacheKey = statementCache.generateKey(
      'balance_sheet',
      this.organizationId,
      filters
    );

    // Check cache
    if (this.cacheEnabled) {
      const cached = statementCache.get<BalanceSheet>(cacheKey);
      if (cached) return cached;
    }

    // Execute query
    const result = await glReportingRepository.getBalanceSheet(
      {
        periodId: filters.periodId,
        subsidiaryId: filters.subsidiaryId,
        classId: filters.classId,
        departmentId: filters.departmentId,
        locationId: filters.locationId,
        includeInactive: filters.includeInactive,
        comparePeriodId: filters.comparePeriodId,
      },
      this.organizationId
    );

    // Cache result
    if (this.cacheEnabled) {
      statementCache.set(cacheKey, result, this.cacheTtlMs);
    }

    return result;
  }

  /**
   * Get Balance Sheet for multiple periods (trend analysis)
   */
  async getMultiPeriodBalanceSheet(): Promise<MultiPeriodBalanceSheet> {
    const allPeriods = [this.periodId!, ...this.additionalPeriodIds].filter(Boolean);

    if (allPeriods.length === 0) {
      throw new Error('At least one period is required');
    }

    // Fetch balance sheet for each period
    const periodResults = await Promise.all(
      allPeriods.map(async (periodId) => {
        const builder = new FinancialStatementQueryBuilder(this.organizationId)
          .forPeriod(periodId)
          .withSubsidiary(this.subsidiaryId)
          .withSegments({
            classId: this.classId,
            departmentId: this.departmentId,
            locationId: this.locationId,
          })
          .withInactiveAccounts(this.includeInactive)
          .useCache(this.cacheEnabled);

        const balanceSheet = await builder.getBalanceSheet();
        return {
          periodId,
          periodName: balanceSheet.periodName,
          balanceSheet,
        };
      })
    );

    // Calculate trend analysis if multiple periods
    let trendAnalysis = null;
    if (periodResults.length >= 2) {
      trendAnalysis = {
        assetGrowth: this.calculateGrowthRates(
          periodResults.map((p) => p.balanceSheet.totalAssets)
        ),
        liabilityGrowth: this.calculateGrowthRates(
          periodResults.map((p) => p.balanceSheet.totalLiabilities)
        ),
        equityGrowth: this.calculateGrowthRates(
          periodResults.map((p) => p.balanceSheet.totalEquity)
        ),
      };
    }

    return { periods: periodResults, trendAnalysis };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Calculate period-over-period growth rates
   */
  private calculateGrowthRates(values: number[]): number[] {
    if (values.length < 2) return [];

    const growthRates: number[] = [];
    for (let i = 1; i < values.length; i++) {
      const previous = values[i - 1];
      const current = values[i];
      if (previous === 0) {
        growthRates.push(current === 0 ? 0 : Infinity);
      } else {
        growthRates.push(((current - previous) / Math.abs(previous)) * 100);
      }
    }
    return growthRates;
  }

  /**
   * Determine normal balance based on account category
   */
  private getNormalBalance(accountType: string): 'DEBIT' | 'CREDIT' {
    const debitNormal = ['Asset', 'ASSET', 'Expense', 'EXPENSE', 'COGS'];
    return debitNormal.includes(accountType) ? 'DEBIT' : 'CREDIT';
  }

  /**
   * Normalize account category to uppercase standard format
   */
  private normalizeCategory(accountType: string): string {
    const categoryMap: Record<string, string> = {
      'Asset': 'ASSET',
      'Liability': 'LIABILITY',
      'Equity': 'EQUITY',
      'Revenue': 'REVENUE',
      'COGS': 'COGS',
      'Expense': 'EXPENSE',
    };
    return categoryMap[accountType] || accountType.toUpperCase();
  }

  /**
   * Categorize trial balance entries by account type
   */
  private categorizeTrialBalance(
    rawResult: Awaited<ReturnType<typeof glReportingRepository.getTrialBalance>>,
    _filters: FinancialStatementFilters
  ): CategorizedTrialBalance {
    // Initialize categorized arrays
    const assetAccounts: CategorizedTrialBalance['assetAccounts'] = [];
    const liabilityAccounts: CategorizedTrialBalance['liabilityAccounts'] = [];
    const equityAccounts: CategorizedTrialBalance['equityAccounts'] = [];
    const revenueAccounts: CategorizedTrialBalance['revenueAccounts'] = [];
    const cogsAccounts: CategorizedTrialBalance['cogsAccounts'] = [];
    const expenseAccounts: CategorizedTrialBalance['expenseAccounts'] = [];

    // Categorize each entry
    for (const entry of rawResult.entries) {
      const normalizedCategory = this.normalizeCategory(entry.accountType);
      const extendedEntry = {
        accountId: entry.accountId,
        accountNumber: entry.accountNumber,
        accountName: entry.accountName,
        accountCategory: normalizedCategory as AccountCategory,
        accountSubcategory: undefined,
        normalBalance: this.getNormalBalance(entry.accountType),
        debitBalance: entry.debitBalance,
        creditBalance: entry.creditBalance,
        netBalance: entry.netBalance,
        periodActivity: entry.periodActivity,
        ytdActivity: entry.ytdActivity,
      };

      switch (normalizedCategory) {
        case 'ASSET':
          assetAccounts.push(extendedEntry);
          break;
        case 'LIABILITY':
          liabilityAccounts.push(extendedEntry);
          break;
        case 'EQUITY':
          equityAccounts.push(extendedEntry);
          break;
        case 'REVENUE':
          revenueAccounts.push(extendedEntry);
          break;
        case 'COGS':
          cogsAccounts.push(extendedEntry);
          break;
        case 'EXPENSE':
          expenseAccounts.push(extendedEntry);
          break;
      }
    }

    // Calculate category totals
    const sumCategory = (accounts: typeof assetAccounts) => ({
      debit: accounts.reduce((sum, a) => sum + a.debitBalance, 0),
      credit: accounts.reduce((sum, a) => sum + a.creditBalance, 0),
      net: accounts.reduce((sum, a) => sum + a.netBalance, 0),
    });

    const categoryTotals = {
      assets: sumCategory(assetAccounts),
      liabilities: sumCategory(liabilityAccounts),
      equity: sumCategory(equityAccounts),
      revenue: sumCategory(revenueAccounts),
      cogs: sumCategory(cogsAccounts),
      expenses: sumCategory(expenseAccounts),
    };

    return {
      periodName: rawResult.periodName,
      subsidiaryName: rawResult.subsidiaryName,
      asOfDate: rawResult.asOfDate,
      assetAccounts,
      liabilityAccounts,
      equityAccounts,
      revenueAccounts,
      cogsAccounts,
      expenseAccounts,
      categoryTotals,
      totals: {
        totalDebits: rawResult.totals.totalDebits,
        totalCredits: rawResult.totals.totalCredits,
        difference: rawResult.totals.difference,
      },
    };
  }
}

// ============================================
// CACHE MANAGEMENT EXPORTS
// ============================================

/**
 * Invalidate all cached statements for an organization
 * Should be called after GL postings
 */
export function invalidateStatementCache(organizationId: string): number {
  return statementCache.invalidateForOrganization(organizationId);
}

/**
 * Invalidate specific report type cache
 */
export function invalidateReportTypeCache(
  reportType: 'trial_balance' | 'income_statement' | 'balance_sheet',
  organizationId: string
): number {
  return statementCache.invalidateReportType(reportType, organizationId);
}

/**
 * Clear entire statement cache
 */
export function clearStatementCache(): void {
  statementCache.clear();
}

/**
 * Get cache statistics for monitoring
 */
export function getStatementCacheStats() {
  return statementCache.getStats();
}

// ============================================
// FACTORY FUNCTION
// ============================================

/**
 * Create a new query builder instance
 */
export function createStatementQueryBuilder(
  organizationId: string
): FinancialStatementQueryBuilder {
  return new FinancialStatementQueryBuilder(organizationId);
}
