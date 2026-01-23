-- Migration: Add project tasks, templates, and milestones
-- This migration creates tables for managing project tasks with templates,
-- milestones, employee assignments, and activity code integration.

-- =============================================================================
-- ENUMS
-- =============================================================================

-- Create project task status enum
DO $$ BEGIN
  CREATE TYPE "project_task_status" AS ENUM (
    'NOT_STARTED',
    'IN_PROGRESS',
    'PENDING_REVIEW',
    'COMPLETED',
    'BLOCKED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create project task priority enum
DO $$ BEGIN
  CREATE TYPE "project_task_priority" AS ENUM (
    'CRITICAL',
    'HIGH',
    'MEDIUM',
    'LOW'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create project milestone status enum
DO $$ BEGIN
  CREATE TYPE "project_milestone_status" AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- PROJECT MILESTONES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS "project_milestones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id"),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "name" text NOT NULL,
  "description" text,
  "target_date" date,
  "completed_date" date,
  "status" "project_milestone_status" DEFAULT 'PENDING' NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_billing_milestone" boolean DEFAULT false NOT NULL,
  "metadata" jsonb,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for project_milestones
CREATE INDEX IF NOT EXISTS "idx_project_milestones_project" ON "project_milestones" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_project_milestones_status" ON "project_milestones" ("project_id", "status");
CREATE INDEX IF NOT EXISTS "idx_project_milestones_target_date" ON "project_milestones" ("target_date");
CREATE INDEX IF NOT EXISTS "idx_project_milestones_sort" ON "project_milestones" ("project_id", "sort_order");

-- =============================================================================
-- PROJECT TASK TEMPLATES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS "project_task_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "subsidiary_id" uuid REFERENCES "subsidiaries"("id"),
  "template_code" text NOT NULL,
  "template_name" text NOT NULL,
  "description" text,
  "category" text,
  "priority" "project_task_priority" DEFAULT 'MEDIUM' NOT NULL,
  "estimated_hours" numeric(10, 2),
  "instructions" text,
  "activity_code_id" uuid REFERENCES "activity_codes"("id"),
  "default_service_item_id" uuid REFERENCES "items"("id"),
  "default_assignee_id" uuid REFERENCES "entities"("id"),
  "depends_on_template_codes" jsonb DEFAULT '[]',
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for project_task_templates
CREATE UNIQUE INDEX IF NOT EXISTS "idx_project_task_templates_org_code" ON "project_task_templates" ("organization_id", "template_code");
CREATE INDEX IF NOT EXISTS "idx_project_task_templates_category" ON "project_task_templates" ("organization_id", "category");
CREATE INDEX IF NOT EXISTS "idx_project_task_templates_active" ON "project_task_templates" ("organization_id", "is_active");
CREATE INDEX IF NOT EXISTS "idx_project_task_templates_subsidiary" ON "project_task_templates" ("subsidiary_id");

-- =============================================================================
-- PROJECT TASKS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS "project_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id"),
  "milestone_id" uuid REFERENCES "project_milestones"("id"),
  "template_id" uuid REFERENCES "project_task_templates"("id"),
  "parent_task_id" uuid REFERENCES "project_tasks"("id"),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "task_code" text,
  "task_name" text NOT NULL,
  "description" text,
  "category" text,
  "priority" "project_task_priority" DEFAULT 'MEDIUM' NOT NULL,
  "status" "project_task_status" DEFAULT 'NOT_STARTED' NOT NULL,
  "activity_code_id" uuid REFERENCES "activity_codes"("id"),
  "service_item_id" uuid REFERENCES "items"("id"),
  "assignee_id" uuid REFERENCES "entities"("id"),
  "reviewer_id" uuid REFERENCES "entities"("id"),
  "due_date" timestamp with time zone,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "reviewed_at" timestamp with time zone,
  "estimated_hours" numeric(10, 2),
  "actual_hours" numeric(10, 2),
  "depends_on_task_ids" jsonb DEFAULT '[]',
  "blocked_reason" text,
  "work_notes" text,
  "review_notes" text,
  "attachment_urls" jsonb DEFAULT '[]',
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_billable" boolean DEFAULT true NOT NULL,
  "billing_rate" numeric(15, 4),
  "metadata" jsonb,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for project_tasks
CREATE INDEX IF NOT EXISTS "idx_project_tasks_project" ON "project_tasks" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_project_tasks_milestone" ON "project_tasks" ("milestone_id");
CREATE INDEX IF NOT EXISTS "idx_project_tasks_status" ON "project_tasks" ("project_id", "status");
CREATE INDEX IF NOT EXISTS "idx_project_tasks_assignee" ON "project_tasks" ("assignee_id", "status");
CREATE INDEX IF NOT EXISTS "idx_project_tasks_due_date" ON "project_tasks" ("due_date", "status");
CREATE INDEX IF NOT EXISTS "idx_project_tasks_parent" ON "project_tasks" ("parent_task_id");
CREATE INDEX IF NOT EXISTS "idx_project_tasks_org" ON "project_tasks" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_project_tasks_project_code" ON "project_tasks" ("project_id", "task_code");

-- =============================================================================
-- PROJECT TEMPLATES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS "project_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "subsidiary_id" uuid REFERENCES "subsidiaries"("id"),
  "template_code" text NOT NULL,
  "template_name" text NOT NULL,
  "description" text,
  "project_type" text,
  "default_milestones" jsonb DEFAULT '[]',
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for project_templates
CREATE UNIQUE INDEX IF NOT EXISTS "idx_project_templates_org_code" ON "project_templates" ("organization_id", "template_code");
CREATE INDEX IF NOT EXISTS "idx_project_templates_type" ON "project_templates" ("organization_id", "project_type");
CREATE INDEX IF NOT EXISTS "idx_project_templates_active" ON "project_templates" ("organization_id", "is_active");
CREATE INDEX IF NOT EXISTS "idx_project_templates_subsidiary" ON "project_templates" ("subsidiary_id");

-- =============================================================================
-- PROJECT TEMPLATE TASKS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS "project_template_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_template_id" uuid NOT NULL REFERENCES "project_templates"("id") ON DELETE CASCADE,
  "task_template_id" uuid NOT NULL REFERENCES "project_task_templates"("id"),
  "milestone_name" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for project_template_tasks
CREATE INDEX IF NOT EXISTS "idx_project_template_tasks_template" ON "project_template_tasks" ("project_template_id");
CREATE INDEX IF NOT EXISTS "idx_project_template_tasks_task" ON "project_template_tasks" ("task_template_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_project_template_tasks_unique" ON "project_template_tasks" ("project_template_id", "task_template_id");

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE "project_milestones" IS 'Key deliverables and phases for projects';
COMMENT ON TABLE "project_task_templates" IS 'Reusable task definitions for project management';
COMMENT ON TABLE "project_tasks" IS 'Task instances assigned to projects with employee assignments';
COMMENT ON TABLE "project_templates" IS 'Project templates with pre-defined milestones and tasks';
COMMENT ON TABLE "project_template_tasks" IS 'Links task templates to project templates';

COMMENT ON COLUMN "project_milestones"."is_billing_milestone" IS 'Flag for future SOV/billing integration';
COMMENT ON COLUMN "project_task_templates"."default_service_item_id" IS 'References items where itemType=SERVICE for GL integration';
COMMENT ON COLUMN "project_task_templates"."default_assignee_id" IS 'References entities where entityTypes includes Employee';
COMMENT ON COLUMN "project_tasks"."depends_on_task_ids" IS 'Array of task UUIDs this task depends on';
COMMENT ON COLUMN "project_templates"."default_milestones" IS 'JSON array of milestone definitions to create when instantiating';
