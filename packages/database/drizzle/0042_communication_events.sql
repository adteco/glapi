-- Communication Events Migration
-- Tracks every email sent with full status lifecycle for audit and analytics.

-- Create enum for event type
DO $$ BEGIN
  CREATE TYPE "communication_event_type" AS ENUM ('ad_hoc', 'workflow', 'transactional', 'notification', 'bulk');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for communication status
DO $$ BEGIN
  CREATE TYPE "communication_status" AS ENUM ('pending', 'queued', 'sending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create the communication_events table
CREATE TABLE IF NOT EXISTS "communication_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  -- Polymorphic recipient
  "entity_type" varchar(50),
  "entity_id" uuid,
  -- Email details
  "to_email" varchar(255) NOT NULL,
  "to_name" varchar(255),
  "from_email" varchar(255) NOT NULL,
  "from_name" varchar(255),
  "reply_to" varchar(255),
  "cc" jsonb DEFAULT '[]'::jsonb,
  "bcc" jsonb DEFAULT '[]'::jsonb,
  -- Content
  "subject" varchar(500) NOT NULL,
  "html_body" text NOT NULL,
  "text_body" text,
  -- Template reference
  "template_id" uuid,
  "template_variables" jsonb DEFAULT '{}'::jsonb,
  -- Workflow reference
  "workflow_execution_id" uuid,
  "workflow_step_id" uuid,
  -- Event metadata
  "event_type" "communication_event_type" DEFAULT 'ad_hoc' NOT NULL,
  "status" "communication_status" DEFAULT 'pending' NOT NULL,
  -- SES tracking
  "ses_message_id" varchar(255),
  "ses_configuration_set" varchar(100),
  -- Timestamps
  "scheduled_at" timestamp with time zone,
  "queued_at" timestamp with time zone,
  "sent_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "opened_at" timestamp with time zone,
  "clicked_at" timestamp with time zone,
  "bounced_at" timestamp with time zone,
  "failed_at" timestamp with time zone,
  -- Error handling
  "error_code" varchar(100),
  "error_message" text,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "max_retries" integer DEFAULT 3 NOT NULL,
  "next_retry_at" timestamp with time zone,
  -- Audit
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add foreign key constraints
DO $$ BEGIN
  ALTER TABLE "communication_events" ADD CONSTRAINT "communication_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "communication_events" ADD CONSTRAINT "communication_events_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "communication_events" ADD CONSTRAINT "communication_events_created_by_entities_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_communication_events_organization" ON "communication_events" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_communication_events_org_status" ON "communication_events" USING btree ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "idx_communication_events_org_event_type" ON "communication_events" USING btree ("organization_id", "event_type");
CREATE INDEX IF NOT EXISTS "idx_communication_events_entity" ON "communication_events" USING btree ("organization_id", "entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "idx_communication_events_template" ON "communication_events" USING btree ("template_id");
CREATE INDEX IF NOT EXISTS "idx_communication_events_workflow_execution" ON "communication_events" USING btree ("workflow_execution_id");
CREATE INDEX IF NOT EXISTS "idx_communication_events_ses_message" ON "communication_events" USING btree ("ses_message_id");
CREATE INDEX IF NOT EXISTS "idx_communication_events_to_email" ON "communication_events" USING btree ("organization_id", "to_email");
CREATE INDEX IF NOT EXISTS "idx_communication_events_created_at" ON "communication_events" USING btree ("organization_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_communication_events_pending_retry" ON "communication_events" USING btree ("status", "next_retry_at") WHERE status = 'failed' AND next_retry_at IS NOT NULL;

-- Add comments
COMMENT ON TABLE "communication_events" IS 'Tracks every email sent with full status lifecycle, SES integration, and error handling';
COMMENT ON COLUMN "communication_events"."entity_type" IS 'Polymorphic type: customer, employee, contact, lead, etc.';
COMMENT ON COLUMN "communication_events"."ses_message_id" IS 'AWS SES Message ID for tracking webhook events';
