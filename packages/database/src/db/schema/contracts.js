"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contracts = exports.sspAllocationMethodEnum = exports.contractStatusEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const entities_1 = require("./entities");
const organizations_1 = require("./organizations");
exports.contractStatusEnum = (0, pg_core_1.pgEnum)("contract_status", [
    "draft",
    "signed",
    "active",
    "completed",
    "terminated"
]);
exports.sspAllocationMethodEnum = (0, pg_core_1.pgEnum)("ssp_allocation_method", [
    "observable_evidence",
    "residual",
    "proportional"
]);
exports.contracts = (0, pg_core_1.pgTable)("contracts", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    organizationId: (0, pg_core_1.uuid)("organization_id").references(() => organizations_1.organizations.id).notNull(),
    contractNumber: (0, pg_core_1.varchar)("contract_number", { length: 100 }).notNull(),
    entityId: (0, pg_core_1.uuid)("entity_id").references(() => entities_1.entities.id).notNull(),
    contractDate: (0, pg_core_1.date)("contract_date").notNull(),
    effectiveDate: (0, pg_core_1.date)("effective_date").notNull(),
    contractValue: (0, pg_core_1.decimal)("contract_value", { precision: 12, scale: 2 }).notNull(),
    contractStatus: (0, exports.contractStatusEnum)("contract_status").notNull(),
    sspAllocationMethod: (0, exports.sspAllocationMethodEnum)("ssp_allocation_method").default("proportional"),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true }).defaultNow()
});
//# sourceMappingURL=contracts.js.map