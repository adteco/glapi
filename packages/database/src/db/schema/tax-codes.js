"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taxCodesRelations = exports.taxCodes = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
exports.taxCodes = (0, pg_core_1.pgTable)('tax_codes', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    subsidiaryId: (0, pg_core_1.uuid)('subsidiary_id').notNull(),
    taxCode: (0, pg_core_1.text)('tax_code').notNull(),
    taxName: (0, pg_core_1.text)('tax_name').notNull(),
    taxRate: (0, pg_core_1.decimal)('tax_rate', { precision: 8, scale: 5 }).notNull(),
    taxAccountId: (0, pg_core_1.uuid)('tax_account_id'),
    taxAgencyId: (0, pg_core_1.uuid)('tax_agency_id'), // Tax authority (vendor)
    isActive: (0, pg_core_1.boolean)('is_active').default(true).notNull(),
    effectiveDate: (0, pg_core_1.date)('effective_date').notNull(),
    expirationDate: (0, pg_core_1.date)('expiration_date'),
    jurisdiction: (0, pg_core_1.text)('jurisdiction'), // State, country, etc.
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
    subCodeIdx: (0, pg_core_1.uniqueIndex)('idx_tax_codes_sub_code').on(table.subsidiaryId, table.taxCode),
    activeIdx: (0, pg_core_1.uniqueIndex)('idx_tax_codes_active').on(table.isActive, table.effectiveDate),
}));
exports.taxCodesRelations = (0, drizzle_orm_1.relations)(exports.taxCodes, ({ one, many }) => ({
    subsidiary: one(subsidiaries_1.subsidiaries, {
        fields: [exports.taxCodes.subsidiaryId],
        references: [subsidiaries_1.subsidiaries.id],
    }),
    taxAccount: one(accounts_1.accounts, {
        fields: [exports.taxCodes.taxAccountId],
        references: [accounts_1.accounts.id],
    }),
    taxAgency: one(entities_1.entities, {
        fields: [exports.taxCodes.taxAgencyId],
        references: [entities_1.entities.id],
    }),
    // transactionLines relation defined in transaction-types.ts to avoid circular dependency
}));
// Import references
const subsidiaries_1 = require("./subsidiaries");
const accounts_1 = require("./accounts");
const entities_1 = require("./entities");
// import { businessTransactionLines } from './transaction-types'; // Avoid circular dependency
//# sourceMappingURL=tax-codes.js.map