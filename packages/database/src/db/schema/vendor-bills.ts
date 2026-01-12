/**
 * Vendor Bills & Bill Payments Schema (Procure-to-Pay)
 *
 * This schema supports:
 * - Vendor bill processing
 * - 3-way match: PO ↔ Receipt ↔ Bill
 * - Bill payment processing
 * - Vendor credit memos
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
import { purchaseOrders, purchaseOrderLines, purchaseOrderReceiptLines } from './purchase-orders';

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Vendor Bill Status Flow:
 * DRAFT → PENDING_APPROVAL → APPROVED → PARTIALLY_PAID → PAID → VOIDED
 *                        ↓
 *                    REJECTED
 */
export const vendorBillStatusEnum = pgEnum('vendor_bill_status', [
  'DRAFT',              // Initial entry, editable
  'PENDING_APPROVAL',   // Awaiting approval
  'APPROVED',           // Approved for payment
  'REJECTED',           // Rejected, needs correction
  'PARTIALLY_PAID',     // Partial payment made
  'PAID',               // Fully paid
  'VOIDED',             // Voided/cancelled
]);

export const VendorBillStatus = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  VOIDED: 'VOIDED',
} as const;

export type VendorBillStatusValue = typeof VendorBillStatus[keyof typeof VendorBillStatus];

/**
 * Valid bill status transitions
 */
export const VALID_VENDOR_BILL_TRANSITIONS: Record<VendorBillStatusValue, VendorBillStatusValue[]> = {
  DRAFT: ['PENDING_APPROVAL', 'VOIDED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'VOIDED'],
  APPROVED: ['PARTIALLY_PAID', 'PAID', 'VOIDED'],
  REJECTED: ['DRAFT', 'VOIDED'],
  PARTIALLY_PAID: ['PAID', 'VOIDED'],
  PAID: ['VOIDED'], // Can void even after payment (with reversals)
  VOIDED: [],
};

/**
 * Bill Payment Status
 */
export const billPaymentStatusEnum = pgEnum('bill_payment_status', [
  'DRAFT',
  'PENDING',        // Awaiting processing
  'PROCESSING',     // Payment in process (e.g., ACH pending)
  'COMPLETED',      // Payment cleared
  'FAILED',         // Payment failed
  'VOIDED',         // Voided
]);

export const BillPaymentStatus = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  VOIDED: 'VOIDED',
} as const;

export type BillPaymentStatusValue = typeof BillPaymentStatus[keyof typeof BillPaymentStatus];

/**
 * Payment Method for vendor payments
 */
export const vendorPaymentMethodEnum = pgEnum('vendor_payment_method', [
  'CHECK',
  'ACH',
  'WIRE',
  'CREDIT_CARD',
  'VIRTUAL_CARD',
  'CASH',
  'OTHER',
]);

export const VendorPaymentMethod = {
  CHECK: 'CHECK',
  ACH: 'ACH',
  WIRE: 'WIRE',
  CREDIT_CARD: 'CREDIT_CARD',
  VIRTUAL_CARD: 'VIRTUAL_CARD',
  CASH: 'CASH',
  OTHER: 'OTHER',
} as const;

export type VendorPaymentMethodValue = typeof VendorPaymentMethod[keyof typeof VendorPaymentMethod];

/**
 * 3-Way Match Status
 */
export const threeWayMatchStatusEnum = pgEnum('three_way_match_status', [
  'NOT_REQUIRED',   // No PO, direct bill
  'PENDING',        // Awaiting match
  'MATCHED',        // All matched
  'EXCEPTION',      // Variance detected
  'OVERRIDE',       // Manually approved despite variance
]);

export const ThreeWayMatchStatus = {
  NOT_REQUIRED: 'NOT_REQUIRED',
  PENDING: 'PENDING',
  MATCHED: 'MATCHED',
  EXCEPTION: 'EXCEPTION',
  OVERRIDE: 'OVERRIDE',
} as const;

export type ThreeWayMatchStatusValue = typeof ThreeWayMatchStatus[keyof typeof ThreeWayMatchStatus];

/**
 * Bill Approval Action Types
 */
export const billApprovalActionTypeEnum = pgEnum('bill_approval_action_type', [
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'RETURNED',
  'ESCALATED',
  'VOIDED',
]);

export const BillApprovalActionType = {
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  RETURNED: 'RETURNED',
  ESCALATED: 'ESCALATED',
  VOIDED: 'VOIDED',
} as const;

export type BillApprovalActionTypeValue = typeof BillApprovalActionType[keyof typeof BillApprovalActionType];

// ============================================================================
// TABLES
// ============================================================================

/**
 * Vendor Bills - AP invoices from vendors
 */
export const vendorBills = pgTable('vendor_bills', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Organization context
  organizationId: uuid('organization_id').notNull(),
  subsidiaryId: uuid('subsidiary_id').notNull().references(() => subsidiaries.id),

  // Bill identification
  billNumber: varchar('bill_number', { length: 50 }).notNull(),
  vendorInvoiceNumber: varchar('vendor_invoice_number', { length: 100 }),

  // Vendor reference
  vendorId: uuid('vendor_id').notNull().references(() => entities.id),
  vendorName: varchar('vendor_name', { length: 255 }),

  // Related PO (if from PO)
  purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrders.id),

  // Dates
  billDate: date('bill_date').notNull(),
  dueDate: date('due_date').notNull(),
  receivedDate: date('received_date'),

  // Status
  status: vendorBillStatusEnum('status').notNull().default('DRAFT'),

  // 3-Way Match
  threeWayMatchStatus: threeWayMatchStatusEnum('three_way_match_status').notNull().default('NOT_REQUIRED'),
  matchVarianceAmount: decimal('match_variance_amount', { precision: 15, scale: 2 }),
  matchOverrideReason: text('match_override_reason'),
  matchOverrideBy: uuid('match_override_by'),
  matchOverrideAt: timestamp('match_override_at', { withTimezone: true }),

  // Amounts
  subtotal: decimal('subtotal', { precision: 15, scale: 2 }).notNull().default('0'),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  shippingAmount: decimal('shipping_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).notNull().default('0'),

  // Payment tracking
  paidAmount: decimal('paid_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  balanceDue: decimal('balance_due', { precision: 15, scale: 2 }).notNull().default('0'),

  // Discounts
  discountDate: date('discount_date'),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }),
  discountAmount: decimal('discount_amount', { precision: 15, scale: 2 }),
  discountTaken: decimal('discount_taken', { precision: 15, scale: 2 }).notNull().default('0'),

  // Default GL account
  apAccountId: uuid('ap_account_id').references(() => accounts.id),

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
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  voidedBy: uuid('voided_by'),
  voidReason: text('void_reason'),
}, (table) => ({
  orgIdx: index('vb_organization_idx').on(table.organizationId),
  subsidiaryIdx: index('vb_subsidiary_idx').on(table.subsidiaryId),
  vendorIdx: index('vb_vendor_idx').on(table.vendorId),
  statusIdx: index('vb_status_idx').on(table.status),
  billDateIdx: index('vb_bill_date_idx').on(table.billDate),
  dueDateIdx: index('vb_due_date_idx').on(table.dueDate),
  poIdx: index('vb_po_idx').on(table.purchaseOrderId),
  matchStatusIdx: index('vb_match_status_idx').on(table.threeWayMatchStatus),
}));

/**
 * Vendor Bill Lines
 */
export const vendorBillLines = pgTable('vendor_bill_lines', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Parent reference
  vendorBillId: uuid('vendor_bill_id').notNull().references(() => vendorBills.id, { onDelete: 'cascade' }),

  // Line identification
  lineNumber: integer('line_number').notNull(),

  // PO Line reference (for 3-way match)
  purchaseOrderLineId: uuid('purchase_order_line_id').references(() => purchaseOrderLines.id),
  receiptLineId: uuid('receipt_line_id').references(() => purchaseOrderReceiptLines.id),

  // Item reference (optional)
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

  // 3-Way Match details (line-level)
  poQuantity: decimal('po_quantity', { precision: 15, scale: 4 }),
  poUnitPrice: decimal('po_unit_price', { precision: 15, scale: 4 }),
  receivedQuantity: decimal('received_quantity', { precision: 15, scale: 4 }),
  quantityVariance: decimal('quantity_variance', { precision: 15, scale: 4 }),
  priceVariance: decimal('price_variance', { precision: 15, scale: 2 }),
  matchStatus: threeWayMatchStatusEnum('match_status').default('NOT_REQUIRED'),

  // Accounting dimensions
  accountId: uuid('account_id').references(() => accounts.id),
  departmentId: uuid('department_id').references(() => departments.id),
  locationId: uuid('location_id').references(() => locations.id),
  classId: uuid('class_id').references(() => classes.id),
  projectId: uuid('project_id').references(() => projects.id),

  // Notes
  memo: text('memo'),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  billIdx: index('vb_line_bill_idx').on(table.vendorBillId),
  poLineIdx: index('vb_line_po_line_idx').on(table.purchaseOrderLineId),
  receiptLineIdx: index('vb_line_receipt_line_idx').on(table.receiptLineId),
  itemIdx: index('vb_line_item_idx').on(table.itemId),
}));

/**
 * Bill Payments - Payments to vendors
 */
export const billPayments = pgTable('bill_payments', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Organization context
  organizationId: uuid('organization_id').notNull(),
  subsidiaryId: uuid('subsidiary_id').notNull().references(() => subsidiaries.id),

  // Payment identification
  paymentNumber: varchar('payment_number', { length: 50 }).notNull(),

  // Vendor
  vendorId: uuid('vendor_id').notNull().references(() => entities.id),
  vendorName: varchar('vendor_name', { length: 255 }),

  // Payment details
  paymentDate: date('payment_date').notNull(),
  paymentMethod: vendorPaymentMethodEnum('payment_method').notNull(),
  status: billPaymentStatusEnum('status').notNull().default('DRAFT'),

  // Amounts
  paymentAmount: decimal('payment_amount', { precision: 15, scale: 2 }).notNull(),
  appliedAmount: decimal('applied_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  unappliedAmount: decimal('unapplied_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  discountTaken: decimal('discount_taken', { precision: 15, scale: 2 }).notNull().default('0'),

  // Bank account
  bankAccountId: uuid('bank_account_id').references(() => accounts.id),

  // Payment reference info
  checkNumber: varchar('check_number', { length: 50 }),
  achTraceNumber: varchar('ach_trace_number', { length: 100 }),
  wireReference: varchar('wire_reference', { length: 100 }),
  externalRef: varchar('external_ref', { length: 100 }),

  // Payee info (may differ from vendor for remit-to)
  payeeName: varchar('payee_name', { length: 255 }),
  payeeAddress: text('payee_address'),

  // Notes
  memo: text('memo'),

  // Currency
  currencyCode: varchar('currency_code', { length: 3 }).default('USD'),
  exchangeRate: decimal('exchange_rate', { precision: 15, scale: 6 }).default('1'),

  // Processing
  clearedDate: date('cleared_date'),
  clearedAmount: decimal('cleared_amount', { precision: 15, scale: 2 }),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by'),
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  voidedBy: uuid('voided_by'),
  voidReason: text('void_reason'),
}, (table) => ({
  orgIdx: index('bp_organization_idx').on(table.organizationId),
  subsidiaryIdx: index('bp_subsidiary_idx').on(table.subsidiaryId),
  vendorIdx: index('bp_vendor_idx').on(table.vendorId),
  statusIdx: index('bp_status_idx').on(table.status),
  paymentDateIdx: index('bp_payment_date_idx').on(table.paymentDate),
  checkNumberIdx: index('bp_check_number_idx').on(table.checkNumber),
}));

/**
 * Bill Payment Applications - Links payments to bills
 */
export const billPaymentApplications = pgTable('bill_payment_applications', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Payment reference
  billPaymentId: uuid('bill_payment_id').notNull().references(() => billPayments.id, { onDelete: 'cascade' }),

  // Bill reference
  vendorBillId: uuid('vendor_bill_id').notNull().references(() => vendorBills.id),

  // Application amounts
  appliedAmount: decimal('applied_amount', { precision: 15, scale: 2 }).notNull(),
  discountAmount: decimal('discount_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  writeOffAmount: decimal('write_off_amount', { precision: 15, scale: 2 }).notNull().default('0'),

  // Reversal tracking
  reversedAt: timestamp('reversed_at', { withTimezone: true }),
  reversedBy: uuid('reversed_by'),
  reversalReason: text('reversal_reason'),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  paymentIdx: index('bpa_payment_idx').on(table.billPaymentId),
  billIdx: index('bpa_bill_idx').on(table.vendorBillId),
}));

/**
 * Vendor Credit Memos - Credits from vendors
 */
export const vendorCreditMemos = pgTable('vendor_credit_memos', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Organization context
  organizationId: uuid('organization_id').notNull(),
  subsidiaryId: uuid('subsidiary_id').notNull().references(() => subsidiaries.id),

  // Credit memo identification
  creditMemoNumber: varchar('credit_memo_number', { length: 50 }).notNull(),
  vendorCreditNumber: varchar('vendor_credit_number', { length: 100 }),

  // Vendor
  vendorId: uuid('vendor_id').notNull().references(() => entities.id),
  vendorName: varchar('vendor_name', { length: 255 }),

  // Source
  sourceType: varchar('source_type', { length: 50 }).notNull(), // RETURN, PRICE_ADJUSTMENT, REBATE, OTHER
  sourceRef: varchar('source_ref', { length: 100 }),
  originalBillId: uuid('original_bill_id').references(() => vendorBills.id),

  // Date
  creditDate: date('credit_date').notNull(),

  // Amounts
  originalAmount: decimal('original_amount', { precision: 15, scale: 2 }).notNull(),
  appliedAmount: decimal('applied_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  remainingAmount: decimal('remaining_amount', { precision: 15, scale: 2 }).notNull(),

  // Status
  status: varchar('status', { length: 50 }).notNull().default('OPEN'), // OPEN, PARTIALLY_APPLIED, APPLIED, VOIDED

  // Notes
  memo: text('memo'),

  // Currency
  currencyCode: varchar('currency_code', { length: 3 }).default('USD'),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  voidedAt: timestamp('voided_at', { withTimezone: true }),
}, (table) => ({
  orgIdx: index('vcm_organization_idx').on(table.organizationId),
  vendorIdx: index('vcm_vendor_idx').on(table.vendorId),
  statusIdx: index('vcm_status_idx').on(table.status),
  originalBillIdx: index('vcm_original_bill_idx').on(table.originalBillId),
}));

/**
 * Vendor Bill Approval History
 */
export const vendorBillApprovalHistory = pgTable('vendor_bill_approval_history', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Parent reference
  vendorBillId: uuid('vendor_bill_id').notNull().references(() => vendorBills.id, { onDelete: 'cascade' }),

  // Action details
  action: billApprovalActionTypeEnum('action').notNull(),

  // Actor
  performedBy: uuid('performed_by').notNull(),
  performedByName: varchar('performed_by_name', { length: 255 }),

  // Status transition
  fromStatus: vendorBillStatusEnum('from_status'),
  toStatus: vendorBillStatusEnum('to_status').notNull(),

  // Comments
  comments: text('comments'),

  // Timestamp
  performedAt: timestamp('performed_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  billIdx: index('vb_approval_bill_idx').on(table.vendorBillId),
  performedByIdx: index('vb_approval_performed_by_idx').on(table.performedBy),
  actionIdx: index('vb_approval_action_idx').on(table.action),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const vendorBillsRelations = relations(vendorBills, ({ one, many }) => ({
  subsidiary: one(subsidiaries, {
    fields: [vendorBills.subsidiaryId],
    references: [subsidiaries.id],
  }),
  vendor: one(entities, {
    fields: [vendorBills.vendorId],
    references: [entities.id],
  }),
  purchaseOrder: one(purchaseOrders, {
    fields: [vendorBills.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  apAccount: one(accounts, {
    fields: [vendorBills.apAccountId],
    references: [accounts.id],
  }),
  lines: many(vendorBillLines),
  paymentApplications: many(billPaymentApplications),
  approvalHistory: many(vendorBillApprovalHistory),
}));

export const vendorBillLinesRelations = relations(vendorBillLines, ({ one }) => ({
  vendorBill: one(vendorBills, {
    fields: [vendorBillLines.vendorBillId],
    references: [vendorBills.id],
  }),
  purchaseOrderLine: one(purchaseOrderLines, {
    fields: [vendorBillLines.purchaseOrderLineId],
    references: [purchaseOrderLines.id],
  }),
  receiptLine: one(purchaseOrderReceiptLines, {
    fields: [vendorBillLines.receiptLineId],
    references: [purchaseOrderReceiptLines.id],
  }),
  item: one(items, {
    fields: [vendorBillLines.itemId],
    references: [items.id],
  }),
  account: one(accounts, {
    fields: [vendorBillLines.accountId],
    references: [accounts.id],
  }),
  department: one(departments, {
    fields: [vendorBillLines.departmentId],
    references: [departments.id],
  }),
  location: one(locations, {
    fields: [vendorBillLines.locationId],
    references: [locations.id],
  }),
  class: one(classes, {
    fields: [vendorBillLines.classId],
    references: [classes.id],
  }),
  project: one(projects, {
    fields: [vendorBillLines.projectId],
    references: [projects.id],
  }),
}));

export const billPaymentsRelations = relations(billPayments, ({ one, many }) => ({
  subsidiary: one(subsidiaries, {
    fields: [billPayments.subsidiaryId],
    references: [subsidiaries.id],
  }),
  vendor: one(entities, {
    fields: [billPayments.vendorId],
    references: [entities.id],
  }),
  bankAccount: one(accounts, {
    fields: [billPayments.bankAccountId],
    references: [accounts.id],
  }),
  applications: many(billPaymentApplications),
}));

export const billPaymentApplicationsRelations = relations(billPaymentApplications, ({ one }) => ({
  billPayment: one(billPayments, {
    fields: [billPaymentApplications.billPaymentId],
    references: [billPayments.id],
  }),
  vendorBill: one(vendorBills, {
    fields: [billPaymentApplications.vendorBillId],
    references: [vendorBills.id],
  }),
}));

export const vendorCreditMemosRelations = relations(vendorCreditMemos, ({ one }) => ({
  subsidiary: one(subsidiaries, {
    fields: [vendorCreditMemos.subsidiaryId],
    references: [subsidiaries.id],
  }),
  vendor: one(entities, {
    fields: [vendorCreditMemos.vendorId],
    references: [entities.id],
  }),
  originalBill: one(vendorBills, {
    fields: [vendorCreditMemos.originalBillId],
    references: [vendorBills.id],
  }),
}));

export const vendorBillApprovalHistoryRelations = relations(vendorBillApprovalHistory, ({ one }) => ({
  vendorBill: one(vendorBills, {
    fields: [vendorBillApprovalHistory.vendorBillId],
    references: [vendorBills.id],
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type VendorBill = typeof vendorBills.$inferSelect;
export type NewVendorBill = typeof vendorBills.$inferInsert;
export type UpdateVendorBill = Partial<Omit<NewVendorBill, 'id' | 'organizationId' | 'createdAt' | 'createdBy'>>;

export type VendorBillLine = typeof vendorBillLines.$inferSelect;
export type NewVendorBillLine = typeof vendorBillLines.$inferInsert;
export type UpdateVendorBillLine = Partial<Omit<NewVendorBillLine, 'id' | 'vendorBillId' | 'createdAt'>>;

export type BillPayment = typeof billPayments.$inferSelect;
export type NewBillPayment = typeof billPayments.$inferInsert;
export type UpdateBillPayment = Partial<Omit<NewBillPayment, 'id' | 'organizationId' | 'createdAt' | 'createdBy'>>;

export type BillPaymentApplication = typeof billPaymentApplications.$inferSelect;
export type NewBillPaymentApplication = typeof billPaymentApplications.$inferInsert;

export type VendorCreditMemo = typeof vendorCreditMemos.$inferSelect;
export type NewVendorCreditMemo = typeof vendorCreditMemos.$inferInsert;

export type VendorBillApprovalHistoryRecord = typeof vendorBillApprovalHistory.$inferSelect;
export type NewVendorBillApprovalHistoryRecord = typeof vendorBillApprovalHistory.$inferInsert;
