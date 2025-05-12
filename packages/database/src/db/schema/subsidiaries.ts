import { pgTable, uuid, varchar, boolean, timestamp, AnyPgColumn } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { currencies } from './currencies';
import { organizations } from './organizations';
// import { jobs } from './jobs'; // Assuming jobs.ts will exist - Will uncomment later
// import { entities } from './entities'; // Assuming entities.ts will exist - Will uncomment later
// import { transactions } from './transactions'; // Will uncomment when transactions.ts exists

export const subsidiaries = pgTable('subsidiaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }).notNull(),
  description: varchar('description', { length: 1000 }),
  parentId: uuid('parent_id').references((): AnyPgColumn => subsidiaries.id), // Self-referencing for hierarchy
  baseCurrencyId: uuid('base_currency_id').references(() => currencies.id),
  countryCode: varchar('country_code', { length: 2 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatet: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const subsidiaryRelations = relations(subsidiaries, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [subsidiaries.organizationId],
    references: [organizations.id],
  }),
  baseCurrency: one(currencies, {
    fields: [subsidiaries.baseCurrencyId],
    references: [currencies.id],
  }),
  parentSubsidiary: one(subsidiaries, {
    fields: [subsidiaries.parentId],
    references: [subsidiaries.id],
    relationName: 'parent'
  }),
  childSubsidiaries: many(subsidiaries, { relationName: 'parent' }),
  // entities: many(entities), // Entities have a primarySubsidiaryId - Will uncomment later
  // jobs: many(jobs), // Jobs have a subsidiaryId - Will uncomment later
  // transactions: many(transactions), // transactions have a subsidiaryId - uncomment when transactions.ts exists
})); 