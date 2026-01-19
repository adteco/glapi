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
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { transactionHeaders } from './transaction-core';
import { subsidiaries } from './subsidiaries';

// ============================================================================
// PURCHASE ORDER APPROVAL HISTORY
// ============================================================================

export const purchaseOrderApprovalHistory2 = pgTable('purchase_order_approval_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: text('organization_id').notNull(),
  purchaseOrderId: uuid('purchase_order_id').notNull().references(() => transactionHeaders.id),

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
  poIdx: index('po_approval_history_po_idx').on(table.purchaseOrderId),
}));

// ============================================================================
// VENDOR BILL APPROVAL HISTORY
// ============================================================================

export const vendorBillApprovalHistory2 = pgTable('vendor_bill_approval_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: text('organization_id').notNull(),
  vendorBillId: uuid('vendor_bill_id').notNull().references(() => transactionHeaders.id),

  // Approval action
  action: text('action').notNull(),
  fromStatus: text('from_status'),
  toStatus: text('to_status'),

  // Actor
  performedBy: text('performed_by').notNull(),
  performedAt: timestamp('performed_at', { withTimezone: true }).defaultNow().notNull(),

  // Comments
  comments: text('comments'),

  // Match override
  isMatchOverride: boolean('is_match_override').default(false),
  overrideVarianceAmount: decimal('override_variance_amount', { precision: 18, scale: 4 }),
}, (table) => ({
  billIdx: index('vendor_bill_approval_history_bill_idx').on(table.vendorBillId),
}));

// ============================================================================
// VENDOR CREDIT MEMOS
// ============================================================================

export const vendorCreditMemos2 = pgTable('vendor_credit_memos', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: text('organization_id').notNull(),
  subsidiaryId: uuid('subsidiary_id').notNull().references(() => subsidiaries.id),

  // Vendor reference
  vendorId: uuid('vendor_id').notNull(),
  vendorName: text('vendor_name'),

  // Credit memo details
  creditMemoNumber: text('credit_memo_number').notNull(),
  creditMemoDate: date('credit_memo_date').notNull(),

  // Source reference
  vendorBillId: uuid('vendor_bill_id').references(() => transactionHeaders.id),

  // Amounts
  subtotal: decimal('subtotal', { precision: 18, scale: 4 }).notNull(),
  taxAmount: decimal('tax_amount', { precision: 18, scale: 4 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 18, scale: 4 }).notNull(),
  appliedAmount: decimal('applied_amount', { precision: 18, scale: 4 }).default('0'),
  remainingAmount: decimal('remaining_amount', { precision: 18, scale: 4 }).notNull(),

  // Currency
  currencyCode: text('currency_code').default('USD'),

  // Status
  status: text('status').notNull().default('OPEN'),  // OPEN, PARTIALLY_APPLIED, APPLIED, VOIDED

  // Notes
  memo: text('memo'),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text('updated_by'),
}, (table) => ({
  vendorIdx: index('vendor_credit_memos_vendor_idx').on(table.vendorId),
  billIdx: index('vendor_credit_memos_bill_idx').on(table.vendorBillId),
  numberUniqueIdx: uniqueIndex('vendor_credit_memos_number_unique').on(table.organizationId, table.creditMemoNumber),
}));

// ============================================================================
// CUSTOMER CREDIT MEMOS
// ============================================================================

export const customerCreditMemos2 = pgTable('customer_credit_memos', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: text('organization_id').notNull(),
  subsidiaryId: uuid('subsidiary_id').notNull().references(() => subsidiaries.id),

  // Customer reference
  customerId: uuid('customer_id').notNull(),
  customerName: text('customer_name'),

  // Credit memo details
  creditMemoNumber: text('credit_memo_number').notNull(),
  creditMemoDate: date('credit_memo_date').notNull(),

  // Source reference
  invoiceId: uuid('invoice_id').references(() => transactionHeaders.id),

  // Amounts
  subtotal: decimal('subtotal', { precision: 18, scale: 4 }).notNull(),
  taxAmount: decimal('tax_amount', { precision: 18, scale: 4 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 18, scale: 4 }).notNull(),
  appliedAmount: decimal('applied_amount', { precision: 18, scale: 4 }).default('0'),
  remainingAmount: decimal('remaining_amount', { precision: 18, scale: 4 }).notNull(),

  // Currency
  currencyCode: text('currency_code').default('USD'),

  // Status
  status: text('status').notNull().default('OPEN'),

  // Notes
  memo: text('memo'),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text('updated_by'),
}, (table) => ({
  customerIdx: index('customer_credit_memos_customer_idx').on(table.customerId),
  invoiceIdx: index('customer_credit_memos_invoice_idx').on(table.invoiceId),
  numberUniqueIdx: uniqueIndex('customer_credit_memos_number_unique').on(table.organizationId, table.creditMemoNumber),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const purchaseOrderApprovalHistory2Relations = relations(purchaseOrderApprovalHistory2, ({ one }) => ({
  purchaseOrder: one(transactionHeaders, {
    fields: [purchaseOrderApprovalHistory2.purchaseOrderId],
    references: [transactionHeaders.id],
  }),
}));

export const vendorBillApprovalHistory2Relations = relations(vendorBillApprovalHistory2, ({ one }) => ({
  vendorBill: one(transactionHeaders, {
    fields: [vendorBillApprovalHistory2.vendorBillId],
    references: [transactionHeaders.id],
  }),
}));

export const vendorCreditMemos2Relations = relations(vendorCreditMemos2, ({ one }) => ({
  subsidiary: one(subsidiaries, {
    fields: [vendorCreditMemos2.subsidiaryId],
    references: [subsidiaries.id],
  }),
  vendorBill: one(transactionHeaders, {
    fields: [vendorCreditMemos2.vendorBillId],
    references: [transactionHeaders.id],
  }),
}));

export const customerCreditMemos2Relations = relations(customerCreditMemos2, ({ one }) => ({
  subsidiary: one(subsidiaries, {
    fields: [customerCreditMemos2.subsidiaryId],
    references: [subsidiaries.id],
  }),
  invoice: one(transactionHeaders, {
    fields: [customerCreditMemos2.invoiceId],
    references: [transactionHeaders.id],
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type PurchaseOrderApprovalHistoryRecord2 = InferSelectModel<typeof purchaseOrderApprovalHistory2>;
export type NewPurchaseOrderApprovalHistoryRecord2 = InferInsertModel<typeof purchaseOrderApprovalHistory2>;

export type VendorBillApprovalHistoryRecord2 = InferSelectModel<typeof vendorBillApprovalHistory2>;
export type NewVendorBillApprovalHistoryRecord2 = InferInsertModel<typeof vendorBillApprovalHistory2>;

export type VendorCreditMemo2 = InferSelectModel<typeof vendorCreditMemos2>;
export type NewVendorCreditMemo2 = InferInsertModel<typeof vendorCreditMemos2>;

export type CustomerCreditMemo2 = InferSelectModel<typeof customerCreditMemos2>;
export type NewCustomerCreditMemo2 = InferInsertModel<typeof customerCreditMemos2>;
