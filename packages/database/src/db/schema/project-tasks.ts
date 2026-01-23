/**
 * Project Tasks Schema
 *
 * Supports project task management with templates, milestones, employee assignments,
 * activity codes, and default service items for construction project management.
 *
 * @module project-tasks
 */

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  date,
  numeric,
  jsonb,
  timestamp,
  boolean,
  uniqueIndex,
  index,
  integer,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { subsidiaries } from './subsidiaries';
import { entities } from './entities';
import { projects } from './projects';
import { activityCodes } from './activity-codes';
import { items } from './items';

// ============================================================================
// Enums
// ============================================================================

/**
 * Project task status lifecycle:
 * - NOT_STARTED: Task not yet begun
 * - IN_PROGRESS: Task is being worked on
 * - PENDING_REVIEW: Task completed, awaiting review
 * - COMPLETED: Task finished and approved
 * - BLOCKED: Task cannot proceed due to dependency
 * - CANCELLED: Task cancelled
 */
export const projectTaskStatusEnum = pgEnum('project_task_status', [
  'NOT_STARTED',
  'IN_PROGRESS',
  'PENDING_REVIEW',
  'COMPLETED',
  'BLOCKED',
  'CANCELLED',
]);

/**
 * Project task priority levels
 */
export const projectTaskPriorityEnum = pgEnum('project_task_priority', [
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
]);

/**
 * Project milestone status lifecycle
 */
export const projectMilestoneStatusEnum = pgEnum('project_milestone_status', [
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);

// Constants for status/priority (for use in application code)
export const PROJECT_TASK_STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  PENDING_REVIEW: 'PENDING_REVIEW',
  COMPLETED: 'COMPLETED',
  BLOCKED: 'BLOCKED',
  CANCELLED: 'CANCELLED',
} as const;

export type ProjectTaskStatus = typeof PROJECT_TASK_STATUS[keyof typeof PROJECT_TASK_STATUS];

export const PROJECT_TASK_PRIORITY = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const;

export type ProjectTaskPriority = typeof PROJECT_TASK_PRIORITY[keyof typeof PROJECT_TASK_PRIORITY];

export const PROJECT_MILESTONE_STATUS = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type ProjectMilestoneStatus = typeof PROJECT_MILESTONE_STATUS[keyof typeof PROJECT_MILESTONE_STATUS];

// ============================================================================
// Project Milestones Table
// ============================================================================

/**
 * Project milestones - key deliverables and phases for projects
 */
export const projectMilestones = pgTable('project_milestones', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),

  // Milestone details
  name: text('name').notNull(),
  description: text('description'),

  // Dates
  targetDate: date('target_date'),
  completedDate: date('completed_date'),

  // Status
  status: projectMilestoneStatusEnum('status').default('PENDING').notNull(),

  // Ordering
  sortOrder: integer('sort_order').default(0).notNull(),

  // Billing integration flag (for future SOV/billing integration)
  isBillingMilestone: boolean('is_billing_milestone').default(false).notNull(),

  // Metadata
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),

  // Audit fields - createdBy references entities (Employee with clerkUserId)
  createdBy: uuid('created_by').references(() => entities.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  projectIdx: index('idx_project_milestones_project').on(table.projectId),
  statusIdx: index('idx_project_milestones_status').on(table.projectId, table.status),
  targetDateIdx: index('idx_project_milestones_target_date').on(table.targetDate),
  sortOrderIdx: index('idx_project_milestones_sort').on(table.projectId, table.sortOrder),
}));

// ============================================================================
// Project Task Templates Table
// ============================================================================

/**
 * Project task templates - reusable task definitions
 */
export const projectTaskTemplates = pgTable('project_task_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  subsidiaryId: uuid('subsidiary_id').references(() => subsidiaries.id),

  // Template identification
  templateCode: text('template_code').notNull(),
  templateName: text('template_name').notNull(),
  description: text('description'),

  // Categorization
  category: text('category'), // For grouping tasks (e.g., 'DESIGN', 'CONSTRUCTION', 'CLOSEOUT')

  // Priority and estimation
  priority: projectTaskPriorityEnum('priority').default('MEDIUM').notNull(),
  estimatedHours: numeric('estimated_hours', { precision: 10, scale: 2 }),

  // Instructions for completing the task
  instructions: text('instructions'),

  // Default GL/Activity code
  activityCodeId: uuid('activity_code_id').references(() => activityCodes.id),

  // Default service item (references items where itemType='SERVICE')
  defaultServiceItemId: uuid('default_service_item_id').references(() => items.id),

  // Default assignee (references entities where entityTypes includes 'Employee')
  defaultAssigneeId: uuid('default_assignee_id').references(() => entities.id),

  // Template dependencies (stored as array of template codes)
  dependsOnTemplateCodes: jsonb('depends_on_template_codes').$type<string[]>().default([]),

  // Status and ordering
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),

  // Metadata
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),

  // Audit fields - createdBy references entities (Employee with clerkUserId)
  createdBy: uuid('created_by').references(() => entities.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgTemplateCodeIdx: uniqueIndex('idx_project_task_templates_org_code').on(table.organizationId, table.templateCode),
  categoryIdx: index('idx_project_task_templates_category').on(table.organizationId, table.category),
  activeIdx: index('idx_project_task_templates_active').on(table.organizationId, table.isActive),
  subsidiaryIdx: index('idx_project_task_templates_subsidiary').on(table.subsidiaryId),
}));

// ============================================================================
// Project Tasks Table
// ============================================================================

/**
 * Project tasks - task instances on projects
 */
export const projectTasks = pgTable('project_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  milestoneId: uuid('milestone_id').references(() => projectMilestones.id),
  templateId: uuid('template_id').references(() => projectTaskTemplates.id),
  parentTaskId: uuid('parent_task_id'), // Self-reference for task hierarchy (added below via separate reference)
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),

  // Task identification
  taskCode: text('task_code'),
  taskName: text('task_name').notNull(),
  description: text('description'),

  // Categorization
  category: text('category'),

  // Priority and status
  priority: projectTaskPriorityEnum('priority').default('MEDIUM').notNull(),
  status: projectTaskStatusEnum('status').default('NOT_STARTED').notNull(),

  // GL/Activity code
  activityCodeId: uuid('activity_code_id').references(() => activityCodes.id),

  // Service item (references items table)
  serviceItemId: uuid('service_item_id').references(() => items.id),

  // Assignment (references entities where entityTypes includes 'Employee')
  assigneeId: uuid('assignee_id').references(() => entities.id),
  reviewerId: uuid('reviewer_id').references(() => entities.id),

  // Dates and timing
  dueDate: timestamp('due_date', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),

  // Time tracking
  estimatedHours: numeric('estimated_hours', { precision: 10, scale: 2 }),
  actualHours: numeric('actual_hours', { precision: 10, scale: 2 }),

  // Task dependencies (stored as array of task UUIDs)
  dependsOnTaskIds: jsonb('depends_on_task_ids').$type<string[]>().default([]),

  // Blocked tracking
  blockedReason: text('blocked_reason'),

  // Work notes
  workNotes: text('work_notes'),
  reviewNotes: text('review_notes'),

  // Attachments (URLs to files)
  attachmentUrls: jsonb('attachment_urls').$type<string[]>().default([]),

  // Ordering
  sortOrder: integer('sort_order').default(0).notNull(),

  // Billing
  isBillable: boolean('is_billable').default(true).notNull(),
  billingRate: numeric('billing_rate', { precision: 15, scale: 4 }),

  // Metadata
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),

  // Audit fields - createdBy references entities (Employee with clerkUserId)
  createdBy: uuid('created_by').references(() => entities.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  projectIdx: index('idx_project_tasks_project').on(table.projectId),
  milestoneIdx: index('idx_project_tasks_milestone').on(table.milestoneId),
  statusIdx: index('idx_project_tasks_status').on(table.projectId, table.status),
  assigneeIdx: index('idx_project_tasks_assignee').on(table.assigneeId, table.status),
  dueDateIdx: index('idx_project_tasks_due_date').on(table.dueDate, table.status),
  parentTaskIdx: index('idx_project_tasks_parent').on(table.parentTaskId),
  orgIdx: index('idx_project_tasks_org').on(table.organizationId),
  projectTaskCodeIdx: index('idx_project_tasks_project_code').on(table.projectId, table.taskCode),
}));

// ============================================================================
// Project Templates Table
// ============================================================================

/**
 * Project templates - project templates with pre-defined milestones and tasks
 */
export const projectTemplates = pgTable('project_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  subsidiaryId: uuid('subsidiary_id').references(() => subsidiaries.id),

  // Template identification
  templateCode: text('template_code').notNull(),
  templateName: text('template_name').notNull(),
  description: text('description'),

  // Project type for categorization
  projectType: text('project_type'),

  // Default milestones to create when instantiating (stored as JSON array of milestone definitions)
  defaultMilestones: jsonb('default_milestones').$type<{
    name: string;
    description?: string;
    targetDayOffset?: number; // Days from project start
    isBillingMilestone?: boolean;
    sortOrder?: number;
  }[]>().default([]),

  // Status and ordering
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),

  // Metadata
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),

  // Audit fields - createdBy references entities (Employee with clerkUserId)
  createdBy: uuid('created_by').references(() => entities.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgTemplateCodeIdx: uniqueIndex('idx_project_templates_org_code').on(table.organizationId, table.templateCode),
  projectTypeIdx: index('idx_project_templates_type').on(table.organizationId, table.projectType),
  activeIdx: index('idx_project_templates_active').on(table.organizationId, table.isActive),
  subsidiaryIdx: index('idx_project_templates_subsidiary').on(table.subsidiaryId),
}));

// ============================================================================
// Project Template Tasks Table
// ============================================================================

/**
 * Project template tasks - links task templates to project templates
 */
export const projectTemplateTasks = pgTable('project_template_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectTemplateId: uuid('project_template_id').notNull().references(() => projectTemplates.id, { onDelete: 'cascade' }),
  taskTemplateId: uuid('task_template_id').notNull().references(() => projectTaskTemplates.id),

  // Which milestone this task belongs to (references milestone name within template's defaultMilestones)
  milestoneName: text('milestone_name'),

  // Ordering
  sortOrder: integer('sort_order').default(0).notNull(),

  // Metadata
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),

  // Audit fields
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  projectTemplateIdx: index('idx_project_template_tasks_template').on(table.projectTemplateId),
  taskTemplateIdx: index('idx_project_template_tasks_task').on(table.taskTemplateId),
  uniqueTemplateTaskIdx: uniqueIndex('idx_project_template_tasks_unique').on(table.projectTemplateId, table.taskTemplateId),
}));

// ============================================================================
// Relations
// ============================================================================

export const projectMilestonesRelations = relations(projectMilestones, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectMilestones.projectId],
    references: [projects.id],
  }),
  organization: one(organizations, {
    fields: [projectMilestones.organizationId],
    references: [organizations.id],
  }),
  createdByEntity: one(entities, {
    fields: [projectMilestones.createdBy],
    references: [entities.id],
    relationName: 'milestoneCreatedBy',
  }),
  tasks: many(projectTasks),
}));

export const projectTaskTemplatesRelations = relations(projectTaskTemplates, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projectTaskTemplates.organizationId],
    references: [organizations.id],
  }),
  subsidiary: one(subsidiaries, {
    fields: [projectTaskTemplates.subsidiaryId],
    references: [subsidiaries.id],
  }),
  activityCode: one(activityCodes, {
    fields: [projectTaskTemplates.activityCodeId],
    references: [activityCodes.id],
  }),
  defaultServiceItem: one(items, {
    fields: [projectTaskTemplates.defaultServiceItemId],
    references: [items.id],
    relationName: 'taskTemplateServiceItem',
  }),
  defaultAssignee: one(entities, {
    fields: [projectTaskTemplates.defaultAssigneeId],
    references: [entities.id],
    relationName: 'taskTemplateDefaultAssignee',
  }),
  createdByEntity: one(entities, {
    fields: [projectTaskTemplates.createdBy],
    references: [entities.id],
    relationName: 'taskTemplateCreatedBy',
  }),
  projectTemplateTasks: many(projectTemplateTasks),
  tasks: many(projectTasks),
}));

export const projectTasksRelations = relations(projectTasks, ({ one }) => ({
  project: one(projects, {
    fields: [projectTasks.projectId],
    references: [projects.id],
  }),
  milestone: one(projectMilestones, {
    fields: [projectTasks.milestoneId],
    references: [projectMilestones.id],
  }),
  template: one(projectTaskTemplates, {
    fields: [projectTasks.templateId],
    references: [projectTaskTemplates.id],
  }),
  parentTask: one(projectTasks, {
    fields: [projectTasks.parentTaskId],
    references: [projectTasks.id],
    relationName: 'taskParentChild',
  }),
  organization: one(organizations, {
    fields: [projectTasks.organizationId],
    references: [organizations.id],
  }),
  activityCode: one(activityCodes, {
    fields: [projectTasks.activityCodeId],
    references: [activityCodes.id],
  }),
  serviceItem: one(items, {
    fields: [projectTasks.serviceItemId],
    references: [items.id],
    relationName: 'taskServiceItem',
  }),
  assignee: one(entities, {
    fields: [projectTasks.assigneeId],
    references: [entities.id],
    relationName: 'taskAssignee',
  }),
  reviewer: one(entities, {
    fields: [projectTasks.reviewerId],
    references: [entities.id],
    relationName: 'taskReviewer',
  }),
  createdByEntity: one(entities, {
    fields: [projectTasks.createdBy],
    references: [entities.id],
    relationName: 'taskCreatedBy',
  }),
}));

export const projectTemplatesRelations = relations(projectTemplates, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projectTemplates.organizationId],
    references: [organizations.id],
  }),
  subsidiary: one(subsidiaries, {
    fields: [projectTemplates.subsidiaryId],
    references: [subsidiaries.id],
  }),
  createdByEntity: one(entities, {
    fields: [projectTemplates.createdBy],
    references: [entities.id],
    relationName: 'projectTemplateCreatedBy',
  }),
  templateTasks: many(projectTemplateTasks),
}));

export const projectTemplateTasksRelations = relations(projectTemplateTasks, ({ one }) => ({
  projectTemplate: one(projectTemplates, {
    fields: [projectTemplateTasks.projectTemplateId],
    references: [projectTemplates.id],
  }),
  taskTemplate: one(projectTaskTemplates, {
    fields: [projectTemplateTasks.taskTemplateId],
    references: [projectTaskTemplates.id],
  }),
}));

// ============================================================================
// Type Exports
// ============================================================================

// Project Milestones
export type ProjectMilestone = typeof projectMilestones.$inferSelect;
export type NewProjectMilestone = typeof projectMilestones.$inferInsert;
export type UpdateProjectMilestone = Partial<Omit<NewProjectMilestone, 'id' | 'organizationId' | 'createdAt'>>;

// Project Task Templates
export type ProjectTaskTemplate = typeof projectTaskTemplates.$inferSelect;
export type NewProjectTaskTemplate = typeof projectTaskTemplates.$inferInsert;
export type UpdateProjectTaskTemplate = Partial<Omit<NewProjectTaskTemplate, 'id' | 'organizationId' | 'createdAt'>>;

// Project Tasks
export type ProjectTask = typeof projectTasks.$inferSelect;
export type NewProjectTask = typeof projectTasks.$inferInsert;
export type UpdateProjectTask = Partial<Omit<NewProjectTask, 'id' | 'organizationId' | 'createdAt'>>;

// Project Templates
export type ProjectTemplate = typeof projectTemplates.$inferSelect;
export type NewProjectTemplate = typeof projectTemplates.$inferInsert;
export type UpdateProjectTemplate = Partial<Omit<NewProjectTemplate, 'id' | 'organizationId' | 'createdAt'>>;

// Project Template Tasks
export type ProjectTemplateTask = typeof projectTemplateTasks.$inferSelect;
export type NewProjectTemplateTask = typeof projectTemplateTasks.$inferInsert;
