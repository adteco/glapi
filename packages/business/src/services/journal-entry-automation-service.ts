/**
 * Journal Entry Automation Service
 * Handles automated generation of journal entries from revenue recognition schedules
 */

import { v4 as uuidv4 } from 'uuid';
import {
  revenueSchedules,
  revenueJournalEntries,
  glAccountMappings,
  journalEntryBatches,
  subscriptions,
  subscriptionItems,
  performanceObligations,
  items,
  AccountTypes,
  TransactionTypes,
  BatchStatuses,
  type RevenueSchedule,
  type RevenueJournalEntry,
  type NewRevenueJournalEntry,
  type GLAccountMapping,
  type JournalEntryBatch,
  type NewJournalEntryBatch
} from '@glapi/database';
import { eq, and, or, gte, lte, inArray, desc, sql, isNull } from 'drizzle-orm';

export interface JournalEntryGenerationOptions {
  periodStartDate: Date;
  periodEndDate: Date;
  batchName?: string;
  includeReversals?: boolean;
  autoPost?: boolean;
  validateBalances?: boolean;
}

export interface GLAccountMappingResult {
  debitAccount: string;
  creditAccount: string;
  debitAccountName: string;
  creditAccountName: string;
  mappingRuleUsed: string;
}

export interface JournalEntryResult {
  entriesCreated: number;
  totalDebits: number;
  totalCredits: number;
  batchId: string;
  errors: string[];
  warnings: string[];
}

export interface ReversalResult {
  originalEntryId: string;
  reversalEntryId: string;
  success: boolean;
  error?: string;
}

export class JournalEntryAutomationService {
  constructor(
    private db: any,
    private organizationId: string
  ) {}

  /**
   * Generate journal entries for revenue recognition
   */
  async generateRevenueRecognitionEntries(
    options: JournalEntryGenerationOptions
  ): Promise<JournalEntryResult> {
    const result: JournalEntryResult = {
      entriesCreated: 0,
      totalDebits: 0,
      totalCredits: 0,
      batchId: '',
      errors: [],
      warnings: []
    };

    try {
      // Create batch for this period
      const batch = await this.createJournalBatch({
        batchName: options.batchName || `Revenue Recognition - ${options.periodStartDate.toISOString().split('T')[0]}`,
        periodStartDate: options.periodStartDate,
        periodEndDate: options.periodEndDate,
        batchType: 'revenue_recognition'
      });
      
      result.batchId = batch.id;

      // Get revenue schedules ready for recognition
      const schedules = await this.getSchedulesForRecognition(
        options.periodStartDate,
        options.periodEndDate
      );

      if (schedules.length === 0) {
        result.warnings.push('No revenue schedules found for the period');
        return result;
      }

      // Process each schedule
      for (const schedule of schedules) {
        try {
          const entry = await this.createJournalEntryFromSchedule(schedule, batch.id);
          
          if (entry) {
            result.entriesCreated++;
            result.totalDebits += parseFloat(entry.deferredRevenueAmount || '0');
            result.totalCredits += parseFloat(entry.recognizedRevenueAmount || '0');
          }
        } catch (error) {
          result.errors.push(`Failed to process schedule ${schedule.id}: ${(error as Error).message}`);
        }
      }

      // Update batch totals
      await this.updateBatchTotals(batch.id, result);

      // Validate balances if requested
      if (options.validateBalances && !this.validateJournalBalance(result.totalDebits, result.totalCredits)) {
        result.errors.push('Journal entries do not balance');
        await this.markBatchAsFailed(batch.id, 'Entries do not balance');
      }

      // Auto-post if requested and no errors
      if (options.autoPost && result.errors.length === 0) {
        await this.postBatch(batch.id);
      }

    } catch (error) {
      result.errors.push(`Batch processing failed: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Create a journal entry from a revenue schedule
   */
  private async createJournalEntryFromSchedule(
    schedule: RevenueSchedule,
    batchId: string
  ): Promise<RevenueJournalEntry | null> {
    // Get performance obligation details for context
    const poDetails = await this.getPerformanceObligationDetails(schedule.performanceObligationId);
    
    if (!poDetails) {
      throw new Error(`Performance obligation not found: ${schedule.performanceObligationId}`);
    }

    // Determine GL accounts based on mapping rules
    const glMapping = await this.determineGLAccounts({
      accountType: AccountTypes.REVENUE,
      transactionType: TransactionTypes.RECOGNITION,
      subsidiaryId: poDetails.subsidiaryId,
      departmentId: poDetails.departmentId,
      locationId: poDetails.locationId,
      classId: poDetails.classId,
      itemId: poDetails.itemId,
      itemCategory: poDetails.itemCategory
    });

    // Create journal entry
    const entry: NewRevenueJournalEntry = {
      organizationId: this.organizationId,
      revenueScheduleId: schedule.id,
      entryDate: schedule.periodEndDate,
      deferredRevenueAmount: schedule.scheduledAmount,
      recognizedRevenueAmount: schedule.scheduledAmount,
      journalEntryReference: await this.generateEntryNumber(),
      status: 'draft'
    };

    const [createdEntry] = await this.db
      .insert(revenueJournalEntries)
      .values(entry)
      .returning();

    // Update revenue schedule status
    await this.db
      .update(revenueSchedules)
      .set({
        recognizedAmount: schedule.scheduledAmount,
        recognizedDate: new Date().toISOString().split('T')[0],
        status: 'recognized',
        journalEntryId: createdEntry.id,
        updatedAt: new Date()
      })
      .where(eq(revenueSchedules.id, schedule.id));

    return createdEntry;
  }

  /**
   * Determine GL accounts based on mapping rules
   */
  private async determineGLAccounts(criteria: {
    accountType: string;
    transactionType: string;
    subsidiaryId?: string;
    departmentId?: string;
    locationId?: string;
    classId?: string;
    itemId?: string;
    itemCategory?: string;
  }): Promise<GLAccountMappingResult> {
    // Try to find the most specific mapping first
    const mappings = await this.db
      .select()
      .from(glAccountMappings)
      .where(
        and(
          eq(glAccountMappings.organizationId, this.organizationId),
          eq(glAccountMappings.accountType, criteria.accountType),
          eq(glAccountMappings.transactionType, criteria.transactionType),
          eq(glAccountMappings.isActive, true)
        )
      )
      .orderBy(desc(glAccountMappings.priority));

    // Find best matching rule
    let bestMatch: GLAccountMapping | null = null;
    let matchScore = -1;

    for (const mapping of mappings) {
      const score = this.calculateMappingScore(mapping, criteria);
      if (score > matchScore) {
        matchScore = score;
        bestMatch = mapping;
      }
    }

    // Fall back to default mapping if no specific match
    if (!bestMatch) {
      const [defaultMapping] = await this.db
        .select()
        .from(glAccountMappings)
        .where(
          and(
            eq(glAccountMappings.organizationId, this.organizationId),
            eq(glAccountMappings.accountType, criteria.accountType),
            eq(glAccountMappings.transactionType, criteria.transactionType),
            eq(glAccountMappings.isDefault, true),
            eq(glAccountMappings.isActive, true)
          )
        )
        .limit(1);

      bestMatch = defaultMapping;
    }

    if (!bestMatch) {
      throw new Error(`No GL mapping found for ${criteria.accountType}/${criteria.transactionType}`);
    }

    // For revenue recognition, debit deferred revenue and credit revenue
    let debitAccount: string;
    let creditAccount: string;
    let debitAccountName: string;
    let creditAccountName: string;

    if (criteria.transactionType === TransactionTypes.RECOGNITION) {
      // Get deferred revenue account
      const [deferredMapping] = await this.db
        .select()
        .from(glAccountMappings)
        .where(
          and(
            eq(glAccountMappings.organizationId, this.organizationId),
            eq(glAccountMappings.accountType, AccountTypes.DEFERRED_REVENUE),
            eq(glAccountMappings.isActive, true)
          )
        )
        .limit(1);

      debitAccount = deferredMapping?.glAccountCode || '2100';
      debitAccountName = deferredMapping?.glAccountName || 'Deferred Revenue';
      creditAccount = bestMatch.glAccountCode;
      creditAccountName = bestMatch.glAccountName;
    } else {
      // Other transaction types
      debitAccount = bestMatch.glAccountCode;
      debitAccountName = bestMatch.glAccountName;
      creditAccount = bestMatch.glAccountCode;
      creditAccountName = bestMatch.glAccountName;
    }

    return {
      debitAccount,
      creditAccount,
      debitAccountName,
      creditAccountName,
      mappingRuleUsed: bestMatch.mappingName
    };
  }

  /**
   * Calculate mapping score based on how many criteria match
   */
  private calculateMappingScore(mapping: GLAccountMapping, criteria: any): number {
    let score = 0;

    // Check dimension matches
    if (mapping.subsidiaryId) {
      if (mapping.subsidiaryId === criteria.subsidiaryId) score += 10;
      else return -1; // Mismatch
    }

    if (mapping.departmentId) {
      if (mapping.departmentId === criteria.departmentId) score += 8;
      else return -1;
    }

    if (mapping.locationId) {
      if (mapping.locationId === criteria.locationId) score += 6;
      else return -1;
    }

    if (mapping.classId) {
      if (mapping.classId === criteria.classId) score += 4;
      else return -1;
    }

    if (mapping.itemId) {
      if (mapping.itemId === criteria.itemId) score += 20; // Item match is highest priority
      else return -1;
    }

    if (mapping.itemCategory) {
      if (mapping.itemCategory === criteria.itemCategory) score += 5;
      else return -1;
    }

    // Add base priority
    score += mapping.priority;

    return score;
  }

  /**
   * Reverse journal entries
   */
  async reverseJournalEntry(
    entryId: string,
    reversalDate: Date,
    reason: string
  ): Promise<ReversalResult> {
    try {
      // Get original entry
      const [originalEntry] = await this.db
        .select()
        .from(revenueJournalEntries)
        .where(eq(revenueJournalEntries.id, entryId))
        .limit(1);

      if (!originalEntry) {
        throw new Error('Original journal entry not found');
      }

      if (originalEntry.reversalOf) {
        throw new Error('Cannot reverse a reversal entry');
      }

      if (originalEntry.reversedBy) {
        throw new Error('Entry has already been reversed');
      }

      // Create reversal entry (swap debits and credits)
      const reversalEntry: NewRevenueJournalEntry = {
        ...originalEntry,
        id: uuidv4(),
        entryNumber: await this.generateEntryNumber(),
        entryDate: reversalDate.toISOString().split('T')[0],
        entryType: 'reversal',
        
        // Swap accounts
        debitAccount: originalEntry.creditAccount,
        creditAccount: originalEntry.debitAccount,
        
        // Keep amounts the same (the swap creates the reversal)
        deferredRevenueAmount: originalEntry.recognizedRevenueAmount,
        recognizedRevenueAmount: originalEntry.deferredRevenueAmount,
        
        // Mark as reversal
        reversalOf: originalEntry.id,
        reversalReason: reason,
        
        description: `Reversal of ${originalEntry.entryNumber}: ${reason}`,
        
        postingStatus: 'pending',
        
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Insert reversal entry
      const [createdReversal] = await this.db
        .insert(revenueJournalEntries)
        .values(reversalEntry)
        .returning();

      // Update original entry to mark it as reversed
      await this.db
        .update(revenueJournalEntries)
        .set({
          reversedBy: createdReversal.id,
          reversedDate: reversalDate.toISOString().split('T')[0],
          updatedAt: new Date()
        })
        .where(eq(revenueJournalEntries.id, entryId));

      // Update revenue schedule if applicable
      if (originalEntry.revenueScheduleId) {
        await this.db
          .update(revenueSchedules)
          .set({
            status: 'scheduled',
            recognizedAmount: '0',
            recognizedDate: null,
            journalEntryId: null,
            updatedAt: new Date()
          })
          .where(eq(revenueSchedules.id, originalEntry.revenueScheduleId));
      }

      return {
        originalEntryId: entryId,
        reversalEntryId: createdReversal.id,
        success: true
      };

    } catch (error) {
      return {
        originalEntryId: entryId,
        reversalEntryId: '',
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Create a journal entry batch
   */
  private async createJournalBatch(params: {
    batchName: string;
    periodStartDate: Date;
    periodEndDate: Date;
    batchType: string;
  }): Promise<JournalEntryBatch> {
    const batch: NewJournalEntryBatch = {
      organizationId: this.organizationId,
      batchNumber: await this.generateBatchNumber(),
      description: params.batchName,
      status: BatchStatuses.DRAFT
    };

    const [createdBatch] = await this.db
      .insert(journalEntryBatches)
      .values(batch)
      .returning();

    return createdBatch;
  }

  /**
   * Post a batch of journal entries
   */
  async postBatch(batchId: string): Promise<void> {
    // Update batch status
    await this.db
      .update(journalEntryBatches)
      .set({
        status: BatchStatuses.COMPLETED,
        actualPostDate: new Date(),
        updatedAt: new Date()
      })
      .where(eq(journalEntryBatches.id, batchId));

    // Update all entries in the batch
    await this.db
      .update(revenueJournalEntries)
      .set({
        postingStatus: 'posted',
        postingDate: new Date().toISOString().split('T')[0],
        updatedAt: new Date()
      })
      .where(eq(revenueJournalEntries.id, batchId));
  }

  /**
   * Helper methods
   */

  private async getSchedulesForRecognition(
    startDate: Date,
    endDate: Date
  ): Promise<RevenueSchedule[]> {
    return await this.db
      .select()
      .from(revenueSchedules)
      .where(
        and(
          eq(revenueSchedules.organizationId, this.organizationId),
          gte(revenueSchedules.periodStartDate, startDate.toISOString().split('T')[0]),
          lte(revenueSchedules.periodEndDate, endDate.toISOString().split('T')[0]),
          eq(revenueSchedules.status, 'scheduled')
        )
      );
  }

  private async getPerformanceObligationDetails(poId: string): Promise<any> {
    const [result] = await this.db
      .select({
        subscriptionId: performanceObligations.subscriptionId,
        itemId: subscriptionItems.itemId,
        satisfactionMethod: performanceObligations.satisfactionMethod,
        customerId: subscriptions.entityId,
        itemName: items.name,
        itemCategory: items.categoryId
      })
      .from(performanceObligations)
      .leftJoin(subscriptionItems, eq(subscriptionItems.subscriptionId, performanceObligations.subscriptionId))
      .leftJoin(subscriptions, eq(performanceObligations.subscriptionId, subscriptions.id))
      .leftJoin(items, eq(subscriptionItems.itemId, items.id))
      .where(eq(performanceObligations.id, poId))
      .limit(1);

    return result;
  }

  private async generateEntryNumber(): Promise<string> {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `JE-${timestamp}-${random}`;
  }

  private async generateBatchNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `BATCH-${year}${month}-${random}`;
  }

  private validateJournalBalance(debits: number, credits: number): boolean {
    return Math.abs(debits - credits) < 0.01; // Allow for rounding differences
  }

  private async updateBatchTotals(batchId: string, result: JournalEntryResult): Promise<void> {
    await this.db
      .update(journalEntryBatches)
      .set({
        totalEntries: result.entriesCreated,
        totalDebits: result.totalDebits.toString(),
        totalCredits: result.totalCredits.toString(),
        updatedAt: new Date()
      })
      .where(eq(journalEntryBatches.id, batchId));
  }

  private async markBatchAsFailed(batchId: string, reason: string): Promise<void> {
    await this.db
      .update(journalEntryBatches)
      .set({
        status: BatchStatuses.FAILED,
        metadata: sql`jsonb_set(COALESCE(metadata, '{}'), '{error}', ${JSON.stringify(reason)})`,
        updatedAt: new Date()
      })
      .where(eq(journalEntryBatches.id, batchId));
  }
}