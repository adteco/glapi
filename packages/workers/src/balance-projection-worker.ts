/**
 * Balance Projection Worker
 *
 * Processes GL transaction events from the event store and maintains
 * real-time account balance projections in the glAccountBalances table.
 *
 * Event types handled:
 * - GlTransactionPosted: Add debits/credits to account balances
 * - GlTransactionReversed: Reverse the effects of a posted transaction
 * - GlTransactionVoided: Remove effects of a voided transaction
 * - AccountBalanceRecalculated: Replace balance with recalculated value
 */

import { WorkerBase, WorkerConfig, WorkerLogger } from './worker-base';
import {
  eventStoreRepository,
  eventProjectionRepository,
  db,
} from '@glapi/database';
import {
  GlEventTypes,
  GlTransactionPostedEvent,
  GlTransactionReversedEvent,
  GlTransactionVoidedEvent,
  AccountBalanceRecalculatedEvent,
  GlTransactionLineEvent,
} from '@glapi/business';
import { glAccountBalances, eq, and, sql } from '@glapi/database';

const PROJECTION_NAME = 'gl-account-balance';

export interface BalanceProjectionConfig extends Partial<WorkerConfig> {
  /** Organization ID to process (optional, processes all if not set) */
  organizationId?: string;
}

/**
 * Worker that maintains real-time GL account balances by processing
 * events from the event store.
 */
export class BalanceProjectionWorker extends WorkerBase {
  private organizationId?: string;

  constructor(config: BalanceProjectionConfig = {}, logger?: WorkerLogger) {
    super(
      {
        name: 'balance-projection-worker',
        pollingIntervalMs: 500, // Fast polling for real-time updates
        batchSize: 100,
        ...config,
      },
      logger
    );
    this.organizationId = config.organizationId;
  }

  /**
   * Get the current checkpoint for this projection
   */
  protected async getCheckpoint(): Promise<number> {
    if (this.organizationId) {
      const checkpoint = await eventProjectionRepository.getCheckpoint(
        PROJECTION_NAME,
        this.organizationId
      );
      return checkpoint?.lastGlobalSequence ?? 0;
    }

    // Global checkpoint across all organizations
    return eventProjectionRepository.getGlobalCheckpoint(PROJECTION_NAME);
  }

  /**
   * Get the latest sequence in the event store
   */
  protected async getLatestSequence(): Promise<number> {
    return eventStoreRepository.getCurrentGlobalSequence();
  }

  /**
   * Process a batch of events
   */
  protected async processBatch(): Promise<number> {
    // Organization ID is required for querying events
    if (!this.organizationId) {
      this.logger.warn(
        'No organizationId set for balance projection worker - skipping batch'
      );
      return 0;
    }

    const checkpoint = await this.getCheckpoint();

    // Fetch events after checkpoint using queryEvents
    const events = await eventStoreRepository.queryEvents(
      this.organizationId,
      {
        eventTypes: [
          GlEventTypes.TRANSACTION_POSTED,
          GlEventTypes.TRANSACTION_REVERSED,
          GlEventTypes.TRANSACTION_VOIDED,
          GlEventTypes.BALANCE_RECALCULATED,
        ],
        fromSequence: checkpoint,
        limit: this.config.batchSize,
      }
    );

    if (events.length === 0) {
      return 0;
    }

    let processedCount = 0;

    for (const event of events) {
      try {
        await this.processEvent(event);
        processedCount++;
        this.metrics.lastProcessedSequence = event.globalSequence;
      } catch (error) {
        this.logger.error('Failed to process event', {
          eventId: event.id,
          eventType: event.eventType,
          globalSequence: event.globalSequence,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error; // Re-throw to trigger retry logic
      }
    }

    return processedCount;
  }

  /**
   * Process a single event
   */
  private async processEvent(event: {
    id: string;
    eventType: string;
    eventData: unknown;
    globalSequence: number;
    organizationId: string;
  }): Promise<void> {
    switch (event.eventType) {
      case GlEventTypes.TRANSACTION_POSTED:
        await this.handleTransactionPosted(
          event.eventData as GlTransactionPostedEvent,
          event.organizationId,
          event.globalSequence
        );
        break;

      case GlEventTypes.TRANSACTION_REVERSED:
        await this.handleTransactionReversed(
          event.eventData as GlTransactionReversedEvent,
          event.organizationId,
          event.globalSequence
        );
        break;

      case GlEventTypes.TRANSACTION_VOIDED:
        await this.handleTransactionVoided(
          event.eventData as GlTransactionVoidedEvent,
          event.organizationId,
          event.globalSequence
        );
        break;

      case GlEventTypes.BALANCE_RECALCULATED:
        await this.handleBalanceRecalculated(
          event.eventData as AccountBalanceRecalculatedEvent,
          event.organizationId,
          event.globalSequence
        );
        break;

      default:
        this.logger.warn('Unknown event type', { eventType: event.eventType });
    }
  }

  /**
   * Handle GlTransactionPosted event
   * Add debit/credit amounts to account balances
   */
  private async handleTransactionPosted(
    data: GlTransactionPostedEvent,
    organizationId: string,
    globalSequence: number
  ): Promise<void> {
    // Process each line in the transaction
    for (const line of data.lines) {
      await this.updateAccountBalance(
        line,
        data.subsidiaryId,
        data.periodId,
        organizationId,
        globalSequence,
        'ADD'
      );
    }

    // Update projection checkpoint
    await this.updateCheckpoint(
      data.transactionId,
      'GlTransaction',
      organizationId,
      globalSequence
    );
  }

  /**
   * Handle GlTransactionReversed event
   * Reverse the effects of the original transaction
   */
  private async handleTransactionReversed(
    data: GlTransactionReversedEvent,
    organizationId: string,
    globalSequence: number
  ): Promise<void> {
    // The reversal transaction itself will be posted as a separate event
    // This event just records the relationship
    // No balance update needed here - the reversal posting event handles it

    await this.updateCheckpoint(
      data.originalTransactionId,
      'GlTransaction',
      organizationId,
      globalSequence
    );
  }

  /**
   * Handle GlTransactionVoided event
   * Remove the effects of a voided transaction
   */
  private async handleTransactionVoided(
    data: GlTransactionVoidedEvent,
    organizationId: string,
    globalSequence: number
  ): Promise<void> {
    // For voided transactions, we need to fetch the original transaction
    // and subtract its amounts from balances
    // This would typically require looking up the original transaction
    // For now, we just update the checkpoint

    this.logger.info('Transaction voided - balance adjustment may be needed', {
      transactionId: data.transactionId,
      transactionNumber: data.transactionNumber,
    });

    await this.updateCheckpoint(
      data.transactionId,
      'GlTransaction',
      organizationId,
      globalSequence
    );
  }

  /**
   * Handle AccountBalanceRecalculated event
   * Replace balance with recalculated value
   */
  private async handleBalanceRecalculated(
    data: AccountBalanceRecalculatedEvent,
    organizationId: string,
    globalSequence: number
  ): Promise<void> {
    // Direct balance replacement
    // Note: Using 'USD' as default currency - in production this should come from the event
    await db
      .insert(glAccountBalances)
      .values({
        accountId: data.accountId,
        subsidiaryId: data.subsidiaryId,
        periodId: data.periodId,
        classId: data.classId,
        departmentId: data.departmentId,
        locationId: data.locationId,
        currencyCode: 'USD', // Default currency - should come from event/transaction
        beginningBalanceDebit: '0',
        beginningBalanceCredit: '0',
        periodDebitAmount: '0',
        periodCreditAmount: '0',
        endingBalanceDebit: data.newEndingDebitBalance,
        endingBalanceCredit: data.newEndingCreditBalance,
      })
      .onConflictDoUpdate({
        target: [
          glAccountBalances.accountId,
          glAccountBalances.subsidiaryId,
          glAccountBalances.periodId,
          glAccountBalances.classId,
          glAccountBalances.departmentId,
          glAccountBalances.locationId,
          glAccountBalances.currencyCode,
        ],
        set: {
          endingBalanceDebit: data.newEndingDebitBalance,
          endingBalanceCredit: data.newEndingCreditBalance,
          lastUpdated: new Date(),
        },
      });

    await this.updateCheckpoint(
      `${data.accountId}:${data.periodId}`,
      'AccountBalance',
      organizationId,
      globalSequence
    );
  }

  /**
   * Update account balance for a transaction line
   */
  private async updateAccountBalance(
    line: GlTransactionLineEvent,
    subsidiaryId: string,
    periodId: string,
    organizationId: string,
    globalSequence: number,
    operation: 'ADD' | 'SUBTRACT'
  ): Promise<void> {
    const debitAmount = parseFloat(line.baseDebitAmount) || 0;
    const creditAmount = parseFloat(line.baseCreditAmount) || 0;

    const multiplier = operation === 'ADD' ? 1 : -1;

    // Upsert the account balance
    // Note: Using 'USD' as default currency - in production this should come from the transaction
    await db
      .insert(glAccountBalances)
      .values({
        accountId: line.accountId,
        subsidiaryId,
        periodId,
        classId: line.classId,
        departmentId: line.departmentId,
        locationId: line.locationId,
        currencyCode: 'USD', // Default currency - should come from transaction
        beginningBalanceDebit: '0',
        beginningBalanceCredit: '0',
        periodDebitAmount: (debitAmount * multiplier).toFixed(4),
        periodCreditAmount: (creditAmount * multiplier).toFixed(4),
        endingBalanceDebit: (debitAmount * multiplier).toFixed(4),
        endingBalanceCredit: (creditAmount * multiplier).toFixed(4),
      })
      .onConflictDoUpdate({
        target: [
          glAccountBalances.accountId,
          glAccountBalances.subsidiaryId,
          glAccountBalances.periodId,
          glAccountBalances.classId,
          glAccountBalances.departmentId,
          glAccountBalances.locationId,
          glAccountBalances.currencyCode,
        ],
        set: {
          periodDebitAmount: sql`${glAccountBalances.periodDebitAmount}::numeric + ${(debitAmount * multiplier).toFixed(4)}::numeric`,
          periodCreditAmount: sql`${glAccountBalances.periodCreditAmount}::numeric + ${(creditAmount * multiplier).toFixed(4)}::numeric`,
          endingBalanceDebit: sql`${glAccountBalances.endingBalanceDebit}::numeric + ${(debitAmount * multiplier).toFixed(4)}::numeric`,
          endingBalanceCredit: sql`${glAccountBalances.endingBalanceCredit}::numeric + ${(creditAmount * multiplier).toFixed(4)}::numeric`,
          lastUpdated: new Date(),
        },
      });
  }

  /**
   * Update the projection checkpoint
   */
  private async updateCheckpoint(
    aggregateId: string,
    aggregateType: string,
    organizationId: string,
    globalSequence: number
  ): Promise<void> {
    await eventProjectionRepository.upsertProjection({
      projectionName: PROJECTION_NAME,
      aggregateId,
      aggregateType,
      organizationId,
      lastEventVersion: 1, // Simplified for now
      lastGlobalSequence: globalSequence,
      projectionData: { lastUpdated: new Date().toISOString() },
    });
  }
}
