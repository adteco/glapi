import { pgTable, uuid, text, boolean, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { subsidiaries } from './subsidiaries';

/**
 * Project Types - Lookup table for categorizing projects
 * Examples: Time & Materials, Fixed Price, Cost Plus, Lump Sum, Unit Price, etc.
 */
export const projectTypes = pgTable('project_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  subsidiaryId: uuid('subsidiary_id').references(() => subsidiaries.id),
  code: text('code').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgCodeUnique: uniqueIndex('project_types_org_code_unique').on(table.organizationId, table.code),
}));

export const projectTypesRelations = relations(projectTypes, ({ one }) => ({
  organization: one(organizations, {
    fields: [projectTypes.organizationId],
    references: [organizations.id],
  }),
  subsidiary: one(subsidiaries, {
    fields: [projectTypes.subsidiaryId],
    references: [subsidiaries.id],
  }),
}));

export type ProjectType = typeof projectTypes.$inferSelect;
export type NewProjectType = typeof projectTypes.$inferInsert;
