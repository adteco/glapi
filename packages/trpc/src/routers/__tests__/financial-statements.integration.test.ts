import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TRPCError } from '@trpc/server';

// Mock the FinancialStatementsService
const {
  mockGenerateBalanceSheet,
  mockGenerateIncomeStatement,
  mockGenerateCashFlowStatement,
  mockGenerateTrialBalance,
  mockExportReport,
  mockGenerateReportMetadata,
} = vi.hoisted(() => ({
  mockGenerateBalanceSheet: vi.fn(),
  mockGenerateIncomeStatement: vi.fn(),
  mockGenerateCashFlowStatement: vi.fn(),
  mockGenerateTrialBalance: vi.fn(),
  mockExportReport: vi.fn(),
  mockGenerateReportMetadata: vi.fn(),
}));

vi.mock('@glapi/api-service', () => ({
  FinancialStatementsService: vi.fn().mockImplementation(() => ({
    generateBalanceSheet: mockGenerateBalanceSheet,
    generateIncomeStatement: mockGenerateIncomeStatement,
    generateCashFlowStatement: mockGenerateCashFlowStatement,
    generateTrialBalance: mockGenerateTrialBalance,
    exportReport: mockExportReport,
    generateReportMetadata: mockGenerateReportMetadata,
  })),
}));

import { financialStatementsRouter } from '../financial-statements';
import { createCallerFactory, router } from '../../trpc';
import type { Context, User, ServiceContext } from '../../context';

// Create a test router with just the financialStatements router
const testAppRouter = router({
  financialStatements: financialStatementsRouter,
});

const createCaller = createCallerFactory(testAppRouter);

describe('Financial Statements TRPC Router Integration', () => {
  const testOrganizationId = '123e4567-e89b-12d3-a456-426614174000';
  const testUserId = '123e4567-e89b-12d3-a456-426614174001';
  const testPeriodId = '123e4567-e89b-12d3-a456-426614174002';
  const testComparePeriodId = '123e4567-e89b-12d3-a456-426614174003';
  const testSubsidiaryId = '123e4567-e89b-12d3-a456-426614174004';

  const createAuthenticatedContext = (): Context => ({
    req: undefined as any,
    res: undefined as any,
    db: {} as any, // Will be replaced by RLS-contextual db in middleware
    user: {
      id: testUserId,
      organizationId: testOrganizationId,
      email: 'test@example.com',
      role: 'user',
    } as User,
    serviceContext: {
      organizationId: testOrganizationId,
      userId: testUserId,
    } as ServiceContext,
  });

  const createUnauthenticatedContext = (): Context => ({
    req: undefined as any,
    res: undefined as any,
    db: {} as any,
    user: null,
    serviceContext: undefined,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should reject unauthenticated requests to balanceSheet', async () => {
      const caller = createCaller(createUnauthenticatedContext());

      await expect(
        caller.financialStatements.balanceSheet({ periodId: testPeriodId })
      ).rejects.toThrow(TRPCError);
    });

    it('should reject unauthenticated requests to incomeStatement', async () => {
      const caller = createCaller(createUnauthenticatedContext());

      await expect(
        caller.financialStatements.incomeStatement({ periodId: testPeriodId })
      ).rejects.toThrow(TRPCError);
    });

    it('should reject unauthenticated requests to cashFlowStatement', async () => {
      const caller = createCaller(createUnauthenticatedContext());

      await expect(
        caller.financialStatements.cashFlowStatement({ periodId: testPeriodId })
      ).rejects.toThrow(TRPCError);
    });

    it('should reject unauthenticated requests to trialBalance', async () => {
      const caller = createCaller(createUnauthenticatedContext());

      await expect(
        caller.financialStatements.trialBalance({ periodId: testPeriodId })
      ).rejects.toThrow(TRPCError);
    });

    it('should reject unauthenticated requests to metadata', async () => {
      const caller = createCaller(createUnauthenticatedContext());

      await expect(
        caller.financialStatements.metadata({
          reportType: 'BALANCE_SHEET',
          periodId: testPeriodId,
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should reject unauthenticated requests to export', async () => {
      const caller = createCaller(createUnauthenticatedContext());

      await expect(
        caller.financialStatements.export({
          reportType: 'BALANCE_SHEET',
          reportData: {},
          format: 'pdf',
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('balanceSheet', () => {
    const mockBalanceSheet = {
      reportDate: new Date().toISOString(),
      periodName: 'Q4 2024',
      assets: {
        currentAssets: {
          items: [
            { accountNumber: '1000', accountName: 'Cash', balance: 50000 },
            { accountNumber: '1100', accountName: 'Accounts Receivable', balance: 30000 },
          ],
          total: 80000,
        },
        nonCurrentAssets: {
          items: [
            { accountNumber: '1500', accountName: 'Equipment', balance: 100000 },
          ],
          total: 100000,
        },
        totalAssets: 180000,
      },
      liabilities: {
        currentLiabilities: {
          items: [
            { accountNumber: '2000', accountName: 'Accounts Payable', balance: 20000 },
          ],
          total: 20000,
        },
        nonCurrentLiabilities: {
          items: [],
          total: 0,
        },
        totalLiabilities: 20000,
      },
      equity: {
        items: [
          { accountNumber: '3000', accountName: 'Retained Earnings', balance: 160000 },
        ],
        total: 160000,
      },
      totalLiabilitiesAndEquity: 180000,
    };

    it('should generate balance sheet with valid input', async () => {
      mockGenerateBalanceSheet.mockResolvedValue(mockBalanceSheet);
      const caller = createCaller(createAuthenticatedContext());

      const result = await caller.financialStatements.balanceSheet({
        periodId: testPeriodId,
      });

      expect(result).toEqual(mockBalanceSheet);
      expect(mockGenerateBalanceSheet).toHaveBeenCalledWith({
        organizationId: testOrganizationId,
        periodId: testPeriodId,
        subsidiaryId: undefined,
        classId: undefined,
        departmentId: undefined,
        locationId: undefined,
        includeInactive: false,
        comparePeriodId: undefined,
      });
    });

    it('should pass dimension filters correctly', async () => {
      mockGenerateBalanceSheet.mockResolvedValue(mockBalanceSheet);
      const caller = createCaller(createAuthenticatedContext());
      const departmentId = '123e4567-e89b-12d3-a456-426614174010';
      const classId = '123e4567-e89b-12d3-a456-426614174011';

      await caller.financialStatements.balanceSheet({
        periodId: testPeriodId,
        comparePeriodId: testComparePeriodId,
        subsidiaryId: testSubsidiaryId,
        departmentIds: [departmentId],
        classIds: [classId],
        includeInactive: true,
        showAccountHierarchy: true,
      });

      expect(mockGenerateBalanceSheet).toHaveBeenCalledWith({
        organizationId: testOrganizationId,
        periodId: testPeriodId,
        comparePeriodId: testComparePeriodId,
        subsidiaryId: testSubsidiaryId,
        departmentId: departmentId,
        classId: classId,
        locationId: undefined,
        includeInactive: true,
      });
    });

    it('should reject invalid periodId format', async () => {
      const caller = createCaller(createAuthenticatedContext());

      await expect(
        caller.financialStatements.balanceSheet({
          periodId: 'not-a-uuid',
        })
      ).rejects.toThrow();
    });
  });

  describe('incomeStatement', () => {
    const mockIncomeStatement = {
      reportDate: new Date().toISOString(),
      periodName: 'Q4 2024',
      revenue: {
        items: [
          { accountNumber: '4000', accountName: 'Sales Revenue', balance: 200000 },
        ],
        total: 200000,
      },
      costOfGoodsSold: {
        items: [
          { accountNumber: '5000', accountName: 'Cost of Goods Sold', balance: 80000 },
        ],
        total: 80000,
      },
      grossProfit: 120000,
      operatingExpenses: {
        items: [
          { accountNumber: '6000', accountName: 'Salaries Expense', balance: 50000 },
          { accountNumber: '6100', accountName: 'Rent Expense', balance: 10000 },
        ],
        total: 60000,
      },
      operatingIncome: 60000,
      otherIncomeExpenses: {
        items: [],
        total: 0,
      },
      netIncome: 60000,
    };

    it('should generate income statement with valid input', async () => {
      mockGenerateIncomeStatement.mockResolvedValue(mockIncomeStatement);
      const caller = createCaller(createAuthenticatedContext());

      const result = await caller.financialStatements.incomeStatement({
        periodId: testPeriodId,
      });

      expect(result).toEqual(mockIncomeStatement);
      expect(mockGenerateIncomeStatement).toHaveBeenCalledWith({
        organizationId: testOrganizationId,
        periodId: testPeriodId,
        subsidiaryId: undefined,
        classId: undefined,
        departmentId: undefined,
        locationId: undefined,
        includeInactive: false,
        comparePeriodId: undefined,
      });
    });

    it('should pass comparison period for year-over-year analysis', async () => {
      mockGenerateIncomeStatement.mockResolvedValue(mockIncomeStatement);
      const caller = createCaller(createAuthenticatedContext());

      await caller.financialStatements.incomeStatement({
        periodId: testPeriodId,
        comparePeriodId: testComparePeriodId,
        includeYTD: true,
      });

      expect(mockGenerateIncomeStatement).toHaveBeenCalledWith(
        expect.objectContaining({
          comparePeriodId: testComparePeriodId,
        })
      );
    });
  });

  describe('cashFlowStatement', () => {
    const mockCashFlowStatement = {
      reportDate: new Date().toISOString(),
      periodName: 'Q4 2024',
      operatingActivities: {
        netIncome: 60000,
        adjustments: [
          { description: 'Depreciation', amount: 5000 },
          { description: 'Increase in AR', amount: -10000 },
        ],
        total: 55000,
      },
      investingActivities: {
        items: [
          { description: 'Purchase of Equipment', amount: -20000 },
        ],
        total: -20000,
      },
      financingActivities: {
        items: [
          { description: 'Loan Proceeds', amount: 50000 },
        ],
        total: 50000,
      },
      netCashChange: 85000,
      beginningCash: 15000,
      endingCash: 100000,
    };

    it('should generate cash flow statement with valid input', async () => {
      mockGenerateCashFlowStatement.mockResolvedValue(mockCashFlowStatement);
      const caller = createCaller(createAuthenticatedContext());

      const result = await caller.financialStatements.cashFlowStatement({
        periodId: testPeriodId,
      });

      expect(result).toEqual(mockCashFlowStatement);
      expect(mockGenerateCashFlowStatement).toHaveBeenCalledWith({
        organizationId: testOrganizationId,
        periodId: testPeriodId,
        subsidiaryId: undefined,
        classId: undefined,
        departmentId: undefined,
        locationId: undefined,
        includeInactive: false,
        comparePeriodId: undefined,
      });
    });

    it('should support dimension filtering', async () => {
      mockGenerateCashFlowStatement.mockResolvedValue(mockCashFlowStatement);
      const caller = createCaller(createAuthenticatedContext());

      await caller.financialStatements.cashFlowStatement({
        periodId: testPeriodId,
        subsidiaryId: testSubsidiaryId,
      });

      expect(mockGenerateCashFlowStatement).toHaveBeenCalledWith(
        expect.objectContaining({
          subsidiaryId: testSubsidiaryId,
        })
      );
    });
  });

  describe('trialBalance', () => {
    const mockTrialBalance = {
      reportDate: new Date().toISOString(),
      periodName: 'Q4 2024',
      accounts: [
        { accountNumber: '1000', accountName: 'Cash', debit: 50000, credit: 0 },
        { accountNumber: '2000', accountName: 'Accounts Payable', debit: 0, credit: 20000 },
        { accountNumber: '3000', accountName: 'Retained Earnings', debit: 0, credit: 30000 },
      ],
      totalDebits: 50000,
      totalCredits: 50000,
      isBalanced: true,
    };

    it('should generate trial balance with valid input', async () => {
      mockGenerateTrialBalance.mockResolvedValue(mockTrialBalance);
      const caller = createCaller(createAuthenticatedContext());

      const result = await caller.financialStatements.trialBalance({
        periodId: testPeriodId,
      });

      expect(result).toEqual(mockTrialBalance);
      expect(mockGenerateTrialBalance).toHaveBeenCalledWith({
        organizationId: testOrganizationId,
        periodId: testPeriodId,
        subsidiaryId: undefined,
        classId: undefined,
        departmentId: undefined,
        locationId: undefined,
        includeInactive: false,
      });
    });

    it('should support filtering by multiple dimensions', async () => {
      mockGenerateTrialBalance.mockResolvedValue(mockTrialBalance);
      const caller = createCaller(createAuthenticatedContext());
      const locationId = '123e4567-e89b-12d3-a456-426614174020';

      await caller.financialStatements.trialBalance({
        periodId: testPeriodId,
        locationIds: [locationId],
        includeInactive: true,
      });

      expect(mockGenerateTrialBalance).toHaveBeenCalledWith({
        organizationId: testOrganizationId,
        periodId: testPeriodId,
        subsidiaryId: undefined,
        classId: undefined,
        departmentId: undefined,
        locationId: locationId,
        includeInactive: true,
      });
    });
  });

  describe('export', () => {
    const mockExportResult = {
      filename: 'balance-sheet-2024-Q4.pdf',
      contentType: 'application/pdf',
      buffer: Buffer.from('PDF content'),
    };

    it('should export balance sheet to PDF', async () => {
      mockExportReport.mockResolvedValue(mockExportResult);
      const caller = createCaller(createAuthenticatedContext());

      const result = await caller.financialStatements.export({
        reportType: 'BALANCE_SHEET',
        reportData: { totalAssets: 180000 },
        format: 'pdf',
      });

      expect(result).toEqual({
        filename: 'balance-sheet-2024-Q4.pdf',
        contentType: 'application/pdf',
        content: Buffer.from('PDF content').toString('base64'),
      });
    });

    it('should export income statement to Excel', async () => {
      const xlsxResult = {
        filename: 'income-statement-2024-Q4.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from('Excel content'),
      };
      mockExportReport.mockResolvedValue(xlsxResult);
      const caller = createCaller(createAuthenticatedContext());

      const result = await caller.financialStatements.export({
        reportType: 'INCOME_STATEMENT',
        reportData: { netIncome: 60000 },
        format: 'xlsx',
      });

      expect(result.filename).toBe('income-statement-2024-Q4.xlsx');
      expect(result.contentType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });

    it('should support CSV export', async () => {
      const csvResult = {
        filename: 'balance-sheet-2024-Q4.csv',
        contentType: 'text/csv',
        buffer: Buffer.from('Account,Balance\nCash,50000'),
      };
      mockExportReport.mockResolvedValue(csvResult);
      const caller = createCaller(createAuthenticatedContext());

      const result = await caller.financialStatements.export({
        reportType: 'BALANCE_SHEET',
        reportData: {},
        format: 'csv',
      });

      expect(result.contentType).toBe('text/csv');
    });

    it('should support JSON export', async () => {
      const jsonResult = {
        filename: 'balance-sheet-2024-Q4.json',
        contentType: 'application/json',
        buffer: Buffer.from('{"totalAssets": 180000}'),
      };
      mockExportReport.mockResolvedValue(jsonResult);
      const caller = createCaller(createAuthenticatedContext());

      const result = await caller.financialStatements.export({
        reportType: 'BALANCE_SHEET',
        reportData: {},
        format: 'json',
      });

      expect(result.contentType).toBe('application/json');
    });

    it('should throw error for cash flow statement export (not implemented)', async () => {
      const caller = createCaller(createAuthenticatedContext());

      await expect(
        caller.financialStatements.export({
          reportType: 'CASH_FLOW_STATEMENT',
          reportData: {},
          format: 'pdf',
        })
      ).rejects.toThrow('Cash Flow Statement export not yet implemented');
    });

    it('should pass export options correctly', async () => {
      mockExportReport.mockResolvedValue(mockExportResult);
      const caller = createCaller(createAuthenticatedContext());

      await caller.financialStatements.export({
        reportType: 'BALANCE_SHEET',
        reportData: { totalAssets: 180000 },
        format: 'pdf',
        includeComparison: true,
        includeNotes: true,
        includeLogo: false,
        landscape: true,
      });

      expect(mockExportReport).toHaveBeenCalledWith(
        'BALANCE_SHEET',
        { totalAssets: 180000 },
        {
          format: 'pdf',
          includeComparison: true,
          includeNotes: true,
          includeLogo: false,
          landscape: true,
        }
      );
    });

    it('should reject invalid report type', async () => {
      const caller = createCaller(createAuthenticatedContext());

      await expect(
        caller.financialStatements.export({
          reportType: 'INVALID_TYPE' as any,
          reportData: {},
          format: 'pdf',
        })
      ).rejects.toThrow();
    });

    it('should reject invalid format', async () => {
      const caller = createCaller(createAuthenticatedContext());

      await expect(
        caller.financialStatements.export({
          reportType: 'BALANCE_SHEET',
          reportData: {},
          format: 'invalid' as any,
        })
      ).rejects.toThrow();
    });
  });

  describe('metadata', () => {
    const mockMetadata = {
      reportType: 'BALANCE_SHEET',
      generatedAt: new Date().toISOString(),
      generatedBy: 'test@example.com',
      periodName: 'Q4 2024',
      organizationName: 'Test Org',
      filters: {
        subsidiaryId: testSubsidiaryId,
      },
      accountsCovered: 25,
      dataVersion: '1.0.0',
    };

    it('should generate report metadata', async () => {
      mockGenerateReportMetadata.mockResolvedValue(mockMetadata);
      const caller = createCaller(createAuthenticatedContext());

      const result = await caller.financialStatements.metadata({
        reportType: 'BALANCE_SHEET',
        periodId: testPeriodId,
      });

      expect(result).toEqual(mockMetadata);
      expect(mockGenerateReportMetadata).toHaveBeenCalledWith(
        'BALANCE_SHEET',
        testPeriodId,
        undefined,
        undefined
      );
    });

    it('should pass subsidiary and filters to metadata generation', async () => {
      mockGenerateReportMetadata.mockResolvedValue(mockMetadata);
      const caller = createCaller(createAuthenticatedContext());
      const filters = { departmentId: '123' };

      await caller.financialStatements.metadata({
        reportType: 'INCOME_STATEMENT',
        periodId: testPeriodId,
        subsidiaryId: testSubsidiaryId,
        filters,
      });

      expect(mockGenerateReportMetadata).toHaveBeenCalledWith(
        'INCOME_STATEMENT',
        testPeriodId,
        testSubsidiaryId,
        filters
      );
    });

    it('should support all report types for metadata', async () => {
      mockGenerateReportMetadata.mockResolvedValue(mockMetadata);
      const caller = createCaller(createAuthenticatedContext());

      const reportTypes = ['INCOME_STATEMENT', 'BALANCE_SHEET', 'CASH_FLOW', 'TRIAL_BALANCE'] as const;

      for (const reportType of reportTypes) {
        await caller.financialStatements.metadata({
          reportType,
          periodId: testPeriodId,
        });

        expect(mockGenerateReportMetadata).toHaveBeenCalledWith(
          reportType,
          testPeriodId,
          undefined,
          undefined
        );
      }
    });

    it('should reject invalid report type for metadata', async () => {
      const caller = createCaller(createAuthenticatedContext());

      await expect(
        caller.financialStatements.metadata({
          reportType: 'INVALID_TYPE' as any,
          periodId: testPeriodId,
        })
      ).rejects.toThrow();
    });
  });

  describe('Input Validation', () => {
    it('should validate UUID format for periodId', async () => {
      const caller = createCaller(createAuthenticatedContext());

      await expect(
        caller.financialStatements.balanceSheet({
          periodId: 'invalid-uuid',
        })
      ).rejects.toThrow();
    });

    it('should validate UUID format for comparePeriodId', async () => {
      const caller = createCaller(createAuthenticatedContext());

      await expect(
        caller.financialStatements.incomeStatement({
          periodId: testPeriodId,
          comparePeriodId: 'invalid-uuid',
        })
      ).rejects.toThrow();
    });

    it('should validate UUID format for subsidiaryId', async () => {
      const caller = createCaller(createAuthenticatedContext());

      await expect(
        caller.financialStatements.trialBalance({
          periodId: testPeriodId,
          subsidiaryId: 'not-a-uuid',
        })
      ).rejects.toThrow();
    });

    it('should validate UUID format in departmentIds array', async () => {
      const caller = createCaller(createAuthenticatedContext());

      await expect(
        caller.financialStatements.balanceSheet({
          periodId: testPeriodId,
          departmentIds: ['invalid-uuid'],
        })
      ).rejects.toThrow();
    });

    it('should validate UUID format in classIds array', async () => {
      const caller = createCaller(createAuthenticatedContext());

      await expect(
        caller.financialStatements.incomeStatement({
          periodId: testPeriodId,
          classIds: ['not-a-valid-uuid'],
        })
      ).rejects.toThrow();
    });

    it('should validate UUID format in locationIds array', async () => {
      const caller = createCaller(createAuthenticatedContext());

      await expect(
        caller.financialStatements.cashFlowStatement({
          periodId: testPeriodId,
          locationIds: ['invalid'],
        })
      ).rejects.toThrow();
    });

    it('should accept valid boolean options', async () => {
      mockGenerateBalanceSheet.mockResolvedValue({});
      const caller = createCaller(createAuthenticatedContext());

      await caller.financialStatements.balanceSheet({
        periodId: testPeriodId,
        includeInactive: true,
        showAccountHierarchy: false,
        showZeroBalances: true,
      });

      expect(mockGenerateBalanceSheet).toHaveBeenCalled();
    });

    it('should use default values for optional boolean fields', async () => {
      mockGenerateBalanceSheet.mockResolvedValue({});
      const caller = createCaller(createAuthenticatedContext());

      await caller.financialStatements.balanceSheet({
        periodId: testPeriodId,
      });

      expect(mockGenerateBalanceSheet).toHaveBeenCalledWith(
        expect.objectContaining({
          includeInactive: false,
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should propagate service errors correctly', async () => {
      mockGenerateBalanceSheet.mockRejectedValue(new Error('Database connection failed'));
      const caller = createCaller(createAuthenticatedContext());

      await expect(
        caller.financialStatements.balanceSheet({
          periodId: testPeriodId,
        })
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle TRPCError from service', async () => {
      const trpcError = new TRPCError({
        code: 'NOT_FOUND',
        message: 'Period not found',
      });
      mockGenerateIncomeStatement.mockRejectedValue(trpcError);
      const caller = createCaller(createAuthenticatedContext());

      await expect(
        caller.financialStatements.incomeStatement({
          periodId: testPeriodId,
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should handle export service failure', async () => {
      mockExportReport.mockRejectedValue(new Error('Export generation failed'));
      const caller = createCaller(createAuthenticatedContext());

      await expect(
        caller.financialStatements.export({
          reportType: 'BALANCE_SHEET',
          reportData: {},
          format: 'pdf',
        })
      ).rejects.toThrow('Export generation failed');
    });
  });
});
