import { pgTable, text, uuid, decimal, boolean, timestamp, uniqueIndex, index, date, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { entities } from './entities';
import { accounts } from './accounts';

// ============================================================================
// ENUMS
// ============================================================================

export const accountingListTypeEnum = pgEnum('accounting_list_type', [
  'payment_terms',
  'payment_method',
  'charge_type',
]);

export const dueDateTypeEnum = pgEnum('due_date_type', [
  'net_days',         // Standard net days from invoice date
  'day_of_month',     // Due on specific day of month
  'end_of_month',     // Due at end of month + net days
]);

export const accountingPaymentMethodTypeEnum = pgEnum('accounting_payment_method_type', [
  'cash',
  'check',
  'credit_card',
  'debit_card',
  'ach',
  'wire_transfer',
  'other',
]);

export const chargeCategoryEnum = pgEnum('charge_category', [
  'service',
  'product',
  'shipping',
  'tax',
  'discount',
  'fee',
  'other',
]);

// ============================================================================
// BASE TABLE: accounting_lists
// ============================================================================

export const accountingLists = pgTable('accounting_lists', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  listType: accountingListTypeEnum('list_type').notNull(),

  // Common fields
  code: text('code').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),

  // Audit fields
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Unique index on organization + list type + code
  orgTypeCodeUnique: uniqueIndex('idx_accounting_lists_org_type_code').on(
    table.organizationId,
    table.listType,
    table.code
  ),
  // Index for filtering by organization and type
  orgTypeIdx: index('idx_accounting_lists_org_type').on(table.organizationId, table.listType),
  // Index for finding default
  defaultIdx: index('idx_accounting_lists_default').on(table.organizationId, table.listType, table.isDefault),
}));

// ============================================================================
// EXTENSION TABLE: payment_terms_details
// ============================================================================

export const paymentTermsDetails = pgTable('payment_terms_details', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountingListId: uuid('accounting_list_id').notNull().references(() => accountingLists.id, { onDelete: 'cascade' }).unique(),

  // Due date configuration
  dueDateType: dueDateTypeEnum('due_date_type').default('net_days').notNull(),
  netDays: integer('net_days').default(30).notNull(),
  dayOfMonth: integer('day_of_month'), // For day_of_month type (1-31)

  // Early payment discount
  discountDays: integer('discount_days').default(0).notNull(),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }).default('0').notNull(),

  // Audit fields
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountingListIdx: index('idx_payment_terms_details_accounting_list').on(table.accountingListId),
}));

// ============================================================================
// EXTENSION TABLE: payment_methods_details
// ============================================================================

export const paymentMethodsDetails = pgTable('payment_methods_details', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountingListId: uuid('accounting_list_id').notNull().references(() => accountingLists.id, { onDelete: 'cascade' }).unique(),

  // Payment method configuration
  methodType: accountingPaymentMethodTypeEnum('method_type').notNull(),

  // GL Account for deposits
  depositAccountId: uuid('deposit_account_id').references(() => accounts.id),

  // Processing configuration
  requiresApproval: boolean('requires_approval').default(false).notNull(),
  processingFeePercent: decimal('processing_fee_percent', { precision: 5, scale: 4 }),
  processingFeeFixed: decimal('processing_fee_fixed', { precision: 10, scale: 2 }),

  // Audit fields
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountingListIdx: index('idx_payment_methods_details_accounting_list').on(table.accountingListId),
  methodTypeIdx: index('idx_payment_methods_details_method_type').on(table.methodType),
}));

// ============================================================================
// EXTENSION TABLE: charge_types_details
// ============================================================================

export const chargeTypesDetails = pgTable('charge_types_details', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountingListId: uuid('accounting_list_id').notNull().references(() => accountingLists.id, { onDelete: 'cascade' }).unique(),

  // Charge type configuration
  chargeCategory: chargeCategoryEnum('charge_category').notNull(),

  // GL Account mapping
  incomeAccountId: uuid('income_account_id').references(() => accounts.id),
  expenseAccountId: uuid('expense_account_id').references(() => accounts.id),

  // Tax configuration
  isTaxable: boolean('is_taxable').default(true).notNull(),
  defaultTaxCodeId: uuid('default_tax_code_id'), // Reference to tax codes if needed

  // Audit fields
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountingListIdx: index('idx_charge_types_details_accounting_list').on(table.accountingListId),
  categoryIdx: index('idx_charge_types_details_category').on(table.chargeCategory),
}));

// ============================================================================
// ASSIGNMENT TABLE: customer_accounting_lists
// ============================================================================

export const customerAccountingLists = pgTable('customer_accounting_lists', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  accountingListId: uuid('accounting_list_id').notNull().references(() => accountingLists.id, { onDelete: 'cascade' }),

  // Priority for resolution (lower number = higher priority)
  priority: integer('priority').default(1).notNull(),

  // Date range for when this assignment is effective
  effectiveDate: date('effective_date'),
  expirationDate: date('expiration_date'),

  // Audit fields
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Each customer can only have one assignment to a specific accounting list
  customerListUnique: uniqueIndex('idx_customer_accounting_lists_unique').on(
    table.customerId,
    table.accountingListId
  ),
  // Index for finding customer's accounting lists
  customerIdx: index('idx_customer_accounting_lists_customer').on(table.customerId),
  // Index for date-based lookups
  datesIdx: index('idx_customer_accounting_lists_dates').on(table.effectiveDate, table.expirationDate),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const accountingListsRelations = relations(accountingLists, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [accountingLists.organizationId],
    references: [organizations.id],
  }),
  paymentTermsDetails: one(paymentTermsDetails, {
    fields: [accountingLists.id],
    references: [paymentTermsDetails.accountingListId],
  }),
  paymentMethodsDetails: one(paymentMethodsDetails, {
    fields: [accountingLists.id],
    references: [paymentMethodsDetails.accountingListId],
  }),
  chargeTypesDetails: one(chargeTypesDetails, {
    fields: [accountingLists.id],
    references: [chargeTypesDetails.accountingListId],
  }),
  customerAssignments: many(customerAccountingLists),
}));

export const paymentTermsDetailsRelations = relations(paymentTermsDetails, ({ one }) => ({
  accountingList: one(accountingLists, {
    fields: [paymentTermsDetails.accountingListId],
    references: [accountingLists.id],
  }),
}));

export const paymentMethodsDetailsRelations = relations(paymentMethodsDetails, ({ one }) => ({
  accountingList: one(accountingLists, {
    fields: [paymentMethodsDetails.accountingListId],
    references: [accountingLists.id],
  }),
  depositAccount: one(accounts, {
    fields: [paymentMethodsDetails.depositAccountId],
    references: [accounts.id],
  }),
}));

export const chargeTypesDetailsRelations = relations(chargeTypesDetails, ({ one }) => ({
  accountingList: one(accountingLists, {
    fields: [chargeTypesDetails.accountingListId],
    references: [accountingLists.id],
  }),
  incomeAccount: one(accounts, {
    fields: [chargeTypesDetails.incomeAccountId],
    references: [accounts.id],
    relationName: 'incomeAccount',
  }),
  expenseAccount: one(accounts, {
    fields: [chargeTypesDetails.expenseAccountId],
    references: [accounts.id],
    relationName: 'expenseAccount',
  }),
}));

export const customerAccountingListsRelations = relations(customerAccountingLists, ({ one }) => ({
  customer: one(entities, {
    fields: [customerAccountingLists.customerId],
    references: [entities.id],
  }),
  accountingList: one(accountingLists, {
    fields: [customerAccountingLists.accountingListId],
    references: [accountingLists.id],
  }),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Base table types
export type AccountingList = typeof accountingLists.$inferSelect;
export type NewAccountingList = typeof accountingLists.$inferInsert;

// Extension table types
export type PaymentTermsDetail = typeof paymentTermsDetails.$inferSelect;
export type NewPaymentTermsDetail = typeof paymentTermsDetails.$inferInsert;

export type PaymentMethodsDetail = typeof paymentMethodsDetails.$inferSelect;
export type NewPaymentMethodsDetail = typeof paymentMethodsDetails.$inferInsert;

export type ChargeTypesDetail = typeof chargeTypesDetails.$inferSelect;
export type NewChargeTypesDetail = typeof chargeTypesDetails.$inferInsert;

// Assignment table types
export type CustomerAccountingList = typeof customerAccountingLists.$inferSelect;
export type NewCustomerAccountingList = typeof customerAccountingLists.$inferInsert;

// Enum value types
export type AccountingListType = 'payment_terms' | 'payment_method' | 'charge_type';
export type DueDateType = 'net_days' | 'day_of_month' | 'end_of_month';
export type PaymentMethodType = 'cash' | 'check' | 'credit_card' | 'debit_card' | 'ach' | 'wire_transfer' | 'other';
export type ChargeCategory = 'service' | 'product' | 'shipping' | 'tax' | 'discount' | 'fee' | 'other';

// Combined types for convenience
export interface PaymentTermsWithDetails extends AccountingList {
  paymentTermsDetails: PaymentTermsDetail | null;
}

export interface PaymentMethodWithDetails extends AccountingList {
  paymentMethodsDetails: PaymentMethodsDetail | null;
}

export interface ChargeTypeWithDetails extends AccountingList {
  chargeTypesDetails: ChargeTypesDetail | null;
}
