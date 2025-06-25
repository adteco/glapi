import { pgTable, uuid, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { transactionLines } from './transactionLines'; // For potential relation back if UoM is used in many lines

export const unitsOfMeasure = pgTable('units_of_measure', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  abbreviation: varchar('abbreviation', { length: 10 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Optional: Relation back to transactionLines if you want to easily query
// all transaction lines that use a particular unit of measure.
export const unitsOfMeasureRelations = relations(unitsOfMeasure, ({ many }) => ({
  transactionLines: many(transactionLines),
})); 