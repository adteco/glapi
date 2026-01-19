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
import { transactionHeaders, transactionLines, threeWayMatchStatusEnum2, lineMatchStatusEnum } from './transaction-core';
import { accounts } from './accounts';

// ============================================================================
// VENDOR BILL EXTENSION
// ============================================================================

export const vendorBillExt = pgTable('vendor_bill_ext', {
  transactionId: uuid('transaction_id').primaryKey().references(() => transactionHeaders.id, { onDelete: 'cascade' }),

  // Vendor reference
  vendorInvoiceNumber: text('vendor_invoice_number'),

  // Link to PO
  purchaseOrderId: uuid('purchase_order_id').references(() => transactionHeaders.id),

  // Payment terms
  dueDate: date('due_date').notNull(),
  receivedDate: date('received_date'),
  shippingAmount: decimal('shipping_amount', { precision: 18, scale: 4 }).default('0'),

  // 3-way match
  threeWayMatchStatus: threeWayMatchStatusEnum2('three_way_match_status').default('NOT_REQUIRED'),
  matchVarianceAmount: decimal('match_variance_amount', { precision: 18, scale: 4 }),
  matchOverrideReason: text('match_override_reason'),
  matchOverrideBy: text('match_override_by'),
  matchOverrideAt: timestamp('match_override_at', { withTimezone: true }),

  // Payment tracking
  paidAmount: decimal('paid_amount', { precision: 18, scale: 4 }).default('0'),
  balanceDue: decimal('balance_due', { precision: 18, scale: 4 }).default('0'),

  // Discounts
  discountDate: date('discount_date'),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }),
  discountAmount: decimal('discount_amount', { precision: 18, scale: 4 }),
  discountTaken: decimal('discount_taken', { precision: 18, scale: 4 }).default('0'),

  // AP account
  apAccountId: uuid('ap_account_id').references(() => accounts.id),

  // Approval workflow
  currentApproverId: text('current_approver_id'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: text('approved_by'),

  // Voiding
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  voidedBy: text('voided_by'),
  voidReason: text('void_reason'),
}, (table) => ({
  poIdx: index('vendor_bill_ext_po_idx').on(table.purchaseOrderId),
  dueDateIdx: index('vendor_bill_ext_due_date_idx').on(table.dueDate),
  matchStatusIdx: index('vendor_bill_ext_match_status_idx').on(table.threeWayMatchStatus),
}));

// ============================================================================
// VENDOR BILL LINE EXTENSION
// ============================================================================

export const vendorBillLineExt = pgTable('vendor_bill_line_ext', {
  lineId: uuid('line_id').primaryKey().references(() => transactionLines.id, { onDelete: 'cascade' }),

  // 3-way match references
  purchaseOrderLineId: uuid('purchase_order_line_id').references(() => transactionLines.id),
  receiptLineId: uuid('receipt_line_id').references(() => transactionLines.id),

  // Original PO values for variance calculation
  poQuantity: decimal('po_quantity', { precision: 18, scale: 4 }),
  poUnitPrice: decimal('po_unit_price', { precision: 18, scale: 4 }),
  receivedQuantity: decimal('received_quantity', { precision: 18, scale: 4 }),

  // Variances
  quantityVariance: decimal('quantity_variance', { precision: 18, scale: 4 }),
  priceVariance: decimal('price_variance', { precision: 18, scale: 4 }),

  // Line match status
  matchStatus: lineMatchStatusEnum('match_status').default('NOT_REQUIRED'),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const vendorBillExtRelations = relations(vendorBillExt, ({ one }) => ({
  transaction: one(transactionHeaders, {
    fields: [vendorBillExt.transactionId],
    references: [transactionHeaders.id],
    relationName: 'vendorBill',
  }),
  purchaseOrder: one(transactionHeaders, {
    fields: [vendorBillExt.purchaseOrderId],
    references: [transactionHeaders.id],
    relationName: 'billPO',
  }),
  apAccount: one(accounts, {
    fields: [vendorBillExt.apAccountId],
    references: [accounts.id],
  }),
}));

export const vendorBillLineExtRelations = relations(vendorBillLineExt, ({ one }) => ({
  line: one(transactionLines, {
    fields: [vendorBillLineExt.lineId],
    references: [transactionLines.id],
    relationName: 'billLine',
  }),
  purchaseOrderLine: one(transactionLines, {
    fields: [vendorBillLineExt.purchaseOrderLineId],
    references: [transactionLines.id],
    relationName: 'billPOLine',
  }),
  receiptLine: one(transactionLines, {
    fields: [vendorBillLineExt.receiptLineId],
    references: [transactionLines.id],
    relationName: 'billReceiptLine',
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type VendorBillExtRecord = InferSelectModel<typeof vendorBillExt>;
export type NewVendorBillExtRecord = InferInsertModel<typeof vendorBillExt>;
export type UpdateVendorBillExtRecord = Partial<Omit<NewVendorBillExtRecord, 'transactionId'>>;

export type VendorBillLineExtRecord = InferSelectModel<typeof vendorBillLineExt>;
export type NewVendorBillLineExtRecord = InferInsertModel<typeof vendorBillLineExt>;
export type UpdateVendorBillLineExtRecord = Partial<Omit<NewVendorBillLineExtRecord, 'lineId'>>;
