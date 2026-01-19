import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  decimal,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { transactionHeaders } from './transaction-core';
import { accounts } from './accounts';

// ============================================================================
// CUSTOMER PAYMENT EXTENSION
// ============================================================================

export const customerPaymentExt = pgTable('customer_payment_ext', {
  transactionId: uuid('transaction_id').primaryKey().references(() => transactionHeaders.id, { onDelete: 'cascade' }),

  // External reference
  externalReference: text('external_reference'),

  // Payment method
  paymentMethod: text('payment_method').notNull(),

  // Check details
  checkNumber: text('check_number'),
  bankRoutingNumber: text('bank_routing_number'),
  bankAccountLast4: text('bank_account_last4'),

  // Amounts
  paymentAmount: decimal('payment_amount', { precision: 18, scale: 4 }).notNull(),
  appliedAmount: decimal('applied_amount', { precision: 18, scale: 4 }).default('0'),
  unappliedAmount: decimal('unapplied_amount', { precision: 18, scale: 4 }).default('0'),

  // Accounts
  cashAccountId: uuid('cash_account_id').references(() => accounts.id),
  arAccountId: uuid('ar_account_id').references(() => accounts.id),

  // GL posting
  glTransactionId: uuid('gl_transaction_id'),
  postedAt: timestamp('posted_at', { withTimezone: true }),

  // Bank deposit
  bankDepositId: uuid('bank_deposit_id'),  // References bank_deposits table

  // Voiding
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  voidedBy: text('voided_by'),
  voidReason: text('void_reason'),
}, (table) => ({
  methodIdx: index('customer_payment_ext_method_idx').on(table.paymentMethod),
  depositIdx: index('customer_payment_ext_deposit_idx').on(table.bankDepositId),
}));

// ============================================================================
// CUSTOMER PAYMENT APPLICATIONS (Junction Table)
// ============================================================================

export const customerPaymentApplications2 = pgTable('customer_payment_applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: text('organization_id').notNull(),

  // Payment reference
  paymentId: uuid('payment_id').notNull().references(() => transactionHeaders.id),

  // Invoice reference
  invoiceId: uuid('invoice_id').notNull().references(() => transactionHeaders.id),

  // Application details
  appliedAmount: decimal('applied_amount', { precision: 18, scale: 4 }).notNull(),
  discountTaken: decimal('discount_taken', { precision: 18, scale: 4 }).default('0'),
  applicationDate: date('application_date').notNull(),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by').notNull(),
}, (table) => ({
  paymentIdx: index('customer_payment_applications_payment_idx').on(table.paymentId),
  invoiceIdx: index('customer_payment_applications_invoice_idx').on(table.invoiceId),
  uniqueIdx: uniqueIndex('customer_payment_applications_unique').on(table.paymentId, table.invoiceId),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const customerPaymentExtRelations = relations(customerPaymentExt, ({ one }) => ({
  transaction: one(transactionHeaders, {
    fields: [customerPaymentExt.transactionId],
    references: [transactionHeaders.id],
  }),
  cashAccount: one(accounts, {
    fields: [customerPaymentExt.cashAccountId],
    references: [accounts.id],
    relationName: 'custPayCash',
  }),
  arAccount: one(accounts, {
    fields: [customerPaymentExt.arAccountId],
    references: [accounts.id],
    relationName: 'custPayAR',
  }),
}));

export const customerPaymentApplications2Relations = relations(customerPaymentApplications2, ({ one }) => ({
  payment: one(transactionHeaders, {
    fields: [customerPaymentApplications2.paymentId],
    references: [transactionHeaders.id],
    relationName: 'custPayApps',
  }),
  invoice: one(transactionHeaders, {
    fields: [customerPaymentApplications2.invoiceId],
    references: [transactionHeaders.id],
    relationName: 'custInvApps',
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type CustomerPaymentExtRecord = InferSelectModel<typeof customerPaymentExt>;
export type NewCustomerPaymentExtRecord = InferInsertModel<typeof customerPaymentExt>;
export type UpdateCustomerPaymentExtRecord = Partial<Omit<NewCustomerPaymentExtRecord, 'transactionId'>>;

export type CustomerPaymentApplication2 = InferSelectModel<typeof customerPaymentApplications2>;
export type NewCustomerPaymentApplication2 = InferInsertModel<typeof customerPaymentApplications2>;
