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

DO $$ BEGIN
  CREATE TYPE "journal_status" AS ENUM ('draft', 'posted', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Evolve the legacy contract journal into the application journal superset.
-- Legacy-only columns remain available, but must be nullable because automated
-- schedule recognition records use the schedule/run lineage columns instead.
ALTER TABLE "revenue_journal_entries"
  ADD COLUMN IF NOT EXISTS "organization_id" uuid REFERENCES "organizations"("id"),
  ADD COLUMN IF NOT EXISTS "revenue_schedule_id" uuid REFERENCES "revenue_schedules"("id"),
  ADD COLUMN IF NOT EXISTS "accounting_period_id" uuid REFERENCES "accounting_periods"("id"),
  ADD COLUMN IF NOT EXISTS "deferred_revenue_amount" numeric(12, 2),
  ADD COLUMN IF NOT EXISTS "recognized_revenue_amount" numeric(12, 2),
  ADD COLUMN IF NOT EXISTS "journal_entry_reference" varchar(255),
  ADD COLUMN IF NOT EXISTS "status" journal_status NOT NULL DEFAULT 'draft';

UPDATE "revenue_journal_entries" entry
SET
  "organization_id" = contract."organization_id",
  "recognized_revenue_amount" = COALESCE(entry."recognized_revenue_amount", entry."amount")
FROM "contracts" contract
WHERE entry."contract_id" = contract."id"
  AND (
    entry."organization_id" IS NULL
    OR entry."recognized_revenue_amount" IS NULL
  );

ALTER TABLE "revenue_journal_entries"
  ALTER COLUMN "contract_id" DROP NOT NULL,
  ALTER COLUMN "debit_account" DROP NOT NULL,
  ALTER COLUMN "credit_account" DROP NOT NULL,
  ALTER COLUMN "amount" DROP NOT NULL,
  ALTER COLUMN "entry_type" DROP NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "revenue_journal_entries" WHERE "organization_id" IS NULL
  ) THEN
    ALTER TABLE "revenue_journal_entries"
      ALTER COLUMN "organization_id" SET NOT NULL;
  END IF;
END $$;

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
