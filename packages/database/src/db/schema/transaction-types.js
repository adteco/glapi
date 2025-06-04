"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentTermsRelations = exports.paymentTerms = exports.transactionRelationshipsRelations = exports.transactionRelationships = exports.businessTransactionLinesRelations = exports.businessTransactionLines = exports.businessTransactionsRelations = exports.businessTransactions = exports.transactionTypesRelations = exports.transactionTypes = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
exports.transactionTypes = (0, pg_core_1.pgTable)('transaction_types', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    typeCode: (0, pg_core_1.text)('type_code').notNull().unique(),
    typeName: (0, pg_core_1.text)('type_name').notNull(),
    typeCategory: (0, pg_core_1.text)('type_category'), // 'SALES', 'PURCHASE', 'INVENTORY', 'GL', 'PROJECT'
    generatesGl: (0, pg_core_1.boolean)('generates_gl').default(true).notNull(),
    requiresApproval: (0, pg_core_1.boolean)('requires_approval').default(false).notNull(),
    canBeReversed: (0, pg_core_1.boolean)('can_be_reversed').default(true).notNull(),
    numberingSequence: (0, pg_core_1.text)('numbering_sequence'), // 'SO-{YYYY}-{####}'
    defaultGlAccountId: (0, pg_core_1.uuid)('default_gl_account_id'),
    workflowTemplate: (0, pg_core_1.jsonb)('workflow_template'), // Defines approval workflow
    isActive: (0, pg_core_1.boolean)('is_active').default(true).notNull(),
    sortOrder: (0, pg_core_1.integer)('sort_order').default(0).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
    typeCodeIdx: (0, pg_core_1.uniqueIndex)('idx_transaction_types_code').on(table.typeCode),
}));
exports.transactionTypesRelations = (0, drizzle_orm_1.relations)(exports.transactionTypes, ({ many }) => ({
    businessTransactions: many(exports.businessTransactions),
    // postingRules relation defined in gl-transactions.ts to avoid circular dependency
}));
exports.businessTransactions = (0, pg_core_1.pgTable)('business_transactions', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    transactionNumber: (0, pg_core_1.text)('transaction_number').notNull().unique(),
    transactionTypeId: (0, pg_core_1.uuid)('transaction_type_id').notNull().references(() => exports.transactionTypes.id),
    subsidiaryId: (0, pg_core_1.uuid)('subsidiary_id').notNull(),
    entityId: (0, pg_core_1.uuid)('entity_id'), // Customer/Vendor ID (polymorphic)
    entityType: (0, pg_core_1.text)('entity_type'), // 'CUSTOMER', 'VENDOR', 'EMPLOYEE'
    transactionDate: (0, pg_core_1.date)('transaction_date').notNull(),
    dueDate: (0, pg_core_1.date)('due_date'),
    termsId: (0, pg_core_1.uuid)('terms_id').references(() => exports.paymentTerms.id),
    currencyCode: (0, pg_core_1.text)('currency_code').notNull(),
    exchangeRate: (0, pg_core_1.decimal)('exchange_rate', { precision: 12, scale: 6 }).default('1').notNull(),
    subtotalAmount: (0, pg_core_1.decimal)('subtotal_amount', { precision: 18, scale: 4 }).default('0').notNull(),
    taxAmount: (0, pg_core_1.decimal)('tax_amount', { precision: 18, scale: 4 }).default('0').notNull(),
    discountAmount: (0, pg_core_1.decimal)('discount_amount', { precision: 18, scale: 4 }).default('0').notNull(),
    totalAmount: (0, pg_core_1.decimal)('total_amount', { precision: 18, scale: 4 }).notNull(),
    baseTotalAmount: (0, pg_core_1.decimal)('base_total_amount', { precision: 18, scale: 4 }).notNull(),
    memo: (0, pg_core_1.text)('memo'),
    externalReference: (0, pg_core_1.text)('external_reference'), // PO number, invoice number, etc.
    status: (0, pg_core_1.text)('status').notNull(), // 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'PAID', 'CLOSED', 'CANCELLED'
    workflowStatus: (0, pg_core_1.text)('workflow_status'), // Current approval status
    shipDate: (0, pg_core_1.date)('ship_date'),
    shippedVia: (0, pg_core_1.text)('shipped_via'),
    trackingNumber: (0, pg_core_1.text)('tracking_number'),
    billingAddressId: (0, pg_core_1.uuid)('billing_address_id'),
    shippingAddressId: (0, pg_core_1.uuid)('shipping_address_id'),
    salesRepId: (0, pg_core_1.uuid)('sales_rep_id'),
    departmentId: (0, pg_core_1.uuid)('department_id'),
    classId: (0, pg_core_1.uuid)('class_id'),
    locationId: (0, pg_core_1.uuid)('location_id'),
    projectId: (0, pg_core_1.uuid)('project_id'), // Future: references projects table
    // Opportunity/Estimate specific fields
    salesStage: (0, pg_core_1.text)('sales_stage'), // 'LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'
    probability: (0, pg_core_1.decimal)('probability', { precision: 5, scale: 2 }), // Win probability percentage
    expectedCloseDate: (0, pg_core_1.date)('expected_close_date'),
    leadSource: (0, pg_core_1.text)('lead_source'),
    competitor: (0, pg_core_1.text)('competitor'),
    estimateValidUntil: (0, pg_core_1.date)('estimate_valid_until'),
    // Project tracking
    estimatedHours: (0, pg_core_1.decimal)('estimated_hours', { precision: 10, scale: 2 }),
    markupPercent: (0, pg_core_1.decimal)('markup_percent', { precision: 5, scale: 2 }),
    marginPercent: (0, pg_core_1.decimal)('margin_percent', { precision: 5, scale: 2 }),
    // Relationships
    parentTransactionId: (0, pg_core_1.uuid)('parent_transaction_id').references(() => exports.businessTransactions.id),
    rootTransactionId: (0, pg_core_1.uuid)('root_transaction_id').references(() => exports.businessTransactions.id),
    glTransactionId: (0, pg_core_1.uuid)('gl_transaction_id'), // Reference to glTransactions.id
    // Audit fields
    createdBy: (0, pg_core_1.uuid)('created_by').references(() => users_1.users.id),
    createdDate: (0, pg_core_1.timestamp)('created_date', { withTimezone: true }).defaultNow().notNull(),
    modifiedBy: (0, pg_core_1.uuid)('modified_by').references(() => users_1.users.id),
    modifiedDate: (0, pg_core_1.timestamp)('modified_date', { withTimezone: true }).defaultNow().notNull(),
    approvedBy: (0, pg_core_1.uuid)('approved_by').references(() => users_1.users.id),
    approvedDate: (0, pg_core_1.timestamp)('approved_date', { withTimezone: true }),
    postedDate: (0, pg_core_1.timestamp)('posted_date', { withTimezone: true }),
    versionNumber: (0, pg_core_1.integer)('version_number').default(1).notNull(),
}, (table) => ({
    transactionNumberIdx: (0, pg_core_1.uniqueIndex)('idx_business_trans_number').on(table.transactionNumber),
    typeAndDateIdx: (0, pg_core_1.uniqueIndex)('idx_business_trans_type_date').on(table.transactionTypeId, table.transactionDate),
    entityIdx: (0, pg_core_1.uniqueIndex)('idx_business_trans_entity').on(table.entityId, table.entityType, table.status),
    subsidiaryIdx: (0, pg_core_1.uniqueIndex)('idx_business_trans_subsidiary').on(table.subsidiaryId, table.transactionDate),
}));
exports.businessTransactionsRelations = (0, drizzle_orm_1.relations)(exports.businessTransactions, ({ one, many }) => ({
    transactionType: one(exports.transactionTypes, {
        fields: [exports.businessTransactions.transactionTypeId],
        references: [exports.transactionTypes.id],
    }),
    subsidiary: one(subsidiaries_1.subsidiaries, {
        fields: [exports.businessTransactions.subsidiaryId],
        references: [subsidiaries_1.subsidiaries.id],
    }),
    entity: one(entities_1.entities, {
        fields: [exports.businessTransactions.entityId],
        references: [entities_1.entities.id],
    }),
    paymentTerms: one(exports.paymentTerms, {
        fields: [exports.businessTransactions.termsId],
        references: [exports.paymentTerms.id],
    }),
    department: one(departments_1.departments, {
        fields: [exports.businessTransactions.departmentId],
        references: [departments_1.departments.id],
    }),
    class: one(classes_1.classes, {
        fields: [exports.businessTransactions.classId],
        references: [classes_1.classes.id],
    }),
    location: one(locations_1.locations, {
        fields: [exports.businessTransactions.locationId],
        references: [locations_1.locations.id],
    }),
    billingAddress: one(addresses_1.addresses, {
        fields: [exports.businessTransactions.billingAddressId],
        references: [addresses_1.addresses.id],
    }),
    shippingAddress: one(addresses_1.addresses, {
        fields: [exports.businessTransactions.shippingAddressId],
        references: [addresses_1.addresses.id],
    }),
    parentTransaction: one(exports.businessTransactions, {
        fields: [exports.businessTransactions.parentTransactionId],
        references: [exports.businessTransactions.id],
    }),
    // glTransaction relation defined in gl-transactions.ts to avoid circular dependency
    lines: many(exports.businessTransactionLines),
    childTransactions: many(exports.businessTransactions),
    parentRelationships: many(exports.transactionRelationships, { relationName: 'parentTransaction' }),
    childRelationships: many(exports.transactionRelationships, { relationName: 'childTransaction' }),
}));
exports.businessTransactionLines = (0, pg_core_1.pgTable)('business_transaction_lines', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    businessTransactionId: (0, pg_core_1.uuid)('business_transaction_id').notNull().references(() => exports.businessTransactions.id, { onDelete: 'cascade' }),
    lineNumber: (0, pg_core_1.integer)('line_number').notNull(),
    lineType: (0, pg_core_1.text)('line_type').notNull(), // 'ITEM', 'SERVICE', 'DISCOUNT', 'TAX', 'SHIPPING'
    itemId: (0, pg_core_1.uuid)('item_id').references(() => products_1.products.id),
    description: (0, pg_core_1.text)('description').notNull(),
    quantity: (0, pg_core_1.decimal)('quantity', { precision: 18, scale: 4 }).default('0').notNull(),
    unitOfMeasure: (0, pg_core_1.text)('unit_of_measure'),
    unitPrice: (0, pg_core_1.decimal)('unit_price', { precision: 18, scale: 4 }).default('0').notNull(),
    discountPercent: (0, pg_core_1.decimal)('discount_percent', { precision: 5, scale: 2 }).default('0').notNull(),
    discountAmount: (0, pg_core_1.decimal)('discount_amount', { precision: 18, scale: 4 }).default('0').notNull(),
    lineAmount: (0, pg_core_1.decimal)('line_amount', { precision: 18, scale: 4 }).notNull(),
    taxCodeId: (0, pg_core_1.uuid)('tax_code_id').references(() => tax_codes_1.taxCodes.id),
    taxAmount: (0, pg_core_1.decimal)('tax_amount', { precision: 18, scale: 4 }).default('0').notNull(),
    totalLineAmount: (0, pg_core_1.decimal)('total_line_amount', { precision: 18, scale: 4 }).notNull(),
    accountId: (0, pg_core_1.uuid)('account_id').references(() => accounts_1.accounts.id),
    classId: (0, pg_core_1.uuid)('class_id').references(() => classes_1.classes.id),
    departmentId: (0, pg_core_1.uuid)('department_id').references(() => departments_1.departments.id),
    locationId: (0, pg_core_1.uuid)('location_id').references(() => locations_1.locations.id),
    projectId: (0, pg_core_1.uuid)('project_id'),
    jobId: (0, pg_core_1.uuid)('job_id'),
    activityCodeId: (0, pg_core_1.uuid)('activity_code_id').references(() => activity_codes_1.activityCodes.id),
    // Service/Time tracking fields
    billableFlag: (0, pg_core_1.boolean)('billable_flag').default(true).notNull(),
    billingRate: (0, pg_core_1.decimal)('billing_rate', { precision: 18, scale: 4 }),
    hoursWorked: (0, pg_core_1.decimal)('hours_worked', { precision: 10, scale: 2 }),
    employeeId: (0, pg_core_1.uuid)('employee_id').references(() => entities_1.entities.id),
    workDate: (0, pg_core_1.date)('work_date'),
    // Fulfillment tracking
    parentLineId: (0, pg_core_1.uuid)('parent_line_id').references(() => exports.businessTransactionLines.id),
    quantityReceived: (0, pg_core_1.decimal)('quantity_received', { precision: 18, scale: 4 }).default('0').notNull(),
    quantityBilled: (0, pg_core_1.decimal)('quantity_billed', { precision: 18, scale: 4 }).default('0').notNull(),
    quantityShipped: (0, pg_core_1.decimal)('quantity_shipped', { precision: 18, scale: 4 }).default('0').notNull(),
    // Costing
    costAmount: (0, pg_core_1.decimal)('cost_amount', { precision: 18, scale: 4 }).default('0').notNull(),
    marginAmount: (0, pg_core_1.decimal)('margin_amount', { precision: 18, scale: 4 }),
    // Inventory tracking
    serialNumbers: (0, pg_core_1.jsonb)('serial_numbers'), // JSON array of serial numbers
    lotNumbers: (0, pg_core_1.jsonb)('lot_numbers'), // JSON array of lot numbers
    // Estimates
    estimatedHours: (0, pg_core_1.decimal)('estimated_hours', { precision: 10, scale: 2 }),
    hourlyRate: (0, pg_core_1.decimal)('hourly_rate', { precision: 18, scale: 4 }),
    costEstimate: (0, pg_core_1.decimal)('cost_estimate', { precision: 18, scale: 4 }),
    notes: (0, pg_core_1.text)('notes'),
    customFields: (0, pg_core_1.jsonb)('custom_fields'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
    transactionLineIdx: (0, pg_core_1.uniqueIndex)('idx_trans_line_trans').on(table.businessTransactionId, table.lineNumber),
    itemIdx: (0, pg_core_1.uniqueIndex)('idx_trans_line_item').on(table.itemId, table.businessTransactionId),
    accountIdx: (0, pg_core_1.uniqueIndex)('idx_trans_line_account').on(table.accountId),
}));
exports.businessTransactionLinesRelations = (0, drizzle_orm_1.relations)(exports.businessTransactionLines, ({ one, many }) => ({
    businessTransaction: one(exports.businessTransactions, {
        fields: [exports.businessTransactionLines.businessTransactionId],
        references: [exports.businessTransactions.id],
    }),
    item: one(products_1.products, {
        fields: [exports.businessTransactionLines.itemId],
        references: [products_1.products.id],
    }),
    taxCode: one(tax_codes_1.taxCodes, {
        fields: [exports.businessTransactionLines.taxCodeId],
        references: [tax_codes_1.taxCodes.id],
    }),
    account: one(accounts_1.accounts, {
        fields: [exports.businessTransactionLines.accountId],
        references: [accounts_1.accounts.id],
    }),
    department: one(departments_1.departments, {
        fields: [exports.businessTransactionLines.departmentId],
        references: [departments_1.departments.id],
    }),
    class: one(classes_1.classes, {
        fields: [exports.businessTransactionLines.classId],
        references: [classes_1.classes.id],
    }),
    location: one(locations_1.locations, {
        fields: [exports.businessTransactionLines.locationId],
        references: [locations_1.locations.id],
    }),
    activityCode: one(activity_codes_1.activityCodes, {
        fields: [exports.businessTransactionLines.activityCodeId],
        references: [activity_codes_1.activityCodes.id],
    }),
    employee: one(entities_1.entities, {
        fields: [exports.businessTransactionLines.employeeId],
        references: [entities_1.entities.id],
    }),
    parentLine: one(exports.businessTransactionLines, {
        fields: [exports.businessTransactionLines.parentLineId],
        references: [exports.businessTransactionLines.id],
    }),
    childLines: many(exports.businessTransactionLines),
    parentRelationships: many(exports.transactionRelationships, { relationName: 'parentLine' }),
    childRelationships: many(exports.transactionRelationships, { relationName: 'childLine' }),
}));
exports.transactionRelationships = (0, pg_core_1.pgTable)('transaction_relationships', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    parentTransactionId: (0, pg_core_1.uuid)('parent_transaction_id').notNull().references(() => exports.businessTransactions.id),
    childTransactionId: (0, pg_core_1.uuid)('child_transaction_id').notNull().references(() => exports.businessTransactions.id),
    relationshipType: (0, pg_core_1.text)('relationship_type').notNull(), // 'FULFILLMENT', 'PAYMENT', 'CREDIT', 'RETURN'
    appliedAmount: (0, pg_core_1.decimal)('applied_amount', { precision: 18, scale: 4 }),
    parentLineId: (0, pg_core_1.uuid)('parent_line_id').references(() => exports.businessTransactionLines.id),
    childLineId: (0, pg_core_1.uuid)('child_line_id').references(() => exports.businessTransactionLines.id),
    createdDate: (0, pg_core_1.timestamp)('created_date', { withTimezone: true }).defaultNow().notNull(),
    notes: (0, pg_core_1.text)('notes'),
}, (table) => ({
    parentIdx: (0, pg_core_1.uniqueIndex)('idx_trans_rel_parent').on(table.parentTransactionId),
    childIdx: (0, pg_core_1.uniqueIndex)('idx_trans_rel_child').on(table.childTransactionId),
}));
exports.transactionRelationshipsRelations = (0, drizzle_orm_1.relations)(exports.transactionRelationships, ({ one }) => ({
    parentTransaction: one(exports.businessTransactions, {
        fields: [exports.transactionRelationships.parentTransactionId],
        references: [exports.businessTransactions.id],
        relationName: 'parentTransaction',
    }),
    childTransaction: one(exports.businessTransactions, {
        fields: [exports.transactionRelationships.childTransactionId],
        references: [exports.businessTransactions.id],
        relationName: 'childTransaction',
    }),
    parentLine: one(exports.businessTransactionLines, {
        fields: [exports.transactionRelationships.parentLineId],
        references: [exports.businessTransactionLines.id],
        relationName: 'parentLine',
    }),
    childLine: one(exports.businessTransactionLines, {
        fields: [exports.transactionRelationships.childLineId],
        references: [exports.businessTransactionLines.id],
        relationName: 'childLine',
    }),
}));
exports.paymentTerms = (0, pg_core_1.pgTable)('payment_terms', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    subsidiaryId: (0, pg_core_1.uuid)('subsidiary_id'), // Optional: null means global
    termsCode: (0, pg_core_1.text)('terms_code').notNull(),
    termsName: (0, pg_core_1.text)('terms_name').notNull(),
    discountPercent: (0, pg_core_1.decimal)('discount_percent', { precision: 5, scale: 2 }).default('0').notNull(),
    discountDays: (0, pg_core_1.integer)('discount_days').default(0).notNull(),
    netDays: (0, pg_core_1.integer)('net_days').notNull(),
    isActive: (0, pg_core_1.boolean)('is_active').default(true).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
    subTermsIdx: (0, pg_core_1.uniqueIndex)('idx_payment_terms_sub_code').on(table.subsidiaryId, table.termsCode),
}));
exports.paymentTermsRelations = (0, drizzle_orm_1.relations)(exports.paymentTerms, ({ many }) => ({
    businessTransactions: many(exports.businessTransactions),
}));
// Import references (these would come from existing schema files)
const subsidiaries_1 = require("./subsidiaries");
const entities_1 = require("./entities");
const addresses_1 = require("./addresses");
const users_1 = require("./users");
const departments_1 = require("./departments");
const classes_1 = require("./classes");
const locations_1 = require("./locations");
const products_1 = require("./products");
const accounts_1 = require("./accounts");
const tax_codes_1 = require("./tax-codes");
const activity_codes_1 = require("./activity-codes");
// glTransactions and glPostingRules imported in gl-transactions.ts to avoid circular dependency
//# sourceMappingURL=transaction-types.js.map