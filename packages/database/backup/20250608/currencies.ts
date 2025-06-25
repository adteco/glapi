import { pgTable, uuid, varchar, integer } from 'drizzle-orm/pg-core';

export const currencies = pgTable('currencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 3 }).notNull().unique(), // e.g., USD
  symbol: varchar('symbol', { length: 5 }).notNull(), // e.g., $
  name: varchar('name', { length: 50 }).notNull(), // e.g., US Dollar
  decimalPlaces: integer('decimal_places').notNull().default(2),
  // Timestamps can be added if needed, but often currencies are fairly static
  // createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  // updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Relations can be added later if other tables need to point TO currencies
// or if currencies need to reference other tables (less common for a simple currency table).
// For example, if you had a table of countries and each currency belonged to a primary country:
// export const currencyRelations = relations(currencies, ({one}) => ({/* ... */})); 