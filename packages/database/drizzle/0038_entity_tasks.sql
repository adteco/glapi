-- Entity Tasks Schema Migration
-- Polymorphic tasks that can be associated with any entity type

-- Create entity task entity type enum
DO $$ BEGIN
  CREATE TYPE "entity_task_entity_type" AS ENUM('project', 'customer', 'employee', 'vendor', 'lead', 'prospect', 'contact');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create entity task status enum
DO $$ BEGIN
  CREATE TYPE "entity_task_status" AS ENUM('not_started', 'in_progress', 'pending_review', 'completed', 'blocked', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create entity task priority enum
DO $$ BEGIN
  CREATE TYPE "entity_task_priority" AS ENUM('critical', 'high', 'medium', 'low');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create entity_tasks table
CREATE TABLE IF NOT EXISTS "entity_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "entity_type" "entity_task_entity_type" NOT NULL,
  "entity_id" uuid NOT NULL,
  "parent_task_id" uuid REFERENCES "entity_tasks"("id"),
  "title" varchar(500) NOT NULL,
  "description" text,
  "status" "entity_task_status" DEFAULT 'not_started' NOT NULL,
  "priority" "entity_task_priority" DEFAULT 'medium' NOT NULL,
  "assignee_id" uuid REFERENCES "entities"("id"),
  "reviewer_id" uuid REFERENCES "entities"("id"),
  "estimated_start_date" date,
  "estimated_end_date" date,
  "actual_start_date" date,
  "actual_end_date" date,
  "estimated_hours" numeric(10, 2),
  "actual_hours" numeric(10, 2),
  "estimated_budget" numeric(18, 4),
  "actual_cost" numeric(18, 4),
  "sort_order" integer DEFAULT 0 NOT NULL,
  "depends_on_task_ids" jsonb DEFAULT '[]'::jsonb,
  "custom_field_values" jsonb DEFAULT '{}'::jsonb,
  "is_billable" boolean DEFAULT false NOT NULL,
  "billing_rate" numeric(15, 4),
  "blocking_reason" text,
  "completed_at" timestamp with time zone,
  "created_by" uuid REFERENCES "entities"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_entity_tasks_org" ON "entity_tasks" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_entity_tasks_entity_lookup" ON "entity_tasks" ("organization_id", "entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "idx_entity_tasks_status" ON "entity_tasks" ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "idx_entity_tasks_assignee" ON "entity_tasks" ("organization_id", "assignee_id");
CREATE INDEX IF NOT EXISTS "idx_entity_tasks_parent" ON "entity_tasks" ("parent_task_id");

-- Add comment describing the table
COMMENT ON TABLE "entity_tasks" IS 'Polymorphic tasks that can be associated with any entity type (project, customer, employee, vendor, lead, prospect, contact)';
