CREATE TABLE "customer_warehouse_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"is_default" boolean DEFAULT false,
	"effective_date" date,
	"expiration_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouse_price_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"price_list_id" uuid NOT NULL,
	"priority" numeric(10, 0) DEFAULT '1',
	"effective_date" date,
	"expiration_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"warehouse_id" text NOT NULL,
	"name" text NOT NULL,
	"location_id" uuid,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_warehouse_assignments" ADD CONSTRAINT "customer_warehouse_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_warehouse_assignments" ADD CONSTRAINT "customer_warehouse_assignments_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_warehouse_assignments" ADD CONSTRAINT "customer_warehouse_assignments_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_price_lists" ADD CONSTRAINT "warehouse_price_lists_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_price_lists" ADD CONSTRAINT "warehouse_price_lists_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_warehouse_assignments_unique_idx" ON "customer_warehouse_assignments" USING btree ("organization_id","customer_id","item_id");--> statement-breakpoint
CREATE INDEX "customer_warehouse_assignments_lookup_idx" ON "customer_warehouse_assignments" USING btree ("organization_id","customer_id","item_id","effective_date","expiration_date");--> statement-breakpoint
CREATE INDEX "customer_warehouse_assignments_warehouse_idx" ON "customer_warehouse_assignments" USING btree ("warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_price_lists_unique_idx" ON "warehouse_price_lists" USING btree ("warehouse_id","price_list_id");--> statement-breakpoint
CREATE INDEX "warehouse_price_lists_dates_idx" ON "warehouse_price_lists" USING btree ("effective_date","expiration_date");--> statement-breakpoint
CREATE INDEX "warehouse_price_lists_lookup_idx" ON "warehouse_price_lists" USING btree ("warehouse_id","effective_date","expiration_date");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_org_warehouse_id_idx" ON "warehouses" USING btree ("organization_id","warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_org_name_idx" ON "warehouses" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "warehouses_active_idx" ON "warehouses" USING btree ("organization_id","is_active");