import {
  pgTable,
  uuid,
  text,
  timestamp,
  decimal,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { transactionHeaders, transactionLines } from './transaction-core';
import { locations } from './locations';

// ============================================================================
// PO RECEIPT EXTENSION
// ============================================================================

export const poReceiptExt = pgTable('po_receipt_ext', {
  transactionId: uuid('transaction_id').primaryKey().references(() => transactionHeaders.id, { onDelete: 'cascade' }),

  // Link to Purchase Order
  purchaseOrderId: uuid('purchase_order_id').references(() => transactionHeaders.id),

  // Receipt details
  receiptLocationId: uuid('receipt_location_id').references(() => locations.id),
  shippingRef: text('shipping_ref'),
  carrierName: text('carrier_name'),

  // Posting
  postedAt: timestamp('posted_at', { withTimezone: true }),
  postedBy: text('posted_by'),

  // Cancellation
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
}, (table) => ({
  poIdx: index('po_receipt_ext_po_idx').on(table.purchaseOrderId),
}));

// ============================================================================
// PO RECEIPT LINE EXTENSION
// ============================================================================

export const poReceiptLineExt = pgTable('po_receipt_line_ext', {
  lineId: uuid('line_id').primaryKey().references(() => transactionLines.id, { onDelete: 'cascade' }),

  // Link to PO line
  purchaseOrderLineId: uuid('purchase_order_line_id').references(() => transactionLines.id),

  // Quality inspection
  quantityAccepted: decimal('quantity_accepted', { precision: 18, scale: 4 }),
  quantityRejected: decimal('quantity_rejected', { precision: 18, scale: 4 }),
  rejectionReason: text('rejection_reason'),

  // Warehouse tracking
  binLocation: text('bin_location'),
  lotNumber: text('lot_number'),
  serialNumbers: jsonb('serial_numbers'),  // Array of serial numbers
});

// ============================================================================
// RELATIONS
// ============================================================================

export const poReceiptExtRelations = relations(poReceiptExt, ({ one }) => ({
  transaction: one(transactionHeaders, {
    fields: [poReceiptExt.transactionId],
    references: [transactionHeaders.id],
    relationName: 'receipt',
  }),
  purchaseOrder: one(transactionHeaders, {
    fields: [poReceiptExt.purchaseOrderId],
    references: [transactionHeaders.id],
    relationName: 'purchaseOrder',
  }),
  receiptLocation: one(locations, {
    fields: [poReceiptExt.receiptLocationId],
    references: [locations.id],
  }),
}));

export const poReceiptLineExtRelations = relations(poReceiptLineExt, ({ one }) => ({
  line: one(transactionLines, {
    fields: [poReceiptLineExt.lineId],
    references: [transactionLines.id],
    relationName: 'receiptLine',
  }),
  purchaseOrderLine: one(transactionLines, {
    fields: [poReceiptLineExt.purchaseOrderLineId],
    references: [transactionLines.id],
    relationName: 'poLine',
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type POReceiptExtRecord = InferSelectModel<typeof poReceiptExt>;
export type NewPOReceiptExtRecord = InferInsertModel<typeof poReceiptExt>;
export type UpdatePOReceiptExtRecord = Partial<Omit<NewPOReceiptExtRecord, 'transactionId'>>;

export type POReceiptLineExtRecord = InferSelectModel<typeof poReceiptLineExt>;
export type NewPOReceiptLineExtRecord = InferInsertModel<typeof poReceiptLineExt>;
export type UpdatePOReceiptLineExtRecord = Partial<Omit<NewPOReceiptLineExtRecord, 'lineId'>>;
