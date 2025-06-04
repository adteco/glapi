"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activityCodeRelations = exports.activityCodes = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
const transactionLines_1 = require("./transactionLines"); // For relation back from activity codes to lines
exports.activityCodes = (0, pg_core_1.pgTable)('activity_codes', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    code: (0, pg_core_1.varchar)('code', { length: 50 }).unique(), // Optional short code for the activity
    description: (0, pg_core_1.text)('description'),
    isActive: (0, pg_core_1.boolean)('is_active').default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow(),
});
exports.activityCodeRelations = (0, drizzle_orm_1.relations)(exports.activityCodes, ({ many }) => ({
    transactionLines: many(transactionLines_1.transactionLines), // Each activity code can be on many transaction lines
}));
//# sourceMappingURL=activityCodes.js.map