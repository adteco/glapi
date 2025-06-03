import { pgTable, text, integer, boolean, jsonb, timestamp, uniqueIndex, decimal, date, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const transactionTypes = pgTable('transaction_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  typeCode: text('type_code').notNull().unique(),
  typeName: text('type_name').notNull(),
  typeCategory: text('type_category'), // 'SALES', 'PURCHASE', 'INVENTORY', 'GL', 'PROJECT'
  generatesGl: boolean('generates_gl').default(true).notNull(),
  requiresApproval: boolean('requires_approval').default(false).notNull(),
  canBeReversed: boolean('can_be_reversed').default(true).notNull(),
  numberingSequence: text('numbering_sequence'), // 'SO-{YYYY}-{####}'
  defaultGlAccountId: uuid('default_gl_account_id'),
  workflowTemplate: jsonb('workflow_template'), // Defines approval workflow
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  typeCodeIdx: uniqueIndex('idx_transaction_types_code').on(table.typeCode),
}));

export const transactionTypesRelations = relations(transactionTypes, ({ many }) => ({
  businessTransactions: many(businessTransactions),
  // postingRules relation defined in gl-transactions.ts to avoid circular dependency
}));

export const businessTransactions = pgTable('business_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  transactionNumber: text('transaction_number').notNull().unique(),
  transactionTypeId: uuid('transaction_type_id').notNull().references(() => transactionTypes.id),
  subsidiaryId: uuid('subsidiary_id').notNull(),
  entityId: uuid('entity_id'), // Customer/Vendor ID (polymorphic)
  entityType: text('entity_type'), // 'CUSTOMER', 'VENDOR', 'EMPLOYEE'
  transactionDate: date('transaction_date').notNull(),
  dueDate: date('due_date'),
  termsId: uuid('terms_id').references(() => paymentTerms.id),
  currencyCode: text('currency_code').notNull(),
  exchangeRate: decimal('exchange_rate', { precision: 12, scale: 6 }).default('1').notNull(),
  subtotalAmount: decimal('subtotal_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  taxAmount: decimal('tax_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  discountAmount: decimal('discount_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  totalAmount: decimal('total_amount', { precision: 18, scale: 4 }).notNull(),
  baseTotalAmount: decimal('base_total_amount', { precision: 18, scale: 4 }).notNull(),
  memo: text('memo'),
  externalReference: text('external_reference'), // PO number, invoice number, etc.
  status: text('status').notNull(), // 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'PAID', 'CLOSED', 'CANCELLED'
  workflowStatus: text('workflow_status'), // Current approval status
  shipDate: date('ship_date'),
  shippedVia: text('shipped_via'),
  trackingNumber: text('tracking_number'),
  billingAddressId: uuid('billing_address_id'),
  shippingAddressId: uuid('shipping_address_id'),
  salesRepId: uuid('sales_rep_id'),
  departmentId: uuid('department_id'),
  classId: uuid('class_id'),
  locationId: uuid('location_id'),
  projectId: uuid('project_id'), // Future: references projects table
  
  // Opportunity/Estimate specific fields
  salesStage: text('sales_stage'), // 'LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'
  probability: decimal('probability', { precision: 5, scale: 2 }), // Win probability percentage
  expectedCloseDate: date('expected_close_date'),
  leadSource: text('lead_source'),
  competitor: text('competitor'),
  estimateValidUntil: date('estimate_valid_until'),
  
  // Project tracking
  estimatedHours: decimal('estimated_hours', { precision: 10, scale: 2 }),
  markupPercent: decimal('markup_percent', { precision: 5, scale: 2 }),
  marginPercent: decimal('margin_percent', { precision: 5, scale: 2 }),
  
  // Relationships
  parentTransactionId: uuid('parent_transaction_id').references(() => businessTransactions.id),
  rootTransactionId: uuid('root_transaction_id').references(() => businessTransactions.id),
  glTransactionId: uuid('gl_transaction_id'), // Reference to glTransactions.id
  
  // Audit fields
  createdBy: uuid('created_by').references(() => users.id),
  createdDate: timestamp('created_date', { withTimezone: true }).defaultNow().notNull(),
  modifiedBy: uuid('modified_by').references(() => users.id),
  modifiedDate: timestamp('modified_date', { withTimezone: true }).defaultNow().notNull(),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedDate: timestamp('approved_date', { withTimezone: true }),
  postedDate: timestamp('posted_date', { withTimezone: true }),
  versionNumber: integer('version_number').default(1).notNull(),
}, (table) => ({
  transactionNumberIdx: uniqueIndex('idx_business_trans_number').on(table.transactionNumber),
  typeAndDateIdx: uniqueIndex('idx_business_trans_type_date').on(table.transactionTypeId, table.transactionDate),
  entityIdx: uniqueIndex('idx_business_trans_entity').on(table.entityId, table.entityType, table.status),
  subsidiaryIdx: uniqueIndex('idx_business_trans_subsidiary').on(table.subsidiaryId, table.transactionDate),
}));

export const businessTransactionsRelations = relations(businessTransactions, ({ one, many }) => ({
  transactionType: one(transactionTypes, {
    fields: [businessTransactions.transactionTypeId],
    references: [transactionTypes.id],
  }),
  subsidiary: one(subsidiaries, {
    fields: [businessTransactions.subsidiaryId],
    references: [subsidiaries.id],
  }),
  entity: one(entities, {
    fields: [businessTransactions.entityId],
    references: [entities.id],
  }),
  paymentTerms: one(paymentTerms, {
    fields: [businessTransactions.termsId],
    references: [paymentTerms.id],
  }),
  department: one(departments, {
    fields: [businessTransactions.departmentId],
    references: [departments.id],
  }),
  class: one(classes, {
    fields: [businessTransactions.classId],
    references: [classes.id],
  }),
  location: one(locations, {
    fields: [businessTransactions.locationId],
    references: [locations.id],
  }),
  billingAddress: one(addresses, {
    fields: [businessTransactions.billingAddressId],
    references: [addresses.id],
  }),
  shippingAddress: one(addresses, {
    fields: [businessTransactions.shippingAddressId],
    references: [addresses.id],
  }),
  parentTransaction: one(businessTransactions, {
    fields: [businessTransactions.parentTransactionId],
    references: [businessTransactions.id],
  }),
  // glTransaction relation defined in gl-transactions.ts to avoid circular dependency
  lines: many(businessTransactionLines),
  childTransactions: many(businessTransactions),
  parentRelationships: many(transactionRelationships, { relationName: 'parentTransaction' }),
  childRelationships: many(transactionRelationships, { relationName: 'childTransaction' }),
}));

export const businessTransactionLines = pgTable('business_transaction_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessTransactionId: uuid('business_transaction_id').notNull().references(() => businessTransactions.id, { onDelete: 'cascade' }),
  lineNumber: integer('line_number').notNull(),
  lineType: text('line_type').notNull(), // 'ITEM', 'SERVICE', 'DISCOUNT', 'TAX', 'SHIPPING'
  itemId: uuid('item_id').references(() => products.id),
  description: text('description').notNull(),
  quantity: decimal('quantity', { precision: 18, scale: 4 }).default('0').notNull(),
  unitOfMeasure: text('unit_of_measure'),
  unitPrice: decimal('unit_price', { precision: 18, scale: 4 }).default('0').notNull(),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }).default('0').notNull(),
  discountAmount: decimal('discount_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  lineAmount: decimal('line_amount', { precision: 18, scale: 4 }).notNull(),
  taxCodeId: uuid('tax_code_id').references(() => taxCodes.id),
  taxAmount: decimal('tax_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  totalLineAmount: decimal('total_line_amount', { precision: 18, scale: 4 }).notNull(),
  accountId: uuid('account_id').references(() => accounts.id),
  classId: uuid('class_id').references(() => classes.id),
  departmentId: uuid('department_id').references(() => departments.id),
  locationId: uuid('location_id').references(() => locations.id),
  projectId: uuid('project_id'),
  jobId: uuid('job_id'),
  activityCodeId: uuid('activity_code_id').references(() => activityCodes.id),
  
  // Service/Time tracking fields
  billableFlag: boolean('billable_flag').default(true).notNull(),
  billingRate: decimal('billing_rate', { precision: 18, scale: 4 }),
  hoursWorked: decimal('hours_worked', { precision: 10, scale: 2 }),
  employeeId: uuid('employee_id').references(() => entities.id),
  workDate: date('work_date'),
  
  // Fulfillment tracking
  parentLineId: uuid('parent_line_id').references(() => businessTransactionLines.id),
  quantityReceived: decimal('quantity_received', { precision: 18, scale: 4 }).default('0').notNull(),
  quantityBilled: decimal('quantity_billed', { precision: 18, scale: 4 }).default('0').notNull(),
  quantityShipped: decimal('quantity_shipped', { precision: 18, scale: 4 }).default('0').notNull(),
  
  // Costing
  costAmount: decimal('cost_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  marginAmount: decimal('margin_amount', { precision: 18, scale: 4 }),
  
  // Inventory tracking
  serialNumbers: jsonb('serial_numbers'), // JSON array of serial numbers
  lotNumbers: jsonb('lot_numbers'), // JSON array of lot numbers
  
  // Estimates
  estimatedHours: decimal('estimated_hours', { precision: 10, scale: 2 }),
  hourlyRate: decimal('hourly_rate', { precision: 18, scale: 4 }),
  costEstimate: decimal('cost_estimate', { precision: 18, scale: 4 }),
  
  notes: text('notes'),
  customFields: jsonb('custom_fields'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  transactionLineIdx: uniqueIndex('idx_trans_line_trans').on(table.businessTransactionId, table.lineNumber),
  itemIdx: uniqueIndex('idx_trans_line_item').on(table.itemId, table.businessTransactionId),
  accountIdx: uniqueIndex('idx_trans_line_account').on(table.accountId),
}));

export const businessTransactionLinesRelations = relations(businessTransactionLines, ({ one, many }) => ({
  businessTransaction: one(businessTransactions, {
    fields: [businessTransactionLines.businessTransactionId],
    references: [businessTransactions.id],
  }),
  item: one(products, {
    fields: [businessTransactionLines.itemId],
    references: [products.id],
  }),
  taxCode: one(taxCodes, {
    fields: [businessTransactionLines.taxCodeId],
    references: [taxCodes.id],
  }),
  account: one(accounts, {
    fields: [businessTransactionLines.accountId],
    references: [accounts.id],
  }),
  department: one(departments, {
    fields: [businessTransactionLines.departmentId],
    references: [departments.id],
  }),
  class: one(classes, {
    fields: [businessTransactionLines.classId],
    references: [classes.id],
  }),
  location: one(locations, {
    fields: [businessTransactionLines.locationId],
    references: [locations.id],
  }),
  activityCode: one(activityCodes, {
    fields: [businessTransactionLines.activityCodeId],
    references: [activityCodes.id],
  }),
  employee: one(entities, {
    fields: [businessTransactionLines.employeeId],
    references: [entities.id],
  }),
  parentLine: one(businessTransactionLines, {
    fields: [businessTransactionLines.parentLineId],
    references: [businessTransactionLines.id],
  }),
  childLines: many(businessTransactionLines),
  parentRelationships: many(transactionRelationships, { relationName: 'parentLine' }),
  childRelationships: many(transactionRelationships, { relationName: 'childLine' }),
}));

export const transactionRelationships = pgTable('transaction_relationships', {
  id: uuid('id').defaultRandom().primaryKey(),
  parentTransactionId: uuid('parent_transaction_id').notNull().references(() => businessTransactions.id),
  childTransactionId: uuid('child_transaction_id').notNull().references(() => businessTransactions.id),
  relationshipType: text('relationship_type').notNull(), // 'FULFILLMENT', 'PAYMENT', 'CREDIT', 'RETURN'
  appliedAmount: decimal('applied_amount', { precision: 18, scale: 4 }),
  parentLineId: uuid('parent_line_id').references(() => businessTransactionLines.id),
  childLineId: uuid('child_line_id').references(() => businessTransactionLines.id),
  createdDate: timestamp('created_date', { withTimezone: true }).defaultNow().notNull(),
  notes: text('notes'),
}, (table) => ({
  parentIdx: uniqueIndex('idx_trans_rel_parent').on(table.parentTransactionId),
  childIdx: uniqueIndex('idx_trans_rel_child').on(table.childTransactionId),
}));

export const transactionRelationshipsRelations = relations(transactionRelationships, ({ one }) => ({
  parentTransaction: one(businessTransactions, {
    fields: [transactionRelationships.parentTransactionId],
    references: [businessTransactions.id],
    relationName: 'parentTransaction',
  }),
  childTransaction: one(businessTransactions, {
    fields: [transactionRelationships.childTransactionId],
    references: [businessTransactions.id],
    relationName: 'childTransaction',
  }),
  parentLine: one(businessTransactionLines, {
    fields: [transactionRelationships.parentLineId],
    references: [businessTransactionLines.id],
    relationName: 'parentLine',
  }),
  childLine: one(businessTransactionLines, {
    fields: [transactionRelationships.childLineId],
    references: [businessTransactionLines.id],
    relationName: 'childLine',
  }),
}));

export const paymentTerms = pgTable('payment_terms', {
  id: uuid('id').defaultRandom().primaryKey(),
  subsidiaryId: uuid('subsidiary_id'), // Optional: null means global
  termsCode: text('terms_code').notNull(),
  termsName: text('terms_name').notNull(),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }).default('0').notNull(),
  discountDays: integer('discount_days').default(0).notNull(),
  netDays: integer('net_days').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  subTermsIdx: uniqueIndex('idx_payment_terms_sub_code').on(table.subsidiaryId, table.termsCode),
}));

export const paymentTermsRelations = relations(paymentTerms, ({ many }) => ({
  businessTransactions: many(businessTransactions),
}));

// Import references (these would come from existing schema files)
import { subsidiaries } from './subsidiaries';
import { entities } from './entities';
import { addresses } from './addresses';
import { users } from './users';
import { departments } from './departments';
import { classes } from './classes';
import { locations } from './locations';
import { products } from './products';
import { accounts } from './accounts';
import { taxCodes } from './tax-codes';
import { activityCodes } from './activity-codes';
// glTransactions and glPostingRules imported in gl-transactions.ts to avoid circular dependency