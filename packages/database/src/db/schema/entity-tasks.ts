/**
 * Entity Tasks Schema
 *
 * Polymorphic tasks that can be associated with any entity type (project, customer,
 * employee, vendor, lead, prospect, contact). Supports subtasks, dependencies,
 * time/budget tracking, and custom fields.
 *
 * @module entity-tasks
 */

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  date,
  numeric,
  jsonb,
  timestamp,
  boolean,
  index,
  integer,
  AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { entities } from './entities';

// ============================================================================
// Enums
// ============================================================================

/**
 * Entity types that can have tasks associated with them
 */
export const entityTaskEntityTypeEnum = pgEnum('entity_task_entity_type', [
  'project',
  'customer',
  'employee',
  'vendor',
  'lead',
  'prospect',
  'contact',
]);

/**
 * Task status lifecycle:
 * - not_started: Task not yet begun
 * - in_progress: Task is being worked on
 * - pending_review: Task completed, awaiting review
 * - completed: Task finished and approved
 * - blocked: Task cannot proceed due to dependency or issue
 * - cancelled: Task cancelled
 */
export const entityTaskStatusEnum = pgEnum('entity_task_status', [
  'not_started',
  'in_progress',
  'pending_review',
  'completed',
  'blocked',
  'cancelled',
]);

/**
 * Task priority levels
 */
export const entityTaskPriorityEnum = pgEnum('entity_task_priority', [
  'critical',
  'high',
  'medium',
  'low',
]);

// Constants for status/priority (for use in application code)
export const ENTITY_TASK_ENTITY_TYPE = {
  PROJECT: 'project',
  CUSTOMER: 'customer',
  EMPLOYEE: 'employee',
  VENDOR: 'vendor',
  LEAD: 'lead',
  PROSPECT: 'prospect',
  CONTACT: 'contact',
} as const;

export type EntityTaskEntityType = typeof ENTITY_TASK_ENTITY_TYPE[keyof typeof ENTITY_TASK_ENTITY_TYPE];

export const ENTITY_TASK_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  PENDING_REVIEW: 'pending_review',
  COMPLETED: 'completed',
  BLOCKED: 'blocked',
  CANCELLED: 'cancelled',
} as const;

export type EntityTaskStatus = typeof ENTITY_TASK_STATUS[keyof typeof ENTITY_TASK_STATUS];

export const ENTITY_TASK_PRIORITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export type EntityTaskPriority = typeof ENTITY_TASK_PRIORITY[keyof typeof ENTITY_TASK_PRIORITY];

// ============================================================================
// Entity Tasks Table
// ============================================================================

/**
 * Polymorphic tasks that can be associated with any entity type
 */
export const entityTasks = pgTable('entity_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),

  // Polymorphic association
  entityType: entityTaskEntityTypeEnum('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),

  // Task hierarchy (subtasks)
  parentTaskId: uuid('parent_task_id').references((): AnyPgColumn => entityTasks.id),

  // Task details
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),

  // Status and priority
  status: entityTaskStatusEnum('status').default('not_started').notNull(),
  priority: entityTaskPriorityEnum('priority').default('medium').notNull(),

  // Assignment (references entities - typically Employee types)
  assigneeId: uuid('assignee_id').references(() => entities.id),
  reviewerId: uuid('reviewer_id').references(() => entities.id),

  // Estimated dates
  estimatedStartDate: date('estimated_start_date'),
  estimatedEndDate: date('estimated_end_date'),

  // Actual dates
  actualStartDate: date('actual_start_date'),
  actualEndDate: date('actual_end_date'),

  // Time tracking
  estimatedHours: numeric('estimated_hours', { precision: 10, scale: 2 }),
  actualHours: numeric('actual_hours', { precision: 10, scale: 2 }),

  // Budget tracking
  estimatedBudget: numeric('estimated_budget', { precision: 18, scale: 4 }),
  actualCost: numeric('actual_cost', { precision: 18, scale: 4 }),

  // Ordering within parent context
  sortOrder: integer('sort_order').default(0).notNull(),

  // Dependencies (array of task UUIDs this task depends on)
  dependsOnTaskIds: jsonb('depends_on_task_ids').$type<string[]>().default([]),

  // Custom fields for flexibility
  customFieldValues: jsonb('custom_field_values').$type<Record<string, unknown>>().default({}),

  // Billing
  isBillable: boolean('is_billable').default(false).notNull(),
  billingRate: numeric('billing_rate', { precision: 15, scale: 4 }),

  // Blocked tracking
  blockingReason: text('blocking_reason'),

  // Completion tracking
  completedAt: timestamp('completed_at', { withTimezone: true }),

  // Audit fields - createdBy references entities (Employee with clerkUserId)
  createdBy: uuid('created_by').references(() => entities.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Primary indexes
  orgIdx: index('idx_entity_tasks_org').on(table.organizationId),

  // Polymorphic lookup
  entityLookupIdx: index('idx_entity_tasks_entity_lookup').on(
    table.organizationId,
    table.entityType,
    table.entityId
  ),

  // Status-based queries
  statusIdx: index('idx_entity_tasks_status').on(table.organizationId, table.status),

  // Assignment queries
  assigneeIdx: index('idx_entity_tasks_assignee').on(table.organizationId, table.assigneeId),

  // Subtask hierarchy
  parentTaskIdx: index('idx_entity_tasks_parent').on(table.parentTaskId),
}));

// ============================================================================
// Relations
// ============================================================================

export const entityTasksRelations = relations(entityTasks, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [entityTasks.organizationId],
    references: [organizations.id],
  }),
  parentTask: one(entityTasks, {
    fields: [entityTasks.parentTaskId],
    references: [entityTasks.id],
    relationName: 'entityTaskParentChild',
  }),
  childTasks: many(entityTasks, {
    relationName: 'entityTaskParentChild',
  }),
  assignee: one(entities, {
    fields: [entityTasks.assigneeId],
    references: [entities.id],
    relationName: 'entityTaskAssignee',
  }),
  reviewer: one(entities, {
    fields: [entityTasks.reviewerId],
    references: [entities.id],
    relationName: 'entityTaskReviewer',
  }),
  createdByEntity: one(entities, {
    fields: [entityTasks.createdBy],
    references: [entities.id],
    relationName: 'entityTaskCreatedBy',
  }),
}));

// ============================================================================
// Type Exports
// ============================================================================

export type EntityTask = typeof entityTasks.$inferSelect;
export type NewEntityTask = typeof entityTasks.$inferInsert;
export type UpdateEntityTask = Partial<Omit<NewEntityTask, 'id' | 'organizationId' | 'createdAt'>>;
