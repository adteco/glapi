import { pgTable, uuid, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { transactionLines } from './transactionLines'; // For relation back from activity codes to lines

export const activityCodes = pgTable('activity_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }).unique(), // Optional short code for the activity
  description: text('description'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const activityCodeRelations = relations(activityCodes, ({ many }) => ({
  transactionLines: many(transactionLines), // Each activity code can be on many transaction lines
})); 