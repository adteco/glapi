"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.organizations = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.organizations = (0, pg_core_1.pgTable)("organizations", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    stytchOrgId: (0, pg_core_1.varchar)("stytch_org_id", { length: 100 }).unique().notNull(),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    slug: (0, pg_core_1.varchar)("slug", { length: 100 }).unique().notNull(),
    settings: (0, pg_core_1.jsonb)("settings"),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true }).defaultNow()
});
//# sourceMappingURL=organizations.js.map