-- Check if entity_type_enum exists and what values it has
DO $$ 
BEGIN
    -- Check if the enum type exists
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'entity_type_enum') THEN
        -- Create the enum if it doesn't exist
        CREATE TYPE entity_type_enum AS ENUM ('Customer', 'Vendor', 'Employee', 'Partner', 'Lead', 'Prospect', 'Contact');
    ELSE
        -- Add missing values if enum exists
        -- Check and add Lead
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Lead' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'entity_type_enum')) THEN
            ALTER TYPE entity_type_enum ADD VALUE 'Lead';
        END IF;
        
        -- Check and add Prospect
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Prospect' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'entity_type_enum')) THEN
            ALTER TYPE entity_type_enum ADD VALUE 'Prospect';
        END IF;
        
        -- Check and add Contact
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Contact' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'entity_type_enum')) THEN
            ALTER TYPE entity_type_enum ADD VALUE 'Contact';
        END IF;
    END IF;
END $$;

-- Create entities table if it doesn't exist
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

-- Add foreign key constraints if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'entities_parent_entity_id_entities_id_fk') THEN
        ALTER TABLE "entities" ADD CONSTRAINT "entities_parent_entity_id_entities_id_fk" 
        FOREIGN KEY ("parent_entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'entities_primary_contact_id_entities_id_fk') THEN
        ALTER TABLE "entities" ADD CONSTRAINT "entities_primary_contact_id_entities_id_fk" 
        FOREIGN KEY ("primary_contact_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS "entities_org_id_idx" ON "entities" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "entities_types_idx" ON "entities" USING btree ("entity_types");
CREATE INDEX IF NOT EXISTS "entities_parent_idx" ON "entities" USING btree ("parent_entity_id");
CREATE INDEX IF NOT EXISTS "entities_email_idx" ON "entities" USING btree ("email");
CREATE INDEX IF NOT EXISTS "entities_status_idx" ON "entities" USING btree ("status","is_active");

-- Verify the table was created
SELECT 'Entities table created successfully' AS status;