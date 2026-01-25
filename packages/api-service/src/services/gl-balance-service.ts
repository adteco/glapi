/**
 * GL Balance Service
 *
 * Provides fast access to pre-calculated account balances from the projection system.
 * These balances are maintained in real-time by the balance projection worker.
 *
 * For ad-hoc balance calculations from transactions, use GlReportingService instead.
 */

import { BaseService } from './base-service';
import { ServiceError } from '../types';
import { db, glAccountBalances, eq, and, sql } from '@glapi/database';

// ============================================================================
// Types
// ============================================================================

export interface AccountBalance {
  accountId: string;
  subsidiaryId: string;
  periodId: string;
  currencyCode: string;
  beginningBalanceDebit: number;
  beginningBalanceCredit: number;
  periodDebitAmount: number;
  periodCreditAmount: number;
  endingBalanceDebit: number;
  endingBalanceCredit: number;
  ytdDebitAmount: number;
  ytdCreditAmount: number;
  // Computed fields
  beginningNetBalance: number;
  periodNetActivity: number;
  endingNetBalance: number;
  ytdNetActivity: number;
  // Dimension filters (optional)
  classId?: string;
  departmentId?: string;
  locationId?: string;
}

export interface AccountBalanceQuery {
  accountId?: string;
  accountIds?: string[];
  subsidiaryId?: string;
  periodId: string;
  currencyCode?: string;
  classId?: string;
  departmentId?: string;
  locationId?: string;
}

export interface TrialBalanceRow {
  accountId: string;
  accountNumber?: string;
  accountName?: string;
  accountType?: string;
  debitBalance: number;
  creditBalance: number;
  netBalance: number;
}

export interface TrialBalanceResult {
  periodId: string;
  subsidiaryId?: string;
  asOfDate: string;
  rows: TrialBalanceRow[];
  totals: {
    totalDebits: number;
    totalCredits: number;
    difference: number;
    isBalanced: boolean;
  };
}

export interface BalanceComparisonResult {
  accountId: string;
  currentPeriod: {
    periodId: string;
    endingDebitBalance: number;
    endingCreditBalance: number;
    netBalance: number;
  };
  priorPeriod: {
    periodId: string;
    endingDebitBalance: number;
    endingCreditBalance: number;
    netBalance: number;
  };
  variance: {
    debitChange: number;
    creditChange: number;
    netChange: number;
    percentChange: number | null;
  };
}

// ============================================================================
// Service Implementation
// ============================================================================

export class GlBalanceService extends BaseService {
  constructor(context = {}) {
    super(context);
  }

  /**
   * Get account balance for a specific account, period, and optional dimensions
   */
  async getAccountBalance(query: AccountBalanceQuery): Promise<AccountBalance | null> {
    const organizationId = this.requireOrganizationContext();

    if (!query.accountId && !query.accountIds?.length) {
      throw new ServiceError(
        'Account ID or account IDs are required',
        'MISSING_ACCOUNT_ID',
        400
      );
    }

    if (!query.periodId) {
      throw new ServiceError(
        'Period ID is required',
        'MISSING_PERIOD_ID',
        400
      );
    }

    try {
      const conditions = [
        eq(glAccountBalances.organizationId, organizationId),
        eq(glAccountBalances.periodId, query.periodId),
      ];

      if (query.accountId) {
        conditions.push(eq(glAccountBalances.accountId, query.accountId));
      }
      if (query.subsidiaryId) {
        conditions.push(eq(glAccountBalances.subsidiaryId, query.subsidiaryId));
      }
      if (query.currencyCode) {
        conditions.push(eq(glAccountBalances.currencyCode, query.currencyCode));
      }

      const result = await db
        .select()
        .from(glAccountBalances)
        .where(and(...conditions))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const row = result[0];
      return this.transformBalanceRow(row);
    } catch (error) {
      throw new ServiceError(
        `Failed to get account balance: ${error instanceof Error ? error.message : String(error)}`,
        'BALANCE_RETRIEVAL_FAILED',
        500
      );
    }
  }

  /**
   * Get balances for multiple accounts in a period
   */
  async getAccountBalances(query: AccountBalanceQuery): Promise<AccountBalance[]> {
    const organizationId = this.requireOrganizationContext();

    if (!query.periodId) {
      throw new ServiceError(
        'Period ID is required',
        'MISSING_PERIOD_ID',
        400
      );
    }

    try {
      const conditions = [
        eq(glAccountBalances.organizationId, organizationId),
        eq(glAccountBalances.periodId, query.periodId),
      ];

      if (query.subsidiaryId) {
        conditions.push(eq(glAccountBalances.subsidiaryId, query.subsidiaryId));
      }
      if (query.currencyCode) {
        conditions.push(eq(glAccountBalances.currencyCode, query.currencyCode));
      }

      const results = await db
        .select()
        .from(glAccountBalances)
        .where(and(...conditions))
        .orderBy(glAccountBalances.accountId);

      return results.map((row) => this.transformBalanceRow(row));
    } catch (error) {
      throw new ServiceError(
        `Failed to get account balances: ${error instanceof Error ? error.message : String(error)}`,
        'BALANCES_RETRIEVAL_FAILED',
        500
      );
    }
  }

  /**
   * Get trial balance from projected balances (fast)
   */
  async getTrialBalance(
    periodId: string,
    subsidiaryId?: string,
    currencyCode?: string
  ): Promise<TrialBalanceResult> {
    const organizationId = this.requireOrganizationContext();

    if (!periodId) {
      throw new ServiceError(
        'Period ID is required',
        'MISSING_PERIOD_ID',
        400
      );
    }

    try {
      const conditions = [
        eq(glAccountBalances.organizationId, organizationId),
        eq(glAccountBalances.periodId, periodId),
      ];

      if (subsidiaryId) {
        conditions.push(eq(glAccountBalances.subsidiaryId, subsidiaryId));
      }
      if (currencyCode) {
        conditions.push(eq(glAccountBalances.currencyCode, currencyCode));
      }

      // Aggregate balances by account
      const results = await db
        .select({
          accountId: glAccountBalances.accountId,
          totalDebit: sql<string>`SUM(${glAccountBalances.endingBalanceDebit})`,
          totalCredit: sql<string>`SUM(${glAccountBalances.endingBalanceCredit})`,
        })
        .from(glAccountBalances)
        .where(and(...conditions))
        .groupBy(glAccountBalances.accountId)
        .orderBy(glAccountBalances.accountId);

      let totalDebits = 0;
      let totalCredits = 0;

      const rows: TrialBalanceRow[] = results.map((row) => {
        const debitBalance = parseFloat(row.totalDebit) || 0;
        const creditBalance = parseFloat(row.totalCredit) || 0;

        totalDebits += debitBalance;
        totalCredits += creditBalance;

        return {
          accountId: row.accountId,
          debitBalance,
          creditBalance,
          netBalance: debitBalance - creditBalance,
        };
      });

      const difference = totalDebits - totalCredits;

      return {
        periodId,
        subsidiaryId,
        asOfDate: new Date().toISOString(),
        rows,
        totals: {
          totalDebits,
          totalCredits,
          difference,
          isBalanced: Math.abs(difference) < 0.01, // Allow for rounding
        },
      };
    } catch (error) {
      throw new ServiceError(
        `Failed to get trial balance: ${error instanceof Error ? error.message : String(error)}`,
        'TRIAL_BALANCE_FAILED',
        500
      );
    }
  }

  /**
   * Compare balances between two periods
   */
  async compareBalances(
    accountId: string,
    currentPeriodId: string,
    priorPeriodId: string,
    subsidiaryId?: string
  ): Promise<BalanceComparisonResult | null> {
    // Note: Organization context is verified by the getAccountBalance calls below
    this.requireOrganizationContext();

    try {
      const [currentBalance, priorBalance] = await Promise.all([
        this.getAccountBalance({
          accountId,
          periodId: currentPeriodId,
          subsidiaryId,
        }),
        this.getAccountBalance({
          accountId,
          periodId: priorPeriodId,
          subsidiaryId,
        }),
      ]);

      if (!currentBalance && !priorBalance) {
        return null;
      }

      const current = {
        periodId: currentPeriodId,
        endingDebitBalance: currentBalance?.endingBalanceDebit ?? 0,
        endingCreditBalance: currentBalance?.endingBalanceCredit ?? 0,
        netBalance: currentBalance?.endingNetBalance ?? 0,
      };

      const prior = {
        periodId: priorPeriodId,
        endingDebitBalance: priorBalance?.endingBalanceDebit ?? 0,
        endingCreditBalance: priorBalance?.endingBalanceCredit ?? 0,
        netBalance: priorBalance?.endingNetBalance ?? 0,
      };

      const debitChange = current.endingDebitBalance - prior.endingDebitBalance;
      const creditChange = current.endingCreditBalance - prior.endingCreditBalance;
      const netChange = current.netBalance - prior.netBalance;
      const percentChange =
        prior.netBalance !== 0
          ? ((current.netBalance - prior.netBalance) / Math.abs(prior.netBalance)) * 100
          : null;

      return {
        accountId,
        currentPeriod: current,
        priorPeriod: prior,
        variance: {
          debitChange,
          creditChange,
          netChange,
          percentChange,
        },
      };
    } catch (error) {
      throw new ServiceError(
        `Failed to compare balances: ${error instanceof Error ? error.message : String(error)}`,
        'BALANCE_COMPARISON_FAILED',
        500
      );
    }
  }

  /**
   * Get projection lag information
   * Returns the time difference between the latest event and the last projected balance
   */
  async getProjectionLag(): Promise<{
    latestEventSequence: number;
    lastProjectedSequence: number;
    lag: number;
    isUpToDate: boolean;
  }> {
    const organizationId = this.requireOrganizationContext();

    try {
      // Get the latest balance update time for this organization
      const latestBalance = await db
        .select({
          lastUpdated: sql<Date>`MAX(${glAccountBalances.lastUpdated})`,
        })
        .from(glAccountBalances)
        .where(eq(glAccountBalances.organizationId, organizationId));

      // For now, return a simplified response
      // In production, this would compare against the event store's latest sequence
      return {
        latestEventSequence: 0,
        lastProjectedSequence: 0,
        lag: 0,
        isUpToDate: true,
      };
    } catch (error) {
      throw new ServiceError(
        `Failed to get projection lag: ${error instanceof Error ? error.message : String(error)}`,
        'PROJECTION_LAG_FAILED',
        500
      );
    }
  }

  /**
   * Transform database row to AccountBalance type
   */
  private transformBalanceRow(row: typeof glAccountBalances.$inferSelect): AccountBalance {
    const beginningDebit = parseFloat(row.beginningBalanceDebit) || 0;
    const beginningCredit = parseFloat(row.beginningBalanceCredit) || 0;
    const periodDebit = parseFloat(row.periodDebitAmount) || 0;
    const periodCredit = parseFloat(row.periodCreditAmount) || 0;
    const endingDebit = parseFloat(row.endingBalanceDebit) || 0;
    const endingCredit = parseFloat(row.endingBalanceCredit) || 0;
    const ytdDebit = parseFloat(row.ytdDebitAmount) || 0;
    const ytdCredit = parseFloat(row.ytdCreditAmount) || 0;

    return {
      accountId: row.accountId,
      subsidiaryId: row.subsidiaryId,
      periodId: row.periodId,
      currencyCode: row.currencyCode,
      beginningBalanceDebit: beginningDebit,
      beginningBalanceCredit: beginningCredit,
      periodDebitAmount: periodDebit,
      periodCreditAmount: periodCredit,
      endingBalanceDebit: endingDebit,
      endingBalanceCredit: endingCredit,
      ytdDebitAmount: ytdDebit,
      ytdCreditAmount: ytdCredit,
      // Computed fields
      beginningNetBalance: beginningDebit - beginningCredit,
      periodNetActivity: periodDebit - periodCredit,
      endingNetBalance: endingDebit - endingCredit,
      ytdNetActivity: ytdDebit - ytdCredit,
      // Dimensions
      classId: row.classId ?? undefined,
      departmentId: row.departmentId ?? undefined,
      locationId: row.locationId ?? undefined,
    };
  }
}
