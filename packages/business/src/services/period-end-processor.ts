/**
 * Period End Processor
 * Orchestrates the complete period-end close process for revenue recognition
 */

import { JournalEntryAutomationService } from './journal-entry-automation-service';
import { GLIntegrationAdapter } from './gl-integration-adapter';
import {
  journalEntryBatches,
  revenueJournalEntries,
  revenueSchedules,
  BatchStatuses,
  type JournalEntryBatch
} from '@glapi/database';
import { eq, and, gte, lte, sql, inArray } from 'drizzle-orm';

export interface PeriodEndOptions {
  periodStartDate: Date;
  periodEndDate: Date;
  fiscalYear: number;
  fiscalPeriod: number;
  validateBeforeProcessing?: boolean;
  autoPostToGL?: boolean;
  sendNotifications?: boolean;
  includeAdjustments?: boolean;
  dryRun?: boolean;
}

export interface PeriodEndResult {
  success: boolean;
  periodStartDate: Date;
  periodEndDate: Date;
  batchesCreated: string[];
  entriesGenerated: number;
  totalDebits: number;
  totalCredits: number;
  glPostingStatus?: string;
  reconciliationStatus?: string;
  errors: string[];
  warnings: string[];
  processingTime: number;
}

export interface PeriodValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  statistics: {
    schedulesReady: number;
    schedulesProcessed: number;
    unrecognizedAmount: number;
    expectedRevenue: number;
  };
}

export interface ReconciliationResult {
  isReconciled: boolean;
  subLedgerTotal: number;
  glTotal: number;
  difference: number;
  discrepancies: ReconciliationDiscrepancy[];
}

export interface ReconciliationDiscrepancy {
  account: string;
  subLedgerAmount: number;
  glAmount: number;
  difference: number;
  possibleCause?: string;
}

export class PeriodEndProcessor {
  private journalService: JournalEntryAutomationService;
  private glAdapter: GLIntegrationAdapter;
  private periodLocked: boolean = false;

  constructor(
    private db: any,
    private organizationId: string
  ) {
    this.journalService = new JournalEntryAutomationService(db, organizationId);
    this.glAdapter = new GLIntegrationAdapter(db, organizationId);
  }

  /**
   * Execute the complete period-end close process
   */
  async processPeriodEnd(options: PeriodEndOptions): Promise<PeriodEndResult> {
    const startTime = Date.now();
    const result: PeriodEndResult = {
      success: false,
      periodStartDate: options.periodStartDate,
      periodEndDate: options.periodEndDate,
      batchesCreated: [],
      entriesGenerated: 0,
      totalDebits: 0,
      totalCredits: 0,
      errors: [],
      warnings: [],
      processingTime: 0
    };

    try {
      // Step 1: Validate period is ready for close
      if (options.validateBeforeProcessing) {
        const validation = await this.validatePeriod(options);
        
        if (!validation.isValid) {
          result.errors = validation.errors;
          result.warnings = validation.warnings;
          return result;
        }
        
        result.warnings.push(...validation.warnings);
      }

      // Step 2: Lock the period to prevent changes
      if (!options.dryRun) {
        await this.lockPeriod(options.periodStartDate, options.periodEndDate);
        this.periodLocked = true;
      }

      // Step 3: Generate revenue recognition entries
      const recognitionResult = await this.processRevenueRecognition(options);
      result.batchesCreated.push(recognitionResult.batchId);
      result.entriesGenerated += recognitionResult.entriesCreated;
      result.totalDebits += recognitionResult.totalDebits;
      result.totalCredits += recognitionResult.totalCredits;

      // Step 4: Process adjustments if requested
      if (options.includeAdjustments) {
        const adjustmentResult = await this.processAdjustments(options);
        if (adjustmentResult.batchId) {
          result.batchesCreated.push(adjustmentResult.batchId);
          result.entriesGenerated += adjustmentResult.entriesCreated;
          result.totalDebits += adjustmentResult.totalDebits;
          result.totalCredits += adjustmentResult.totalCredits;
        }
      }

      // Step 5: Validate journal entry balance
      if (!this.validateBalance(result.totalDebits, result.totalCredits)) {
        throw new Error('Journal entries do not balance');
      }

      // Step 6: Post to GL if requested
      if (options.autoPostToGL && !options.dryRun) {
        const postingResult = await this.postToGL(result.batchesCreated);
        result.glPostingStatus = postingResult.status;
        
        if (!postingResult.success) {
          result.errors.push(`GL posting failed: ${postingResult.error}`);
        }
      }

      // Step 7: Perform reconciliation
      const reconciliation = await this.performReconciliation(options);
      result.reconciliationStatus = reconciliation.isReconciled ? 'reconciled' : 'discrepancies';
      
      if (!reconciliation.isReconciled) {
        result.warnings.push(`Reconciliation discrepancies found: ${reconciliation.difference}`);
      }

      // Step 8: Send notifications if requested
      if (options.sendNotifications && !options.dryRun) {
        await this.sendPeriodEndNotifications(result);
      }

      result.success = result.errors.length === 0;

    } catch (error) {
      result.errors.push(`Period-end processing failed: ${(error as Error).message}`);
      
      // Attempt to unlock period if it was locked
      if (this.periodLocked && !options.dryRun) {
        await this.unlockPeriod(options.periodStartDate, options.periodEndDate);
      }
    } finally {
      result.processingTime = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Validate that the period is ready for close
   */
  async validatePeriod(options: PeriodEndOptions): Promise<PeriodValidationResult> {
    const result: PeriodValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      statistics: {
        schedulesReady: 0,
        schedulesProcessed: 0,
        unrecognizedAmount: 0,
        expectedRevenue: 0
      }
    };

    try {
      // Check for unprocessed revenue schedules
      const unprocessedSchedules = await this.db
        .select({
          count: sql<number>`count(*)`,
          totalAmount: sql<number>`sum(cast(scheduled_amount as decimal))`
        })
        .from(revenueSchedules)
        .where(
          and(
            eq(revenueSchedules.organizationId, this.organizationId),
            gte(revenueSchedules.periodStartDate, options.periodStartDate.toISOString().split('T')[0]),
            lte(revenueSchedules.periodEndDate, options.periodEndDate.toISOString().split('T')[0]),
            eq(revenueSchedules.status, 'scheduled')
          )
        );

      result.statistics.schedulesReady = unprocessedSchedules[0]?.count || 0;
      result.statistics.expectedRevenue = unprocessedSchedules[0]?.totalAmount || 0;

      // Check for already processed schedules
      const processedSchedules = await this.db
        .select({
          count: sql<number>`count(*)`
        })
        .from(revenueSchedules)
        .where(
          and(
            eq(revenueSchedules.organizationId, this.organizationId),
            gte(revenueSchedules.periodStartDate, options.periodStartDate.toISOString().split('T')[0]),
            lte(revenueSchedules.periodEndDate, options.periodEndDate.toISOString().split('T')[0]),
            eq(revenueSchedules.status, 'recognized')
          )
        );

      result.statistics.schedulesProcessed = processedSchedules[0]?.count || 0;

      // Check for prior period adjustments needed
      const priorPeriodIssues = await this.checkPriorPeriodIssues(options.periodStartDate);
      if (priorPeriodIssues.length > 0) {
        result.warnings.push(`Prior period has ${priorPeriodIssues.length} unresolved issues`);
      }

      // Check for incomplete batches
      const incompleteBatches = await this.db
        .select()
        .from(journalEntryBatches)
        .where(
          and(
            eq(journalEntryBatches.organizationId, this.organizationId),
            eq(journalEntryBatches.fiscalYear, options.fiscalYear),
            eq(journalEntryBatches.fiscalPeriod, options.fiscalPeriod),
            inArray(journalEntryBatches.status, [BatchStatuses.DRAFT, BatchStatuses.PENDING_APPROVAL])
          )
        );

      if (incompleteBatches.length > 0) {
        result.errors.push(`Period has ${incompleteBatches.length} incomplete journal entry batches`);
        result.isValid = false;
      }

      // Validate period dates
      if (options.periodEndDate < options.periodStartDate) {
        result.errors.push('Period end date cannot be before start date');
        result.isValid = false;
      }

      // Check if period is already closed
      const closedPeriod = await this.isPeriodClosed(options.periodStartDate, options.periodEndDate);
      if (closedPeriod) {
        result.errors.push('Period is already closed');
        result.isValid = false;
      }

    } catch (error) {
      result.errors.push(`Validation failed: ${(error as Error).message}`);
      result.isValid = false;
    }

    return result;
  }

  /**
   * Process revenue recognition for the period
   */
  private async processRevenueRecognition(options: PeriodEndOptions): Promise<any> {
    return await this.journalService.generateRevenueRecognitionEntries({
      periodStartDate: options.periodStartDate,
      periodEndDate: options.periodEndDate,
      batchName: `Revenue Recognition - Period ${options.fiscalPeriod}/${options.fiscalYear}`,
      validateBalances: true,
      autoPost: false // Will be posted after all entries are created
    });
  }

  /**
   * Process period adjustments
   */
  private async processAdjustments(options: PeriodEndOptions): Promise<any> {
    // This would handle any manual adjustments, corrections, or reclassifications
    // For now, returning empty result
    return {
      batchId: '',
      entriesCreated: 0,
      totalDebits: 0,
      totalCredits: 0,
      errors: [],
      warnings: []
    };
  }

  /**
   * Post journal entries to external GL system
   */
  private async postToGL(batchIds: string[]): Promise<{ success: boolean; status: string; error?: string }> {
    try {
      // Get all entries for the batches
      const entries = await this.db
        .select()
        .from(revenueJournalEntries)
        .where(inArray(revenueJournalEntries.batchId, batchIds));

      // Send to GL system via adapter
      const postingResult = await this.glAdapter.postJournalEntries(entries, batchIds[0]);

      // Update batch status based on result
      await this.db
        .update(journalEntryBatches)
        .set({
          externalPostStatus: postingResult.success ? 'posted' : 'failed',
          externalPostDate: postingResult.success ? new Date() : null,
          externalBatchId: postingResult.externalBatchId,
          externalErrorMessage: postingResult.error,
          status: postingResult.success ? BatchStatuses.POSTED : BatchStatuses.FAILED,
          updatedAt: new Date()
        })
        .where(inArray(journalEntryBatches.id, batchIds));

      return {
        success: postingResult.success,
        status: postingResult.success ? 'posted' : 'failed',
        error: postingResult.error
      };

    } catch (error) {
      return {
        success: false,
        status: 'error',
        error: (error as Error).message
      };
    }
  }

  /**
   * Perform reconciliation between sub-ledger and GL
   */
  async performReconciliation(options: PeriodEndOptions): Promise<ReconciliationResult> {
    const result: ReconciliationResult = {
      isReconciled: false,
      subLedgerTotal: 0,
      glTotal: 0,
      difference: 0,
      discrepancies: []
    };

    try {
      // Get sub-ledger totals
      const subLedgerTotals = await this.db
        .select({
          account: revenueJournalEntries.creditAccount,
          total: sql<number>`sum(cast(recognized_revenue_amount as decimal))`
        })
        .from(revenueJournalEntries)
        .where(
          and(
            eq(revenueJournalEntries.organizationId, this.organizationId),
            gte(revenueJournalEntries.periodStartDate, options.periodStartDate.toISOString().split('T')[0]),
            lte(revenueJournalEntries.periodEndDate, options.periodEndDate.toISOString().split('T')[0]),
            eq(revenueJournalEntries.postingStatus, 'posted')
          )
        )
        .groupBy(revenueJournalEntries.creditAccount);

      // Get GL totals (would come from external system)
      const glTotals = await this.glAdapter.getGLBalances(
        options.periodStartDate,
        options.periodEndDate
      );

      // Compare totals
      for (const subLedger of subLedgerTotals) {
        const glAccount = glTotals.find(gl => gl.account === subLedger.account);
        
        if (!glAccount) {
          result.discrepancies.push({
            account: subLedger.account,
            subLedgerAmount: subLedger.total,
            glAmount: 0,
            difference: subLedger.total,
            possibleCause: 'Account not found in GL'
          });
        } else {
          const difference = Math.abs(subLedger.total - glAccount.balance);
          
          if (difference > 0.01) { // Allow for rounding
            result.discrepancies.push({
              account: subLedger.account,
              subLedgerAmount: subLedger.total,
              glAmount: glAccount.balance,
              difference,
              possibleCause: 'Amount mismatch'
            });
          }
        }
        
        result.subLedgerTotal += subLedger.total;
      }

      result.glTotal = glTotals.reduce((sum, gl) => sum + gl.balance, 0);
      result.difference = Math.abs(result.subLedgerTotal - result.glTotal);
      result.isReconciled = result.difference < 0.01 && result.discrepancies.length === 0;

    } catch (error) {
      result.discrepancies.push({
        account: 'ERROR',
        subLedgerAmount: 0,
        glAmount: 0,
        difference: 0,
        possibleCause: (error as Error).message
      });
    }

    return result;
  }

  /**
   * Lock period to prevent changes
   */
  private async lockPeriod(startDate: Date, endDate: Date): Promise<void> {
    // Implementation would update a period status table
    // For now, just setting the flag
    this.periodLocked = true;
  }

  /**
   * Unlock period
   */
  private async unlockPeriod(startDate: Date, endDate: Date): Promise<void> {
    this.periodLocked = false;
  }

  /**
   * Check if period is already closed
   */
  private async isPeriodClosed(startDate: Date, endDate: Date): Promise<boolean> {
    // Check if there are posted batches for this period
    const postedBatches = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(journalEntryBatches)
      .where(
        and(
          eq(journalEntryBatches.organizationId, this.organizationId),
          eq(journalEntryBatches.periodStartDate, startDate.toISOString().split('T')[0]),
          eq(journalEntryBatches.periodEndDate, endDate.toISOString().split('T')[0]),
          eq(journalEntryBatches.status, BatchStatuses.POSTED)
        )
      );

    return (postedBatches[0]?.count || 0) > 0;
  }

  /**
   * Check for prior period issues
   */
  private async checkPriorPeriodIssues(currentPeriodStart: Date): Promise<any[]> {
    // Check for unposted entries in prior periods
    const priorPeriodEnd = new Date(currentPeriodStart);
    priorPeriodEnd.setDate(priorPeriodEnd.getDate() - 1);

    const issues = await this.db
      .select()
      .from(journalEntryBatches)
      .where(
        and(
          eq(journalEntryBatches.organizationId, this.organizationId),
          lte(journalEntryBatches.periodEndDate, priorPeriodEnd.toISOString().split('T')[0]),
          inArray(journalEntryBatches.status, [BatchStatuses.DRAFT, BatchStatuses.PENDING_APPROVAL, BatchStatuses.FAILED])
        )
      );

    return issues;
  }

  /**
   * Validate journal entry balance
   */
  private validateBalance(debits: number, credits: number): boolean {
    return Math.abs(debits - credits) < 0.01;
  }

  /**
   * Send period-end notifications
   */
  private async sendPeriodEndNotifications(result: PeriodEndResult): Promise<void> {
    // Implementation would send emails/notifications
    console.log('Period-end notifications would be sent here', {
      success: result.success,
      entries: result.entriesGenerated,
      errors: result.errors.length
    });
  }

  /**
   * Generate period-end report
   */
  async generatePeriodEndReport(options: PeriodEndOptions): Promise<any> {
    const report = {
      period: {
        startDate: options.periodStartDate,
        endDate: options.periodEndDate,
        fiscalYear: options.fiscalYear,
        fiscalPeriod: options.fiscalPeriod
      },
      summary: {
        totalRevenue: 0,
        totalDeferred: 0,
        journalEntriesCreated: 0,
        batchesProcessed: 0
      },
      details: [] as any[],
      reconciliation: null as any,
      generatedAt: new Date()
    };

    // Get period statistics
    const stats = await this.db
      .select({
        totalRevenue: sql<number>`sum(cast(recognized_revenue_amount as decimal))`,
        totalDeferred: sql<number>`sum(cast(deferred_revenue_amount as decimal))`,
        entryCount: sql<number>`count(*)`
      })
      .from(revenueJournalEntries)
      .where(
        and(
          eq(revenueJournalEntries.organizationId, this.organizationId),
          gte(revenueJournalEntries.periodStartDate, options.periodStartDate.toISOString().split('T')[0]),
          lte(revenueJournalEntries.periodEndDate, options.periodEndDate.toISOString().split('T')[0])
        )
      );

    report.summary.totalRevenue = stats[0]?.totalRevenue || 0;
    report.summary.totalDeferred = stats[0]?.totalDeferred || 0;
    report.summary.journalEntriesCreated = stats[0]?.entryCount || 0;

    // Get batch information
    const batches = await this.db
      .select()
      .from(journalEntryBatches)
      .where(
        and(
          eq(journalEntryBatches.organizationId, this.organizationId),
          eq(journalEntryBatches.fiscalYear, options.fiscalYear),
          eq(journalEntryBatches.fiscalPeriod, options.fiscalPeriod)
        )
      );

    report.summary.batchesProcessed = batches.length;
    report.details = batches;

    // Get reconciliation status
    report.reconciliation = await this.performReconciliation(options);

    return report;
  }
}