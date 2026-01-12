/**
 * Purchase Orders Schema (Procure-to-Pay)
 *
 * This schema supports the PO workflow:
 * - Purchase Order creation and approval
 * - Goods/services receipt tracking
 * - 3-way match: PO ↔ Receipt ↔ Vendor Bill
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  decimal,
  integer,
  date,
  boolean,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { subsidiaries } from './subsidiaries';
import { entities } from './entities';
import { items } from './items';
import { accounts } from './accounts';
import { departments } from './departments';
import { locations } from './locations';
import { classes } from './classes';
import { projects } from './projects';

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Purchase Order Status Flow:
 * DRAFT → SUBMITTED → APPROVED → PARTIALLY_RECEIVED → RECEIVED → BILLED → CLOSED
 *                  ↓
 *              REJECTED
 *
 * Any status except CLOSED/CANCELLED can be CANCELLED
 */
export const purchaseOrderStatusEnum = pgEnum('purchase_order_status', [
  'DRAFT',              // Initial state, editable
  'SUBMITTED',          // Sent for approval
  'APPROVED',           // Approved, ready for receipt
  'REJECTED',           // Rejected in approval
  'PARTIALLY_RECEIVED', // Some items received
  'RECEIVED',           // All items received
  'BILLED',             // Vendor bill created
  'CLOSED',             // Completed and closed
  'CANCELLED',          // Cancelled
]);

export const PurchaseOrderStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  RECEIVED: 'RECEIVED',
  BILLED: 'BILLED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
} as const;

export type PurchaseOrderStatusValue = typeof PurchaseOrderStatus[keyof typeof PurchaseOrderStatus];

/**
 * Valid state transitions for purchase orders
 */
export const VALID_PURCHASE_ORDER_TRANSITIONS: Record<PurchaseOrderStatusValue, PurchaseOrderStatusValue[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
  REJECTED: ['DRAFT', 'CANCELLED'],
  PARTIALLY_RECEIVED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['BILLED', 'CLOSED'],
  BILLED: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
};

/**
 * Receipt Status
 */
export const receiptStatusEnum = pgEnum('receipt_status', [
  'DRAFT',
  'POSTED',
  'CANCELLED',
]);

export const ReceiptStatus = {
  DRAFT: 'DRAFT',
  POSTED: 'POSTED',
  CANCELLED: 'CANCELLED',
} as const;

export type ReceiptStatusValue = typeof ReceiptStatus[keyof typeof ReceiptStatus];

/**
 * PO Approval Action Types
 */
export const poApprovalActionTypeEnum = pgEnum('po_approval_action_type', [
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'RETURNED',
  'ESCALATED',
  'CANCELLED',
]);

export const POApprovalActionType = {
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  RETURNED: 'RETURNED',
  ESCALATED: 'ESCALATED',
  CANCELLED: 'CANCELLED',
} as const;

export type POApprovalActionTypeValue = typeof POApprovalActionType[keyof typeof POApprovalActionType];

// ============================================================================
// TABLES
// ============================================================================

/**
 * Purchase Orders - Header table
 */
export const purchaseOrders = pgTable('purchase_orders', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Organization context
  organizationId: uuid('organization_id').notNull(),
  subsidiaryId: uuid('subsidiary_id').notNull().references(() => subsidiaries.id),

  // PO identification
  poNumber: varchar('po_number', { length: 50 }).notNull(),

  // Vendor reference
  vendorId: uuid('vendor_id').notNull().references(() => entities.id),
  vendorName: varchar('vendor_name', { length: 255 }),

  // Dates
  orderDate: date('order_date').notNull(),
  expectedDeliveryDate: date('expected_delivery_date'),

  // Status
  status: purchaseOrderStatusEnum('status').notNull().default('DRAFT'),

  // Amounts (calculated from lines)
  subtotal: decimal('subtotal', { precision: 15, scale: 2 }).notNull().default('0'),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  shippingAmount: decimal('shipping_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).notNull().default('0'),

  // Receipt tracking
  receivedAmount: decimal('received_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  billedAmount: decimal('billed_amount', { precision: 15, scale: 2 }).notNull().default('0'),

  // Shipping info
  shipToLocationId: uuid('ship_to_location_id').references(() => locations.id),
  shippingAddress: text('shipping_address'),
  shippingMethod: varchar('shipping_method', { length: 100 }),

  // Terms
  paymentTerms: varchar('payment_terms', { length: 100 }),

  // Notes
  memo: text('memo'),
  internalNotes: text('internal_notes'),

  // Approval tracking
  currentApproverId: uuid('current_approver_id'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: uuid('approved_by'),

  // Currency
  currencyCode: varchar('currency_code', { length: 3 }).default('USD'),
  exchangeRate: decimal('exchange_rate', { precision: 15, scale: 6 }).default('1'),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancellationReason: text('cancellation_reason'),
}, (table) => ({
  orgIdx: index('po_organization_idx').on(table.organizationId),
  subsidiaryIdx: index('po_subsidiary_idx').on(table.subsidiaryId),
  vendorIdx: index('po_vendor_idx').on(table.vendorId),
  statusIdx: index('po_status_idx').on(table.status),
  orderDateIdx: index('po_order_date_idx').on(table.orderDate),
  poNumberIdx: index('po_po_number_idx').on(table.poNumber),
}));

/**
 * Purchase Order Lines
 */
export const purchaseOrderLines = pgTable('purchase_order_lines', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Parent reference
  purchaseOrderId: uuid('purchase_order_id').notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),

  // Line identification
  lineNumber: integer('line_number').notNull(),

  // Item reference (optional - could be non-inventory item)
  itemId: uuid('item_id').references(() => items.id),
  itemName: varchar('item_name', { length: 255 }).notNull(),
  itemDescription: text('item_description'),

  // Quantities
  quantity: decimal('quantity', { precision: 15, scale: 4 }).notNull(),
  unitOfMeasure: varchar('unit_of_measure', { length: 50 }),
  unitPrice: decimal('unit_price', { precision: 15, scale: 4 }).notNull(),

  // Amounts
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).notNull().default('0'),

  // Receipt tracking
  quantityReceived: decimal('quantity_received', { precision: 15, scale: 4 }).notNull().default('0'),
  quantityBilled: decimal('quantity_billed', { precision: 15, scale: 4 }).notNull().default('0'),

  // Accounting dimensions
  accountId: uuid('account_id').references(() => accounts.id),
  departmentId: uuid('department_id').references(() => departments.id),
  locationId: uuid('location_id').references(() => locations.id),
  classId: uuid('class_id').references(() => classes.id),
  projectId: uuid('project_id').references(() => projects.id),

  // Delivery
  expectedDeliveryDate: date('expected_delivery_date'),

  // Notes
  memo: text('memo'),

  // Status flags
  isClosed: boolean('is_closed').notNull().default(false),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  poIdx: index('po_line_po_idx').on(table.purchaseOrderId),
  itemIdx: index('po_line_item_idx').on(table.itemId),
  lineNumberIdx: index('po_line_number_idx').on(table.purchaseOrderId, table.lineNumber),
}));

/**
 * Purchase Order Receipts - Tracks goods/services received
 */
export const purchaseOrderReceipts = pgTable('purchase_order_receipts', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Organization context
  organizationId: uuid('organization_id').notNull(),
  subsidiaryId: uuid('subsidiary_id').notNull().references(() => subsidiaries.id),

  // Receipt identification
  receiptNumber: varchar('receipt_number', { length: 50 }).notNull(),

  // Reference to PO
  purchaseOrderId: uuid('purchase_order_id').notNull().references(() => purchaseOrders.id),

  // Vendor reference
  vendorId: uuid('vendor_id').notNull().references(() => entities.id),

  // Receipt details
  receiptDate: date('receipt_date').notNull(),
  status: receiptStatusEnum('status').notNull().default('DRAFT'),

  // Location received to
  locationId: uuid('location_id').references(() => locations.id),

  // Notes
  memo: text('memo'),

  // Shipping reference (e.g., tracking number, packing slip)
  shippingRef: varchar('shipping_ref', { length: 100 }),
  carrierName: varchar('carrier_name', { length: 100 }),

  // Total received value (calculated)
  totalReceivedValue: decimal('total_received_value', { precision: 15, scale: 2 }).notNull().default('0'),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  postedAt: timestamp('posted_at', { withTimezone: true }),
  postedBy: uuid('posted_by'),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
}, (table) => ({
  orgIdx: index('receipt_organization_idx').on(table.organizationId),
  poIdx: index('receipt_po_idx').on(table.purchaseOrderId),
  vendorIdx: index('receipt_vendor_idx').on(table.vendorId),
  receiptDateIdx: index('receipt_date_idx').on(table.receiptDate),
  statusIdx: index('receipt_status_idx').on(table.status),
}));

/**
 * Purchase Order Receipt Lines
 */
export const purchaseOrderReceiptLines = pgTable('purchase_order_receipt_lines', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Parent reference
  receiptId: uuid('receipt_id').notNull().references(() => purchaseOrderReceipts.id, { onDelete: 'cascade' }),

  // PO Line reference (for 3-way match)
  purchaseOrderLineId: uuid('purchase_order_line_id').notNull().references(() => purchaseOrderLines.id),

  // Line number
  lineNumber: integer('line_number').notNull(),

  // Item reference
  itemId: uuid('item_id').references(() => items.id),
  itemName: varchar('item_name', { length: 255 }).notNull(),

  // Quantities
  quantityReceived: decimal('quantity_received', { precision: 15, scale: 4 }).notNull(),
  unitOfMeasure: varchar('unit_of_measure', { length: 50 }),
  unitCost: decimal('unit_cost', { precision: 15, scale: 4 }).notNull(),

  // Amount
  receivedValue: decimal('received_value', { precision: 15, scale: 2 }).notNull(),

  // Quality/Inspection
  quantityAccepted: decimal('quantity_accepted', { precision: 15, scale: 4 }),
  quantityRejected: decimal('quantity_rejected', { precision: 15, scale: 4 }),
  rejectionReason: text('rejection_reason'),

  // Storage location
  binLocation: varchar('bin_location', { length: 100 }),
  lotNumber: varchar('lot_number', { length: 100 }),
  serialNumbers: text('serial_numbers'), // JSON array of serial numbers

  // Notes
  memo: text('memo'),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  receiptIdx: index('receipt_line_receipt_idx').on(table.receiptId),
  poLineIdx: index('receipt_line_po_line_idx').on(table.purchaseOrderLineId),
  itemIdx: index('receipt_line_item_idx').on(table.itemId),
}));

/**
 * Purchase Order Approval History
 */
export const purchaseOrderApprovalHistory = pgTable('purchase_order_approval_history', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Parent reference
  purchaseOrderId: uuid('purchase_order_id').notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),

  // Action details
  action: poApprovalActionTypeEnum('action').notNull(),

  // Actor
  performedBy: uuid('performed_by').notNull(),
  performedByName: varchar('performed_by_name', { length: 255 }),

  // Status transition
  fromStatus: purchaseOrderStatusEnum('from_status'),
  toStatus: purchaseOrderStatusEnum('to_status').notNull(),

  // Comments
  comments: text('comments'),

  // Timestamp
  performedAt: timestamp('performed_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  poIdx: index('po_approval_po_idx').on(table.purchaseOrderId),
  performedByIdx: index('po_approval_performed_by_idx').on(table.performedBy),
  actionIdx: index('po_approval_action_idx').on(table.action),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  subsidiary: one(subsidiaries, {
    fields: [purchaseOrders.subsidiaryId],
    references: [subsidiaries.id],
  }),
  vendor: one(entities, {
    fields: [purchaseOrders.vendorId],
    references: [entities.id],
  }),
  shipToLocation: one(locations, {
    fields: [purchaseOrders.shipToLocationId],
    references: [locations.id],
  }),
  lines: many(purchaseOrderLines),
  receipts: many(purchaseOrderReceipts),
  approvalHistory: many(purchaseOrderApprovalHistory),
}));

export const purchaseOrderLinesRelations = relations(purchaseOrderLines, ({ one, many }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderLines.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  item: one(items, {
    fields: [purchaseOrderLines.itemId],
    references: [items.id],
  }),
  account: one(accounts, {
    fields: [purchaseOrderLines.accountId],
    references: [accounts.id],
  }),
  department: one(departments, {
    fields: [purchaseOrderLines.departmentId],
    references: [departments.id],
  }),
  location: one(locations, {
    fields: [purchaseOrderLines.locationId],
    references: [locations.id],
  }),
  class: one(classes, {
    fields: [purchaseOrderLines.classId],
    references: [classes.id],
  }),
  project: one(projects, {
    fields: [purchaseOrderLines.projectId],
    references: [projects.id],
  }),
  receiptLines: many(purchaseOrderReceiptLines),
}));

export const purchaseOrderReceiptsRelations = relations(purchaseOrderReceipts, ({ one, many }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderReceipts.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  subsidiary: one(subsidiaries, {
    fields: [purchaseOrderReceipts.subsidiaryId],
    references: [subsidiaries.id],
  }),
  vendor: one(entities, {
    fields: [purchaseOrderReceipts.vendorId],
    references: [entities.id],
  }),
  location: one(locations, {
    fields: [purchaseOrderReceipts.locationId],
    references: [locations.id],
  }),
  lines: many(purchaseOrderReceiptLines),
}));

export const purchaseOrderReceiptLinesRelations = relations(purchaseOrderReceiptLines, ({ one }) => ({
  receipt: one(purchaseOrderReceipts, {
    fields: [purchaseOrderReceiptLines.receiptId],
    references: [purchaseOrderReceipts.id],
  }),
  purchaseOrderLine: one(purchaseOrderLines, {
    fields: [purchaseOrderReceiptLines.purchaseOrderLineId],
    references: [purchaseOrderLines.id],
  }),
  item: one(items, {
    fields: [purchaseOrderReceiptLines.itemId],
    references: [items.id],
  }),
}));

export const purchaseOrderApprovalHistoryRelations = relations(purchaseOrderApprovalHistory, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderApprovalHistory.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type NewPurchaseOrder = typeof purchaseOrders.$inferInsert;
export type UpdatePurchaseOrder = Partial<Omit<NewPurchaseOrder, 'id' | 'organizationId' | 'createdAt' | 'createdBy'>>;

export type PurchaseOrderLine = typeof purchaseOrderLines.$inferSelect;
export type NewPurchaseOrderLine = typeof purchaseOrderLines.$inferInsert;
export type UpdatePurchaseOrderLine = Partial<Omit<NewPurchaseOrderLine, 'id' | 'purchaseOrderId' | 'createdAt'>>;

export type PurchaseOrderReceipt = typeof purchaseOrderReceipts.$inferSelect;
export type NewPurchaseOrderReceipt = typeof purchaseOrderReceipts.$inferInsert;
export type UpdatePurchaseOrderReceipt = Partial<Omit<NewPurchaseOrderReceipt, 'id' | 'organizationId' | 'createdAt' | 'createdBy'>>;

export type PurchaseOrderReceiptLine = typeof purchaseOrderReceiptLines.$inferSelect;
export type NewPurchaseOrderReceiptLine = typeof purchaseOrderReceiptLines.$inferInsert;

export type PurchaseOrderApprovalHistoryRecord = typeof purchaseOrderApprovalHistory.$inferSelect;
export type NewPurchaseOrderApprovalHistoryRecord = typeof purchaseOrderApprovalHistory.$inferInsert;
