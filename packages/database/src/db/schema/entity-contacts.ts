import { relations, InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { pgTable, uuid, text, boolean, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { entities } from './entities';

/**
 * Junction table for many-to-many relationship between entities and contacts.
 * This allows contacts to be associated with multiple entities (companies/leads/customers).
 */
export const entityContacts = pgTable('entity_contacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  role: text('role'), // 'Primary', 'Billing', 'Technical', 'Sales', etc.
  isPrimary: boolean('is_primary').default(false).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueContact: unique('entity_contacts_unique').on(table.entityId, table.contactId),
  entityIdx: index('entity_contacts_entity_idx').on(table.entityId),
  contactIdx: index('entity_contacts_contact_idx').on(table.contactId),
  orgIdx: index('entity_contacts_org_idx').on(table.organizationId),
}));

// Relations
export const entityContactsRelations = relations(entityContacts, ({ one }) => ({
  organization: one(organizations, {
    fields: [entityContacts.organizationId],
    references: [organizations.id],
  }),
  // The entity (company/lead/customer) that has this contact
  entity: one(entities, {
    fields: [entityContacts.entityId],
    references: [entities.id],
    relationName: 'entityToContacts',
  }),
  // The contact entity
  contact: one(entities, {
    fields: [entityContacts.contactId],
    references: [entities.id],
    relationName: 'contactToEntities',
  }),
}));

// Types
export type EntityContact = InferSelectModel<typeof entityContacts>;
export type NewEntityContact = InferInsertModel<typeof entityContacts>;
export type UpdateEntityContact = Partial<Omit<NewEntityContact, 'id' | 'organizationId' | 'createdAt'>>;

// Contact role constants
export const CONTACT_ROLES = {
  PRIMARY: 'Primary',
  BILLING: 'Billing',
  TECHNICAL: 'Technical',
  SALES: 'Sales',
  SUPPORT: 'Support',
  EXECUTIVE: 'Executive',
  OTHER: 'Other',
} as const;

export type ContactRole = typeof CONTACT_ROLES[keyof typeof CONTACT_ROLES];
