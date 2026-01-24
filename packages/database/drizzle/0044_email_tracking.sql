-- Email Tracking Migration
-- SES webhook events and unsubscribe management for email communications.

-- Create enum for tracking event type
DO $$ BEGIN
  CREATE TYPE "email_tracking_event_type" AS ENUM ('send', 'delivery', 'bounce', 'complaint', 'reject', 'open', 'click', 'rendering_failure', 'delivery_delay');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for bounce type
DO $$ BEGIN
  CREATE TYPE "email_bounce_type" AS ENUM ('permanent', 'transient', 'undetermined');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for unsubscribe reason
DO $$ BEGIN
  CREATE TYPE "email_unsubscribe_reason" AS ENUM ('user_request', 'hard_bounce', 'complaint', 'admin_action', 'list_unsubscribe');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create the email_tracking_events table
CREATE TABLE IF NOT EXISTS "email_tracking_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "communication_event_id" uuid,
  -- Event identification
  "event_type" "email_tracking_event_type" NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL,
  -- SES identifiers
  "ses_message_id" varchar(255) NOT NULL,
  "ses_notification_id" varchar(255),
  "ses_feedback_id" varchar(255),
  -- Bounce details
  "bounce_type" "email_bounce_type",
  "bounce_sub_type" varchar(100),
  "bounced_recipients" jsonb,
  "diagnostic_code" text,
  -- Complaint details
  "complaint_feedback_type" varchar(100),
  "complained_recipients" jsonb,
  -- Click details
  "clicked_url" text,
  "link_tags" jsonb,
  -- Device/user details
  "user_agent" text,
  "ip_address" varchar(45),
  -- Raw payload for debugging
  "raw_payload" jsonb,
  -- Timestamps
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create the email_unsubscribes table
CREATE TABLE IF NOT EXISTS "email_unsubscribes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  -- Email identification
  "email" varchar(255) NOT NULL,
  "email_hash" varchar(64) NOT NULL,
  -- Entity reference
  "entity_type" varchar(50),
  "entity_id" uuid,
  -- Unsubscribe details
  "reason" "email_unsubscribe_reason" NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "unsubscribed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resubscribed_at" timestamp with time zone,
  -- Source tracking
  "source_communication_event_id" uuid,
  "source_tracking_event_id" uuid,
  -- Additional data
  "feedback" text,
  "ip_address" varchar(45),
  "user_agent" text,
  -- Timestamps
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create the email_suppression_list table for global suppressions
CREATE TABLE IF NOT EXISTS "email_suppression_list" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "email" varchar(255) NOT NULL,
  "email_hash" varchar(64) NOT NULL,
  "reason" varchar(100) NOT NULL,
  "source" varchar(100),
  "expires_at" timestamp with time zone,
  "is_permanent" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add foreign key constraints for tracking events
DO $$ BEGIN
  ALTER TABLE "email_tracking_events" ADD CONSTRAINT "email_tracking_events_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "email_tracking_events" ADD CONSTRAINT "email_tracking_events_communication_event_id_fk" FOREIGN KEY ("communication_event_id") REFERENCES "public"."communication_events"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add foreign key constraints for unsubscribes
DO $$ BEGIN
  ALTER TABLE "email_unsubscribes" ADD CONSTRAINT "email_unsubscribes_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "email_unsubscribes" ADD CONSTRAINT "email_unsubscribes_source_communication_event_id_fk" FOREIGN KEY ("source_communication_event_id") REFERENCES "public"."communication_events"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "email_unsubscribes" ADD CONSTRAINT "email_unsubscribes_source_tracking_event_id_fk" FOREIGN KEY ("source_tracking_event_id") REFERENCES "public"."email_tracking_events"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add foreign key constraints for suppression list
DO $$ BEGIN
  ALTER TABLE "email_suppression_list" ADD CONSTRAINT "email_suppression_list_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create indexes for tracking events
CREATE INDEX IF NOT EXISTS "idx_email_tracking_events_org" ON "email_tracking_events" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_email_tracking_events_communication" ON "email_tracking_events" USING btree ("communication_event_id");
CREATE INDEX IF NOT EXISTS "idx_email_tracking_events_ses_message" ON "email_tracking_events" USING btree ("ses_message_id");
CREATE INDEX IF NOT EXISTS "idx_email_tracking_events_event_type" ON "email_tracking_events" USING btree ("organization_id", "event_type");
CREATE INDEX IF NOT EXISTS "idx_email_tracking_events_occurred_at" ON "email_tracking_events" USING btree ("organization_id", "occurred_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_email_tracking_events_bounce" ON "email_tracking_events" USING btree ("organization_id", "bounce_type") WHERE event_type = 'bounce';

-- Create indexes for unsubscribes
CREATE UNIQUE INDEX IF NOT EXISTS "idx_email_unsubscribes_org_email_hash" ON "email_unsubscribes" USING btree ("organization_id", "email_hash");
CREATE INDEX IF NOT EXISTS "idx_email_unsubscribes_org" ON "email_unsubscribes" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_email_unsubscribes_org_active" ON "email_unsubscribes" USING btree ("organization_id", "is_active");
CREATE INDEX IF NOT EXISTS "idx_email_unsubscribes_entity" ON "email_unsubscribes" USING btree ("organization_id", "entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "idx_email_unsubscribes_email_hash" ON "email_unsubscribes" USING btree ("email_hash");

-- Create indexes for suppression list
CREATE UNIQUE INDEX IF NOT EXISTS "idx_email_suppression_list_org_email_hash" ON "email_suppression_list" USING btree ("organization_id", "email_hash");
CREATE INDEX IF NOT EXISTS "idx_email_suppression_list_org" ON "email_suppression_list" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_email_suppression_list_expires" ON "email_suppression_list" USING btree ("expires_at") WHERE expires_at IS NOT NULL AND is_permanent = false;

-- Add comments
COMMENT ON TABLE "email_tracking_events" IS 'Stores SES webhook events: sends, deliveries, opens, clicks, bounces, complaints';
COMMENT ON TABLE "email_unsubscribes" IS 'Tracks unsubscribed email addresses with reason and resubscription support';
COMMENT ON TABLE "email_suppression_list" IS 'Global suppression list for bounced/complained addresses';
COMMENT ON COLUMN "email_unsubscribes"."email_hash" IS 'SHA-256 hash of lowercase email for efficient lookups';
COMMENT ON COLUMN "email_suppression_list"."email_hash" IS 'SHA-256 hash of lowercase email for efficient lookups';
