-- Email Templates Migration
-- Stores customizable email templates with variable support for the communications system.

-- Create enum for template status
DO $$ BEGIN
  CREATE TYPE "email_template_status" AS ENUM ('draft', 'active', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for template category
DO $$ BEGIN
  CREATE TYPE "email_template_category" AS ENUM ('transactional', 'marketing', 'notification', 'workflow', 'custom');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create the email_templates table
CREATE TABLE IF NOT EXISTS "email_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "slug" varchar(100) NOT NULL,
  "description" text,
  "category" "email_template_category" DEFAULT 'custom' NOT NULL,
  "subject" varchar(500) NOT NULL,
  "html_body" text NOT NULL,
  "text_body" text,
  "variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" "email_template_status" DEFAULT 'draft' NOT NULL,
  "preview_data" jsonb DEFAULT '{}'::jsonb,
  "from_name" varchar(255),
  "from_email" varchar(255),
  "reply_to" varchar(255),
  "version" integer DEFAULT 1 NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add foreign key constraints
DO $$ BEGIN
  ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_created_by_entities_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_updated_by_entities_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS "idx_email_templates_org_slug" ON "email_templates" USING btree ("organization_id", "slug");
CREATE INDEX IF NOT EXISTS "idx_email_templates_organization" ON "email_templates" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_email_templates_org_status" ON "email_templates" USING btree ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "idx_email_templates_org_category" ON "email_templates" USING btree ("organization_id", "category");
CREATE INDEX IF NOT EXISTS "idx_email_templates_org_name" ON "email_templates" USING btree ("organization_id", "name");

-- Add comment
COMMENT ON TABLE "email_templates" IS 'Stores customizable email templates with variable support. Variables use {{variable}} syntax.';
COMMENT ON COLUMN "email_templates"."variables" IS 'Array of variable definitions: [{key, label, type, required, defaultValue}]';
COMMENT ON COLUMN "email_templates"."preview_data" IS 'Sample data for previewing the template with variables filled in';
