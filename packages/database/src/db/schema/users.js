"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.users = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const organizations_1 = require("./organizations");
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    stytchUserId: (0, pg_core_1.varchar)("stytch_user_id", { length: 100 }).unique().notNull(),
    email: (0, pg_core_1.varchar)("email", { length: 255 }).notNull(),
    firstName: (0, pg_core_1.varchar)("first_name", { length: 100 }),
    lastName: (0, pg_core_1.varchar)("last_name", { length: 100 }),
    organizationId: (0, pg_core_1.uuid)("organization_id").references(() => organizations_1.organizations.id).notNull(),
    role: (0, pg_core_1.varchar)("role", { length: 50 }).default("user").notNull(),
    settings: (0, pg_core_1.jsonb)("settings"),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    lastLogin: (0, pg_core_1.timestamp)("last_login", { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true }).defaultNow()
});
//# sourceMappingURL=users.js.map