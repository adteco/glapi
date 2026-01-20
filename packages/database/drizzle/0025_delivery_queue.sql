-- Delivery Queue Migration
-- Adds tables for tracking report delivery with retry logic and dead letter queue

-- Delivery status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_status') THEN
        CREATE TYPE "delivery_status" AS ENUM (
            'pending',
            'processing',
            'delivered',
            'failed',
            'dead_letter'
        );
    END IF;
END$$;

-- Delivery type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_type') THEN
        CREATE TYPE "delivery_type" AS ENUM (
            'email',
            'webhook',
            'sftp',
            's3'
        );
    END IF;
END$$;

-- Delivery queue table
CREATE TABLE IF NOT EXISTS "delivery_queue" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
    "report_schedule_id" uuid REFERENCES "report_schedules"("id") ON DELETE CASCADE,
    "job_execution_id" uuid REFERENCES "report_job_executions"("id") ON DELETE CASCADE,

    -- Delivery configuration
    "delivery_type" "delivery_type" NOT NULL,
    "delivery_config" jsonb NOT NULL,

    -- Payload information
    "report_type" varchar(100) NOT NULL,
    "output_format" varchar(20) NOT NULL,
    "output_location" text,
    "output_size_bytes" integer,

    -- Status tracking
    "status" "delivery_status" DEFAULT 'pending' NOT NULL,

    -- Retry handling
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "max_attempts" integer DEFAULT 5 NOT NULL,
    "next_attempt_at" timestamp with time zone,

    -- Timing
    "scheduled_at" timestamp with time zone DEFAULT now() NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,

    -- Result tracking
    "last_error_code" varchar(50),
    "last_error_message" text,
    "last_error_stack" text,
    "delivery_response" jsonb,

    -- Dead letter metadata
    "moved_to_dead_letter_at" timestamp with time zone,
    "dead_letter_reason" text,

    -- Audit fields
    "created_by" uuid,
    "updated_by" uuid,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Delivery attempts table (audit log)
CREATE TABLE IF NOT EXISTS "delivery_attempts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "delivery_queue_id" uuid NOT NULL REFERENCES "delivery_queue"("id") ON DELETE CASCADE,
    "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),

    -- Attempt info
    "attempt_number" integer NOT NULL,

    -- Status
    "success" varchar(10) NOT NULL,

    -- Timing
    "started_at" timestamp with time zone NOT NULL,
    "completed_at" timestamp with time zone,
    "duration_ms" integer,

    -- Request details (sanitized)
    "request_payload" jsonb,

    -- Response details
    "response_status" integer,
    "response_headers" jsonb,
    "response_body" text,

    -- Error details
    "error_code" varchar(50),
    "error_message" text,
    "error_stack" text,

    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for delivery_queue
CREATE INDEX IF NOT EXISTS "delivery_queue_org_id_idx" ON "delivery_queue" ("organization_id");
CREATE INDEX IF NOT EXISTS "delivery_queue_status_idx" ON "delivery_queue" ("status");
CREATE INDEX IF NOT EXISTS "delivery_queue_next_attempt_idx" ON "delivery_queue" ("next_attempt_at");
CREATE INDEX IF NOT EXISTS "delivery_queue_schedule_id_idx" ON "delivery_queue" ("report_schedule_id");
CREATE INDEX IF NOT EXISTS "delivery_queue_execution_id_idx" ON "delivery_queue" ("job_execution_id");

-- Composite index for finding pending deliveries ready for processing
CREATE INDEX IF NOT EXISTS "delivery_queue_pending_ready_idx"
    ON "delivery_queue" ("status", "next_attempt_at")
    WHERE "status" IN ('pending', 'failed');

-- Indexes for delivery_attempts
CREATE INDEX IF NOT EXISTS "delivery_attempts_queue_id_idx" ON "delivery_attempts" ("delivery_queue_id");
CREATE INDEX IF NOT EXISTS "delivery_attempts_org_id_idx" ON "delivery_attempts" ("organization_id");

-- Add trigger for updated_at on delivery_queue
CREATE OR REPLACE FUNCTION update_delivery_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS delivery_queue_updated_at_trigger ON "delivery_queue";
CREATE TRIGGER delivery_queue_updated_at_trigger
    BEFORE UPDATE ON "delivery_queue"
    FOR EACH ROW
    EXECUTE FUNCTION update_delivery_queue_updated_at();
