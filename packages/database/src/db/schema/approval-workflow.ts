import {
  pgTable,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  index,
  unique,
  pgEnum,
  uuid,
} from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { roles } from './rls-access-control';

/**
 * Document types that can have approval workflows configured
 */
export const approvalDocumentTypeEnum = pgEnum('approval_document_type', [
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
  'time_entry_batch',
]);

/**
 * Approval levels in the workflow chain
 */
export const approvalLevelEnum = pgEnum('approval_level', [
  'manager',
  'supervisor',
  'senior_manager',
  'finance',
  'finance_manager',
  'cfo',
  'legal',
  'executive',
  'ceo',
]);

/**
 * Status of an approval instance
 */
export const approvalInstanceStatusEnum = pgEnum('approval_instance_status', [
  'pending',
  'in_progress',
  'approved',
  'rejected',
  'escalated',
  'recalled',
  'expired',
]);

/**
 * Actions that can be taken on a workflow approval
 */
export const workflowApprovalActionEnum = pgEnum('workflow_approval_action', [
  'approve',
  'reject',
  'request_info',
  'delegate',
  'escalate',
  'recall',
]);

/**
 * Segregation of Duties conflict types
 */
export const sodConflictTypeEnum = pgEnum('sod_conflict_type', [
  'same_user',         // Same user cannot perform both actions
  'same_role',         // Users with same role cannot perform both actions
  'role_pair',         // Specific role pairs that conflict
  'subsidiary_based',  // Must be from different subsidiaries
]);

// ============================================================================
// APPROVAL POLICIES - Configurable approval templates per document type
// ============================================================================

/**
 * Approval Policies Table
 * Defines approval workflow templates per document type for an organization
 */
export const approvalPolicies = pgTable('approval_policies', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  // Policy identification
  policyName: text('policy_name').notNull(),
  policyCode: text('policy_code').notNull(),
  description: text('description'),
  documentType: approvalDocumentTypeEnum('document_type').notNull(),

  // Policy configuration
  isActive: boolean('is_active').default(true).notNull(),
  isDefault: boolean('is_default').default(false).notNull(), // Default policy for this doc type
  priority: integer('priority').default(100).notNull(), // Lower = higher priority for matching

  // Condition rules (when this policy applies)
  conditionRules: jsonb('condition_rules').$type<ApprovalConditionRule[]>().default([]),

  // Escalation configuration
  escalationEnabled: boolean('escalation_enabled').default(true).notNull(),
  defaultEscalationHours: integer('default_escalation_hours').default(48),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text('updated_by'),
}, (table) => ({
  orgIdx: index('approval_policies_org_idx').on(table.organizationId),
  docTypeIdx: index('approval_policies_doc_type_idx').on(table.documentType),
  activeIdx: index('approval_policies_active_idx').on(table.isActive),
  policyCodeUnique: unique('approval_policies_code_unique').on(table.organizationId, table.policyCode),
}));

/**
 * Approval Steps Table
 * Individual approval levels within a policy
 */
export const approvalSteps = pgTable('approval_steps', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  policyId: text('policy_id').notNull().references(() => approvalPolicies.id, { onDelete: 'cascade' }),

  // Step configuration
  stepNumber: integer('step_number').notNull(),
  stepName: text('step_name').notNull(),
  approvalLevel: approvalLevelEnum('approval_level').notNull(),

  // Who can approve
  requiredRoleIds: jsonb('required_role_ids').$type<string[]>().default([]),
  specificApproverIds: jsonb('specific_approver_ids').$type<string[]>().default([]),

  // Approval requirements
  requiredApprovals: integer('required_approvals').default(1).notNull(), // How many approvers needed
  allowSelfApproval: boolean('allow_self_approval').default(false).notNull(),

  // Conditional skip rules
  skipConditions: jsonb('skip_conditions').$type<ApprovalSkipCondition[]>().default([]),

  // Escalation for this step
  escalationHours: integer('escalation_hours'),
  escalateToLevel: approvalLevelEnum('escalate_to_level'),
  escalationNotifyRoleIds: jsonb('escalation_notify_role_ids').$type<string[]>().default([]),

  // Notifications
  notifyOnAssignment: boolean('notify_on_assignment').default(true).notNull(),
  notifyOnCompletion: boolean('notify_on_completion').default(true).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  policyIdx: index('approval_steps_policy_idx').on(table.policyId),
  stepNumberIdx: index('approval_steps_step_number_idx').on(table.policyId, table.stepNumber),
  stepUnique: unique('approval_steps_unique').on(table.policyId, table.stepNumber),
}));

// ============================================================================
// APPROVAL INSTANCES - Runtime approval chains for specific documents
// ============================================================================

/**
 * Approval Instances Table
 * Tracks approval workflow for a specific document
 */
export const approvalInstances = pgTable('approval_instances', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  // Document reference
  documentType: approvalDocumentTypeEnum('document_type').notNull(),
  documentId: text('document_id').notNull(),
  documentNumber: text('document_number'),

  // Policy reference (snapshot at time of submission)
  policyId: text('policy_id').references(() => approvalPolicies.id, { onDelete: 'set null' }),
  policySnapshot: jsonb('policy_snapshot'), // Full policy + steps at submission time

  // Workflow state
  status: approvalInstanceStatusEnum('status').default('pending').notNull(),
  currentStepNumber: integer('current_step_number').default(1).notNull(),
  totalSteps: integer('total_steps').notNull(),

  // Timing
  submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
  submittedBy: text('submitted_by').notNull(),
  requiredByDate: timestamp('required_by_date', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),

  // Final outcome
  finalApprovedBy: text('final_approved_by'),
  finalRejectedBy: text('final_rejected_by'),
  finalComments: text('final_comments'),

  // Context data
  documentAmount: text('document_amount'), // For threshold-based routing
  subsidiaryId: text('subsidiary_id'),
  departmentId: text('department_id'),
  metadata: jsonb('metadata'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('approval_instances_org_idx').on(table.organizationId),
  docTypeIdx: index('approval_instances_doc_type_idx').on(table.documentType),
  docIdIdx: index('approval_instances_doc_id_idx').on(table.documentId),
  statusIdx: index('approval_instances_status_idx').on(table.status),
  submittedAtIdx: index('approval_instances_submitted_at_idx').on(table.submittedAt),
  docUnique: unique('approval_instances_doc_unique').on(table.documentType, table.documentId),
}));

/**
 * Approval Actions Table
 * Immutable audit trail of all approval actions
 */
export const approvalActions = pgTable('approval_actions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  approvalInstanceId: text('approval_instance_id').notNull().references(() => approvalInstances.id, { onDelete: 'cascade' }),

  // Action details
  stepNumber: integer('step_number').notNull(),
  action: workflowApprovalActionEnum('action').notNull(),

  // Who performed the action
  actionBy: text('action_by').notNull(),
  actionByName: text('action_by_name'),
  actionByRoleId: uuid('action_by_role_id'),
  actionAt: timestamp('action_at', { withTimezone: true }).defaultNow().notNull(),

  // Comments and conditions
  comments: text('comments'),
  conditions: jsonb('conditions'), // Conditional approval terms

  // Delegation tracking
  delegatedFrom: text('delegated_from'),
  delegatedTo: text('delegated_to'),
  delegationReason: text('delegation_reason'),

  // Escalation tracking
  wasEscalated: boolean('was_escalated').default(false).notNull(),
  escalatedFrom: text('escalated_from'),
  escalationReason: text('escalation_reason'),

  // IP/device info for audit
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  instanceIdx: index('approval_actions_instance_idx').on(table.approvalInstanceId),
  actionByIdx: index('approval_actions_action_by_idx').on(table.actionBy),
  actionAtIdx: index('approval_actions_action_at_idx').on(table.actionAt),
  stepIdx: index('approval_actions_step_idx').on(table.approvalInstanceId, table.stepNumber),
}));

// ============================================================================
// SEGREGATION OF DUTIES - Policy definitions and enforcement
// ============================================================================

/**
 * Segregation of Duties Policies Table
 * Defines SoD rules for an organization
 */
export const sodPolicies = pgTable('sod_policies', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  // Policy identification
  policyName: text('policy_name').notNull(),
  policyCode: text('policy_code').notNull(),
  description: text('description'),

  // Configuration
  isActive: boolean('is_active').default(true).notNull(),
  enforcementMode: text('enforcement_mode').default('block').notNull(), // 'block', 'warn', 'log_only'

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text('updated_by'),
}, (table) => ({
  orgIdx: index('sod_policies_org_idx').on(table.organizationId),
  activeIdx: index('sod_policies_active_idx').on(table.isActive),
  policyCodeUnique: unique('sod_policies_code_unique').on(table.organizationId, table.policyCode),
}));

/**
 * Segregation of Duties Rules Table
 * Individual conflict rules within a policy
 */
export const sodRules = pgTable('sod_rules', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  policyId: text('policy_id').notNull().references(() => sodPolicies.id, { onDelete: 'cascade' }),

  // Rule identification
  ruleName: text('rule_name').notNull(),
  ruleCode: text('rule_code').notNull(),
  description: text('description'),

  // Conflict type
  conflictType: sodConflictTypeEnum('conflict_type').notNull(),

  // What actions conflict
  action1: text('action_1').notNull(),      // e.g., 'create', 'submit'
  action2: text('action_2').notNull(),      // e.g., 'approve', 'post'
  documentType: approvalDocumentTypeEnum('document_type'),

  // Role-based conflicts
  conflictingRoleIds: jsonb('conflicting_role_ids').$type<string[]>().default([]),

  // Additional constraints
  requireDifferentSubsidiary: boolean('require_different_subsidiary').default(false).notNull(),
  requireDifferentDepartment: boolean('require_different_department').default(false).notNull(),

  // Exemptions
  exemptRoleIds: jsonb('exempt_role_ids').$type<string[]>().default([]),
  exemptUserIds: jsonb('exempt_user_ids').$type<string[]>().default([]),

  // Configuration
  isActive: boolean('is_active').default(true).notNull(),
  severity: text('severity').default('high').notNull(), // 'critical', 'high', 'medium', 'low'

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  policyIdx: index('sod_rules_policy_idx').on(table.policyId),
  docTypeIdx: index('sod_rules_doc_type_idx').on(table.documentType),
  activeIdx: index('sod_rules_active_idx').on(table.isActive),
  ruleCodeUnique: unique('sod_rules_code_unique').on(table.policyId, table.ruleCode),
}));

/**
 * SoD Violations Log Table
 * Tracks all SoD violations (blocked or warned)
 */
export const sodViolations = pgTable('sod_violations', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  // Violation context
  ruleId: text('rule_id').references(() => sodRules.id, { onDelete: 'set null' }),
  ruleName: text('rule_name').notNull(),
  ruleCode: text('rule_code').notNull(),

  // Document context
  documentType: approvalDocumentTypeEnum('document_type').notNull(),
  documentId: text('document_id').notNull(),
  documentNumber: text('document_number'),

  // Who triggered the violation
  attemptedBy: text('attempted_by').notNull(),
  attemptedAction: text('attempted_action').notNull(),
  attemptedAt: timestamp('attempted_at', { withTimezone: true }).defaultNow().notNull(),

  // Conflict details
  conflictsWith: text('conflicts_with').notNull(), // User who performed conflicting action
  conflictingAction: text('conflicting_action').notNull(),
  conflictingActionAt: timestamp('conflicting_action_at', { withTimezone: true }),

  // Outcome
  wasBlocked: boolean('was_blocked').notNull(),
  wasOverridden: boolean('was_overridden').default(false).notNull(),
  overriddenBy: text('overridden_by'),
  overrideReason: text('override_reason'),
  overrideApprovedBy: text('override_approved_by'),

  // Severity at time of violation
  severity: text('severity').notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('sod_violations_org_idx').on(table.organizationId),
  ruleIdx: index('sod_violations_rule_idx').on(table.ruleId),
  docIdx: index('sod_violations_doc_idx').on(table.documentType, table.documentId),
  attemptedByIdx: index('sod_violations_attempted_by_idx').on(table.attemptedBy),
  attemptedAtIdx: index('sod_violations_attempted_at_idx').on(table.attemptedAt),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const approvalPoliciesRelations = relations(approvalPolicies, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [approvalPolicies.organizationId],
    references: [organizations.id],
  }),
  steps: many(approvalSteps),
  instances: many(approvalInstances),
}));

export const approvalStepsRelations = relations(approvalSteps, ({ one }) => ({
  policy: one(approvalPolicies, {
    fields: [approvalSteps.policyId],
    references: [approvalPolicies.id],
  }),
}));

export const approvalInstancesRelations = relations(approvalInstances, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [approvalInstances.organizationId],
    references: [organizations.id],
  }),
  policy: one(approvalPolicies, {
    fields: [approvalInstances.policyId],
    references: [approvalPolicies.id],
  }),
  actions: many(approvalActions),
}));

export const approvalActionsRelations = relations(approvalActions, ({ one }) => ({
  instance: one(approvalInstances, {
    fields: [approvalActions.approvalInstanceId],
    references: [approvalInstances.id],
  }),
}));

export const sodPoliciesRelations = relations(sodPolicies, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [sodPolicies.organizationId],
    references: [organizations.id],
  }),
  rules: many(sodRules),
}));

export const sodRulesRelations = relations(sodRules, ({ one, many }) => ({
  policy: one(sodPolicies, {
    fields: [sodRules.policyId],
    references: [sodPolicies.id],
  }),
  violations: many(sodViolations),
}));

export const sodViolationsRelations = relations(sodViolations, ({ one }) => ({
  organization: one(organizations, {
    fields: [sodViolations.organizationId],
    references: [organizations.id],
  }),
  rule: one(sodRules, {
    fields: [sodViolations.ruleId],
    references: [sodRules.id],
  }),
}));

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Condition rules for when a policy applies
export interface ApprovalConditionRule {
  field: string;              // 'amount', 'subsidiaryId', 'departmentId', etc.
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in';
  value: string | number | string[] | number[];
}

// Skip conditions for approval steps
export interface ApprovalSkipCondition {
  type: 'amount_less_than' | 'amount_greater_than' | 'role_match' | 'department_match';
  value: string | number | string[];
}

// Type exports
export type ApprovalPolicy = typeof approvalPolicies.$inferSelect;
export type NewApprovalPolicy = typeof approvalPolicies.$inferInsert;
export type UpdateApprovalPolicy = Partial<NewApprovalPolicy>;

export type ApprovalStep = typeof approvalSteps.$inferSelect;
export type NewApprovalStep = typeof approvalSteps.$inferInsert;
export type UpdateApprovalStep = Partial<NewApprovalStep>;

export type ApprovalInstance = typeof approvalInstances.$inferSelect;
export type NewApprovalInstance = typeof approvalInstances.$inferInsert;
export type UpdateApprovalInstance = Partial<NewApprovalInstance>;

export type WorkflowApprovalAction = typeof approvalActions.$inferSelect;
export type NewWorkflowApprovalAction = typeof approvalActions.$inferInsert;

export type SodPolicy = typeof sodPolicies.$inferSelect;
export type NewSodPolicy = typeof sodPolicies.$inferInsert;
export type UpdateSodPolicy = Partial<NewSodPolicy>;

export type SodRule = typeof sodRules.$inferSelect;
export type NewSodRule = typeof sodRules.$inferInsert;
export type UpdateSodRule = Partial<NewSodRule>;

export type SodViolation = typeof sodViolations.$inferSelect;
export type NewSodViolation = typeof sodViolations.$inferInsert;

// Enum value types
export type ApprovalDocumentType = typeof approvalDocumentTypeEnum.enumValues[number];
export type ApprovalLevel = typeof approvalLevelEnum.enumValues[number];
export type ApprovalInstanceStatus = typeof approvalInstanceStatusEnum.enumValues[number];
export type WorkflowApprovalActionType = typeof workflowApprovalActionEnum.enumValues[number];
export type SodConflictType = typeof sodConflictTypeEnum.enumValues[number];

// Enum value constants
export const ApprovalDocumentTypes = {
  JOURNAL_ENTRY: 'journal_entry',
  PURCHASE_ORDER: 'purchase_order',
  VENDOR_BILL: 'vendor_bill',
  BILL_PAYMENT: 'bill_payment',
  SALES_ORDER: 'sales_order',
  INVOICE: 'invoice',
  CUSTOMER_PAYMENT: 'customer_payment',
  CONTRACT_MODIFICATION: 'contract_modification',
  INVENTORY_ADJUSTMENT: 'inventory_adjustment',
  INVENTORY_TRANSFER: 'inventory_transfer',
  PAY_APPLICATION: 'pay_application',
  TIME_ENTRY_BATCH: 'time_entry_batch',
} as const;

export const ApprovalLevels = {
  MANAGER: 'manager',
  SUPERVISOR: 'supervisor',
  SENIOR_MANAGER: 'senior_manager',
  FINANCE: 'finance',
  FINANCE_MANAGER: 'finance_manager',
  CFO: 'cfo',
  LEGAL: 'legal',
  EXECUTIVE: 'executive',
  CEO: 'ceo',
} as const;

export const ApprovalInstanceStatuses = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ESCALATED: 'escalated',
  RECALLED: 'recalled',
  EXPIRED: 'expired',
} as const;

export const ApprovalActions = {
  APPROVE: 'approve',
  REJECT: 'reject',
  REQUEST_INFO: 'request_info',
  DELEGATE: 'delegate',
  ESCALATE: 'escalate',
  RECALL: 'recall',
} as const;

export const SodConflictTypes = {
  SAME_USER: 'same_user',
  SAME_ROLE: 'same_role',
  ROLE_PAIR: 'role_pair',
  SUBSIDIARY_BASED: 'subsidiary_based',
} as const;

export const SodEnforcementModes = {
  BLOCK: 'block',
  WARN: 'warn',
  LOG_ONLY: 'log_only',
} as const;

export const SodSeverityLevels = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;
