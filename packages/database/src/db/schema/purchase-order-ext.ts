import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  decimal,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { relations, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { transactionHeaders, transactionLines } from './transaction-core';
import { locations } from './locations';

// ============================================================================
// PURCHASE ORDER EXTENSION
// ============================================================================

export const purchaseOrderExt = pgTable('purchase_order_ext', {
  transactionId: uuid('transaction_id').primaryKey().references(() => transactionHeaders.id, { onDelete: 'cascade' }),

  // Delivery
  expectedDeliveryDate: date('expected_delivery_date'),
  shipToLocationId: uuid('ship_to_location_id').references(() => locations.id),
  shippingAddress: text('shipping_address'),
  shippingMethod: text('shipping_method'),
  shippingAmount: decimal('shipping_amount', { precision: 18, scale: 4 }).default('0'),

  // Terms
  paymentTerms: text('payment_terms'),

  // Fulfillment tracking
  receivedAmount: decimal('received_amount', { precision: 18, scale: 4 }).default('0'),
  billedAmount: decimal('billed_amount', { precision: 18, scale: 4 }).default('0'),

  // Approval workflow
  currentApproverId: text('current_approver_id'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: text('approved_by'),

  // Lifecycle
  closedAt: timestamp('closed_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancellationReason: text('cancellation_reason'),
}, (table) => ({
  deliveryIdx: index('purchase_order_ext_delivery_idx').on(table.expectedDeliveryDate),
}));

// ============================================================================
// PURCHASE ORDER LINE EXTENSION
// ============================================================================

export const purchaseOrderLineExt = pgTable('purchase_order_line_ext', {
  lineId: uuid('line_id').primaryKey().references(() => transactionLines.id, { onDelete: 'cascade' }),

  // Line-level delivery date
  expectedDeliveryDate: date('expected_delivery_date'),

  // Fulfillment tracking
  quantityReceived: decimal('quantity_received', { precision: 18, scale: 4 }).default('0'),
  quantityBilled: decimal('quantity_billed', { precision: 18, scale: 4 }).default('0'),

  // Status
  isClosed: boolean('is_closed').default(false),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const purchaseOrderExtRelations = relations(purchaseOrderExt, ({ one }) => ({
  transaction: one(transactionHeaders, {
    fields: [purchaseOrderExt.transactionId],
    references: [transactionHeaders.id],
  }),
  shipToLocation: one(locations, {
    fields: [purchaseOrderExt.shipToLocationId],
    references: [locations.id],
  }),
}));

export const purchaseOrderLineExtRelations = relations(purchaseOrderLineExt, ({ one }) => ({
  line: one(transactionLines, {
    fields: [purchaseOrderLineExt.lineId],
    references: [transactionLines.id],
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type PurchaseOrderExtRecord = InferSelectModel<typeof purchaseOrderExt>;
export type NewPurchaseOrderExtRecord = InferInsertModel<typeof purchaseOrderExt>;
export type UpdatePurchaseOrderExtRecord = Partial<Omit<NewPurchaseOrderExtRecord, 'transactionId'>>;

export type PurchaseOrderLineExtRecord = InferSelectModel<typeof purchaseOrderLineExt>;
export type NewPurchaseOrderLineExtRecord = InferInsertModel<typeof purchaseOrderLineExt>;
export type UpdatePurchaseOrderLineExtRecord = Partial<Omit<NewPurchaseOrderLineExtRecord, 'lineId'>>;
