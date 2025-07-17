/**
 * Sample Database Schema using Drizzle ORM
 * This demonstrates the database structure for entity management
 */

import { pgTable, uuid, text, timestamp, boolean, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * Organizations table
 * Root tenant for multi-tenant applications
 */
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  clerkOrganizationId: text('clerk_organization_id').unique(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Generic entities table
 * This is a simplified example - in practice, you might have separate tables
 * for customers, vendors, etc., or use a more complex entity model
 */
export const entities = pgTable('entities', {
  // Primary key
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Organization relationship (multi-tenant)
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Basic fields
  name: text('name').notNull(),
  displayName: text('display_name'),
  code: text('code'),
  
  // Contact information
  email: text('email'),
  phone: text('phone'),
  website: text('website'),
  
  // Status fields
  status: text('status').notNull().default('active'), // active, inactive, archived
  isActive: boolean('is_active').notNull().default(true),
  
  // Entity types (for polymorphic entities)
  entityTypes: text('entity_types').array(), // ['customer'], ['vendor'], ['customer', 'vendor']
  
  // Parent relationship (for hierarchical data)
  parentEntityId: uuid('parent_entity_id'),
  
  // Flexible metadata storage
  metadata: jsonb('metadata'),
  
  // Audit fields
  createdAt: timestamp('created_at').defaultNow().notNull(),
  createdBy: text('created_by'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  updatedBy: text('updated_by'),
}, (table) => {
  return {
    // Indexes for common queries
    organizationIdx: index('entities_organization_idx').on(table.organizationId),
    statusIdx: index('entities_status_idx').on(table.status),
    nameIdx: index('entities_name_idx').on(table.name),
    codeIdx: index('entities_code_idx').on(table.code),
    emailIdx: index('entities_email_idx').on(table.email),
    entityTypesIdx: index('entities_types_idx').on(table.entityTypes),
    // Unique constraint on code per organization
    uniqueOrgCode: index('entities_org_code_unique').on(table.organizationId, table.code),
  };
});

/**
 * Contacts table
 * For managing individual people associated with entities
 */
export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Contact details
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  fullName: text('full_name').notNull(), // Computed/stored
  title: text('title'),
  department: text('department'),
  
  // Contact methods
  email: text('email'),
  phone: text('phone'),
  mobilePhone: text('mobile_phone'),
  
  // Relationship to entity
  entityId: uuid('entity_id').references(() => entities.id, { onDelete: 'cascade' }),
  isPrimary: boolean('is_primary').default(false),
  
  // Status
  status: text('status').notNull().default('active'),
  isActive: boolean('is_active').notNull().default(true),
  
  // Metadata
  metadata: jsonb('metadata'),
  
  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    organizationIdx: index('contacts_organization_idx').on(table.organizationId),
    entityIdx: index('contacts_entity_idx').on(table.entityId),
    emailIdx: index('contacts_email_idx').on(table.email),
    fullNameIdx: index('contacts_full_name_idx').on(table.fullName),
  };
});

/**
 * Activities table
 * For tracking interactions and activities
 */
export const activities = pgTable('activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Activity details
  type: text('type').notNull(), // call, email, meeting, note, task
  subject: text('subject').notNull(),
  description: text('description'),
  
  // Relationships
  entityId: uuid('entity_id').references(() => entities.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  
  // Timing
  activityDate: timestamp('activity_date').notNull(),
  duration: text('duration'), // ISO 8601 duration
  
  // Status
  status: text('status').notNull().default('completed'), // scheduled, completed, cancelled
  
  // Metadata
  metadata: jsonb('metadata'),
  
  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
  createdBy: text('created_by'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  updatedBy: text('updated_by'),
}, (table) => {
  return {
    organizationIdx: index('activities_organization_idx').on(table.organizationId),
    entityIdx: index('activities_entity_idx').on(table.entityId),
    contactIdx: index('activities_contact_idx').on(table.contactId),
    dateIdx: index('activities_date_idx').on(table.activityDate),
    typeIdx: index('activities_type_idx').on(table.type),
  };
});

/**
 * Define relationships
 */
export const organizationsRelations = relations(organizations, ({ many }) => ({
  entities: many(entities),
  contacts: many(contacts),
  activities: many(activities),
}));

export const entitiesRelations = relations(entities, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [entities.organizationId],
    references: [organizations.id],
  }),
  parentEntity: one(entities, {
    fields: [entities.parentEntityId],
    references: [entities.id],
  }),
  childEntities: many(entities),
  contacts: many(contacts),
  activities: many(activities),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [contacts.organizationId],
    references: [organizations.id],
  }),
  entity: one(entities, {
    fields: [contacts.entityId],
    references: [entities.id],
  }),
  activities: many(activities),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  organization: one(organizations, {
    fields: [activities.organizationId],
    references: [organizations.id],
  }),
  entity: one(entities, {
    fields: [activities.entityId],
    references: [entities.id],
  }),
  contact: one(contacts, {
    fields: [activities.contactId],
    references: [contacts.id],
  }),
}));

/**
 * Type exports for TypeScript
 */
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;

export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;

/**
 * Example metadata types
 */
export interface EntityMetadata {
  // Customer metadata
  creditLimit?: number;
  paymentTerms?: string;
  accountNumber?: string;
  
  // Vendor metadata
  vendorType?: string;
  ein?: string;
  w9OnFile?: boolean;
  
  // Lead/Prospect metadata
  source?: string;
  industry?: string;
  annualRevenue?: number;
  numberOfEmployees?: number;
  leadScore?: number;
  
  // Common metadata
  tags?: string[];
  customFields?: Record<string, any>;
}

export interface ContactMetadata {
  preferredContactMethod?: 'email' | 'phone' | 'mobile';
  socialMedia?: {
    linkedin?: string;
    twitter?: string;
  };
  notes?: string;
  customFields?: Record<string, any>;
}

export interface ActivityMetadata {
  outcome?: string;
  nextSteps?: string;
  attendees?: string[];
  location?: string;
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
  }>;
  customFields?: Record<string, any>;
}