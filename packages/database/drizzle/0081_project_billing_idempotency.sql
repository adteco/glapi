CREATE TABLE IF NOT EXISTS "project_billing_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "idempotency_key" varchar(255) NOT NULL,
  "request_hash" varchar(64) NOT NULL,
  "status" text DEFAULT 'processing' NOT NULL,
  "response" jsonb,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "chk_project_billing_requests_status"
    CHECK ("status" IN ('processing', 'completed')),
  CONSTRAINT "chk_project_billing_requests_completed_response"
    CHECK ("status" <> 'completed' OR ("response" IS NOT NULL AND "completed_at" IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS "ux_project_billing_requests_org_key"
  ON "project_billing_requests" ("organization_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "idx_project_billing_requests_org_status"
  ON "project_billing_requests" ("organization_id", "status");

ALTER TABLE "project_billing_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_billing_requests" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_billing_requests_tenant_isolation" ON "project_billing_requests";
CREATE POLICY "project_billing_requests_tenant_isolation" ON "project_billing_requests"
  USING ("organization_id" = NULLIF(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_organization_id', true), '')::uuid);
