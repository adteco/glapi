import { pgTable, text, integer, boolean, decimal, timestamp, uniqueIndex, date, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const taxCodes = pgTable('tax_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  subsidiaryId: uuid('subsidiary_id').notNull(),
  taxCode: text('tax_code').notNull(),
  taxName: text('tax_name').notNull(),
  taxRate: decimal('tax_rate', { precision: 8, scale: 5 }).notNull(),
  taxAccountId: uuid('tax_account_id'),
  taxAgencyId: uuid('tax_agency_id'), // Tax authority (vendor)
  isActive: boolean('is_active').default(true).notNull(),
  effectiveDate: date('effective_date').notNull(),
  expirationDate: date('expiration_date'),
  jurisdiction: text('jurisdiction'), // State, country, etc.
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  subCodeIdx: uniqueIndex('idx_tax_codes_sub_code').on(table.subsidiaryId, table.taxCode),
  activeIdx: uniqueIndex('idx_tax_codes_active').on(table.isActive, table.effectiveDate),
}));

export const taxCodesRelations = relations(taxCodes, ({ one, many }) => ({
  subsidiary: one(subsidiaries, {
    fields: [taxCodes.subsidiaryId],
    references: [subsidiaries.id],
  }),
  taxAccount: one(accounts, {
    fields: [taxCodes.taxAccountId],
    references: [accounts.id],
  }),
  taxAgency: one(entities, {
    fields: [taxCodes.taxAgencyId],
    references: [entities.id],
  }),
  // transactionLines relation defined in transaction-types.ts to avoid circular dependency
}));

// Import references
import { subsidiaries } from './subsidiaries';
import { accounts } from './accounts';
import { entities } from './entities';
// import { businessTransactionLines } from './transaction-types'; // Avoid circular dependency