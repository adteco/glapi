import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  index,
  uniqueIndex,
  pgEnum,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { entities } from './entities';

// ============================================================================
// ENUMS
// ============================================================================

export const commWorkflowTriggerTypeEnum = pgEnum('comm_workflow_trigger_type', [
  'manual',
  'entity_created',
  'entity_updated',
  'event',
  'schedule',
  'webhook',
  'form_submission',
]);

export const commWorkflowStepTypeEnum = pgEnum('comm_workflow_step_type', [
  'send_email',
  'wait_delay',
  'wait_until',
  'condition',
  'update_entity',
  'webhook',
  'branch',
  'end',
]);

export const commWorkflowExecutionStatusEnum = pgEnum('comm_workflow_execution_status', [
  'pending',
  'running',
  'waiting',
  'completed',
  'failed',
  'cancelled',
  'paused',
]);

// ============================================================================
// COMMUNICATION WORKFLOWS TABLE
// ============================================================================

export const communicationWorkflows = pgTable(
  'communication_workflows',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    // Trigger configuration
    triggerType: commWorkflowTriggerTypeEnum('trigger_type').default('manual').notNull(),
    triggerConfig: jsonb('trigger_config').default({}).$type<TriggerConfig>(),
    // Target entity filter
    targetEntityType: varchar('target_entity_type', { length: 50 }),
    filterConditions: jsonb('filter_conditions').default({}).$type<FilterConditions>(),
    // Status
    isActive: boolean('is_active').default(false).notNull(),
    isTemplate: boolean('is_template').default(false).notNull(),
    // Statistics
    totalExecutions: integer('total_executions').default(0).notNull(),
    successfulExecutions: integer('successful_executions').default(0).notNull(),
    failedExecutions: integer('failed_executions').default(0).notNull(),
    lastExecutedAt: timestamp('last_executed_at', { withTimezone: true }),
    // Audit
    createdBy: uuid('created_by').references(() => entities.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => entities.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgNameUnique: uniqueIndex('idx_communication_workflows_org_name').on(
      table.organizationId,
      table.name
    ),
    orgIdx: index('idx_communication_workflows_organization').on(table.organizationId),
    orgActiveIdx: index('idx_communication_workflows_org_active').on(
      table.organizationId,
      table.isActive
    ),
    triggerTypeIdx: index('idx_communication_workflows_trigger_type').on(
      table.organizationId,
      table.triggerType
    ),
  })
);

// ============================================================================
// WORKFLOW STEPS TABLE
// ============================================================================

export const communicationWorkflowSteps = pgTable(
  'communication_workflow_steps',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => communicationWorkflows.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    stepType: commWorkflowStepTypeEnum('step_type').notNull(),
    config: jsonb('config').default({}).notNull().$type<StepConfig>(),
    sortOrder: integer('sort_order').default(0).notNull(),
    // Flow control
    nextStepId: uuid('next_step_id'),
    branchConfig: jsonb('branch_config').$type<BranchConfig>(),
    // Visual editor position
    positionX: integer('position_x').default(0),
    positionY: integer('position_y').default(0),
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    workflowIdx: index('idx_communication_workflow_steps_workflow').on(table.workflowId),
    orderIdx: index('idx_communication_workflow_steps_order').on(
      table.workflowId,
      table.sortOrder
    ),
  })
);

// ============================================================================
// WORKFLOW EXECUTIONS TABLE
// ============================================================================

export const communicationWorkflowExecutions = pgTable(
  'communication_workflow_executions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => communicationWorkflows.id, { onDelete: 'cascade' }),
    // Target entity
    entityType: varchar('entity_type', { length: 50 }),
    entityId: uuid('entity_id'),
    // Execution state
    status: commWorkflowExecutionStatusEnum('status').default('pending').notNull(),
    currentStepId: uuid('current_step_id').references(() => communicationWorkflowSteps.id, {
      onDelete: 'set null',
    }),
    context: jsonb('context').default({}).$type<ExecutionContext>(),
    // Timestamps
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    nextStepAt: timestamp('next_step_at', { withTimezone: true }),
    pausedAt: timestamp('paused_at', { withTimezone: true }),
    // Error tracking
    errorMessage: text('error_message'),
    errorStepId: uuid('error_step_id').references(() => communicationWorkflowSteps.id, {
      onDelete: 'set null',
    }),
    // Audit
    triggeredBy: varchar('triggered_by', { length: 100 }),
    triggeredByUserId: uuid('triggered_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('idx_communication_workflow_executions_org').on(table.organizationId),
    workflowIdx: index('idx_communication_workflow_executions_workflow').on(
      table.workflowId
    ),
    statusIdx: index('idx_communication_workflow_executions_status').on(table.status),
    entityIdx: index('idx_communication_workflow_executions_entity').on(
      table.entityType,
      table.entityId
    ),
  })
);

// ============================================================================
// WORKFLOW STEP HISTORY TABLE
// ============================================================================

export const communicationWorkflowStepHistory = pgTable(
  'communication_workflow_step_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    executionId: uuid('execution_id')
      .notNull()
      .references(() => communicationWorkflowExecutions.id, { onDelete: 'cascade' }),
    stepId: uuid('step_id')
      .notNull()
      .references(() => communicationWorkflowSteps.id, { onDelete: 'cascade' }),
    stepType: commWorkflowStepTypeEnum('step_type').notNull(),
    status: varchar('status', { length: 50 }).notNull(),
    input: jsonb('input').$type<Record<string, unknown>>(),
    output: jsonb('output').$type<Record<string, unknown>>(),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),
  },
  (table) => ({
    executionIdx: index('idx_communication_workflow_step_history_execution').on(
      table.executionId
    ),
    stepIdx: index('idx_communication_workflow_step_history_step').on(table.stepId),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const communicationWorkflowsRelations = relations(
  communicationWorkflows,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [communicationWorkflows.organizationId],
      references: [organizations.id],
    }),
    createdByEntity: one(entities, {
      fields: [communicationWorkflows.createdBy],
      references: [entities.id],
      relationName: 'workflowCreator',
    }),
    updatedByEntity: one(entities, {
      fields: [communicationWorkflows.updatedBy],
      references: [entities.id],
      relationName: 'workflowUpdater',
    }),
    steps: many(communicationWorkflowSteps),
    executions: many(communicationWorkflowExecutions),
  })
);

export const communicationWorkflowStepsRelations = relations(
  communicationWorkflowSteps,
  ({ one, many }) => ({
    workflow: one(communicationWorkflows, {
      fields: [communicationWorkflowSteps.workflowId],
      references: [communicationWorkflows.id],
    }),
    nextStep: one(communicationWorkflowSteps, {
      fields: [communicationWorkflowSteps.nextStepId],
      references: [communicationWorkflowSteps.id],
      relationName: 'nextStepRelation',
    }),
    history: many(communicationWorkflowStepHistory),
  })
);

export const communicationWorkflowExecutionsRelations = relations(
  communicationWorkflowExecutions,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [communicationWorkflowExecutions.organizationId],
      references: [organizations.id],
    }),
    workflow: one(communicationWorkflows, {
      fields: [communicationWorkflowExecutions.workflowId],
      references: [communicationWorkflows.id],
    }),
    currentStep: one(communicationWorkflowSteps, {
      fields: [communicationWorkflowExecutions.currentStepId],
      references: [communicationWorkflowSteps.id],
      relationName: 'currentStepRelation',
    }),
    errorStep: one(communicationWorkflowSteps, {
      fields: [communicationWorkflowExecutions.errorStepId],
      references: [communicationWorkflowSteps.id],
      relationName: 'errorStepRelation',
    }),
    stepHistory: many(communicationWorkflowStepHistory),
  })
);

export const communicationWorkflowStepHistoryRelations = relations(
  communicationWorkflowStepHistory,
  ({ one }) => ({
    execution: one(communicationWorkflowExecutions, {
      fields: [communicationWorkflowStepHistory.executionId],
      references: [communicationWorkflowExecutions.id],
    }),
    step: one(communicationWorkflowSteps, {
      fields: [communicationWorkflowStepHistory.stepId],
      references: [communicationWorkflowSteps.id],
    }),
  })
);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Trigger types
export type WorkflowTriggerType =
  | 'manual'
  | 'entity_created'
  | 'entity_updated'
  | 'event'
  | 'schedule'
  | 'webhook'
  | 'form_submission';

// Step types
export type WorkflowStepType =
  | 'send_email'
  | 'wait_delay'
  | 'wait_until'
  | 'condition'
  | 'update_entity'
  | 'webhook'
  | 'branch'
  | 'end';

// Execution status
export type WorkflowExecutionStatus =
  | 'pending'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

// Trigger configuration types
export interface TriggerConfig {
  // For entity_created/entity_updated
  entityTypes?: string[];
  // For event triggers
  eventName?: string;
  // For schedule triggers
  cronExpression?: string;
  timezone?: string;
  // For webhook triggers
  webhookPath?: string;
}

// Filter conditions for targeting entities
export interface FilterConditions {
  rules?: FilterRule[];
  combinator?: 'and' | 'or';
}

export interface FilterRule {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'ends_with' | 'gt' | 'lt' | 'gte' | 'lte' | 'is_null' | 'is_not_null';
  value?: string | number | boolean | null;
}

// Step configuration types
export interface StepConfig {
  // For send_email step
  templateId?: string;
  templateVariables?: Record<string, string>;
  customSubject?: string;
  customBody?: string;
  recipientEmail?: string;
  recipientName?: string;
  variableOverrides?: Record<string, unknown>;
  // For wait_delay step
  delayAmount?: number;
  delayValue?: number; // Alias for delayAmount
  delayUnit?: 'minutes' | 'hours' | 'days' | 'weeks';
  // For wait_until step
  waitUntilField?: string;
  waitUntilTime?: string | Date;
  waitUntilCondition?: 'equals' | 'not_null' | 'gt' | 'lt';
  waitUntilValue?: string | number;
  // For condition step
  conditionField?: string;
  conditionOperator?: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty';
  conditionValue?: string | number | boolean;
  conditionRules?: FilterRule[];
  conditionCombinator?: 'and' | 'or';
  // For update_entity step
  updateFields?: Record<string, unknown>;
  // For webhook step
  webhookUrl?: string;
  webhookMethod?: 'POST' | 'PUT' | 'PATCH';
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  webhookHeaders?: Record<string, string>;
  webhookPayload?: Record<string, unknown>;
}

// Branch configuration
export interface BranchConfig {
  branches: Branch[];
  defaultNextStepId?: string;
}

export interface Branch {
  name: string;
  conditions: FilterRule[];
  nextStepId: string;
}

// Execution context
export interface ExecutionContext {
  entityData?: Record<string, unknown>;
  variables?: Record<string, unknown>;
  stepResults?: Record<string, unknown>;
  triggerData?: Record<string, unknown>;
  // Common recipient fields that may be in context
  email?: string;
  recipientEmail?: string;
  name?: string;
  recipientName?: string;
  lastStepOutput?: Record<string, unknown>;
  // Allow arbitrary additional fields
  [key: string]: unknown;
}

// Inferred types
export type CommunicationWorkflow = typeof communicationWorkflows.$inferSelect;
export type NewCommunicationWorkflow = typeof communicationWorkflows.$inferInsert;
export type UpdateCommunicationWorkflow = Partial<
  Omit<NewCommunicationWorkflow, 'id' | 'organizationId' | 'createdAt' | 'createdBy'>
>;

export type CommunicationWorkflowStep = typeof communicationWorkflowSteps.$inferSelect;
export type NewCommunicationWorkflowStep = typeof communicationWorkflowSteps.$inferInsert;
export type UpdateCommunicationWorkflowStep = Partial<
  Omit<NewCommunicationWorkflowStep, 'id' | 'workflowId' | 'createdAt'>
>;

export type CommunicationWorkflowExecution =
  typeof communicationWorkflowExecutions.$inferSelect;
export type NewCommunicationWorkflowExecution =
  typeof communicationWorkflowExecutions.$inferInsert;
export type UpdateCommunicationWorkflowExecution = Partial<
  Omit<
    NewCommunicationWorkflowExecution,
    'id' | 'organizationId' | 'workflowId' | 'createdAt'
  >
>;

export type CommunicationWorkflowStepHistoryRecord =
  typeof communicationWorkflowStepHistory.$inferSelect;
export type NewCommunicationWorkflowStepHistoryRecord =
  typeof communicationWorkflowStepHistory.$inferInsert;

// Status constants
export const WORKFLOW_TRIGGER_TYPE = {
  MANUAL: 'manual',
  ENTITY_CREATED: 'entity_created',
  ENTITY_UPDATED: 'entity_updated',
  EVENT: 'event',
  SCHEDULE: 'schedule',
  WEBHOOK: 'webhook',
  FORM_SUBMISSION: 'form_submission',
} as const;

export const WORKFLOW_STEP_TYPE = {
  SEND_EMAIL: 'send_email',
  WAIT_DELAY: 'wait_delay',
  WAIT_UNTIL: 'wait_until',
  CONDITION: 'condition',
  UPDATE_ENTITY: 'update_entity',
  WEBHOOK: 'webhook',
  BRANCH: 'branch',
  END: 'end',
} as const;

export const WORKFLOW_EXECUTION_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  WAITING: 'waiting',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  PAUSED: 'paused',
} as const;
