CREATE TYPE "public"."lot_status" AS ENUM('ACTIVE', 'EXPIRED', 'RECALLED');--> statement-breakpoint
CREATE TYPE "public"."serial_status" AS ENUM('AVAILABLE', 'SOLD', 'IN_TRANSIT', 'RETURNED', 'DAMAGED', 'LOST');--> statement-breakpoint
CREATE TYPE "public"."item_type" AS ENUM('INVENTORY_ITEM', 'NON_INVENTORY_ITEM', 'SERVICE', 'CHARGE', 'DISCOUNT', 'TAX', 'ASSEMBLY', 'KIT');--> statement-breakpoint
CREATE TABLE "assembly_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assembly_item_id" uuid NOT NULL,
	"component_item_id" uuid NOT NULL,
	"quantity" numeric(18, 6) NOT NULL,
	"unit_of_measure_id" uuid,
	"sequence_number" integer DEFAULT 1,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kit_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kit_item_id" uuid NOT NULL,
	"component_item_id" uuid NOT NULL,
	"quantity" numeric(18, 2) NOT NULL,
	"is_optional" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lot_numbers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"lot_number" text NOT NULL,
	"manufacture_date" date,
	"expiration_date" date,
	"quantity_received" numeric(18, 2) NOT NULL,
	"quantity_on_hand" numeric(18, 2) NOT NULL,
	"status" lot_status DEFAULT 'ACTIVE',
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "serial_numbers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"serial_number" text NOT NULL,
	"lot_number_id" uuid,
	"status" serial_status DEFAULT 'AVAILABLE',
	"purchase_date" date,
	"purchase_vendor_id" uuid,
	"sale_date" date,
	"sale_customer_id" uuid,
	"warranty_expiration_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"item_id" uuid,
	"action" text NOT NULL,
	"changes" jsonb,
	"ip_address" "inet",
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"parent_category_id" uuid,
	"level" integer DEFAULT 0 NOT NULL,
	"path" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"item_code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"item_type" "item_type" NOT NULL,
	"is_parent" boolean DEFAULT false,
	"parent_item_id" uuid,
	"variant_attributes" jsonb,
	"category_id" uuid,
	"unit_of_measure_id" uuid NOT NULL,
	"income_account_id" uuid,
	"expense_account_id" uuid,
	"asset_account_id" uuid,
	"cogs_account_id" uuid,
	"default_price" numeric(18, 2),
	"default_cost" numeric(18, 2),
	"is_taxable" boolean DEFAULT true,
	"tax_code" text,
	"is_active" boolean DEFAULT true,
	"is_purchasable" boolean DEFAULT true,
	"is_saleable" boolean DEFAULT true,
	"track_quantity" boolean DEFAULT false,
	"track_lot_numbers" boolean DEFAULT false,
	"track_serial_numbers" boolean DEFAULT false,
	"sku" text,
	"upc" text,
	"manufacturer_part_number" text,
	"weight" numeric(18, 4),
	"weight_unit" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "customer_price_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"price_list_id" uuid NOT NULL,
	"priority" numeric(10, 0) DEFAULT '1',
	"effective_date" date,
	"expiration_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_pricing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"price_list_id" uuid NOT NULL,
	"unit_price" numeric(18, 2) NOT NULL,
	"min_quantity" numeric(18, 2) DEFAULT '1',
	"effective_date" date NOT NULL,
	"expiration_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"currency_code" text DEFAULT 'USD',
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"vendor_item_code" text,
	"vendor_item_name" text,
	"vendor_unit_cost" numeric(18, 2),
	"lead_time_days" integer DEFAULT 0,
	"min_order_quantity" numeric(18, 2) DEFAULT '1',
	"is_preferred" boolean DEFAULT false,
	"last_purchase_date" date,
	"last_purchase_price" numeric(18, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assembly_components" ADD CONSTRAINT "assembly_components_assembly_item_id_items_id_fk" FOREIGN KEY ("assembly_item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assembly_components" ADD CONSTRAINT "assembly_components_component_item_id_items_id_fk" FOREIGN KEY ("component_item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assembly_components" ADD CONSTRAINT "assembly_components_unit_of_measure_id_units_of_measure_id_fk" FOREIGN KEY ("unit_of_measure_id") REFERENCES "public"."units_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kit_components" ADD CONSTRAINT "kit_components_kit_item_id_items_id_fk" FOREIGN KEY ("kit_item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kit_components" ADD CONSTRAINT "kit_components_component_item_id_items_id_fk" FOREIGN KEY ("component_item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lot_numbers" ADD CONSTRAINT "lot_numbers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lot_numbers" ADD CONSTRAINT "lot_numbers_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serial_numbers" ADD CONSTRAINT "serial_numbers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serial_numbers" ADD CONSTRAINT "serial_numbers_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serial_numbers" ADD CONSTRAINT "serial_numbers_lot_number_id_lot_numbers_id_fk" FOREIGN KEY ("lot_number_id") REFERENCES "public"."lot_numbers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_audit_log" ADD CONSTRAINT "item_audit_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_audit_log" ADD CONSTRAINT "item_audit_log_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_parent_category_id_item_categories_id_fk" FOREIGN KEY ("parent_category_id") REFERENCES "public"."item_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_parent_item_id_items_id_fk" FOREIGN KEY ("parent_item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_category_id_item_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."item_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_unit_of_measure_id_units_of_measure_id_fk" FOREIGN KEY ("unit_of_measure_id") REFERENCES "public"."units_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_income_account_id_accounts_id_fk" FOREIGN KEY ("income_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_expense_account_id_accounts_id_fk" FOREIGN KEY ("expense_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_asset_account_id_accounts_id_fk" FOREIGN KEY ("asset_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_cogs_account_id_accounts_id_fk" FOREIGN KEY ("cogs_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_price_lists" ADD CONSTRAINT "customer_price_lists_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_pricing" ADD CONSTRAINT "item_pricing_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_pricing" ADD CONSTRAINT "item_pricing_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_items" ADD CONSTRAINT "vendor_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_assembly_components_unique" ON "assembly_components" USING btree ("assembly_item_id","component_item_id");--> statement-breakpoint
CREATE INDEX "idx_assembly_components_assembly" ON "assembly_components" USING btree ("assembly_item_id");--> statement-breakpoint
CREATE INDEX "idx_assembly_components_component" ON "assembly_components" USING btree ("component_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_kit_components_unique" ON "kit_components" USING btree ("kit_item_id","component_item_id");--> statement-breakpoint
CREATE INDEX "idx_kit_components_kit" ON "kit_components" USING btree ("kit_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_lot_numbers_unique" ON "lot_numbers" USING btree ("organization_id","item_id","lot_number");--> statement-breakpoint
CREATE INDEX "idx_lot_numbers_item" ON "lot_numbers" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_lot_numbers_dates" ON "lot_numbers" USING btree ("expiration_date");--> statement-breakpoint
CREATE INDEX "idx_lot_numbers_status" ON "lot_numbers" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_serial_numbers_unique" ON "serial_numbers" USING btree ("organization_id","serial_number");--> statement-breakpoint
CREATE INDEX "idx_serial_numbers_item" ON "serial_numbers" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_serial_numbers_status" ON "serial_numbers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_item_audit_item" ON "item_audit_log" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_item_audit_user" ON "item_audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_item_audit_action" ON "item_audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_item_audit_created" ON "item_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_item_categories_org_code" ON "item_categories" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "idx_item_categories_path" ON "item_categories" USING btree ("path");--> statement-breakpoint
CREATE INDEX "idx_item_categories_parent" ON "item_categories" USING btree ("parent_category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_items_org_item_code" ON "items" USING btree ("organization_id","item_code");--> statement-breakpoint
CREATE INDEX "idx_items_category" ON "items" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_items_type" ON "items" USING btree ("item_type");--> statement-breakpoint
CREATE INDEX "idx_items_sku" ON "items" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "idx_items_upc" ON "items" USING btree ("upc");--> statement-breakpoint
CREATE INDEX "idx_items_parent" ON "items" USING btree ("parent_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_customer_price_lists_unique" ON "customer_price_lists" USING btree ("customer_id","price_list_id");--> statement-breakpoint
CREATE INDEX "idx_customer_price_lists_dates" ON "customer_price_lists" USING btree ("effective_date","expiration_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_item_pricing_unique" ON "item_pricing" USING btree ("item_id","price_list_id","min_quantity","effective_date");--> statement-breakpoint
CREATE INDEX "idx_item_pricing_lookup" ON "item_pricing" USING btree ("item_id","price_list_id","effective_date","expiration_date");--> statement-breakpoint
CREATE INDEX "idx_item_pricing_dates" ON "item_pricing" USING btree ("effective_date","expiration_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_price_lists_org_code" ON "price_lists" USING btree ("organization_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_vendor_items_unique" ON "vendor_items" USING btree ("vendor_id","item_id");--> statement-breakpoint
CREATE INDEX "idx_vendor_items_item" ON "vendor_items" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_vendor_items_preferred" ON "vendor_items" USING btree ("item_id","is_preferred");