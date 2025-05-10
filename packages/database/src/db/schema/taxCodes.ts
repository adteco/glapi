import { pgTable, uuid, varchar, decimal, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { transactionLines } from './transactionLines'; // For relation back from tax codes to lines

export const taxCodes = pgTable('tax_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: varchar('description', { length: 255 }),
  rate: decimal('rate', { precision: 8, scale: 4 }).notNull().default('0'), // e.g., 0.08 for 8%
  isCompound: boolean('is_compound').default(false),
  // taxAgencyId: uuid('tax_agency_id'), // Optional: if you track tax agencies
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const taxCodeRelations = relations(taxCodes, ({ many }) => ({
  transactionLines: many(transactionLines), // Each tax code can be on many transaction lines
})); 