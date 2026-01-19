-- Workflow Automation Engine
-- Migration: 0014_workflow_automation.sql
-- Description: Creates tables for the workflow automation engine with triggers, actions, and execution tracking

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Types of triggers that can start a workflow
CREATE TYPE "workflow_trigger_type" AS ENUM (
  'event',
  'schedule',
  'webhook',
  'manual',
  'api'
);

-- Types of actions that can be performed in a workflow step
CREATE TYPE "workflow_action_type" AS ENUM (
  'webhook',
  'internal_action',
  'notification',
  'condition',
  'delay',
  'transform',
  'approval',
  'loop',
  'parallel',
  'sub_workflow'
);

-- Status of a workflow definition
CREATE TYPE "workflow_definition_status" AS ENUM (
  'draft',
  'active',
  'paused',
  'archived'
);

-- Status of a workflow instance execution
CREATE TYPE "workflow_instance_status" AS ENUM (
  'pending',
  'running',
  'waiting',
  'completed',
  'failed',
  'cancelled',
  'timed_out'
);

-- Status of an individual step execution
CREATE TYPE "workflow_step_execution_status" AS ENUM (
  'pending',
  'running',
  'waiting',
  'completed',
  'failed',
  'skipped',
  'cancelled'
);

-- Error handling strategy for steps
CREATE TYPE "workflow_error_strategy" AS ENUM (
  'stop',
  'continue',
  'retry',
  'branch'
);

-- Notification channel types
CREATE TYPE "notification_channel" AS ENUM (
  'email',
  'slack',
  'in_app',
  'sms',
  'webhook'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Workflow Definitions - Templates for automation workflows
CREATE TABLE "workflow_definitions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,

  -- Basic info
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "workflow_code" VARCHAR(100) NOT NULL,

  -- Versioning
  "version" INTEGER NOT NULL DEFAULT 1,
  "is_latest_version" BOOLEAN NOT NULL DEFAULT true,
  "previous_version_id" UUID REFERENCES "workflow_definitions"("id"),

  -- Status
  "status" "workflow_definition_status" NOT NULL DEFAULT 'draft',

  -- Trigger configuration
  "trigger_type" "workflow_trigger_type" NOT NULL,
  "trigger_config" JSONB NOT NULL,

  -- Global workflow settings
  "max_execution_time_ms" INTEGER DEFAULT 3600000,
  "max_retries" INTEGER DEFAULT 3,
  "retry_delay_ms" INTEGER DEFAULT 60000,
  "enable_logging" BOOLEAN NOT NULL DEFAULT true,
  "enable_metrics" BOOLEAN NOT NULL DEFAULT true,

  -- Tags and categorization
  "tags" JSONB DEFAULT '[]'::jsonb,
  "category" VARCHAR(100),

  -- Audit
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "created_by" UUID,
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_by" UUID,
  "published_at" TIMESTAMP,
  "published_by" UUID
);

-- Unique constraint for organization + workflow code + version
CREATE UNIQUE INDEX "workflow_definitions_org_code_version_idx"
  ON "workflow_definitions" ("organization_id", "workflow_code", "version");

-- Index for filtering by status
CREATE INDEX "workflow_definitions_org_status_idx"
  ON "workflow_definitions" ("organization_id", "status");

-- Index for filtering by trigger type
CREATE INDEX "workflow_definitions_trigger_type_idx"
  ON "workflow_definitions" ("organization_id", "trigger_type");


-- Workflow Steps - Individual steps within a workflow definition
CREATE TABLE "workflow_steps" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workflow_definition_id" UUID NOT NULL REFERENCES "workflow_definitions"("id") ON DELETE CASCADE,

  -- Step identification
  "step_code" VARCHAR(100) NOT NULL,
  "step_name" VARCHAR(255) NOT NULL,
  "description" TEXT,

  -- Ordering
  "step_order" INTEGER NOT NULL,

  -- Action configuration
  "action_type" "workflow_action_type" NOT NULL,
  "action_config" JSONB NOT NULL,

  -- Flow control
  "next_step_id" UUID,
  "on_error_step_id" UUID,
  "error_strategy" "workflow_error_strategy" NOT NULL DEFAULT 'stop',

  -- Step-level retry config (overrides workflow defaults)
  "max_retries" INTEGER,
  "retry_delay_ms" INTEGER,
  "timeout_ms" INTEGER,

  -- Conditional execution
  "skip_conditions" JSONB,

  -- UI positioning (for visual workflow builder)
  "ui_position" JSONB,

  -- Audit
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Unique constraint for step code within a workflow
CREATE UNIQUE INDEX "workflow_steps_definition_code_idx"
  ON "workflow_steps" ("workflow_definition_id", "step_code");

-- Index for ordering steps
CREATE INDEX "workflow_steps_definition_order_idx"
  ON "workflow_steps" ("workflow_definition_id", "step_order");


-- Workflow Instances - Runtime execution of a workflow
CREATE TABLE "workflow_instances" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "workflow_definition_id" UUID NOT NULL REFERENCES "workflow_definitions"("id"),

  -- Snapshot of definition at execution time
  "definition_snapshot" JSONB NOT NULL,

  -- Execution tracking
  "status" "workflow_instance_status" NOT NULL DEFAULT 'pending',
  "current_step_id" UUID,
  "current_step_order" INTEGER,

  -- Trigger information
  "triggered_by" "workflow_trigger_type" NOT NULL,
  "trigger_context" JSONB DEFAULT '{}'::jsonb,
  "trigger_user_id" UUID,

  -- Execution context (data passed between steps)
  "execution_context" JSONB DEFAULT '{}'::jsonb,

  -- Execution metadata
  "started_at" TIMESTAMP,
  "completed_at" TIMESTAMP,
  "error_message" TEXT,
  "error_details" JSONB,

  -- Retry tracking
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "last_retry_at" TIMESTAMP,

  -- Related entities (optional, for tracking)
  "related_document_type" VARCHAR(100),
  "related_document_id" UUID,

  -- Audit
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for filtering by status
CREATE INDEX "workflow_instances_org_status_idx"
  ON "workflow_instances" ("organization_id", "status");

-- Index for finding instances by definition
CREATE INDEX "workflow_instances_definition_idx"
  ON "workflow_instances" ("workflow_definition_id");

-- Index for time-based queries
CREATE INDEX "workflow_instances_started_at_idx"
  ON "workflow_instances" ("started_at");

-- Index for document lookups
CREATE INDEX "workflow_instances_related_document_idx"
  ON "workflow_instances" ("related_document_type", "related_document_id");


-- Workflow Step Executions - Individual step execution logs
CREATE TABLE "workflow_step_executions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workflow_instance_id" UUID NOT NULL REFERENCES "workflow_instances"("id") ON DELETE CASCADE,
  "workflow_step_id" UUID NOT NULL,

  -- Step info (denormalized for query performance)
  "step_code" VARCHAR(100) NOT NULL,
  "step_order" INTEGER NOT NULL,
  "action_type" "workflow_action_type" NOT NULL,

  -- Execution tracking
  "status" "workflow_step_execution_status" NOT NULL DEFAULT 'pending',

  -- Input/Output
  "input_data" JSONB,
  "output_data" JSONB,

  -- Execution metadata
  "started_at" TIMESTAMP,
  "completed_at" TIMESTAMP,
  "duration_ms" INTEGER,

  -- Error tracking
  "error_message" TEXT,
  "error_details" JSONB,
  "error_code" VARCHAR(100),

  -- Retry tracking
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "last_retry_at" TIMESTAMP,

  -- For webhook/external calls
  "external_request_id" VARCHAR(255),
  "external_response_code" INTEGER,
  "external_response_body" JSONB,

  -- Audit
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for finding executions by instance
CREATE INDEX "workflow_step_executions_instance_idx"
  ON "workflow_step_executions" ("workflow_instance_id");

-- Index for ordering executions
CREATE INDEX "workflow_step_executions_instance_order_idx"
  ON "workflow_step_executions" ("workflow_instance_id", "step_order");

-- Index for filtering by status
CREATE INDEX "workflow_step_executions_status_idx"
  ON "workflow_step_executions" ("status");


-- Workflow Webhooks - Registered webhooks for workflow triggers
CREATE TABLE "workflow_webhooks" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "workflow_definition_id" UUID NOT NULL REFERENCES "workflow_definitions"("id") ON DELETE CASCADE,

  -- Webhook identification
  "webhook_key" VARCHAR(64) NOT NULL UNIQUE,
  "secret_key" VARCHAR(255),

  -- Configuration
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "allowed_ips" JSONB,
  "required_headers" JSONB,

  -- Rate limiting
  "rate_limit" INTEGER,
  "rate_limit_window" INTEGER DEFAULT 60,

  -- Statistics
  "total_invocations" INTEGER NOT NULL DEFAULT 0,
  "last_invoked_at" TIMESTAMP,

  -- Audit
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "expires_at" TIMESTAMP
);

-- Index for organization lookups
CREATE INDEX "workflow_webhooks_org_idx"
  ON "workflow_webhooks" ("organization_id");

-- Index for definition lookups
CREATE INDEX "workflow_webhooks_definition_idx"
  ON "workflow_webhooks" ("workflow_definition_id");


-- Workflow Schedules - Active schedules for cron-triggered workflows
CREATE TABLE "workflow_schedules" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "workflow_definition_id" UUID NOT NULL REFERENCES "workflow_definitions"("id") ON DELETE CASCADE,

  -- Schedule configuration
  "cron_expression" VARCHAR(100) NOT NULL,
  "timezone" VARCHAR(50) DEFAULT 'UTC',

  -- Status
  "is_active" BOOLEAN NOT NULL DEFAULT true,

  -- Scheduling window
  "start_date" TIMESTAMP,
  "end_date" TIMESTAMP,

  -- Execution tracking
  "last_scheduled_at" TIMESTAMP,
  "next_scheduled_at" TIMESTAMP,
  "last_instance_id" UUID,

  -- Statistics
  "total_executions" INTEGER NOT NULL DEFAULT 0,
  "successful_executions" INTEGER NOT NULL DEFAULT 0,
  "failed_executions" INTEGER NOT NULL DEFAULT 0,

  -- Audit
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for organization lookups
CREATE INDEX "workflow_schedules_org_idx"
  ON "workflow_schedules" ("organization_id");

-- Index for definition lookups
CREATE INDEX "workflow_schedules_definition_idx"
  ON "workflow_schedules" ("workflow_definition_id");

-- Index for finding next schedules to run
CREATE INDEX "workflow_schedules_next_idx"
  ON "workflow_schedules" ("next_scheduled_at")
  WHERE "is_active" = true;


-- Workflow Event Subscriptions - Event triggers registered for workflows
CREATE TABLE "workflow_event_subscriptions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "workflow_definition_id" UUID NOT NULL REFERENCES "workflow_definitions"("id") ON DELETE CASCADE,

  -- Event configuration
  "event_type" VARCHAR(255) NOT NULL,
  "document_types" JSONB,
  "conditions" JSONB,

  -- Status
  "is_active" BOOLEAN NOT NULL DEFAULT true,

  -- Statistics
  "total_triggers" INTEGER NOT NULL DEFAULT 0,
  "last_triggered_at" TIMESTAMP,

  -- Audit
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for organization lookups
CREATE INDEX "workflow_event_subscriptions_org_idx"
  ON "workflow_event_subscriptions" ("organization_id");

-- Index for event type lookups
CREATE INDEX "workflow_event_subscriptions_event_type_idx"
  ON "workflow_event_subscriptions" ("organization_id", "event_type");

-- Index for definition lookups
CREATE INDEX "workflow_event_subscriptions_definition_idx"
  ON "workflow_event_subscriptions" ("workflow_definition_id");


-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE "workflow_definitions" IS 'Workflow automation templates defining triggers, steps, and execution configuration';
COMMENT ON TABLE "workflow_steps" IS 'Individual steps/actions within a workflow definition';
COMMENT ON TABLE "workflow_instances" IS 'Runtime execution instances of workflows with context and status tracking';
COMMENT ON TABLE "workflow_step_executions" IS 'Detailed execution log for each step in a workflow instance';
COMMENT ON TABLE "workflow_webhooks" IS 'Registered webhooks that can trigger workflows';
COMMENT ON TABLE "workflow_schedules" IS 'Cron-based schedules for automatically triggering workflows';
COMMENT ON TABLE "workflow_event_subscriptions" IS 'Event subscriptions that trigger workflows on system events';
