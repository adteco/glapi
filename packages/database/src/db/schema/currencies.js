"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.currencies = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.currencies = (0, pg_core_1.pgTable)('currencies', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    code: (0, pg_core_1.varchar)('code', { length: 3 }).notNull().unique(), // e.g., USD
    symbol: (0, pg_core_1.varchar)('symbol', { length: 5 }).notNull(), // e.g., $
    name: (0, pg_core_1.varchar)('name', { length: 50 }).notNull(), // e.g., US Dollar
    decimalPlaces: (0, pg_core_1.integer)('decimal_places').notNull().default(2),
    // Timestamps can be added if needed, but often currencies are fairly static
    // createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    // updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
// Relations can be added later if other tables need to point TO currencies
// or if currencies need to reference other tables (less common for a simple currency table).
// For example, if you had a table of countries and each currency belonged to a primary country:
// export const currencyRelations = relations(currencies, ({one}) => ({/* ... */})); 
//# sourceMappingURL=currencies.js.map