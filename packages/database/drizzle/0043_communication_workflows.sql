-- Communication Workflows Migration
-- Automated workflows with multi-step sequences, conditions, delays, and branching.

-- Create enum for trigger type
DO $$ BEGIN
  CREATE TYPE "comm_workflow_trigger_type" AS ENUM ('manual', 'entity_created', 'entity_updated', 'event', 'schedule', 'webhook', 'form_submission');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for step type
DO $$ BEGIN
  CREATE TYPE "comm_workflow_step_type" AS ENUM ('send_email', 'wait_delay', 'wait_until', 'condition', 'update_entity', 'webhook', 'branch', 'end');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for execution status
DO $$ BEGIN
  CREATE TYPE "comm_workflow_execution_status" AS ENUM ('pending', 'running', 'waiting', 'completed', 'failed', 'cancelled', 'paused');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create the communication_workflows table
CREATE TABLE IF NOT EXISTS "communication_workflows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  -- Trigger configuration
  "trigger_type" "comm_workflow_trigger_type" DEFAULT 'manual' NOT NULL,
  "trigger_config" jsonb DEFAULT '{}'::jsonb,
  -- Target entity filter
  "target_entity_type" varchar(50),
  "filter_conditions" jsonb DEFAULT '{}'::jsonb,
  -- Status
  "is_active" boolean DEFAULT false NOT NULL,
  "is_template" boolean DEFAULT false NOT NULL,
  -- Statistics
  "total_executions" integer DEFAULT 0 NOT NULL,
  "successful_executions" integer DEFAULT 0 NOT NULL,
  "failed_executions" integer DEFAULT 0 NOT NULL,
  "last_executed_at" timestamp with time zone,
  -- Audit
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create the communication_workflow_steps table
CREATE TABLE IF NOT EXISTS "communication_workflow_steps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workflow_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "step_type" "comm_workflow_step_type" NOT NULL,
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  -- Flow control
  "next_step_id" uuid,
  "branch_config" jsonb,
  -- Visual editor position
  "position_x" integer DEFAULT 0,
  "position_y" integer DEFAULT 0,
  -- Timestamps
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create the communication_workflow_executions table
CREATE TABLE IF NOT EXISTS "communication_workflow_executions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "workflow_id" uuid NOT NULL,
  -- Target entity
  "entity_type" varchar(50),
  "entity_id" uuid,
  -- Execution state
  "status" "comm_workflow_execution_status" DEFAULT 'pending' NOT NULL,
  "current_step_id" uuid,
  "context" jsonb DEFAULT '{}'::jsonb,
  -- Timestamps
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "next_step_at" timestamp with time zone,
  "paused_at" timestamp with time zone,
  -- Error tracking
  "error_message" text,
  "error_step_id" uuid,
  -- Audit
  "triggered_by" varchar(100),
  "triggered_by_user_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create execution step history table
CREATE TABLE IF NOT EXISTS "communication_workflow_step_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "execution_id" uuid NOT NULL,
  "step_id" uuid NOT NULL,
  "step_type" "comm_workflow_step_type" NOT NULL,
  "status" varchar(50) NOT NULL,
  "input" jsonb,
  "output" jsonb,
  "error_message" text,
  "started_at" timestamp with time zone NOT NULL,
  "completed_at" timestamp with time zone,
  "duration_ms" integer
);

-- Add foreign key constraints for workflows
DO $$ BEGIN
  ALTER TABLE "communication_workflows" ADD CONSTRAINT "communication_workflows_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "communication_workflows" ADD CONSTRAINT "communication_workflows_created_by_entities_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "communication_workflows" ADD CONSTRAINT "communication_workflows_updated_by_entities_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add foreign key constraints for workflow steps
DO $$ BEGIN
  ALTER TABLE "communication_workflow_steps" ADD CONSTRAINT "communication_workflow_steps_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."communication_workflows"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "communication_workflow_steps" ADD CONSTRAINT "communication_workflow_steps_next_step_id_fk" FOREIGN KEY ("next_step_id") REFERENCES "public"."communication_workflow_steps"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add foreign key constraints for workflow executions
DO $$ BEGIN
  ALTER TABLE "communication_workflow_executions" ADD CONSTRAINT "communication_workflow_executions_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "communication_workflow_executions" ADD CONSTRAINT "communication_workflow_executions_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."communication_workflows"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "communication_workflow_executions" ADD CONSTRAINT "communication_workflow_executions_current_step_id_fk" FOREIGN KEY ("current_step_id") REFERENCES "public"."communication_workflow_steps"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "communication_workflow_executions" ADD CONSTRAINT "communication_workflow_executions_error_step_id_fk" FOREIGN KEY ("error_step_id") REFERENCES "public"."communication_workflow_steps"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add foreign key constraints for step history
DO $$ BEGIN
  ALTER TABLE "communication_workflow_step_history" ADD CONSTRAINT "communication_workflow_step_history_execution_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."communication_workflow_executions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "communication_workflow_step_history" ADD CONSTRAINT "communication_workflow_step_history_step_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."communication_workflow_steps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create indexes for workflows
CREATE UNIQUE INDEX IF NOT EXISTS "idx_communication_workflows_org_name" ON "communication_workflows" USING btree ("organization_id", "name");
CREATE INDEX IF NOT EXISTS "idx_communication_workflows_organization" ON "communication_workflows" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_communication_workflows_org_active" ON "communication_workflows" USING btree ("organization_id", "is_active");
CREATE INDEX IF NOT EXISTS "idx_communication_workflows_trigger_type" ON "communication_workflows" USING btree ("organization_id", "trigger_type");

-- Create indexes for workflow steps
CREATE INDEX IF NOT EXISTS "idx_communication_workflow_steps_workflow" ON "communication_workflow_steps" USING btree ("workflow_id");
CREATE INDEX IF NOT EXISTS "idx_communication_workflow_steps_order" ON "communication_workflow_steps" USING btree ("workflow_id", "sort_order");

-- Create indexes for workflow executions
CREATE INDEX IF NOT EXISTS "idx_communication_workflow_executions_org" ON "communication_workflow_executions" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_communication_workflow_executions_workflow" ON "communication_workflow_executions" USING btree ("workflow_id");
CREATE INDEX IF NOT EXISTS "idx_communication_workflow_executions_status" ON "communication_workflow_executions" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_communication_workflow_executions_entity" ON "communication_workflow_executions" USING btree ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "idx_communication_workflow_executions_waiting" ON "communication_workflow_executions" USING btree ("status", "next_step_at") WHERE status = 'waiting';

-- Create indexes for step history
CREATE INDEX IF NOT EXISTS "idx_communication_workflow_step_history_execution" ON "communication_workflow_step_history" USING btree ("execution_id");
CREATE INDEX IF NOT EXISTS "idx_communication_workflow_step_history_step" ON "communication_workflow_step_history" USING btree ("step_id");

-- Add back-reference to communication_events
DO $$ BEGIN
  ALTER TABLE "communication_events" ADD CONSTRAINT "communication_events_workflow_execution_id_fk" FOREIGN KEY ("workflow_execution_id") REFERENCES "public"."communication_workflow_executions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "communication_events" ADD CONSTRAINT "communication_events_workflow_step_id_fk" FOREIGN KEY ("workflow_step_id") REFERENCES "public"."communication_workflow_steps"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add comments
COMMENT ON TABLE "communication_workflows" IS 'Automated email workflows with multi-step sequences';
COMMENT ON TABLE "communication_workflow_steps" IS 'Individual steps in a workflow: send email, wait, condition, etc.';
COMMENT ON TABLE "communication_workflow_executions" IS 'Running instances of workflows with state tracking';
COMMENT ON TABLE "communication_workflow_step_history" IS 'Audit trail of step executions for debugging and analytics';
