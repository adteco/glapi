import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, boolean, timestamp, jsonb, index, unique, AnyPgColumn } from 'drizzle-orm/pg-core';
import { addresses } from './addresses';

export const entities = pgTable('entities', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull(),
  
  // Basic information
  name: text('name').notNull(),
  displayName: text('display_name'), // For formatting/display purposes
  code: text('code'), // Unique identifier within the organization
  
  // Entity types - stored as array since an entity can be multiple types
  entityTypes: text('entity_types').array().notNull(), // Array of entity types
  
  // Contact information
  email: text('email'),
  phone: text('phone'),
  website: text('website'),
  
  // Address information - REMOVED
  // addressLine1: text('address_line_1'),
  // addressLine2: text('address_line_2'),
  // city: text('city'),
  // stateProvince: text('state_province'),
  // postalCode: text('postal_code'),
  // countryCode: text('country_code'),
  addressId: uuid('address_id').references(() => addresses.id), // ADDED foreign key
  
  // Relationships
  parentEntityId: uuid('parent_entity_id').references((): AnyPgColumn => entities.id), // For contacts belonging to companies
  primaryContactId: uuid('primary_contact_id').references((): AnyPgColumn => entities.id), // For companies to have a primary contact
  
  // Additional fields
  taxId: text('tax_id'), // Tax identification number
  description: text('description'),
  notes: text('notes'),
  
  // Custom fields for flexibility
  customFields: jsonb('custom_fields'),
  metadata: jsonb('metadata'), // For storing type-specific data
  
  // Status
  status: text('status').default('active').notNull(), // active, inactive, archived
  isActive: boolean('is_active').default(true).notNull(),

  // Auth fields (for entities that can log in - typically Employee entities)
  clerkUserId: text('clerk_user_id').unique(), // Clerk external user ID
  role: text('role').default('user'), // user, admin, owner, etc.
  lastLogin: timestamp('last_login', { withTimezone: true }),
  settings: jsonb('settings'), // User-specific settings (UI preferences, etc.)

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Indexes for performance
  orgIdIdx: index('entities_org_id_idx').on(table.organizationId),
  orgCodeIdx: unique('entities_org_code_unique').on(table.organizationId, table.code),
  entityTypesIdx: index('entities_types_idx').on(table.entityTypes),
  parentEntityIdx: index('entities_parent_idx').on(table.parentEntityId),
  emailIdx: index('entities_email_idx').on(table.email),
  statusIdx: index('entities_status_idx').on(table.status, table.isActive),
  // Auth index for Clerk user ID lookups
  clerkUserIdIdx: index('entities_clerk_user_id_idx').on(table.clerkUserId),
}));

// Relations
export const entityRelations = relations(entities, ({ one, many }) => ({
  // Parent entity (for contacts belonging to companies)
  parentEntity: one(entities, {
    fields: [entities.parentEntityId],
    references: [entities.id],
    relationName: 'parentEntity'
  }),
  
  // Child entities (contacts for a company)
  childEntities: many(entities, { 
    relationName: 'parentEntity' 
  }),
  
  // Primary contact for companies
  primaryContact: one(entities, {
    fields: [entities.primaryContactId],
    references: [entities.id],
    relationName: 'primaryContact'
  }),
  
  // Companies where this entity is the primary contact
  companiesAsPrimaryContact: many(entities, { 
    relationName: 'primaryContact' 
  }),
  
  address: one(addresses, { // ADDED relationship
    fields: [entities.addressId],
    references: [addresses.id],
  }),
}));