import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  decimal,
  pgEnum,
  date,
  jsonb,
  boolean,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { organizations } from './organizations';
import { subsidiaries } from './subsidiaries';
import { entities } from './entities';
import { invoices } from './invoices';
import { accounts } from './accounts';

// ============================================================================
// Enums
// ============================================================================

/**
 * Customer payment status
 */
export const customerPaymentStatusEnum = pgEnum('customer_payment_status', [
  'RECEIVED',      // Payment received, pending application
  'PARTIALLY_APPLIED', // Some amount applied to invoices
  'FULLY_APPLIED', // Entire amount applied to invoices
  'ON_ACCOUNT',    // Unapplied balance held on account
  'DEPOSITED',     // Added to bank deposit batch
  'RECONCILED',    // Matched to bank statement
  'VOIDED',        // Payment voided/reversed
]);

/**
 * Payment method types
 */
export const paymentMethodTypeEnum = pgEnum('payment_method_type', [
  'CHECK',
  'ACH',
  'WIRE',
  'CREDIT_CARD',
  'CASH',
  'LOCKBOX',
  'ONLINE',
  'OTHER',
]);

/**
 * Bank deposit status
 */
export const bankDepositStatusEnum = pgEnum('bank_deposit_status', [
  'OPEN',          // Accepting payments
  'SUBMITTED',     // Submitted for deposit
  'DEPOSITED',     // Deposited at bank
  'RECONCILED',    // Matched to bank statement
  'CANCELLED',     // Deposit cancelled
]);

/**
 * Reconciliation status
 */
export const reconciliationStatusEnum = pgEnum('reconciliation_status', [
  'PENDING',       // Awaiting reconciliation
  'MATCHED',       // Matched to bank statement
  'EXCEPTION',     // Requires manual review
  'RESOLVED',      // Exception resolved
]);

/**
 * Application method for auto-apply rules
 */
export const applicationMethodEnum = pgEnum('application_method', [
  'OLDEST_FIRST',  // Apply to oldest invoices first
  'SPECIFIC',      // Apply to specific invoices
  'PROPORTIONAL',  // Apply proportionally across invoices
  'LARGEST_FIRST', // Apply to largest invoices first
  'MANUAL',        // Manual application only
]);

// ============================================================================
// Customer Payment Status Constants
// ============================================================================

export const CustomerPaymentStatus = {
  RECEIVED: 'RECEIVED',
  PARTIALLY_APPLIED: 'PARTIALLY_APPLIED',
  FULLY_APPLIED: 'FULLY_APPLIED',
  ON_ACCOUNT: 'ON_ACCOUNT',
  DEPOSITED: 'DEPOSITED',
  RECONCILED: 'RECONCILED',
  VOIDED: 'VOIDED',
} as const;

export type CustomerPaymentStatusValue = typeof CustomerPaymentStatus[keyof typeof CustomerPaymentStatus];

export const BankDepositStatus = {
  OPEN: 'OPEN',
  SUBMITTED: 'SUBMITTED',
  DEPOSITED: 'DEPOSITED',
  RECONCILED: 'RECONCILED',
  CANCELLED: 'CANCELLED',
} as const;

export type BankDepositStatusValue = typeof BankDepositStatus[keyof typeof BankDepositStatus];

export const ReconciliationStatus = {
  PENDING: 'PENDING',
  MATCHED: 'MATCHED',
  EXCEPTION: 'EXCEPTION',
  RESOLVED: 'RESOLVED',
} as const;

export type ReconciliationStatusValue = typeof ReconciliationStatus[keyof typeof ReconciliationStatus];

export const ApplicationMethod = {
  OLDEST_FIRST: 'OLDEST_FIRST',
  SPECIFIC: 'SPECIFIC',
  PROPORTIONAL: 'PROPORTIONAL',
  LARGEST_FIRST: 'LARGEST_FIRST',
  MANUAL: 'MANUAL',
} as const;

export type ApplicationMethodValue = typeof ApplicationMethod[keyof typeof ApplicationMethod];

// ============================================================================
// Customer Payments Table
// ============================================================================

/**
 * Customer payments - Payments received from customers
 *
 * This is the master payment record. Payment applications to specific
 * invoices are tracked in customer_payment_applications.
 */
export const customerPayments = pgTable('customer_payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  subsidiaryId: uuid('subsidiary_id').references(() => subsidiaries.id).notNull(),

  // Payment identification
  paymentNumber: varchar('payment_number', { length: 50 }).notNull(),
  externalReference: varchar('external_reference', { length: 100 }),

  // Customer
  entityId: uuid('entity_id').references(() => entities.id).notNull(),

  // Payment details
  paymentDate: date('payment_date').notNull(),
  paymentMethod: paymentMethodTypeEnum('payment_method').notNull(),
  checkNumber: varchar('check_number', { length: 50 }),
  bankRoutingNumber: varchar('bank_routing_number', { length: 20 }),
  bankAccountLast4: varchar('bank_account_last4', { length: 4 }),

  // Amounts
  currencyCode: varchar('currency_code', { length: 3 }).notNull().default('USD'),
  exchangeRate: decimal('exchange_rate', { precision: 15, scale: 6 }).notNull().default('1.000000'),
  paymentAmount: decimal('payment_amount', { precision: 15, scale: 2 }).notNull(),
  appliedAmount: decimal('applied_amount', { precision: 15, scale: 2 }).notNull().default('0.00'),
  unappliedAmount: decimal('unapplied_amount', { precision: 15, scale: 2 }).notNull().default('0.00'),

  // Status
  status: customerPaymentStatusEnum('status').notNull().default('RECEIVED'),

  // GL Integration
  cashAccountId: uuid('cash_account_id').references(() => accounts.id),
  arAccountId: uuid('ar_account_id').references(() => accounts.id),
  glTransactionId: uuid('gl_transaction_id'),
  postedAt: timestamp('posted_at', { withTimezone: true }),

  // Bank deposit reference
  bankDepositId: uuid('bank_deposit_id'),

  // Notes and metadata
  memo: text('memo'),
  internalNotes: text('internal_notes'),
  metadata: jsonb('metadata'),

  // Audit
  createdBy: varchar('created_by', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: varchar('updated_by', { length: 100 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  voidedBy: varchar('voided_by', { length: 100 }),
  voidReason: text('void_reason'),
}, (table) => ({
  orgSubsidiaryIdx: index('customer_payments_org_subsidiary_idx')
    .on(table.organizationId, table.subsidiaryId),
  entityIdx: index('customer_payments_entity_idx')
    .on(table.organizationId, table.entityId),
  paymentDateIdx: index('customer_payments_date_idx')
    .on(table.organizationId, table.paymentDate),
  statusIdx: index('customer_payments_status_idx')
    .on(table.organizationId, table.status),
  depositIdx: index('customer_payments_deposit_idx')
    .on(table.bankDepositId),
  paymentNumberIdx: uniqueIndex('customer_payments_number_idx')
    .on(table.organizationId, table.paymentNumber),
}));

// ============================================================================
// Payment Applications Table
// ============================================================================

/**
 * Payment applications - How payments are applied to invoices
 */
export const customerPaymentApplications = pgTable('customer_payment_applications', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),

  // References
  customerPaymentId: uuid('customer_payment_id').references(() => customerPayments.id).notNull(),
  invoiceId: uuid('invoice_id').references(() => invoices.id).notNull(),

  // Application details
  applicationDate: date('application_date').notNull(),
  appliedAmount: decimal('applied_amount', { precision: 15, scale: 2 }).notNull(),
  discountAmount: decimal('discount_amount', { precision: 15, scale: 2 }).notNull().default('0.00'),
  writeOffAmount: decimal('write_off_amount', { precision: 15, scale: 2 }).notNull().default('0.00'),

  // GL references
  discountAccountId: uuid('discount_account_id').references(() => accounts.id),
  writeOffAccountId: uuid('write_off_account_id').references(() => accounts.id),

  // Notes
  memo: text('memo'),

  // Audit
  createdBy: varchar('created_by', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  reversedAt: timestamp('reversed_at', { withTimezone: true }),
  reversedBy: varchar('reversed_by', { length: 100 }),
}, (table) => ({
  paymentIdx: index('payment_applications_payment_idx')
    .on(table.customerPaymentId),
  invoiceIdx: index('payment_applications_invoice_idx')
    .on(table.invoiceId),
  dateIdx: index('payment_applications_date_idx')
    .on(table.organizationId, table.applicationDate),
}));

// ============================================================================
// Bank Deposits Table
// ============================================================================

/**
 * Bank deposits - Batches of payments deposited together
 */
export const bankDeposits = pgTable('bank_deposits', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  subsidiaryId: uuid('subsidiary_id').references(() => subsidiaries.id).notNull(),

  // Deposit identification
  depositNumber: varchar('deposit_number', { length: 50 }).notNull(),
  depositDate: date('deposit_date').notNull(),

  // Bank account
  bankAccountId: uuid('bank_account_id').references(() => accounts.id).notNull(),
  bankAccountName: varchar('bank_account_name', { length: 200 }),

  // Amounts
  currencyCode: varchar('currency_code', { length: 3 }).notNull().default('USD'),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).notNull().default('0.00'),
  paymentCount: integer('payment_count').notNull().default(0),

  // Status
  status: bankDepositStatusEnum('status').notNull().default('OPEN'),

  // GL Integration
  glTransactionId: uuid('gl_transaction_id'),
  postedAt: timestamp('posted_at', { withTimezone: true }),

  // Reconciliation
  reconciliationStatus: reconciliationStatusEnum('reconciliation_status').default('PENDING'),
  reconciledAt: timestamp('reconciled_at', { withTimezone: true }),
  reconciledBy: varchar('reconciled_by', { length: 100 }),
  bankStatementDate: date('bank_statement_date'),
  bankStatementRef: varchar('bank_statement_ref', { length: 100 }),

  // Notes
  memo: text('memo'),
  internalNotes: text('internal_notes'),
  metadata: jsonb('metadata'),

  // Audit
  createdBy: varchar('created_by', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: varchar('updated_by', { length: 100 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  submittedBy: varchar('submitted_by', { length: 100 }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancelledBy: varchar('cancelled_by', { length: 100 }),
  cancellationReason: text('cancellation_reason'),
}, (table) => ({
  orgSubsidiaryIdx: index('bank_deposits_org_subsidiary_idx')
    .on(table.organizationId, table.subsidiaryId),
  dateIdx: index('bank_deposits_date_idx')
    .on(table.organizationId, table.depositDate),
  statusIdx: index('bank_deposits_status_idx')
    .on(table.organizationId, table.status),
  depositNumberIdx: uniqueIndex('bank_deposits_number_idx')
    .on(table.organizationId, table.depositNumber),
  bankAccountIdx: index('bank_deposits_bank_account_idx')
    .on(table.bankAccountId),
}));

// ============================================================================
// Bank Reconciliation Exceptions Table
// ============================================================================

/**
 * Bank reconciliation exceptions - Items requiring manual review
 */
export const bankReconciliationExceptions = pgTable('bank_reconciliation_exceptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),

  // Reference
  bankDepositId: uuid('bank_deposit_id').references(() => bankDeposits.id),
  customerPaymentId: uuid('customer_payment_id').references(() => customerPayments.id),

  // Exception details
  exceptionType: varchar('exception_type', { length: 50 }).notNull(),
  exceptionDescription: text('exception_description').notNull(),

  // Bank statement data
  bankStatementDate: date('bank_statement_date'),
  bankStatementRef: varchar('bank_statement_ref', { length: 100 }),
  bankStatementAmount: decimal('bank_statement_amount', { precision: 15, scale: 2 }),

  // System data
  systemAmount: decimal('system_amount', { precision: 15, scale: 2 }),
  varianceAmount: decimal('variance_amount', { precision: 15, scale: 2 }),

  // Status
  status: reconciliationStatusEnum('status').notNull().default('EXCEPTION'),

  // Resolution
  resolutionNotes: text('resolution_notes'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedBy: varchar('resolved_by', { length: 100 }),

  // Audit
  createdBy: varchar('created_by', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgStatusIdx: index('recon_exceptions_org_status_idx')
    .on(table.organizationId, table.status),
  depositIdx: index('recon_exceptions_deposit_idx')
    .on(table.bankDepositId),
  paymentIdx: index('recon_exceptions_payment_idx')
    .on(table.customerPaymentId),
}));

// ============================================================================
// Customer Credit Memos Table
// ============================================================================

/**
 * Customer credit memos - Credits on customer accounts
 */
export const customerCreditMemos = pgTable('customer_credit_memos', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  subsidiaryId: uuid('subsidiary_id').references(() => subsidiaries.id).notNull(),

  // Identification
  creditMemoNumber: varchar('credit_memo_number', { length: 50 }).notNull(),

  // Customer
  entityId: uuid('entity_id').references(() => entities.id).notNull(),

  // Reference (source of credit)
  sourceType: varchar('source_type', { length: 50 }).notNull(), // OVERPAYMENT, RETURN, ADJUSTMENT
  sourcePaymentId: uuid('source_payment_id').references(() => customerPayments.id),
  sourceInvoiceId: uuid('source_invoice_id').references(() => invoices.id),

  // Amounts
  creditDate: date('credit_date').notNull(),
  currencyCode: varchar('currency_code', { length: 3 }).notNull().default('USD'),
  originalAmount: decimal('original_amount', { precision: 15, scale: 2 }).notNull(),
  appliedAmount: decimal('applied_amount', { precision: 15, scale: 2 }).notNull().default('0.00'),
  remainingAmount: decimal('remaining_amount', { precision: 15, scale: 2 }).notNull(),

  // Status
  isFullyApplied: boolean('is_fully_applied').notNull().default(false),

  // GL Integration
  creditAccountId: uuid('credit_account_id').references(() => accounts.id),
  glTransactionId: uuid('gl_transaction_id'),

  // Notes
  reason: text('reason'),
  memo: text('memo'),
  metadata: jsonb('metadata'),

  // Audit
  createdBy: varchar('created_by', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: varchar('updated_by', { length: 100 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  entityIdx: index('credit_memos_entity_idx')
    .on(table.organizationId, table.entityId),
  numberIdx: uniqueIndex('credit_memos_number_idx')
    .on(table.organizationId, table.creditMemoNumber),
}));

// ============================================================================
// Relations
// ============================================================================

export const customerPaymentsRelations = relations(customerPayments, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [customerPayments.organizationId],
    references: [organizations.id],
  }),
  subsidiary: one(subsidiaries, {
    fields: [customerPayments.subsidiaryId],
    references: [subsidiaries.id],
  }),
  entity: one(entities, {
    fields: [customerPayments.entityId],
    references: [entities.id],
  }),
  cashAccount: one(accounts, {
    fields: [customerPayments.cashAccountId],
    references: [accounts.id],
  }),
  bankDeposit: one(bankDeposits, {
    fields: [customerPayments.bankDepositId],
    references: [bankDeposits.id],
  }),
  applications: many(customerPaymentApplications),
}));

export const customerPaymentApplicationsRelations = relations(customerPaymentApplications, ({ one }) => ({
  organization: one(organizations, {
    fields: [customerPaymentApplications.organizationId],
    references: [organizations.id],
  }),
  customerPayment: one(customerPayments, {
    fields: [customerPaymentApplications.customerPaymentId],
    references: [customerPayments.id],
  }),
  invoice: one(invoices, {
    fields: [customerPaymentApplications.invoiceId],
    references: [invoices.id],
  }),
}));

export const bankDepositsRelations = relations(bankDeposits, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [bankDeposits.organizationId],
    references: [organizations.id],
  }),
  subsidiary: one(subsidiaries, {
    fields: [bankDeposits.subsidiaryId],
    references: [subsidiaries.id],
  }),
  bankAccount: one(accounts, {
    fields: [bankDeposits.bankAccountId],
    references: [accounts.id],
  }),
  payments: many(customerPayments),
  exceptions: many(bankReconciliationExceptions),
}));

export const bankReconciliationExceptionsRelations = relations(bankReconciliationExceptions, ({ one }) => ({
  organization: one(organizations, {
    fields: [bankReconciliationExceptions.organizationId],
    references: [organizations.id],
  }),
  bankDeposit: one(bankDeposits, {
    fields: [bankReconciliationExceptions.bankDepositId],
    references: [bankDeposits.id],
  }),
  customerPayment: one(customerPayments, {
    fields: [bankReconciliationExceptions.customerPaymentId],
    references: [customerPayments.id],
  }),
}));

export const customerCreditMemosRelations = relations(customerCreditMemos, ({ one }) => ({
  organization: one(organizations, {
    fields: [customerCreditMemos.organizationId],
    references: [organizations.id],
  }),
  subsidiary: one(subsidiaries, {
    fields: [customerCreditMemos.subsidiaryId],
    references: [subsidiaries.id],
  }),
  entity: one(entities, {
    fields: [customerCreditMemos.entityId],
    references: [entities.id],
  }),
  sourcePayment: one(customerPayments, {
    fields: [customerCreditMemos.sourcePaymentId],
    references: [customerPayments.id],
  }),
  sourceInvoice: one(invoices, {
    fields: [customerCreditMemos.sourceInvoiceId],
    references: [invoices.id],
  }),
}));

// ============================================================================
// Types
// ============================================================================

export type CustomerPayment = InferSelectModel<typeof customerPayments>;
export type NewCustomerPayment = InferInsertModel<typeof customerPayments>;
export type UpdateCustomerPayment = Partial<NewCustomerPayment>;

export type CustomerPaymentApplication = InferSelectModel<typeof customerPaymentApplications>;
export type NewCustomerPaymentApplication = InferInsertModel<typeof customerPaymentApplications>;

export type BankDeposit = InferSelectModel<typeof bankDeposits>;
export type NewBankDeposit = InferInsertModel<typeof bankDeposits>;
export type UpdateBankDeposit = Partial<NewBankDeposit>;

export type BankReconciliationException = InferSelectModel<typeof bankReconciliationExceptions>;
export type NewBankReconciliationException = InferInsertModel<typeof bankReconciliationExceptions>;

export type CustomerCreditMemo = InferSelectModel<typeof customerCreditMemos>;
export type NewCustomerCreditMemo = InferInsertModel<typeof customerCreditMemos>;
