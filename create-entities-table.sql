-- Create entities table
CREATE TABLE IF NOT EXISTS "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"display_name" text,
	"code" text,
	"entity_types" text[] NOT NULL,
	"email" text,
	"phone" text,
	"website" text,
	"address_line_1" text,
	"address_line_2" text,
	"city" text,
	"state_province" text,
	"postal_code" text,
	"country_code" text,
	"parent_entity_id" uuid,
	"primary_contact_id" uuid,
	"tax_id" text,
	"description" text,
	"notes" text,
	"custom_fields" jsonb,
	"metadata" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entities_org_code_unique" UNIQUE("organization_id","code")
);

-- Add foreign key constraints
ALTER TABLE "entities" ADD CONSTRAINT "entities_parent_entity_id_entities_id_fk" 
FOREIGN KEY ("parent_entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "entities" ADD CONSTRAINT "entities_primary_contact_id_entities_id_fk" 
FOREIGN KEY ("primary_contact_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;

-- Create indexes
CREATE INDEX IF NOT EXISTS "entities_org_id_idx" ON "entities" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "entities_types_idx" ON "entities" USING btree ("entity_types");
CREATE INDEX IF NOT EXISTS "entities_parent_idx" ON "entities" USING btree ("parent_entity_id");
CREATE INDEX IF NOT EXISTS "entities_email_idx" ON "entities" USING btree ("email");
CREATE INDEX IF NOT EXISTS "entities_status_idx" ON "entities" USING btree ("status","is_active");