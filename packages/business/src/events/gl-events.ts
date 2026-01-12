/**
 * GL Event Definitions for Event Sourcing
 *
 * These event types are used by the event store and projection system
 * to track GL transaction changes and maintain real-time balance projections.
 *
 * Coordinated with FrostyLynx (glapi-plr, glapi-czl) on event formats.
 */

// ============ Event Category ============

export const GlEventCategory = 'ACCOUNTING' as const;

// ============ Event Types ============

export const GlEventTypes = {
  TRANSACTION_POSTED: 'GlTransactionPosted',
  TRANSACTION_REVERSED: 'GlTransactionReversed',
  TRANSACTION_VOIDED: 'GlTransactionVoided',
  BALANCE_RECALCULATED: 'AccountBalanceRecalculated',
  PERIOD_BALANCE_SNAPSHOT: 'PeriodBalanceSnapshot',
} as const;

export type GlEventType = (typeof GlEventTypes)[keyof typeof GlEventTypes];

// ============ Event Payloads ============

/**
 * GL Transaction Line for event payload
 */
export interface GlTransactionLineEvent {
  lineNumber: number;
  accountId: string;
  classId?: string;
  departmentId?: string;
  locationId?: string;
  projectId?: string;
  debitAmount: string;
  creditAmount: string;
  currencyCode: string;
  exchangeRate: string;
  baseDebitAmount: string;
  baseCreditAmount: string;
  description?: string;
  reference1?: string;
  reference2?: string;
}

/**
 * Event emitted when a GL transaction is posted
 */
export interface GlTransactionPostedEvent {
  // Header
  transactionId: string;
  transactionNumber: string;
  subsidiaryId: string;
  periodId: string;
  postingDate: string;
  transactionDate: string;
  transactionType: 'JOURNAL' | 'POSTING' | 'REVERSAL' | 'CLOSING';

  // Source tracking
  sourceTransactionId?: string;
  sourceTransactionType?: string;
  sourceSystem: 'MANUAL' | 'AUTO' | 'IMPORT';

  // Totals for quick balance validation
  totalDebitAmount: string;
  totalCreditAmount: string;
  baseCurrencyCode: string;

  // Posted by
  postedBy: string;
  postedAt: string;

  // Lines
  lines: GlTransactionLineEvent[];

  // Memo/description
  memo?: string;
}

/**
 * Event emitted when a GL transaction is reversed
 */
export interface GlTransactionReversedEvent {
  // Original transaction
  originalTransactionId: string;
  originalTransactionNumber: string;

  // Reversal transaction
  reversalTransactionId: string;
  reversalTransactionNumber: string;
  reversalDate: string;
  reversalPeriodId: string;

  // Reason
  reversalReason: string;

  // Reversed by
  reversedBy: string;
  reversedAt: string;

  // Subsidiary
  subsidiaryId: string;
}

/**
 * Event emitted when a GL transaction is voided (different from reversal)
 */
export interface GlTransactionVoidedEvent {
  transactionId: string;
  transactionNumber: string;
  voidReason: string;
  voidedBy: string;
  voidedAt: string;
  subsidiaryId: string;
  periodId: string;
}

/**
 * Event emitted when account balance is recalculated
 * (e.g., after period close or correction)
 */
export interface AccountBalanceRecalculatedEvent {
  accountId: string;
  subsidiaryId: string;
  periodId: string;

  // Dimension filters (if applicable)
  classId?: string;
  departmentId?: string;
  locationId?: string;

  // Previous balance
  previousEndingDebitBalance: string;
  previousEndingCreditBalance: string;

  // New balance
  newEndingDebitBalance: string;
  newEndingCreditBalance: string;

  // Reason for recalculation
  reason: 'PERIOD_CLOSE' | 'CORRECTION' | 'FX_REMEASUREMENT' | 'RECONCILIATION';

  recalculatedBy: string;
  recalculatedAt: string;
}

/**
 * Event emitted for period-end balance snapshot
 */
export interface PeriodBalanceSnapshotEvent {
  periodId: string;
  subsidiaryId: string;
  snapshotDate: string;

  // Summary totals
  totalAccounts: number;
  totalDebitBalance: string;
  totalCreditBalance: string;

  // Snapshot metadata
  createdBy: string;
  createdAt: string;
}

// ============ Event Type Union ============

export type GlEvent =
  | { type: typeof GlEventTypes.TRANSACTION_POSTED; data: GlTransactionPostedEvent }
  | { type: typeof GlEventTypes.TRANSACTION_REVERSED; data: GlTransactionReversedEvent }
  | { type: typeof GlEventTypes.TRANSACTION_VOIDED; data: GlTransactionVoidedEvent }
  | { type: typeof GlEventTypes.BALANCE_RECALCULATED; data: AccountBalanceRecalculatedEvent }
  | { type: typeof GlEventTypes.PERIOD_BALANCE_SNAPSHOT; data: PeriodBalanceSnapshotEvent };

// ============ Aggregate Info ============

export const GlAggregateTypes = {
  GL_TRANSACTION: 'GlTransaction',
  ACCOUNT_BALANCE: 'AccountBalance',
  PERIOD: 'Period',
} as const;

export type GlAggregateType = (typeof GlAggregateTypes)[keyof typeof GlAggregateTypes];

// ============ Helper Functions ============

/**
 * Generate aggregate ID for GL transaction
 */
export function getTransactionAggregateId(transactionId: string): string {
  return transactionId;
}

/**
 * Generate aggregate ID for account balance
 * Format: {accountId}:{subsidiaryId}:{periodId}[:{classId}][:{departmentId}][:{locationId}]
 */
export function getBalanceAggregateId(
  accountId: string,
  subsidiaryId: string,
  periodId: string,
  classId?: string,
  departmentId?: string,
  locationId?: string
): string {
  const parts = [accountId, subsidiaryId, periodId];
  if (classId) parts.push(classId);
  if (departmentId) parts.push(departmentId);
  if (locationId) parts.push(locationId);
  return parts.join(':');
}

/**
 * Generate topic name for GL events
 */
export function getGlEventTopic(eventType: GlEventType): string {
  return `gl.${eventType.toLowerCase().replace(/([A-Z])/g, '-$1').toLowerCase()}`;
}

/**
 * Calculate net effect of a transaction line on account balance
 */
export function calculateLineNetEffect(line: GlTransactionLineEvent): {
  netDebit: string;
  netCredit: string;
} {
  const debit = parseFloat(line.baseDebitAmount) || 0;
  const credit = parseFloat(line.baseCreditAmount) || 0;
  return {
    netDebit: debit.toFixed(2),
    netCredit: credit.toFixed(2),
  };
}
