"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.performanceObligations = exports.satisfactionMethodEnum = exports.obligationTypeEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const contracts_1 = require("./contracts");
exports.obligationTypeEnum = (0, pg_core_1.pgEnum)("obligation_type", [
    "single_point",
    "over_time",
    "series"
]);
exports.satisfactionMethodEnum = (0, pg_core_1.pgEnum)("satisfaction_method", [
    "input_method",
    "output_method",
    "time_based"
]);
exports.performanceObligations = (0, pg_core_1.pgTable)("performance_obligations", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    contractId: (0, pg_core_1.uuid)("contract_id").references(() => contracts_1.contracts.id).notNull(),
    description: (0, pg_core_1.varchar)("description", { length: 255 }).notNull(),
    obligationType: (0, exports.obligationTypeEnum)("obligation_type").notNull(),
    allocatedPrice: (0, pg_core_1.decimal)("allocated_price", { precision: 12, scale: 2 }).notNull(),
    satisfactionMethod: (0, exports.satisfactionMethodEnum)("satisfaction_method").default("time_based"),
    startDate: (0, pg_core_1.date)("start_date").notNull(),
    endDate: (0, pg_core_1.date)("end_date"),
    totalUnits: (0, pg_core_1.decimal)("total_units", { precision: 10, scale: 2 }),
    completedUnits: (0, pg_core_1.decimal)("completed_units", { precision: 10, scale: 2 }).default("0"),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true }).defaultNow()
});
//# sourceMappingURL=performance_obligations.js.map