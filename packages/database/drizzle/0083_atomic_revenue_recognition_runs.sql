CREATE TABLE IF NOT EXISTS "revenue_recognition_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "subsidiary_id" uuid NOT NULL REFERENCES "subsidiaries"("id"),
  "accounting_period_id" uuid NOT NULL REFERENCES "accounting_periods"("id"),
  "idempotency_key" text NOT NULL,
  "request_hash" text NOT NULL,
  "recognition_date" date NOT NULL,
  "schedule_count" integer NOT NULL,
  "total_recognized_amount" numeric(14, 2) NOT NULL,
  "status" text DEFAULT 'completed' NOT NULL,
  "selection" jsonb NOT NULL,
  "initiated_by" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "chk_revenue_recognition_runs_completed" CHECK ("status" = 'completed'),
  CONSTRAINT "chk_revenue_recognition_runs_nonnegative_totals"
    CHECK ("schedule_count" >= 0 AND "total_recognized_amount" >= 0),
  CONSTRAINT "chk_revenue_recognition_runs_request_hash" CHECK (length("request_hash") = 64)
);

CREATE UNIQUE INDEX IF NOT EXISTS "ux_revenue_recognition_runs_org_key"
  ON "revenue_recognition_runs" ("organization_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "idx_revenue_recognition_runs_period"
  ON "revenue_recognition_runs" ("organization_id", "accounting_period_id", "created_at");

CREATE TABLE IF NOT EXISTS "revenue_recognition_run_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "recognition_run_id" uuid NOT NULL REFERENCES "revenue_recognition_runs"("id"),
  "revenue_schedule_id" uuid NOT NULL REFERENCES "revenue_schedules"("id"),
  "recognized_amount" numeric(14, 2) NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "chk_revenue_recognition_run_items_nonnegative_amount"
    CHECK ("recognized_amount" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "ux_revenue_recognition_run_items_schedule"
  ON "revenue_recognition_run_items" ("revenue_schedule_id");
CREATE UNIQUE INDEX IF NOT EXISTS "ux_revenue_recognition_run_items_run_schedule"
  ON "revenue_recognition_run_items" ("recognition_run_id", "revenue_schedule_id");

ALTER TABLE "revenue_journal_entries"
  ADD COLUMN IF NOT EXISTS "recognition_run_id" uuid REFERENCES "revenue_recognition_runs"("id");
CREATE UNIQUE INDEX IF NOT EXISTS "ux_revenue_journal_entries_automated_schedule"
  ON "revenue_journal_entries" ("revenue_schedule_id")
  WHERE "recognition_run_id" IS NOT NULL;

ALTER TABLE "revenue_recognition_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "revenue_recognition_runs" FORCE ROW LEVEL SECURITY;
ALTER TABLE "revenue_recognition_run_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "revenue_recognition_run_items" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "revenue_recognition_runs_tenant_isolation"
  ON "revenue_recognition_runs";
CREATE POLICY "revenue_recognition_runs_tenant_isolation" ON "revenue_recognition_runs"
  USING ("organization_id" = NULLIF(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_organization_id', true), '')::uuid);

DROP POLICY IF EXISTS "revenue_recognition_run_items_tenant_isolation"
  ON "revenue_recognition_run_items";
CREATE POLICY "revenue_recognition_run_items_tenant_isolation" ON "revenue_recognition_run_items"
  USING ("organization_id" = NULLIF(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_organization_id', true), '')::uuid);
