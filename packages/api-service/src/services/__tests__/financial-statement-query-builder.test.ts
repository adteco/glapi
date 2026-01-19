/**
 * Financial Statement Query Builder Unit Tests
 *
 * Tests the fluent query builder API, multi-period support, and caching.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FinancialStatementQueryBuilder,
  createStatementQueryBuilder,
  invalidateStatementCache,
  invalidateReportTypeCache,
  clearStatementCache,
  getStatementCacheStats,
} from '../financial-statement-query-builder';

// Mock the database repository
vi.mock('@glapi/database', () => ({
  glReportingRepository: {
    getTrialBalance: vi.fn(),
    getIncomeStatement: vi.fn(),
    getBalanceSheet: vi.fn(),
  },
}));

import { glReportingRepository } from '@glapi/database';

// ============================================
// TEST DATA FIXTURES
// ============================================

const mockTrialBalanceResult = {
  periodName: 'January 2024',
  subsidiaryName: 'All Subsidiaries',
  asOfDate: '2024-01-31',
  entries: [
    {
      accountId: 'acc-1',
      accountNumber: '1000',
      accountName: 'Cash',
      accountType: 'Asset',
      debitBalance: 50000,
      creditBalance: 0,
      netBalance: 50000,
      periodActivity: { debits: 10000, credits: 5000, net: 5000 },
      ytdActivity: { debits: 50000, credits: 25000, net: 25000 },
    },
    {
      accountId: 'acc-2',
      accountNumber: '1100',
      accountName: 'Accounts Receivable',
      accountType: 'Asset',
      debitBalance: 25000,
      creditBalance: 0,
      netBalance: 25000,
      periodActivity: { debits: 8000, credits: 3000, net: 5000 },
      ytdActivity: { debits: 30000, credits: 10000, net: 20000 },
    },
    {
      accountId: 'acc-3',
      accountNumber: '2000',
      accountName: 'Accounts Payable',
      accountType: 'Liability',
      debitBalance: 0,
      creditBalance: 15000,
      netBalance: -15000,
      periodActivity: { debits: 2000, credits: 5000, net: -3000 },
      ytdActivity: { debits: 10000, credits: 20000, net: -10000 },
    },
    {
      accountId: 'acc-4',
      accountNumber: '3000',
      accountName: 'Common Stock',
      accountType: 'Equity',
      debitBalance: 0,
      creditBalance: 30000,
      netBalance: -30000,
      periodActivity: { debits: 0, credits: 0, net: 0 },
      ytdActivity: { debits: 0, credits: 30000, net: -30000 },
    },
    {
      accountId: 'acc-5',
      accountNumber: '4000',
      accountName: 'Sales Revenue',
      accountType: 'Revenue',
      debitBalance: 0,
      creditBalance: 100000,
      netBalance: -100000,
      periodActivity: { debits: 0, credits: 25000, net: -25000 },
      ytdActivity: { debits: 0, credits: 100000, net: -100000 },
    },
    {
      accountId: 'acc-6',
      accountNumber: '5000',
      accountName: 'Cost of Goods Sold',
      accountType: 'COGS',
      debitBalance: 40000,
      creditBalance: 0,
      netBalance: 40000,
      periodActivity: { debits: 10000, credits: 0, net: 10000 },
      ytdActivity: { debits: 40000, credits: 0, net: 40000 },
    },
    {
      accountId: 'acc-7',
      accountNumber: '6000',
      accountName: 'Operating Expenses',
      accountType: 'Expense',
      debitBalance: 30000,
      creditBalance: 0,
      netBalance: 30000,
      periodActivity: { debits: 8000, credits: 0, net: 8000 },
      ytdActivity: { debits: 30000, credits: 0, net: 30000 },
    },
  ],
  totals: {
    totalDebits: 145000,
    totalCredits: 145000,
    difference: 0,
  },
};

const mockIncomeStatementResult = {
  reportName: 'Income Statement',
  periodName: 'January 2024',
  subsidiaryName: 'All Subsidiaries',
  asOfDate: '2024-01-31',
  revenueSection: {
    name: 'Revenue',
    category: 'Revenue',
    lineItems: [
      {
        accountId: 'acc-5',
        accountNumber: '4000',
        accountName: 'Sales Revenue',
        accountCategory: 'Revenue',
        currentPeriodAmount: 25000,
        ytdAmount: 100000,
      },
    ],
    sectionTotal: 25000,
  },
  totalRevenue: 100000,
  cogsSection: {
    name: 'Cost of Goods Sold',
    category: 'COGS',
    lineItems: [
      {
        accountId: 'acc-6',
        accountNumber: '5000',
        accountName: 'Cost of Goods Sold',
        accountCategory: 'COGS',
        currentPeriodAmount: 10000,
        ytdAmount: 40000,
      },
    ],
    sectionTotal: 10000,
  },
  totalCogs: 40000,
  grossProfit: 60000,
  grossProfitMargin: 60,
  operatingExpensesSection: {
    name: 'Operating Expenses',
    category: 'Expense',
    lineItems: [
      {
        accountId: 'acc-7',
        accountNumber: '6000',
        accountName: 'Operating Expenses',
        accountCategory: 'Expense',
        currentPeriodAmount: 8000,
        ytdAmount: 30000,
      },
    ],
    sectionTotal: 8000,
  },
  totalOperatingExpenses: 30000,
  operatingIncome: 30000,
  operatingMargin: 30,
  netIncome: 30000,
  netProfitMargin: 30,
};

const mockBalanceSheetResult = {
  reportName: 'Balance Sheet',
  periodName: 'January 2024',
  subsidiaryName: 'All Subsidiaries',
  asOfDate: '2024-01-31',
  currentAssetsSection: {
    name: 'Current Assets',
    category: 'Asset',
    lineItems: [],
    sectionTotal: 75000,
  },
  totalCurrentAssets: 75000,
  nonCurrentAssetsSection: {
    name: 'Non-Current Assets',
    category: 'Asset',
    lineItems: [],
    sectionTotal: 0,
  },
  totalNonCurrentAssets: 0,
  totalAssets: 75000,
  currentLiabilitiesSection: {
    name: 'Current Liabilities',
    category: 'Liability',
    lineItems: [],
    sectionTotal: 15000,
  },
  totalCurrentLiabilities: 15000,
  longTermLiabilitiesSection: {
    name: 'Long-Term Liabilities',
    category: 'Liability',
    lineItems: [],
    sectionTotal: 0,
  },
  totalLongTermLiabilities: 0,
  totalLiabilities: 15000,
  equitySection: {
    name: 'Equity',
    category: 'Equity',
    lineItems: [],
    sectionTotal: 30000,
  },
  retainedEarnings: 0,
  currentPeriodNetIncome: 30000,
  totalEquity: 60000,
  totalLiabilitiesAndEquity: 75000,
  balanceCheck: 0,
};

// ============================================
// TEST SUITES
// ============================================

describe('FinancialStatementQueryBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearStatementCache();
  });

  afterEach(() => {
    clearStatementCache();
  });

  describe('Factory Function', () => {
    it('should create a builder instance', () => {
      const builder = createStatementQueryBuilder('org-123');
      expect(builder).toBeInstanceOf(FinancialStatementQueryBuilder);
    });
  });

  describe('Fluent API', () => {
    it('should support method chaining', () => {
      const builder = new FinancialStatementQueryBuilder('org-123')
        .forPeriod('period-1')
        .withSubsidiary('sub-1')
        .withSegments({ classId: 'cls-1', departmentId: 'dept-1' })
        .withLocation('loc-1')
        .withInactiveAccounts(true)
        .compareTo('period-0')
        .withAdditionalPeriods(['period-2', 'period-3'])
        .useCache(false)
        .withCacheTtl(60000);

      expect(builder).toBeInstanceOf(FinancialStatementQueryBuilder);
    });

    it('should throw error if period not set', async () => {
      const builder = new FinancialStatementQueryBuilder('org-123');

      await expect(builder.getTrialBalance()).rejects.toThrow(
        'Period ID is required'
      );
    });
  });

  describe('Trial Balance', () => {
    it('should fetch and categorize trial balance', async () => {
      vi.mocked(glReportingRepository.getTrialBalance).mockResolvedValue(
        mockTrialBalanceResult
      );

      const builder = new FinancialStatementQueryBuilder('org-123')
        .forPeriod('period-2024-01')
        .useCache(false);

      const result = await builder.getTrialBalance();

      expect(result.periodName).toBe('January 2024');
      expect(result.subsidiaryName).toBe('All Subsidiaries');
      expect(result.asOfDate).toBe('2024-01-31');

      // Check categorization
      expect(result.assetAccounts).toHaveLength(2);
      expect(result.liabilityAccounts).toHaveLength(1);
      expect(result.equityAccounts).toHaveLength(1);
      expect(result.revenueAccounts).toHaveLength(1);
      expect(result.cogsAccounts).toHaveLength(1);
      expect(result.expenseAccounts).toHaveLength(1);

      // Check totals
      expect(result.totals.totalDebits).toBe(145000);
      expect(result.totals.totalCredits).toBe(145000);
      expect(result.totals.difference).toBe(0);

      // Verify category totals
      expect(result.categoryTotals.assets.debit).toBe(75000);
      expect(result.categoryTotals.liabilities.credit).toBe(15000);
      expect(result.categoryTotals.revenue.credit).toBe(100000);
    });

    it('should apply segment filters correctly', async () => {
      vi.mocked(glReportingRepository.getTrialBalance).mockResolvedValue(
        mockTrialBalanceResult
      );

      const builder = new FinancialStatementQueryBuilder('org-123')
        .forPeriod('period-2024-01')
        .withSubsidiary('sub-001')
        .withSegments({
          classId: 'cls-001',
          departmentId: 'dept-001',
          locationId: 'loc-001',
        });

      await builder.getTrialBalance();

      expect(glReportingRepository.getTrialBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          periodId: 'period-2024-01',
          subsidiaryId: 'sub-001',
          classId: 'cls-001',
          departmentId: 'dept-001',
          locationId: 'loc-001',
        }),
        'org-123'
      );
    });

    it('should determine normal balance correctly', async () => {
      vi.mocked(glReportingRepository.getTrialBalance).mockResolvedValue(
        mockTrialBalanceResult
      );

      const builder = new FinancialStatementQueryBuilder('org-123')
        .forPeriod('period-2024-01')
        .useCache(false);

      const result = await builder.getTrialBalance();

      // Assets should have DEBIT normal balance
      expect(result.assetAccounts[0].normalBalance).toBe('DEBIT');

      // Liabilities should have CREDIT normal balance
      expect(result.liabilityAccounts[0].normalBalance).toBe('CREDIT');

      // Revenue should have CREDIT normal balance
      expect(result.revenueAccounts[0].normalBalance).toBe('CREDIT');

      // Expenses should have DEBIT normal balance
      expect(result.expenseAccounts[0].normalBalance).toBe('DEBIT');
    });
  });

  describe('Multi-Period Trial Balance', () => {
    it('should fetch trial balance for multiple periods', async () => {
      const period1Result = { ...mockTrialBalanceResult, periodName: 'January 2024' };
      const period2Result = {
        ...mockTrialBalanceResult,
        periodName: 'February 2024',
        entries: mockTrialBalanceResult.entries.map((e) => ({
          ...e,
          debitBalance: e.debitBalance * 1.1,
          creditBalance: e.creditBalance * 1.1,
          netBalance: e.netBalance * 1.1,
        })),
      };

      vi.mocked(glReportingRepository.getTrialBalance)
        .mockResolvedValueOnce(period1Result)
        .mockResolvedValueOnce(period2Result);

      const builder = new FinancialStatementQueryBuilder('org-123')
        .forPeriod('period-2024-01')
        .withAdditionalPeriods(['period-2024-02'])
        .useCache(false);

      const result = await builder.getMultiPeriodTrialBalance();

      expect(result.periods).toHaveLength(2);
      expect(result.periods[0].periodName).toBe('January 2024');
      expect(result.periods[1].periodName).toBe('February 2024');
      expect(result.periodComparison).not.toBeNull();
    });

    it('should calculate period comparison', async () => {
      const period1Result = { ...mockTrialBalanceResult };
      const period2Result = {
        ...mockTrialBalanceResult,
        entries: mockTrialBalanceResult.entries.map((e) => ({
          ...e,
          debitBalance: e.debitBalance + 1000,
          creditBalance: e.creditBalance + 500,
          netBalance: e.netBalance + 500,
        })),
      };

      vi.mocked(glReportingRepository.getTrialBalance)
        .mockResolvedValueOnce(period1Result)
        .mockResolvedValueOnce(period2Result);

      const builder = new FinancialStatementQueryBuilder('org-123')
        .forPeriod('period-1')
        .withAdditionalPeriods(['period-2'])
        .useCache(false);

      const result = await builder.getMultiPeriodTrialBalance();

      expect(result.periodComparison).not.toBeNull();
      expect(result.periodComparison!.periodIds).toEqual(['period-1', 'period-2']);
    });
  });

  describe('Income Statement', () => {
    it('should fetch income statement', async () => {
      vi.mocked(glReportingRepository.getIncomeStatement).mockResolvedValue(
        mockIncomeStatementResult
      );

      const builder = new FinancialStatementQueryBuilder('org-123')
        .forPeriod('period-2024-01')
        .useCache(false);

      const result = await builder.getIncomeStatement();

      expect(result.reportName).toBe('Income Statement');
      expect(result.totalRevenue).toBe(100000);
      expect(result.totalCogs).toBe(40000);
      expect(result.grossProfit).toBe(60000);
      expect(result.netIncome).toBe(30000);
    });

    it('should include comparison period when specified', async () => {
      vi.mocked(glReportingRepository.getIncomeStatement).mockResolvedValue(
        mockIncomeStatementResult
      );

      const builder = new FinancialStatementQueryBuilder('org-123')
        .forPeriod('period-2024-01')
        .compareTo('period-2023-12')
        .useCache(false);

      await builder.getIncomeStatement();

      expect(glReportingRepository.getIncomeStatement).toHaveBeenCalledWith(
        expect.objectContaining({
          periodId: 'period-2024-01',
          comparePeriodId: 'period-2023-12',
        }),
        'org-123'
      );
    });
  });

  describe('Multi-Period Income Statement', () => {
    it('should calculate trend analysis', async () => {
      const period1 = { ...mockIncomeStatementResult, periodName: 'Jan 2024' };
      const period2 = {
        ...mockIncomeStatementResult,
        periodName: 'Feb 2024',
        totalRevenue: 120000,
        grossProfitMargin: 62,
        netIncome: 36000,
      };

      vi.mocked(glReportingRepository.getIncomeStatement)
        .mockResolvedValueOnce(period1)
        .mockResolvedValueOnce(period2);

      const builder = new FinancialStatementQueryBuilder('org-123')
        .forPeriod('period-1')
        .withAdditionalPeriods(['period-2'])
        .useCache(false);

      const result = await builder.getMultiPeriodIncomeStatement();

      expect(result.periods).toHaveLength(2);
      expect(result.trendAnalysis).not.toBeNull();
      expect(result.trendAnalysis!.revenueGrowth).toHaveLength(1);
      expect(result.trendAnalysis!.revenueGrowth[0]).toBe(20); // 20% growth
      expect(result.trendAnalysis!.grossProfitMarginTrend).toEqual([60, 62]);
    });
  });

  describe('Balance Sheet', () => {
    it('should fetch balance sheet', async () => {
      vi.mocked(glReportingRepository.getBalanceSheet).mockResolvedValue(
        mockBalanceSheetResult
      );

      const builder = new FinancialStatementQueryBuilder('org-123')
        .forPeriod('period-2024-01')
        .useCache(false);

      const result = await builder.getBalanceSheet();

      expect(result.reportName).toBe('Balance Sheet');
      expect(result.totalAssets).toBe(75000);
      expect(result.totalLiabilities).toBe(15000);
      expect(result.totalEquity).toBe(60000);
      expect(result.balanceCheck).toBe(0);
    });
  });

  describe('Multi-Period Balance Sheet', () => {
    it('should calculate asset growth', async () => {
      const period1 = { ...mockBalanceSheetResult };
      const period2 = {
        ...mockBalanceSheetResult,
        totalAssets: 82500,
        totalLiabilities: 16500,
        totalEquity: 66000,
      };

      vi.mocked(glReportingRepository.getBalanceSheet)
        .mockResolvedValueOnce(period1)
        .mockResolvedValueOnce(period2);

      const builder = new FinancialStatementQueryBuilder('org-123')
        .forPeriod('period-1')
        .withAdditionalPeriods(['period-2'])
        .useCache(false);

      const result = await builder.getMultiPeriodBalanceSheet();

      expect(result.periods).toHaveLength(2);
      expect(result.trendAnalysis).not.toBeNull();
      expect(result.trendAnalysis!.assetGrowth).toHaveLength(1);
      expect(result.trendAnalysis!.assetGrowth[0]).toBe(10); // 10% growth
    });
  });

  describe('Caching', () => {
    it('should cache trial balance results', async () => {
      vi.mocked(glReportingRepository.getTrialBalance).mockResolvedValue(
        mockTrialBalanceResult
      );

      const builder = new FinancialStatementQueryBuilder('org-123')
        .forPeriod('period-2024-01')
        .useCache(true);

      // First call
      await builder.getTrialBalance();
      expect(glReportingRepository.getTrialBalance).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await builder.getTrialBalance();
      expect(glReportingRepository.getTrialBalance).toHaveBeenCalledTimes(1);
    });

    it('should not cache when disabled', async () => {
      vi.mocked(glReportingRepository.getTrialBalance).mockResolvedValue(
        mockTrialBalanceResult
      );

      const builder = new FinancialStatementQueryBuilder('org-123')
        .forPeriod('period-2024-01')
        .useCache(false);

      await builder.getTrialBalance();
      await builder.getTrialBalance();

      expect(glReportingRepository.getTrialBalance).toHaveBeenCalledTimes(2);
    });

    it('should invalidate cache for organization', async () => {
      vi.mocked(glReportingRepository.getTrialBalance).mockResolvedValue(
        mockTrialBalanceResult
      );

      const builder = new FinancialStatementQueryBuilder('org-123')
        .forPeriod('period-2024-01')
        .useCache(true);

      await builder.getTrialBalance();
      expect(glReportingRepository.getTrialBalance).toHaveBeenCalledTimes(1);

      // Invalidate
      invalidateStatementCache('org-123');

      // Should call repository again
      await builder.getTrialBalance();
      expect(glReportingRepository.getTrialBalance).toHaveBeenCalledTimes(2);
    });

    it('should invalidate specific report type', async () => {
      vi.mocked(glReportingRepository.getTrialBalance).mockResolvedValue(
        mockTrialBalanceResult
      );
      vi.mocked(glReportingRepository.getIncomeStatement).mockResolvedValue(
        mockIncomeStatementResult
      );

      const builder = new FinancialStatementQueryBuilder('org-123')
        .forPeriod('period-2024-01')
        .useCache(true);

      await builder.getTrialBalance();
      await builder.getIncomeStatement();

      // Invalidate only trial balance
      invalidateReportTypeCache('trial_balance', 'org-123');

      // Trial balance should be fetched again
      await builder.getTrialBalance();
      expect(glReportingRepository.getTrialBalance).toHaveBeenCalledTimes(2);

      // Income statement should still be cached
      await builder.getIncomeStatement();
      expect(glReportingRepository.getIncomeStatement).toHaveBeenCalledTimes(1);
    });

    it('should track cache statistics', async () => {
      vi.mocked(glReportingRepository.getTrialBalance).mockResolvedValue(
        mockTrialBalanceResult
      );

      const builder = new FinancialStatementQueryBuilder('org-123')
        .forPeriod('period-2024-01')
        .useCache(true);

      await builder.getTrialBalance();

      const stats = getStatementCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.entries).toHaveLength(1);
      expect(stats.entries[0].expiresIn).toBeGreaterThan(0);
    });

    it('should use different cache keys for different filters', async () => {
      vi.mocked(glReportingRepository.getTrialBalance).mockResolvedValue(
        mockTrialBalanceResult
      );

      const builder1 = new FinancialStatementQueryBuilder('org-123')
        .forPeriod('period-2024-01')
        .withSubsidiary('sub-001')
        .useCache(true);

      const builder2 = new FinancialStatementQueryBuilder('org-123')
        .forPeriod('period-2024-01')
        .withSubsidiary('sub-002')
        .useCache(true);

      await builder1.getTrialBalance();
      await builder2.getTrialBalance();

      // Both should call the repository (different cache keys)
      expect(glReportingRepository.getTrialBalance).toHaveBeenCalledTimes(2);

      const stats = getStatementCacheStats();
      expect(stats.size).toBe(2);
    });
  });

  describe('Growth Rate Calculation', () => {
    it('should handle zero values in growth calculation', async () => {
      const period1 = { ...mockIncomeStatementResult, totalRevenue: 0 };
      const period2 = { ...mockIncomeStatementResult, totalRevenue: 100000 };

      vi.mocked(glReportingRepository.getIncomeStatement)
        .mockResolvedValueOnce(period1)
        .mockResolvedValueOnce(period2);

      const builder = new FinancialStatementQueryBuilder('org-123')
        .forPeriod('period-1')
        .withAdditionalPeriods(['period-2'])
        .useCache(false);

      const result = await builder.getMultiPeriodIncomeStatement();

      expect(result.trendAnalysis!.revenueGrowth[0]).toBe(Infinity);
    });

    it('should handle zero to zero growth', async () => {
      const period1 = { ...mockIncomeStatementResult, totalRevenue: 0, netIncome: 0 };
      const period2 = { ...mockIncomeStatementResult, totalRevenue: 0, netIncome: 0 };

      vi.mocked(glReportingRepository.getIncomeStatement)
        .mockResolvedValueOnce(period1)
        .mockResolvedValueOnce(period2);

      const builder = new FinancialStatementQueryBuilder('org-123')
        .forPeriod('period-1')
        .withAdditionalPeriods(['period-2'])
        .useCache(false);

      const result = await builder.getMultiPeriodIncomeStatement();

      expect(result.trendAnalysis!.revenueGrowth[0]).toBe(0);
    });
  });
});
