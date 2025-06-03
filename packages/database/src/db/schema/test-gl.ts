import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Simple test table to verify Drizzle is working
export const testGl = pgTable('test_gl', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull(),
  name: text('name').notNull(),
  code: text('code'),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const testGlRelations = relations(testGl, ({ one }) => ({
  // Simple relations can be added here
}));