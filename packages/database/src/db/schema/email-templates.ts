import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  index,
  uniqueIndex,
  pgEnum,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { entities } from './entities';

// ============================================================================
// ENUMS
// ============================================================================

export const emailTemplateStatusEnum = pgEnum('email_template_status', [
  'draft',
  'active',
  'archived',
]);

export const emailTemplateCategoryEnum = pgEnum('email_template_category', [
  'transactional',
  'marketing',
  'notification',
  'workflow',
  'custom',
]);

// ============================================================================
// EMAIL TEMPLATES TABLE
// ============================================================================

export const emailTemplates = pgTable(
  'email_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    description: text('description'),
    category: emailTemplateCategoryEnum('category').default('custom').notNull(),
    subject: varchar('subject', { length: 500 }).notNull(),
    htmlBody: text('html_body').notNull(),
    textBody: text('text_body'),
    variables: jsonb('variables').default([]).notNull().$type<TemplateVariable[]>(),
    status: emailTemplateStatusEnum('status').default('draft').notNull(),
    previewData: jsonb('preview_data').default({}).$type<Record<string, unknown>>(),
    fromName: varchar('from_name', { length: 255 }),
    fromEmail: varchar('from_email', { length: 255 }),
    replyTo: varchar('reply_to', { length: 255 }),
    version: integer('version').default(1).notNull(),
    createdBy: uuid('created_by').references(() => entities.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => entities.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgSlugUnique: uniqueIndex('idx_email_templates_org_slug').on(
      table.organizationId,
      table.slug
    ),
    orgIdx: index('idx_email_templates_organization').on(table.organizationId),
    orgStatusIdx: index('idx_email_templates_org_status').on(
      table.organizationId,
      table.status
    ),
    orgCategoryIdx: index('idx_email_templates_org_category').on(
      table.organizationId,
      table.category
    ),
    orgNameIdx: index('idx_email_templates_org_name').on(
      table.organizationId,
      table.name
    ),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const emailTemplatesRelations = relations(emailTemplates, ({ one }) => ({
  organization: one(organizations, {
    fields: [emailTemplates.organizationId],
    references: [organizations.id],
  }),
  createdByEntity: one(entities, {
    fields: [emailTemplates.createdBy],
    references: [entities.id],
    relationName: 'emailTemplateCreator',
  }),
  updatedByEntity: one(entities, {
    fields: [emailTemplates.updatedBy],
    references: [entities.id],
    relationName: 'emailTemplateUpdater',
  }),
}));

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Variable definition for email templates
 */
export interface TemplateVariable {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'currency' | 'url' | 'email';
  required: boolean;
  defaultValue?: string | number | boolean;
  description?: string;
  format?: string;
}

// Email template status type
export type EmailTemplateStatus = 'draft' | 'active' | 'archived';

// Email template category type
export type EmailTemplateCategory =
  | 'transactional'
  | 'marketing'
  | 'notification'
  | 'workflow'
  | 'custom';

// Inferred types
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type NewEmailTemplate = typeof emailTemplates.$inferInsert;
export type UpdateEmailTemplate = Partial<
  Omit<NewEmailTemplate, 'id' | 'organizationId' | 'createdAt' | 'createdBy'>
>;

// Status and category constants
export const EMAIL_TEMPLATE_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  ARCHIVED: 'archived',
} as const;

export const EMAIL_TEMPLATE_CATEGORY = {
  TRANSACTIONAL: 'transactional',
  MARKETING: 'marketing',
  NOTIFICATION: 'notification',
  WORKFLOW: 'workflow',
  CUSTOM: 'custom',
} as const;
