CREATE TABLE "accounting_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subsidiary_id" uuid NOT NULL,
	"period_name" text NOT NULL,
	"fiscal_year" text NOT NULL,
	"period_number" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"period_type" text NOT NULL,
	"status" text NOT NULL,
	"closed_by" uuid,
	"closed_date" timestamp with time zone,
	"is_adjustment_period" boolean DEFAULT false NOT NULL,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_currency" text NOT NULL,
	"to_currency" text NOT NULL,
	"rate_date" date NOT NULL,
	"rate_type" text NOT NULL,
	"exchange_rate" numeric(12, 6) NOT NULL,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gl_account_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"subsidiary_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"class_id" uuid,
	"department_id" uuid,
	"location_id" uuid,
	"currency_code" text NOT NULL,
	"beginning_balance_debit" numeric(18, 4) DEFAULT '0' NOT NULL,
	"beginning_balance_credit" numeric(18, 4) DEFAULT '0' NOT NULL,
	"period_debit_amount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"period_credit_amount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"ending_balance_debit" numeric(18, 4) DEFAULT '0' NOT NULL,
	"ending_balance_credit" numeric(18, 4) DEFAULT '0' NOT NULL,
	"ytd_debit_amount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"ytd_credit_amount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"base_beginning_balance_debit" numeric(18, 4) DEFAULT '0' NOT NULL,
	"base_beginning_balance_credit" numeric(18, 4) DEFAULT '0' NOT NULL,
	"base_period_debit_amount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"base_period_credit_amount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"base_ending_balance_debit" numeric(18, 4) DEFAULT '0' NOT NULL,
	"base_ending_balance_credit" numeric(18, 4) DEFAULT '0' NOT NULL,
	"base_ytd_debit_amount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"base_ytd_credit_amount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"last_updated" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gl_audit_trail" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_name" text NOT NULL,
	"record_id" uuid NOT NULL,
	"action_type" text NOT NULL,
	"field_name" text,
	"old_value" text,
	"new_value" text,
	"user_id" uuid NOT NULL,
	"session_id" text,
	"ip_address" text,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gl_posting_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_type_id" uuid NOT NULL,
	"subsidiary_id" uuid,
	"rule_name" text NOT NULL,
	"sequence_number" integer DEFAULT 10 NOT NULL,
	"line_type" text,
	"condition_sql" text,
	"debit_account_id" uuid,
	"credit_account_id" uuid,
	"amount_formula" text,
	"description_template" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"effective_date" date NOT NULL,
	"expiration_date" date,
	"created_by" uuid,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_date" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gl_transaction_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"account_id" uuid NOT NULL,
	"class_id" uuid,
	"department_id" uuid,
	"location_id" uuid,
	"subsidiary_id" uuid NOT NULL,
	"debit_amount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"credit_amount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"currency_code" text NOT NULL,
	"exchange_rate" numeric(12, 6) DEFAULT '1' NOT NULL,
	"base_debit_amount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"base_credit_amount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"description" text,
	"reference_1" text,
	"reference_2" text,
	"project_id" uuid,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gl_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_number" text NOT NULL,
	"subsidiary_id" uuid NOT NULL,
	"transaction_date" date NOT NULL,
	"posting_date" date NOT NULL,
	"period_id" uuid NOT NULL,
	"transaction_type" text NOT NULL,
	"source_system" text,
	"source_transaction_id" uuid,
	"source_transaction_type" text,
	"description" text,
	"reference_number" text,
	"base_currency_code" text NOT NULL,
	"total_debit_amount" numeric(18, 4) NOT NULL,
	"total_credit_amount" numeric(18, 4) NOT NULL,
	"status" text NOT NULL,
	"recurring_template_id" uuid,
	"reversed_by_transaction_id" uuid,
	"reversal_reason" text,
	"auto_generated" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_by" uuid,
	"modified_date" timestamp with time zone DEFAULT now() NOT NULL,
	"posted_by" uuid,
	"posted_date" timestamp with time zone,
	"version_number" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "gl_transactions_transaction_number_unique" UNIQUE("transaction_number")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"permission_name" text NOT NULL,
	"resource_type" text,
	"action" text,
	"description" text,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_permission_name_unique" UNIQUE("permission_name")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"granted_date" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_name" text NOT NULL,
	"role_description" text,
	"is_system_role" boolean DEFAULT false NOT NULL,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_role_name_unique" UNIQUE("role_name")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"subsidiary_id" uuid,
	"granted_by" uuid,
	"granted_date" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_date" timestamp with time zone,
	CONSTRAINT "user_roles_user_id_role_id_subsidiary_id_pk" PRIMARY KEY("user_id","role_id","subsidiary_id")
);
--> statement-breakpoint
CREATE TABLE "user_subsidiary_access" (
	"user_id" uuid NOT NULL,
	"subsidiary_id" uuid NOT NULL,
	"access_level" text DEFAULT 'read' NOT NULL,
	"granted_by" uuid,
	"granted_date" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_date" timestamp with time zone,
	CONSTRAINT "user_subsidiary_access_user_id_subsidiary_id_pk" PRIMARY KEY("user_id","subsidiary_id")
);
--> statement-breakpoint
CREATE TABLE "test_gl" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_transaction_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_transaction_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"line_type" text NOT NULL,
	"item_id" uuid,
	"description" text NOT NULL,
	"quantity" numeric(18, 4) DEFAULT '0' NOT NULL,
	"unit_of_measure" text,
	"unit_price" numeric(18, 4) DEFAULT '0' NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"line_amount" numeric(18, 4) NOT NULL,
	"tax_code_id" uuid,
	"tax_amount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"total_line_amount" numeric(18, 4) NOT NULL,
	"account_id" uuid,
	"class_id" uuid,
	"department_id" uuid,
	"location_id" uuid,
	"project_id" uuid,
	"job_id" uuid,
	"activity_code_id" uuid,
	"billable_flag" boolean DEFAULT true NOT NULL,
	"billing_rate" numeric(18, 4),
	"hours_worked" numeric(10, 2),
	"employee_id" uuid,
	"work_date" date,
	"parent_line_id" uuid,
	"quantity_received" numeric(18, 4) DEFAULT '0' NOT NULL,
	"quantity_billed" numeric(18, 4) DEFAULT '0' NOT NULL,
	"quantity_shipped" numeric(18, 4) DEFAULT '0' NOT NULL,
	"cost_amount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"margin_amount" numeric(18, 4),
	"serial_numbers" jsonb,
	"lot_numbers" jsonb,
	"estimated_hours" numeric(10, 2),
	"hourly_rate" numeric(18, 4),
	"cost_estimate" numeric(18, 4),
	"notes" text,
	"custom_fields" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_number" text NOT NULL,
	"transaction_type_id" uuid NOT NULL,
	"subsidiary_id" uuid NOT NULL,
	"entity_id" uuid,
	"entity_type" text,
	"transaction_date" date NOT NULL,
	"due_date" date,
	"terms_id" uuid,
	"currency_code" text NOT NULL,
	"exchange_rate" numeric(12, 6) DEFAULT '1' NOT NULL,
	"subtotal_amount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"total_amount" numeric(18, 4) NOT NULL,
	"base_total_amount" numeric(18, 4) NOT NULL,
	"memo" text,
	"external_reference" text,
	"status" text NOT NULL,
	"workflow_status" text,
	"ship_date" date,
	"shipped_via" text,
	"tracking_number" text,
	"billing_address_id" uuid,
	"shipping_address_id" uuid,
	"sales_rep_id" uuid,
	"department_id" uuid,
	"class_id" uuid,
	"location_id" uuid,
	"project_id" uuid,
	"sales_stage" text,
	"probability" numeric(5, 2),
	"expected_close_date" date,
	"lead_source" text,
	"competitor" text,
	"estimate_valid_until" date,
	"estimated_hours" numeric(10, 2),
	"markup_percent" numeric(5, 2),
	"margin_percent" numeric(5, 2),
	"parent_transaction_id" uuid,
	"root_transaction_id" uuid,
	"gl_transaction_id" uuid,
	"created_by" uuid,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_by" uuid,
	"modified_date" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_by" uuid,
	"approved_date" timestamp with time zone,
	"posted_date" timestamp with time zone,
	"version_number" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "business_transactions_transaction_number_unique" UNIQUE("transaction_number")
);
--> statement-breakpoint
CREATE TABLE "payment_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subsidiary_id" uuid,
	"terms_code" text NOT NULL,
	"terms_name" text NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"discount_days" integer DEFAULT 0 NOT NULL,
	"net_days" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_transaction_id" uuid NOT NULL,
	"child_transaction_id" uuid NOT NULL,
	"relationship_type" text NOT NULL,
	"applied_amount" numeric(18, 4),
	"parent_line_id" uuid,
	"child_line_id" uuid,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "transaction_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type_code" text NOT NULL,
	"type_name" text NOT NULL,
	"type_category" text,
	"generates_gl" boolean DEFAULT true NOT NULL,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"can_be_reversed" boolean DEFAULT true NOT NULL,
	"numbering_sequence" text,
	"default_gl_account_id" uuid,
	"workflow_template" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transaction_types_type_code_unique" UNIQUE("type_code")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "account_subcategory" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "normal_balance" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "financial_statement_line" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "is_control_account" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "rollup_account_id" uuid;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "gaap_classification" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "cash_flow_category" text;--> statement-breakpoint
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gl_account_balances" ADD CONSTRAINT "gl_account_balances_period_id_accounting_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."accounting_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gl_audit_trail" ADD CONSTRAINT "gl_audit_trail_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gl_posting_rules" ADD CONSTRAINT "gl_posting_rules_transaction_type_id_transaction_types_id_fk" FOREIGN KEY ("transaction_type_id") REFERENCES "public"."transaction_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gl_posting_rules" ADD CONSTRAINT "gl_posting_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gl_transaction_lines" ADD CONSTRAINT "gl_transaction_lines_transaction_id_gl_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."gl_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gl_transactions" ADD CONSTRAINT "gl_transactions_period_id_accounting_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."accounting_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gl_transactions" ADD CONSTRAINT "gl_transactions_source_transaction_id_business_transactions_id_fk" FOREIGN KEY ("source_transaction_id") REFERENCES "public"."business_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gl_transactions" ADD CONSTRAINT "gl_transactions_reversed_by_transaction_id_gl_transactions_id_fk" FOREIGN KEY ("reversed_by_transaction_id") REFERENCES "public"."gl_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gl_transactions" ADD CONSTRAINT "gl_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gl_transactions" ADD CONSTRAINT "gl_transactions_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gl_transactions" ADD CONSTRAINT "gl_transactions_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subsidiary_access" ADD CONSTRAINT "user_subsidiary_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subsidiary_access" ADD CONSTRAINT "user_subsidiary_access_subsidiary_id_subsidiaries_id_fk" FOREIGN KEY ("subsidiary_id") REFERENCES "public"."subsidiaries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subsidiary_access" ADD CONSTRAINT "user_subsidiary_access_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_transaction_lines" ADD CONSTRAINT "business_transaction_lines_business_transaction_id_business_transactions_id_fk" FOREIGN KEY ("business_transaction_id") REFERENCES "public"."business_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_transaction_lines" ADD CONSTRAINT "business_transaction_lines_item_id_products_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_transaction_lines" ADD CONSTRAINT "business_transaction_lines_tax_code_id_tax_codes_id_fk" FOREIGN KEY ("tax_code_id") REFERENCES "public"."tax_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_transaction_lines" ADD CONSTRAINT "business_transaction_lines_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_transaction_lines" ADD CONSTRAINT "business_transaction_lines_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_transaction_lines" ADD CONSTRAINT "business_transaction_lines_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_transaction_lines" ADD CONSTRAINT "business_transaction_lines_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_transaction_lines" ADD CONSTRAINT "business_transaction_lines_activity_code_id_activity_codes_id_fk" FOREIGN KEY ("activity_code_id") REFERENCES "public"."activity_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_transaction_lines" ADD CONSTRAINT "business_transaction_lines_employee_id_entities_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_transaction_lines" ADD CONSTRAINT "business_transaction_lines_parent_line_id_business_transaction_lines_id_fk" FOREIGN KEY ("parent_line_id") REFERENCES "public"."business_transaction_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_transactions" ADD CONSTRAINT "business_transactions_transaction_type_id_transaction_types_id_fk" FOREIGN KEY ("transaction_type_id") REFERENCES "public"."transaction_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_transactions" ADD CONSTRAINT "business_transactions_terms_id_payment_terms_id_fk" FOREIGN KEY ("terms_id") REFERENCES "public"."payment_terms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_transactions" ADD CONSTRAINT "business_transactions_parent_transaction_id_business_transactions_id_fk" FOREIGN KEY ("parent_transaction_id") REFERENCES "public"."business_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_transactions" ADD CONSTRAINT "business_transactions_root_transaction_id_business_transactions_id_fk" FOREIGN KEY ("root_transaction_id") REFERENCES "public"."business_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_transactions" ADD CONSTRAINT "business_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_transactions" ADD CONSTRAINT "business_transactions_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_transactions" ADD CONSTRAINT "business_transactions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_relationships" ADD CONSTRAINT "transaction_relationships_parent_transaction_id_business_transactions_id_fk" FOREIGN KEY ("parent_transaction_id") REFERENCES "public"."business_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_relationships" ADD CONSTRAINT "transaction_relationships_child_transaction_id_business_transactions_id_fk" FOREIGN KEY ("child_transaction_id") REFERENCES "public"."business_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_relationships" ADD CONSTRAINT "transaction_relationships_parent_line_id_business_transaction_lines_id_fk" FOREIGN KEY ("parent_line_id") REFERENCES "public"."business_transaction_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_relationships" ADD CONSTRAINT "transaction_relationships_child_line_id_business_transaction_lines_id_fk" FOREIGN KEY ("child_line_id") REFERENCES "public"."business_transaction_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_periods_sub_year_period" ON "accounting_periods" USING btree ("subsidiary_id","fiscal_year","period_number");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_periods_status" ON "accounting_periods" USING btree ("status","start_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_periods_date_range" ON "accounting_periods" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_exchange_rates_currency_date" ON "exchange_rates" USING btree ("from_currency","to_currency","rate_date","rate_type");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_balance_account_period" ON "gl_account_balances" USING btree ("account_id","period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_balance_sub_period" ON "gl_account_balances" USING btree ("subsidiary_id","period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_balance_dimensions" ON "gl_account_balances" USING btree ("account_id","subsidiary_id","period_id","class_id","department_id","location_id","currency_code");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_audit_table_record" ON "gl_audit_trail" USING btree ("table_name","record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_audit_user" ON "gl_audit_trail" USING btree ("user_id","timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_posting_rules_type_sub" ON "gl_posting_rules" USING btree ("transaction_type_id","subsidiary_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_posting_rules_active" ON "gl_posting_rules" USING btree ("is_active","effective_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_gl_line_trans" ON "gl_transaction_lines" USING btree ("transaction_id","line_number");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_gl_line_account" ON "gl_transaction_lines" USING btree ("account_id","transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_gl_trans_number" ON "gl_transactions" USING btree ("transaction_number");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_gl_trans_date_sub" ON "gl_transactions" USING btree ("transaction_date","subsidiary_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_gl_trans_period" ON "gl_transactions" USING btree ("period_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_gl_trans_source" ON "gl_transactions" USING btree ("source_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_trans_line_trans" ON "business_transaction_lines" USING btree ("business_transaction_id","line_number");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_trans_line_item" ON "business_transaction_lines" USING btree ("item_id","business_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_trans_line_account" ON "business_transaction_lines" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_business_trans_number" ON "business_transactions" USING btree ("transaction_number");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_business_trans_type_date" ON "business_transactions" USING btree ("transaction_type_id","transaction_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_business_trans_entity" ON "business_transactions" USING btree ("entity_id","entity_type","status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_business_trans_subsidiary" ON "business_transactions" USING btree ("subsidiary_id","transaction_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_payment_terms_sub_code" ON "payment_terms" USING btree ("subsidiary_id","terms_code");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_trans_rel_parent" ON "transaction_relationships" USING btree ("parent_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_trans_rel_child" ON "transaction_relationships" USING btree ("child_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_transaction_types_code" ON "transaction_types" USING btree ("type_code");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_rollup_account_id_accounts_id_fk" FOREIGN KEY ("rollup_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;