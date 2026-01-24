-- Task Templates Migration
-- Reusable task templates that can be instantiated to create entity_tasks records.

-- Create the task_templates table
CREATE TABLE IF NOT EXISTS "task_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"entity_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"template_data" jsonb NOT NULL,
	"category" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_created_by_entities_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS "idx_task_templates_org_name" ON "task_templates" USING btree ("organization_id","name");
CREATE INDEX IF NOT EXISTS "idx_task_templates_organization" ON "task_templates" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_task_templates_org_category" ON "task_templates" USING btree ("organization_id","category");
CREATE INDEX IF NOT EXISTS "idx_task_templates_org_active" ON "task_templates" USING btree ("organization_id","is_active");
