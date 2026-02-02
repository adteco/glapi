-- Migration: Add Magic Inbox Configuration tables
-- This migration creates the schema for organization-level Magic Inbox configuration,
-- email address registry, and usage tracking for billing

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Email configuration type
CREATE TYPE "magic_inbox_email_type" AS ENUM (
  'prefix',
  'custom_domain'
);

-- Domain verification status
CREATE TYPE "magic_inbox_verification_status" AS ENUM (
  'pending',
  'verified',
  'failed'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Magic Inbox Email Registry - Maps email addresses to organizations
CREATE TABLE "magic_inbox_email_registry" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organization reference
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,

  -- Email configuration
  "email_address" varchar(255) NOT NULL UNIQUE,
  "email_type" "magic_inbox_email_type" NOT NULL DEFAULT 'prefix',
  "prefix" varchar(100), -- e.g., "acme" for acme@inbox.adteco.app
  "custom_domain" varchar(255), -- e.g., "inbox.acme.com"

  -- Status
  "is_active" boolean NOT NULL DEFAULT true,

  -- Domain verification (for custom domains)
  "verification_status" "magic_inbox_verification_status",
  "verification_token" varchar(255),
  "dns_records" jsonb, -- Array of { type, host, value, priority }
  "verified_at" timestamptz,

  -- Webhook configuration
  "webhook_url" text NOT NULL,
  "webhook_secret_hash" varchar(255) NOT NULL, -- bcrypt hash of the secret

  -- Timestamps
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Magic Inbox Usage - Tracks document processing for billing
CREATE TABLE "magic_inbox_usage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organization reference
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,

  -- Billing period
  "billing_period_start" date NOT NULL,
  "billing_period_end" date NOT NULL,

  -- Usage counters
  "documents_processed" integer NOT NULL DEFAULT 0,
  "documents_converted" integer NOT NULL DEFAULT 0,
  "documents_rejected" integer NOT NULL DEFAULT 0,

  -- Billing info
  "unit_price" decimal(10, 4) NOT NULL DEFAULT 0.10, -- $0.10 per document
  "total_amount" decimal(12, 2), -- Calculated: documents_processed * unit_price

  -- Stripe integration
  "stripe_usage_record_id" varchar(255),
  "billed_at" timestamptz,

  -- Timestamps
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),

  -- Ensure one record per org per billing period
  UNIQUE("organization_id", "billing_period_start")
);

-- Magic Inbox Test Emails - Tracks test email results
CREATE TABLE "magic_inbox_test_emails" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organization reference
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,

  -- Test details
  "sent_at" timestamptz NOT NULL DEFAULT now(),
  "sent_to" varchar(255) NOT NULL,
  "received" boolean DEFAULT false,
  "received_at" timestamptz,
  "processed" boolean DEFAULT false,
  "processed_at" timestamptz,
  "pending_document_id" uuid REFERENCES "pending_documents"("id"),

  -- Error tracking
  "error" text,

  -- Expiry (tests expire after 1 hour)
  "expires_at" timestamptz NOT NULL DEFAULT (now() + interval '1 hour')
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Email Registry indexes
CREATE INDEX "mier_organization_idx" ON "magic_inbox_email_registry" ("organization_id");
CREATE INDEX "mier_email_address_idx" ON "magic_inbox_email_registry" ("email_address");
CREATE INDEX "mier_prefix_idx" ON "magic_inbox_email_registry" ("prefix") WHERE "prefix" IS NOT NULL;
CREATE INDEX "mier_custom_domain_idx" ON "magic_inbox_email_registry" ("custom_domain") WHERE "custom_domain" IS NOT NULL;
CREATE INDEX "mier_is_active_idx" ON "magic_inbox_email_registry" ("is_active");

-- Usage indexes
CREATE INDEX "miu_organization_idx" ON "magic_inbox_usage" ("organization_id");
CREATE INDEX "miu_billing_period_idx" ON "magic_inbox_usage" ("billing_period_start", "billing_period_end");
CREATE INDEX "miu_unbilled_idx" ON "magic_inbox_usage" ("billed_at") WHERE "billed_at" IS NULL;

-- Test emails indexes
CREATE INDEX "mite_organization_idx" ON "magic_inbox_test_emails" ("organization_id");
CREATE INDEX "mite_expires_at_idx" ON "magic_inbox_test_emails" ("expires_at");

-- ============================================================================
-- RLS POLICIES (for multi-tenant isolation)
-- ============================================================================

-- Enable RLS on magic_inbox_email_registry
ALTER TABLE "magic_inbox_email_registry" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "magic_inbox_email_registry_org_isolation" ON "magic_inbox_email_registry"
  FOR ALL
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);

-- Enable RLS on magic_inbox_usage
ALTER TABLE "magic_inbox_usage" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "magic_inbox_usage_org_isolation" ON "magic_inbox_usage"
  FOR ALL
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);

-- Enable RLS on magic_inbox_test_emails
ALTER TABLE "magic_inbox_test_emails" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "magic_inbox_test_emails_org_isolation" ON "magic_inbox_test_emails"
  FOR ALL
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
