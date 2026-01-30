-- Migration: Create project_types lookup table
-- Created: 2026-01-30
-- Description: Creates a lookup table for project types (Time & Materials, Fixed Price, etc.)

-- Create the project_types table
CREATE TABLE IF NOT EXISTS "project_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "subsidiary_id" uuid REFERENCES "subsidiaries"("id"),
  "code" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Create unique index for code per organization
CREATE UNIQUE INDEX IF NOT EXISTS "project_types_org_code_unique"
  ON "project_types" ("organization_id", "code");

-- Create index for subsidiary filtering
CREATE INDEX IF NOT EXISTS "idx_project_types_subsidiary"
  ON "project_types" ("subsidiary_id");

-- Create index for active filtering
CREATE INDEX IF NOT EXISTS "idx_project_types_active"
  ON "project_types" ("organization_id", "is_active");

-- Enable RLS on project_types table
ALTER TABLE "project_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_types" FORCE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "org_isolation_select_project_types" ON "project_types";
DROP POLICY IF EXISTS "org_isolation_insert_project_types" ON "project_types";
DROP POLICY IF EXISTS "org_isolation_update_project_types" ON "project_types";
DROP POLICY IF EXISTS "org_isolation_delete_project_types" ON "project_types";

CREATE POLICY "org_isolation_select_project_types" ON "project_types"
  FOR SELECT USING (
    organization_id::text = current_setting('app.current_organization_id', true)
  );

CREATE POLICY "org_isolation_insert_project_types" ON "project_types"
  FOR INSERT WITH CHECK (
    organization_id::text = current_setting('app.current_organization_id', true)
  );

CREATE POLICY "org_isolation_update_project_types" ON "project_types"
  FOR UPDATE
  USING (organization_id::text = current_setting('app.current_organization_id', true))
  WITH CHECK (organization_id::text = current_setting('app.current_organization_id', true));

CREATE POLICY "org_isolation_delete_project_types" ON "project_types"
  FOR DELETE USING (
    organization_id::text = current_setting('app.current_organization_id', true)
  );
