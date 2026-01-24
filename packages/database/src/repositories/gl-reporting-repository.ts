import { and, asc, desc, eq, sql, gte, lte, inArray, isNull, or, sum } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import {
  glTransactions,
  glTransactionLines,
  glAccountBalances
} from '../db/schema/gl-transactions';
import { accountingPeriods } from '../db/schema/accounting-periods';
import { subsidiaries } from '../db/schema/subsidiaries';
import { accounts } from '../db/schema/accounts';

// Account category type for financial statements
type AccountCategory = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'COGS' | 'Expense';

export interface GlTransactionPaginationParams {
  page?: number;
  limit?: number;
  orderBy?: 'transactionNumber' | 'transactionDate' | 'postingDate';
  orderDirection?: 'asc' | 'desc';
}

export interface GlTransactionFilters {
  subsidiaryId?: string;
  periodId?: string;
  status?: string;
  transactionType?: string;
  dateFrom?: string | Date;
  dateTo?: string | Date;
  sourceTransactionId?: string;
}

export interface AccountActivityFilters {
  accountId: string;
  subsidiaryId?: string;
  dateFrom: string | Date;
  dateTo: string | Date;
  classId?: string;
  departmentId?: string;
  locationId?: string;
}

export interface TrialBalanceFilters {
  periodId: string;
  subsidiaryId?: string;
  includeInactive?: boolean;
  classId?: string;
  departmentId?: string;
  locationId?: string;
}

export interface IncomeStatementFilters {
  periodId: string;
  subsidiaryId?: string;
  classId?: string;
  departmentId?: string;
  locationId?: string;
  includeInactive?: boolean;
  comparePeriodId?: string;
}

export interface BalanceSheetFilters {
  periodId: string;
  subsidiaryId?: string;
  classId?: string;
  departmentId?: string;
  locationId?: string;
  includeInactive?: boolean;
  comparePeriodId?: string;
}

export interface CashFlowStatementFilters {
  periodId: string;
  subsidiaryId?: string;
  classId?: string;
  departmentId?: string;
  locationId?: string;
  includeInactive?: boolean;
  comparePeriodId?: string;
}

// Cash flow category type
type CashFlowCategoryType = 'OPERATING' | 'INVESTING' | 'FINANCING';

export interface CashFlowLineItem {
  description: string;
  amount: number;
  accountId?: string;
  accountNumber?: string;
  isSubtotal: boolean;
  priorPeriodAmount?: number;
}

export interface CashFlowSection {
  sectionName: string;
  category: CashFlowCategoryType;
  lineItems: CashFlowLineItem[];
  sectionTotal: number;
  priorPeriodTotal?: number;
}

export interface FinancialStatementLineItem {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountCategory: AccountCategory;
  accountSubcategory: string | null;
  currentPeriodAmount: number;
  ytdAmount: number;
  priorPeriodAmount?: number;
}

export interface FinancialStatementSection {
  name: string;
  category: AccountCategory;
  subcategory?: string;
  lineItems: FinancialStatementLineItem[];
  sectionTotal: number;
  priorPeriodTotal?: number;
}

export class GlReportingRepository extends BaseRepository {
  
  /**
   * Get subsidiaries accessible to an organization
   */
  private async getOrganizationSubsidiaries(organizationId: string): Promise<string[]> {
    const result = await this.db
      .select({ id: subsidiaries.id })
      .from(subsidiaries)
      .where(eq(subsidiaries.organizationId, organizationId));
    
    return result.map(s => s.id);
  }

  /**
   * Validate that a subsidiary belongs to the organization
   */
  private async validateSubsidiaryAccess(subsidiaryId: string, organizationId: string): Promise<boolean> {
    const result = await this.db
      .select({ count: sql`COUNT(*)` })
      .from(subsidiaries)
      .where(
        and(
          eq(subsidiaries.id, subsidiaryId),
          eq(subsidiaries.organizationId, organizationId)
        )
      );
    
    return Number(result[0]?.count || 0) > 0;
  }

  /**
   * Find GL transaction by ID with organization RLS
   */
  async findGlTransactionById(id: string, organizationId: string) {
    const accessibleSubsidiaries = await this.getOrganizationSubsidiaries(organizationId);
    
    if (accessibleSubsidiaries.length === 0) {
      return null;
    }

    const [result] = await this.db
      .select()
      .from(glTransactions)
      .where(
        and(
          eq(glTransactions.id, id),
          inArray(glTransactions.subsidiaryId, accessibleSubsidiaries)
        )
      )
      .limit(1);
    
    return result || null;
  }

  /**
   * List GL transactions with organization RLS
   */
  async findAllGlTransactions(
    organizationId: string,
    params: GlTransactionPaginationParams = {},
    filters: GlTransactionFilters = {}
  ) {
    const accessibleSubsidiaries = await this.getOrganizationSubsidiaries(organizationId);
    
    if (accessibleSubsidiaries.length === 0) {
      return {
        data: [],
        total: 0,
        page: 1,
        limit: params.limit || 20,
        totalPages: 0
      };
    }

    // Calculate pagination
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 20));
    const skip = (page - 1) * limit;
    
    // Build the where clause
    let whereConditions = [
      inArray(glTransactions.subsidiaryId, accessibleSubsidiaries)
    ];
    
    // Apply subsidiary filter if specified and validate access
    if (filters.subsidiaryId) {
      const hasAccess = await this.validateSubsidiaryAccess(filters.subsidiaryId, organizationId);
      if (!hasAccess) {
        throw new Error('Access denied to specified subsidiary');
      }
      whereConditions.push(eq(glTransactions.subsidiaryId, filters.subsidiaryId));
    }
    
    if (filters.periodId) {
      whereConditions.push(eq(glTransactions.periodId, filters.periodId));
    }
    
    if (filters.status) {
      whereConditions.push(eq(glTransactions.status, filters.status));
    }
    
    if (filters.transactionType) {
      whereConditions.push(eq(glTransactions.transactionType, filters.transactionType));
    }
    
    if (filters.sourceTransactionId) {
      whereConditions.push(eq(glTransactions.sourceTransactionId, filters.sourceTransactionId));
    }
    
    if (filters.dateFrom) {
      const dateFrom = typeof filters.dateFrom === 'string' ? filters.dateFrom : filters.dateFrom.toISOString().split('T')[0];
      whereConditions.push(gte(glTransactions.transactionDate, dateFrom));
    }
    
    if (filters.dateTo) {
      const dateTo = typeof filters.dateTo === 'string' ? filters.dateTo : filters.dateTo.toISOString().split('T')[0];
      whereConditions.push(lte(glTransactions.transactionDate, dateTo));
    }
    
    const whereClause = and(...whereConditions);
    
    // Get the total count
    const countResult = await this.db
      .select({ count: sql`COUNT(*)` })
      .from(glTransactions)
      .where(whereClause);
    
    const count = Number(countResult[0]?.count || 0);
    
    // Get the paginated results with ordering
    const orderBy = params.orderBy || 'transactionDate';
    const orderDirection = params.orderDirection || 'desc';
    let orderColumn;
    
    switch (orderBy) {
      case 'transactionNumber':
        orderColumn = glTransactions.transactionNumber;
        break;
      case 'postingDate':
        orderColumn = glTransactions.postingDate;
        break;
      default:
        orderColumn = glTransactions.transactionDate;
    }
    
    const orderFunc = orderDirection === 'asc' ? asc : desc;
    
    const results = await this.db
      .select()
      .from(glTransactions)
      .where(whereClause)
      .orderBy(orderFunc(orderColumn))
      .limit(limit)
      .offset(skip);
    
    return {
      data: results,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    };
  }

  /**
   * Get GL transaction lines with organization RLS
   */
  async getGlTransactionLines(transactionId: string, organizationId: string) {
    // First verify access to the transaction
    const transaction = await this.findGlTransactionById(transactionId, organizationId);
    if (!transaction) {
      return [];
    }

    const results = await this.db
      .select()
      .from(glTransactionLines)
      .where(eq(glTransactionLines.transactionId, transactionId))
      .orderBy(asc(glTransactionLines.lineNumber));
    
    return results;
  }

  /**
   * Get account activity with organization RLS
   */
  async getAccountActivity(
    filters: AccountActivityFilters,
    organizationId: string,
    params: { page?: number; limit?: number } = {}
  ) {
    const accessibleSubsidiaries = await this.getOrganizationSubsidiaries(organizationId);
    
    if (accessibleSubsidiaries.length === 0) {
      return {
        data: [],
        total: 0,
        page: 1,
        limit: params.limit || 50,
        totalPages: 0
      };
    }

    // Calculate pagination
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 50));
    const skip = (page - 1) * limit;
    
    // Build the where clause
    let whereConditions = [
      eq(glTransactionLines.accountId, filters.accountId),
      inArray(glTransactionLines.subsidiaryId, accessibleSubsidiaries),
      gte(glTransactions.transactionDate, typeof filters.dateFrom === 'string' ? filters.dateFrom : filters.dateFrom.toISOString().split('T')[0]),
      lte(glTransactions.transactionDate, typeof filters.dateTo === 'string' ? filters.dateTo : filters.dateTo.toISOString().split('T')[0])
    ];
    
    // Apply subsidiary filter if specified and validate access
    if (filters.subsidiaryId) {
      const hasAccess = await this.validateSubsidiaryAccess(filters.subsidiaryId, organizationId);
      if (!hasAccess) {
        throw new Error('Access denied to specified subsidiary');
      }
      whereConditions.push(eq(glTransactionLines.subsidiaryId, filters.subsidiaryId));
    }
    
    if (filters.classId) {
      whereConditions.push(eq(glTransactionLines.classId, filters.classId));
    }
    
    if (filters.departmentId) {
      whereConditions.push(eq(glTransactionLines.departmentId, filters.departmentId));
    }
    
    if (filters.locationId) {
      whereConditions.push(eq(glTransactionLines.locationId, filters.locationId));
    }
    
    const whereClause = and(...whereConditions);
    
    // Get the total count
    const countResult = await this.db
      .select({ count: sql`COUNT(*)` })
      .from(glTransactionLines)
      .innerJoin(glTransactions, eq(glTransactionLines.transactionId, glTransactions.id))
      .where(whereClause);
    
    const count = Number(countResult[0]?.count || 0);
    
    // Get the paginated results
    const results = await this.db
      .select({
        date: glTransactions.transactionDate,
        transactionNumber: glTransactions.transactionNumber,
        description: glTransactionLines.description,
        reference: glTransactionLines.reference1,
        debitAmount: glTransactionLines.debitAmount,
        creditAmount: glTransactionLines.creditAmount,
        glTransactionId: glTransactions.id,
        sourceTransactionId: glTransactions.sourceTransactionId,
      })
      .from(glTransactionLines)
      .innerJoin(glTransactions, eq(glTransactionLines.transactionId, glTransactions.id))
      .where(whereClause)
      .orderBy(asc(glTransactions.transactionDate), asc(glTransactionLines.lineNumber))
      .limit(limit)
      .offset(skip);
    
    // Calculate running balance
    let runningBalance = 0;
    const dataWithBalance = results.map(row => {
      const debit = Number(row.debitAmount || 0);
      const credit = Number(row.creditAmount || 0);
      runningBalance += debit - credit;
      
      return {
        ...row,
        debitAmount: debit,
        creditAmount: credit,
        runningBalance
      };
    });
    
    return {
      data: dataWithBalance,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    };
  }

  /**
   * Get trial balance with organization RLS
   */
  async getTrialBalance(filters: TrialBalanceFilters, organizationId: string) {
    const accessibleSubsidiaries = await this.getOrganizationSubsidiaries(organizationId);
    
    if (accessibleSubsidiaries.length === 0) {
      return {
        periodName: '',
        subsidiaryName: '',
        asOfDate: '',
        entries: [],
        totals: { totalDebits: 0, totalCredits: 0, difference: 0 }
      };
    }

    // Apply subsidiary filter if specified and validate access
    let targetSubsidiaries = accessibleSubsidiaries;
    if (filters.subsidiaryId) {
      const hasAccess = await this.validateSubsidiaryAccess(filters.subsidiaryId, organizationId);
      if (!hasAccess) {
        throw new Error('Access denied to specified subsidiary');
      }
      targetSubsidiaries = [filters.subsidiaryId];
    }

    // Build the where clause for account balances
    let whereConditions = [
      eq(glAccountBalances.periodId, filters.periodId),
      inArray(glAccountBalances.subsidiaryId, targetSubsidiaries)
    ];
    
    if (filters.classId) {
      whereConditions.push(eq(glAccountBalances.classId, filters.classId));
    }
    
    if (filters.departmentId) {
      whereConditions.push(eq(glAccountBalances.departmentId, filters.departmentId));
    }
    
    if (filters.locationId) {
      whereConditions.push(eq(glAccountBalances.locationId, filters.locationId));
    }
    
    const whereClause = and(...whereConditions);

    // Get account balances with account details
    const results = await this.db
      .select({
        accountId: glAccountBalances.accountId,
        accountNumber: accounts.accountNumber,
        accountName: accounts.accountName,
        accountCategory: accounts.accountCategory,
        beginningBalanceDebit: glAccountBalances.beginningBalanceDebit,
        beginningBalanceCredit: glAccountBalances.beginningBalanceCredit,
        periodDebitAmount: glAccountBalances.periodDebitAmount,
        periodCreditAmount: glAccountBalances.periodCreditAmount,
        endingBalanceDebit: glAccountBalances.endingBalanceDebit,
        endingBalanceCredit: glAccountBalances.endingBalanceCredit,
        ytdDebitAmount: glAccountBalances.ytdDebitAmount,
        ytdCreditAmount: glAccountBalances.ytdCreditAmount,
      })
      .from(glAccountBalances)
      .innerJoin(accounts, eq(glAccountBalances.accountId, accounts.id))
      .where(
        and(
          whereClause,
          filters.includeInactive ? undefined : eq(accounts.isActive, true)
        )
      )
      .orderBy(asc(accounts.accountNumber));

    // Calculate totals
    let totalDebits = 0;
    let totalCredits = 0;

    const entries = results.map(row => {
      const debitBalance = Number(row.endingBalanceDebit || 0);
      const creditBalance = Number(row.endingBalanceCredit || 0);
      const netBalance = debitBalance - creditBalance;

      totalDebits += debitBalance;
      totalCredits += creditBalance;

      return {
        accountId: row.accountId,
        accountNumber: row.accountNumber,
        accountName: row.accountName,
        accountType: row.accountCategory,
        debitBalance,
        creditBalance,
        netBalance,
        periodActivity: {
          debits: Number(row.periodDebitAmount || 0),
          credits: Number(row.periodCreditAmount || 0),
          net: Number(row.periodDebitAmount || 0) - Number(row.periodCreditAmount || 0)
        },
        ytdActivity: {
          debits: Number(row.ytdDebitAmount || 0),
          credits: Number(row.ytdCreditAmount || 0),
          net: Number(row.ytdDebitAmount || 0) - Number(row.ytdCreditAmount || 0)
        }
      };
    });

    // Get period and subsidiary info for the header
    const [periodInfo] = await this.db
      .select({
        periodName: accountingPeriods.periodName,
        endDate: accountingPeriods.endDate,
      })
      .from(accountingPeriods)
      .where(eq(accountingPeriods.id, filters.periodId))
      .limit(1);

    let subsidiaryName = '';
    if (filters.subsidiaryId) {
      const [subInfo] = await this.db
        .select({ name: subsidiaries.name })
        .from(subsidiaries)
        .where(eq(subsidiaries.id, filters.subsidiaryId))
        .limit(1);
      subsidiaryName = subInfo?.name || '';
    } else {
      subsidiaryName = 'All Subsidiaries';
    }

    return {
      periodName: periodInfo?.periodName || '',
      subsidiaryName,
      asOfDate: periodInfo?.endDate || '',
      entries,
      totals: {
        totalDebits,
        totalCredits,
        difference: totalDebits - totalCredits
      }
    };
  }

  /**
   * Get general ledger entries with organization RLS
   */
  async getGeneralLedger(
    filters: {
      subsidiaryId?: string;
      periodId?: string;
      dateFrom?: string | Date;
      dateTo?: string | Date;
      accountIds?: string[];
      includeAdjustments?: boolean;
      groupBy?: 'account' | 'date' | 'transaction';
    },
    organizationId: string,
    params: { page?: number; limit?: number } = {}
  ) {
    const accessibleSubsidiaries = await this.getOrganizationSubsidiaries(organizationId);
    
    if (accessibleSubsidiaries.length === 0) {
      return {
        data: [],
        total: 0,
        page: 1,
        limit: params.limit || 100,
        totalPages: 0
      };
    }

    // Calculate pagination
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(500, params.limit || 100));
    const skip = (page - 1) * limit;
    
    // Build the where clause
    let whereConditions = [
      inArray(glTransactionLines.subsidiaryId, accessibleSubsidiaries)
    ];
    
    // Apply subsidiary filter if specified and validate access
    if (filters.subsidiaryId) {
      const hasAccess = await this.validateSubsidiaryAccess(filters.subsidiaryId, organizationId);
      if (!hasAccess) {
        throw new Error('Access denied to specified subsidiary');
      }
      whereConditions.push(eq(glTransactionLines.subsidiaryId, filters.subsidiaryId));
    }
    
    if (filters.periodId) {
      whereConditions.push(eq(glTransactions.periodId, filters.periodId));
    }
    
    if (filters.dateFrom) {
      const dateFrom = typeof filters.dateFrom === 'string' ? filters.dateFrom : filters.dateFrom.toISOString().split('T')[0];
      whereConditions.push(gte(glTransactions.transactionDate, dateFrom));
    }
    
    if (filters.dateTo) {
      const dateTo = typeof filters.dateTo === 'string' ? filters.dateTo : filters.dateTo.toISOString().split('T')[0];
      whereConditions.push(lte(glTransactions.transactionDate, dateTo));
    }
    
    if (filters.accountIds && filters.accountIds.length > 0) {
      whereConditions.push(inArray(glTransactionLines.accountId, filters.accountIds));
    }
    
    if (!filters.includeAdjustments) {
      whereConditions.push(eq(glTransactions.transactionType, 'POSTING'));
    }
    
    const whereClause = and(...whereConditions);
    
    // Get the total count
    const countResult = await this.db
      .select({ count: sql`COUNT(*)` })
      .from(glTransactionLines)
      .innerJoin(glTransactions, eq(glTransactionLines.transactionId, glTransactions.id))
      .where(whereClause);
    
    const count = Number(countResult[0]?.count || 0);
    
    // Determine ordering based on groupBy
    let orderByColumns;
    switch (filters.groupBy) {
      case 'account':
        orderByColumns = [asc(accounts.accountNumber), asc(glTransactions.transactionDate), asc(glTransactionLines.lineNumber)];
        break;
      case 'date':
        orderByColumns = [asc(glTransactions.transactionDate), asc(accounts.accountNumber), asc(glTransactionLines.lineNumber)];
        break;
      case 'transaction':
      default:
        orderByColumns = [asc(glTransactions.transactionNumber), asc(glTransactionLines.lineNumber)];
        break;
    }
    
    // Get the paginated results
    const results = await this.db
      .select({
        glTransactionId: glTransactions.id,
        transactionNumber: glTransactions.transactionNumber,
        transactionDate: glTransactions.transactionDate,
        postingDate: glTransactions.postingDate,
        description: glTransactionLines.description,
        accountId: glTransactionLines.accountId,
        accountNumber: accounts.accountNumber,
        accountName: accounts.accountName,
        debitAmount: glTransactionLines.debitAmount,
        creditAmount: glTransactionLines.creditAmount,
        reference1: glTransactionLines.reference1,
        reference2: glTransactionLines.reference2,
        classId: glTransactionLines.classId,
        departmentId: glTransactionLines.departmentId,
        locationId: glTransactionLines.locationId,
      })
      .from(glTransactionLines)
      .innerJoin(glTransactions, eq(glTransactionLines.transactionId, glTransactions.id))
      .innerJoin(accounts, eq(glTransactionLines.accountId, accounts.id))
      .where(whereClause)
      .orderBy(...orderByColumns)
      .limit(limit)
      .offset(skip);
    
    return {
      data: results.map(row => ({
        ...row,
        debitAmount: Number(row.debitAmount || 0),
        creditAmount: Number(row.creditAmount || 0)
      })),
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    };
  }

  /**
   * Get Income Statement with organization RLS
   * Returns Revenue, COGS, and Expense accounts with calculated totals
   */
  async getIncomeStatement(filters: IncomeStatementFilters, organizationId: string) {
    const accessibleSubsidiaries = await this.getOrganizationSubsidiaries(organizationId);

    if (accessibleSubsidiaries.length === 0) {
      return this.emptyIncomeStatement();
    }

    // Apply subsidiary filter if specified and validate access
    let targetSubsidiaries = accessibleSubsidiaries;
    if (filters.subsidiaryId) {
      const hasAccess = await this.validateSubsidiaryAccess(filters.subsidiaryId, organizationId);
      if (!hasAccess) {
        throw new Error('Access denied to specified subsidiary');
      }
      targetSubsidiaries = [filters.subsidiaryId];
    }

    // Get account balances for income statement categories
    const incomeCategories: AccountCategory[] = ['Revenue', 'COGS', 'Expense'];

    const whereConditions = [
      eq(glAccountBalances.periodId, filters.periodId),
      inArray(glAccountBalances.subsidiaryId, targetSubsidiaries),
      inArray(accounts.accountCategory, incomeCategories)
    ];

    if (filters.classId) {
      whereConditions.push(eq(glAccountBalances.classId, filters.classId));
    }
    if (filters.departmentId) {
      whereConditions.push(eq(glAccountBalances.departmentId, filters.departmentId));
    }
    if (filters.locationId) {
      whereConditions.push(eq(glAccountBalances.locationId, filters.locationId));
    }

    const whereClause = and(...whereConditions);

    // Get account balances aggregated by account
    const results = await this.db
      .select({
        accountId: glAccountBalances.accountId,
        accountNumber: accounts.accountNumber,
        accountName: accounts.accountName,
        accountCategory: accounts.accountCategory,
        accountSubcategory: accounts.accountSubcategory,
        normalBalance: accounts.normalBalance,
        periodDebitAmount: sql<string>`SUM(${glAccountBalances.periodDebitAmount})`,
        periodCreditAmount: sql<string>`SUM(${glAccountBalances.periodCreditAmount})`,
        ytdDebitAmount: sql<string>`SUM(${glAccountBalances.ytdDebitAmount})`,
        ytdCreditAmount: sql<string>`SUM(${glAccountBalances.ytdCreditAmount})`,
      })
      .from(glAccountBalances)
      .innerJoin(accounts, eq(glAccountBalances.accountId, accounts.id))
      .where(
        and(
          whereClause,
          filters.includeInactive ? undefined : eq(accounts.isActive, true)
        )
      )
      .groupBy(
        glAccountBalances.accountId,
        accounts.accountNumber,
        accounts.accountName,
        accounts.accountCategory,
        accounts.accountSubcategory,
        accounts.normalBalance
      )
      .orderBy(asc(accounts.accountNumber));

    // Build sections
    const revenueItems: FinancialStatementLineItem[] = [];
    const cogsItems: FinancialStatementLineItem[] = [];
    const expenseItems: FinancialStatementLineItem[] = [];

    let totalRevenue = 0;
    let totalCogs = 0;
    let totalExpenses = 0;

    for (const row of results) {
      const periodDebit = Number(row.periodDebitAmount || 0);
      const periodCredit = Number(row.periodCreditAmount || 0);
      const ytdDebit = Number(row.ytdDebitAmount || 0);
      const ytdCredit = Number(row.ytdCreditAmount || 0);

      // Revenue accounts have credit normal balance (credit - debit = positive revenue)
      // Expense/COGS accounts have debit normal balance (debit - credit = positive expense)
      let currentPeriodAmount: number;
      let ytdAmount: number;

      if (row.accountCategory === 'Revenue') {
        currentPeriodAmount = periodCredit - periodDebit;
        ytdAmount = ytdCredit - ytdDebit;
      } else {
        currentPeriodAmount = periodDebit - periodCredit;
        ytdAmount = ytdDebit - ytdCredit;
      }

      const lineItem: FinancialStatementLineItem = {
        accountId: row.accountId,
        accountNumber: row.accountNumber,
        accountName: row.accountName,
        accountCategory: row.accountCategory as AccountCategory,
        accountSubcategory: row.accountSubcategory,
        currentPeriodAmount,
        ytdAmount,
      };

      switch (row.accountCategory) {
        case 'Revenue':
          revenueItems.push(lineItem);
          totalRevenue += currentPeriodAmount;
          break;
        case 'COGS':
          cogsItems.push(lineItem);
          totalCogs += currentPeriodAmount;
          break;
        case 'Expense':
          expenseItems.push(lineItem);
          totalExpenses += currentPeriodAmount;
          break;
      }
    }

    // Calculate derived values
    const grossProfit = totalRevenue - totalCogs;
    const grossProfitMargin = totalRevenue !== 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const operatingIncome = grossProfit - totalExpenses;
    const operatingMargin = totalRevenue !== 0 ? (operatingIncome / totalRevenue) * 100 : 0;
    const netIncome = operatingIncome;
    const netProfitMargin = totalRevenue !== 0 ? (netIncome / totalRevenue) * 100 : 0;

    // Get period info
    const periodInfo = await this.getPeriodInfo(filters.periodId, filters.subsidiaryId);

    return {
      reportName: 'Income Statement',
      periodName: periodInfo.periodName,
      subsidiaryName: periodInfo.subsidiaryName,
      asOfDate: periodInfo.endDate,

      revenueSection: {
        name: 'Revenue',
        category: 'Revenue' as AccountCategory,
        lineItems: revenueItems,
        sectionTotal: totalRevenue,
      },
      totalRevenue,

      cogsSection: {
        name: 'Cost of Goods Sold',
        category: 'COGS' as AccountCategory,
        lineItems: cogsItems,
        sectionTotal: totalCogs,
      },
      totalCogs,

      grossProfit,
      grossProfitMargin,

      operatingExpensesSection: {
        name: 'Operating Expenses',
        category: 'Expense' as AccountCategory,
        lineItems: expenseItems,
        sectionTotal: totalExpenses,
      },
      totalOperatingExpenses: totalExpenses,

      operatingIncome,
      operatingMargin,

      netIncome,
      netProfitMargin,
    };
  }

  /**
   * Get Balance Sheet with organization RLS
   * Returns Asset, Liability, and Equity accounts with calculated totals
   */
  async getBalanceSheet(filters: BalanceSheetFilters, organizationId: string) {
    const accessibleSubsidiaries = await this.getOrganizationSubsidiaries(organizationId);

    if (accessibleSubsidiaries.length === 0) {
      return this.emptyBalanceSheet();
    }

    // Apply subsidiary filter if specified and validate access
    let targetSubsidiaries = accessibleSubsidiaries;
    if (filters.subsidiaryId) {
      const hasAccess = await this.validateSubsidiaryAccess(filters.subsidiaryId, organizationId);
      if (!hasAccess) {
        throw new Error('Access denied to specified subsidiary');
      }
      targetSubsidiaries = [filters.subsidiaryId];
    }

    // Get account balances for balance sheet categories
    const balanceSheetCategories: AccountCategory[] = ['Asset', 'Liability', 'Equity'];

    const whereConditions = [
      eq(glAccountBalances.periodId, filters.periodId),
      inArray(glAccountBalances.subsidiaryId, targetSubsidiaries),
      inArray(accounts.accountCategory, balanceSheetCategories)
    ];

    if (filters.classId) {
      whereConditions.push(eq(glAccountBalances.classId, filters.classId));
    }
    if (filters.departmentId) {
      whereConditions.push(eq(glAccountBalances.departmentId, filters.departmentId));
    }
    if (filters.locationId) {
      whereConditions.push(eq(glAccountBalances.locationId, filters.locationId));
    }

    const whereClause = and(...whereConditions);

    // Get account balances aggregated by account
    const results = await this.db
      .select({
        accountId: glAccountBalances.accountId,
        accountNumber: accounts.accountNumber,
        accountName: accounts.accountName,
        accountCategory: accounts.accountCategory,
        accountSubcategory: accounts.accountSubcategory,
        normalBalance: accounts.normalBalance,
        endingBalanceDebit: sql<string>`SUM(${glAccountBalances.endingBalanceDebit})`,
        endingBalanceCredit: sql<string>`SUM(${glAccountBalances.endingBalanceCredit})`,
        ytdDebitAmount: sql<string>`SUM(${glAccountBalances.ytdDebitAmount})`,
        ytdCreditAmount: sql<string>`SUM(${glAccountBalances.ytdCreditAmount})`,
      })
      .from(glAccountBalances)
      .innerJoin(accounts, eq(glAccountBalances.accountId, accounts.id))
      .where(
        and(
          whereClause,
          filters.includeInactive ? undefined : eq(accounts.isActive, true)
        )
      )
      .groupBy(
        glAccountBalances.accountId,
        accounts.accountNumber,
        accounts.accountName,
        accounts.accountCategory,
        accounts.accountSubcategory,
        accounts.normalBalance
      )
      .orderBy(asc(accounts.accountNumber));

    // Build sections - separate current vs non-current based on subcategory
    const currentAssetItems: FinancialStatementLineItem[] = [];
    const nonCurrentAssetItems: FinancialStatementLineItem[] = [];
    const currentLiabilityItems: FinancialStatementLineItem[] = [];
    const longTermLiabilityItems: FinancialStatementLineItem[] = [];
    const equityItems: FinancialStatementLineItem[] = [];

    let totalCurrentAssets = 0;
    let totalNonCurrentAssets = 0;
    let totalCurrentLiabilities = 0;
    let totalLongTermLiabilities = 0;
    let totalEquity = 0;

    for (const row of results) {
      const endingDebit = Number(row.endingBalanceDebit || 0);
      const endingCredit = Number(row.endingBalanceCredit || 0);
      const ytdDebit = Number(row.ytdDebitAmount || 0);
      const ytdCredit = Number(row.ytdCreditAmount || 0);

      // Asset accounts have debit normal balance (debit - credit = positive balance)
      // Liability/Equity accounts have credit normal balance (credit - debit = positive balance)
      let currentPeriodAmount: number;
      let ytdAmount: number;

      if (row.accountCategory === 'Asset') {
        currentPeriodAmount = endingDebit - endingCredit;
        ytdAmount = ytdDebit - ytdCredit;
      } else {
        currentPeriodAmount = endingCredit - endingDebit;
        ytdAmount = ytdCredit - ytdDebit;
      }

      const lineItem: FinancialStatementLineItem = {
        accountId: row.accountId,
        accountNumber: row.accountNumber,
        accountName: row.accountName,
        accountCategory: row.accountCategory as AccountCategory,
        accountSubcategory: row.accountSubcategory,
        currentPeriodAmount,
        ytdAmount,
      };

      const subcategory = (row.accountSubcategory || '').toUpperCase();

      switch (row.accountCategory) {
        case 'Asset':
          if (subcategory.includes('CURRENT') && !subcategory.includes('NON')) {
            currentAssetItems.push(lineItem);
            totalCurrentAssets += currentPeriodAmount;
          } else {
            nonCurrentAssetItems.push(lineItem);
            totalNonCurrentAssets += currentPeriodAmount;
          }
          break;
        case 'Liability':
          if (subcategory.includes('CURRENT') && !subcategory.includes('LONG')) {
            currentLiabilityItems.push(lineItem);
            totalCurrentLiabilities += currentPeriodAmount;
          } else {
            longTermLiabilityItems.push(lineItem);
            totalLongTermLiabilities += currentPeriodAmount;
          }
          break;
        case 'Equity':
          equityItems.push(lineItem);
          totalEquity += currentPeriodAmount;
          break;
      }
    }

    // Calculate totals
    const totalAssets = totalCurrentAssets + totalNonCurrentAssets;
    const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;

    // Get current period net income from income statement accounts
    const netIncome = await this.calculateNetIncome(filters, organizationId, targetSubsidiaries);
    const retainedEarnings = totalEquity; // Simplified - actual RE would come from equity subcategory
    const totalEquityWithIncome = totalEquity + netIncome;

    const totalLiabilitiesAndEquity = totalLiabilities + totalEquityWithIncome;
    const balanceCheck = totalAssets - totalLiabilitiesAndEquity;

    // Get period info
    const periodInfo = await this.getPeriodInfo(filters.periodId, filters.subsidiaryId);

    return {
      reportName: 'Balance Sheet',
      periodName: periodInfo.periodName,
      subsidiaryName: periodInfo.subsidiaryName,
      asOfDate: periodInfo.endDate,

      currentAssetsSection: {
        name: 'Current Assets',
        category: 'Asset' as AccountCategory,
        subcategory: 'CURRENT',
        lineItems: currentAssetItems,
        sectionTotal: totalCurrentAssets,
      },
      totalCurrentAssets,

      nonCurrentAssetsSection: {
        name: 'Non-Current Assets',
        category: 'Asset' as AccountCategory,
        subcategory: 'NON_CURRENT',
        lineItems: nonCurrentAssetItems,
        sectionTotal: totalNonCurrentAssets,
      },
      totalNonCurrentAssets,

      totalAssets,

      currentLiabilitiesSection: {
        name: 'Current Liabilities',
        category: 'Liability' as AccountCategory,
        subcategory: 'CURRENT',
        lineItems: currentLiabilityItems,
        sectionTotal: totalCurrentLiabilities,
      },
      totalCurrentLiabilities,

      longTermLiabilitiesSection: {
        name: 'Long-Term Liabilities',
        category: 'Liability' as AccountCategory,
        subcategory: 'LONG_TERM',
        lineItems: longTermLiabilityItems,
        sectionTotal: totalLongTermLiabilities,
      },
      totalLongTermLiabilities,

      totalLiabilities,

      equitySection: {
        name: 'Equity',
        category: 'Equity' as AccountCategory,
        lineItems: equityItems,
        sectionTotal: totalEquity,
      },
      retainedEarnings,
      currentPeriodNetIncome: netIncome,
      totalEquity: totalEquityWithIncome,

      totalLiabilitiesAndEquity,
      balanceCheck,
    };
  }

  /**
   * Calculate net income for a period (used by balance sheet)
   */
  private async calculateNetIncome(
    filters: BalanceSheetFilters,
    organizationId: string,
    targetSubsidiaries: string[]
  ): Promise<number> {
    const incomeCategories: AccountCategory[] = ['Revenue', 'COGS', 'Expense'];

    const whereConditions = [
      eq(glAccountBalances.periodId, filters.periodId),
      inArray(glAccountBalances.subsidiaryId, targetSubsidiaries),
      inArray(accounts.accountCategory, incomeCategories)
    ];

    if (filters.classId) {
      whereConditions.push(eq(glAccountBalances.classId, filters.classId));
    }
    if (filters.departmentId) {
      whereConditions.push(eq(glAccountBalances.departmentId, filters.departmentId));
    }
    if (filters.locationId) {
      whereConditions.push(eq(glAccountBalances.locationId, filters.locationId));
    }

    const results = await this.db
      .select({
        accountCategory: accounts.accountCategory,
        periodDebitAmount: sql<string>`SUM(${glAccountBalances.periodDebitAmount})`,
        periodCreditAmount: sql<string>`SUM(${glAccountBalances.periodCreditAmount})`,
      })
      .from(glAccountBalances)
      .innerJoin(accounts, eq(glAccountBalances.accountId, accounts.id))
      .where(and(...whereConditions))
      .groupBy(accounts.accountCategory);

    let totalRevenue = 0;
    let totalCogs = 0;
    let totalExpenses = 0;

    for (const row of results) {
      const periodDebit = Number(row.periodDebitAmount || 0);
      const periodCredit = Number(row.periodCreditAmount || 0);

      switch (row.accountCategory) {
        case 'Revenue':
          totalRevenue += periodCredit - periodDebit;
          break;
        case 'COGS':
          totalCogs += periodDebit - periodCredit;
          break;
        case 'Expense':
          totalExpenses += periodDebit - periodCredit;
          break;
      }
    }

    return totalRevenue - totalCogs - totalExpenses;
  }

  /**
   * Get period and subsidiary info for report headers
   */
  private async getPeriodInfo(periodId: string, subsidiaryId?: string) {
    const [periodInfo] = await this.db
      .select({
        periodName: accountingPeriods.periodName,
        endDate: accountingPeriods.endDate,
      })
      .from(accountingPeriods)
      .where(eq(accountingPeriods.id, periodId))
      .limit(1);

    let subsidiaryName = 'All Subsidiaries';
    if (subsidiaryId) {
      const [subInfo] = await this.db
        .select({ name: subsidiaries.name })
        .from(subsidiaries)
        .where(eq(subsidiaries.id, subsidiaryId))
        .limit(1);
      subsidiaryName = subInfo?.name || '';
    }

    return {
      periodName: periodInfo?.periodName || '',
      endDate: periodInfo?.endDate || '',
      subsidiaryName,
    };
  }

  /**
   * Get Cash Flow Statement with organization RLS (Indirect Method)
   * Returns Operating, Investing, and Financing activities with calculated totals
   */
  async getCashFlowStatement(filters: CashFlowStatementFilters, organizationId: string) {
    const accessibleSubsidiaries = await this.getOrganizationSubsidiaries(organizationId);

    if (accessibleSubsidiaries.length === 0) {
      return this.emptyCashFlowStatement();
    }

    // Apply subsidiary filter if specified and validate access
    let targetSubsidiaries = accessibleSubsidiaries;
    if (filters.subsidiaryId) {
      const hasAccess = await this.validateSubsidiaryAccess(filters.subsidiaryId, organizationId);
      if (!hasAccess) {
        throw new Error('Access denied to specified subsidiary');
      }
      targetSubsidiaries = [filters.subsidiaryId];
    }

    // Get period info for date range
    const [periodInfo] = await this.db
      .select({
        periodName: accountingPeriods.periodName,
        startDate: accountingPeriods.startDate,
        endDate: accountingPeriods.endDate,
        fiscalYear: accountingPeriods.fiscalYear,
      })
      .from(accountingPeriods)
      .where(eq(accountingPeriods.id, filters.periodId))
      .limit(1);

    if (!periodInfo) {
      return this.emptyCashFlowStatement();
    }

    // Get beginning cash balance (from prior period or beginning of year)
    const beginningCashBalance = await this.getBeginningCashBalance(
      filters,
      organizationId,
      targetSubsidiaries
    );

    // Get net income from income statement
    const netIncome = await this.calculateNetIncome(
      { ...filters, periodId: filters.periodId },
      organizationId,
      targetSubsidiaries
    );

    // Get changes in balance sheet accounts for indirect method
    const balanceChanges = await this.getBalanceSheetChanges(
      filters,
      organizationId,
      targetSubsidiaries
    );

    // Build Operating Activities Section (Indirect Method)
    const operatingLineItems: CashFlowLineItem[] = [
      { description: 'Net Income', amount: netIncome, isSubtotal: false },
    ];

    // Add non-cash adjustments (depreciation, amortization)
    const depreciation = balanceChanges.depreciation || 0;
    if (depreciation !== 0) {
      operatingLineItems.push({
        description: 'Depreciation & Amortization',
        amount: depreciation,
        isSubtotal: false,
      });
    }

    // Changes in working capital
    const workingCapitalChanges = [
      { description: 'Increase/Decrease in Accounts Receivable', amount: -balanceChanges.accountsReceivable },
      { description: 'Increase/Decrease in Inventory', amount: -balanceChanges.inventory },
      { description: 'Increase/Decrease in Prepaid Expenses', amount: -balanceChanges.prepaidExpenses },
      { description: 'Increase/Decrease in Accounts Payable', amount: balanceChanges.accountsPayable },
      { description: 'Increase/Decrease in Accrued Liabilities', amount: balanceChanges.accruedLiabilities },
    ].filter(item => item.amount !== 0);

    operatingLineItems.push(...workingCapitalChanges.map(wc => ({
      description: wc.description,
      amount: wc.amount,
      isSubtotal: false,
    })));

    const netCashFromOperations = operatingLineItems.reduce((sum, item) => sum + item.amount, 0);

    // Build Investing Activities Section
    const investingLineItems: CashFlowLineItem[] = [];

    // Get investing activities from accounts marked with cashFlowCategory = 'INVESTING'
    const investingActivities = await this.getCashFlowActivitiesByCategory(
      'INVESTING',
      filters,
      targetSubsidiaries
    );

    for (const activity of investingActivities) {
      investingLineItems.push({
        description: activity.accountName,
        amount: activity.netChange,
        accountId: activity.accountId,
        accountNumber: activity.accountNumber,
        isSubtotal: false,
      });
    }

    // Add fixed asset changes
    if (balanceChanges.fixedAssets !== 0) {
      investingLineItems.push({
        description: 'Purchase/Sale of Fixed Assets',
        amount: -balanceChanges.fixedAssets,
        isSubtotal: false,
      });
    }

    const netCashFromInvesting = investingLineItems.reduce((sum, item) => sum + item.amount, 0);

    // Build Financing Activities Section
    const financingLineItems: CashFlowLineItem[] = [];

    // Get financing activities from accounts marked with cashFlowCategory = 'FINANCING'
    const financingActivities = await this.getCashFlowActivitiesByCategory(
      'FINANCING',
      filters,
      targetSubsidiaries
    );

    for (const activity of financingActivities) {
      financingLineItems.push({
        description: activity.accountName,
        amount: activity.netChange,
        accountId: activity.accountId,
        accountNumber: activity.accountNumber,
        isSubtotal: false,
      });
    }

    // Add long-term debt and equity changes
    if (balanceChanges.longTermDebt !== 0) {
      financingLineItems.push({
        description: 'Proceeds/Payments on Long-Term Debt',
        amount: balanceChanges.longTermDebt,
        isSubtotal: false,
      });
    }

    if (balanceChanges.commonStock !== 0) {
      financingLineItems.push({
        description: 'Issuance/Repurchase of Common Stock',
        amount: balanceChanges.commonStock,
        isSubtotal: false,
      });
    }

    if (balanceChanges.dividends !== 0) {
      financingLineItems.push({
        description: 'Dividends Paid',
        amount: -balanceChanges.dividends,
        isSubtotal: false,
      });
    }

    const netCashFromFinancing = financingLineItems.reduce((sum, item) => sum + item.amount, 0);

    // Calculate totals
    const netChangeInCash = netCashFromOperations + netCashFromInvesting + netCashFromFinancing;
    const endingCashBalance = beginningCashBalance + netChangeInCash;

    // Determine cash flow trend
    let cashFlowTrend: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    if (netChangeInCash > 0) {
      cashFlowTrend = 'POSITIVE';
    } else if (netChangeInCash < 0) {
      cashFlowTrend = 'NEGATIVE';
    } else {
      cashFlowTrend = 'NEUTRAL';
    }

    // Get subsidiary name
    let subsidiaryName = 'All Subsidiaries';
    if (filters.subsidiaryId) {
      const [subInfo] = await this.db
        .select({ name: subsidiaries.name })
        .from(subsidiaries)
        .where(eq(subsidiaries.id, filters.subsidiaryId))
        .limit(1);
      subsidiaryName = subInfo?.name || '';
    }

    return {
      reportName: 'Cash Flow Statement',
      reportType: 'CASH_FLOW_STATEMENT' as const,
      periodName: periodInfo.periodName,
      periodId: filters.periodId,
      subsidiaryName,
      periodStartDate: periodInfo.startDate,
      periodEndDate: periodInfo.endDate,
      generatedAt: new Date().toISOString(),

      beginningCashBalance,

      operatingActivities: {
        sectionName: 'Cash Flows from Operating Activities',
        category: 'OPERATING' as CashFlowCategoryType,
        lineItems: operatingLineItems,
        sectionTotal: netCashFromOperations,
      },
      netCashFromOperations,

      investingActivities: {
        sectionName: 'Cash Flows from Investing Activities',
        category: 'INVESTING' as CashFlowCategoryType,
        lineItems: investingLineItems.length > 0 ? investingLineItems : [{ description: 'No investing activities', amount: 0, isSubtotal: false }],
        sectionTotal: netCashFromInvesting,
      },
      netCashFromInvesting,

      financingActivities: {
        sectionName: 'Cash Flows from Financing Activities',
        category: 'FINANCING' as CashFlowCategoryType,
        lineItems: financingLineItems.length > 0 ? financingLineItems : [{ description: 'No financing activities', amount: 0, isSubtotal: false }],
        sectionTotal: netCashFromFinancing,
      },
      netCashFromFinancing,

      netChangeInCash,
      endingCashBalance,
      cashFlowTrend,

      // Reconciliation check: ending balance should equal beginning + net change
      reconciliationDifference: Math.abs(endingCashBalance - (beginningCashBalance + netChangeInCash)),
    };
  }

  /**
   * Get beginning cash balance for cash flow statement
   */
  private async getBeginningCashBalance(
    filters: CashFlowStatementFilters,
    organizationId: string,
    targetSubsidiaries: string[]
  ): Promise<number> {
    // Get cash accounts (typically current assets with subcategory containing 'cash')
    const whereConditions = [
      eq(glAccountBalances.periodId, filters.periodId),
      inArray(glAccountBalances.subsidiaryId, targetSubsidiaries),
      eq(accounts.accountCategory, 'Asset'),
    ];

    if (filters.classId) {
      whereConditions.push(eq(glAccountBalances.classId, filters.classId));
    }
    if (filters.departmentId) {
      whereConditions.push(eq(glAccountBalances.departmentId, filters.departmentId));
    }
    if (filters.locationId) {
      whereConditions.push(eq(glAccountBalances.locationId, filters.locationId));
    }

    const results = await this.db
      .select({
        beginningBalanceDebit: sql<string>`SUM(${glAccountBalances.beginningBalanceDebit})`,
        beginningBalanceCredit: sql<string>`SUM(${glAccountBalances.beginningBalanceCredit})`,
      })
      .from(glAccountBalances)
      .innerJoin(accounts, eq(glAccountBalances.accountId, accounts.id))
      .where(
        and(
          ...whereConditions,
          or(
            sql`LOWER(${accounts.accountSubcategory}) LIKE '%cash%'`,
            sql`LOWER(${accounts.accountName}) LIKE '%cash%'`,
            sql`LOWER(${accounts.accountName}) LIKE '%bank%'`
          )
        )
      );

    const row = results[0];
    if (!row) return 0;

    const beginningDebit = Number(row.beginningBalanceDebit || 0);
    const beginningCredit = Number(row.beginningBalanceCredit || 0);

    return beginningDebit - beginningCredit;
  }

  /**
   * Get balance sheet account changes for cash flow adjustments
   */
  private async getBalanceSheetChanges(
    filters: CashFlowStatementFilters,
    organizationId: string,
    targetSubsidiaries: string[]
  ): Promise<{
    depreciation: number;
    accountsReceivable: number;
    inventory: number;
    prepaidExpenses: number;
    accountsPayable: number;
    accruedLiabilities: number;
    fixedAssets: number;
    longTermDebt: number;
    commonStock: number;
    dividends: number;
  }> {
    const whereConditions = [
      eq(glAccountBalances.periodId, filters.periodId),
      inArray(glAccountBalances.subsidiaryId, targetSubsidiaries),
    ];

    if (filters.classId) {
      whereConditions.push(eq(glAccountBalances.classId, filters.classId));
    }
    if (filters.departmentId) {
      whereConditions.push(eq(glAccountBalances.departmentId, filters.departmentId));
    }
    if (filters.locationId) {
      whereConditions.push(eq(glAccountBalances.locationId, filters.locationId));
    }

    // Get account changes by subcategory
    const results = await this.db
      .select({
        accountSubcategory: accounts.accountSubcategory,
        accountCategory: accounts.accountCategory,
        accountName: accounts.accountName,
        beginningBalanceDebit: sql<string>`SUM(${glAccountBalances.beginningBalanceDebit})`,
        beginningBalanceCredit: sql<string>`SUM(${glAccountBalances.beginningBalanceCredit})`,
        endingBalanceDebit: sql<string>`SUM(${glAccountBalances.endingBalanceDebit})`,
        endingBalanceCredit: sql<string>`SUM(${glAccountBalances.endingBalanceCredit})`,
        periodDebitAmount: sql<string>`SUM(${glAccountBalances.periodDebitAmount})`,
        periodCreditAmount: sql<string>`SUM(${glAccountBalances.periodCreditAmount})`,
      })
      .from(glAccountBalances)
      .innerJoin(accounts, eq(glAccountBalances.accountId, accounts.id))
      .where(and(...whereConditions))
      .groupBy(accounts.accountSubcategory, accounts.accountCategory, accounts.accountName);

    // Calculate changes for each category
    let depreciation = 0;
    let accountsReceivable = 0;
    let inventory = 0;
    let prepaidExpenses = 0;
    let accountsPayable = 0;
    let accruedLiabilities = 0;
    let fixedAssets = 0;
    let longTermDebt = 0;
    let commonStock = 0;
    let dividends = 0;

    for (const row of results) {
      const subcategory = (row.accountSubcategory || '').toUpperCase();
      const accountName = (row.accountName || '').toUpperCase();
      const category = row.accountCategory;

      const beginningDebit = Number(row.beginningBalanceDebit || 0);
      const beginningCredit = Number(row.beginningBalanceCredit || 0);
      const endingDebit = Number(row.endingBalanceDebit || 0);
      const endingCredit = Number(row.endingBalanceCredit || 0);
      const periodDebit = Number(row.periodDebitAmount || 0);
      const periodCredit = Number(row.periodCreditAmount || 0);

      // Calculate net change based on normal balance
      let beginningBalance: number;
      let endingBalance: number;
      let periodChange: number;

      if (category === 'Asset') {
        beginningBalance = beginningDebit - beginningCredit;
        endingBalance = endingDebit - endingCredit;
        periodChange = endingBalance - beginningBalance;
      } else {
        beginningBalance = beginningCredit - beginningDebit;
        endingBalance = endingCredit - endingDebit;
        periodChange = endingBalance - beginningBalance;
      }

      // Categorize changes
      if (accountName.includes('DEPREC') || accountName.includes('AMORTIZ')) {
        depreciation += periodCredit - periodDebit; // Depreciation increases with credits
      } else if (subcategory.includes('RECEIV') || accountName.includes('RECEIV')) {
        accountsReceivable += periodChange;
      } else if (subcategory.includes('INVENTOR') || accountName.includes('INVENTOR')) {
        inventory += periodChange;
      } else if (subcategory.includes('PREPAID') || accountName.includes('PREPAID')) {
        prepaidExpenses += periodChange;
      } else if (subcategory.includes('PAYABLE') || accountName.includes('ACCOUNTS PAYABLE')) {
        accountsPayable += periodChange;
      } else if (subcategory.includes('ACCRUED') || accountName.includes('ACCRUED')) {
        accruedLiabilities += periodChange;
      } else if (subcategory.includes('FIXED') || subcategory.includes('PROPERTY') || subcategory.includes('EQUIPMENT')) {
        fixedAssets += periodChange;
      } else if (subcategory.includes('LONG') && category === 'Liability') {
        longTermDebt += periodChange;
      } else if (subcategory.includes('COMMON') || subcategory.includes('CAPITAL')) {
        commonStock += periodChange;
      } else if (accountName.includes('DIVIDEND')) {
        dividends += Math.abs(periodDebit - periodCredit);
      }
    }

    return {
      depreciation,
      accountsReceivable,
      inventory,
      prepaidExpenses,
      accountsPayable,
      accruedLiabilities,
      fixedAssets,
      longTermDebt,
      commonStock,
      dividends,
    };
  }

  /**
   * Get cash flow activities by category (OPERATING, INVESTING, FINANCING)
   */
  private async getCashFlowActivitiesByCategory(
    category: CashFlowCategoryType,
    filters: CashFlowStatementFilters,
    targetSubsidiaries: string[]
  ): Promise<Array<{
    accountId: string;
    accountNumber: string;
    accountName: string;
    netChange: number;
  }>> {
    const whereConditions = [
      eq(glAccountBalances.periodId, filters.periodId),
      inArray(glAccountBalances.subsidiaryId, targetSubsidiaries),
      eq(accounts.cashFlowCategory, category),
    ];

    if (filters.classId) {
      whereConditions.push(eq(glAccountBalances.classId, filters.classId));
    }
    if (filters.departmentId) {
      whereConditions.push(eq(glAccountBalances.departmentId, filters.departmentId));
    }
    if (filters.locationId) {
      whereConditions.push(eq(glAccountBalances.locationId, filters.locationId));
    }

    const results = await this.db
      .select({
        accountId: glAccountBalances.accountId,
        accountNumber: accounts.accountNumber,
        accountName: accounts.accountName,
        accountCategory: accounts.accountCategory,
        periodDebitAmount: sql<string>`SUM(${glAccountBalances.periodDebitAmount})`,
        periodCreditAmount: sql<string>`SUM(${glAccountBalances.periodCreditAmount})`,
      })
      .from(glAccountBalances)
      .innerJoin(accounts, eq(glAccountBalances.accountId, accounts.id))
      .where(and(...whereConditions))
      .groupBy(
        glAccountBalances.accountId,
        accounts.accountNumber,
        accounts.accountName,
        accounts.accountCategory
      )
      .orderBy(asc(accounts.accountNumber));

    return results.map(row => {
      const periodDebit = Number(row.periodDebitAmount || 0);
      const periodCredit = Number(row.periodCreditAmount || 0);

      // For cash flow, we want the net effect on cash
      // Assets: increase (debit) = cash outflow (negative)
      // Liabilities/Equity: increase (credit) = cash inflow (positive)
      let netChange: number;
      if (row.accountCategory === 'Asset') {
        netChange = periodCredit - periodDebit; // Asset increase = cash decrease
      } else {
        netChange = periodCredit - periodDebit; // Liability/Equity increase = cash increase
      }

      return {
        accountId: row.accountId,
        accountNumber: row.accountNumber,
        accountName: row.accountName,
        netChange,
      };
    }).filter(item => item.netChange !== 0);
  }

  /**
   * Empty cash flow statement structure
   */
  private emptyCashFlowStatement() {
    return {
      reportName: 'Cash Flow Statement',
      reportType: 'CASH_FLOW_STATEMENT' as const,
      periodName: '',
      periodId: '',
      subsidiaryName: '',
      periodStartDate: '',
      periodEndDate: '',
      generatedAt: new Date().toISOString(),

      beginningCashBalance: 0,

      operatingActivities: {
        sectionName: 'Cash Flows from Operating Activities',
        category: 'OPERATING' as CashFlowCategoryType,
        lineItems: [],
        sectionTotal: 0,
      },
      netCashFromOperations: 0,

      investingActivities: {
        sectionName: 'Cash Flows from Investing Activities',
        category: 'INVESTING' as CashFlowCategoryType,
        lineItems: [],
        sectionTotal: 0,
      },
      netCashFromInvesting: 0,

      financingActivities: {
        sectionName: 'Cash Flows from Financing Activities',
        category: 'FINANCING' as CashFlowCategoryType,
        lineItems: [],
        sectionTotal: 0,
      },
      netCashFromFinancing: 0,

      netChangeInCash: 0,
      endingCashBalance: 0,
      cashFlowTrend: 'NEUTRAL' as const,
      reconciliationDifference: 0,
    };
  }

  /**
   * Empty income statement structure
   */
  private emptyIncomeStatement() {
    return {
      reportName: 'Income Statement',
      periodName: '',
      subsidiaryName: '',
      asOfDate: '',
      revenueSection: { name: 'Revenue', category: 'Revenue' as AccountCategory, lineItems: [], sectionTotal: 0 },
      totalRevenue: 0,
      cogsSection: { name: 'Cost of Goods Sold', category: 'COGS' as AccountCategory, lineItems: [], sectionTotal: 0 },
      totalCogs: 0,
      grossProfit: 0,
      grossProfitMargin: 0,
      operatingExpensesSection: { name: 'Operating Expenses', category: 'Expense' as AccountCategory, lineItems: [], sectionTotal: 0 },
      totalOperatingExpenses: 0,
      operatingIncome: 0,
      operatingMargin: 0,
      netIncome: 0,
      netProfitMargin: 0,
    };
  }

  /**
   * Empty balance sheet structure
   */
  private emptyBalanceSheet() {
    return {
      reportName: 'Balance Sheet',
      periodName: '',
      subsidiaryName: '',
      asOfDate: '',
      currentAssetsSection: { name: 'Current Assets', category: 'Asset' as AccountCategory, lineItems: [], sectionTotal: 0 },
      totalCurrentAssets: 0,
      nonCurrentAssetsSection: { name: 'Non-Current Assets', category: 'Asset' as AccountCategory, lineItems: [], sectionTotal: 0 },
      totalNonCurrentAssets: 0,
      totalAssets: 0,
      currentLiabilitiesSection: { name: 'Current Liabilities', category: 'Liability' as AccountCategory, lineItems: [], sectionTotal: 0 },
      totalCurrentLiabilities: 0,
      longTermLiabilitiesSection: { name: 'Long-Term Liabilities', category: 'Liability' as AccountCategory, lineItems: [], sectionTotal: 0 },
      totalLongTermLiabilities: 0,
      totalLiabilities: 0,
      equitySection: { name: 'Equity', category: 'Equity' as AccountCategory, lineItems: [], sectionTotal: 0 },
      retainedEarnings: 0,
      currentPeriodNetIncome: 0,
      totalEquity: 0,
      totalLiabilitiesAndEquity: 0,
      balanceCheck: 0,
    };
  }
}