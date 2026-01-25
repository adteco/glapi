import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, boolean, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { subsidiaries } from './subsidiaries';
import { transactionLines } from './transactionLines'; // For relation back from classes to lines
import { organizations } from './organizations';

export const classes = pgTable('classes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  code: text('code'),
  description: text('description'),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  subsidiaryId: uuid('subsidiary_id'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  orgCodeUnique: uniqueIndex('classes_org_code_unique').on(table.organizationId, table.code),
}));

export const classRelations = relations(classes, ({ one, many }) => ({
  subsidiary: one(subsidiaries, {
    fields: [classes.subsidiaryId],
    references: [subsidiaries.id],
  }),
  transactionLines: many(transactionLines), // Each class can be on many transaction lines
})); 