import { pgTable, uniqueIndex, uuid, text, date, numeric, timestamp, foreignKey, integer, boolean, unique, varchar, jsonb, index, type AnyPgColumn, serial, inet, primaryKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const accountCategoryEnum = pgEnum("account_category_enum", ['Asset', 'Liability', 'Equity', 'Revenue', 'COGS', 'Expense'])
export const allocationMethod = pgEnum("allocation_method", ['proportional', 'residual', 'specific_evidence'])
export const confidenceLevel = pgEnum("confidence_level", ['high', 'medium', 'low'])
export const contractStatus = pgEnum("contract_status", ['draft', 'signed', 'active', 'completed', 'terminated'])
export const costEstimateTypeEnum = pgEnum("cost_estimate_type_enum", ['Estimated', 'Actual', 'Derived', 'None'])
export const entityTypeEnum = pgEnum("entity_type_enum", ['Customer', 'Vendor', 'Employee', 'Partner', 'Lead', 'Prospect', 'Contact'])
export const entryType = pgEnum("entry_type", ['revenue_recognition', 'contract_asset', 'deferred_revenue', 'refund_liability'])
export const evidenceType = pgEnum("evidence_type", ['customer_pricing', 'comparable_sales', 'market_research', 'cost_plus'])
export const itemType = pgEnum("item_type", ['INVENTORY_ITEM', 'NON_INVENTORY_ITEM', 'SERVICE', 'CHARGE', 'DISCOUNT', 'TAX', 'ASSEMBLY', 'KIT'])
export const jobStatusEnum = pgEnum("job_status_enum", ['Planning', 'InProgress', 'OnHold', 'Completed', 'Billed', 'Cancelled'])
export const lotStatus = pgEnum("lot_status", ['ACTIVE', 'EXPIRED', 'RECALLED'])
export const obligationType = pgEnum("obligation_type", ['single_point', 'over_time', 'series'])
export const patternType = pgEnum("pattern_type", ['straight_line', 'proportional', 'milestone', 'custom'])
export const performanceObligationStatusEnum = pgEnum("performance_obligation_status_enum", ['Pending', 'InProcess', 'Fulfilled', 'PartiallyFulfilled', 'Cancelled'])
export const productType = pgEnum("product_type", ['software_license', 'saas_subscription', 'professional_services', 'support'])
export const recognitionSource = pgEnum("recognition_source", ['automatic', 'manual_adjustment', 'milestone_achievement'])
export const recognitionType = pgEnum("recognition_type", ['point_in_time', 'over_time', 'hybrid'])
export const satisfactionMethod = pgEnum("satisfaction_method", ['input_method', 'output_method', 'time_based'])
export const serialStatus = pgEnum("serial_status", ['AVAILABLE', 'SOLD', 'IN_TRANSIT', 'RETURNED', 'DAMAGED', 'LOST'])
export const sspAllocationMethod = pgEnum("ssp_allocation_method", ['observable_evidence', 'residual', 'proportional'])
export const sspSource = pgEnum("ssp_source", ['internal_analysis', 'third_party_pricing', 'observable_evidence'])
export const timeEntryBilledStatusEnum = pgEnum("time_entry_billed_status_enum", ['NotBilled', 'Billed', 'NonBillable'])


export const exchangeRates = pgTable("exchange_rates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	fromCurrency: text("from_currency").notNull(),
	toCurrency: text("to_currency").notNull(),
	rateDate: date("rate_date").notNull(),
	rateType: text("rate_type").notNull(),
	exchangeRate: numeric("exchange_rate", { precision: 12, scale:  6 }).notNull(),
	createdDate: timestamp("created_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("idx_exchange_rates_currency_date").using("btree", table.fromCurrency.asc().nullsLast().op("date_ops"), table.toCurrency.asc().nullsLast().op("date_ops"), table.rateDate.asc().nullsLast().op("date_ops"), table.rateType.asc().nullsLast().op("date_ops")),
]);

export const accountingPeriods = pgTable("accounting_periods", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	subsidiaryId: uuid("subsidiary_id").notNull(),
	periodName: text("period_name").notNull(),
	fiscalYear: text("fiscal_year").notNull(),
	periodNumber: integer("period_number").notNull(),
	startDate: date("start_date").notNull(),
	endDate: date("end_date").notNull(),
	periodType: text("period_type").notNull(),
	status: text().notNull(),
	closedBy: uuid("closed_by"),
	closedDate: timestamp("closed_date", { withTimezone: true, mode: 'string' }),
	isAdjustmentPeriod: boolean("is_adjustment_period").default(false).notNull(),
	createdDate: timestamp("created_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("idx_periods_date_range").using("btree", table.startDate.asc().nullsLast().op("date_ops"), table.endDate.asc().nullsLast().op("date_ops")),
	uniqueIndex("idx_periods_status").using("btree", table.status.asc().nullsLast().op("date_ops"), table.startDate.asc().nullsLast().op("text_ops")),
	uniqueIndex("idx_periods_sub_year_period").using("btree", table.subsidiaryId.asc().nullsLast().op("uuid_ops"), table.fiscalYear.asc().nullsLast().op("uuid_ops"), table.periodNumber.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.closedBy],
			foreignColumns: [users.id],
			name: "accounting_periods_closed_by_users_id_fk"
		}),
]);

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

export const glPostingRules = pgTable("gl_posting_rules", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	transactionTypeId: uuid("transaction_type_id").notNull(),
	subsidiaryId: uuid("subsidiary_id"),
	ruleName: text("rule_name").notNull(),
	sequenceNumber: integer("sequence_number").default(10).notNull(),
	lineType: text("line_type"),
	conditionSql: text("condition_sql"),
	debitAccountId: uuid("debit_account_id"),
	creditAccountId: uuid("credit_account_id"),
	amountFormula: text("amount_formula"),
	descriptionTemplate: text("description_template"),
	isActive: boolean("is_active").default(true).notNull(),
	effectiveDate: date("effective_date").notNull(),
	expirationDate: date("expiration_date"),
	createdBy: uuid("created_by"),
	createdDate: timestamp("created_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	modifiedDate: timestamp("modified_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("idx_posting_rules_active").using("btree", table.isActive.asc().nullsLast().op("date_ops"), table.effectiveDate.asc().nullsLast().op("bool_ops")),
	uniqueIndex("idx_posting_rules_type_sub").using("btree", table.transactionTypeId.asc().nullsLast().op("uuid_ops"), table.subsidiaryId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "gl_posting_rules_created_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.transactionTypeId],
			foreignColumns: [transactionTypes.id],
			name: "gl_posting_rules_transaction_type_id_transaction_types_id_fk"
		}),
]);

export const glAccountBalances = pgTable("gl_account_balances", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	accountId: uuid("account_id").notNull(),
	subsidiaryId: uuid("subsidiary_id").notNull(),
	periodId: uuid("period_id").notNull(),
	classId: uuid("class_id"),
	departmentId: uuid("department_id"),
	locationId: uuid("location_id"),
	currencyCode: text("currency_code").notNull(),
	beginningBalanceDebit: numeric("beginning_balance_debit", { precision: 18, scale:  4 }).default('0').notNull(),
	beginningBalanceCredit: numeric("beginning_balance_credit", { precision: 18, scale:  4 }).default('0').notNull(),
	periodDebitAmount: numeric("period_debit_amount", { precision: 18, scale:  4 }).default('0').notNull(),
	periodCreditAmount: numeric("period_credit_amount", { precision: 18, scale:  4 }).default('0').notNull(),
	endingBalanceDebit: numeric("ending_balance_debit", { precision: 18, scale:  4 }).default('0').notNull(),
	endingBalanceCredit: numeric("ending_balance_credit", { precision: 18, scale:  4 }).default('0').notNull(),
	ytdDebitAmount: numeric("ytd_debit_amount", { precision: 18, scale:  4 }).default('0').notNull(),
	ytdCreditAmount: numeric("ytd_credit_amount", { precision: 18, scale:  4 }).default('0').notNull(),
	baseBeginningBalanceDebit: numeric("base_beginning_balance_debit", { precision: 18, scale:  4 }).default('0').notNull(),
	baseBeginningBalanceCredit: numeric("base_beginning_balance_credit", { precision: 18, scale:  4 }).default('0').notNull(),
	basePeriodDebitAmount: numeric("base_period_debit_amount", { precision: 18, scale:  4 }).default('0').notNull(),
	basePeriodCreditAmount: numeric("base_period_credit_amount", { precision: 18, scale:  4 }).default('0').notNull(),
	baseEndingBalanceDebit: numeric("base_ending_balance_debit", { precision: 18, scale:  4 }).default('0').notNull(),
	baseEndingBalanceCredit: numeric("base_ending_balance_credit", { precision: 18, scale:  4 }).default('0').notNull(),
	baseYtdDebitAmount: numeric("base_ytd_debit_amount", { precision: 18, scale:  4 }).default('0').notNull(),
	baseYtdCreditAmount: numeric("base_ytd_credit_amount", { precision: 18, scale:  4 }).default('0').notNull(),
	lastUpdated: timestamp("last_updated", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("idx_balance_account_period").using("btree", table.accountId.asc().nullsLast().op("uuid_ops"), table.periodId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("idx_balance_dimensions").using("btree", table.accountId.asc().nullsLast().op("text_ops"), table.subsidiaryId.asc().nullsLast().op("text_ops"), table.periodId.asc().nullsLast().op("text_ops"), table.classId.asc().nullsLast().op("text_ops"), table.departmentId.asc().nullsLast().op("text_ops"), table.locationId.asc().nullsLast().op("uuid_ops"), table.currencyCode.asc().nullsLast().op("text_ops")),
	uniqueIndex("idx_balance_sub_period").using("btree", table.subsidiaryId.asc().nullsLast().op("uuid_ops"), table.periodId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.periodId],
			foreignColumns: [accountingPeriods.id],
			name: "gl_account_balances_period_id_accounting_periods_id_fk"
		}),
]);

export const glAuditTrail = pgTable("gl_audit_trail", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tableName: text("table_name").notNull(),
	recordId: uuid("record_id").notNull(),
	actionType: text("action_type").notNull(),
	fieldName: text("field_name"),
	oldValue: text("old_value"),
	newValue: text("new_value"),
	userId: uuid("user_id").notNull(),
	sessionId: text("session_id"),
	ipAddress: text("ip_address"),
	timestamp: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("idx_audit_table_record").using("btree", table.tableName.asc().nullsLast().op("text_ops"), table.recordId.asc().nullsLast().op("text_ops")),
	uniqueIndex("idx_audit_user").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.timestamp.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "gl_audit_trail_user_id_users_id_fk"
		}),
]);

export const glTransactions = pgTable("gl_transactions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	transactionNumber: text("transaction_number").notNull(),
	subsidiaryId: uuid("subsidiary_id").notNull(),
	transactionDate: date("transaction_date").notNull(),
	postingDate: date("posting_date").notNull(),
	periodId: uuid("period_id").notNull(),
	transactionType: text("transaction_type").notNull(),
	sourceSystem: text("source_system"),
	sourceTransactionId: uuid("source_transaction_id"),
	sourceTransactionType: text("source_transaction_type"),
	description: text(),
	referenceNumber: text("reference_number"),
	baseCurrencyCode: text("base_currency_code").notNull(),
	totalDebitAmount: numeric("total_debit_amount", { precision: 18, scale:  4 }).notNull(),
	totalCreditAmount: numeric("total_credit_amount", { precision: 18, scale:  4 }).notNull(),
	status: text().notNull(),
	recurringTemplateId: uuid("recurring_template_id"),
	reversedByTransactionId: uuid("reversed_by_transaction_id"),
	reversalReason: text("reversal_reason"),
	autoGenerated: boolean("auto_generated").default(false).notNull(),
	createdBy: uuid("created_by"),
	createdDate: timestamp("created_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	modifiedBy: uuid("modified_by"),
	modifiedDate: timestamp("modified_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	postedBy: uuid("posted_by"),
	postedDate: timestamp("posted_date", { withTimezone: true, mode: 'string' }),
	versionNumber: integer("version_number").default(1).notNull(),
}, (table) => [
	uniqueIndex("idx_gl_trans_date_sub").using("btree", table.transactionDate.asc().nullsLast().op("uuid_ops"), table.subsidiaryId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("idx_gl_trans_number").using("btree", table.transactionNumber.asc().nullsLast().op("text_ops")),
	uniqueIndex("idx_gl_trans_period").using("btree", table.periodId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	uniqueIndex("idx_gl_trans_source").using("btree", table.sourceTransactionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "gl_transactions_created_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.modifiedBy],
			foreignColumns: [users.id],
			name: "gl_transactions_modified_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.periodId],
			foreignColumns: [accountingPeriods.id],
			name: "gl_transactions_period_id_accounting_periods_id_fk"
		}),
	foreignKey({
			columns: [table.postedBy],
			foreignColumns: [users.id],
			name: "gl_transactions_posted_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.reversedByTransactionId],
			foreignColumns: [table.id],
			name: "gl_transactions_reversed_by_transaction_id_gl_transactions_id_f"
		}),
	foreignKey({
			columns: [table.sourceTransactionId],
			foreignColumns: [businessTransactions.id],
			name: "gl_transactions_source_transaction_id_business_transactions_id_"
		}),
	unique("gl_transactions_transaction_number_unique").on(table.transactionNumber),
]);

export const roles = pgTable("roles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	roleName: text("role_name").notNull(),
	roleDescription: text("role_description"),
	isSystemRole: boolean("is_system_role").default(false).notNull(),
	createdDate: timestamp("created_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("roles_role_name_unique").on(table.roleName),
]);

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

export const testGl = pgTable("test_gl", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	organizationId: text("organization_id").notNull(),
	name: text().notNull(),
	code: text(),
	description: text(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

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

export const businessTransactionLines = pgTable("business_transaction_lines", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	businessTransactionId: uuid("business_transaction_id").notNull(),
	lineNumber: integer("line_number").notNull(),
	lineType: text("line_type").notNull(),
	itemId: uuid("item_id"),
	description: text().notNull(),
	quantity: numeric({ precision: 18, scale:  4 }).default('0').notNull(),
	unitOfMeasure: text("unit_of_measure"),
	unitPrice: numeric("unit_price", { precision: 18, scale:  4 }).default('0').notNull(),
	discountPercent: numeric("discount_percent", { precision: 5, scale:  2 }).default('0').notNull(),
	discountAmount: numeric("discount_amount", { precision: 18, scale:  4 }).default('0').notNull(),
	lineAmount: numeric("line_amount", { precision: 18, scale:  4 }).notNull(),
	taxCodeId: uuid("tax_code_id"),
	taxAmount: numeric("tax_amount", { precision: 18, scale:  4 }).default('0').notNull(),
	totalLineAmount: numeric("total_line_amount", { precision: 18, scale:  4 }).notNull(),
	accountId: uuid("account_id"),
	classId: uuid("class_id"),
	departmentId: uuid("department_id"),
	locationId: uuid("location_id"),
	projectId: uuid("project_id"),
	jobId: uuid("job_id"),
	activityCodeId: uuid("activity_code_id"),
	billableFlag: boolean("billable_flag").default(true).notNull(),
	billingRate: numeric("billing_rate", { precision: 18, scale:  4 }),
	hoursWorked: numeric("hours_worked", { precision: 10, scale:  2 }),
	employeeId: uuid("employee_id"),
	workDate: date("work_date"),
	parentLineId: uuid("parent_line_id"),
	quantityReceived: numeric("quantity_received", { precision: 18, scale:  4 }).default('0').notNull(),
	quantityBilled: numeric("quantity_billed", { precision: 18, scale:  4 }).default('0').notNull(),
	quantityShipped: numeric("quantity_shipped", { precision: 18, scale:  4 }).default('0').notNull(),
	costAmount: numeric("cost_amount", { precision: 18, scale:  4 }).default('0').notNull(),
	marginAmount: numeric("margin_amount", { precision: 18, scale:  4 }),
	serialNumbers: jsonb("serial_numbers"),
	lotNumbers: jsonb("lot_numbers"),
	estimatedHours: numeric("estimated_hours", { precision: 10, scale:  2 }),
	hourlyRate: numeric("hourly_rate", { precision: 18, scale:  4 }),
	costEstimate: numeric("cost_estimate", { precision: 18, scale:  4 }),
	notes: text(),
	customFields: jsonb("custom_fields"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("idx_trans_line_account").using("btree", table.accountId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("idx_trans_line_item").using("btree", table.itemId.asc().nullsLast().op("uuid_ops"), table.businessTransactionId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("idx_trans_line_trans").using("btree", table.businessTransactionId.asc().nullsLast().op("uuid_ops"), table.lineNumber.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.accountId],
			foreignColumns: [accounts.id],
			name: "business_transaction_lines_account_id_accounts_id_fk"
		}),
	foreignKey({
			columns: [table.activityCodeId],
			foreignColumns: [activityCodes.id],
			name: "business_transaction_lines_activity_code_id_activity_codes_id_f"
		}),
	foreignKey({
			columns: [table.businessTransactionId],
			foreignColumns: [businessTransactions.id],
			name: "business_transaction_lines_business_transaction_id_business_tra"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "business_transaction_lines_class_id_classes_id_fk"
		}),
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "business_transaction_lines_department_id_departments_id_fk"
		}),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [entities.id],
			name: "business_transaction_lines_employee_id_entities_id_fk"
		}),
	foreignKey({
			columns: [table.itemId],
			foreignColumns: [products.id],
			name: "business_transaction_lines_item_id_products_id_fk"
		}),
	foreignKey({
			columns: [table.locationId],
			foreignColumns: [locations.id],
			name: "business_transaction_lines_location_id_locations_id_fk"
		}),
	foreignKey({
			columns: [table.parentLineId],
			foreignColumns: [table.id],
			name: "business_transaction_lines_parent_line_id_business_transaction_"
		}),
	foreignKey({
			columns: [table.taxCodeId],
			foreignColumns: [taxCodes.id],
			name: "business_transaction_lines_tax_code_id_tax_codes_id_fk"
		}),
]);

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
	accountSubcategory: text("account_subcategory"),
	normalBalance: text("normal_balance"),
	financialStatementLine: text("financial_statement_line"),
	isControlAccount: boolean("is_control_account").default(false).notNull(),
	rollupAccountId: uuid("rollup_account_id"),
	gaapClassification: text("gaap_classification"),
	cashFlowCategory: text("cash_flow_category"),
}, (table) => [
	uniqueIndex("accounts_organization_id_account_number_idx").using("btree", table.organizationId.asc().nullsLast().op("text_ops"), table.accountNumber.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.rollupAccountId],
			foreignColumns: [table.id],
			name: "accounts_rollup_account_id_accounts_id_fk"
		}),
]);

export const businessTransactions = pgTable("business_transactions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	transactionNumber: text("transaction_number").notNull(),
	transactionTypeId: uuid("transaction_type_id").notNull(),
	subsidiaryId: uuid("subsidiary_id").notNull(),
	entityId: uuid("entity_id"),
	entityType: text("entity_type"),
	transactionDate: date("transaction_date").notNull(),
	dueDate: date("due_date"),
	termsId: uuid("terms_id"),
	currencyCode: text("currency_code").notNull(),
	exchangeRate: numeric("exchange_rate", { precision: 12, scale:  6 }).default('1').notNull(),
	subtotalAmount: numeric("subtotal_amount", { precision: 18, scale:  4 }).default('0').notNull(),
	taxAmount: numeric("tax_amount", { precision: 18, scale:  4 }).default('0').notNull(),
	discountAmount: numeric("discount_amount", { precision: 18, scale:  4 }).default('0').notNull(),
	totalAmount: numeric("total_amount", { precision: 18, scale:  4 }).notNull(),
	baseTotalAmount: numeric("base_total_amount", { precision: 18, scale:  4 }).notNull(),
	memo: text(),
	externalReference: text("external_reference"),
	status: text().notNull(),
	workflowStatus: text("workflow_status"),
	shipDate: date("ship_date"),
	shippedVia: text("shipped_via"),
	trackingNumber: text("tracking_number"),
	billingAddressId: uuid("billing_address_id"),
	shippingAddressId: uuid("shipping_address_id"),
	salesRepId: uuid("sales_rep_id"),
	departmentId: uuid("department_id"),
	classId: uuid("class_id"),
	locationId: uuid("location_id"),
	projectId: uuid("project_id"),
	salesStage: text("sales_stage"),
	probability: numeric({ precision: 5, scale:  2 }),
	expectedCloseDate: date("expected_close_date"),
	leadSource: text("lead_source"),
	competitor: text(),
	estimateValidUntil: date("estimate_valid_until"),
	estimatedHours: numeric("estimated_hours", { precision: 10, scale:  2 }),
	markupPercent: numeric("markup_percent", { precision: 5, scale:  2 }),
	marginPercent: numeric("margin_percent", { precision: 5, scale:  2 }),
	parentTransactionId: uuid("parent_transaction_id"),
	rootTransactionId: uuid("root_transaction_id"),
	glTransactionId: uuid("gl_transaction_id"),
	createdBy: uuid("created_by"),
	createdDate: timestamp("created_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	modifiedBy: uuid("modified_by"),
	modifiedDate: timestamp("modified_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	approvedBy: uuid("approved_by"),
	approvedDate: timestamp("approved_date", { withTimezone: true, mode: 'string' }),
	postedDate: timestamp("posted_date", { withTimezone: true, mode: 'string' }),
	versionNumber: integer("version_number").default(1).notNull(),
}, (table) => [
	uniqueIndex("idx_business_trans_entity").using("btree", table.entityId.asc().nullsLast().op("uuid_ops"), table.entityType.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("idx_business_trans_number").using("btree", table.transactionNumber.asc().nullsLast().op("text_ops")),
	uniqueIndex("idx_business_trans_subsidiary").using("btree", table.subsidiaryId.asc().nullsLast().op("date_ops"), table.transactionDate.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("idx_business_trans_type_date").using("btree", table.transactionTypeId.asc().nullsLast().op("date_ops"), table.transactionDate.asc().nullsLast().op("date_ops")),
	foreignKey({
			columns: [table.approvedBy],
			foreignColumns: [users.id],
			name: "business_transactions_approved_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "business_transactions_created_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.modifiedBy],
			foreignColumns: [users.id],
			name: "business_transactions_modified_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.parentTransactionId],
			foreignColumns: [table.id],
			name: "business_transactions_parent_transaction_id_business_transactio"
		}),
	foreignKey({
			columns: [table.rootTransactionId],
			foreignColumns: [table.id],
			name: "business_transactions_root_transaction_id_business_transactions"
		}),
	foreignKey({
			columns: [table.termsId],
			foreignColumns: [paymentTerms.id],
			name: "business_transactions_terms_id_payment_terms_id_fk"
		}),
	foreignKey({
			columns: [table.transactionTypeId],
			foreignColumns: [transactionTypes.id],
			name: "business_transactions_transaction_type_id_transaction_types_id_"
		}),
	unique("business_transactions_transaction_number_unique").on(table.transactionNumber),
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

export const transactionTypes = pgTable("transaction_types", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	typeCode: text("type_code").notNull(),
	typeName: text("type_name").notNull(),
	typeCategory: text("type_category"),
	generatesGl: boolean("generates_gl").default(true).notNull(),
	requiresApproval: boolean("requires_approval").default(false).notNull(),
	canBeReversed: boolean("can_be_reversed").default(true).notNull(),
	numberingSequence: text("numbering_sequence"),
	defaultGlAccountId: uuid("default_gl_account_id"),
	workflowTemplate: jsonb("workflow_template"),
	isActive: boolean("is_active").default(true).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("idx_transaction_types_code").using("btree", table.typeCode.asc().nullsLast().op("text_ops")),
	unique("transaction_types_type_code_unique").on(table.typeCode),
]);

export const glTransactionLines = pgTable("gl_transaction_lines", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	transactionId: uuid("transaction_id").notNull(),
	lineNumber: integer("line_number").notNull(),
	accountId: uuid("account_id").notNull(),
	classId: uuid("class_id"),
	departmentId: uuid("department_id"),
	locationId: uuid("location_id"),
	subsidiaryId: uuid("subsidiary_id").notNull(),
	debitAmount: numeric("debit_amount", { precision: 18, scale:  4 }).default('0').notNull(),
	creditAmount: numeric("credit_amount", { precision: 18, scale:  4 }).default('0').notNull(),
	currencyCode: text("currency_code").notNull(),
	exchangeRate: numeric("exchange_rate", { precision: 12, scale:  6 }).default('1').notNull(),
	baseDebitAmount: numeric("base_debit_amount", { precision: 18, scale:  4 }).default('0').notNull(),
	baseCreditAmount: numeric("base_credit_amount", { precision: 18, scale:  4 }).default('0').notNull(),
	description: text(),
	reference1: text("reference_1"),
	reference2: text("reference_2"),
	projectId: uuid("project_id"),
	createdDate: timestamp("created_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("idx_gl_line_account").using("btree", table.accountId.asc().nullsLast().op("uuid_ops"), table.transactionId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("idx_gl_line_trans").using("btree", table.transactionId.asc().nullsLast().op("uuid_ops"), table.lineNumber.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.transactionId],
			foreignColumns: [glTransactions.id],
			name: "gl_transaction_lines_transaction_id_gl_transactions_id_fk"
		}).onDelete("cascade"),
]);

export const permissions = pgTable("permissions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	permissionName: text("permission_name").notNull(),
	resourceType: text("resource_type"),
	action: text(),
	description: text(),
	createdDate: timestamp("created_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("permissions_permission_name_unique").on(table.permissionName),
]);

export const paymentTerms = pgTable("payment_terms", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	subsidiaryId: uuid("subsidiary_id"),
	termsCode: text("terms_code").notNull(),
	termsName: text("terms_name").notNull(),
	discountPercent: numeric("discount_percent", { precision: 5, scale:  2 }).default('0').notNull(),
	discountDays: integer("discount_days").default(0).notNull(),
	netDays: integer("net_days").notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("idx_payment_terms_sub_code").using("btree", table.subsidiaryId.asc().nullsLast().op("text_ops"), table.termsCode.asc().nullsLast().op("text_ops")),
]);

export const transactionRelationships = pgTable("transaction_relationships", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	parentTransactionId: uuid("parent_transaction_id").notNull(),
	childTransactionId: uuid("child_transaction_id").notNull(),
	relationshipType: text("relationship_type").notNull(),
	appliedAmount: numeric("applied_amount", { precision: 18, scale:  4 }),
	parentLineId: uuid("parent_line_id"),
	childLineId: uuid("child_line_id"),
	createdDate: timestamp("created_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	notes: text(),
}, (table) => [
	uniqueIndex("idx_trans_rel_child").using("btree", table.childTransactionId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("idx_trans_rel_parent").using("btree", table.parentTransactionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.childLineId],
			foreignColumns: [businessTransactionLines.id],
			name: "transaction_relationships_child_line_id_business_transaction_li"
		}),
	foreignKey({
			columns: [table.childTransactionId],
			foreignColumns: [businessTransactions.id],
			name: "transaction_relationships_child_transaction_id_business_transac"
		}),
	foreignKey({
			columns: [table.parentLineId],
			foreignColumns: [businessTransactionLines.id],
			name: "transaction_relationships_parent_line_id_business_transaction_l"
		}),
	foreignKey({
			columns: [table.parentTransactionId],
			foreignColumns: [businessTransactions.id],
			name: "transaction_relationships_parent_transaction_id_business_transa"
		}),
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

export const drizzleMigrations = pgTable("__drizzle_migrations", {
	id: serial().primaryKey().notNull(),
	hash: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const priceLists = pgTable("price_lists", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	name: text().notNull(),
	code: text().notNull(),
	description: text(),
	currencyCode: text("currency_code").default('USD'),
	isDefault: boolean("is_default").default(false),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("idx_price_lists_org_code").using("btree", table.organizationId.asc().nullsLast().op("text_ops"), table.code.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "price_lists_organization_id_organizations_id_fk"
		}),
]);

export const itemPricing = pgTable("item_pricing", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	itemId: uuid("item_id").notNull(),
	priceListId: uuid("price_list_id").notNull(),
	unitPrice: numeric("unit_price", { precision: 18, scale:  2 }).notNull(),
	minQuantity: numeric("min_quantity", { precision: 18, scale:  2 }).default('1'),
	effectiveDate: date("effective_date").notNull(),
	expirationDate: date("expiration_date"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_item_pricing_dates").using("btree", table.effectiveDate.asc().nullsLast().op("date_ops"), table.expirationDate.asc().nullsLast().op("date_ops")),
	index("idx_item_pricing_lookup").using("btree", table.itemId.asc().nullsLast().op("date_ops"), table.priceListId.asc().nullsLast().op("uuid_ops"), table.effectiveDate.asc().nullsLast().op("date_ops"), table.expirationDate.asc().nullsLast().op("date_ops")),
	uniqueIndex("idx_item_pricing_unique").using("btree", table.itemId.asc().nullsLast().op("date_ops"), table.priceListId.asc().nullsLast().op("uuid_ops"), table.minQuantity.asc().nullsLast().op("numeric_ops"), table.effectiveDate.asc().nullsLast().op("numeric_ops")),
	foreignKey({
			columns: [table.itemId],
			foreignColumns: [items.id],
			name: "item_pricing_item_id_items_id_fk"
		}),
	foreignKey({
			columns: [table.priceListId],
			foreignColumns: [priceLists.id],
			name: "item_pricing_price_list_id_price_lists_id_fk"
		}),
]);

export const customerPriceLists = pgTable("customer_price_lists", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	customerId: uuid("customer_id").notNull(),
	priceListId: uuid("price_list_id").notNull(),
	priority: numeric({ precision: 10, scale:  0 }).default('1'),
	effectiveDate: date("effective_date"),
	expirationDate: date("expiration_date"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_customer_price_lists_dates").using("btree", table.effectiveDate.asc().nullsLast().op("date_ops"), table.expirationDate.asc().nullsLast().op("date_ops")),
	uniqueIndex("idx_customer_price_lists_unique").using("btree", table.customerId.asc().nullsLast().op("uuid_ops"), table.priceListId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.priceListId],
			foreignColumns: [priceLists.id],
			name: "customer_price_lists_price_list_id_price_lists_id_fk"
		}),
]);

export const vendorItems = pgTable("vendor_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	vendorId: uuid("vendor_id").notNull(),
	itemId: uuid("item_id").notNull(),
	vendorItemCode: text("vendor_item_code"),
	vendorItemName: text("vendor_item_name"),
	vendorUnitCost: numeric("vendor_unit_cost", { precision: 18, scale:  2 }),
	leadTimeDays: integer("lead_time_days").default(0),
	minOrderQuantity: numeric("min_order_quantity", { precision: 18, scale:  2 }).default('1'),
	isPreferred: boolean("is_preferred").default(false),
	lastPurchaseDate: date("last_purchase_date"),
	lastPurchasePrice: numeric("last_purchase_price", { precision: 18, scale:  2 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_vendor_items_item").using("btree", table.itemId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("idx_vendor_items_unique").using("btree", table.vendorId.asc().nullsLast().op("uuid_ops"), table.itemId.asc().nullsLast().op("uuid_ops")),
	index("idx_vendor_items_vendor").using("btree", table.vendorId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.itemId],
			foreignColumns: [items.id],
			name: "vendor_items_item_id_items_id_fk"
		}),
]);

export const lotNumbers = pgTable("lot_numbers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	itemId: uuid("item_id").notNull(),
	lotNumber: text("lot_number").notNull(),
	manufactureDate: date("manufacture_date"),
	expirationDate: date("expiration_date"),
	quantityReceived: numeric("quantity_received", { precision: 18, scale:  2 }).notNull(),
	quantityOnHand: numeric("quantity_on_hand", { precision: 18, scale:  2 }).notNull(),
	status: lotStatus().default('ACTIVE'),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_lot_numbers_dates").using("btree", table.expirationDate.asc().nullsLast().op("date_ops")),
	index("idx_lot_numbers_item").using("btree", table.itemId.asc().nullsLast().op("uuid_ops")),
	index("idx_lot_numbers_status").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	uniqueIndex("idx_lot_numbers_unique").using("btree", table.organizationId.asc().nullsLast().op("text_ops"), table.itemId.asc().nullsLast().op("text_ops"), table.lotNumber.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.itemId],
			foreignColumns: [items.id],
			name: "lot_numbers_item_id_items_id_fk"
		}),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "lot_numbers_organization_id_organizations_id_fk"
		}),
]);

export const serialNumbers = pgTable("serial_numbers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	itemId: uuid("item_id").notNull(),
	serialNumber: text("serial_number").notNull(),
	lotNumberId: uuid("lot_number_id"),
	status: serialStatus().default('AVAILABLE'),
	purchaseDate: date("purchase_date"),
	purchaseVendorId: uuid("purchase_vendor_id"),
	saleDate: date("sale_date"),
	saleCustomerId: uuid("sale_customer_id"),
	warrantyExpirationDate: date("warranty_expiration_date"),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_serial_numbers_item").using("btree", table.itemId.asc().nullsLast().op("uuid_ops")),
	index("idx_serial_numbers_status").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	uniqueIndex("idx_serial_numbers_unique").using("btree", table.organizationId.asc().nullsLast().op("text_ops"), table.serialNumber.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.itemId],
			foreignColumns: [items.id],
			name: "serial_numbers_item_id_items_id_fk"
		}),
	foreignKey({
			columns: [table.lotNumberId],
			foreignColumns: [lotNumbers.id],
			name: "serial_numbers_lot_number_id_lot_numbers_id_fk"
		}),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "serial_numbers_organization_id_organizations_id_fk"
		}),
]);

export const itemCategories = pgTable("item_categories", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	organizationId: text("organization_id").notNull(),
	code: text().notNull(),
	name: text().notNull(),
	parentCategoryId: uuid("parent_category_id"),
	level: integer().default(0).notNull(),
	path: text().notNull(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: text("created_by"),
	updatedBy: text("updated_by"),
}, (table) => [
	uniqueIndex("idx_item_categories_org_code").using("btree", table.organizationId.asc().nullsLast().op("text_ops"), table.code.asc().nullsLast().op("text_ops")),
	index("idx_item_categories_parent").using("btree", table.parentCategoryId.asc().nullsLast().op("uuid_ops")),
	index("idx_item_categories_path").using("btree", table.path.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.parentCategoryId],
			foreignColumns: [table.id],
			name: "item_categories_parent_category_id_item_categories_id_fk"
		}),
]);

export const items = pgTable("items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	organizationId: text("organization_id").notNull(),
	itemCode: text("item_code").notNull(),
	name: text().notNull(),
	description: text(),
	itemType: itemType("item_type").notNull(),
	isParent: boolean("is_parent").default(false),
	parentItemId: uuid("parent_item_id"),
	variantAttributes: jsonb("variant_attributes"),
	categoryId: uuid("category_id"),
	unitOfMeasureId: uuid("unit_of_measure_id").notNull(),
	incomeAccountId: uuid("income_account_id"),
	expenseAccountId: uuid("expense_account_id"),
	assetAccountId: uuid("asset_account_id"),
	cogsAccountId: uuid("cogs_account_id"),
	defaultPrice: numeric("default_price", { precision: 18, scale:  2 }),
	defaultCost: numeric("default_cost", { precision: 18, scale:  2 }),
	isTaxable: boolean("is_taxable").default(true),
	taxCode: text("tax_code"),
	isActive: boolean("is_active").default(true),
	isPurchasable: boolean("is_purchasable").default(true),
	isSaleable: boolean("is_saleable").default(true),
	trackQuantity: boolean("track_quantity").default(false),
	trackLotNumbers: boolean("track_lot_numbers").default(false),
	trackSerialNumbers: boolean("track_serial_numbers").default(false),
	sku: text(),
	upc: text(),
	manufacturerPartNumber: text("manufacturer_part_number"),
	weight: numeric({ precision: 18, scale:  4 }),
	weightUnit: text("weight_unit"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: text("created_by"),
	updatedBy: text("updated_by"),
}, (table) => [
	index("idx_items_category").using("btree", table.categoryId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("idx_items_org_item_code").using("btree", table.organizationId.asc().nullsLast().op("text_ops"), table.itemCode.asc().nullsLast().op("text_ops")),
	index("idx_items_parent").using("btree", table.parentItemId.asc().nullsLast().op("uuid_ops")),
	index("idx_items_sku").using("btree", table.sku.asc().nullsLast().op("text_ops")),
	index("idx_items_type").using("btree", table.itemType.asc().nullsLast().op("enum_ops")),
	index("idx_items_upc").using("btree", table.upc.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.assetAccountId],
			foreignColumns: [accounts.id],
			name: "items_asset_account_id_accounts_id_fk"
		}),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [itemCategories.id],
			name: "items_category_id_item_categories_id_fk"
		}),
	foreignKey({
			columns: [table.cogsAccountId],
			foreignColumns: [accounts.id],
			name: "items_cogs_account_id_accounts_id_fk"
		}),
	foreignKey({
			columns: [table.expenseAccountId],
			foreignColumns: [accounts.id],
			name: "items_expense_account_id_accounts_id_fk"
		}),
	foreignKey({
			columns: [table.incomeAccountId],
			foreignColumns: [accounts.id],
			name: "items_income_account_id_accounts_id_fk"
		}),
	foreignKey({
			columns: [table.parentItemId],
			foreignColumns: [table.id],
			name: "items_parent_item_id_items_id_fk"
		}),
	foreignKey({
			columns: [table.unitOfMeasureId],
			foreignColumns: [unitsOfMeasure.id],
			name: "items_unit_of_measure_id_units_of_measure_id_fk"
		}),
]);

export const assemblyComponents = pgTable("assembly_components", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	assemblyItemId: uuid("assembly_item_id").notNull(),
	componentItemId: uuid("component_item_id").notNull(),
	quantity: numeric({ precision: 18, scale:  6 }).notNull(),
	unitOfMeasureId: uuid("unit_of_measure_id"),
	sequenceNumber: integer("sequence_number").default(1),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_assembly_components_assembly").using("btree", table.assemblyItemId.asc().nullsLast().op("uuid_ops")),
	index("idx_assembly_components_component").using("btree", table.componentItemId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("idx_assembly_components_unique").using("btree", table.assemblyItemId.asc().nullsLast().op("uuid_ops"), table.componentItemId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.assemblyItemId],
			foreignColumns: [items.id],
			name: "assembly_components_assembly_item_id_items_id_fk"
		}),
	foreignKey({
			columns: [table.componentItemId],
			foreignColumns: [items.id],
			name: "assembly_components_component_item_id_items_id_fk"
		}),
	foreignKey({
			columns: [table.unitOfMeasureId],
			foreignColumns: [unitsOfMeasure.id],
			name: "assembly_components_unit_of_measure_id_units_of_measure_id_fk"
		}),
]);

export const kitComponents = pgTable("kit_components", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	kitItemId: uuid("kit_item_id").notNull(),
	componentItemId: uuid("component_item_id").notNull(),
	quantity: numeric({ precision: 18, scale:  2 }).notNull(),
	isOptional: boolean("is_optional").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_kit_components_kit").using("btree", table.kitItemId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("idx_kit_components_unique").using("btree", table.kitItemId.asc().nullsLast().op("uuid_ops"), table.componentItemId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.componentItemId],
			foreignColumns: [items.id],
			name: "kit_components_component_item_id_items_id_fk"
		}),
	foreignKey({
			columns: [table.kitItemId],
			foreignColumns: [items.id],
			name: "kit_components_kit_item_id_items_id_fk"
		}),
]);

export const itemAuditLog = pgTable("item_audit_log", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	userId: uuid("user_id").notNull(),
	itemId: uuid("item_id"),
	action: text().notNull(),
	changes: jsonb(),
	ipAddress: inet("ip_address"),
	userAgent: text("user_agent"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_item_audit_action").using("btree", table.action.asc().nullsLast().op("text_ops")),
	index("idx_item_audit_created").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_item_audit_item").using("btree", table.itemId.asc().nullsLast().op("uuid_ops")),
	index("idx_item_audit_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.itemId],
			foreignColumns: [items.id],
			name: "item_audit_log_item_id_items_id_fk"
		}),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "item_audit_log_organization_id_organizations_id_fk"
		}),
]);

export const customerWarehouseAssignments = pgTable("customer_warehouse_assignments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	organizationId: text("organization_id").notNull(),
	customerId: uuid("customer_id").notNull(),
	itemId: uuid("item_id").notNull(),
	warehouseId: uuid("warehouse_id").notNull(),
	isDefault: boolean("is_default").default(false),
	effectiveDate: date("effective_date"),
	expirationDate: date("expiration_date"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const unitsOfMeasure = pgTable("units_of_measure", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	abbreviation: varchar({ length: 10 }),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	organizationId: text("organization_id"),
	code: text(),
	baseUnitId: uuid("base_unit_id"),
	baseConversionFactor: numeric("base_conversion_factor", { precision: 18, scale:  6 }).default('1.0'),
	createdBy: text("created_by"),
	updatedBy: text("updated_by"),
	decimalPlaces: integer("decimal_places").default(2),
}, (table) => [
	index("idx_units_of_measure_base_unit").using("btree", table.baseUnitId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("idx_units_of_measure_org_abbrev").using("btree", table.organizationId.asc().nullsLast().op("text_ops"), table.abbreviation.asc().nullsLast().op("text_ops")),
	uniqueIndex("idx_units_of_measure_org_code").using("btree", table.organizationId.asc().nullsLast().op("text_ops"), table.code.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.baseUnitId],
			foreignColumns: [table.id],
			name: "units_of_measure_base_unit_id_fkey"
		}),
]);

export const warehouses = pgTable("warehouses", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	organizationId: text("organization_id").notNull(),
	warehouseId: text("warehouse_id").notNull(),
	name: text().notNull(),
	locationId: uuid("location_id"),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const warehousePriceLists = pgTable("warehouse_price_lists", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	warehouseId: uuid("warehouse_id").notNull(),
	priceListId: uuid("price_list_id").notNull(),
	priority: numeric({ precision: 10, scale:  0 }).default('1'),
	effectiveDate: date("effective_date"),
	expirationDate: date("expiration_date"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const rolePermissions = pgTable("role_permissions", {
	roleId: uuid("role_id").notNull(),
	permissionId: uuid("permission_id").notNull(),
	grantedDate: timestamp("granted_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.permissionId],
			foreignColumns: [permissions.id],
			name: "role_permissions_permission_id_permissions_id_fk"
		}),
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [roles.id],
			name: "role_permissions_role_id_roles_id_fk"
		}),
	primaryKey({ columns: [table.roleId, table.permissionId], name: "role_permissions_role_id_permission_id_pk"}),
]);

export const userSubsidiaryAccess = pgTable("user_subsidiary_access", {
	userId: uuid("user_id").notNull(),
	subsidiaryId: uuid("subsidiary_id").notNull(),
	accessLevel: text("access_level").default('read').notNull(),
	grantedBy: uuid("granted_by"),
	grantedDate: timestamp("granted_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiresDate: timestamp("expires_date", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.grantedBy],
			foreignColumns: [users.id],
			name: "user_subsidiary_access_granted_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.subsidiaryId],
			foreignColumns: [subsidiaries.id],
			name: "user_subsidiary_access_subsidiary_id_subsidiaries_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_subsidiary_access_user_id_users_id_fk"
		}),
	primaryKey({ columns: [table.userId, table.subsidiaryId], name: "user_subsidiary_access_user_id_subsidiary_id_pk"}),
]);

export const userRoles = pgTable("user_roles", {
	userId: uuid("user_id").notNull(),
	roleId: uuid("role_id").notNull(),
	subsidiaryId: uuid("subsidiary_id").notNull(),
	grantedBy: uuid("granted_by"),
	grantedDate: timestamp("granted_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiresDate: timestamp("expires_date", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.grantedBy],
			foreignColumns: [users.id],
			name: "user_roles_granted_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [roles.id],
			name: "user_roles_role_id_roles_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_roles_user_id_users_id_fk"
		}),
	primaryKey({ columns: [table.userId, table.roleId, table.subsidiaryId], name: "user_roles_user_id_role_id_subsidiary_id_pk"}),
]);
