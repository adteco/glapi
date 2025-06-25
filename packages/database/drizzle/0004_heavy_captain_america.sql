ALTER TABLE "units_of_measure" DROP CONSTRAINT "units_of_measure_name_unique";--> statement-breakpoint
ALTER TABLE "units_of_measure" ALTER COLUMN "name" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "units_of_measure" ALTER COLUMN "abbreviation" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "units_of_measure" ALTER COLUMN "abbreviation" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "units_of_measure" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "units_of_measure" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "units_of_measure" ADD COLUMN "organization_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "units_of_measure" ADD COLUMN "code" text NOT NULL;--> statement-breakpoint
ALTER TABLE "units_of_measure" ADD COLUMN "base_unit_id" uuid;--> statement-breakpoint
ALTER TABLE "units_of_measure" ADD COLUMN "conversion_factor" numeric(18, 6) DEFAULT '1.0';--> statement-breakpoint
ALTER TABLE "units_of_measure" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "units_of_measure" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "units_of_measure" ADD CONSTRAINT "units_of_measure_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units_of_measure" ADD CONSTRAINT "units_of_measure_base_unit_id_units_of_measure_id_fk" FOREIGN KEY ("base_unit_id") REFERENCES "public"."units_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_units_of_measure_org_code" ON "units_of_measure" USING btree ("organization_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_units_of_measure_org_abbrev" ON "units_of_measure" USING btree ("organization_id","abbreviation");