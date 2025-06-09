import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { subsidiaries } from './subsidiaries';
import { transactionLines } from './transactionLines'; // For relation back from classes to lines

export const classes = pgTable('classes', {
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

export const classRelations = relations(classes, ({ one, many }) => ({
  subsidiary: one(subsidiaries, {
    fields: [classes.subsidiaryId],
    references: [subsidiaries.id],
  }),
  transactionLines: many(transactionLines), // Each class can be on many transaction lines
})); 