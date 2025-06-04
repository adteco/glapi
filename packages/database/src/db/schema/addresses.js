"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addressRelations = exports.addresses = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
exports.addresses = (0, pg_core_1.pgTable)('addresses', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    organizationId: (0, pg_core_1.text)('organization_id').notNull(), // Clerk org ID format: org_xxx
    addressee: (0, pg_core_1.text)('addressee'),
    companyName: (0, pg_core_1.text)('company_name'),
    attention: (0, pg_core_1.text)('attention'),
    phoneNumber: (0, pg_core_1.text)('phone_number'),
    line1: (0, pg_core_1.text)('line1'),
    line2: (0, pg_core_1.text)('line2'),
    city: (0, pg_core_1.text)('city'),
    stateProvince: (0, pg_core_1.text)('state_province'),
    postalCode: (0, pg_core_1.text)('postal_code'),
    countryCode: (0, pg_core_1.text)('country_code'), // ISO 2-letter country code
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.addressRelations = (0, drizzle_orm_1.relations)(exports.addresses, ({ many }) => ({
// If an address could be linked to multiple entities (e.g. shared office)
// For now, assuming address is primarily owned/referenced by one entity
// but this setup allows flexibility if needed later.
}));
//# sourceMappingURL=addresses.js.map