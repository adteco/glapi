"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unitsOfMeasureRelations = exports.unitsOfMeasure = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
const transactionLines_1 = require("./transactionLines"); // For potential relation back if UoM is used in many lines
exports.unitsOfMeasure = (0, pg_core_1.pgTable)('units_of_measure', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    name: (0, pg_core_1.varchar)('name', { length: 100 }).notNull().unique(),
    abbreviation: (0, pg_core_1.varchar)('abbreviation', { length: 10 }),
    isActive: (0, pg_core_1.boolean)('is_active').default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow(),
});
// Optional: Relation back to transactionLines if you want to easily query
// all transaction lines that use a particular unit of measure.
exports.unitsOfMeasureRelations = (0, drizzle_orm_1.relations)(exports.unitsOfMeasure, ({ many }) => ({
    transactionLines: many(transactionLines_1.transactionLines),
}));
//# sourceMappingURL=unitsOfMeasure.js.map