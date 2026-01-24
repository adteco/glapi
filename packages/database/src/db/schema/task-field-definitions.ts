/**
 * Task Field Definitions Schema
 *
 * Supports custom field definitions for tasks and other entity types.
 * Organizations can define custom fields with various types, validation options,
 * and display configurations.
 *
 * @module task-field-definitions
 */

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  boolean,
  integer,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { organizations } from './organizations';
import { entities } from './entities';

// ============================================================================
// Enums
// ============================================================================

/**
 * Task field type enum - defines the type of data the field holds:
 * - text: Single-line text input
 * - textarea: Multi-line text input
 * - number: Numeric value
 * - currency: Monetary value
 * - date: Date only (no time)
 * - datetime: Date and time
 * - boolean: True/false toggle
 * - select: Single selection from options
 * - multiselect: Multiple selections from options
 * - user: User/entity reference
 * - url: URL/link
 * - email: Email address
 * - phone: Phone number
 */
export const taskFieldTypeEnum = pgEnum('task_field_type', [
  'text',
  'textarea',
  'number',
  'currency',
  'date',
  'datetime',
  'boolean',
  'select',
  'multiselect',
  'user',
  'url',
  'email',
  'phone',
]);

// Constants for field types (for use in application code)
export const TASK_FIELD_TYPE = {
  TEXT: 'text',
  TEXTAREA: 'textarea',
  NUMBER: 'number',
  CURRENCY: 'currency',
  DATE: 'date',
  DATETIME: 'datetime',
  BOOLEAN: 'boolean',
  SELECT: 'select',
  MULTISELECT: 'multiselect',
  USER: 'user',
  URL: 'url',
  EMAIL: 'email',
  PHONE: 'phone',
} as const;

export type TaskFieldType = typeof TASK_FIELD_TYPE[keyof typeof TASK_FIELD_TYPE];

// ============================================================================
// Field Options Type Definitions
// ============================================================================

/**
 * Option for select/multiselect fields
 */
export interface SelectOption {
  value: string;
  label: string;
  color?: string; // Optional color for visual distinction
}

/**
 * Options for select/multiselect field types
 */
export interface SelectFieldOptions {
  options: SelectOption[];
}

/**
 * Options for number/currency field types
 */
export interface NumberFieldOptions {
  min?: number;
  max?: number;
  precision?: number; // Decimal places
  currencyCode?: string; // For currency type (e.g., 'USD', 'EUR')
}

/**
 * Options for text/textarea field types
 */
export interface TextFieldOptions {
  minLength?: number;
  maxLength?: number;
  pattern?: string; // Regex pattern for validation
}

/**
 * Combined field options type
 */
export type FieldOptions = SelectFieldOptions | NumberFieldOptions | TextFieldOptions | Record<string, unknown>;

// ============================================================================
// Task Field Definitions Table
// ============================================================================

/**
 * Task field definitions - custom field configurations for organizations
 */
export const taskFieldDefinitions = pgTable('task_field_definitions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),

  // Field identification
  fieldKey: varchar('field_key', { length: 100 }).notNull(),
  fieldLabel: varchar('field_label', { length: 255 }).notNull(),

  // Field type and options
  fieldType: taskFieldTypeEnum('field_type').notNull(),
  fieldOptions: jsonb('field_options').$type<FieldOptions>().default({}),

  // Entity type scoping
  // null = global (applies to all entity types)
  // 'project', 'customer', etc. = specific to that entity type
  entityType: varchar('entity_type', { length: 50 }),

  // Validation
  isRequired: boolean('is_required').default(false).notNull(),

  // Default value - type depends on field_type
  // For text: string, for number: number, for boolean: boolean,
  // for select: string (value), for multiselect: string[] (values)
  defaultValue: jsonb('default_value'),

  // UI configuration
  placeholder: varchar('placeholder', { length: 255 }),
  helpText: text('help_text'),
  displayOrder: integer('display_order').default(0).notNull(),

  // Status
  isActive: boolean('is_active').default(true).notNull(),

  // Audit fields
  createdBy: uuid('created_by').references(() => entities.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Unique constraint: (organization_id, field_key, COALESCE(entity_type, ''))
  // This ensures field_key is unique within an org for each entity_type (including null)
  orgFieldKeyEntityTypeUnique: uniqueIndex('idx_task_field_definitions_org_key_entity')
    .on(table.organizationId, table.fieldKey)
    .where(sql`${table.entityType} IS NULL`),

  orgFieldKeyEntityTypeNotNullUnique: uniqueIndex('idx_task_field_definitions_org_key_entity_not_null')
    .on(table.organizationId, table.fieldKey, table.entityType)
    .where(sql`${table.entityType} IS NOT NULL`),

  // Index on organization_id
  organizationIdx: index('idx_task_field_definitions_org').on(table.organizationId),

  // Index on (organization_id, entity_type)
  orgEntityTypeIdx: index('idx_task_field_definitions_org_entity_type').on(
    table.organizationId,
    table.entityType
  ),

  // Index on (organization_id, is_active)
  orgActiveIdx: index('idx_task_field_definitions_org_active').on(
    table.organizationId,
    table.isActive
  ),

  // Index for ordering
  displayOrderIdx: index('idx_task_field_definitions_display_order').on(
    table.organizationId,
    table.displayOrder
  ),
}));

// ============================================================================
// Relations
// ============================================================================

export const taskFieldDefinitionsRelations = relations(taskFieldDefinitions, ({ one }) => ({
  organization: one(organizations, {
    fields: [taskFieldDefinitions.organizationId],
    references: [organizations.id],
  }),
  createdByEntity: one(entities, {
    fields: [taskFieldDefinitions.createdBy],
    references: [entities.id],
    relationName: 'fieldDefinitionCreatedBy',
  }),
}));

// ============================================================================
// Type Exports
// ============================================================================

// Task Field Definitions
export type TaskFieldDefinition = typeof taskFieldDefinitions.$inferSelect;
export type NewTaskFieldDefinition = typeof taskFieldDefinitions.$inferInsert;
export type UpdateTaskFieldDefinition = Partial<Omit<NewTaskFieldDefinition, 'id' | 'organizationId' | 'createdAt' | 'createdBy'>>;
