import { pgTable, uuid, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { subsidiaries } from './subsidiaries';
import { transactionLines } from './transactionLines'; // For relation back from locations to lines

export const locations = pgTable('locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  subsidiaryId: uuid('subsidiary_id').notNull().references(() => subsidiaries.id),
  addressLine1: varchar('address_line_1', { length: 255 }),
  addressLine2: varchar('address_line_2', { length: 255 }),
  city: varchar('city', { length: 100 }),
  stateProvince: varchar('state_province', { length: 100 }), // state or province
  postalCode: varchar('postal_code', { length: 20 }),
  countryCode: varchar('country_code', { length: 2 }), // ISO 2-letter country code
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const locationRelations = relations(locations, ({ one, many }) => ({
  subsidiary: one(subsidiaries, {
    fields: [locations.subsidiaryId],
    references: [subsidiaries.id],
  }),
  transactionLines: many(transactionLines), // Each location can be on many transaction lines
})); 