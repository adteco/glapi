-- Workflows System Migration
-- Adds workflow customization for sidebar navigation and component organization

-- Create the workflow component type enum
DO $$ BEGIN
  CREATE TYPE "public"."workflow_component_type" AS ENUM('lists', 'transactions', 'time_tracking', 'construction');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Workflows table - stores workflow definitions
CREATE TABLE IF NOT EXISTS "workflows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "name" varchar(255) NOT NULL,
  "description" text,
  "is_template" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Workflow groups table - groups within a workflow for organizing components
CREATE TABLE IF NOT EXISTS "workflow_groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workflow_id" uuid NOT NULL REFERENCES "workflows"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "display_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Workflow components table - individual components in a workflow
CREATE TABLE IF NOT EXISTS "workflow_components" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workflow_id" uuid NOT NULL REFERENCES "workflows"("id") ON DELETE CASCADE,
  "group_id" uuid REFERENCES "workflow_groups"("id") ON DELETE SET NULL,
  "component_type" "workflow_component_type" NOT NULL,
  "component_key" varchar(100) NOT NULL,
  "display_name" varchar(255) NOT NULL,
  "icon" varchar(100),
  "route" varchar(255) NOT NULL,
  "display_order" integer NOT NULL DEFAULT 0,
  "is_enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for workflows table
CREATE INDEX IF NOT EXISTS "idx_workflows_organization" ON "workflows" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_workflows_template" ON "workflows" ("is_template");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_workflows_org_name" ON "workflows" ("organization_id", "name");

-- Indexes for workflow_groups table
CREATE INDEX IF NOT EXISTS "idx_workflow_groups_workflow" ON "workflow_groups" ("workflow_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_workflow_groups_workflow_name" ON "workflow_groups" ("workflow_id", "name");
CREATE INDEX IF NOT EXISTS "idx_workflow_groups_order" ON "workflow_groups" ("workflow_id", "display_order");

-- Indexes for workflow_components table
CREATE INDEX IF NOT EXISTS "idx_workflow_components_workflow" ON "workflow_components" ("workflow_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_components_group" ON "workflow_components" ("group_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_workflow_components_workflow_key" ON "workflow_components" ("workflow_id", "component_key");
CREATE INDEX IF NOT EXISTS "idx_workflow_components_order" ON "workflow_components" ("workflow_id", "display_order");
CREATE INDEX IF NOT EXISTS "idx_workflow_components_enabled" ON "workflow_components" ("workflow_id", "is_enabled");

-- Add comments explaining the tables
COMMENT ON TABLE "workflows" IS 'Stores workflow definitions that customize the sidebar navigation for organizations';
COMMENT ON COLUMN "workflows"."is_template" IS 'If true, this is a system template that can be copied for new organizations';
COMMENT ON COLUMN "workflows"."is_active" IS 'Whether this workflow is currently active for the organization';

COMMENT ON TABLE "workflow_groups" IS 'Groups within a workflow for organizing related components together';
COMMENT ON COLUMN "workflow_groups"."display_order" IS 'Order in which groups appear in the sidebar (lower numbers first)';

COMMENT ON TABLE "workflow_components" IS 'Individual navigation components in a workflow, representing sidebar menu items';
COMMENT ON COLUMN "workflow_components"."component_type" IS 'Category of the component: lists, transactions, time_tracking, or construction';
COMMENT ON COLUMN "workflow_components"."component_key" IS 'Unique key for the component within the workflow, e.g., customers, invoices, projects';
COMMENT ON COLUMN "workflow_components"."display_name" IS 'Custom display name override for the component in the sidebar';
COMMENT ON COLUMN "workflow_components"."icon" IS 'Icon name override for the component (null uses default icon)';
COMMENT ON COLUMN "workflow_components"."route" IS 'The route path for navigation when the component is clicked';
COMMENT ON COLUMN "workflow_components"."display_order" IS 'Order in which components appear within their group (lower numbers first)';
COMMENT ON COLUMN "workflow_components"."is_enabled" IS 'Whether this component is visible in the sidebar';
