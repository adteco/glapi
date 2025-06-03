import { pgTable, uuid, text, timestamp, unique, varchar, numeric, boolean, foreignKey, jsonb, uniqueIndex, integer, index, date, type AnyPgColumn, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const accountCategoryEnum = pgEnum("account_category_enum", ['Asset', 'Liability', 'Equity', 'Revenue', 'COGS', 'Expense'])
export const allocationMethod = pgEnum("allocation_method", ['proportional', 'residual', 'specific_evidence'])
export const confidenceLevel = pgEnum("confidence_level", ['high', 'medium', 'low'])
export const contractStatus = pgEnum("contract_status", ['draft', 'signed', 'active', 'completed', 'terminated'])
export const costEstimateTypeEnum = pgEnum("cost_estimate_type_enum", ['Estimated', 'Actual', 'Derived', 'None'])
export const entityTypeEnum = pgEnum("entity_type_enum", ['Customer', 'Vendor', 'Employee', 'Partner', 'Lead', 'Prospect', 'Contact'])
export const entryType = pgEnum("entry_type", ['revenue_recognition', 'contract_asset', 'deferred_revenue', 'refund_liability'])
export const evidenceType = pgEnum("evidence_type", ['customer_pricing', 'comparable_sales', 'market_research', 'cost_plus'])
export const jobStatusEnum = pgEnum("job_status_enum", ['Planning', 'InProgress', 'OnHold', 'Completed', 'Billed', 'Cancelled'])
export const obligationType = pgEnum("obligation_type", ['single_point', 'over_time', 'series'])
export const patternType = pgEnum("pattern_type", ['straight_line', 'proportional', 'milestone', 'custom'])
export const performanceObligationStatusEnum = pgEnum("performance_obligation_status_enum", ['Pending', 'InProcess', 'Fulfilled', 'PartiallyFulfilled', 'Cancelled'])
export const productType = pgEnum("product_type", ['software_license', 'saas_subscription', 'professional_services', 'support'])
export const recognitionSource = pgEnum("recognition_source", ['automatic', 'manual_adjustment', 'milestone_achievement'])
export const recognitionType = pgEnum("recognition_type", ['point_in_time', 'over_time', 'hybrid'])
export const satisfactionMethod = pgEnum("satisfaction_method", ['input_method', 'output_method', 'time_based'])
export const sspAllocationMethod = pgEnum("ssp_allocation_method", ['observable_evidence', 'residual', 'proportional'])
export const sspSource = pgEnum("ssp_source", ['internal_analysis', 'third_party_pricing', 'observable_evidence'])
export const timeEntryBilledStatusEnum = pgEnum("time_entry_billed_status_enum", ['NotBilled', 'Billed', 'NonBillable'])


export const addresses = pgTable("addresses", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	organizationId: text("organization_id").notNull(),
	addressee: text(),
	companyName: text("company_name"),
	attention: text(),
	phoneNumber: text("phone_number"),
	line1: text(),
	line2: text(),
	city: text(),
	stateProvince: text("state_province"),
	postalCode: text("postal_code"),
	countryCode: text("country_code"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const taxCodes = pgTable("tax_codes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	description: varchar({ length: 255 }),
	rate: numeric({ precision: 8, scale:  4 }).default('0').notNull(),
	isCompound: boolean("is_compound").default(false),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("tax_codes_name_unique").on(table.name),
]);

export const unitsOfMeasure = pgTable("units_of_measure", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	abbreviation: varchar({ length: 10 }),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("units_of_measure_name_unique").on(table.name),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	stytchUserId: varchar("stytch_user_id", { length: 100 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	firstName: varchar("first_name", { length: 100 }),
	lastName: varchar("last_name", { length: 100 }),
	organizationId: uuid("organization_id").notNull(),
	role: varchar({ length: 50 }).default('user').notNull(),
	settings: jsonb(),
	isActive: boolean("is_active").default(true),
	lastLogin: timestamp("last_login", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "users_organization_id_organizations_id_fk"
		}),
	unique("users_stytch_user_id_unique").on(table.stytchUserId),
]);

export const classes = pgTable("classes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	subsidiaryId: uuid("subsidiary_id"),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	code: text(),
	description: text(),
	organizationId: text("organization_id").notNull(),
});

export const departments = pgTable("departments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	subsidiaryId: uuid("subsidiary_id"),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	code: text(),
	description: text(),
	organizationId: text("organization_id").notNull(),
});

export const locations = pgTable("locations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	subsidiaryId: uuid("subsidiary_id"),
	addressLine1: text("address_line_1"),
	addressLine2: text("address_line_2"),
	city: text(),
	stateProvince: text("state_province"),
	postalCode: text("postal_code"),
	countryCode: text("country_code"),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	code: text(),
	description: text(),
	organizationId: text("organization_id").notNull(),
});

export const accounts = pgTable("accounts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	organizationId: text("organization_id").notNull(),
	accountNumber: text("account_number").notNull(),
	accountName: text("account_name").notNull(),
	accountCategory: accountCategoryEnum("account_category").notNull(),
	description: text(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("accounts_organization_id_account_number_idx").using("btree", table.organizationId.asc().nullsLast().op("text_ops"), table.accountNumber.asc().nullsLast().op("text_ops")),
]);

export const subsidiaries = pgTable("subsidiaries", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	parentId: uuid("parent_id"),
	baseCurrencyId: uuid("base_currency_id"),
	countryCode: text("country_code"),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	code: text(),
	description: text(),
	organizationId: text("organization_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
			name: "subsidiaries_parent_id_subsidiaries_id_fk"
		}),
]);

export const currencies = pgTable("currencies", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	code: varchar({ length: 3 }).notNull(),
	symbol: varchar({ length: 5 }).notNull(),
	name: varchar({ length: 50 }).notNull(),
	decimalPlaces: integer("decimal_places").default(2).notNull(),
}, (table) => [
	unique("currencies_code_unique").on(table.code),
]);

export const organizations = pgTable("organizations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	stytchOrgId: varchar("stytch_org_id", { length: 100 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	slug: varchar({ length: 100 }).notNull(),
	settings: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("organizations_stytch_org_id_unique").on(table.stytchOrgId),
	unique("organizations_slug_unique").on(table.slug),
]);

export const activityCodes = pgTable("activity_codes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	code: varchar({ length: 50 }),
	description: text(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("activity_codes_code_unique").on(table.code),
]);

export const entities = pgTable("entities", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	organizationId: text("organization_id").notNull(),
	name: text().notNull(),
	displayName: text("display_name"),
	code: text(),
	entityTypes: text("entity_types").array().notNull(),
	email: text(),
	phone: text(),
	website: text(),
	parentEntityId: uuid("parent_entity_id"),
	primaryContactId: uuid("primary_contact_id"),
	taxId: text("tax_id"),
	description: text(),
	notes: text(),
	customFields: jsonb("custom_fields"),
	metadata: jsonb(),
	status: text().default('active').notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	addressId: uuid("address_id"),
}, (table) => [
	index("entities_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("entities_org_id_idx").using("btree", table.organizationId.asc().nullsLast().op("text_ops")),
	index("entities_parent_idx").using("btree", table.parentEntityId.asc().nullsLast().op("uuid_ops")),
	index("entities_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops"), table.isActive.asc().nullsLast().op("text_ops")),
	index("entities_types_idx").using("btree", table.entityTypes.asc().nullsLast().op("array_ops")),
	foreignKey({
			columns: [table.addressId],
			foreignColumns: [addresses.id],
			name: "entities_address_id_addresses_id_fk"
		}),
	foreignKey({
			columns: [table.parentEntityId],
			foreignColumns: [table.id],
			name: "entities_parent_entity_id_entities_id_fk"
		}),
	foreignKey({
			columns: [table.primaryContactId],
			foreignColumns: [table.id],
			name: "entities_primary_contact_id_entities_id_fk"
		}),
	unique("entities_org_code_unique").on(table.organizationId, table.code),
]);

export const products = pgTable("products", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	productCode: varchar("product_code", { length: 100 }).notNull(),
	productName: varchar("product_name", { length: 255 }).notNull(),
	productType: productType("product_type").notNull(),
	defaultSsp: numeric("default_ssp", { precision: 12, scale:  2 }),
	sspSource: sspSource("ssp_source").default('internal_analysis'),
	recognitionType: recognitionType("recognition_type").notNull(),
	defaultRecognitionPatternId: uuid("default_recognition_pattern_id"),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.defaultRecognitionPatternId],
			foreignColumns: [revenueRecognitionPatterns.id],
			name: "products_default_recognition_pattern_id_revenue_recognition_pat"
		}),
	unique("products_product_code_unique").on(table.productCode),
]);

export const revenueRecognitionPatterns = pgTable("revenue_recognition_patterns", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	patternName: varchar("pattern_name", { length: 255 }).notNull(),
	patternType: patternType("pattern_type").notNull(),
	patternConfig: jsonb("pattern_config"),
	isDefault: boolean("is_default").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const contractSspAllocations = pgTable("contract_ssp_allocations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	contractId: uuid("contract_id").notNull(),
	lineItemId: uuid("line_item_id").notNull(),
	allocatedAmount: numeric("allocated_amount", { precision: 12, scale:  2 }).notNull(),
	allocationMethod: allocationMethod("allocation_method").notNull(),
	allocationPercentage: numeric("allocation_percentage", { precision: 5, scale:  2 }),
	allocationDate: timestamp("allocation_date", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by"),
}, (table) => [
	foreignKey({
			columns: [table.contractId],
			foreignColumns: [contracts.id],
			name: "contract_ssp_allocations_contract_id_contracts_id_fk"
		}),
	foreignKey({
			columns: [table.lineItemId],
			foreignColumns: [contractLineItems.id],
			name: "contract_ssp_allocations_line_item_id_contract_line_items_id_fk"
		}),
]);

export const revenueJournalEntries = pgTable("revenue_journal_entries", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	entryDate: date("entry_date").notNull(),
	contractId: uuid("contract_id").notNull(),
	performanceObligationId: uuid("performance_obligation_id"),
	debitAccount: varchar("debit_account", { length: 100 }).notNull(),
	creditAccount: varchar("credit_account", { length: 100 }).notNull(),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	entryType: entryType("entry_type").notNull(),
	description: text(),
	isPosted: boolean("is_posted").default(false),
	postedAt: timestamp("posted_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.contractId],
			foreignColumns: [contracts.id],
			name: "revenue_journal_entries_contract_id_contracts_id_fk"
		}),
	foreignKey({
			columns: [table.performanceObligationId],
			foreignColumns: [performanceObligations.id],
			name: "revenue_journal_entries_performance_obligation_id_performance_o"
		}),
]);

export const revenueSchedules = pgTable("revenue_schedules", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	performanceObligationId: uuid("performance_obligation_id").notNull(),
	scheduleDate: date("schedule_date").notNull(),
	scheduledAmount: numeric("scheduled_amount", { precision: 12, scale:  2 }).notNull(),
	recognizedAmount: numeric("recognized_amount", { precision: 12, scale:  2 }).default('0'),
	recognitionSource: recognitionSource("recognition_source"),
	recognitionDate: date("recognition_date"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.performanceObligationId],
			foreignColumns: [performanceObligations.id],
			name: "revenue_schedules_performance_obligation_id_performance_obligat"
		}),
]);

export const transactionLines = pgTable("transaction_lines", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	transactionId: uuid("transaction_id").notNull(),
	lineNumber: integer("line_number").notNull(),
	itemId: uuid("item_id").notNull(),
	quantity: numeric({ precision: 12, scale:  4 }).notNull(),
	unitsId: uuid("units_id"),
	rate: numeric({ precision: 14, scale:  4 }).notNull(),
	amount: numeric({ precision: 14, scale:  2 }).notNull(),
	description: text(),
	departmentId: uuid("department_id"),
	classId: uuid("class_id"),
	locationId: uuid("location_id"),
	activityCodeId: uuid("activity_code_id"),
	unitCost: numeric("unit_cost", { precision: 14, scale:  4 }),
	costEstimateType: costEstimateTypeEnum("cost_estimate_type"),
	ssp: numeric({ precision: 14, scale:  2 }),
	allocatedTransactionPrice: numeric("allocated_transaction_price", { precision: 14, scale:  2 }),
	performanceObligationId: uuid("performance_obligation_id"),
	isTaxable: boolean("is_taxable").default(true),
	taxCodeId: uuid("tax_code_id"),
	taxAmount: numeric("tax_amount", { precision: 12, scale:  2 }).default('0'),
	discountAmount: numeric("discount_amount", { precision: 12, scale:  2 }).default('0'),
	grossAmount: numeric("gross_amount", { precision: 14, scale:  2 }).default('0').notNull(),
	linkedOrderLineId: uuid("linked_order_line_id"),
	customFields: jsonb("custom_fields"),
}, (table) => [
	foreignKey({
			columns: [table.activityCodeId],
			foreignColumns: [activityCodes.id],
			name: "transaction_lines_activity_code_id_activity_codes_id_fk"
		}),
	foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "transaction_lines_class_id_classes_id_fk"
		}),
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "transaction_lines_department_id_departments_id_fk"
		}),
	foreignKey({
			columns: [table.itemId],
			foreignColumns: [products.id],
			name: "transaction_lines_item_id_products_id_fk"
		}),
	foreignKey({
			columns: [table.linkedOrderLineId],
			foreignColumns: [table.id],
			name: "transaction_lines_linked_order_line_id_transaction_lines_id_fk"
		}),
	foreignKey({
			columns: [table.locationId],
			foreignColumns: [locations.id],
			name: "transaction_lines_location_id_locations_id_fk"
		}),
	foreignKey({
			columns: [table.performanceObligationId],
			foreignColumns: [performanceObligations.id],
			name: "transaction_lines_performance_obligation_id_performance_obligat"
		}),
	foreignKey({
			columns: [table.taxCodeId],
			foreignColumns: [taxCodes.id],
			name: "transaction_lines_tax_code_id_tax_codes_id_fk"
		}),
	foreignKey({
			columns: [table.unitsId],
			foreignColumns: [unitsOfMeasure.id],
			name: "transaction_lines_units_id_units_of_measure_id_fk"
		}),
]);

export const contracts = pgTable("contracts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	contractNumber: varchar("contract_number", { length: 100 }).notNull(),
	entityId: uuid("entity_id").notNull(),
	contractDate: date("contract_date").notNull(),
	effectiveDate: date("effective_date").notNull(),
	contractValue: numeric("contract_value", { precision: 12, scale:  2 }).notNull(),
	contractStatus: contractStatus("contract_status").notNull(),
	sspAllocationMethod: sspAllocationMethod("ssp_allocation_method").default('proportional'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.entityId],
			foreignColumns: [entities.id],
			name: "contracts_entity_id_entities_id_fk"
		}),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "contracts_organization_id_organizations_id_fk"
		}),
]);

export const performanceObligations = pgTable("performance_obligations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	contractLineItemId: uuid("contract_line_item_id").notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	ssp: numeric({ precision: 14, scale:  2 }).notNull(),
	allocatedTransactionPrice: numeric("allocated_transaction_price", { precision: 14, scale:  2 }),
	revenueRecognized: numeric("revenue_recognized", { precision: 14, scale:  2 }).default('0'),
	status: performanceObligationStatusEnum().default('Pending'),
	fulfillmentDate: timestamp("fulfillment_date", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.contractLineItemId],
			foreignColumns: [contractLineItems.id],
			name: "performance_obligations_contract_line_item_id_contract_line_ite"
		}),
]);

export const sspEvidence = pgTable("ssp_evidence", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	productId: uuid("product_id").notNull(),
	evidenceType: evidenceType("evidence_type").notNull(),
	evidenceDate: date("evidence_date").notNull(),
	sspAmount: numeric("ssp_amount", { precision: 12, scale:  2 }).notNull(),
	confidenceLevel: confidenceLevel("confidence_level").notNull(),
	notes: text(),
	createdBy: uuid("created_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "ssp_evidence_product_id_products_id_fk"
		}),
]);

export const contractLineItems = pgTable("contract_line_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	contractId: uuid("contract_id").notNull(),
	productId: uuid("product_id").notNull(),
	lineItemNumber: integer("line_item_number").notNull(),
	description: text(),
	quantity: numeric({ precision: 10, scale:  2 }).default('1').notNull(),
	listPrice: numeric("list_price", { precision: 12, scale:  2 }).notNull(),
	discountPercent: numeric("discount_percent", { precision: 5, scale:  2 }).default('0'),
	totalPrice: numeric("total_price", { precision: 12, scale:  2 }).notNull(),
	ssp: numeric({ precision: 12, scale:  2 }),
	allocatedTransactionPrice: numeric("allocated_transaction_price", { precision: 12, scale:  2 }),
	performanceObligationId: uuid("performance_obligation_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.contractId],
			foreignColumns: [contracts.id],
			name: "contract_line_items_contract_id_contracts_id_fk"
		}),
	foreignKey({
			columns: [table.performanceObligationId],
			foreignColumns: [performanceObligations.id],
			name: "contract_line_items_performance_obligation_id_performance_oblig"
		}),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "contract_line_items_product_id_products_id_fk"
		}),
]);
