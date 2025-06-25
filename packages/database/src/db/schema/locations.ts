import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { subsidiaries } from './subsidiaries';
import { transactionLines } from './transactionLines'; // For relation back from locations to lines

export const locations = pgTable('locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  code: text('code'),
  description: text('description'),
  organizationId: text('organization_id').notNull(),
  subsidiaryId: uuid('subsidiary_id'),
  addressLine1: text('address_line_1'),
  addressLine2: text('address_line_2'),
  city: text('city'),
  stateProvince: text('state_province'), // state or province
  postalCode: text('postal_code'),
  countryCode: text('country_code'), // ISO 2-letter country code
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const locationRelations = relations(locations, ({ one, many }) => ({
  // organization relation removed - organizationId is now just a varchar field
  subsidiary: one(subsidiaries, {
    fields: [locations.subsidiaryId],
    references: [subsidiaries.id],
  }),
  transactionLines: many(transactionLines), // Each location can be on many transaction lines
})); 