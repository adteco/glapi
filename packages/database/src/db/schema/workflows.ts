import { pgTable, uuid, varchar, text, boolean, integer, timestamp, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';

// ============================================================================
// ENUMS
// ============================================================================

export const workflowComponentTypeEnum = pgEnum('workflow_component_type', [
  'lists',
  'transactions',
  'time_tracking',
  'construction',
]);

// ============================================================================
// WORKFLOWS TABLE
// ============================================================================

export const workflows = pgTable('workflows', {
  id: uuid('id').defaultRandom().primaryKey(),
  // Nullable for system-wide templates (organization_id = null, is_template = true)
  organizationId: uuid('organization_id').references(() => organizations.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isTemplate: boolean('is_template').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Index for organization-based lookups
  orgIdx: index('idx_workflows_organization').on(table.organizationId),
  // Index for finding templates
  templateIdx: index('idx_workflows_template').on(table.isTemplate),
  // Note: Unique constraints handled by partial indexes in migration
  // idx_workflows_org_name for org-specific (WHERE organization_id IS NOT NULL)
  // idx_workflows_template_name for templates (WHERE organization_id IS NULL)
}));

// ============================================================================
// WORKFLOW_GROUPS TABLE
// ============================================================================

export const workflowGroups = pgTable('workflow_groups', {
  id: uuid('id').defaultRandom().primaryKey(),
  workflowId: uuid('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  displayOrder: integer('display_order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Index for workflow-based lookups
  workflowIdx: index('idx_workflow_groups_workflow').on(table.workflowId),
  // Unique name per workflow
  workflowNameUnique: uniqueIndex('idx_workflow_groups_workflow_name').on(table.workflowId, table.name),
  // Index for ordering
  orderIdx: index('idx_workflow_groups_order').on(table.workflowId, table.displayOrder),
}));

// ============================================================================
// WORKFLOW_COMPONENTS TABLE
// ============================================================================

export const workflowComponents = pgTable('workflow_components', {
  id: uuid('id').defaultRandom().primaryKey(),
  workflowId: uuid('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),
  groupId: uuid('group_id').references(() => workflowGroups.id, { onDelete: 'set null' }),
  componentType: workflowComponentTypeEnum('component_type').notNull(),
  componentKey: varchar('component_key', { length: 100 }).notNull(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  icon: varchar('icon', { length: 100 }),
  route: varchar('route', { length: 255 }).notNull(),
  displayOrder: integer('display_order').default(0).notNull(),
  isEnabled: boolean('is_enabled').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Index for workflow-based lookups
  workflowIdx: index('idx_workflow_components_workflow').on(table.workflowId),
  // Index for group-based lookups
  groupIdx: index('idx_workflow_components_group').on(table.groupId),
  // Unique component key per workflow
  workflowKeyUnique: uniqueIndex('idx_workflow_components_workflow_key').on(table.workflowId, table.componentKey),
  // Index for ordering
  orderIdx: index('idx_workflow_components_order').on(table.workflowId, table.displayOrder),
  // Index for enabled components
  enabledIdx: index('idx_workflow_components_enabled').on(table.workflowId, table.isEnabled),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [workflows.organizationId],
    references: [organizations.id],
  }),
  groups: many(workflowGroups),
  components: many(workflowComponents),
}));

export const workflowGroupsRelations = relations(workflowGroups, ({ one, many }) => ({
  workflow: one(workflows, {
    fields: [workflowGroups.workflowId],
    references: [workflows.id],
  }),
  components: many(workflowComponents),
}));

export const workflowComponentsRelations = relations(workflowComponents, ({ one }) => ({
  workflow: one(workflows, {
    fields: [workflowComponents.workflowId],
    references: [workflows.id],
  }),
  group: one(workflowGroups, {
    fields: [workflowComponents.groupId],
    references: [workflowGroups.id],
  }),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Workflow types
export type Workflow = typeof workflows.$inferSelect;
export type NewWorkflow = typeof workflows.$inferInsert;
export type UpdateWorkflow = Partial<Omit<NewWorkflow, 'id' | 'organizationId' | 'createdAt'>>;

// Workflow group types
export type WorkflowGroup = typeof workflowGroups.$inferSelect;
export type NewWorkflowGroup = typeof workflowGroups.$inferInsert;
export type UpdateWorkflowGroup = Partial<Omit<NewWorkflowGroup, 'id' | 'workflowId' | 'createdAt'>>;

// Workflow component types
export type WorkflowComponent = typeof workflowComponents.$inferSelect;
export type NewWorkflowComponent = typeof workflowComponents.$inferInsert;
export type UpdateWorkflowComponent = Partial<Omit<NewWorkflowComponent, 'id' | 'workflowId' | 'createdAt'>>;

// Enum value types
export type WorkflowComponentType = 'lists' | 'transactions' | 'time_tracking' | 'construction';

// Combined types for convenience
export interface WorkflowWithGroups extends Workflow {
  groups: WorkflowGroup[];
}

export interface WorkflowWithComponents extends Workflow {
  components: WorkflowComponent[];
}

export interface WorkflowWithGroupsAndComponents extends Workflow {
  groups: (WorkflowGroup & { components: WorkflowComponent[] })[];
  components: WorkflowComponent[];
}
