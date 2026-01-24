/**
 * Task Templates Schema
 *
 * Reusable task templates that can be instantiated to create entity_tasks records.
 * Templates can apply to specific entity types (projects, customers, etc.) or all entity types.
 *
 * @module task-templates
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { entities } from './entities';

// ============================================================================
// TypeScript Types for Template Data
// ============================================================================

/**
 * Priority levels for template tasks
 */
export type TaskTemplatePriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Individual task definition within a template
 */
export interface TaskTemplateItem {
  tempId: string; // Temporary ID for building hierarchy
  title: string;
  description?: string;
  priority?: TaskTemplatePriority;
  estimatedHours?: number;
  estimatedBudget?: number;
  isBillable?: boolean;
  parentTempId?: string; // For subtasks
  dependsOnTempIds?: string[];
  customFieldValues?: Record<string, unknown>;
  sortOrder: number;
}

/**
 * Structure of the template_data JSONB field
 */
export interface TaskTemplateData {
  tasks: TaskTemplateItem[];
}

// ============================================================================
// Task Templates Table
// ============================================================================

/**
 * Task templates - reusable task structures that can be applied to entities
 */
export const taskTemplates = pgTable('task_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),

  // Template identification
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  // Entity type applicability
  // Array of entity types this template applies to
  // e.g., ['project', 'customer'] or ['project'] or [] for all
  entityTypes: jsonb('entity_types').$type<string[]>().default([]).notNull(),

  // Template data - contains the task structure
  templateData: jsonb('template_data').$type<TaskTemplateData>().notNull(),

  // Categorization
  category: varchar('category', { length: 100 }),

  // Status and tracking
  isActive: boolean('is_active').default(true).notNull(),
  usageCount: integer('usage_count').default(0).notNull(),

  // Audit fields - createdBy references entities (Employee with clerkUserId)
  createdBy: uuid('created_by').references(() => entities.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Unique name per organization
  orgNameUnique: uniqueIndex('idx_task_templates_org_name').on(table.organizationId, table.name),
  // Index for organization lookups
  orgIdx: index('idx_task_templates_organization').on(table.organizationId),
  // Index for organization + category lookups
  orgCategoryIdx: index('idx_task_templates_org_category').on(table.organizationId, table.category),
  // Index for organization + active status lookups
  orgActiveIdx: index('idx_task_templates_org_active').on(table.organizationId, table.isActive),
}));

// ============================================================================
// Relations
// ============================================================================

export const taskTemplatesRelations = relations(taskTemplates, ({ one }) => ({
  organization: one(organizations, {
    fields: [taskTemplates.organizationId],
    references: [organizations.id],
  }),
  createdByEntity: one(entities, {
    fields: [taskTemplates.createdBy],
    references: [entities.id],
    relationName: 'taskTemplateCreatedBy',
  }),
}));

// ============================================================================
// Type Exports
// ============================================================================

export type TaskTemplate = typeof taskTemplates.$inferSelect;
export type NewTaskTemplate = typeof taskTemplates.$inferInsert;
export type UpdateTaskTemplate = Partial<Omit<NewTaskTemplate, 'id' | 'organizationId' | 'createdAt'>>;
