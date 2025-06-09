import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const addresses = pgTable('addresses', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull(),
  addressee: text('addressee'),
  companyName: text('company_name'),
  attention: text('attention'),
  phoneNumber: text('phone_number'),
  line1: text('line1'),
  line2: text('line2'),
  city: text('city'),
  stateProvince: text('state_province'),
  postalCode: text('postal_code'),
  countryCode: text('country_code'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Address = typeof addresses.$inferSelect;
export type NewAddress = typeof addresses.$inferInsert; 