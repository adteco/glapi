import { BaseService } from './base-service';
import { ServiceError } from '../types';
import { ConsolidationRepository } from '@glapi/database';

// ==========================================
// Types
// ==========================================

export interface ConsolidatedBalanceSheetLine {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  balance: number;
  // Breakdown by source
  parentBalance: number;
  subsidiaryBalances: Record<string, number>;
  eliminationAdjustments: number;
  translationAdjustments: number;
  minorityInterest: number;
}

export interface ConsolidatedIncomeStatementLine {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  amount: number;
  // Breakdown by source
  parentAmount: number;
  subsidiaryAmounts: Record<string, number>;
  eliminationAdjustments: number;
  translationAdjustments: number;
  minorityInterestShare: number;
}

export interface ConsolidatedFinancialStatement {
  groupId: string;
  groupName: string;
  periodId: string;
  periodName: string;
  consolidationCurrency: string;
  asOfDate: string;
  runId?: string;
  runNumber?: number;
  runType?: 'PRELIMINARY' | 'FINAL';
  generatedAt: string;
}

export interface ConsolidatedBalanceSheet extends ConsolidatedFinancialStatement {
  assets: {
    current: ConsolidatedBalanceSheetLine[];
    nonCurrent: ConsolidatedBalanceSheetLine[];
    totalAssets: number;
  };
  liabilities: {
    current: ConsolidatedBalanceSheetLine[];
    nonCurrent: ConsolidatedBalanceSheetLine[];
    totalLiabilities: number;
  };
  equity: {
    lines: ConsolidatedBalanceSheetLine[];
    minorityInterest: number;
    totalEquity: number;
  };
  totalLiabilitiesAndEquity: number;
}

export interface ConsolidatedIncomeStatement extends ConsolidatedFinancialStatement {
  revenue: {
    lines: ConsolidatedIncomeStatementLine[];
    totalRevenue: number;
  };
  costOfSales: {
    lines: ConsolidatedIncomeStatementLine[];
    totalCostOfSales: number;
  };
  grossProfit: number;
  operatingExpenses: {
    lines: ConsolidatedIncomeStatementLine[];
    totalOperatingExpenses: number;
  };
  operatingIncome: number;
  otherIncomeExpense: {
    lines: ConsolidatedIncomeStatementLine[];
    totalOtherIncomeExpense: number;
  };
  incomeBeforeTax: number;
  taxExpense: number;
  netIncome: number;
  netIncomeAttributableToParent: number;
  netIncomeAttributableToMinorityInterest: number;
}

export interface EliminationSummary {
  eliminationType: string;
  count: number;
  totalDebit: number;
  totalCredit: number;
  netImpact: number;
}

export interface TranslationSummary {
  subsidiaryId: string;
  subsidiaryName: string;
  originalCurrency: string;
  totalOriginalAmount: number;
  totalTranslatedAmount: number;
  totalCtaAmount: number;
}

export interface ConsolidationReportFilters {
  groupId: string;
  periodId: string;
  runId?: string; // Use specific run, or latest if not specified
  includeBreakdown?: boolean; // Include subsidiary-level breakdown
  bookFilter?: string[]; // Filter to specific subsidiaries/books
}

// ==========================================
// Consolidation Reporting Service
// ==========================================

export class ConsolidationReportingService extends BaseService {
  private consolidationRepository: ConsolidationRepository;

  constructor(context: { organizationId?: string } = {}) {
    super(context);
    this.consolidationRepository = new ConsolidationRepository();
  }

  /**
   * Get consolidated balance sheet
   */
  async getConsolidatedBalanceSheet(
    filters: ConsolidationReportFilters
  ): Promise<ConsolidatedBalanceSheet> {
    const organizationId = this.requireOrganizationContext();

    // Get group details
    const group = await this.consolidationRepository.findGroupById(
      filters.groupId,
      organizationId
    );

    if (!group) {
      throw new ServiceError(
        `Consolidation group "${filters.groupId}" not found`,
        'GROUP_NOT_FOUND',
        404
      );
    }

    // Get the consolidation run (latest or specified)
    const run = await this.getConsolidationRun(filters);

    // Get group members for breakdown
    const members = await this.consolidationRepository.findMembersByGroupId(
      filters.groupId,
      { isActive: true }
    );

    // Build placeholder balance sheet structure
    // In a real implementation, this would aggregate data from:
    // 1. GL account balances for each subsidiary
    // 2. Apply consolidation adjustments from the run
    // 3. Calculate minority interest based on ownership %

    const balanceSheet: ConsolidatedBalanceSheet = {
      groupId: filters.groupId,
      groupName: group.group.name,
      periodId: filters.periodId,
      periodName: '', // Would be populated from period lookup
      consolidationCurrency: group.consolidationCurrency?.code || 'USD',
      asOfDate: new Date().toISOString().split('T')[0],
      runId: run?.id,
      runNumber: run?.runNumber,
      runType: run?.runType as 'PRELIMINARY' | 'FINAL' | undefined,
      generatedAt: new Date().toISOString(),
      assets: {
        current: [],
        nonCurrent: [],
        totalAssets: 0,
      },
      liabilities: {
        current: [],
        nonCurrent: [],
        totalLiabilities: 0,
      },
      equity: {
        lines: [],
        minorityInterest: 0,
        totalEquity: 0,
      },
      totalLiabilitiesAndEquity: 0,
    };

    return balanceSheet;
  }

  /**
   * Get consolidated income statement
   */
  async getConsolidatedIncomeStatement(
    filters: ConsolidationReportFilters
  ): Promise<ConsolidatedIncomeStatement> {
    const organizationId = this.requireOrganizationContext();

    // Get group details
    const group = await this.consolidationRepository.findGroupById(
      filters.groupId,
      organizationId
    );

    if (!group) {
      throw new ServiceError(
        `Consolidation group "${filters.groupId}" not found`,
        'GROUP_NOT_FOUND',
        404
      );
    }

    // Get the consolidation run
    const run = await this.getConsolidationRun(filters);

    // Build placeholder income statement structure
    const incomeStatement: ConsolidatedIncomeStatement = {
      groupId: filters.groupId,
      groupName: group.group.name,
      periodId: filters.periodId,
      periodName: '',
      consolidationCurrency: group.consolidationCurrency?.code || 'USD',
      asOfDate: new Date().toISOString().split('T')[0],
      runId: run?.id,
      runNumber: run?.runNumber,
      runType: run?.runType as 'PRELIMINARY' | 'FINAL' | undefined,
      generatedAt: new Date().toISOString(),
      revenue: {
        lines: [],
        totalRevenue: 0,
      },
      costOfSales: {
        lines: [],
        totalCostOfSales: 0,
      },
      grossProfit: 0,
      operatingExpenses: {
        lines: [],
        totalOperatingExpenses: 0,
      },
      operatingIncome: 0,
      otherIncomeExpense: {
        lines: [],
        totalOtherIncomeExpense: 0,
      },
      incomeBeforeTax: 0,
      taxExpense: 0,
      netIncome: 0,
      netIncomeAttributableToParent: 0,
      netIncomeAttributableToMinorityInterest: 0,
    };

    return incomeStatement;
  }

  /**
   * Get elimination summary for a consolidation run
   */
  async getEliminationSummary(runId: string): Promise<EliminationSummary[]> {
    const adjustments = await this.consolidationRepository.findAdjustmentsByRunId(
      runId,
      'ELIMINATION'
    );

    // Group by elimination type
    const summaryMap = new Map<string, EliminationSummary>();

    for (const adj of adjustments) {
      const type = adj.adjustment.eliminationRuleId || 'manual';
      const existing = summaryMap.get(type) || {
        eliminationType: type,
        count: 0,
        totalDebit: 0,
        totalCredit: 0,
        netImpact: 0,
      };

      existing.count++;
      existing.totalDebit += parseFloat(adj.adjustment.debitAmount || '0');
      existing.totalCredit += parseFloat(adj.adjustment.creditAmount || '0');
      existing.netImpact = existing.totalDebit - existing.totalCredit;

      summaryMap.set(type, existing);
    }

    return Array.from(summaryMap.values());
  }

  /**
   * Get translation summary for a consolidation run
   */
  async getTranslationSummary(runId: string): Promise<TranslationSummary[]> {
    const adjustments = await this.consolidationRepository.findAdjustmentsByRunId(
      runId,
      'TRANSLATION'
    );

    // Group by subsidiary
    const summaryMap = new Map<string, TranslationSummary>();

    for (const adj of adjustments) {
      const subsidiaryId = adj.adjustment.sourceSubsidiaryId || 'unknown';
      const existing = summaryMap.get(subsidiaryId) || {
        subsidiaryId,
        subsidiaryName: adj.sourceSubsidiary?.name || subsidiaryId,
        originalCurrency: adj.adjustment.originalCurrencyCode || 'N/A',
        totalOriginalAmount: 0,
        totalTranslatedAmount: 0,
        totalCtaAmount: 0,
      };

      existing.totalOriginalAmount += parseFloat(adj.adjustment.originalAmount || '0');
      existing.totalTranslatedAmount += parseFloat(adj.adjustment.translatedAmount || '0');
      existing.totalCtaAmount += parseFloat(adj.adjustment.ctaAmount || '0');

      summaryMap.set(subsidiaryId, existing);
    }

    return Array.from(summaryMap.values());
  }

  /**
   * Get available books/entities for filtering
   */
  async getAvailableBooks(groupId: string): Promise<
    Array<{
      id: string;
      name: string;
      code?: string;
      ownershipPercent: string;
      consolidationMethod: string;
      isParent: boolean;
    }>
  > {
    const organizationId = this.requireOrganizationContext();

    const group = await this.consolidationRepository.findGroupById(groupId, organizationId);
    if (!group) {
      throw new ServiceError(
        `Consolidation group "${groupId}" not found`,
        'GROUP_NOT_FOUND',
        404
      );
    }

    const members = await this.consolidationRepository.findMembersByGroupId(groupId, {
      isActive: true,
    });

    return members.map((m) => ({
      id: m.member.subsidiaryId,
      name: m.subsidiary?.name || 'Unknown',
      code: m.subsidiary?.code || undefined,
      ownershipPercent: m.member.ownershipPercent,
      consolidationMethod: m.member.consolidationMethod,
      isParent: m.member.subsidiaryId === group.group.parentSubsidiaryId,
    }));
  }

  /**
   * Get consolidated trial balance
   */
  async getConsolidatedTrialBalance(filters: ConsolidationReportFilters): Promise<{
    groupName: string;
    periodId: string;
    runId?: string;
    generatedAt: string;
    accounts: Array<{
      accountId: string;
      accountNumber: string;
      accountName: string;
      accountType: string;
      debitBalance: number;
      creditBalance: number;
      // Breakdown
      preConsolidationDebit: number;
      preConsolidationCredit: number;
      eliminationDebit: number;
      eliminationCredit: number;
      translationDebit: number;
      translationCredit: number;
    }>;
    totals: {
      debitBalance: number;
      creditBalance: number;
      isBalanced: boolean;
    };
  }> {
    const organizationId = this.requireOrganizationContext();

    const group = await this.consolidationRepository.findGroupById(
      filters.groupId,
      organizationId
    );

    if (!group) {
      throw new ServiceError(
        `Consolidation group "${filters.groupId}" not found`,
        'GROUP_NOT_FOUND',
        404
      );
    }

    const run = await this.getConsolidationRun(filters);

    // In a real implementation, this would:
    // 1. Aggregate GL balances from all subsidiaries
    // 2. Apply elimination and translation adjustments
    // 3. Return consolidated trial balance

    return {
      groupName: group.group.name,
      periodId: filters.periodId,
      runId: run?.id,
      generatedAt: new Date().toISOString(),
      accounts: [],
      totals: {
        debitBalance: 0,
        creditBalance: 0,
        isBalanced: true,
      },
    };
  }

  /**
   * Export consolidation data (for external reporting)
   */
  async exportConsolidationData(
    filters: ConsolidationReportFilters,
    format: 'json' | 'csv' = 'json'
  ): Promise<{
    metadata: {
      groupId: string;
      groupName: string;
      periodId: string;
      runId?: string;
      exportedAt: string;
      format: string;
    };
    data: any;
  }> {
    const organizationId = this.requireOrganizationContext();

    const group = await this.consolidationRepository.findGroupById(
      filters.groupId,
      organizationId
    );

    if (!group) {
      throw new ServiceError(
        `Consolidation group "${filters.groupId}" not found`,
        'GROUP_NOT_FOUND',
        404
      );
    }

    const run = await this.getConsolidationRun(filters);
    let adjustments: any[] = [];

    if (run) {
      const adjResult = await this.consolidationRepository.findAdjustmentsByRunId(run.id);
      adjustments = adjResult.map((a) => ({
        lineNumber: a.adjustment.lineNumber,
        adjustmentType: a.adjustment.adjustmentType,
        accountNumber: a.account?.accountNumber,
        accountName: a.account?.accountName,
        description: a.adjustment.description,
        debitAmount: a.adjustment.debitAmount,
        creditAmount: a.adjustment.creditAmount,
        originalCurrency: a.adjustment.originalCurrencyCode,
        originalAmount: a.adjustment.originalAmount,
        exchangeRate: a.adjustment.exchangeRate,
        translatedAmount: a.adjustment.translatedAmount,
        ctaAmount: a.adjustment.ctaAmount,
      }));
    }

    return {
      metadata: {
        groupId: filters.groupId,
        groupName: group.group.name,
        periodId: filters.periodId,
        runId: run?.id,
        exportedAt: new Date().toISOString(),
        format,
      },
      data: format === 'csv' ? this.convertToCsv(adjustments) : adjustments,
    };
  }

  // ==========================================
  // Private Helpers
  // ==========================================

  private async getConsolidationRun(
    filters: ConsolidationReportFilters
  ): Promise<any | null> {
    if (filters.runId) {
      const run = await this.consolidationRepository.findRunById(filters.runId);
      return run?.run || null;
    }

    // Get latest completed run for the group/period
    const runs = await this.consolidationRepository.findRunsByGroupAndPeriod(
      filters.groupId,
      filters.periodId,
      { status: 'COMPLETED' }
    );

    return runs.length > 0 ? runs[0] : null;
  }

  private convertToCsv(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const rows = data.map((row) =>
      headers.map((h) => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
        return String(val);
      }).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }
}
