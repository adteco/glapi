"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.locationRelations = exports.locations = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
const subsidiaries_1 = require("./subsidiaries");
const transactionLines_1 = require("./transactionLines"); // For relation back from locations to lines
exports.locations = (0, pg_core_1.pgTable)('locations', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    name: (0, pg_core_1.text)('name').notNull(),
    code: (0, pg_core_1.text)('code'),
    description: (0, pg_core_1.text)('description'),
    organizationId: (0, pg_core_1.text)('organization_id').notNull(),
    subsidiaryId: (0, pg_core_1.uuid)('subsidiary_id'),
    addressLine1: (0, pg_core_1.text)('address_line_1'),
    addressLine2: (0, pg_core_1.text)('address_line_2'),
    city: (0, pg_core_1.text)('city'),
    stateProvince: (0, pg_core_1.text)('state_province'), // state or province
    postalCode: (0, pg_core_1.text)('postal_code'),
    countryCode: (0, pg_core_1.text)('country_code'), // ISO 2-letter country code
    isActive: (0, pg_core_1.boolean)('is_active').default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow(),
});
exports.locationRelations = (0, drizzle_orm_1.relations)(exports.locations, ({ one, many }) => ({
    // organization relation removed - organizationId is now just a varchar field
    subsidiary: one(subsidiaries_1.subsidiaries, {
        fields: [exports.locations.subsidiaryId],
        references: [subsidiaries_1.subsidiaries.id],
    }),
    transactionLines: many(transactionLines_1.transactionLines), // Each location can be on many transaction lines
}));
//# sourceMappingURL=locations.js.map