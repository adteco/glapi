ALTER TABLE "gl_transactions"
  ADD COLUMN IF NOT EXISTS "source_event_type" text,
  ADD COLUMN IF NOT EXISTS "source_event_id" uuid,
  ADD COLUMN IF NOT EXISTS "idempotency_key" text;

CREATE UNIQUE INDEX IF NOT EXISTS "ux_gl_transactions_source_event"
  ON "gl_transactions" ("organization_id", "source_event_type", "source_event_id")
  WHERE "source_event_id" IS NOT NULL;

ALTER TABLE "gl_transaction_lines"
  ADD COLUMN IF NOT EXISTS "customer_id" uuid REFERENCES "entities"("id"),
  ADD COLUMN IF NOT EXISTS "project_contract_id" uuid REFERENCES "project_contracts"("id"),
  ADD COLUMN IF NOT EXISTS "project_contract_version_id" uuid REFERENCES "project_contract_versions"("id"),
  ADD COLUMN IF NOT EXISTS "performance_obligation_id" uuid REFERENCES "performance_obligations"("id"),
  ADD COLUMN IF NOT EXISTS "source_event_type" text,
  ADD COLUMN IF NOT EXISTS "source_event_id" uuid;

CREATE INDEX IF NOT EXISTS "idx_gl_transaction_lines_project_contract"
  ON "gl_transaction_lines" (
    "organization_id",
    "project_contract_id",
    "project_contract_version_id",
    "performance_obligation_id"
  );

ALTER TABLE "invoice_source_allocations"
  ADD COLUMN IF NOT EXISTS "project_id" uuid REFERENCES "projects"("id"),
  ADD COLUMN IF NOT EXISTS "project_contract_id" uuid REFERENCES "project_contracts"("id"),
  ADD COLUMN IF NOT EXISTS "project_contract_version_id" uuid REFERENCES "project_contract_versions"("id");
ALTER TABLE "invoice_source_allocations"
  ADD COLUMN IF NOT EXISTS "project_contract_line_id" uuid REFERENCES "project_contract_lines"("id");

CREATE INDEX IF NOT EXISTS "idx_invoice_source_allocations_project_contract"
  ON "invoice_source_allocations" (
    "organization_id",
    "project_contract_id",
    "allocation_status"
  );
