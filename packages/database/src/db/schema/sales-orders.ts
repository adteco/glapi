import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  decimal,
  pgEnum,
  date,
  jsonb,
  text,
  boolean,
  integer,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { entities } from './entities';
import { subsidiaries } from './subsidiaries';
import { items } from './items';
import { invoices } from './invoices';

// ============================================================================
// Enums
// ============================================================================

/**
 * Sales Order Status - State machine states
 * DRAFT -> SUBMITTED -> APPROVED -> PARTIALLY_FULFILLED -> FULFILLED -> CLOSED
 *                   -> REJECTED -> CANCELLED
 */
export const salesOrderStatusEnum = pgEnum('sales_order_status', [
  'DRAFT',           // Initial state, editable
  'SUBMITTED',       // Awaiting approval
  'APPROVED',        // Ready for fulfillment/invoicing
  'REJECTED',        // Approval rejected, can be revised
  'PARTIALLY_FULFILLED', // Some items fulfilled/invoiced
  'FULFILLED',       // All items fulfilled/invoiced
  'CLOSED',          // Final state, no more changes
  'CANCELLED',       // Order cancelled
  'ON_HOLD',         // Temporarily paused
]);

export const SalesOrderStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PARTIALLY_FULFILLED: 'PARTIALLY_FULFILLED',
  FULFILLED: 'FULFILLED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
  ON_HOLD: 'ON_HOLD',
} as const;

export type SalesOrderStatusValue = (typeof SalesOrderStatus)[keyof typeof SalesOrderStatus];

/**
 * Valid status transitions for the state machine
 */
export const VALID_SALES_ORDER_TRANSITIONS: Record<SalesOrderStatusValue, SalesOrderStatusValue[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['PARTIALLY_FULFILLED', 'FULFILLED', 'ON_HOLD', 'CANCELLED'],
  REJECTED: ['DRAFT', 'CANCELLED'],
  PARTIALLY_FULFILLED: ['FULFILLED', 'ON_HOLD', 'CANCELLED'],
  FULFILLED: ['CLOSED'],
  CLOSED: [], // Terminal state
  CANCELLED: [], // Terminal state
  ON_HOLD: ['APPROVED', 'PARTIALLY_FULFILLED', 'CANCELLED'],
};

/**
 * Approval Action Types
 */
export const approvalActionTypeEnum = pgEnum('approval_action_type', [
  'SUBMIT',
  'APPROVE',
  'REJECT',
  'RETURN_FOR_REVISION',
  'ESCALATE',
  'DELEGATE',
]);

export const ApprovalActionType = {
  SUBMIT: 'SUBMIT',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  RETURN_FOR_REVISION: 'RETURN_FOR_REVISION',
  ESCALATE: 'ESCALATE',
  DELEGATE: 'DELEGATE',
} as const;

export type ApprovalActionTypeValue = (typeof ApprovalActionType)[keyof typeof ApprovalActionType];

// ============================================================================
// Tables
// ============================================================================

/**
 * Sales Orders - Header table
 */
export const salesOrders = pgTable('sales_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id)
    .notNull(),
  subsidiaryId: uuid('subsidiary_id')
    .references(() => subsidiaries.id)
    .notNull(),

  // Order identification
  orderNumber: varchar('order_number', { length: 50 }).notNull(),
  externalReference: varchar('external_reference', { length: 100 }),

  // Customer information
  entityId: uuid('entity_id')
    .references(() => entities.id)
    .notNull(),
  billingAddressId: uuid('billing_address_id'),
  shippingAddressId: uuid('shipping_address_id'),

  // Dates
  orderDate: date('order_date').notNull(),
  requestedDeliveryDate: date('requested_delivery_date'),
  promisedDeliveryDate: date('promised_delivery_date'),
  expirationDate: date('expiration_date'),

  // Status and workflow
  status: salesOrderStatusEnum('status').notNull().default('DRAFT'),
  previousStatus: salesOrderStatusEnum('previous_status'),

  // Financial
  currencyCode: varchar('currency_code', { length: 3 }).notNull().default('USD'),
  exchangeRate: decimal('exchange_rate', { precision: 18, scale: 8 }).default('1'),
  subtotal: decimal('subtotal', { precision: 18, scale: 4 }).notNull().default('0'),
  discountAmount: decimal('discount_amount', { precision: 18, scale: 4 }).default('0'),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }).default('0'),
  taxAmount: decimal('tax_amount', { precision: 18, scale: 4 }).default('0'),
  shippingAmount: decimal('shipping_amount', { precision: 18, scale: 4 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 18, scale: 4 }).notNull().default('0'),

  // Fulfillment tracking
  fulfilledAmount: decimal('fulfilled_amount', { precision: 18, scale: 4 }).default('0'),
  invoicedAmount: decimal('invoiced_amount', { precision: 18, scale: 4 }).default('0'),
  remainingAmount: decimal('remaining_amount', { precision: 18, scale: 4 }).default('0'),

  // Terms
  paymentTerms: varchar('payment_terms', { length: 50 }),
  shippingMethod: varchar('shipping_method', { length: 100 }),

  // Notes and metadata
  memo: text('memo'),
  internalNotes: text('internal_notes'),
  metadata: jsonb('metadata'),

  // Approval tracking
  requiresApproval: boolean('requires_approval').default(false),
  approvalThreshold: decimal('approval_threshold', { precision: 18, scale: 4 }),
  currentApproverId: uuid('current_approver_id'),
  approvalLevel: integer('approval_level').default(0),

  // Audit
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: uuid('approved_by'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  closedBy: uuid('closed_by'),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancelledBy: uuid('cancelled_by'),
  cancellationReason: text('cancellation_reason'),
});

/**
 * Sales Order Line Items
 */
export const salesOrderLines = pgTable('sales_order_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  salesOrderId: uuid('sales_order_id')
    .references(() => salesOrders.id, { onDelete: 'cascade' })
    .notNull(),

  // Line identification
  lineNumber: integer('line_number').notNull(),

  // Item information
  itemId: uuid('item_id').references(() => items.id),
  description: text('description').notNull(),
  sku: varchar('sku', { length: 100 }),

  // Quantities
  quantity: decimal('quantity', { precision: 18, scale: 4 }).notNull(),
  unitOfMeasure: varchar('unit_of_measure', { length: 20 }),
  fulfilledQuantity: decimal('fulfilled_quantity', { precision: 18, scale: 4 }).default('0'),
  invoicedQuantity: decimal('invoiced_quantity', { precision: 18, scale: 4 }).default('0'),
  cancelledQuantity: decimal('cancelled_quantity', { precision: 18, scale: 4 }).default('0'),
  remainingQuantity: decimal('remaining_quantity', { precision: 18, scale: 4 }).default('0'),

  // Pricing
  unitPrice: decimal('unit_price', { precision: 18, scale: 4 }).notNull(),
  discountAmount: decimal('discount_amount', { precision: 18, scale: 4 }).default('0'),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }).default('0'),
  taxAmount: decimal('tax_amount', { precision: 18, scale: 4 }).default('0'),
  taxCode: varchar('tax_code', { length: 50 }),
  lineTotal: decimal('line_total', { precision: 18, scale: 4 }).notNull(),

  // Delivery
  requestedDeliveryDate: date('requested_delivery_date'),
  promisedDeliveryDate: date('promised_delivery_date'),

  // Dimensions (for GL posting)
  departmentId: uuid('department_id'),
  locationId: uuid('location_id'),
  classId: uuid('class_id'),
  projectId: uuid('project_id'),

  // Revenue recognition
  revenueAccountId: uuid('revenue_account_id'),
  deferredRevenueAccountId: uuid('deferred_revenue_account_id'),

  // Notes
  memo: text('memo'),
  metadata: jsonb('metadata'),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Sales Order Approval History - Tracks all approval actions
 */
export const salesOrderApprovalHistory = pgTable('sales_order_approval_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  salesOrderId: uuid('sales_order_id')
    .references(() => salesOrders.id, { onDelete: 'cascade' })
    .notNull(),

  // Action details
  action: approvalActionTypeEnum('action').notNull(),
  fromStatus: salesOrderStatusEnum('from_status').notNull(),
  toStatus: salesOrderStatusEnum('to_status').notNull(),

  // Actor
  actorId: uuid('actor_id').notNull(),
  delegatedFrom: uuid('delegated_from'),

  // Approval level
  approvalLevel: integer('approval_level').default(0),

  // Comments and reason
  comments: text('comments'),
  reason: text('reason'),

  // Metadata
  metadata: jsonb('metadata'),

  // Timestamp
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Sales Order to Invoice Link - Tracks which invoices were created from which orders
 */
export const salesOrderInvoices = pgTable('sales_order_invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  salesOrderId: uuid('sales_order_id')
    .references(() => salesOrders.id, { onDelete: 'cascade' })
    .notNull(),
  invoiceId: uuid('invoice_id')
    .references(() => invoices.id, { onDelete: 'cascade' })
    .notNull(),

  // Tracking
  invoicedAmount: decimal('invoiced_amount', { precision: 18, scale: 4 }).notNull(),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by').notNull(),
});

// ============================================================================
// Relations
// ============================================================================

export const salesOrdersRelations = relations(salesOrders, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [salesOrders.organizationId],
    references: [organizations.id],
  }),
  subsidiary: one(subsidiaries, {
    fields: [salesOrders.subsidiaryId],
    references: [subsidiaries.id],
  }),
  entity: one(entities, {
    fields: [salesOrders.entityId],
    references: [entities.id],
  }),
  lines: many(salesOrderLines),
  approvalHistory: many(salesOrderApprovalHistory),
  invoiceLinks: many(salesOrderInvoices),
}));

export const salesOrderLinesRelations = relations(salesOrderLines, ({ one }) => ({
  salesOrder: one(salesOrders, {
    fields: [salesOrderLines.salesOrderId],
    references: [salesOrders.id],
  }),
  item: one(items, {
    fields: [salesOrderLines.itemId],
    references: [items.id],
  }),
}));

export const salesOrderApprovalHistoryRelations = relations(
  salesOrderApprovalHistory,
  ({ one }) => ({
    salesOrder: one(salesOrders, {
      fields: [salesOrderApprovalHistory.salesOrderId],
      references: [salesOrders.id],
    }),
  })
);

export const salesOrderInvoicesRelations = relations(salesOrderInvoices, ({ one }) => ({
  salesOrder: one(salesOrders, {
    fields: [salesOrderInvoices.salesOrderId],
    references: [salesOrders.id],
  }),
  invoice: one(invoices, {
    fields: [salesOrderInvoices.invoiceId],
    references: [invoices.id],
  }),
}));

// ============================================================================
// Types
// ============================================================================

export type SalesOrder = typeof salesOrders.$inferSelect;
export type NewSalesOrder = typeof salesOrders.$inferInsert;
export type UpdateSalesOrder = Partial<NewSalesOrder>;

export type SalesOrderLine = typeof salesOrderLines.$inferSelect;
export type NewSalesOrderLine = typeof salesOrderLines.$inferInsert;
export type UpdateSalesOrderLine = Partial<NewSalesOrderLine>;

export type SalesOrderApprovalHistoryRecord = typeof salesOrderApprovalHistory.$inferSelect;
export type NewSalesOrderApprovalHistoryRecord = typeof salesOrderApprovalHistory.$inferInsert;

export type SalesOrderInvoiceLink = typeof salesOrderInvoices.$inferSelect;
export type NewSalesOrderInvoiceLink = typeof salesOrderInvoices.$inferInsert;
