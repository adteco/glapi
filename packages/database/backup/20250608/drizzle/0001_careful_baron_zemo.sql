CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"addressee" text,
	"company_name" text,
	"attention" text,
	"phone_number" text,
	"line1" text,
	"line2" text,
	"city" text,
	"state_province" text,
	"postal_code" text,
	"country_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_default_recognition_pattern_id_revenue_recognition_pat";
--> statement-breakpoint
ALTER TABLE "revenue_journal_entries" DROP CONSTRAINT "revenue_journal_entries_performance_obligation_id_performance_o";
--> statement-breakpoint
ALTER TABLE "revenue_schedules" DROP CONSTRAINT "revenue_schedules_performance_obligation_id_performance_obligat";
--> statement-breakpoint
ALTER TABLE "transaction_lines" DROP CONSTRAINT "transaction_lines_performance_obligation_id_performance_obligat";
--> statement-breakpoint
ALTER TABLE "performance_obligations" DROP CONSTRAINT "performance_obligations_contract_line_item_id_contract_line_ite";
--> statement-breakpoint
ALTER TABLE "contract_line_items" DROP CONSTRAINT "contract_line_items_performance_obligation_id_performance_oblig";
--> statement-breakpoint
DROP INDEX "accounts_organization_id_account_number_idx";--> statement-breakpoint
DROP INDEX "entities_email_idx";--> statement-breakpoint
DROP INDEX "entities_org_id_idx";--> statement-breakpoint
DROP INDEX "entities_parent_idx";--> statement-breakpoint
DROP INDEX "entities_status_idx";--> statement-breakpoint
DROP INDEX "entities_types_idx";--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "address_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_default_recognition_pattern_id_revenue_recognition_patterns_id_fk" FOREIGN KEY ("default_recognition_pattern_id") REFERENCES "public"."revenue_recognition_patterns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_journal_entries" ADD CONSTRAINT "revenue_journal_entries_performance_obligation_id_performance_obligations_id_fk" FOREIGN KEY ("performance_obligation_id") REFERENCES "public"."performance_obligations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_schedules" ADD CONSTRAINT "revenue_schedules_performance_obligation_id_performance_obligations_id_fk" FOREIGN KEY ("performance_obligation_id") REFERENCES "public"."performance_obligations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_lines" ADD CONSTRAINT "transaction_lines_performance_obligation_id_performance_obligations_id_fk" FOREIGN KEY ("performance_obligation_id") REFERENCES "public"."performance_obligations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_obligations" ADD CONSTRAINT "performance_obligations_contract_line_item_id_contract_line_items_id_fk" FOREIGN KEY ("contract_line_item_id") REFERENCES "public"."contract_line_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_address_id_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_line_items" ADD CONSTRAINT "contract_line_items_performance_obligation_id_performance_obligations_id_fk" FOREIGN KEY ("performance_obligation_id") REFERENCES "public"."performance_obligations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_organization_id_account_number_idx" ON "accounts" USING btree ("organization_id","account_number");--> statement-breakpoint
CREATE INDEX "entities_email_idx" ON "entities" USING btree ("email");--> statement-breakpoint
CREATE INDEX "entities_org_id_idx" ON "entities" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "entities_parent_idx" ON "entities" USING btree ("parent_entity_id");--> statement-breakpoint
CREATE INDEX "entities_status_idx" ON "entities" USING btree ("status","is_active");--> statement-breakpoint
CREATE INDEX "entities_types_idx" ON "entities" USING btree ("entity_types");--> statement-breakpoint
ALTER TABLE "entities" DROP COLUMN "address_line_1";--> statement-breakpoint
ALTER TABLE "entities" DROP COLUMN "address_line_2";--> statement-breakpoint
ALTER TABLE "entities" DROP COLUMN "city";--> statement-breakpoint
ALTER TABLE "entities" DROP COLUMN "state_province";--> statement-breakpoint
ALTER TABLE "entities" DROP COLUMN "postal_code";--> statement-breakpoint
ALTER TABLE "entities" DROP COLUMN "country_code";