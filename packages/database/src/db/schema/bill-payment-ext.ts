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
// BILL PAYMENT EXTENSION
// ============================================================================

export const billPaymentExt = pgTable('bill_payment_ext', {
  transactionId: uuid('transaction_id').primaryKey().references(() => transactionHeaders.id, { onDelete: 'cascade' }),

  // Payment method
  paymentMethod: text('payment_method').notNull(),
  paymentAmount: decimal('payment_amount', { precision: 18, scale: 4 }).notNull(),

  // Application tracking
  appliedAmount: decimal('applied_amount', { precision: 18, scale: 4 }).default('0'),
  unappliedAmount: decimal('unapplied_amount', { precision: 18, scale: 4 }).default('0'),
  discountTaken: decimal('discount_taken', { precision: 18, scale: 4 }).default('0'),

  // Bank account
  bankAccountId: uuid('bank_account_id').references(() => accounts.id),

  // Payment details by method
  checkNumber: text('check_number'),
  achTraceNumber: text('ach_trace_number'),
  wireReference: text('wire_reference'),
  externalRef: text('external_ref'),

  // Payee info (for printing checks)
  payeeName: text('payee_name'),
  payeeAddress: text('payee_address'),

  // Bank reconciliation
  clearedDate: date('cleared_date'),
  clearedAmount: decimal('cleared_amount', { precision: 18, scale: 4 }),

  // Voiding
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  voidedBy: text('voided_by'),
  voidReason: text('void_reason'),
}, (table) => ({
  methodIdx: index('bill_payment_ext_method_idx').on(table.paymentMethod),
  clearedIdx: index('bill_payment_ext_cleared_idx').on(table.clearedDate),
}));

// ============================================================================
// BILL PAYMENT APPLICATIONS (Junction Table)
// ============================================================================

export const billPaymentApplications2 = pgTable('bill_payment_applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: text('organization_id').notNull(),

  // Payment reference
  paymentId: uuid('payment_id').notNull().references(() => transactionHeaders.id),

  // Bill reference
  billId: uuid('bill_id').notNull().references(() => transactionHeaders.id),

  // Application details
  appliedAmount: decimal('applied_amount', { precision: 18, scale: 4 }).notNull(),
  discountTaken: decimal('discount_taken', { precision: 18, scale: 4 }).default('0'),
  applicationDate: date('application_date').notNull(),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by').notNull(),
}, (table) => ({
  paymentIdx: index('bill_payment_applications_payment_idx').on(table.paymentId),
  billIdx: index('bill_payment_applications_bill_idx').on(table.billId),
  uniqueIdx: uniqueIndex('bill_payment_applications_unique').on(table.paymentId, table.billId),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const billPaymentExtRelations = relations(billPaymentExt, ({ one }) => ({
  transaction: one(transactionHeaders, {
    fields: [billPaymentExt.transactionId],
    references: [transactionHeaders.id],
  }),
  bankAccount: one(accounts, {
    fields: [billPaymentExt.bankAccountId],
    references: [accounts.id],
  }),
}));

export const billPaymentApplications2Relations = relations(billPaymentApplications2, ({ one }) => ({
  payment: one(transactionHeaders, {
    fields: [billPaymentApplications2.paymentId],
    references: [transactionHeaders.id],
    relationName: 'paymentApps',
  }),
  bill: one(transactionHeaders, {
    fields: [billPaymentApplications2.billId],
    references: [transactionHeaders.id],
    relationName: 'billApps',
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type BillPaymentExtRecord = InferSelectModel<typeof billPaymentExt>;
export type NewBillPaymentExtRecord = InferInsertModel<typeof billPaymentExt>;
export type UpdateBillPaymentExtRecord = Partial<Omit<NewBillPaymentExtRecord, 'transactionId'>>;

export type BillPaymentApplication2 = InferSelectModel<typeof billPaymentApplications2>;
export type NewBillPaymentApplication2 = InferInsertModel<typeof billPaymentApplications2>;
