-- Align project status casing with new enums
UPDATE "projects" SET "status" = upper("status");
ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'PLANNING';

-- Project addresses table
CREATE TABLE "project_addresses" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
    "address_type" text NOT NULL DEFAULT 'JOB_SITE',
    "address_line1" text,
    "address_line2" text,
    "city" text,
    "state" text,
    "postal_code" text,
    "country" text,
    "metadata" jsonb,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "idx_project_addresses_type"
  ON "project_addresses" ("project_id", "address_type");
CREATE INDEX "idx_project_addresses_project"
  ON "project_addresses" ("project_id");

-- Project tasks table
CREATE TABLE "project_tasks" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
    "parent_task_id" uuid REFERENCES "project_tasks"("id") ON DELETE CASCADE,
    "project_cost_code_id" uuid REFERENCES "project_cost_codes"("id") ON DELETE SET NULL,
    "task_code" text NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "status" text NOT NULL DEFAULT 'NOT_STARTED',
    "priority" text NOT NULL DEFAULT 'MEDIUM',
    "start_date" date,
    "end_date" date,
    "duration_days" integer,
    "percent_complete" numeric(5, 2) NOT NULL DEFAULT '0',
    "is_milestone" boolean NOT NULL DEFAULT false,
    "sort_order" integer NOT NULL DEFAULT 0,
    "assigned_entity_id" uuid REFERENCES "entities"("id"),
    "metadata" jsonb,
    "created_by" uuid REFERENCES "users"("id"),
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "idx_project_tasks_project_code"
  ON "project_tasks" ("project_id", "task_code");
CREATE INDEX "idx_project_tasks_project"
  ON "project_tasks" ("project_id");
CREATE INDEX "idx_project_tasks_parent"
  ON "project_tasks" ("parent_task_id");
CREATE INDEX "idx_project_tasks_cost_code"
  ON "project_tasks" ("project_cost_code_id");
