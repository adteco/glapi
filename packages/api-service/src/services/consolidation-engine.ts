import { BaseService } from './base-service';
import { ServiceError } from '../types';
import { ConsolidationRepository } from '@glapi/database';

// ==========================================
// Types
// ==========================================

export interface ConsolidationRunInput {
  groupId: string;
  periodId: string;
  runType: 'PRELIMINARY' | 'FINAL';
  description?: string;
}

export interface ConsolidationRunResult {
  runId: string;
  runNumber: number;
  status: 'COMPLETED' | 'FAILED';
  subsidiariesProcessed: number;
  eliminationsGenerated: number;
  translationAdjustments: number;
  totalDebitAmount: number;
  totalCreditAmount: number;
  errors: string[];
  warnings: string[];
}

export interface EliminationEntry {
  sourceSubsidiaryId: string;
  targetSubsidiaryId: string;
  accountId: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  eliminationRuleId: string;
}

export interface TranslationEntry {
  sourceSubsidiaryId: string;
  accountId: string;
  description: string;
  originalCurrencyCode: string;
  originalAmount: number;
  exchangeRate: number;
  translatedAmount: number;
  ctaAmount: number;
}

interface IntercompanyBalance {
  sourceSubsidiaryId: string;
  targetSubsidiaryId: string;
  sourceAccountId: string;
  targetAccountId: string;
  balance: number;
}

interface SubsidiaryBalance {
  subsidiaryId: string;
  accountId: string;
  accountType: string;
  currencyCode: string;
  balance: number;
}

// ==========================================
// Consolidation Engine
// ==========================================

export class ConsolidationEngine extends BaseService {
  private consolidationRepository: ConsolidationRepository;

  constructor(context: { organizationId?: string } = {}) {
    super(context);
    this.consolidationRepository = new ConsolidationRepository();
  }

  /**
   * Execute a consolidation run for a group and period
   */
  async runConsolidation(input: ConsolidationRunInput): Promise<ConsolidationRunResult> {
    const organizationId = this.requireOrganizationContext();
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Validate inputs and get group configuration
    const group = await this.consolidationRepository.findGroupById(input.groupId, organizationId);
    if (!group) {
      throw new ServiceError(
        `Consolidation group "${input.groupId}" not found`,
        'GROUP_NOT_FOUND',
        404
      );
    }

    // 2. Get the next run number
    const runNumber = await this.consolidationRepository.getNextRunNumber(
      input.groupId,
      input.periodId
    );

    // 3. Create the consolidation run record
    const run = await this.consolidationRepository.createRun({
      groupId: input.groupId,
      periodId: input.periodId,
      runNumber,
      status: 'IN_PROGRESS',
      runType: input.runType,
      description: input.description,
      startedAt: new Date(),
    });

    try {
      // 4. Get group members (subsidiaries to consolidate)
      const members = await this.consolidationRepository.findMembersByGroupId(input.groupId, {
        isActive: true,
      });

      if (members.length === 0) {
        warnings.push('No active subsidiaries in consolidation group');
      }

      // 5. Get elimination rules
      const eliminationRules = await this.consolidationRepository.findEliminationRulesByGroupId(
        input.groupId,
        { isActive: true, isAutomatic: true }
      );

      // 6. Get FX translation rules
      const fxRules = await this.consolidationRepository.findFxRulesByGroupId(input.groupId);

      // 7. Generate elimination entries
      const eliminationEntries = await this.generateEliminationEntries(
        members,
        eliminationRules,
        input.periodId,
        errors,
        warnings
      );

      // 8. Generate translation adjustments
      const translationEntries = await this.generateTranslationAdjustments(
        members,
        fxRules,
        group.group.consolidationCurrencyId,
        input.periodId,
        errors,
        warnings
      );

      // 9. Calculate totals
      const totalDebitAmount =
        eliminationEntries.reduce((sum, e) => sum + e.debitAmount, 0) +
        translationEntries.reduce((sum, e) => sum + (e.translatedAmount > 0 ? e.translatedAmount : 0), 0);

      const totalCreditAmount =
        eliminationEntries.reduce((sum, e) => sum + e.creditAmount, 0) +
        translationEntries.reduce((sum, e) => sum + (e.translatedAmount < 0 ? Math.abs(e.translatedAmount) : 0), 0);

      // 10. Create adjustment records
      let lineNumber = 1;
      const adjustments: any[] = [];

      for (const entry of eliminationEntries) {
        adjustments.push({
          runId: run.id,
          adjustmentType: 'ELIMINATION',
          eliminationRuleId: entry.eliminationRuleId,
          sourceSubsidiaryId: entry.sourceSubsidiaryId,
          targetSubsidiaryId: entry.targetSubsidiaryId,
          lineNumber: lineNumber++,
          accountId: entry.accountId,
          description: entry.description,
          debitAmount: entry.debitAmount.toFixed(4),
          creditAmount: entry.creditAmount.toFixed(4),
        });
      }

      for (const entry of translationEntries) {
        adjustments.push({
          runId: run.id,
          adjustmentType: 'TRANSLATION',
          sourceSubsidiaryId: entry.sourceSubsidiaryId,
          lineNumber: lineNumber++,
          accountId: entry.accountId,
          description: entry.description,
          debitAmount: (entry.translatedAmount > 0 ? entry.translatedAmount : 0).toFixed(4),
          creditAmount: (entry.translatedAmount < 0 ? Math.abs(entry.translatedAmount) : 0).toFixed(4),
          originalCurrencyCode: entry.originalCurrencyCode,
          originalAmount: entry.originalAmount.toFixed(4),
          exchangeRate: entry.exchangeRate.toFixed(8),
          translatedAmount: entry.translatedAmount.toFixed(4),
          ctaAmount: entry.ctaAmount.toFixed(4),
        });
      }

      if (adjustments.length > 0) {
        await this.consolidationRepository.createAdjustments(adjustments);
      }

      // 11. Update run status to completed
      await this.consolidationRepository.updateRun(run.id, {
        status: 'COMPLETED',
        completedAt: new Date(),
        subsidiariesProcessed: members.length,
        eliminationsGenerated: eliminationEntries.length,
        translationAdjustments: translationEntries.length,
        totalDebitAmount: totalDebitAmount.toFixed(4),
        totalCreditAmount: totalCreditAmount.toFixed(4),
      });

      return {
        runId: run.id,
        runNumber,
        status: 'COMPLETED',
        subsidiariesProcessed: members.length,
        eliminationsGenerated: eliminationEntries.length,
        translationAdjustments: translationEntries.length,
        totalDebitAmount,
        totalCreditAmount,
        errors,
        warnings,
      };
    } catch (error) {
      // Update run status to failed
      await this.consolidationRepository.updateRun(run.id, {
        status: 'FAILED',
        completedAt: new Date(),
      });

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);

      return {
        runId: run.id,
        runNumber,
        status: 'FAILED',
        subsidiariesProcessed: 0,
        eliminationsGenerated: 0,
        translationAdjustments: 0,
        totalDebitAmount: 0,
        totalCreditAmount: 0,
        errors,
        warnings,
      };
    }
  }

  /**
   * Reverse a consolidation run
   */
  async reverseConsolidationRun(runId: string): Promise<{ success: boolean; reversalRunId: string }> {
    const run = await this.consolidationRepository.findRunById(runId);

    if (!run) {
      throw new ServiceError(`Consolidation run "${runId}" not found`, 'RUN_NOT_FOUND', 404);
    }

    if (run.run.status !== 'COMPLETED') {
      throw new ServiceError(
        `Can only reverse completed runs. Current status: ${run.run.status}`,
        'INVALID_RUN_STATUS',
        400
      );
    }

    // Create a reversal run
    const runNumber = await this.consolidationRepository.getNextRunNumber(
      run.run.groupId,
      run.run.periodId
    );

    const reversalRun = await this.consolidationRepository.createRun({
      groupId: run.run.groupId,
      periodId: run.run.periodId,
      runNumber,
      status: 'IN_PROGRESS',
      runType: run.run.runType,
      description: `Reversal of run #${run.run.runNumber}`,
      startedAt: new Date(),
    });

    try {
      // Get original adjustments
      const originalAdjustments = await this.consolidationRepository.findAdjustmentsByRunId(runId);

      // Create reversal adjustments (swap debits and credits)
      const reversalAdjustments = originalAdjustments.map((adj, index) => ({
        runId: reversalRun.id,
        adjustmentType: adj.adjustment.adjustmentType,
        eliminationRuleId: adj.adjustment.eliminationRuleId,
        sourceSubsidiaryId: adj.adjustment.sourceSubsidiaryId,
        targetSubsidiaryId: adj.adjustment.targetSubsidiaryId,
        lineNumber: index + 1,
        accountId: adj.adjustment.accountId,
        description: `Reversal: ${adj.adjustment.description || ''}`,
        // Swap debits and credits for reversal
        debitAmount: adj.adjustment.creditAmount,
        creditAmount: adj.adjustment.debitAmount,
        originalCurrencyCode: adj.adjustment.originalCurrencyCode,
        originalAmount: adj.adjustment.originalAmount
          ? (-parseFloat(adj.adjustment.originalAmount)).toFixed(4)
          : undefined,
        exchangeRate: adj.adjustment.exchangeRate,
        translatedAmount: adj.adjustment.translatedAmount
          ? (-parseFloat(adj.adjustment.translatedAmount)).toFixed(4)
          : undefined,
        ctaAmount: adj.adjustment.ctaAmount
          ? (-parseFloat(adj.adjustment.ctaAmount)).toFixed(4)
          : undefined,
      }));

      if (reversalAdjustments.length > 0) {
        await this.consolidationRepository.createAdjustments(reversalAdjustments);
      }

      // Update original run as reversed
      await this.consolidationRepository.updateRun(runId, {
        status: 'REVERSED',
        reversedAt: new Date(),
        reversedByRunId: reversalRun.id,
      });

      // Complete the reversal run
      await this.consolidationRepository.updateRun(reversalRun.id, {
        status: 'COMPLETED',
        completedAt: new Date(),
        subsidiariesProcessed: run.run.subsidiariesProcessed,
        eliminationsGenerated: reversalAdjustments.filter((a) => a.adjustmentType === 'ELIMINATION')
          .length,
        translationAdjustments: reversalAdjustments.filter((a) => a.adjustmentType === 'TRANSLATION')
          .length,
      });

      return { success: true, reversalRunId: reversalRun.id };
    } catch (error) {
      await this.consolidationRepository.updateRun(reversalRun.id, {
        status: 'FAILED',
        completedAt: new Date(),
      });
      throw error;
    }
  }

  /**
   * Get consolidation run details with adjustments
   */
  async getConsolidationRunDetails(runId: string) {
    const run = await this.consolidationRepository.findRunById(runId);

    if (!run) {
      throw new ServiceError(`Consolidation run "${runId}" not found`, 'RUN_NOT_FOUND', 404);
    }

    const adjustments = await this.consolidationRepository.findAdjustmentsByRunId(runId);

    return {
      run: {
        id: run.run.id,
        groupId: run.run.groupId,
        groupName: run.group?.name,
        periodId: run.run.periodId,
        periodName: run.period?.periodName,
        runNumber: run.run.runNumber,
        status: run.run.status,
        runType: run.run.runType,
        description: run.run.description,
        subsidiariesProcessed: run.run.subsidiariesProcessed,
        eliminationsGenerated: run.run.eliminationsGenerated,
        translationAdjustments: run.run.translationAdjustments,
        totalDebitAmount: run.run.totalDebitAmount,
        totalCreditAmount: run.run.totalCreditAmount,
        startedAt: run.run.startedAt,
        completedAt: run.run.completedAt,
        reversedAt: run.run.reversedAt,
      },
      adjustments: adjustments.map((a) => ({
        id: a.adjustment.id,
        adjustmentType: a.adjustment.adjustmentType,
        lineNumber: a.adjustment.lineNumber,
        accountId: a.adjustment.accountId,
        accountNumber: a.account?.accountNumber,
        accountName: a.account?.accountName,
        sourceSubsidiaryId: a.adjustment.sourceSubsidiaryId,
        sourceSubsidiaryName: a.sourceSubsidiary?.name,
        description: a.adjustment.description,
        debitAmount: a.adjustment.debitAmount,
        creditAmount: a.adjustment.creditAmount,
        originalCurrencyCode: a.adjustment.originalCurrencyCode,
        originalAmount: a.adjustment.originalAmount,
        exchangeRate: a.adjustment.exchangeRate,
        translatedAmount: a.adjustment.translatedAmount,
        ctaAmount: a.adjustment.ctaAmount,
      })),
      summary: {
        eliminationsByType: this.groupAdjustmentsByType(
          adjustments.filter((a) => a.adjustment.adjustmentType === 'ELIMINATION')
        ),
        translationsBySubsidiary: this.groupTranslationsBySubsidiary(
          adjustments.filter((a) => a.adjustment.adjustmentType === 'TRANSLATION')
        ),
      },
    };
  }

  /**
   * List consolidation runs for a group/period
   */
  async listConsolidationRuns(
    groupId: string,
    periodId: string,
    filters: { status?: string; runType?: string } = {}
  ) {
    const runs = await this.consolidationRepository.findRunsByGroupAndPeriod(
      groupId,
      periodId,
      filters as any
    );

    return runs.map((run) => ({
      id: run.id,
      runNumber: run.runNumber,
      status: run.status,
      runType: run.runType,
      description: run.description,
      subsidiariesProcessed: run.subsidiariesProcessed,
      eliminationsGenerated: run.eliminationsGenerated,
      translationAdjustments: run.translationAdjustments,
      totalDebitAmount: run.totalDebitAmount,
      totalCreditAmount: run.totalCreditAmount,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      reversedAt: run.reversedAt,
    }));
  }

  // ==========================================
  // Private Helper Methods
  // ==========================================

  /**
   * Generate elimination entries based on rules and intercompany balances
   */
  private async generateEliminationEntries(
    members: any[],
    rules: any[],
    periodId: string,
    errors: string[],
    warnings: string[]
  ): Promise<EliminationEntry[]> {
    const entries: EliminationEntry[] = [];

    // For each elimination rule, find matching intercompany balances
    // In a real implementation, this would query the GL for intercompany balances
    // For now, we'll create placeholder entries based on rules

    for (const rule of rules) {
      // Validate rule has required accounts
      if (!rule.eliminationDebitAccountId || !rule.eliminationCreditAccountId) {
        warnings.push(
          `Elimination rule "${rule.name}" missing debit/credit accounts, skipping`
        );
        continue;
      }

      // For each pair of subsidiaries in the group
      for (const sourceMember of members) {
        for (const targetMember of members) {
          if (sourceMember.member.subsidiaryId === targetMember.member.subsidiaryId) {
            continue; // Skip self
          }

          // Check if this rule applies to these subsidiaries
          const sourceMatches =
            !rule.sourceSubsidiaryId ||
            rule.sourceSubsidiaryId === sourceMember.member.subsidiaryId;
          const targetMatches =
            !rule.targetSubsidiaryId ||
            rule.targetSubsidiaryId === targetMember.member.subsidiaryId;

          if (!sourceMatches || !targetMatches) {
            continue;
          }

          // In a real implementation, we would query the GL to find the actual
          // intercompany balance between these subsidiaries for the specified accounts.
          // For now, this serves as the structure for the elimination engine.

          // The actual balance would be looked up like:
          // const balance = await this.getIntercompanyBalance(
          //   sourceMember.member.subsidiaryId,
          //   targetMember.member.subsidiaryId,
          //   rule.sourceAccountId,
          //   periodId
          // );

          // if (balance !== 0) {
          //   entries.push({
          //     sourceSubsidiaryId: sourceMember.member.subsidiaryId,
          //     targetSubsidiaryId: targetMember.member.subsidiaryId,
          //     accountId: rule.eliminationDebitAccountId,
          //     description: `Elimination: ${rule.name}`,
          //     debitAmount: balance > 0 ? balance : 0,
          //     creditAmount: balance < 0 ? Math.abs(balance) : 0,
          //     eliminationRuleId: rule.id,
          //   });
          // }
        }
      }
    }

    return entries;
  }

  /**
   * Generate FX translation adjustments for foreign subsidiaries
   */
  private async generateTranslationAdjustments(
    members: any[],
    fxRules: any[],
    consolidationCurrencyId: string,
    periodId: string,
    errors: string[],
    warnings: string[]
  ): Promise<TranslationEntry[]> {
    const entries: TranslationEntry[] = [];
    const organizationId = this.requireOrganizationContext();

    // For each subsidiary that has a different base currency than the consolidation currency
    for (const member of members) {
      const subsidiary = member.subsidiary;

      if (!subsidiary?.baseCurrencyId) {
        continue;
      }

      // Check if subsidiary currency differs from consolidation currency
      if (subsidiary.baseCurrencyId === consolidationCurrencyId) {
        continue; // No translation needed
      }

      // Get exchange rates for this subsidiary's currency
      // In a real implementation, this would look up actual exchange rates
      // and translate each account balance based on the FX rules

      // For each FX rule (defining rate type per account type)
      for (const rule of fxRules) {
        // Get the appropriate exchange rate based on rate type
        // const rate = await this.consolidationRepository.findExchangeRate(
        //   organizationId,
        //   subsidiary.baseCurrencyId,
        //   consolidationCurrencyId,
        //   periodId,
        //   rule.rateType
        // );

        // if (!rate) {
        //   warnings.push(
        //     `Missing ${rule.rateType} exchange rate for subsidiary ${subsidiary.name}`
        //   );
        //   continue;
        // }

        // Get account balances for this subsidiary and account type
        // const balances = await this.getSubsidiaryBalances(
        //   member.member.subsidiaryId,
        //   rule.accountType,
        //   periodId
        // );

        // Translate each balance
        // for (const balance of balances) {
        //   const translatedAmount = balance.balance * parseFloat(rate.rate);
        //   const ctaAmount = translatedAmount - balance.balance;
        //
        //   entries.push({
        //     sourceSubsidiaryId: member.member.subsidiaryId,
        //     accountId: balance.accountId,
        //     description: `FX Translation: ${rule.name}`,
        //     originalCurrencyCode: balance.currencyCode,
        //     originalAmount: balance.balance,
        //     exchangeRate: parseFloat(rate.rate),
        //     translatedAmount,
        //     ctaAmount,
        //   });
        // }
      }
    }

    return entries;
  }

  /**
   * Group elimination adjustments by rule type for summary
   */
  private groupAdjustmentsByType(adjustments: any[]): Record<string, { count: number; total: number }> {
    const groups: Record<string, { count: number; total: number }> = {};

    for (const adj of adjustments) {
      const type = adj.adjustment.eliminationRuleId || 'manual';
      if (!groups[type]) {
        groups[type] = { count: 0, total: 0 };
      }
      groups[type].count++;
      groups[type].total +=
        parseFloat(adj.adjustment.debitAmount || '0') -
        parseFloat(adj.adjustment.creditAmount || '0');
    }

    return groups;
  }

  /**
   * Group translation adjustments by subsidiary for summary
   */
  private groupTranslationsBySubsidiary(
    adjustments: any[]
  ): Record<string, { count: number; ctaTotal: number }> {
    const groups: Record<string, { count: number; ctaTotal: number }> = {};

    for (const adj of adjustments) {
      const subsidiaryId = adj.adjustment.sourceSubsidiaryId || 'unknown';
      const subsidiaryName = adj.sourceSubsidiary?.name || subsidiaryId;

      if (!groups[subsidiaryName]) {
        groups[subsidiaryName] = { count: 0, ctaTotal: 0 };
      }
      groups[subsidiaryName].count++;
      groups[subsidiaryName].ctaTotal += parseFloat(adj.adjustment.ctaAmount || '0');
    }

    return groups;
  }
}
