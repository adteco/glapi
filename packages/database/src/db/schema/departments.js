"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.departmentRelations = exports.departments = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
const subsidiaries_1 = require("./subsidiaries");
const transactionLines_1 = require("./transactionLines"); // For relation back from departments to lines
exports.departments = (0, pg_core_1.pgTable)('departments', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    name: (0, pg_core_1.text)('name').notNull(),
    code: (0, pg_core_1.text)('code'),
    description: (0, pg_core_1.text)('description'),
    organizationId: (0, pg_core_1.text)('organization_id').notNull(),
    subsidiaryId: (0, pg_core_1.uuid)('subsidiary_id'),
    isActive: (0, pg_core_1.boolean)('is_active').default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow(),
});
exports.departmentRelations = (0, drizzle_orm_1.relations)(exports.departments, ({ one, many }) => ({
    subsidiary: one(subsidiaries_1.subsidiaries, {
        fields: [exports.departments.subsidiaryId],
        references: [subsidiaries_1.subsidiaries.id],
    }),
    transactionLines: many(transactionLines_1.transactionLines), // Each department can be on many transaction lines
}));
//# sourceMappingURL=departments.js.map