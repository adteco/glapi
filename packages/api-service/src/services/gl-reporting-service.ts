import { BaseService } from './base-service';
import { 
  GlTransaction,
  GlTransactionLine,
  PaginationParams, 
  PaginatedResult,
  ServiceError
} from '../types';
import { glReportingRepository } from '@glapi/database/repositories';
import type { 
  GlTransactionPaginationParams, 
  GlTransactionFilters,
  AccountActivityFilters,
  TrialBalanceFilters 
} from '@glapi/database/repositories/gl-reporting-repository';

export interface TrialBalanceRequest {
  subsidiaryId?: string;
  periodId: string;
  includeInactive?: boolean;
  classId?: string;
  departmentId?: string;
  locationId?: string;
}

export interface TrialBalanceEntry {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  debitBalance: number;
  creditBalance: number;
  netBalance: number;
  periodActivity: {
    debits: number;
    credits: number;
    net: number;
  };
  ytdActivity: {
    debits: number;
    credits: number;
    net: number;
  };
}

export interface TrialBalanceReport {
  periodName: string;
  subsidiaryName: string;
  asOfDate: string;
  entries: TrialBalanceEntry[];
  totals: {
    totalDebits: number;
    totalCredits: number;
    difference: number;
  };
}

export interface AccountActivityRequest {
  accountId: string;
  subsidiaryId?: string;
  dateFrom: string | Date;
  dateTo: string | Date;
  classId?: string;
  departmentId?: string;
  locationId?: string;
}

export interface AccountActivityEntry {
  date: string;
  transactionNumber: string;
  description: string;
  reference: string;
  debitAmount: number;
  creditAmount: number;
  runningBalance: number;
  glTransactionId: string;
  sourceTransactionId?: string;
}

export interface GeneralLedgerRequest {
  subsidiaryId?: string;
  periodId?: string;
  dateFrom?: string | Date;
  dateTo?: string | Date;
  accountIds?: string[];
  includeAdjustments?: boolean;
  groupBy?: 'account' | 'date' | 'transaction';
}

export interface GeneralLedgerEntry {
  glTransactionId: string;
  transactionNumber: string;
  transactionDate: string;
  postingDate: string;
  description: string;
  accountId: string;
  accountNumber: string;
  accountName: string;
  debitAmount: number;
  creditAmount: number;
  reference1?: string;
  reference2?: string;
  classId?: string;
  departmentId?: string;
  locationId?: string;
}

export class GlReportingService extends BaseService {
  
  constructor(context = {}) {
    super(context);
  }

  /**
   * Generate trial balance report
   */
  async getTrialBalance(request: TrialBalanceRequest): Promise<TrialBalanceReport> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate request
    if (!request.periodId) {
      throw new ServiceError(
        'Period ID is required for trial balance',
        'MISSING_PERIOD_ID',
        400
      );
    }

    try {
      const filters: TrialBalanceFilters = {
        periodId: request.periodId,
        subsidiaryId: request.subsidiaryId,
        includeInactive: request.includeInactive,
        classId: request.classId,
        departmentId: request.departmentId,
        locationId: request.locationId,
      };
      
      const result = await glReportingRepository.getTrialBalance(filters, organizationId);
      
      return {
        periodName: result.periodName,
        subsidiaryName: result.subsidiaryName,
        asOfDate: result.asOfDate,
        entries: result.entries,
        totals: result.totals,
      };
    } catch (error) {
      throw new ServiceError(
        `Failed to generate trial balance: ${error.message}`,
        'TRIAL_BALANCE_FAILED',
        500
      );
    }
  }

  /**
   * Get account activity (account ledger)
   */
  async getAccountActivity(
    request: AccountActivityRequest,
    params: PaginationParams = {}
  ): Promise<PaginatedResult<AccountActivityEntry>> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate request
    if (!request.accountId) {
      throw new ServiceError(
        'Account ID is required',
        'MISSING_ACCOUNT_ID',
        400
      );
    }

    if (!request.dateFrom || !request.dateTo) {
      throw new ServiceError(
        'Date range is required',
        'MISSING_DATE_RANGE',
        400
      );
    }

    try {
      const filters: AccountActivityFilters = {
        accountId: request.accountId,
        subsidiaryId: request.subsidiaryId,
        dateFrom: request.dateFrom,
        dateTo: request.dateTo,
        classId: request.classId,
        departmentId: request.departmentId,
        locationId: request.locationId,
      };
      
      const result = await glReportingRepository.getAccountActivity(
        filters,
        organizationId,
        {
          page: params.page,
          limit: params.limit,
        }
      );
      
      return {
        data: result.data.map(entry => ({
          date: entry.date,
          transactionNumber: entry.transactionNumber,
          description: entry.description,
          reference: entry.reference,
          debitAmount: entry.debitAmount,
          creditAmount: entry.creditAmount,
          runningBalance: entry.runningBalance,
          glTransactionId: entry.glTransactionId,
          sourceTransactionId: entry.sourceTransactionId,
        })),
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      };
    } catch (error) {
      throw new ServiceError(
        `Failed to get account activity: ${error.message}`,
        'ACCOUNT_ACTIVITY_FAILED',
        500
      );
    }
  }

  /**
   * Get general ledger entries
   */
  async getGeneralLedger(
    request: GeneralLedgerRequest,
    params: PaginationParams = {}
  ): Promise<PaginatedResult<GeneralLedgerEntry>> {
    const organizationId = this.requireOrganizationContext();
    
    try {
      const filters = {
        subsidiaryId: request.subsidiaryId,
        periodId: request.periodId,
        dateFrom: request.dateFrom,
        dateTo: request.dateTo,
        accountIds: request.accountIds,
        includeAdjustments: request.includeAdjustments,
        groupBy: request.groupBy,
      };
      
      const result = await glReportingRepository.getGeneralLedger(
        filters,
        organizationId,
        {
          page: params.page,
          limit: params.limit,
        }
      );
      
      return {
        data: result.data.map(entry => ({
          glTransactionId: entry.glTransactionId,
          transactionNumber: entry.transactionNumber,
          transactionDate: entry.transactionDate,
          postingDate: entry.postingDate,
          description: entry.description,
          accountId: entry.accountId,
          accountNumber: entry.accountNumber,
          accountName: entry.accountName,
          debitAmount: entry.debitAmount,
          creditAmount: entry.creditAmount,
          reference1: entry.reference1,
          reference2: entry.reference2,
          classId: entry.classId,
          departmentId: entry.departmentId,
          locationId: entry.locationId,
        })),
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      };
    } catch (error) {
      throw new ServiceError(
        `Failed to get general ledger: ${error.message}`,
        'GENERAL_LEDGER_FAILED',
        500
      );
    }
  }

  /**
   * Get GL transaction details
   */
  async getGlTransactionById(id: string): Promise<GlTransaction | null> {
    const organizationId = this.requireOrganizationContext();
    
    try {
      const result = await glReportingRepository.findGlTransactionById(id, organizationId);
      
      if (!result) {
        return null;
      }
      
      return {
        id: result.id,
        transactionNumber: result.transactionNumber,
        subsidiaryId: result.subsidiaryId,
        periodId: result.periodId,
        transactionDate: result.transactionDate,
        postingDate: result.postingDate,
        transactionType: result.transactionType,
        sourceTransactionId: result.sourceTransactionId,
        description: result.description,
        totalDebitAmount: result.totalDebitAmount,
        totalCreditAmount: result.totalCreditAmount,
        currencyCode: result.currencyCode,
        status: result.status,
        isReversed: result.isReversed,
        reversalTransactionId: result.reversalTransactionId,
        createdBy: result.createdBy,
        createdDate: result.createdDate,
        modifiedBy: result.modifiedBy,
        modifiedDate: result.modifiedDate,
        auditTrail: result.auditTrail,
      };
    } catch (error) {
      throw new ServiceError(
        `Failed to get GL transaction: ${error.message}`,
        'GL_TRANSACTION_RETRIEVAL_FAILED',
        500
      );
    }
  }

  /**
   * Get GL transaction lines
   */
  async getGlTransactionLines(transactionId: string): Promise<GlTransactionLine[]> {
    const organizationId = this.requireOrganizationContext();
    
    try {
      const result = await glReportingRepository.getGlTransactionLines(transactionId, organizationId);
      
      return result.map(line => ({
        id: line.id,
        transactionId: line.transactionId,
        lineNumber: line.lineNumber,
        accountId: line.accountId,
        subsidiaryId: line.subsidiaryId,
        classId: line.classId,
        departmentId: line.departmentId,
        locationId: line.locationId,
        debitAmount: line.debitAmount,
        creditAmount: line.creditAmount,
        description: line.description,
        reference1: line.reference1,
        reference2: line.reference2,
        entityId: line.entityId,
        entityType: line.entityType,
        createdBy: line.createdBy,
        createdDate: line.createdDate,
      }));
    } catch (error) {
      throw new ServiceError(
        `Failed to get GL transaction lines: ${error.message}`,
        'GL_TRANSACTION_LINES_FAILED',
        500
      );
    }
  }

  /**
   * List GL transactions
   */
  async listGlTransactions(
    params: PaginationParams = {},
    filters: {
      subsidiaryId?: string;
      periodId?: string;
      status?: string;
      transactionType?: string;
      dateFrom?: string | Date;
      dateTo?: string | Date;
      sourceTransactionId?: string;
    } = {}
  ): Promise<PaginatedResult<GlTransaction>> {
    const organizationId = this.requireOrganizationContext();
    
    try {
      const paginationParams: GlTransactionPaginationParams = {
        page: params.page,
        limit: params.limit,
        orderBy: 'transactionDate',
        orderDirection: 'desc',
      };
      
      const glFilters: GlTransactionFilters = {
        subsidiaryId: filters.subsidiaryId,
        periodId: filters.periodId,
        status: filters.status,
        transactionType: filters.transactionType,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        sourceTransactionId: filters.sourceTransactionId,
      };
      
      const result = await glReportingRepository.findAllGlTransactions(
        organizationId,
        paginationParams,
        glFilters
      );
      
      return {
        data: result.data.map(tx => ({
          id: tx.id,
          transactionNumber: tx.transactionNumber,
          subsidiaryId: tx.subsidiaryId,
          periodId: tx.periodId,
          transactionDate: tx.transactionDate,
          postingDate: tx.postingDate,
          transactionType: tx.transactionType,
          sourceTransactionId: tx.sourceTransactionId,
          description: tx.description,
          totalDebitAmount: tx.totalDebitAmount,
          totalCreditAmount: tx.totalCreditAmount,
          currencyCode: tx.currencyCode,
          status: tx.status,
          isReversed: tx.isReversed,
          reversalTransactionId: tx.reversalTransactionId,
          createdBy: tx.createdBy,
          createdDate: tx.createdDate,
          modifiedBy: tx.modifiedBy,
          modifiedDate: tx.modifiedDate,
          auditTrail: tx.auditTrail,
        })),
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      };
    } catch (error) {
      throw new ServiceError(
        `Failed to list GL transactions: ${error.message}`,
        'GL_TRANSACTIONS_LIST_FAILED',
        500
      );
    }
  }

  /**
   * Get account balances for a period
   */
  async getAccountBalances(
    periodId: string,
    subsidiaryId?: string,
    accountIds?: string[]
  ): Promise<any[]> {
    const organizationId = this.requireOrganizationContext();
    
    // TODO: Implement account balance query
    // 1. Get account balances for period
    // 2. Filter by subsidiary if specified
    // 3. Filter by account IDs if specified
    
    throw new ServiceError(
      'Get account balances not yet implemented',
      'NOT_IMPLEMENTED',
      501
    );
  }

  /**
   * Get period summary (totals, counts, etc.)
   */
  async getPeriodSummary(periodId: string, subsidiaryId?: string): Promise<any> {
    const organizationId = this.requireOrganizationContext();
    
    // TODO: Implement period summary
    // 1. Count GL transactions for period
    // 2. Sum debits and credits
    // 3. Count by transaction type
    // 4. Get period dates and status
    
    throw new ServiceError(
      'Get period summary not yet implemented',
      'NOT_IMPLEMENTED',
      501
    );
  }

  /**
   * Validate GL integrity for a period
   */
  async validateGlIntegrity(periodId: string, subsidiaryId?: string): Promise<{
    isBalanced: boolean;
    totalDebits: number;
    totalCredits: number;
    difference: number;
    issues: string[];
  }> {
    const organizationId = this.requireOrganizationContext();
    
    // TODO: Implement GL integrity validation
    // 1. Sum all debits and credits for the period
    // 2. Check that transactions are balanced
    // 3. Verify account balance rollups match line details
    // 4. Check for orphaned lines or missing accounts
    
    throw new ServiceError(
      'GL integrity validation not yet implemented',
      'NOT_IMPLEMENTED',
      501
    );
  }
}