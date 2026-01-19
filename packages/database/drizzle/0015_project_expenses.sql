-- Migration 0015: Project expense capture tables

DO $$ BEGIN
  CREATE TYPE project_expense_status AS ENUM ('DRAFT','SUBMITTED','APPROVED','REJECTED','POSTED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE project_expense_type AS ENUM ('TRAVEL','MATERIALS','SUBCONTRACT','EQUIPMENT','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "project_expense_entries" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
    "subsidiary_id" uuid REFERENCES "subsidiaries"("id"),
    "employee_id" uuid NOT NULL REFERENCES "users"("id"),
    "project_id" uuid REFERENCES "projects"("id"),
    "project_task_id" uuid REFERENCES "project_tasks"("id"),
    "expense_type" project_expense_type NOT NULL DEFAULT 'OTHER',
    "vendor_name" text,
    "vendor_invoice_number" text,
    "expense_date" date NOT NULL,
    "amount" numeric(18, 4) NOT NULL,
    "currency_code" text NOT NULL DEFAULT 'USD',
    "description" text,
    "is_billable" boolean NOT NULL DEFAULT true,
    "status" project_expense_status NOT NULL DEFAULT 'DRAFT',
    "submitted_at" timestamptz,
    "submitted_by" uuid REFERENCES "users"("id"),
    "approved_at" timestamptz,
    "approved_by" uuid REFERENCES "users"("id"),
    "rejected_at" timestamptz,
    "rejected_by" uuid REFERENCES "users"("id"),
    "rejection_reason" text,
    "posted_at" timestamptz,
    "metadata" jsonb,
    "created_by" uuid REFERENCES "users"("id"),
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_project_expenses_org_date"
  ON "project_expense_entries" ("organization_id", "expense_date");
CREATE INDEX IF NOT EXISTS "idx_project_expenses_project"
  ON "project_expense_entries" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_project_expenses_status"
  ON "project_expense_entries" ("organization_id", "status");

CREATE TABLE IF NOT EXISTS "project_expense_approvals" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "expense_id" uuid NOT NULL REFERENCES "project_expense_entries"("id") ON DELETE CASCADE,
    "action" project_expense_status NOT NULL,
    "previous_status" project_expense_status,
    "new_status" project_expense_status NOT NULL,
    "performed_by" uuid NOT NULL REFERENCES "users"("id"),
    "performed_at" timestamptz NOT NULL DEFAULT now(),
    "comments" text,
    "metadata" jsonb
);

CREATE INDEX IF NOT EXISTS "idx_project_expense_approvals_expense"
  ON "project_expense_approvals" ("expense_id");

CREATE TABLE IF NOT EXISTS "project_expense_attachments" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "expense_id" uuid NOT NULL REFERENCES "project_expense_entries"("id") ON DELETE CASCADE,
    "file_name" text NOT NULL,
    "file_url" text NOT NULL,
    "content_type" text,
    "file_size" numeric,
    "uploaded_by" uuid REFERENCES "users"("id"),
    "uploaded_at" timestamptz NOT NULL DEFAULT now(),
    "metadata" jsonb
);

CREATE INDEX IF NOT EXISTS "idx_project_expense_attachments_expense"
  ON "project_expense_attachments" ("organization_id", "expense_id");
