import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  decimal,
  boolean,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { relations, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { transactionHeaders, transactionLines } from './transaction-core';
import { accounts } from './accounts';

// ============================================================================
// SALES ORDER EXTENSION
// ============================================================================

export const salesOrderExt = pgTable('sales_order_ext', {
  transactionId: uuid('transaction_id').primaryKey().references(() => transactionHeaders.id, { onDelete: 'cascade' }),

  // External reference
  externalReference: text('external_reference'),

  // Addresses
  billingAddressId: uuid('billing_address_id'),
  shippingAddressId: uuid('shipping_address_id'),

  // Delivery dates
  requestedDeliveryDate: date('requested_delivery_date'),
  promisedDeliveryDate: date('promised_delivery_date'),
  expirationDate: date('expiration_date'),

  // Status tracking
  previousStatus: text('previous_status'),

  // Discounts
  discountAmount: decimal('discount_amount', { precision: 18, scale: 4 }).default('0'),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }).default('0'),

  // Shipping
  shippingAmount: decimal('shipping_amount', { precision: 18, scale: 4 }).default('0'),
  shippingMethod: text('shipping_method'),

  // Fulfillment tracking
  fulfilledAmount: decimal('fulfilled_amount', { precision: 18, scale: 4 }).default('0'),
  invoicedAmount: decimal('invoiced_amount', { precision: 18, scale: 4 }).default('0'),
  remainingAmount: decimal('remaining_amount', { precision: 18, scale: 4 }).default('0'),

  // Payment terms
  paymentTerms: text('payment_terms'),

  // Approval workflow
  requiresApproval: boolean('requires_approval').default(false),
  approvalThreshold: decimal('approval_threshold', { precision: 18, scale: 4 }),
  currentApproverId: text('current_approver_id'),
  approvalLevel: integer('approval_level').default(0),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: text('approved_by'),

  // Lifecycle
  closedAt: timestamp('closed_at', { withTimezone: true }),
  closedBy: text('closed_by'),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancelledBy: text('cancelled_by'),
  cancellationReason: text('cancellation_reason'),
}, (table) => ({
  deliveryIdx: index('sales_order_ext_delivery_idx').on(table.requestedDeliveryDate),
}));

// ============================================================================
// SALES ORDER LINE EXTENSION
// ============================================================================

export const salesOrderLineExt = pgTable('sales_order_line_ext', {
  lineId: uuid('line_id').primaryKey().references(() => transactionLines.id, { onDelete: 'cascade' }),

  // SKU
  sku: text('sku'),

  // Fulfillment tracking
  fulfilledQuantity: decimal('fulfilled_quantity', { precision: 18, scale: 4 }).default('0'),
  invoicedQuantity: decimal('invoiced_quantity', { precision: 18, scale: 4 }).default('0'),
  cancelledQuantity: decimal('cancelled_quantity', { precision: 18, scale: 4 }).default('0'),
  remainingQuantity: decimal('remaining_quantity', { precision: 18, scale: 4 }).default('0'),

  // Discounts
  discountAmount: decimal('discount_amount', { precision: 18, scale: 4 }).default('0'),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }).default('0'),

  // Tax
  taxCode: text('tax_code'),
  lineTotal: decimal('line_total', { precision: 18, scale: 4 }),

  // Delivery dates
  requestedDeliveryDate: date('requested_delivery_date'),
  promisedDeliveryDate: date('promised_delivery_date'),

  // Revenue recognition
  revenueAccountId: uuid('revenue_account_id').references(() => accounts.id),
  deferredRevenueAccountId: uuid('deferred_revenue_account_id').references(() => accounts.id),
});

// ============================================================================
// SALES ORDER APPROVAL HISTORY
// ============================================================================

export const salesOrderApprovalHistory2 = pgTable('sales_order_approval_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: text('organization_id').notNull(),
  salesOrderId: uuid('sales_order_id').notNull().references(() => transactionHeaders.id),

  // Approval action
  action: text('action').notNull(),  // SUBMITTED, APPROVED, REJECTED, RECALLED
  fromStatus: text('from_status'),
  toStatus: text('to_status'),

  // Actor
  performedBy: text('performed_by').notNull(),
  performedAt: timestamp('performed_at', { withTimezone: true }).defaultNow().notNull(),

  // Comments
  comments: text('comments'),

  // Approval level
  approvalLevel: integer('approval_level'),
  nextApproverId: text('next_approver_id'),
}, (table) => ({
  soIdx: index('sales_order_approval_history_so_idx').on(table.salesOrderId),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const salesOrderExtRelations = relations(salesOrderExt, ({ one }) => ({
  transaction: one(transactionHeaders, {
    fields: [salesOrderExt.transactionId],
    references: [transactionHeaders.id],
  }),
}));

export const salesOrderLineExtRelations = relations(salesOrderLineExt, ({ one }) => ({
  line: one(transactionLines, {
    fields: [salesOrderLineExt.lineId],
    references: [transactionLines.id],
  }),
  revenueAccount: one(accounts, {
    fields: [salesOrderLineExt.revenueAccountId],
    references: [accounts.id],
    relationName: 'revenueAccount',
  }),
  deferredRevenueAccount: one(accounts, {
    fields: [salesOrderLineExt.deferredRevenueAccountId],
    references: [accounts.id],
    relationName: 'deferredRevenueAccount',
  }),
}));

export const salesOrderApprovalHistory2Relations = relations(salesOrderApprovalHistory2, ({ one }) => ({
  salesOrder: one(transactionHeaders, {
    fields: [salesOrderApprovalHistory2.salesOrderId],
    references: [transactionHeaders.id],
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type SalesOrderExtRecord = InferSelectModel<typeof salesOrderExt>;
export type NewSalesOrderExtRecord = InferInsertModel<typeof salesOrderExt>;
export type UpdateSalesOrderExtRecord = Partial<Omit<NewSalesOrderExtRecord, 'transactionId'>>;

export type SalesOrderLineExtRecord = InferSelectModel<typeof salesOrderLineExt>;
export type NewSalesOrderLineExtRecord = InferInsertModel<typeof salesOrderLineExt>;
export type UpdateSalesOrderLineExtRecord = Partial<Omit<NewSalesOrderLineExtRecord, 'lineId'>>;

export type SalesOrderApprovalHistoryRecord2 = InferSelectModel<typeof salesOrderApprovalHistory2>;
export type NewSalesOrderApprovalHistoryRecord2 = InferInsertModel<typeof salesOrderApprovalHistory2>;
