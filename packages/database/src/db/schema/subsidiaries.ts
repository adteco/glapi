import { pgTable, uuid, text, boolean, timestamp, AnyPgColumn, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { currencies } from './currencies';
import { organizations } from './organizations';
// import { jobs } from './jobs'; // Assuming jobs.ts will exist - Will uncomment later
// import { entities } from './entities'; // Assuming entities.ts will exist - Will uncomment later
// import { transactions } from './transactions'; // Will uncomment when transactions.ts exists

export const subsidiaries = pgTable('subsidiaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  code: text('code'),
  description: text('description'),
  parentId: uuid('parent_id').references((): AnyPgColumn => subsidiaries.id), // Self-referencing for hierarchy
  baseCurrencyId: uuid('base_currency_id'),
  countryCode: text('country_code'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  orgCodeUnique: uniqueIndex('subsidiaries_org_code_unique').on(table.organizationId, table.code),
}));

export const subsidiaryRelations = relations(subsidiaries, ({ one, many }) => ({
  // organization relation removed - organizationId is now just a varchar field
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