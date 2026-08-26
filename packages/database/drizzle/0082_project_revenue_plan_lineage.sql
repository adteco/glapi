ALTER TABLE "performance_obligations"
  ADD COLUMN IF NOT EXISTS "project_contract_id" uuid REFERENCES "project_contracts"("id"),
  ADD COLUMN IF NOT EXISTS "project_contract_version_id" uuid REFERENCES "project_contract_versions"("id"),
  ADD COLUMN IF NOT EXISTS "project_contract_line_id" uuid REFERENCES "project_contract_lines"("id");

CREATE INDEX IF NOT EXISTS "idx_performance_obligations_project_version"
  ON "performance_obligations" ("organization_id", "project_contract_version_id");
CREATE UNIQUE INDEX IF NOT EXISTS "ux_performance_obligations_project_version_line"
  ON "performance_obligations" (
    "organization_id",
    "project_contract_version_id",
    "project_contract_line_id"
  )
  WHERE "project_contract_version_id" IS NOT NULL AND "project_contract_line_id" IS NOT NULL;

ALTER TABLE "contract_ssp_allocations"
  ADD COLUMN IF NOT EXISTS "project_contract_id" uuid REFERENCES "project_contracts"("id"),
  ADD COLUMN IF NOT EXISTS "project_contract_version_id" uuid REFERENCES "project_contract_versions"("id"),
  ADD COLUMN IF NOT EXISTS "project_contract_line_id" uuid REFERENCES "project_contract_lines"("id");

CREATE INDEX IF NOT EXISTS "idx_contract_ssp_allocations_project_version"
  ON "contract_ssp_allocations" ("organization_id", "project_contract_version_id");

ALTER TABLE "revenue_schedules"
  ADD COLUMN IF NOT EXISTS "project_contract_version_id" uuid REFERENCES "project_contract_versions"("id"),
  ADD COLUMN IF NOT EXISTS "schedule_version" integer DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS "superseded_by_schedule_id" uuid,
  ADD COLUMN IF NOT EXISTS "superseded_at" timestamptz;

CREATE INDEX IF NOT EXISTS "idx_revenue_schedules_project_version"
  ON "revenue_schedules" ("organization_id", "project_contract_version_id");
CREATE UNIQUE INDEX IF NOT EXISTS "ux_revenue_schedules_obligation_version_date"
  ON "revenue_schedules" ("performance_obligation_id", "schedule_version", "schedule_date");
