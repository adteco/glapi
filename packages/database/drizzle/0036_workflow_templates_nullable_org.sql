-- Workflow Templates: Make organization_id nullable
-- This allows system-wide templates to exist without being tied to a specific organization

-- Drop the unique constraint that includes organization_id
DROP INDEX IF EXISTS "idx_workflows_org_name";

-- Make organization_id nullable for system templates
ALTER TABLE "workflows" ALTER COLUMN "organization_id" DROP NOT NULL;

-- Create a new unique constraint that handles null organization_id for templates
-- For organization-specific workflows, name must be unique per organization
-- For system templates (organization_id IS NULL), name must be unique
CREATE UNIQUE INDEX "idx_workflows_org_name" ON "workflows" ("organization_id", "name")
  WHERE "organization_id" IS NOT NULL;

CREATE UNIQUE INDEX "idx_workflows_template_name" ON "workflows" ("name")
  WHERE "organization_id" IS NULL;

-- Add comment explaining the nullable organization_id
COMMENT ON COLUMN "workflows"."organization_id" IS 'Organization ID for org-specific workflows. NULL for system-wide templates.';
