-- Migration: Add Pending Documents tables for Magic Inbox integration
-- This migration creates the schema for receiving and reviewing documents from Magic Inbox

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Source of the pending document
CREATE TYPE "pending_document_source" AS ENUM (
  'MAGIC_INBOX',
  'MANUAL_UPLOAD',
  'EMAIL_FORWARD',
  'API_IMPORT'
);

-- Document type classification (from AI analysis)
CREATE TYPE "pending_document_type" AS ENUM (
  'INVOICE',
  'PURCHASE_ORDER',
  'RECEIPT',
  'SHIPPING',
  'SUPPORT',
  'MARKETING',
  'CONTRACT',
  'REPORT',
  'NEWSLETTER',
  'MEETING',
  'CREDIT_MEMO',
  'UNKNOWN'
);

-- Pending document status
CREATE TYPE "pending_document_status" AS ENUM (
  'PENDING_REVIEW',
  'IN_REVIEW',
  'APPROVED',
  'REJECTED',
  'CONVERTED',
  'CONVERSION_FAILED',
  'ARCHIVED'
);

-- Priority level
CREATE TYPE "pending_document_priority" AS ENUM (
  'HIGH',
  'MEDIUM',
  'LOW'
);

-- Target record type for conversion
CREATE TYPE "conversion_target_type" AS ENUM (
  'VENDOR_BILL',
  'PURCHASE_ORDER',
  'VENDOR_CREDIT',
  'SUPPORT_TICKET',
  'NONE'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Pending Documents - Documents awaiting review and conversion
CREATE TABLE "pending_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organization context
  "organization_id" uuid NOT NULL,
  "subsidiary_id" uuid REFERENCES "subsidiaries"("id"),

  -- Source identification
  "source" "pending_document_source" NOT NULL DEFAULT 'MAGIC_INBOX',
  "message_id" varchar(255) UNIQUE, -- SES message ID for deduplication

  -- Document classification
  "document_type" "pending_document_type" NOT NULL DEFAULT 'UNKNOWN',
  "status" "pending_document_status" NOT NULL DEFAULT 'PENDING_REVIEW',
  "priority" "pending_document_priority" DEFAULT 'MEDIUM',

  -- Email/sender info
  "sender_email" varchar(255),
  "sender_name" varchar(255),
  "recipients" text,
  "subject" varchar(500),

  -- S3 storage for raw content
  "s3_bucket" varchar(255),
  "s3_key" varchar(500),

  -- AI analysis results
  "confidence_score" decimal(5, 4), -- 0.0000 to 1.0000
  "summary" text,
  "action_items" jsonb,
  "extracted_data" jsonb,

  -- Metadata (headers, security verdicts, attachments, etc.)
  "metadata" jsonb,

  -- Matched vendor (if AI could identify)
  "matched_vendor_id" uuid REFERENCES "entities"("id"),
  "matched_vendor_confidence" decimal(5, 4),

  -- Review tracking
  "reviewed_by" uuid,
  "reviewed_at" timestamptz,
  "review_notes" text,
  "rejection_reason" text,

  -- Conversion tracking
  "conversion_target_type" "conversion_target_type",
  "converted_to_id" uuid,
  "converted_at" timestamptz,
  "converted_by" uuid,
  "conversion_error" text,

  -- User-edited data (overrides extracted data during review)
  "edited_data" jsonb,

  -- Timestamps
  "received_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Pending Document Review History - Audit trail for review actions
CREATE TABLE "pending_document_review_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent reference
  "pending_document_id" uuid NOT NULL REFERENCES "pending_documents"("id") ON DELETE CASCADE,

  -- Action details
  "action" varchar(50) NOT NULL,

  -- Status transition
  "from_status" "pending_document_status",
  "to_status" "pending_document_status",

  -- Actor
  "performed_by" uuid NOT NULL,
  "performed_by_name" varchar(255),

  -- Details
  "notes" text,
  "changes" jsonb,

  -- Timestamp
  "performed_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Pending Documents indexes
CREATE INDEX "pd_organization_idx" ON "pending_documents" ("organization_id");
CREATE INDEX "pd_subsidiary_idx" ON "pending_documents" ("subsidiary_id");
CREATE INDEX "pd_status_idx" ON "pending_documents" ("status");
CREATE INDEX "pd_document_type_idx" ON "pending_documents" ("document_type");
CREATE INDEX "pd_priority_idx" ON "pending_documents" ("priority");
CREATE INDEX "pd_message_id_idx" ON "pending_documents" ("message_id");
CREATE INDEX "pd_received_at_idx" ON "pending_documents" ("received_at");
CREATE INDEX "pd_matched_vendor_idx" ON "pending_documents" ("matched_vendor_id");
CREATE INDEX "pd_conversion_target_idx" ON "pending_documents" ("conversion_target_type", "converted_to_id");

-- Review History indexes
CREATE INDEX "pdrh_document_idx" ON "pending_document_review_history" ("pending_document_id");
CREATE INDEX "pdrh_performed_by_idx" ON "pending_document_review_history" ("performed_by");
CREATE INDEX "pdrh_action_idx" ON "pending_document_review_history" ("action");

-- ============================================================================
-- RLS POLICIES (for multi-tenant isolation)
-- ============================================================================

-- Enable RLS on pending_documents
ALTER TABLE "pending_documents" ENABLE ROW LEVEL SECURITY;

-- Policy for organization isolation
CREATE POLICY "pending_documents_org_isolation" ON "pending_documents"
  FOR ALL
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);

-- Enable RLS on review history (inherits from parent document)
ALTER TABLE "pending_document_review_history" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pending_document_review_history_org_isolation" ON "pending_document_review_history"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM pending_documents pd
      WHERE pd.id = pending_document_review_history.pending_document_id
      AND pd.organization_id = current_setting('app.organization_id', true)::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pending_documents pd
      WHERE pd.id = pending_document_review_history.pending_document_id
      AND pd.organization_id = current_setting('app.organization_id', true)::uuid
    )
  );
