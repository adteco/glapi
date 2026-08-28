DO $$ BEGIN
  CREATE TYPE "project_contract_modification_method" AS ENUM ('prospective', 'cumulative_catch_up', 'separate_contract');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "project_contract_modifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "project_contract_id" uuid NOT NULL REFERENCES "project_contracts"("id"),
  "prior_version_id" uuid NOT NULL REFERENCES "project_contract_versions"("id"),
  "revised_version_id" uuid NOT NULL REFERENCES "project_contract_versions"("id"),
  "method" "project_contract_modification_method" NOT NULL,
  "effective_date" date NOT NULL,
  "prior_allocated_amount" numeric(14,2) NOT NULL,
  "revised_allocated_amount" numeric(14,2) NOT NULL,
  "prior_recognized_amount" numeric(14,2) NOT NULL,
  "progress_percentage" numeric(9,6),
  "revised_cumulative_revenue" numeric(14,2) NOT NULL,
  "catch_up_adjustment" numeric(14,2) NOT NULL,
  "catch_up_gl_transaction_id" uuid REFERENCES "gl_transactions"("id"),
  "remaining_allocation" numeric(14,2) NOT NULL,
  "reason" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "request_hash" text NOT NULL,
  "applied_by" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "chk_project_contract_modifications_request_hash" CHECK (length("request_hash") = 64),
  CONSTRAINT "chk_project_contract_modifications_amounts" CHECK ("prior_allocated_amount" >= 0 AND "revised_allocated_amount" >= 0 AND "prior_recognized_amount" >= 0 AND "revised_cumulative_revenue" >= 0 AND "remaining_allocation" >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "ux_project_contract_modifications_org_key" ON "project_contract_modifications" ("organization_id", "idempotency_key");
CREATE UNIQUE INDEX IF NOT EXISTS "ux_project_contract_modifications_revised_version" ON "project_contract_modifications" ("revised_version_id");
CREATE INDEX IF NOT EXISTS "idx_project_contract_modifications_contract" ON "project_contract_modifications" ("organization_id", "project_contract_id", "created_at");

CREATE TABLE IF NOT EXISTS "project_contract_modification_schedules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "modification_id" uuid NOT NULL REFERENCES "project_contract_modifications"("id"),
  "superseded_schedule_id" uuid NOT NULL REFERENCES "revenue_schedules"("id"),
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "ux_project_contract_modification_schedules_schedule" ON "project_contract_modification_schedules" ("superseded_schedule_id");
CREATE INDEX IF NOT EXISTS "idx_project_contract_modification_schedules_modification" ON "project_contract_modification_schedules" ("organization_id", "modification_id");

CREATE TABLE IF NOT EXISTS "project_revenue_recognition_reversals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "subsidiary_id" uuid NOT NULL REFERENCES "subsidiaries"("id"),
  "original_run_id" uuid NOT NULL REFERENCES "revenue_recognition_runs"("id"),
  "original_gl_transaction_id" uuid NOT NULL REFERENCES "gl_transactions"("id"),
  "accounting_period_id" uuid NOT NULL REFERENCES "accounting_periods"("id"),
  "reversal_date" date NOT NULL,
  "total_reversed_amount" numeric(14,2) NOT NULL,
  "reason" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "request_hash" text NOT NULL,
  "approved_by" text NOT NULL,
  "worker_actor" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "chk_project_revenue_reversals_request_hash" CHECK (length("request_hash") = 64),
  CONSTRAINT "chk_project_revenue_reversals_total" CHECK ("total_reversed_amount" >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "ux_project_revenue_reversals_org_key" ON "project_revenue_recognition_reversals" ("organization_id", "idempotency_key");
CREATE UNIQUE INDEX IF NOT EXISTS "ux_project_revenue_reversals_original_run" ON "project_revenue_recognition_reversals" ("original_run_id");
CREATE INDEX IF NOT EXISTS "idx_project_revenue_reversals_period" ON "project_revenue_recognition_reversals" ("organization_id", "accounting_period_id", "created_at");

CREATE TABLE IF NOT EXISTS "project_revenue_recognition_reversal_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "reversal_id" uuid NOT NULL REFERENCES "project_revenue_recognition_reversals"("id"),
  "original_run_item_id" uuid NOT NULL REFERENCES "revenue_recognition_run_items"("id"),
  "revenue_schedule_id" uuid NOT NULL REFERENCES "revenue_schedules"("id"),
  "reversed_amount" numeric(14,2) NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "chk_project_revenue_reversal_items_amount" CHECK ("reversed_amount" >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "ux_project_revenue_reversal_items_original" ON "project_revenue_recognition_reversal_items" ("original_run_item_id");
CREATE INDEX IF NOT EXISTS "idx_project_revenue_reversal_items_reversal" ON "project_revenue_recognition_reversal_items" ("organization_id", "reversal_id");

ALTER TABLE "project_contract_modifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_contract_modification_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_revenue_recognition_reversals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_revenue_recognition_reversal_items" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_contract_modifications_org_isolation" ON "project_contract_modifications";
CREATE POLICY "project_contract_modifications_org_isolation" ON "project_contract_modifications" USING ("organization_id" = current_setting('app.current_organization_id', true)::uuid) WITH CHECK ("organization_id" = current_setting('app.current_organization_id', true)::uuid);
DROP POLICY IF EXISTS "project_contract_modification_schedules_org_isolation" ON "project_contract_modification_schedules";
CREATE POLICY "project_contract_modification_schedules_org_isolation" ON "project_contract_modification_schedules" USING ("organization_id" = current_setting('app.current_organization_id', true)::uuid) WITH CHECK ("organization_id" = current_setting('app.current_organization_id', true)::uuid);
DROP POLICY IF EXISTS "project_revenue_recognition_reversals_org_isolation" ON "project_revenue_recognition_reversals";
CREATE POLICY "project_revenue_recognition_reversals_org_isolation" ON "project_revenue_recognition_reversals" USING ("organization_id" = current_setting('app.current_organization_id', true)::uuid) WITH CHECK ("organization_id" = current_setting('app.current_organization_id', true)::uuid);
DROP POLICY IF EXISTS "project_revenue_recognition_reversal_items_org_isolation" ON "project_revenue_recognition_reversal_items";
CREATE POLICY "project_revenue_recognition_reversal_items_org_isolation" ON "project_revenue_recognition_reversal_items" USING ("organization_id" = current_setting('app.current_organization_id', true)::uuid) WITH CHECK ("organization_id" = current_setting('app.current_organization_id', true)::uuid);
