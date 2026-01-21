CREATE TYPE "change_request_status" AS ENUM (
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'completed',
  'cancelled'
);

ALTER TYPE "approval_document_type" ADD VALUE IF NOT EXISTS 'change_request';

CREATE TABLE "change_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "description" text,
  "request_type" text,
  "subsystem" text,
  "risk_level" text,
  "status" change_request_status NOT NULL DEFAULT 'draft',
  "linked_resource_type" text,
  "linked_resource_id" text,
  "change_window_start" timestamptz,
  "change_window_end" timestamptz,
  "approval_instance_id" text REFERENCES "approval_instances"("id") ON DELETE set null,
  "metadata" jsonb,
  "created_by" text NOT NULL,
  "updated_by" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "submitted_at" timestamptz,
  "approved_at" timestamptz,
  "completed_at" timestamptz
);

CREATE INDEX "change_requests_org_idx" ON "change_requests"("organization_id","status");
CREATE INDEX "change_requests_approval_idx" ON "change_requests"("approval_instance_id");

ALTER TABLE "audit_evidence_packages"
  ADD COLUMN "auto_generated" boolean NOT NULL DEFAULT false,
  ADD COLUMN "change_request_id" uuid REFERENCES "change_requests"("id") ON DELETE set null;
