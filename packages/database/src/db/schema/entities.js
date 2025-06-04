"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.entityRelations = exports.entities = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
const addresses_1 = require("./addresses");
exports.entities = (0, pg_core_1.pgTable)('entities', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    organizationId: (0, pg_core_1.text)('organization_id').notNull(),
    // Basic information
    name: (0, pg_core_1.text)('name').notNull(),
    displayName: (0, pg_core_1.text)('display_name'), // For formatting/display purposes
    code: (0, pg_core_1.text)('code'), // Unique identifier within the organization
    // Entity types - stored as array since an entity can be multiple types
    entityTypes: (0, pg_core_1.text)('entity_types').array().notNull(), // Array of entity types
    // Contact information
    email: (0, pg_core_1.text)('email'),
    phone: (0, pg_core_1.text)('phone'),
    website: (0, pg_core_1.text)('website'),
    // Address information - REMOVED
    // addressLine1: text('address_line_1'),
    // addressLine2: text('address_line_2'),
    // city: text('city'),
    // stateProvince: text('state_province'),
    // postalCode: text('postal_code'),
    // countryCode: text('country_code'),
    addressId: (0, pg_core_1.uuid)('address_id').references(() => addresses_1.addresses.id), // ADDED foreign key
    // Relationships
    parentEntityId: (0, pg_core_1.uuid)('parent_entity_id').references(() => exports.entities.id), // For contacts belonging to companies
    primaryContactId: (0, pg_core_1.uuid)('primary_contact_id').references(() => exports.entities.id), // For companies to have a primary contact
    // Additional fields
    taxId: (0, pg_core_1.text)('tax_id'), // Tax identification number
    description: (0, pg_core_1.text)('description'),
    notes: (0, pg_core_1.text)('notes'),
    // Custom fields for flexibility
    customFields: (0, pg_core_1.jsonb)('custom_fields'),
    metadata: (0, pg_core_1.jsonb)('metadata'), // For storing type-specific data
    // Status
    status: (0, pg_core_1.text)('status').default('active').notNull(), // active, inactive, archived
    isActive: (0, pg_core_1.boolean)('is_active').default(true).notNull(),
    // Timestamps
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
    // Indexes for performance
    orgIdIdx: (0, pg_core_1.index)('entities_org_id_idx').on(table.organizationId),
    orgCodeIdx: (0, pg_core_1.unique)('entities_org_code_unique').on(table.organizationId, table.code),
    entityTypesIdx: (0, pg_core_1.index)('entities_types_idx').on(table.entityTypes),
    parentEntityIdx: (0, pg_core_1.index)('entities_parent_idx').on(table.parentEntityId),
    emailIdx: (0, pg_core_1.index)('entities_email_idx').on(table.email),
    statusIdx: (0, pg_core_1.index)('entities_status_idx').on(table.status, table.isActive),
}));
// Relations
exports.entityRelations = (0, drizzle_orm_1.relations)(exports.entities, ({ one, many }) => ({
    // Parent entity (for contacts belonging to companies)
    parentEntity: one(exports.entities, {
        fields: [exports.entities.parentEntityId],
        references: [exports.entities.id],
        relationName: 'parentEntity'
    }),
    // Child entities (contacts for a company)
    childEntities: many(exports.entities, {
        relationName: 'parentEntity'
    }),
    // Primary contact for companies
    primaryContact: one(exports.entities, {
        fields: [exports.entities.primaryContactId],
        references: [exports.entities.id],
        relationName: 'primaryContact'
    }),
    // Companies where this entity is the primary contact
    companiesAsPrimaryContact: many(exports.entities, {
        relationName: 'primaryContact'
    }),
    address: one(addresses_1.addresses, {
        fields: [exports.entities.addressId],
        references: [addresses_1.addresses.id],
    }),
}));
//# sourceMappingURL=entities.js.map