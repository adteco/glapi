CREATE TABLE IF NOT EXISTS "project_progress_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "project_id" uuid NOT NULL REFERENCES "projects"("id"),
  "subsidiary_id" uuid REFERENCES "subsidiaries"("id"),
  "snapshot_date" date NOT NULL DEFAULT CURRENT_DATE,
  "total_budget_amount" numeric(18,4) NOT NULL DEFAULT 0,
  "total_committed_amount" numeric(18,4) NOT NULL DEFAULT 0,
  "total_actual_cost" numeric(18,4) NOT NULL DEFAULT 0,
  "total_wip_clearing" numeric(18,4) NOT NULL DEFAULT 0,
  "percent_complete" numeric(8,4) NOT NULL DEFAULT 0,
  "source_gl_transaction_id" uuid REFERENCES "gl_transactions"("id"),
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_project_progress_snapshots_proj_date"
  ON "project_progress_snapshots" ("project_id", "snapshot_date" DESC);
