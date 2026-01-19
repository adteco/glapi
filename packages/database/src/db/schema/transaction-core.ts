import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  date,
  decimal,
  integer,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { subsidiaries } from './subsidiaries';
import { items } from './items';
import { accounts } from './accounts';
import { departments } from './departments';
import { locations } from './locations';
import { classes } from './classes';
import { projects } from './projects';

// ============================================================================
// STATUS ENUMS (Separate per transaction type for type safety)
// ============================================================================

export const purchaseOrderStatusEnum = pgEnum('purchase_order_status_enum', [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'PARTIALLY_RECEIVED',
  'FULLY_RECEIVED',
  'PARTIALLY_BILLED',
  'FULLY_BILLED',
  'CLOSED',
  'CANCELLED',
]);

export const poReceiptStatusEnum = pgEnum('po_receipt_status_enum', [
  'DRAFT',
  'PENDING',
  'POSTED',
  'CANCELLED',
]);

export const vendorBillStatusEnum = pgEnum('vendor_bill_status_enum', [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'PENDING_MATCH',
  'MATCHED',
  'MATCH_EXCEPTION',
  'PARTIALLY_PAID',
  'PAID',
  'VOIDED',
  'CANCELLED',
]);

export const billPaymentStatusEnum = pgEnum('bill_payment_status_enum', [
  'DRAFT',
  'PENDING',
  'POSTED',
  'CLEARED',
  'VOIDED',
]);

export const salesOrderStatusEnum2 = pgEnum('sales_order_status_enum', [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'PARTIALLY_FULFILLED',
  'FULFILLED',
  'PARTIALLY_INVOICED',
  'INVOICED',
  'CLOSED',
  'CANCELLED',
]);

export const invoiceStatusEnum2 = pgEnum('invoice_status_enum', [
  'DRAFT',
  'PENDING',
  'SENT',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'VOIDED',
  'CANCELLED',
]);

export const customerPaymentStatusEnum2 = pgEnum('customer_payment_status_enum', [
  'DRAFT',
  'PENDING',
  'POSTED',
  'DEPOSITED',
  'CLEARED',
  'VOIDED',
]);

export const threeWayMatchStatusEnum2 = pgEnum('three_way_match_status_enum', [
  'NOT_REQUIRED',
  'PENDING',
  'MATCHED',
  'VARIANCE_WITHIN_TOLERANCE',
  'VARIANCE_EXCEPTION',
  'OVERRIDE_APPROVED',
]);

export const lineMatchStatusEnum = pgEnum('line_match_status_enum', [
  'NOT_REQUIRED',
  'PENDING',
  'MATCHED',
  'QUANTITY_VARIANCE',
  'PRICE_VARIANCE',
  'BOTH_VARIANCE',
  'OVERRIDE_APPROVED',
]);

export const transactionCategoryEnum = pgEnum('transaction_category_enum', [
  'P2P',
  'O2C',
  'GL',
]);

export const entityRoleEnum = pgEnum('entity_role_enum', [
  'VENDOR',
  'CUSTOMER',
  'INTERNAL',
]);

// ============================================================================
// TYPE CONSTANTS
// ============================================================================

export const PurchaseOrderStatus = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  FULLY_RECEIVED: 'FULLY_RECEIVED',
  PARTIALLY_BILLED: 'PARTIALLY_BILLED',
  FULLY_BILLED: 'FULLY_BILLED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
} as const;

export const POReceiptStatus = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  POSTED: 'POSTED',
  CANCELLED: 'CANCELLED',
} as const;

export const VendorBillStatus = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  PENDING_MATCH: 'PENDING_MATCH',
  MATCHED: 'MATCHED',
  MATCH_EXCEPTION: 'MATCH_EXCEPTION',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  VOIDED: 'VOIDED',
  CANCELLED: 'CANCELLED',
} as const;

export const BillPaymentStatus = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  POSTED: 'POSTED',
  CLEARED: 'CLEARED',
  VOIDED: 'VOIDED',
} as const;

export const SalesOrderStatus2 = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  PARTIALLY_FULFILLED: 'PARTIALLY_FULFILLED',
  FULFILLED: 'FULFILLED',
  PARTIALLY_INVOICED: 'PARTIALLY_INVOICED',
  INVOICED: 'INVOICED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
} as const;

export const InvoiceStatus2 = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  SENT: 'SENT',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  VOIDED: 'VOIDED',
  CANCELLED: 'CANCELLED',
} as const;

export const CustomerPaymentStatus2 = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  POSTED: 'POSTED',
  DEPOSITED: 'DEPOSITED',
  CLEARED: 'CLEARED',
  VOIDED: 'VOIDED',
} as const;

export const ThreeWayMatchStatus2 = {
  NOT_REQUIRED: 'NOT_REQUIRED',
  PENDING: 'PENDING',
  MATCHED: 'MATCHED',
  VARIANCE_WITHIN_TOLERANCE: 'VARIANCE_WITHIN_TOLERANCE',
  VARIANCE_EXCEPTION: 'VARIANCE_EXCEPTION',
  OVERRIDE_APPROVED: 'OVERRIDE_APPROVED',
} as const;

export const LineMatchStatus = {
  NOT_REQUIRED: 'NOT_REQUIRED',
  PENDING: 'PENDING',
  MATCHED: 'MATCHED',
  QUANTITY_VARIANCE: 'QUANTITY_VARIANCE',
  PRICE_VARIANCE: 'PRICE_VARIANCE',
  BOTH_VARIANCE: 'BOTH_VARIANCE',
  OVERRIDE_APPROVED: 'OVERRIDE_APPROVED',
} as const;

export const TransactionCategory = {
  P2P: 'P2P',
  O2C: 'O2C',
  GL: 'GL',
} as const;

export const EntityRole = {
  VENDOR: 'VENDOR',
  CUSTOMER: 'CUSTOMER',
  INTERNAL: 'INTERNAL',
} as const;

// Transaction type codes
export const TransactionTypeCode = {
  PURCHASE_ORDER: 'PURCHASE_ORDER',
  PO_RECEIPT: 'PO_RECEIPT',
  VENDOR_BILL: 'VENDOR_BILL',
  BILL_PAYMENT: 'BILL_PAYMENT',
  SALES_ORDER: 'SALES_ORDER',
  INVOICE: 'INVOICE',
  CUSTOMER_PAYMENT: 'CUSTOMER_PAYMENT',
} as const;

// ============================================================================
// TRANSACTION TYPES REGISTRY
// ============================================================================

export const transactionTypesRegistry = pgTable('transaction_types', {
  typeCode: text('type_code').primaryKey(),
  typeName: text('type_name').notNull(),
  category: transactionCategoryEnum('category').notNull(),
  entityRole: entityRoleEnum('entity_role').notNull(),
  headerExtTable: text('header_ext_table'),
  lineExtTable: text('line_ext_table'),
  statusEnum: text('status_enum').notNull(),
  hasLines: boolean('has_lines').default(true),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// TRANSACTION HEADERS (Core Table)
// ============================================================================

export const transactionHeaders = pgTable('transaction_headers', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: text('organization_id').notNull(),
  subsidiaryId: uuid('subsidiary_id').notNull().references(() => subsidiaries.id),

  // Type discriminator
  transactionType: text('transaction_type').notNull().references(() => transactionTypesRegistry.typeCode),
  transactionNumber: text('transaction_number').notNull(),

  // Entity reference (vendor or customer)
  entityId: uuid('entity_id').notNull(),
  entityName: text('entity_name'),

  // Timing
  transactionDate: date('transaction_date').notNull(),

  // Status (stored as text, validated by application layer per type)
  status: text('status').notNull(),

  // Financial totals
  subtotal: decimal('subtotal', { precision: 18, scale: 4 }).default('0'),
  taxAmount: decimal('tax_amount', { precision: 18, scale: 4 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 18, scale: 4 }).default('0'),

  // Currency
  currencyCode: text('currency_code').default('USD'),
  exchangeRate: decimal('exchange_rate', { precision: 15, scale: 6 }).default('1'),

  // Notes
  memo: text('memo'),
  internalNotes: text('internal_notes'),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text('updated_by'),
}, (table) => ({
  // Organization index
  orgIdx: index('transaction_headers_org_idx').on(table.organizationId),
  // Type index
  typeIdx: index('transaction_headers_type_idx').on(table.transactionType),
  // Entity index
  entityIdx: index('transaction_headers_entity_idx').on(table.entityId),
  // Date index
  dateIdx: index('transaction_headers_date_idx').on(table.transactionDate),
  // Status index
  statusIdx: index('transaction_headers_status_idx').on(table.status),
  // Composite index for common queries
  orgTypeDateIdx: index('transaction_headers_org_type_date_idx')
    .on(table.organizationId, table.transactionType, table.transactionDate),
  // Unique constraint on transaction number per org and type
  numberUniqueIdx: uniqueIndex('transaction_headers_number_unique')
    .on(table.organizationId, table.transactionType, table.transactionNumber),
}));

// ============================================================================
// TRANSACTION LINES (Core Table)
// ============================================================================

export const transactionLines = pgTable('transaction_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionId: uuid('transaction_id').notNull().references(() => transactionHeaders.id, { onDelete: 'cascade' }),
  lineNumber: integer('line_number').notNull(),

  // Item reference
  itemId: uuid('item_id').references(() => items.id),
  itemName: text('item_name').notNull(),
  itemDescription: text('item_description'),

  // Quantities & amounts
  quantity: decimal('quantity', { precision: 18, scale: 4 }).notNull(),
  unitOfMeasure: text('unit_of_measure'),
  unitPrice: decimal('unit_price', { precision: 18, scale: 4 }).notNull(),
  amount: decimal('amount', { precision: 18, scale: 4 }).notNull(),
  taxAmount: decimal('tax_amount', { precision: 18, scale: 4 }).default('0'),

  // Accounting dimensions
  accountId: uuid('account_id').references(() => accounts.id),
  departmentId: uuid('department_id').references(() => departments.id),
  locationId: uuid('location_id').references(() => locations.id),
  classId: uuid('class_id').references(() => classes.id),
  projectId: uuid('project_id').references(() => projects.id),

  // Notes
  memo: text('memo'),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Transaction index
  transactionIdx: index('transaction_lines_transaction_idx').on(table.transactionId),
  // Item index
  itemIdx: index('transaction_lines_item_idx').on(table.itemId),
  // Account index
  accountIdx: index('transaction_lines_account_idx').on(table.accountId),
  // Unique line number per transaction
  lineNumberUniqueIdx: uniqueIndex('transaction_lines_number_unique')
    .on(table.transactionId, table.lineNumber),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const transactionHeadersRelations = relations(transactionHeaders, ({ one, many }) => ({
  subsidiary: one(subsidiaries, {
    fields: [transactionHeaders.subsidiaryId],
    references: [subsidiaries.id],
  }),
  transactionType: one(transactionTypesRegistry, {
    fields: [transactionHeaders.transactionType],
    references: [transactionTypesRegistry.typeCode],
  }),
  lines: many(transactionLines),
}));

export const transactionLinesRelations = relations(transactionLines, ({ one }) => ({
  transaction: one(transactionHeaders, {
    fields: [transactionLines.transactionId],
    references: [transactionHeaders.id],
  }),
  item: one(items, {
    fields: [transactionLines.itemId],
    references: [items.id],
  }),
  account: one(accounts, {
    fields: [transactionLines.accountId],
    references: [accounts.id],
  }),
  department: one(departments, {
    fields: [transactionLines.departmentId],
    references: [departments.id],
  }),
  location: one(locations, {
    fields: [transactionLines.locationId],
    references: [locations.id],
  }),
  class: one(classes, {
    fields: [transactionLines.classId],
    references: [classes.id],
  }),
  project: one(projects, {
    fields: [transactionLines.projectId],
    references: [projects.id],
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

// Transaction Header types
export type TransactionHeader = InferSelectModel<typeof transactionHeaders>;
export type NewTransactionHeader = InferInsertModel<typeof transactionHeaders>;
export type UpdateTransactionHeader = Partial<Omit<NewTransactionHeader, 'id' | 'createdAt' | 'createdBy'>>;

// Transaction Line types
export type TransactionLine = InferSelectModel<typeof transactionLines>;
export type NewTransactionLine = InferInsertModel<typeof transactionLines>;
export type UpdateTransactionLine = Partial<Omit<NewTransactionLine, 'id' | 'transactionId' | 'createdAt'>>;

// Transaction Type Registry types
export type TransactionTypeRecord = InferSelectModel<typeof transactionTypesRegistry>;
export type NewTransactionTypeRecord = InferInsertModel<typeof transactionTypesRegistry>;

// Status value types
export type PurchaseOrderStatusValue = typeof PurchaseOrderStatus[keyof typeof PurchaseOrderStatus];
export type POReceiptStatusValue = typeof POReceiptStatus[keyof typeof POReceiptStatus];
export type VendorBillStatusValue = typeof VendorBillStatus[keyof typeof VendorBillStatus];
export type BillPaymentStatusValue = typeof BillPaymentStatus[keyof typeof BillPaymentStatus];
export type SalesOrderStatusValue2 = typeof SalesOrderStatus2[keyof typeof SalesOrderStatus2];
export type InvoiceStatusValue2 = typeof InvoiceStatus2[keyof typeof InvoiceStatus2];
export type CustomerPaymentStatusValue2 = typeof CustomerPaymentStatus2[keyof typeof CustomerPaymentStatus2];
export type ThreeWayMatchStatusValue2 = typeof ThreeWayMatchStatus2[keyof typeof ThreeWayMatchStatus2];
export type LineMatchStatusValue = typeof LineMatchStatus[keyof typeof LineMatchStatus];
export type TransactionCategoryValue = typeof TransactionCategory[keyof typeof TransactionCategory];
export type EntityRoleValue = typeof EntityRole[keyof typeof EntityRole];
export type TransactionTypeCodeValue = typeof TransactionTypeCode[keyof typeof TransactionTypeCode];
