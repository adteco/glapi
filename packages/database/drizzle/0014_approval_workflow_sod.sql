-- Migration: 0014_approval_workflow_sod.sql
-- Description: Approval Workflow and Segregation of Duties (SoD) Schema
-- Epic: glapi-r16 - Phase 3 - Approvals & segregation of duties
-- Task: glapi-r16.1 - Design approval/SOD schema

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Document types that can have approval workflows
CREATE TYPE "approval_document_type" AS ENUM (
  'journal_entry',
  'purchase_order',
  'vendor_bill',
  'bill_payment',
  'sales_order',
  'invoice',
  'customer_payment',
  'contract_modification',
  'inventory_adjustment',
  'inventory_transfer',
  'pay_application',
  'time_entry_batch'
);

-- Approval levels in the workflow chain
CREATE TYPE "approval_level" AS ENUM (
  'manager',
  'supervisor',
  'senior_manager',
  'finance',
  'finance_manager',
  'cfo',
  'legal',
  'executive',
  'ceo'
);

-- Status of an approval instance
CREATE TYPE "approval_instance_status" AS ENUM (
  'pending',
  'in_progress',
  'approved',
  'rejected',
  'escalated',
  'recalled',
  'expired'
);

-- Actions that can be taken on a workflow approval
CREATE TYPE "workflow_approval_action" AS ENUM (
  'approve',
  'reject',
  'request_info',
  'delegate',
  'escalate',
  'recall'
);

-- Segregation of Duties conflict types
CREATE TYPE "sod_conflict_type" AS ENUM (
  'same_user',
  'same_role',
  'role_pair',
  'subsidiary_based'
);

-- ============================================================================
-- APPROVAL POLICIES - Configurable approval templates per document type
-- ============================================================================

CREATE TABLE "approval_policies" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,

  -- Policy identification
  "policy_name" TEXT NOT NULL,
  "policy_code" TEXT NOT NULL,
  "description" TEXT,
  "document_type" "approval_document_type" NOT NULL,

  -- Policy configuration
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "is_default" BOOLEAN NOT NULL DEFAULT FALSE,
  "priority" INTEGER NOT NULL DEFAULT 100,

  -- Condition rules (when this policy applies)
  "condition_rules" JSONB DEFAULT '[]'::jsonb,

  -- Escalation configuration
  "escalation_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "default_escalation_hours" INTEGER DEFAULT 48,

  -- Audit
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "created_by" TEXT,
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_by" TEXT
);

-- Indexes for approval_policies
CREATE INDEX "approval_policies_org_idx" ON "approval_policies"("organization_id");
CREATE INDEX "approval_policies_doc_type_idx" ON "approval_policies"("document_type");
CREATE INDEX "approval_policies_active_idx" ON "approval_policies"("is_active");
CREATE UNIQUE INDEX "approval_policies_code_unique" ON "approval_policies"("organization_id", "policy_code");

-- ============================================================================
-- APPROVAL STEPS - Individual approval levels within a policy
-- ============================================================================

CREATE TABLE "approval_steps" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "policy_id" TEXT NOT NULL REFERENCES "approval_policies"("id") ON DELETE CASCADE,

  -- Step configuration
  "step_number" INTEGER NOT NULL,
  "step_name" TEXT NOT NULL,
  "approval_level" "approval_level" NOT NULL,

  -- Who can approve
  "required_role_ids" JSONB DEFAULT '[]'::jsonb,
  "specific_approver_ids" JSONB DEFAULT '[]'::jsonb,

  -- Approval requirements
  "required_approvals" INTEGER NOT NULL DEFAULT 1,
  "allow_self_approval" BOOLEAN NOT NULL DEFAULT FALSE,

  -- Conditional skip rules
  "skip_conditions" JSONB DEFAULT '[]'::jsonb,

  -- Escalation for this step
  "escalation_hours" INTEGER,
  "escalate_to_level" "approval_level",
  "escalation_notify_role_ids" JSONB DEFAULT '[]'::jsonb,

  -- Notifications
  "notify_on_assignment" BOOLEAN NOT NULL DEFAULT TRUE,
  "notify_on_completion" BOOLEAN NOT NULL DEFAULT TRUE,

  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for approval_steps
CREATE INDEX "approval_steps_policy_idx" ON "approval_steps"("policy_id");
CREATE INDEX "approval_steps_step_number_idx" ON "approval_steps"("policy_id", "step_number");
CREATE UNIQUE INDEX "approval_steps_unique" ON "approval_steps"("policy_id", "step_number");

-- ============================================================================
-- APPROVAL INSTANCES - Runtime approval chains for specific documents
-- ============================================================================

CREATE TABLE "approval_instances" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,

  -- Document reference
  "document_type" "approval_document_type" NOT NULL,
  "document_id" TEXT NOT NULL,
  "document_number" TEXT,

  -- Policy reference (snapshot at time of submission)
  "policy_id" TEXT REFERENCES "approval_policies"("id") ON DELETE SET NULL,
  "policy_snapshot" JSONB,

  -- Workflow state
  "status" "approval_instance_status" NOT NULL DEFAULT 'pending',
  "current_step_number" INTEGER NOT NULL DEFAULT 1,
  "total_steps" INTEGER NOT NULL,

  -- Timing
  "submitted_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "submitted_by" TEXT NOT NULL,
  "required_by_date" TIMESTAMP WITH TIME ZONE,
  "completed_at" TIMESTAMP WITH TIME ZONE,

  -- Final outcome
  "final_approved_by" TEXT,
  "final_rejected_by" TEXT,
  "final_comments" TEXT,

  -- Context data
  "document_amount" TEXT,
  "subsidiary_id" TEXT,
  "department_id" TEXT,
  "metadata" JSONB,

  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for approval_instances
CREATE INDEX "approval_instances_org_idx" ON "approval_instances"("organization_id");
CREATE INDEX "approval_instances_doc_type_idx" ON "approval_instances"("document_type");
CREATE INDEX "approval_instances_doc_id_idx" ON "approval_instances"("document_id");
CREATE INDEX "approval_instances_status_idx" ON "approval_instances"("status");
CREATE INDEX "approval_instances_submitted_at_idx" ON "approval_instances"("submitted_at");
CREATE UNIQUE INDEX "approval_instances_doc_unique" ON "approval_instances"("document_type", "document_id");

-- ============================================================================
-- APPROVAL ACTIONS - Immutable audit trail of all approval actions
-- ============================================================================

CREATE TABLE "approval_actions" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "approval_instance_id" TEXT NOT NULL REFERENCES "approval_instances"("id") ON DELETE CASCADE,

  -- Action details
  "step_number" INTEGER NOT NULL,
  "action" "workflow_approval_action" NOT NULL,

  -- Who performed the action
  "action_by" TEXT NOT NULL,
  "action_by_name" TEXT,
  "action_by_role_id" UUID,
  "action_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Comments and conditions
  "comments" TEXT,
  "conditions" JSONB,

  -- Delegation tracking
  "delegated_from" TEXT,
  "delegated_to" TEXT,
  "delegation_reason" TEXT,

  -- Escalation tracking
  "was_escalated" BOOLEAN NOT NULL DEFAULT FALSE,
  "escalated_from" TEXT,
  "escalation_reason" TEXT,

  -- IP/device info for audit
  "ip_address" TEXT,
  "user_agent" TEXT,

  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for approval_actions
CREATE INDEX "approval_actions_instance_idx" ON "approval_actions"("approval_instance_id");
CREATE INDEX "approval_actions_action_by_idx" ON "approval_actions"("action_by");
CREATE INDEX "approval_actions_action_at_idx" ON "approval_actions"("action_at");
CREATE INDEX "approval_actions_step_idx" ON "approval_actions"("approval_instance_id", "step_number");

-- ============================================================================
-- SEGREGATION OF DUTIES POLICIES
-- ============================================================================

CREATE TABLE "sod_policies" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,

  -- Policy identification
  "policy_name" TEXT NOT NULL,
  "policy_code" TEXT NOT NULL,
  "description" TEXT,

  -- Configuration
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "enforcement_mode" TEXT NOT NULL DEFAULT 'block',

  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "created_by" TEXT,
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_by" TEXT
);

-- Indexes for sod_policies
CREATE INDEX "sod_policies_org_idx" ON "sod_policies"("organization_id");
CREATE INDEX "sod_policies_active_idx" ON "sod_policies"("is_active");
CREATE UNIQUE INDEX "sod_policies_code_unique" ON "sod_policies"("organization_id", "policy_code");

-- ============================================================================
-- SEGREGATION OF DUTIES RULES
-- ============================================================================

CREATE TABLE "sod_rules" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "policy_id" TEXT NOT NULL REFERENCES "sod_policies"("id") ON DELETE CASCADE,

  -- Rule identification
  "rule_name" TEXT NOT NULL,
  "rule_code" TEXT NOT NULL,
  "description" TEXT,

  -- Conflict type
  "conflict_type" "sod_conflict_type" NOT NULL,

  -- What actions conflict
  "action_1" TEXT NOT NULL,
  "action_2" TEXT NOT NULL,
  "document_type" "approval_document_type",

  -- Role-based conflicts
  "conflicting_role_ids" JSONB DEFAULT '[]'::jsonb,

  -- Additional constraints
  "require_different_subsidiary" BOOLEAN NOT NULL DEFAULT FALSE,
  "require_different_department" BOOLEAN NOT NULL DEFAULT FALSE,

  -- Exemptions
  "exempt_role_ids" JSONB DEFAULT '[]'::jsonb,
  "exempt_user_ids" JSONB DEFAULT '[]'::jsonb,

  -- Configuration
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "severity" TEXT NOT NULL DEFAULT 'high',

  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for sod_rules
CREATE INDEX "sod_rules_policy_idx" ON "sod_rules"("policy_id");
CREATE INDEX "sod_rules_doc_type_idx" ON "sod_rules"("document_type");
CREATE INDEX "sod_rules_active_idx" ON "sod_rules"("is_active");
CREATE UNIQUE INDEX "sod_rules_code_unique" ON "sod_rules"("policy_id", "rule_code");

-- ============================================================================
-- SOD VIOLATIONS LOG - Tracks all SoD violations (blocked or warned)
-- ============================================================================

CREATE TABLE "sod_violations" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,

  -- Violation context
  "rule_id" TEXT REFERENCES "sod_rules"("id") ON DELETE SET NULL,
  "rule_name" TEXT NOT NULL,
  "rule_code" TEXT NOT NULL,

  -- Document context
  "document_type" "approval_document_type" NOT NULL,
  "document_id" TEXT NOT NULL,
  "document_number" TEXT,

  -- Who triggered the violation
  "attempted_by" TEXT NOT NULL,
  "attempted_action" TEXT NOT NULL,
  "attempted_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Conflict details
  "conflicts_with" TEXT NOT NULL,
  "conflicting_action" TEXT NOT NULL,
  "conflicting_action_at" TIMESTAMP WITH TIME ZONE,

  -- Outcome
  "was_blocked" BOOLEAN NOT NULL,
  "was_overridden" BOOLEAN NOT NULL DEFAULT FALSE,
  "overridden_by" TEXT,
  "override_reason" TEXT,
  "override_approved_by" TEXT,

  -- Severity at time of violation
  "severity" TEXT NOT NULL,

  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for sod_violations
CREATE INDEX "sod_violations_org_idx" ON "sod_violations"("organization_id");
CREATE INDEX "sod_violations_rule_idx" ON "sod_violations"("rule_id");
CREATE INDEX "sod_violations_doc_idx" ON "sod_violations"("document_type", "document_id");
CREATE INDEX "sod_violations_attempted_by_idx" ON "sod_violations"("attempted_by");
CREATE INDEX "sod_violations_attempted_at_idx" ON "sod_violations"("attempted_at");

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE "approval_policies" IS 'Configurable approval workflow templates per document type for an organization';
COMMENT ON TABLE "approval_steps" IS 'Individual approval levels within an approval policy workflow';
COMMENT ON TABLE "approval_instances" IS 'Runtime approval workflow instances for specific documents';
COMMENT ON TABLE "approval_actions" IS 'Immutable audit trail of all approval actions taken';
COMMENT ON TABLE "sod_policies" IS 'Segregation of Duties policy definitions for an organization';
COMMENT ON TABLE "sod_rules" IS 'Individual conflict rules within a SoD policy';
COMMENT ON TABLE "sod_violations" IS 'Log of all SoD violations detected (blocked or warned)';

COMMENT ON COLUMN "approval_policies"."condition_rules" IS 'JSON array of conditions determining when this policy applies (e.g., amount thresholds)';
COMMENT ON COLUMN "approval_policies"."priority" IS 'Lower values = higher priority when matching policies';
COMMENT ON COLUMN "approval_steps"."skip_conditions" IS 'Conditions under which this step can be skipped (e.g., amount_less_than)';
COMMENT ON COLUMN "approval_instances"."policy_snapshot" IS 'Full policy + steps JSON at time of submission for audit trail';
COMMENT ON COLUMN "sod_policies"."enforcement_mode" IS 'block = prevent action, warn = allow with warning, log_only = record only';
COMMENT ON COLUMN "sod_rules"."conflict_type" IS 'Type of conflict: same_user, same_role, role_pair, or subsidiary_based';
