CREATE TYPE "public"."allocation_method" AS ENUM('proportional', 'residual', 'specific_evidence');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('draft', 'signed', 'active', 'completed', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."ssp_allocation_method" AS ENUM('observable_evidence', 'residual', 'proportional');--> statement-breakpoint
CREATE TYPE "public"."cost_estimate_type_enum" AS ENUM('Estimated', 'Actual', 'Derived', 'None');--> statement-breakpoint
CREATE TYPE "public"."entity_type_enum" AS ENUM('Customer', 'Vendor', 'Employee', 'Partner');--> statement-breakpoint
CREATE TYPE "public"."job_status_enum" AS ENUM('Planning', 'InProgress', 'OnHold', 'Completed', 'Billed', 'Cancelled');--> statement-breakpoint
CREATE TYPE "public"."time_entry_billed_status_enum" AS ENUM('NotBilled', 'Billed', 'NonBillable');--> statement-breakpoint
CREATE TYPE "public"."obligation_type" AS ENUM('single_point', 'over_time', 'series');--> statement-breakpoint
CREATE TYPE "public"."satisfaction_method" AS ENUM('input_method', 'output_method', 'time_based');--> statement-breakpoint
CREATE TYPE "public"."performance_obligation_status_enum" AS ENUM('Pending', 'InProcess', 'Fulfilled', 'PartiallyFulfilled', 'Cancelled');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('software_license', 'saas_subscription', 'professional_services', 'support');--> statement-breakpoint
CREATE TYPE "public"."recognition_type" AS ENUM('point_in_time', 'over_time', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."ssp_source" AS ENUM('internal_analysis', 'third_party_pricing', 'observable_evidence');--> statement-breakpoint
CREATE TYPE "public"."pattern_type" AS ENUM('straight_line', 'proportional', 'milestone', 'custom');--> statement-breakpoint
CREATE TYPE "public"."entry_type" AS ENUM('revenue_recognition', 'contract_asset', 'deferred_revenue', 'refund_liability');--> statement-breakpoint
CREATE TYPE "public"."recognition_source" AS ENUM('automatic', 'manual_adjustment', 'milestone_achievement');--> statement-breakpoint
CREATE TYPE "public"."confidence_level" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."evidence_type" AS ENUM('customer_pricing', 'comparable_sales', 'market_research', 'cost_plus');--> statement-breakpoint
CREATE TABLE "activity_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(50),
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "activity_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"subsidiary_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contract_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"line_item_number" integer NOT NULL,
	"description" text,
	"quantity" numeric(10, 2) DEFAULT '1' NOT NULL,
	"list_price" numeric(12, 2) NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0',
	"total_price" numeric(12, 2) NOT NULL,
	"ssp" numeric(12, 2),
	"allocated_transaction_price" numeric(12, 2),
	"performance_obligation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contract_ssp_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"line_item_id" uuid NOT NULL,
	"allocated_amount" numeric(12, 2) NOT NULL,
	"allocation_method" "allocation_method" NOT NULL,
	"allocation_percentage" numeric(5, 2),
	"allocation_date" timestamp with time zone DEFAULT now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contract_number" varchar(100) NOT NULL,
	"customer_id" uuid NOT NULL,
	"contract_date" date NOT NULL,
	"effective_date" date NOT NULL,
	"contract_value" numeric(12, 2) NOT NULL,
	"contract_status" "contract_status" NOT NULL,
	"ssp_allocation_method" "ssp_allocation_method" DEFAULT 'proportional',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "currencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(3) NOT NULL,
	"symbol" varchar(5) NOT NULL,
	"name" varchar(50) NOT NULL,
	"decimal_places" integer DEFAULT 2 NOT NULL,
	CONSTRAINT "currencies_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"customer_id" varchar(100) NOT NULL,
	"billing_address" jsonb,
	"contact_email" varchar(255),
	"contact_phone" varchar(50),
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "customers_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"subsidiary_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"subsidiary_id" uuid NOT NULL,
	"address_line_1" varchar(255),
	"address_line_2" varchar(255),
	"city" varchar(100),
	"state_province" varchar(100),
	"postal_code" varchar(20),
	"country_code" varchar(2),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stytch_org_id" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"settings" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "organizations_stytch_org_id_unique" UNIQUE("stytch_org_id"),
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "performance_obligations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_line_item_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"ssp" numeric(14, 2) NOT NULL,
	"allocated_transaction_price" numeric(14, 2),
	"revenue_recognized" numeric(14, 2) DEFAULT '0',
	"status" "performance_obligation_status_enum" DEFAULT 'Pending',
	"fulfillment_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_code" varchar(100) NOT NULL,
	"product_name" varchar(255) NOT NULL,
	"product_type" "product_type" NOT NULL,
	"default_ssp" numeric(12, 2),
	"ssp_source" "ssp_source" DEFAULT 'internal_analysis',
	"recognition_type" "recognition_type" NOT NULL,
	"default_recognition_pattern_id" uuid,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "products_product_code_unique" UNIQUE("product_code")
);
--> statement-breakpoint
CREATE TABLE "revenue_recognition_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pattern_name" varchar(255) NOT NULL,
	"pattern_type" "pattern_type" NOT NULL,
	"pattern_config" jsonb,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "revenue_journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_date" date NOT NULL,
	"contract_id" uuid NOT NULL,
	"performance_obligation_id" uuid,
	"debit_account" varchar(100) NOT NULL,
	"credit_account" varchar(100) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"entry_type" "entry_type" NOT NULL,
	"description" text,
	"is_posted" boolean DEFAULT false,
	"posted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "revenue_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"performance_obligation_id" uuid NOT NULL,
	"schedule_date" date NOT NULL,
	"scheduled_amount" numeric(12, 2) NOT NULL,
	"recognized_amount" numeric(12, 2) DEFAULT '0',
	"recognition_source" "recognition_source",
	"recognition_date" date,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ssp_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"evidence_type" "evidence_type" NOT NULL,
	"evidence_date" date NOT NULL,
	"ssp_amount" numeric(12, 2) NOT NULL,
	"confidence_level" "confidence_level" NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subsidiaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"parent_id" uuid,
	"base_currency_id" uuid NOT NULL,
	"country_code" varchar(2),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tax_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(255),
	"rate" numeric(8, 4) DEFAULT '0' NOT NULL,
	"is_compound" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "tax_codes_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "transaction_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(12, 4) NOT NULL,
	"units_id" uuid,
	"rate" numeric(14, 4) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"description" text,
	"department_id" uuid,
	"class_id" uuid,
	"location_id" uuid,
	"activity_code_id" uuid,
	"unit_cost" numeric(14, 4),
	"cost_estimate_type" "cost_estimate_type_enum",
	"ssp" numeric(14, 2),
	"allocated_transaction_price" numeric(14, 2),
	"performance_obligation_id" uuid,
	"is_taxable" boolean DEFAULT true,
	"tax_code_id" uuid,
	"tax_amount" numeric(12, 2) DEFAULT '0',
	"discount_amount" numeric(12, 2) DEFAULT '0',
	"gross_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"linked_order_line_id" uuid,
	"custom_fields" jsonb
);
--> statement-breakpoint
CREATE TABLE "units_of_measure" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"abbreviation" varchar(10),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "units_of_measure_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stytch_user_id" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"organization_id" uuid NOT NULL,
	"role" varchar(50) DEFAULT 'user' NOT NULL,
	"settings" jsonb,
	"is_active" boolean DEFAULT true,
	"last_login" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_stytch_user_id_unique" UNIQUE("stytch_user_id")
);
--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_subsidiary_id_subsidiaries_id_fk" FOREIGN KEY ("subsidiary_id") REFERENCES "public"."subsidiaries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_line_items" ADD CONSTRAINT "contract_line_items_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_line_items" ADD CONSTRAINT "contract_line_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_line_items" ADD CONSTRAINT "contract_line_items_performance_obligation_id_performance_obligations_id_fk" FOREIGN KEY ("performance_obligation_id") REFERENCES "public"."performance_obligations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_ssp_allocations" ADD CONSTRAINT "contract_ssp_allocations_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_ssp_allocations" ADD CONSTRAINT "contract_ssp_allocations_line_item_id_contract_line_items_id_fk" FOREIGN KEY ("line_item_id") REFERENCES "public"."contract_line_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_subsidiary_id_subsidiaries_id_fk" FOREIGN KEY ("subsidiary_id") REFERENCES "public"."subsidiaries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_subsidiary_id_subsidiaries_id_fk" FOREIGN KEY ("subsidiary_id") REFERENCES "public"."subsidiaries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_obligations" ADD CONSTRAINT "performance_obligations_contract_line_item_id_contract_line_items_id_fk" FOREIGN KEY ("contract_line_item_id") REFERENCES "public"."contract_line_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_default_recognition_pattern_id_revenue_recognition_patterns_id_fk" FOREIGN KEY ("default_recognition_pattern_id") REFERENCES "public"."revenue_recognition_patterns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_journal_entries" ADD CONSTRAINT "revenue_journal_entries_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_journal_entries" ADD CONSTRAINT "revenue_journal_entries_performance_obligation_id_performance_obligations_id_fk" FOREIGN KEY ("performance_obligation_id") REFERENCES "public"."performance_obligations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_schedules" ADD CONSTRAINT "revenue_schedules_performance_obligation_id_performance_obligations_id_fk" FOREIGN KEY ("performance_obligation_id") REFERENCES "public"."performance_obligations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ssp_evidence" ADD CONSTRAINT "ssp_evidence_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subsidiaries" ADD CONSTRAINT "subsidiaries_parent_id_subsidiaries_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."subsidiaries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subsidiaries" ADD CONSTRAINT "subsidiaries_base_currency_id_currencies_id_fk" FOREIGN KEY ("base_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_lines" ADD CONSTRAINT "transaction_lines_item_id_products_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_lines" ADD CONSTRAINT "transaction_lines_units_id_units_of_measure_id_fk" FOREIGN KEY ("units_id") REFERENCES "public"."units_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_lines" ADD CONSTRAINT "transaction_lines_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_lines" ADD CONSTRAINT "transaction_lines_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_lines" ADD CONSTRAINT "transaction_lines_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_lines" ADD CONSTRAINT "transaction_lines_activity_code_id_activity_codes_id_fk" FOREIGN KEY ("activity_code_id") REFERENCES "public"."activity_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_lines" ADD CONSTRAINT "transaction_lines_performance_obligation_id_performance_obligations_id_fk" FOREIGN KEY ("performance_obligation_id") REFERENCES "public"."performance_obligations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_lines" ADD CONSTRAINT "transaction_lines_tax_code_id_tax_codes_id_fk" FOREIGN KEY ("tax_code_id") REFERENCES "public"."tax_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_lines" ADD CONSTRAINT "transaction_lines_linked_order_line_id_transaction_lines_id_fk" FOREIGN KEY ("linked_order_line_id") REFERENCES "public"."transaction_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;