import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { subsidiaries } from './subsidiaries';
import { organizations } from './organizations';
import { transactionLines } from './transactionLines'; // For relation back from departments to lines

export const departments = pgTable('departments', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  code: text('code'),
  description: text('description'),
  organizationId: text('organization_id').notNull(),
  subsidiaryId: uuid('subsidiary_id'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const departmentRelations = relations(departments, ({ one, many }) => ({
  subsidiary: one(subsidiaries, {
    fields: [departments.subsidiaryId],
    references: [subsidiaries.id],
  }),
  transactionLines: many(transactionLines), // Each department can be on many transaction lines
})); 