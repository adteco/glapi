"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taxCodeRelations = exports.taxCodes = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
const transactionLines_1 = require("./transactionLines"); // For relation back from tax codes to lines
exports.taxCodes = (0, pg_core_1.pgTable)('tax_codes', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    name: (0, pg_core_1.varchar)('name', { length: 100 }).notNull().unique(),
    description: (0, pg_core_1.varchar)('description', { length: 255 }),
    rate: (0, pg_core_1.decimal)('rate', { precision: 8, scale: 4 }).notNull().default('0'), // e.g., 0.08 for 8%
    isCompound: (0, pg_core_1.boolean)('is_compound').default(false),
    // taxAgencyId: uuid('tax_agency_id'), // Optional: if you track tax agencies
    isActive: (0, pg_core_1.boolean)('is_active').default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow(),
});
exports.taxCodeRelations = (0, drizzle_orm_1.relations)(exports.taxCodes, ({ many }) => ({
    transactionLines: many(transactionLines_1.transactionLines), // Each tax code can be on many transaction lines
}));
//# sourceMappingURL=taxCodes.js.map