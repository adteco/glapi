import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  decimal,
  index,
} from 'drizzle-orm/pg-core';
import { relations, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { transactionHeaders, transactionLines } from './transaction-core';
import { accounts } from './accounts';

// ============================================================================
// INVOICE EXTENSION
// ============================================================================

export const invoiceExt = pgTable('invoice_ext', {
  transactionId: uuid('transaction_id').primaryKey().references(() => transactionHeaders.id, { onDelete: 'cascade' }),

  // Source references
  subscriptionId: uuid('subscription_id'),
  salesOrderId: uuid('sales_order_id').references(() => transactionHeaders.id),

  // Payment terms
  dueDate: date('due_date'),

  // Billing period (for subscriptions)
  billingPeriodStart: date('billing_period_start'),
  billingPeriodEnd: date('billing_period_end'),

  // Payment tracking
  paidAmount: decimal('paid_amount', { precision: 18, scale: 4 }).default('0'),
  balanceDue: decimal('balance_due', { precision: 18, scale: 4 }).default('0'),

  // AR account
  arAccountId: uuid('ar_account_id').references(() => accounts.id),

  // Voiding
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  voidedBy: text('voided_by'),
  voidReason: text('void_reason'),
}, (table) => ({
  dueDateIdx: index('invoice_ext_due_date_idx').on(table.dueDate),
  subscriptionIdx: index('invoice_ext_subscription_idx').on(table.subscriptionId),
  salesOrderIdx: index('invoice_ext_sales_order_idx').on(table.salesOrderId),
}));

// ============================================================================
// INVOICE LINE EXTENSION
// ============================================================================

export const invoiceLineExt = pgTable('invoice_line_ext', {
  lineId: uuid('line_id').primaryKey().references(() => transactionLines.id, { onDelete: 'cascade' }),

  // Subscription reference
  subscriptionItemId: uuid('subscription_item_id'),

  // Source line references
  salesOrderLineId: uuid('sales_order_line_id').references(() => transactionLines.id),

  // Revenue recognition
  revenueAccountId: uuid('revenue_account_id').references(() => accounts.id),
  deferredRevenueAccountId: uuid('deferred_revenue_account_id').references(() => accounts.id),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const invoiceExtRelations = relations(invoiceExt, ({ one }) => ({
  transaction: one(transactionHeaders, {
    fields: [invoiceExt.transactionId],
    references: [transactionHeaders.id],
    relationName: 'invoice',
  }),
  salesOrder: one(transactionHeaders, {
    fields: [invoiceExt.salesOrderId],
    references: [transactionHeaders.id],
    relationName: 'invoiceSO',
  }),
  arAccount: one(accounts, {
    fields: [invoiceExt.arAccountId],
    references: [accounts.id],
  }),
}));

export const invoiceLineExtRelations = relations(invoiceLineExt, ({ one }) => ({
  line: one(transactionLines, {
    fields: [invoiceLineExt.lineId],
    references: [transactionLines.id],
    relationName: 'invoiceLine',
  }),
  salesOrderLine: one(transactionLines, {
    fields: [invoiceLineExt.salesOrderLineId],
    references: [transactionLines.id],
    relationName: 'invoiceSOLine',
  }),
  revenueAccount: one(accounts, {
    fields: [invoiceLineExt.revenueAccountId],
    references: [accounts.id],
    relationName: 'invLineRevenue',
  }),
  deferredRevenueAccount: one(accounts, {
    fields: [invoiceLineExt.deferredRevenueAccountId],
    references: [accounts.id],
    relationName: 'invLineDeferredRevenue',
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type InvoiceExtRecord = InferSelectModel<typeof invoiceExt>;
export type NewInvoiceExtRecord = InferInsertModel<typeof invoiceExt>;
export type UpdateInvoiceExtRecord = Partial<Omit<NewInvoiceExtRecord, 'transactionId'>>;

export type InvoiceLineExtRecord = InferSelectModel<typeof invoiceLineExt>;
export type NewInvoiceLineExtRecord = InferInsertModel<typeof invoiceLineExt>;
export type UpdateInvoiceLineExtRecord = Partial<Omit<NewInvoiceLineExtRecord, 'lineId'>>;
