import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Types of triggers that can start a workflow
 */
export const workflowTriggerTypeEnum = pgEnum('workflow_trigger_type', [
  'event',           // Triggered by system events (document created, status changed, etc.)
  'schedule',        // Triggered on a schedule (cron expression)
  'webhook',         // Triggered by external webhook
  'manual',          // Manually triggered by user
  'api',             // Triggered via API call
]);

/**
 * Types of actions that can be performed in a workflow step
 */
export const workflowActionTypeEnum = pgEnum('workflow_action_type', [
  'webhook',         // Call external HTTP endpoint
  'internal_action', // Execute internal business logic
  'notification',    // Send notification (email, slack, in-app)
  'condition',       // Conditional branching
  'delay',           // Wait for specified duration
  'transform',       // Transform data between steps
  'approval',        // Request approval (integrates with approval workflow)
  'loop',            // Iterate over array data
  'parallel',        // Execute multiple branches in parallel
  'sub_workflow',    // Execute another workflow
]);

/**
 * Status of a workflow definition
 */
export const workflowDefinitionStatusEnum = pgEnum('workflow_definition_status', [
  'draft',           // Still being edited, cannot be triggered
  'active',          // Can be triggered
  'paused',          // Temporarily disabled
  'archived',        // No longer in use, kept for history
]);

/**
 * Status of a workflow instance execution
 */
export const workflowInstanceStatusEnum = pgEnum('workflow_instance_status', [
  'pending',         // Waiting to start
  'running',         // Currently executing
  'waiting',         // Waiting for external input (approval, webhook response)
  'completed',       // Successfully finished
  'failed',          // Failed with error
  'cancelled',       // Cancelled by user
  'timed_out',       // Exceeded max execution time
]);

/**
 * Status of an individual step execution
 */
export const workflowStepExecutionStatusEnum = pgEnum('workflow_step_execution_status', [
  'pending',         // Not yet started
  'running',         // Currently executing
  'waiting',         // Waiting for external response
  'completed',       // Successfully completed
  'failed',          // Failed (may retry)
  'skipped',         // Skipped due to condition
  'cancelled',       // Cancelled
]);

/**
 * Error handling strategy for steps
 */
export const workflowErrorStrategyEnum = pgEnum('workflow_error_strategy', [
  'stop',            // Stop the entire workflow
  'continue',        // Continue to next step
  'retry',           // Retry the step
  'branch',          // Execute error branch
]);

/**
 * Notification channel types
 */
export const notificationChannelEnum = pgEnum('notification_channel', [
  'email',
  'slack',
  'in_app',
  'sms',
  'webhook',
]);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Trigger configuration based on trigger type
 */
export interface EventTriggerConfig {
  eventType: string;                    // e.g., 'document.created', 'invoice.status_changed'
  documentTypes?: string[];             // Filter by document type
  conditions?: TriggerCondition[];      // Additional filter conditions
}

export interface ScheduleTriggerConfig {
  cronExpression: string;               // Standard cron expression
  timezone?: string;                    // Timezone for schedule
  startDate?: string;                   // When to start scheduling
  endDate?: string;                     // When to stop scheduling
}

export interface WebhookTriggerConfig {
  secretKey?: string;                   // For signature validation
  allowedIps?: string[];                // IP whitelist
  requiredHeaders?: Record<string, string>;
}

export interface ManualTriggerConfig {
  allowedRoleIds?: string[];            // Roles that can trigger
  allowedUserIds?: string[];            // Users that can trigger
  requiredInputSchema?: Record<string, unknown>; // JSON schema for required input
}

export interface TriggerCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'contains' | 'starts_with' | 'ends_with' | 'regex';
  value: string | number | boolean | string[] | number[];
}

/**
 * Step configuration based on action type
 */
export interface WebhookActionConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  bodyTemplate?: string;                // Handlebars template for body
  timeoutMs?: number;
  expectedStatusCodes?: number[];
  retryConfig?: RetryConfig;
}

export interface InternalActionConfig {
  actionName: string;                   // e.g., 'createJournalEntry', 'updateDocumentStatus'
  parameters?: Record<string, unknown>;
  parameterTemplates?: Record<string, string>; // Handlebars templates
}

export interface NotificationActionConfig {
  channels: Array<'email' | 'slack' | 'in_app' | 'sms' | 'webhook'>;
  recipients?: {
    userIds?: string[];
    roleIds?: string[];
    emails?: string[];
    dynamicRecipient?: string;          // Path to recipient in context
  };
  subjectTemplate?: string;
  bodyTemplate?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface ConditionActionConfig {
  conditions: Array<{
    condition: TriggerCondition[];
    nextStepId?: string;                // Jump to specific step
    branchName?: string;                // Or follow named branch
  }>;
  defaultNextStepId?: string;
  defaultBranchName?: string;
}

export interface DelayActionConfig {
  delayType: 'fixed' | 'until_time' | 'until_condition';
  durationMs?: number;                  // For fixed delay
  untilTime?: string;                   // ISO datetime or template
  untilCondition?: TriggerCondition[];  // Poll until condition met
  pollIntervalMs?: number;
  maxWaitMs?: number;
}

export interface TransformActionConfig {
  transformations: Array<{
    source: string;                     // JSONPath or template
    target: string;                     // Output path
    transform?: 'uppercase' | 'lowercase' | 'trim' | 'json_parse' | 'json_stringify' | 'number' | 'string' | 'date' | 'custom';
    customExpression?: string;          // For custom transforms
  }>;
}

export interface ApprovalActionConfig {
  documentType: string;
  documentIdPath: string;               // Path to document ID in context
  requiredByPath?: string;              // Path to required by date
  onApproved?: { nextStepId?: string };
  onRejected?: { nextStepId?: string };
}

export interface LoopActionConfig {
  arrayPath: string;                    // Path to array in context
  itemVariable: string;                 // Variable name for current item
  indexVariable?: string;               // Variable name for current index
  maxIterations?: number;
  stepsToRepeat: string[];              // Step IDs to execute for each item
}

export interface ParallelActionConfig {
  branches: Array<{
    name: string;
    stepIds: string[];
  }>;
  waitForAll?: boolean;                 // Wait for all branches or continue on first
  failOnAnyError?: boolean;
}

export interface SubWorkflowActionConfig {
  workflowId: string;
  inputMappings?: Record<string, string>; // Map current context to sub-workflow input
  outputMappings?: Record<string, string>; // Map sub-workflow output to current context
  waitForCompletion?: boolean;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[];           // Error codes to retry on
}

// ============================================================================
// TABLES
// ============================================================================

/**
 * Workflow Definitions - Templates for automation workflows
 */
export const workflowDefinitions = pgTable('workflow_definitions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull(),

  // Basic info
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  workflowCode: varchar('workflow_code', { length: 100 }).notNull(),

  // Versioning
  version: integer('version').notNull().default(1),
  isLatestVersion: boolean('is_latest_version').notNull().default(true),
  previousVersionId: uuid('previous_version_id'),

  // Status
  status: workflowDefinitionStatusEnum('status').notNull().default('draft'),

  // Trigger configuration
  triggerType: workflowTriggerTypeEnum('trigger_type').notNull(),
  triggerConfig: jsonb('trigger_config').notNull().$type<
    EventTriggerConfig | ScheduleTriggerConfig | WebhookTriggerConfig | ManualTriggerConfig
  >(),

  // Global workflow settings
  maxExecutionTimeMs: integer('max_execution_time_ms').default(3600000), // 1 hour default
  maxRetries: integer('max_retries').default(3),
  retryDelayMs: integer('retry_delay_ms').default(60000), // 1 minute default
  enableLogging: boolean('enable_logging').notNull().default(true),
  enableMetrics: boolean('enable_metrics').notNull().default(true),

  // Tags and categorization
  tags: jsonb('tags').$type<string[]>().default([]),
  category: varchar('category', { length: 100 }),

  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
  createdBy: uuid('created_by'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  updatedBy: uuid('updated_by'),
  publishedAt: timestamp('published_at'),
  publishedBy: uuid('published_by'),
}, (table) => [
  uniqueIndex('workflow_definitions_org_code_version_idx')
    .on(table.organizationId, table.workflowCode, table.version),
  index('workflow_definitions_org_status_idx')
    .on(table.organizationId, table.status),
  index('workflow_definitions_trigger_type_idx')
    .on(table.organizationId, table.triggerType),
]);

/**
 * Workflow Steps - Individual steps within a workflow definition
 */
export const workflowSteps = pgTable('workflow_steps', {
  id: uuid('id').defaultRandom().primaryKey(),
  workflowDefinitionId: uuid('workflow_definition_id').notNull().references(() => workflowDefinitions.id, { onDelete: 'cascade' }),

  // Step identification
  stepCode: varchar('step_code', { length: 100 }).notNull(),
  stepName: varchar('step_name', { length: 255 }).notNull(),
  description: text('description'),

  // Ordering
  stepOrder: integer('step_order').notNull(),

  // Action configuration
  actionType: workflowActionTypeEnum('action_type').notNull(),
  actionConfig: jsonb('action_config').notNull().$type<
    | WebhookActionConfig
    | InternalActionConfig
    | NotificationActionConfig
    | ConditionActionConfig
    | DelayActionConfig
    | TransformActionConfig
    | ApprovalActionConfig
    | LoopActionConfig
    | ParallelActionConfig
    | SubWorkflowActionConfig
  >(),

  // Flow control
  nextStepId: uuid('next_step_id'),           // Default next step (can be overridden by conditions)
  onErrorStepId: uuid('on_error_step_id'),    // Step to execute on error
  errorStrategy: workflowErrorStrategyEnum('error_strategy').notNull().default('stop'),

  // Step-level retry config (overrides workflow defaults)
  maxRetries: integer('max_retries'),
  retryDelayMs: integer('retry_delay_ms'),
  timeoutMs: integer('timeout_ms'),

  // Conditional execution
  skipConditions: jsonb('skip_conditions').$type<TriggerCondition[]>(),

  // UI positioning (for visual workflow builder)
  uiPosition: jsonb('ui_position').$type<{ x: number; y: number }>(),

  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('workflow_steps_definition_code_idx')
    .on(table.workflowDefinitionId, table.stepCode),
  index('workflow_steps_definition_order_idx')
    .on(table.workflowDefinitionId, table.stepOrder),
]);

/**
 * Workflow Instances - Runtime execution of a workflow
 */
export const workflowInstances = pgTable('workflow_instances', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull(),
  workflowDefinitionId: uuid('workflow_definition_id').notNull().references(() => workflowDefinitions.id),

  // Snapshot of definition at execution time
  definitionSnapshot: jsonb('definition_snapshot').notNull(),

  // Execution tracking
  status: workflowInstanceStatusEnum('status').notNull().default('pending'),
  currentStepId: uuid('current_step_id'),
  currentStepOrder: integer('current_step_order'),

  // Trigger information
  triggeredBy: workflowTriggerTypeEnum('triggered_by').notNull(),
  triggerContext: jsonb('trigger_context').$type<Record<string, unknown>>().default({}),
  triggerUserId: uuid('trigger_user_id'),

  // Execution context (data passed between steps)
  executionContext: jsonb('execution_context').$type<Record<string, unknown>>().default({}),

  // Execution metadata
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  errorMessage: text('error_message'),
  errorDetails: jsonb('error_details'),

  // Retry tracking
  retryCount: integer('retry_count').notNull().default(0),
  lastRetryAt: timestamp('last_retry_at'),

  // Related entities (optional, for tracking)
  relatedDocumentType: varchar('related_document_type', { length: 100 }),
  relatedDocumentId: uuid('related_document_id'),

  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('workflow_instances_org_status_idx')
    .on(table.organizationId, table.status),
  index('workflow_instances_definition_idx')
    .on(table.workflowDefinitionId),
  index('workflow_instances_started_at_idx')
    .on(table.startedAt),
  index('workflow_instances_related_document_idx')
    .on(table.relatedDocumentType, table.relatedDocumentId),
]);

/**
 * Workflow Step Executions - Individual step execution logs
 */
export const workflowStepExecutions = pgTable('workflow_step_executions', {
  id: uuid('id').defaultRandom().primaryKey(),
  workflowInstanceId: uuid('workflow_instance_id').notNull().references(() => workflowInstances.id, { onDelete: 'cascade' }),
  workflowStepId: uuid('workflow_step_id').notNull(),

  // Step info (denormalized for query performance)
  stepCode: varchar('step_code', { length: 100 }).notNull(),
  stepOrder: integer('step_order').notNull(),
  actionType: workflowActionTypeEnum('action_type').notNull(),

  // Execution tracking
  status: workflowStepExecutionStatusEnum('status').notNull().default('pending'),

  // Input/Output
  inputData: jsonb('input_data').$type<Record<string, unknown>>(),
  outputData: jsonb('output_data').$type<Record<string, unknown>>(),

  // Execution metadata
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  durationMs: integer('duration_ms'),

  // Error tracking
  errorMessage: text('error_message'),
  errorDetails: jsonb('error_details'),
  errorCode: varchar('error_code', { length: 100 }),

  // Retry tracking
  retryCount: integer('retry_count').notNull().default(0),
  lastRetryAt: timestamp('last_retry_at'),

  // For webhook/external calls
  externalRequestId: varchar('external_request_id', { length: 255 }),
  externalResponseCode: integer('external_response_code'),
  externalResponseBody: jsonb('external_response_body'),

  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('workflow_step_executions_instance_idx')
    .on(table.workflowInstanceId),
  index('workflow_step_executions_instance_order_idx')
    .on(table.workflowInstanceId, table.stepOrder),
  index('workflow_step_executions_status_idx')
    .on(table.status),
]);

/**
 * Workflow Webhooks - Registered webhooks for workflow triggers
 */
export const workflowWebhooks = pgTable('workflow_webhooks', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull(),
  workflowDefinitionId: uuid('workflow_definition_id').notNull().references(() => workflowDefinitions.id, { onDelete: 'cascade' }),

  // Webhook identification
  webhookKey: varchar('webhook_key', { length: 64 }).notNull().unique(),
  secretKey: varchar('secret_key', { length: 255 }),

  // Configuration
  isActive: boolean('is_active').notNull().default(true),
  allowedIps: jsonb('allowed_ips').$type<string[]>(),
  requiredHeaders: jsonb('required_headers').$type<Record<string, string>>(),

  // Rate limiting
  rateLimit: integer('rate_limit'),           // Requests per minute
  rateLimitWindow: integer('rate_limit_window').default(60), // Window in seconds

  // Statistics
  totalInvocations: integer('total_invocations').notNull().default(0),
  lastInvokedAt: timestamp('last_invoked_at'),

  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
}, (table) => [
  index('workflow_webhooks_org_idx')
    .on(table.organizationId),
  index('workflow_webhooks_definition_idx')
    .on(table.workflowDefinitionId),
]);

/**
 * Workflow Schedules - Active schedules for cron-triggered workflows
 */
export const workflowSchedules = pgTable('workflow_schedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull(),
  workflowDefinitionId: uuid('workflow_definition_id').notNull().references(() => workflowDefinitions.id, { onDelete: 'cascade' }),

  // Schedule configuration
  cronExpression: varchar('cron_expression', { length: 100 }).notNull(),
  timezone: varchar('timezone', { length: 50 }).default('UTC'),

  // Status
  isActive: boolean('is_active').notNull().default(true),

  // Scheduling window
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),

  // Execution tracking
  lastScheduledAt: timestamp('last_scheduled_at'),
  nextScheduledAt: timestamp('next_scheduled_at'),
  lastInstanceId: uuid('last_instance_id'),

  // Statistics
  totalExecutions: integer('total_executions').notNull().default(0),
  successfulExecutions: integer('successful_executions').notNull().default(0),
  failedExecutions: integer('failed_executions').notNull().default(0),

  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('workflow_schedules_org_idx')
    .on(table.organizationId),
  index('workflow_schedules_definition_idx')
    .on(table.workflowDefinitionId),
  index('workflow_schedules_next_idx')
    .on(table.nextScheduledAt)
    .where('is_active = true'),
]);

/**
 * Workflow Event Subscriptions - Event triggers registered for workflows
 */
export const workflowEventSubscriptions = pgTable('workflow_event_subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull(),
  workflowDefinitionId: uuid('workflow_definition_id').notNull().references(() => workflowDefinitions.id, { onDelete: 'cascade' }),

  // Event configuration
  eventType: varchar('event_type', { length: 255 }).notNull(),
  documentTypes: jsonb('document_types').$type<string[]>(),
  conditions: jsonb('conditions').$type<TriggerCondition[]>(),

  // Status
  isActive: boolean('is_active').notNull().default(true),

  // Statistics
  totalTriggers: integer('total_triggers').notNull().default(0),
  lastTriggeredAt: timestamp('last_triggered_at'),

  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('workflow_event_subscriptions_org_idx')
    .on(table.organizationId),
  index('workflow_event_subscriptions_event_type_idx')
    .on(table.organizationId, table.eventType),
  index('workflow_event_subscriptions_definition_idx')
    .on(table.workflowDefinitionId),
]);

// ============================================================================
// RELATIONS
// ============================================================================

export const workflowDefinitionsRelations = relations(workflowDefinitions, ({ many, one }) => ({
  steps: many(workflowSteps),
  instances: many(workflowInstances),
  webhooks: many(workflowWebhooks),
  schedules: many(workflowSchedules),
  eventSubscriptions: many(workflowEventSubscriptions),
  previousVersion: one(workflowDefinitions, {
    fields: [workflowDefinitions.previousVersionId],
    references: [workflowDefinitions.id],
  }),
}));

export const workflowStepsRelations = relations(workflowSteps, ({ one }) => ({
  workflowDefinition: one(workflowDefinitions, {
    fields: [workflowSteps.workflowDefinitionId],
    references: [workflowDefinitions.id],
  }),
  nextStep: one(workflowSteps, {
    fields: [workflowSteps.nextStepId],
    references: [workflowSteps.id],
  }),
  onErrorStep: one(workflowSteps, {
    fields: [workflowSteps.onErrorStepId],
    references: [workflowSteps.id],
  }),
}));

export const workflowInstancesRelations = relations(workflowInstances, ({ one, many }) => ({
  workflowDefinition: one(workflowDefinitions, {
    fields: [workflowInstances.workflowDefinitionId],
    references: [workflowDefinitions.id],
  }),
  stepExecutions: many(workflowStepExecutions),
}));

export const workflowStepExecutionsRelations = relations(workflowStepExecutions, ({ one }) => ({
  workflowInstance: one(workflowInstances, {
    fields: [workflowStepExecutions.workflowInstanceId],
    references: [workflowInstances.id],
  }),
}));

export const workflowWebhooksRelations = relations(workflowWebhooks, ({ one }) => ({
  workflowDefinition: one(workflowDefinitions, {
    fields: [workflowWebhooks.workflowDefinitionId],
    references: [workflowDefinitions.id],
  }),
}));

export const workflowSchedulesRelations = relations(workflowSchedules, ({ one }) => ({
  workflowDefinition: one(workflowDefinitions, {
    fields: [workflowSchedules.workflowDefinitionId],
    references: [workflowDefinitions.id],
  }),
}));

export const workflowEventSubscriptionsRelations = relations(workflowEventSubscriptions, ({ one }) => ({
  workflowDefinition: one(workflowDefinitions, {
    fields: [workflowEventSubscriptions.workflowDefinitionId],
    references: [workflowDefinitions.id],
  }),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type WorkflowDefinition = typeof workflowDefinitions.$inferSelect;
export type NewWorkflowDefinition = typeof workflowDefinitions.$inferInsert;

export type WorkflowStep = typeof workflowSteps.$inferSelect;
export type NewWorkflowStep = typeof workflowSteps.$inferInsert;

export type WorkflowInstance = typeof workflowInstances.$inferSelect;
export type NewWorkflowInstance = typeof workflowInstances.$inferInsert;

export type WorkflowStepExecution = typeof workflowStepExecutions.$inferSelect;
export type NewWorkflowStepExecution = typeof workflowStepExecutions.$inferInsert;

export type WorkflowWebhook = typeof workflowWebhooks.$inferSelect;
export type NewWorkflowWebhook = typeof workflowWebhooks.$inferInsert;

export type WorkflowSchedule = typeof workflowSchedules.$inferSelect;
export type NewWorkflowSchedule = typeof workflowSchedules.$inferInsert;

export type WorkflowEventSubscription = typeof workflowEventSubscriptions.$inferSelect;
export type NewWorkflowEventSubscription = typeof workflowEventSubscriptions.$inferInsert;

// Enum type exports
export type WorkflowTriggerType = typeof workflowTriggerTypeEnum.enumValues[number];
export type WorkflowActionType = typeof workflowActionTypeEnum.enumValues[number];
export type WorkflowDefinitionStatus = typeof workflowDefinitionStatusEnum.enumValues[number];
export type WorkflowInstanceStatus = typeof workflowInstanceStatusEnum.enumValues[number];
export type WorkflowStepExecutionStatus = typeof workflowStepExecutionStatusEnum.enumValues[number];
export type WorkflowErrorStrategy = typeof workflowErrorStrategyEnum.enumValues[number];
export type NotificationChannel = typeof notificationChannelEnum.enumValues[number];
