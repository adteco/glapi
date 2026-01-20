-- Report Scheduling Schema
-- Provides scheduled report generation with cron/interval support and tenant scoping

-- Report schedule status enum
DO $$ BEGIN
  CREATE TYPE "report_schedule_status" AS ENUM('draft', 'active', 'paused', 'completed', 'error');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Report schedule frequency enum
DO $$ BEGIN
  CREATE TYPE "report_schedule_frequency" AS ENUM('once', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'cron');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Report type enum
DO $$ BEGIN
  CREATE TYPE "report_type" AS ENUM(
    'income_statement', 'balance_sheet', 'cash_flow_statement', 'trial_balance', 'general_ledger', 'account_activity',
    'job_cost_summary', 'wip_summary', 'project_budget_variance', 'retainage_aging',
    'revenue_forecast', 'deferred_revenue', 'subscription_metrics',
    'custom'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Job execution status enum
DO $$ BEGIN
  CREATE TYPE "job_execution_status" AS ENUM('pending', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Report output format enum
DO $$ BEGIN
  CREATE TYPE "report_output_format" AS ENUM('json', 'csv', 'pdf', 'xlsx');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Report schedules table - defines recurring report jobs
CREATE TABLE IF NOT EXISTS "report_schedules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),

  -- Schedule identification
  "name" varchar(255) NOT NULL,
  "description" text,

  -- Report configuration
  "report_type" "report_type" NOT NULL,
  "output_format" "report_output_format" DEFAULT 'json' NOT NULL,

  -- Report filters stored as JSON (date ranges, dimensions, etc.)
  "filters" jsonb DEFAULT '{}',

  -- Schedule configuration
  "frequency" "report_schedule_frequency" NOT NULL,
  "cron_expression" varchar(100),

  -- Timezone for scheduling (IANA timezone name)
  "timezone" varchar(100) DEFAULT 'UTC' NOT NULL,

  -- Interval-based scheduling options
  "day_of_week" integer,
  "day_of_month" integer,
  "month_of_year" integer,
  "time_of_day" varchar(8) DEFAULT '06:00:00',

  -- Status
  "status" "report_schedule_status" DEFAULT 'draft' NOT NULL,
  "is_enabled" boolean DEFAULT true NOT NULL,

  -- Execution tracking
  "next_run_at" timestamp with time zone,
  "last_run_at" timestamp with time zone,
  "last_success_at" timestamp with time zone,
  "last_failure_at" timestamp with time zone,
  "last_error_message" text,

  -- Run statistics
  "total_runs" integer DEFAULT 0 NOT NULL,
  "successful_runs" integer DEFAULT 0 NOT NULL,
  "failed_runs" integer DEFAULT 0 NOT NULL,

  -- Execution limits
  "max_retries" integer DEFAULT 3 NOT NULL,
  "retry_delay_seconds" integer DEFAULT 300 NOT NULL,

  -- End conditions
  "run_until" timestamp with time zone,
  "max_runs" integer,

  -- Notification configuration
  "notify_on_success" boolean DEFAULT false NOT NULL,
  "notify_on_failure" boolean DEFAULT true NOT NULL,
  "notification_emails" jsonb DEFAULT '[]',

  -- Delivery configuration (will be used by future delivery connectors)
  "delivery_config" jsonb,

  -- Metadata
  "tags" jsonb DEFAULT '[]',
  "metadata" jsonb,

  -- Audit fields
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Report job executions table - tracks each execution of a scheduled job
CREATE TABLE IF NOT EXISTS "report_job_executions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "report_schedule_id" uuid NOT NULL REFERENCES "report_schedules"("id") ON DELETE CASCADE,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),

  -- Execution identification
  "execution_number" integer NOT NULL,

  -- Status
  "status" "job_execution_status" DEFAULT 'pending' NOT NULL,

  -- Timing
  "scheduled_at" timestamp with time zone NOT NULL,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "duration_ms" integer,

  -- Retry tracking
  "attempt_number" integer DEFAULT 1 NOT NULL,
  "next_retry_at" timestamp with time zone,

  -- Results
  "output_location" text,
  "output_size_bytes" integer,
  "row_count" integer,

  -- Error tracking
  "error_code" varchar(50),
  "error_message" text,
  "error_stack" text,

  -- The filters used for this execution (snapshot)
  "filters_snapshot" jsonb,

  -- Audit fields
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for report_schedules
CREATE INDEX IF NOT EXISTS "report_schedules_org_id_idx" ON "report_schedules" ("organization_id");
CREATE INDEX IF NOT EXISTS "report_schedules_status_idx" ON "report_schedules" ("status");
CREATE INDEX IF NOT EXISTS "report_schedules_next_run_at_idx" ON "report_schedules" ("next_run_at");
CREATE INDEX IF NOT EXISTS "report_schedules_report_type_idx" ON "report_schedules" ("report_type");

-- Indexes for report_job_executions
CREATE INDEX IF NOT EXISTS "report_job_executions_schedule_id_idx" ON "report_job_executions" ("report_schedule_id");
CREATE INDEX IF NOT EXISTS "report_job_executions_org_id_idx" ON "report_job_executions" ("organization_id");
CREATE INDEX IF NOT EXISTS "report_job_executions_status_idx" ON "report_job_executions" ("status");
CREATE INDEX IF NOT EXISTS "report_job_executions_scheduled_at_idx" ON "report_job_executions" ("scheduled_at");

-- Composite index for finding pending executions efficiently
CREATE INDEX IF NOT EXISTS "report_job_executions_pending_lookup_idx"
  ON "report_job_executions" ("status", "scheduled_at")
  WHERE "status" IN ('pending', 'failed');

-- Composite index for finding schedules due for execution
CREATE INDEX IF NOT EXISTS "report_schedules_due_lookup_idx"
  ON "report_schedules" ("status", "is_enabled", "next_run_at")
  WHERE "status" = 'active' AND "is_enabled" = true;

-- Add constraints
ALTER TABLE "report_schedules" ADD CONSTRAINT "check_day_of_week_range"
  CHECK ("day_of_week" IS NULL OR ("day_of_week" >= 0 AND "day_of_week" <= 6));

ALTER TABLE "report_schedules" ADD CONSTRAINT "check_day_of_month_range"
  CHECK ("day_of_month" IS NULL OR ("day_of_month" >= 1 AND "day_of_month" <= 31));

ALTER TABLE "report_schedules" ADD CONSTRAINT "check_month_of_year_range"
  CHECK ("month_of_year" IS NULL OR ("month_of_year" >= 1 AND "month_of_year" <= 12));

-- Comment on tables
COMMENT ON TABLE "report_schedules" IS 'Scheduled report job definitions with cron/interval support and tenant scoping';
COMMENT ON TABLE "report_job_executions" IS 'Execution history for scheduled report jobs with retry tracking';
