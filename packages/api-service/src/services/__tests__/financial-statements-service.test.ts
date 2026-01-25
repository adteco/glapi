import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceContext } from '../../types';

// Use vi.hoisted() to properly hoist mock functions for use in vi.mock factory
const {
  mockGetIncomeStatement,
  mockGetBalanceSheet,
  mockGetCashFlowStatement,
  mockGetTrialBalance,
} = vi.hoisted(() => ({
  mockGetIncomeStatement: vi.fn(),
  mockGetBalanceSheet: vi.fn(),
  mockGetCashFlowStatement: vi.fn(),
  mockGetTrialBalance: vi.fn(),
}));

// Mock the database module
vi.mock('@glapi/database', () => ({
  glReportingRepository: {
    getIncomeStatement: mockGetIncomeStatement,
    getBalanceSheet: mockGetBalanceSheet,
    getCashFlowStatement: mockGetCashFlowStatement,
    getTrialBalance: mockGetTrialBalance,
  },
}));

// Import after mocking
import { FinancialStatementsService } from '../financial-statements-service';
import { ServiceError } from '../../types';
import type {
  IncomeStatement,
  BalanceSheet,
  CashFlowStatement,
  FinancialStatementSection,
} from '../../types/financial-statements.types';

describe('FinancialStatementsService', () => {
  let service: FinancialStatementsService;
  let context: ServiceContext;

  const testOrgId = 'org-123';
  const testUserId = 'user-123';
  const testPeriodId = 'period-123';
  const testSubsidiaryId = 'sub-123';

  // Mock data factories
  const createMockSection = (name: string, category: string, amount: number): FinancialStatementSection => ({
    name,
    category: category as any,
    lineItems: [
      {
        accountId: 'acc-1',
        accountNumber: '1000',
        accountName: `Test ${name} Account`,
        accountCategory: category as any,
        currentPeriodAmount: amount,
        ytdAmount: amount * 12,
      },
    ],
    sectionTotal: amount,
  });

  const mockIncomeStatement: IncomeStatement = {
    reportName: 'Income Statement',
    periodName: 'January 2024',
    subsidiaryName: 'Main Company',
    asOfDate: '2024-01-31',
    revenueSection: createMockSection('Revenue', 'Revenue', 100000),
    totalRevenue: 100000,
    cogsSection: createMockSection('Cost of Goods Sold', 'COGS', 40000),
    totalCogs: 40000,
    grossProfit: 60000,
    grossProfitMargin: 60,
    operatingExpensesSection: createMockSection('Operating Expenses', 'Expense', 30000),
    totalOperatingExpenses: 30000,
    operatingIncome: 30000,
    operatingMargin: 30,
    netIncome: 25000,
    netProfitMargin: 25,
  };

  const mockBalanceSheet: BalanceSheet = {
    reportName: 'Balance Sheet',
    periodName: 'January 2024',
    subsidiaryName: 'Main Company',
    asOfDate: '2024-01-31',
    currentAssetsSection: createMockSection('Current Assets', 'Asset', 150000),
    totalCurrentAssets: 150000,
    nonCurrentAssetsSection: createMockSection('Non-Current Assets', 'Asset', 350000),
    totalNonCurrentAssets: 350000,
    totalAssets: 500000,
    currentLiabilitiesSection: createMockSection('Current Liabilities', 'Liability', 75000),
    totalCurrentLiabilities: 75000,
    longTermLiabilitiesSection: createMockSection('Long-Term Liabilities', 'Liability', 125000),
    totalLongTermLiabilities: 125000,
    totalLiabilities: 200000,
    equitySection: createMockSection('Equity', 'Equity', 275000),
    retainedEarnings: 250000,
    currentPeriodNetIncome: 25000,
    totalEquity: 300000,
    totalLiabilitiesAndEquity: 500000,
    balanceCheck: 0,
  };

  const mockCashFlowStatement: CashFlowStatement = {
    reportName: 'Statement of Cash Flows',
    reportType: 'CASH_FLOW_STATEMENT',
    periodName: 'January 2024',
    periodId: testPeriodId,
    subsidiaryName: 'Main Company',
    periodStartDate: '2024-01-01',
    periodEndDate: '2024-01-31',
    generatedAt: '2024-01-31T12:00:00Z',
    beginningCashBalance: 50000,
    operatingActivities: {
      sectionName: 'Operating Activities',
      category: 'OPERATING',
      lineItems: [
        { description: 'Net Income', amount: 25000, isSubtotal: false },
        { description: 'Depreciation', amount: 5000, isSubtotal: false },
      ],
      sectionTotal: 30000,
    },
    netCashFromOperations: 30000,
    investingActivities: {
      sectionName: 'Investing Activities',
      category: 'INVESTING',
      lineItems: [
        { description: 'Equipment Purchase', amount: -15000, isSubtotal: false },
      ],
      sectionTotal: -15000,
    },
    netCashFromInvesting: -15000,
    financingActivities: {
      sectionName: 'Financing Activities',
      category: 'FINANCING',
      lineItems: [
        { description: 'Loan Repayment', amount: -5000, isSubtotal: false },
      ],
      sectionTotal: -5000,
    },
    netCashFromFinancing: -5000,
    netChangeInCash: 10000,
    endingCashBalance: 60000,
    cashFlowTrend: 'POSITIVE',
    reconciliationDifference: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    context = {
      organizationId: testOrgId,
      userId: testUserId,
    };
    service = new FinancialStatementsService(context);
  });

  // ============================================
  // Context Validation Tests
  // ============================================

  describe('Organization Context Validation', () => {
    it('should throw error when organization context is missing', async () => {
      service = new FinancialStatementsService({});

      await expect(
        service.generateIncomeStatement({
          organizationId: testOrgId,
          periodId: testPeriodId,
        })
      ).rejects.toThrow('Organization context is required');
    });

    it('should throw error when organization ID does not match context', async () => {
      await expect(
        service.generateIncomeStatement({
          organizationId: 'different-org',
          periodId: testPeriodId,
        })
      ).rejects.toThrow('Organization mismatch');
    });

    it('should return 403 status code for organization mismatch', async () => {
      try {
        await service.generateIncomeStatement({
          organizationId: 'different-org',
          periodId: testPeriodId,
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as ServiceError).statusCode).toBe(403);
        expect((error as ServiceError).code).toBe('ORGANIZATION_MISMATCH');
      }
    });
  });

  // ============================================
  // Income Statement Tests
  // ============================================

  describe('generateIncomeStatement', () => {
    beforeEach(() => {
      mockGetIncomeStatement.mockResolvedValue(mockIncomeStatement);
    });

    it('should generate income statement with basic filters', async () => {
      const result = await service.generateIncomeStatement({
        organizationId: testOrgId,
        periodId: testPeriodId,
      });

      expect(result).toEqual(mockIncomeStatement);
      expect(mockGetIncomeStatement).toHaveBeenCalledWith(
        {
          periodId: testPeriodId,
          subsidiaryId: undefined,
          classId: undefined,
          departmentId: undefined,
          locationId: undefined,
          includeInactive: undefined,
          comparePeriodId: undefined,
        },
        testOrgId
      );
    });

    it('should generate income statement with all filters', async () => {
      const input = {
        organizationId: testOrgId,
        periodId: testPeriodId,
        subsidiaryId: testSubsidiaryId,
        classId: 'class-1',
        departmentId: 'dept-1',
        locationId: 'loc-1',
        includeInactive: true,
        comparePeriodId: 'period-prev',
      };

      await service.generateIncomeStatement(input);

      expect(mockGetIncomeStatement).toHaveBeenCalledWith(
        {
          periodId: testPeriodId,
          subsidiaryId: testSubsidiaryId,
          classId: 'class-1',
          departmentId: 'dept-1',
          locationId: 'loc-1',
          includeInactive: true,
          comparePeriodId: 'period-prev',
        },
        testOrgId
      );
    });

    it('should return income statement with correct structure', async () => {
      const result = await service.generateIncomeStatement({
        organizationId: testOrgId,
        periodId: testPeriodId,
      });

      expect(result.reportName).toBe('Income Statement');
      expect(result.totalRevenue).toBe(100000);
      expect(result.totalCogs).toBe(40000);
      expect(result.grossProfit).toBe(60000);
      expect(result.grossProfitMargin).toBe(60);
      expect(result.netIncome).toBe(25000);
      expect(result.netProfitMargin).toBe(25);
    });

    it('should include revenue section with line items', async () => {
      const result = await service.generateIncomeStatement({
        organizationId: testOrgId,
        periodId: testPeriodId,
      });

      expect(result.revenueSection).toBeDefined();
      expect(result.revenueSection.lineItems.length).toBeGreaterThan(0);
      expect(result.revenueSection.sectionTotal).toBe(100000);
    });

    it('should handle repository errors gracefully', async () => {
      mockGetIncomeStatement.mockRejectedValue(new Error('Database error'));

      await expect(
        service.generateIncomeStatement({
          organizationId: testOrgId,
          periodId: testPeriodId,
        })
      ).rejects.toThrow('Database error');
    });
  });

  // ============================================
  // Balance Sheet Tests
  // ============================================

  describe('generateBalanceSheet', () => {
    beforeEach(() => {
      mockGetBalanceSheet.mockResolvedValue(mockBalanceSheet);
    });

    it('should generate balance sheet with basic filters', async () => {
      const result = await service.generateBalanceSheet({
        organizationId: testOrgId,
        periodId: testPeriodId,
      });

      expect(result).toEqual(mockBalanceSheet);
      expect(mockGetBalanceSheet).toHaveBeenCalledWith(
        {
          periodId: testPeriodId,
          subsidiaryId: undefined,
          classId: undefined,
          departmentId: undefined,
          locationId: undefined,
          includeInactive: undefined,
          comparePeriodId: undefined,
        },
        testOrgId
      );
    });

    it('should generate balance sheet with subsidiary filter', async () => {
      await service.generateBalanceSheet({
        organizationId: testOrgId,
        periodId: testPeriodId,
        subsidiaryId: testSubsidiaryId,
      });

      expect(mockGetBalanceSheet).toHaveBeenCalledWith(
        expect.objectContaining({
          subsidiaryId: testSubsidiaryId,
        }),
        testOrgId
      );
    });

    it('should return balance sheet with correct structure', async () => {
      const result = await service.generateBalanceSheet({
        organizationId: testOrgId,
        periodId: testPeriodId,
      });

      expect(result.reportName).toBe('Balance Sheet');
      expect(result.totalAssets).toBe(500000);
      expect(result.totalLiabilities).toBe(200000);
      expect(result.totalEquity).toBe(300000);
      expect(result.balanceCheck).toBe(0);
    });

    it('should verify accounting equation (Assets = Liabilities + Equity)', async () => {
      const result = await service.generateBalanceSheet({
        organizationId: testOrgId,
        periodId: testPeriodId,
      });

      expect(result.totalAssets).toBe(result.totalLiabilitiesAndEquity);
      expect(result.balanceCheck).toBe(0);
    });

    it('should include current and non-current assets', async () => {
      const result = await service.generateBalanceSheet({
        organizationId: testOrgId,
        periodId: testPeriodId,
      });

      expect(result.currentAssetsSection).toBeDefined();
      expect(result.nonCurrentAssetsSection).toBeDefined();
      expect(result.totalCurrentAssets + result.totalNonCurrentAssets).toBe(result.totalAssets);
    });

    it('should include current and long-term liabilities', async () => {
      const result = await service.generateBalanceSheet({
        organizationId: testOrgId,
        periodId: testPeriodId,
      });

      expect(result.currentLiabilitiesSection).toBeDefined();
      expect(result.longTermLiabilitiesSection).toBeDefined();
      expect(result.totalCurrentLiabilities + result.totalLongTermLiabilities).toBe(result.totalLiabilities);
    });

    it('should throw error for organization mismatch', async () => {
      await expect(
        service.generateBalanceSheet({
          organizationId: 'wrong-org',
          periodId: testPeriodId,
        })
      ).rejects.toThrow('Organization mismatch');
    });
  });

  // ============================================
  // Cash Flow Statement Tests
  // ============================================

  describe('generateCashFlowStatement', () => {
    beforeEach(() => {
      mockGetCashFlowStatement.mockResolvedValue(mockCashFlowStatement);
    });

    it('should generate cash flow statement with basic filters', async () => {
      const result = await service.generateCashFlowStatement({
        organizationId: testOrgId,
        periodId: testPeriodId,
      });

      expect(result).toEqual(mockCashFlowStatement);
      expect(mockGetCashFlowStatement).toHaveBeenCalledWith(
        {
          periodId: testPeriodId,
          subsidiaryId: undefined,
          classId: undefined,
          departmentId: undefined,
          locationId: undefined,
          includeInactive: undefined,
          comparePeriodId: undefined,
        },
        testOrgId
      );
    });

    it('should generate cash flow statement with all filters', async () => {
      const input = {
        organizationId: testOrgId,
        periodId: testPeriodId,
        subsidiaryId: testSubsidiaryId,
        classId: 'class-1',
        departmentId: 'dept-1',
        locationId: 'loc-1',
        includeInactive: true,
        comparePeriodId: 'period-prev',
      };

      await service.generateCashFlowStatement(input);

      expect(mockGetCashFlowStatement).toHaveBeenCalledWith(
        {
          periodId: testPeriodId,
          subsidiaryId: testSubsidiaryId,
          classId: 'class-1',
          departmentId: 'dept-1',
          locationId: 'loc-1',
          includeInactive: true,
          comparePeriodId: 'period-prev',
        },
        testOrgId
      );
    });

    it('should return cash flow statement with correct structure', async () => {
      const result = await service.generateCashFlowStatement({
        organizationId: testOrgId,
        periodId: testPeriodId,
      });

      expect(result.reportName).toBe('Statement of Cash Flows');
      expect(result.reportType).toBe('CASH_FLOW_STATEMENT');
      expect(result.beginningCashBalance).toBe(50000);
      expect(result.endingCashBalance).toBe(60000);
      expect(result.netChangeInCash).toBe(10000);
    });

    it('should verify cash flow reconciliation', async () => {
      const result = await service.generateCashFlowStatement({
        organizationId: testOrgId,
        periodId: testPeriodId,
      });

      const calculatedChange =
        result.netCashFromOperations +
        result.netCashFromInvesting +
        result.netCashFromFinancing;

      expect(result.netChangeInCash).toBe(calculatedChange);
      expect(result.endingCashBalance).toBe(result.beginningCashBalance + result.netChangeInCash);
    });

    it('should include all three activity sections', async () => {
      const result = await service.generateCashFlowStatement({
        organizationId: testOrgId,
        periodId: testPeriodId,
      });

      expect(result.operatingActivities).toBeDefined();
      expect(result.operatingActivities.category).toBe('OPERATING');
      expect(result.investingActivities).toBeDefined();
      expect(result.investingActivities.category).toBe('INVESTING');
      expect(result.financingActivities).toBeDefined();
      expect(result.financingActivities.category).toBe('FINANCING');
    });

    it('should include cash flow trend indicator', async () => {
      const result = await service.generateCashFlowStatement({
        organizationId: testOrgId,
        periodId: testPeriodId,
      });

      expect(result.cashFlowTrend).toBe('POSITIVE');
      expect(['POSITIVE', 'NEGATIVE', 'NEUTRAL']).toContain(result.cashFlowTrend);
    });

    it('should throw error for organization mismatch', async () => {
      await expect(
        service.generateCashFlowStatement({
          organizationId: 'wrong-org',
          periodId: testPeriodId,
        })
      ).rejects.toThrow('Organization mismatch');
    });
  });

  // ============================================
  // Trial Balance Tests
  // ============================================

  describe('generateTrialBalance', () => {
    const mockTrialBalance = {
      periodName: 'January 2024',
      subsidiaryName: 'Main Company',
      asOfDate: '2024-01-31',
      entries: [
        { accountNumber: '1000', accountName: 'Cash', debit: 50000, credit: 0 },
        { accountNumber: '2000', accountName: 'AP', debit: 0, credit: 25000 },
      ],
      totalDebits: 50000,
      totalCredits: 50000,
      difference: 0,
    };

    beforeEach(() => {
      mockGetTrialBalance.mockResolvedValue(mockTrialBalance);
    });

    it('should generate trial balance with basic filters', async () => {
      const result = await service.generateTrialBalance({
        organizationId: testOrgId,
        periodId: testPeriodId,
      });

      expect(result).toEqual(mockTrialBalance);
      expect(mockGetTrialBalance).toHaveBeenCalledWith(
        {
          periodId: testPeriodId,
          subsidiaryId: undefined,
          classId: undefined,
          departmentId: undefined,
          locationId: undefined,
          includeInactive: undefined,
        },
        testOrgId
      );
    });

    it('should throw error for organization mismatch', async () => {
      await expect(
        service.generateTrialBalance({
          organizationId: 'wrong-org',
          periodId: testPeriodId,
        })
      ).rejects.toThrow('Organization mismatch');
    });
  });

  // ============================================
  // Report Metadata Tests
  // ============================================

  describe('generateReportMetadata', () => {
    it('should generate metadata for income statement', () => {
      const metadata = service.generateReportMetadata(
        'INCOME_STATEMENT',
        testPeriodId
      );

      expect(metadata.reportType).toBe('INCOME_STATEMENT');
      expect(metadata.periodId).toBe(testPeriodId);
      expect(metadata.organizationId).toBe(testOrgId);
      expect(metadata.generatedBy).toBe(testUserId);
      expect(metadata.reportId).toBeDefined();
      expect(metadata.generatedAt).toBeDefined();
    });

    it('should generate metadata for balance sheet', () => {
      const metadata = service.generateReportMetadata(
        'BALANCE_SHEET',
        testPeriodId,
        testSubsidiaryId
      );

      expect(metadata.reportType).toBe('BALANCE_SHEET');
      expect(metadata.subsidiaryId).toBe(testSubsidiaryId);
    });

    it('should generate metadata for cash flow statement', () => {
      const metadata = service.generateReportMetadata(
        'CASH_FLOW',
        testPeriodId
      );

      expect(metadata.reportType).toBe('CASH_FLOW');
    });

    it('should generate metadata for trial balance', () => {
      const metadata = service.generateReportMetadata(
        'TRIAL_BALANCE',
        testPeriodId
      );

      expect(metadata.reportType).toBe('TRIAL_BALANCE');
    });

    it('should include filters in metadata', () => {
      const filters = { includeInactive: true, classId: 'class-1' };
      const metadata = service.generateReportMetadata(
        'INCOME_STATEMENT',
        testPeriodId,
        undefined,
        filters
      );

      expect(metadata.filters).toEqual(filters);
    });

    it('should generate unique report IDs', () => {
      const metadata1 = service.generateReportMetadata('INCOME_STATEMENT', testPeriodId);
      const metadata2 = service.generateReportMetadata('INCOME_STATEMENT', testPeriodId);

      expect(metadata1.reportId).not.toBe(metadata2.reportId);
    });

    it('should use system as generatedBy when userId is not in context', () => {
      service = new FinancialStatementsService({ organizationId: testOrgId });
      const metadata = service.generateReportMetadata('INCOME_STATEMENT', testPeriodId);

      expect(metadata.generatedBy).toBe('system');
    });
  });

  // ============================================
  // Export Report Tests
  // ============================================

  describe('exportReport', () => {
    it('should export income statement as JSON', async () => {
      const result = await service.exportReport(
        'INCOME_STATEMENT',
        mockIncomeStatement,
        { format: 'json' }
      );

      expect(result.contentType).toBe('application/json');
      expect(result.filename).toContain('income_statement');
      expect(result.filename).toContain('.json');
      expect(result.buffer).toBeDefined();
    });

    it('should export balance sheet as JSON', async () => {
      const result = await service.exportReport(
        'BALANCE_SHEET',
        mockBalanceSheet,
        { format: 'json' }
      );

      expect(result.contentType).toBe('application/json');
      expect(result.filename).toContain('balance_sheet');
      expect(result.filename).toContain('.json');
    });

    it('should export income statement as CSV', async () => {
      const result = await service.exportReport(
        'INCOME_STATEMENT',
        mockIncomeStatement,
        { format: 'csv' }
      );

      expect(result.contentType).toBe('text/csv');
      expect(result.filename).toContain('.csv');

      const csvContent = result.buffer.toString('utf-8');
      expect(csvContent).toContain('Income Statement');
      expect(csvContent).toContain('REVENUE');
      expect(csvContent).toContain('Total Revenue');
    });

    it('should export balance sheet as CSV', async () => {
      const result = await service.exportReport(
        'BALANCE_SHEET',
        mockBalanceSheet,
        { format: 'csv' }
      );

      expect(result.contentType).toBe('text/csv');
      const csvContent = result.buffer.toString('utf-8');
      expect(csvContent).toContain('Balance Sheet');
      expect(csvContent).toContain('ASSETS');
      expect(csvContent).toContain('LIABILITIES');
      expect(csvContent).toContain('EQUITY');
    });

    it('should include date in filename', async () => {
      const result = await service.exportReport(
        'INCOME_STATEMENT',
        mockIncomeStatement,
        { format: 'json' }
      );

      const today = new Date().toISOString().split('T')[0];
      expect(result.filename).toContain(today);
    });

    it('should throw error for unsupported export format', async () => {
      await expect(
        service.exportReport(
          'INCOME_STATEMENT',
          mockIncomeStatement,
          { format: 'pdf' }
        )
      ).rejects.toThrow('Export format pdf not yet implemented');
    });

    it('should return 501 status code for unimplemented format', async () => {
      try {
        await service.exportReport(
          'INCOME_STATEMENT',
          mockIncomeStatement,
          { format: 'xlsx' }
        );
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as ServiceError).statusCode).toBe(501);
        expect((error as ServiceError).code).toBe('EXPORT_FORMAT_NOT_IMPLEMENTED');
      }
    });
  });

  // ============================================
  // Edge Cases and Error Handling
  // ============================================

  describe('Edge Cases', () => {
    it('should handle empty income statement', async () => {
      const emptyStatement: IncomeStatement = {
        ...mockIncomeStatement,
        revenueSection: { ...mockIncomeStatement.revenueSection, lineItems: [], sectionTotal: 0 },
        totalRevenue: 0,
        totalCogs: 0,
        grossProfit: 0,
        grossProfitMargin: 0,
        totalOperatingExpenses: 0,
        operatingIncome: 0,
        operatingMargin: 0,
        netIncome: 0,
        netProfitMargin: 0,
      };
      mockGetIncomeStatement.mockResolvedValue(emptyStatement);

      const result = await service.generateIncomeStatement({
        organizationId: testOrgId,
        periodId: testPeriodId,
      });

      expect(result.totalRevenue).toBe(0);
      expect(result.netIncome).toBe(0);
    });

    it('should handle balance sheet with imbalance', async () => {
      const imbalancedSheet: BalanceSheet = {
        ...mockBalanceSheet,
        totalAssets: 500000,
        totalLiabilitiesAndEquity: 499000,
        balanceCheck: 1000,
      };
      mockGetBalanceSheet.mockResolvedValue(imbalancedSheet);

      const result = await service.generateBalanceSheet({
        organizationId: testOrgId,
        periodId: testPeriodId,
      });

      expect(result.balanceCheck).not.toBe(0);
    });

    it('should handle negative cash flow', async () => {
      const negativeCashFlow: CashFlowStatement = {
        ...mockCashFlowStatement,
        netCashFromOperations: -10000,
        netCashFromInvesting: -15000,
        netCashFromFinancing: -5000,
        netChangeInCash: -30000,
        endingCashBalance: 20000,
        cashFlowTrend: 'NEGATIVE',
      };
      mockGetCashFlowStatement.mockResolvedValue(negativeCashFlow);

      const result = await service.generateCashFlowStatement({
        organizationId: testOrgId,
        periodId: testPeriodId,
      });

      expect(result.netChangeInCash).toBeLessThan(0);
      expect(result.cashFlowTrend).toBe('NEGATIVE');
    });

    it('should handle null subsidiary name', async () => {
      const statementWithNullSubsidiary: CashFlowStatement = {
        ...mockCashFlowStatement,
        subsidiaryName: null,
      };
      mockGetCashFlowStatement.mockResolvedValue(statementWithNullSubsidiary);

      const result = await service.generateCashFlowStatement({
        organizationId: testOrgId,
        periodId: testPeriodId,
      });

      expect(result.subsidiaryName).toBeNull();
    });
  });

  // ============================================
  // Comparative Period Tests
  // ============================================

  describe('Comparative Periods', () => {
    it('should include prior period data in income statement when requested', async () => {
      const statementWithPrior: IncomeStatement = {
        ...mockIncomeStatement,
        priorPeriod: {
          periodName: 'December 2023',
          totalRevenue: 95000,
          totalCogs: 38000,
          grossProfit: 57000,
          totalOperatingExpenses: 28000,
          operatingIncome: 29000,
          netIncome: 24000,
        },
      };
      mockGetIncomeStatement.mockResolvedValue(statementWithPrior);

      const result = await service.generateIncomeStatement({
        organizationId: testOrgId,
        periodId: testPeriodId,
        comparePeriodId: 'period-prev',
      });

      expect(result.priorPeriod).toBeDefined();
      expect(result.priorPeriod?.periodName).toBe('December 2023');
      expect(result.priorPeriod?.totalRevenue).toBe(95000);
    });

    it('should pass comparePeriodId to repository', async () => {
      mockGetBalanceSheet.mockResolvedValue(mockBalanceSheet);

      await service.generateBalanceSheet({
        organizationId: testOrgId,
        periodId: testPeriodId,
        comparePeriodId: 'period-prev',
      });

      expect(mockGetBalanceSheet).toHaveBeenCalledWith(
        expect.objectContaining({
          comparePeriodId: 'period-prev',
        }),
        testOrgId
      );
    });
  });
});
