import { and, asc, desc, eq, sql, gte, lte, inArray, isNull, or } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { 
  glTransactions, 
  glTransactionLines,
  glAccountBalances
} from '../db/schema/gl-transactions';
import { accountingPeriods } from '../db/schema/accounting-periods';
import { subsidiaries } from '../db/schema/subsidiaries';
import { accounts } from '../db/schema/accounts';

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
}