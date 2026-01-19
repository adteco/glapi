-- Migration 0013: Associate time entries with project tasks and attachments

ALTER TABLE "time_entries"
  ADD COLUMN IF NOT EXISTS "project_task_id" uuid REFERENCES "project_tasks"("id");

CREATE INDEX IF NOT EXISTS "idx_time_entries_project_task"
  ON "time_entries" ("project_task_id");

CREATE TABLE IF NOT EXISTS "time_entry_attachments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "time_entry_id" uuid NOT NULL REFERENCES "time_entries"("id") ON DELETE CASCADE,
  "file_name" text NOT NULL,
  "file_url" text NOT NULL,
  "content_type" text,
  "file_size" bigint,
  "uploaded_by" uuid REFERENCES "users"("id"),
  "uploaded_at" timestamptz NOT NULL DEFAULT now(),
  "metadata" jsonb
);

CREATE INDEX IF NOT EXISTS "idx_time_entry_attachments_org_entry"
  ON "time_entry_attachments" ("organization_id", "time_entry_id");

CREATE INDEX IF NOT EXISTS "idx_time_entry_attachments_uploaded"
  ON "time_entry_attachments" ("uploaded_at");
