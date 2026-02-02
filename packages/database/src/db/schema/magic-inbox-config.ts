/**
 * Magic Inbox Configuration Schema
 *
 * This schema supports:
 * - Organization-level Magic Inbox configuration
 * - Email address registry (prefix or custom domain)
 * - Usage tracking for billing
 * - Test email functionality
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  decimal,
  integer,
  boolean,
  jsonb,
  pgEnum,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { pendingDocuments } from './pending-documents';

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Email configuration type
 */
export const magicInboxEmailTypeEnum = pgEnum('magic_inbox_email_type', [
  'prefix',        // Uses shared domain: {prefix}@adteco.app
  'custom_domain', // Uses custom domain: inbox@{custom-domain}
]);

export const MagicInboxEmailType = {
  PREFIX: 'prefix',
  CUSTOM_DOMAIN: 'custom_domain',
} as const;

export type MagicInboxEmailTypeValue = typeof MagicInboxEmailType[keyof typeof MagicInboxEmailType];

/**
 * Domain verification status
 */
export const magicInboxVerificationStatusEnum = pgEnum('magic_inbox_verification_status', [
  'pending',   // DNS records not yet verified
  'verified',  // DNS records verified, domain active
  'failed',    // Verification failed
]);

export const MagicInboxVerificationStatus = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  FAILED: 'failed',
} as const;

export type MagicInboxVerificationStatusValue = typeof MagicInboxVerificationStatus[keyof typeof MagicInboxVerificationStatus];

// ============================================================================
// TYPES FOR JSONB FIELDS
// ============================================================================

/**
 * DNS record for domain verification
 */
export interface DNSRecord {
  type: 'MX' | 'TXT' | 'CNAME';
  host: string;
  value: string;
  priority?: number;
  verified?: boolean;
  verifiedAt?: string;
}

/**
 * Organization-level Magic Inbox settings (stored in organizations.settings JSONB)
 */
export interface MagicInboxSettings {
  enabled: boolean;
  emailConfig: {
    type: 'prefix' | 'custom_domain';
    prefix?: string;
    customDomain?: string;
    verificationStatus?: 'pending' | 'verified' | 'failed';
    dnsRecords?: DNSRecord[];
    verifiedAt?: string;
  };
  webhookSecret: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// TABLES
// ============================================================================

/**
 * Magic Inbox Email Registry - Maps email addresses to organizations
 *
 * This table is the primary lookup for the magic-inbox-processor Lambda
 * to route incoming emails to the correct organization's webhook.
 */
export const magicInboxEmailRegistry = pgTable('magic_inbox_email_registry', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Organization reference
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),

  // Email configuration
  emailAddress: varchar('email_address', { length: 255 }).notNull().unique(),
  emailType: magicInboxEmailTypeEnum('email_type').notNull().default('prefix'),
  prefix: varchar('prefix', { length: 100 }), // e.g., "acme" for acme@adteco.app
  customDomain: varchar('custom_domain', { length: 255 }), // e.g., "inbox.acme.com"

  // Status
  isActive: boolean('is_active').notNull().default(true),

  // Domain verification (for custom domains)
  verificationStatus: magicInboxVerificationStatusEnum('verification_status'),
  verificationToken: varchar('verification_token', { length: 255 }),
  dnsRecords: jsonb('dns_records').$type<DNSRecord[]>(),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),

  // Webhook configuration
  webhookUrl: text('webhook_url').notNull(),
  webhookSecretHash: varchar('webhook_secret_hash', { length: 255 }).notNull(),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgIdx: index('mier_organization_idx').on(table.organizationId),
  emailAddressIdx: index('mier_email_address_idx').on(table.emailAddress),
  prefixIdx: index('mier_prefix_idx').on(table.prefix),
  customDomainIdx: index('mier_custom_domain_idx').on(table.customDomain),
  isActiveIdx: index('mier_is_active_idx').on(table.isActive),
}));

/**
 * Magic Inbox Usage - Tracks document processing for billing
 *
 * One record per organization per billing period. Usage is aggregated
 * and synced to Stripe at the end of each billing period.
 */
export const magicInboxUsage = pgTable('magic_inbox_usage', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Organization reference
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),

  // Billing period
  billingPeriodStart: date('billing_period_start').notNull(),
  billingPeriodEnd: date('billing_period_end').notNull(),

  // Usage counters
  documentsProcessed: integer('documents_processed').notNull().default(0),
  documentsConverted: integer('documents_converted').notNull().default(0),
  documentsRejected: integer('documents_rejected').notNull().default(0),

  // Billing info
  unitPrice: decimal('unit_price', { precision: 10, scale: 4 }).notNull().default('0.10'),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }),

  // Stripe integration
  stripeUsageRecordId: varchar('stripe_usage_record_id', { length: 255 }),
  billedAt: timestamp('billed_at', { withTimezone: true }),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgIdx: index('miu_organization_idx').on(table.organizationId),
  billingPeriodIdx: index('miu_billing_period_idx').on(table.billingPeriodStart, table.billingPeriodEnd),
  unbilledIdx: index('miu_unbilled_idx').on(table.billedAt),
  // Unique constraint: one record per org per billing period
  orgPeriodUnique: unique('miu_org_period_unique').on(table.organizationId, table.billingPeriodStart),
}));

/**
 * Magic Inbox Test Emails - Tracks test email results
 *
 * When a user sends a test email, this table tracks whether it was
 * received and processed successfully. Tests expire after 1 hour.
 */
export const magicInboxTestEmails = pgTable('magic_inbox_test_emails', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Organization reference
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),

  // Test details
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  sentTo: varchar('sent_to', { length: 255 }).notNull(),
  received: boolean('received').default(false),
  receivedAt: timestamp('received_at', { withTimezone: true }),
  processed: boolean('processed').default(false),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  pendingDocumentId: uuid('pending_document_id').references(() => pendingDocuments.id),

  // Error tracking
  error: text('error'),

  // Expiry (tests expire after 1 hour)
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (table) => ({
  orgIdx: index('mite_organization_idx').on(table.organizationId),
  expiresAtIdx: index('mite_expires_at_idx').on(table.expiresAt),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const magicInboxEmailRegistryRelations = relations(magicInboxEmailRegistry, ({ one }) => ({
  organization: one(organizations, {
    fields: [magicInboxEmailRegistry.organizationId],
    references: [organizations.id],
  }),
}));

export const magicInboxUsageRelations = relations(magicInboxUsage, ({ one }) => ({
  organization: one(organizations, {
    fields: [magicInboxUsage.organizationId],
    references: [organizations.id],
  }),
}));

export const magicInboxTestEmailsRelations = relations(magicInboxTestEmails, ({ one }) => ({
  organization: one(organizations, {
    fields: [magicInboxTestEmails.organizationId],
    references: [organizations.id],
  }),
  pendingDocument: one(pendingDocuments, {
    fields: [magicInboxTestEmails.pendingDocumentId],
    references: [pendingDocuments.id],
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

// Email Registry types
export type MagicInboxEmailRegistryRecord = typeof magicInboxEmailRegistry.$inferSelect;
export type NewMagicInboxEmailRegistryRecord = typeof magicInboxEmailRegistry.$inferInsert;
export type UpdateMagicInboxEmailRegistryRecord = Partial<Omit<NewMagicInboxEmailRegistryRecord, 'id' | 'organizationId' | 'createdAt'>>;

// Usage types
export type MagicInboxUsageRecord = typeof magicInboxUsage.$inferSelect;
export type NewMagicInboxUsageRecord = typeof magicInboxUsage.$inferInsert;
export type UpdateMagicInboxUsageRecord = Partial<Omit<NewMagicInboxUsageRecord, 'id' | 'organizationId' | 'createdAt'>>;

// Test email types
export type MagicInboxTestEmailRecord = typeof magicInboxTestEmails.$inferSelect;
export type NewMagicInboxTestEmailRecord = typeof magicInboxTestEmails.$inferInsert;
export type UpdateMagicInboxTestEmailRecord = Partial<Omit<NewMagicInboxTestEmailRecord, 'id' | 'organizationId'>>;

// Usage summary for API responses
export interface MagicInboxUsageSummary {
  billingPeriodStart: string;
  billingPeriodEnd: string;
  documentsProcessed: number;
  documentsConverted: number;
  documentsRejected: number;
  unitPrice: string;
  totalAmount: string | null;
  isBilled: boolean;
}

// Billing history record
export interface MagicInboxBillingRecord {
  billingPeriodStart: string;
  billingPeriodEnd: string;
  documentsProcessed: number;
  totalAmount: string;
  billedAt: string;
  stripeUsageRecordId: string | null;
}

// Test result
export interface MagicInboxTestResult {
  id: string;
  status: 'pending' | 'received' | 'processed' | 'expired' | 'failed';
  sentAt: string;
  sentTo: string;
  receivedAt?: string;
  processedAt?: string;
  pendingDocumentId?: string;
  error?: string;
}
