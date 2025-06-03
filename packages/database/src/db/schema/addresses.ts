import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const addresses = pgTable('addresses', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull(), // Clerk org ID format: org_xxx
  addressee: text('addressee'),
  companyName: text('company_name'),
  attention: text('attention'),
  phoneNumber: text('phone_number'),
  line1: text('line1'),
  line2: text('line2'),
  city: text('city'),
  stateProvince: text('state_province'),
  postalCode: text('postal_code'),
  countryCode: text('country_code'), // ISO 2-letter country code
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const addressRelations = relations(addresses, ({ many }) => ({
  // If an address could be linked to multiple entities (e.g. shared office)
  // For now, assuming address is primarily owned/referenced by one entity
  // but this setup allows flexibility if needed later.
})); 