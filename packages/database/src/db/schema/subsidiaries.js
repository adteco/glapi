"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subsidiaryRelations = exports.subsidiaries = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
const currencies_1 = require("./currencies");
// import { jobs } from './jobs'; // Assuming jobs.ts will exist - Will uncomment later
// import { entities } from './entities'; // Assuming entities.ts will exist - Will uncomment later
// import { transactions } from './transactions'; // Will uncomment when transactions.ts exists
exports.subsidiaries = (0, pg_core_1.pgTable)('subsidiaries', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    organizationId: (0, pg_core_1.text)('organization_id').notNull(),
    name: (0, pg_core_1.text)('name').notNull(),
    code: (0, pg_core_1.text)('code'),
    description: (0, pg_core_1.text)('description'),
    parentId: (0, pg_core_1.uuid)('parent_id').references(() => exports.subsidiaries.id), // Self-referencing for hierarchy
    baseCurrencyId: (0, pg_core_1.uuid)('base_currency_id'),
    countryCode: (0, pg_core_1.text)('country_code'),
    isActive: (0, pg_core_1.boolean)('is_active').default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow(),
});
exports.subsidiaryRelations = (0, drizzle_orm_1.relations)(exports.subsidiaries, ({ one, many }) => ({
    // organization relation removed - organizationId is now just a varchar field
    baseCurrency: one(currencies_1.currencies, {
        fields: [exports.subsidiaries.baseCurrencyId],
        references: [currencies_1.currencies.id],
    }),
    parentSubsidiary: one(exports.subsidiaries, {
        fields: [exports.subsidiaries.parentId],
        references: [exports.subsidiaries.id],
        relationName: 'parent'
    }),
    childSubsidiaries: many(exports.subsidiaries, { relationName: 'parent' }),
    // entities: many(entities), // Entities have a primarySubsidiaryId - Will uncomment later
    // jobs: many(jobs), // Jobs have a subsidiaryId - Will uncomment later
    // transactions: many(transactions), // transactions have a subsidiaryId - uncomment when transactions.ts exists
}));
//# sourceMappingURL=subsidiaries.js.map