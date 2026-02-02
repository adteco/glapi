/**
 * Pending Documents Schema (Magic Inbox Integration)
 *
 * This schema supports:
 * - Storing documents received from Magic Inbox for review
 * - AI-extracted data with confidence scoring
 * - Human-in-the-loop approval workflow
 * - Conversion to vendor bills or other record types
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  decimal,
  jsonb,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { subsidiaries } from './subsidiaries';
import { entities } from './entities';
import { vendorBills } from './vendor-bills';

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Source of the pending document
 */
export const pendingDocumentSourceEnum = pgEnum('pending_document_source', [
  'MAGIC_INBOX',     // Received via Magic Inbox email processing
  'MANUAL_UPLOAD',   // Uploaded directly by user
  'EMAIL_FORWARD',   // Forwarded email attachment
  'API_IMPORT',      // Imported via API
]);

export const PendingDocumentSource = {
  MAGIC_INBOX: 'MAGIC_INBOX',
  MANUAL_UPLOAD: 'MANUAL_UPLOAD',
  EMAIL_FORWARD: 'EMAIL_FORWARD',
  API_IMPORT: 'API_IMPORT',
} as const;

export type PendingDocumentSourceValue = typeof PendingDocumentSource[keyof typeof PendingDocumentSource];

/**
 * Document type classification (from AI analysis)
 */
export const pendingDocumentTypeEnum = pgEnum('pending_document_type', [
  'INVOICE',           // Vendor invoice/bill
  'PURCHASE_ORDER',    // Purchase order
  'RECEIPT',           // Receipt/packing slip
  'SHIPPING',          // Shipping notification
  'SUPPORT',           // Support request
  'MARKETING',         // Marketing material
  'CONTRACT',          // Contract document
  'REPORT',            // Report or statement
  'NEWSLETTER',        // Newsletter
  'MEETING',           // Meeting invite/notes
  'CREDIT_MEMO',       // Vendor credit memo
  'UNKNOWN',           // Could not classify
]);

export const PendingDocumentType = {
  INVOICE: 'INVOICE',
  PURCHASE_ORDER: 'PURCHASE_ORDER',
  RECEIPT: 'RECEIPT',
  SHIPPING: 'SHIPPING',
  SUPPORT: 'SUPPORT',
  MARKETING: 'MARKETING',
  CONTRACT: 'CONTRACT',
  REPORT: 'REPORT',
  NEWSLETTER: 'NEWSLETTER',
  MEETING: 'MEETING',
  CREDIT_MEMO: 'CREDIT_MEMO',
  UNKNOWN: 'UNKNOWN',
} as const;

export type PendingDocumentTypeValue = typeof PendingDocumentType[keyof typeof PendingDocumentType];

/**
 * Pending Document Status Flow:
 * PENDING_REVIEW → APPROVED → CONVERTED
 *              ↓
 *           REJECTED
 *              ↓
 *           ARCHIVED
 */
export const pendingDocumentStatusEnum = pgEnum('pending_document_status', [
  'PENDING_REVIEW',    // Awaiting human review
  'IN_REVIEW',         // Currently being reviewed
  'APPROVED',          // Approved, ready for conversion
  'REJECTED',          // Rejected by reviewer
  'CONVERTED',         // Successfully converted to target record
  'CONVERSION_FAILED', // Conversion attempted but failed
  'ARCHIVED',          // Archived (spam, duplicate, etc.)
]);

export const PendingDocumentStatus = {
  PENDING_REVIEW: 'PENDING_REVIEW',
  IN_REVIEW: 'IN_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CONVERTED: 'CONVERTED',
  CONVERSION_FAILED: 'CONVERSION_FAILED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type PendingDocumentStatusValue = typeof PendingDocumentStatus[keyof typeof PendingDocumentStatus];

/**
 * Valid status transitions
 */
export const VALID_PENDING_DOCUMENT_TRANSITIONS: Record<PendingDocumentStatusValue, PendingDocumentStatusValue[]> = {
  PENDING_REVIEW: ['IN_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'],
  IN_REVIEW: ['APPROVED', 'REJECTED', 'PENDING_REVIEW'],
  APPROVED: ['CONVERTED', 'CONVERSION_FAILED', 'PENDING_REVIEW'],
  REJECTED: ['PENDING_REVIEW', 'ARCHIVED'],
  CONVERTED: [],
  CONVERSION_FAILED: ['APPROVED', 'PENDING_REVIEW', 'ARCHIVED'],
  ARCHIVED: ['PENDING_REVIEW'],
};

/**
 * Priority level (from AI analysis or manual)
 */
export const pendingDocumentPriorityEnum = pgEnum('pending_document_priority', [
  'HIGH',
  'MEDIUM',
  'LOW',
]);

export const PendingDocumentPriority = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const;

export type PendingDocumentPriorityValue = typeof PendingDocumentPriority[keyof typeof PendingDocumentPriority];

/**
 * Target record type for conversion
 */
export const conversionTargetTypeEnum = pgEnum('conversion_target_type', [
  'VENDOR_BILL',
  'PURCHASE_ORDER',
  'VENDOR_CREDIT',
  'SUPPORT_TICKET',
  'NONE',
]);

export const ConversionTargetType = {
  VENDOR_BILL: 'VENDOR_BILL',
  PURCHASE_ORDER: 'PURCHASE_ORDER',
  VENDOR_CREDIT: 'VENDOR_CREDIT',
  SUPPORT_TICKET: 'SUPPORT_TICKET',
  NONE: 'NONE',
} as const;

export type ConversionTargetTypeValue = typeof ConversionTargetType[keyof typeof ConversionTargetType];

// ============================================================================
// TYPES FOR JSONB FIELDS
// ============================================================================

/**
 * AI-extracted entities from document
 */
export interface ExtractedEntities {
  dates?: string[];
  amounts?: string[];
  identifiers?: string[];   // Invoice numbers, PO numbers, etc.
  people?: string[];
  companies?: string[];
}

/**
 * AI-extracted structured data for invoice/bill conversion
 */
export interface ExtractedInvoiceData {
  vendorName?: string;
  vendorEmail?: string;
  vendorAddress?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  poNumber?: string;
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
  currency?: string;
  lineItems?: Array<{
    description?: string;
    quantity?: number;
    unitPrice?: number;
    amount?: number;
  }>;
  paymentTerms?: string;
  notes?: string;
}

/**
 * Complete extracted data structure
 */
export interface ExtractedData {
  entities?: ExtractedEntities;
  invoice?: ExtractedInvoiceData;
  rawAnalysis?: Record<string, unknown>;
}

/**
 * Metadata from Magic Inbox processing
 */
export interface PendingDocumentMetadata {
  // Original email headers
  headers?: Record<string, unknown>;

  // Security verdicts from email processing
  securityInfo?: {
    spamVerdict?: string;
    virusVerdict?: string;
    spfVerdict?: string;
    dkimVerdict?: string;
    dmarcVerdict?: string;
  };

  // Attachment information
  attachments?: Array<{
    filename: string;
    contentType: string;
    size: number;
    s3Key?: string;
  }>;

  // Processing information
  processingInfo?: {
    attemptCount: number;
    lastProcessed: string;
    duration?: number;
    errors?: string[];
  };

  // Webhook info
  webhookInfo?: {
    receivedAt: string;
    sourceSystem: string;
    requestId?: string;
  };
}

// ============================================================================
// TABLES
// ============================================================================

/**
 * Pending Documents - Documents awaiting review and conversion
 */
export const pendingDocuments = pgTable('pending_documents', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Organization context
  organizationId: uuid('organization_id').notNull(),
  subsidiaryId: uuid('subsidiary_id').references(() => subsidiaries.id),

  // Source identification
  source: pendingDocumentSourceEnum('source').notNull().default('MAGIC_INBOX'),
  messageId: varchar('message_id', { length: 255 }).unique(), // SES message ID for deduplication

  // Document classification
  documentType: pendingDocumentTypeEnum('document_type').notNull().default('UNKNOWN'),
  status: pendingDocumentStatusEnum('status').notNull().default('PENDING_REVIEW'),
  priority: pendingDocumentPriorityEnum('priority').default('MEDIUM'),

  // Email/sender info
  senderEmail: varchar('sender_email', { length: 255 }),
  senderName: varchar('sender_name', { length: 255 }),
  recipients: text('recipients'), // Comma-separated or JSON array
  subject: varchar('subject', { length: 500 }),

  // S3 storage for raw content
  s3Bucket: varchar('s3_bucket', { length: 255 }),
  s3Key: varchar('s3_key', { length: 500 }),

  // AI analysis results
  confidenceScore: decimal('confidence_score', { precision: 5, scale: 4 }), // 0.0000 to 1.0000
  summary: text('summary'),
  actionItems: jsonb('action_items').$type<string[]>(),
  extractedData: jsonb('extracted_data').$type<ExtractedData>(),

  // Metadata (headers, security verdicts, attachments, etc.)
  metadata: jsonb('metadata').$type<PendingDocumentMetadata>(),

  // Matched vendor (if AI could identify)
  matchedVendorId: uuid('matched_vendor_id').references(() => entities.id),
  matchedVendorConfidence: decimal('matched_vendor_confidence', { precision: 5, scale: 4 }),

  // Review tracking
  reviewedBy: uuid('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewNotes: text('review_notes'),
  rejectionReason: text('rejection_reason'),

  // Conversion tracking
  conversionTargetType: conversionTargetTypeEnum('conversion_target_type'),
  convertedToId: uuid('converted_to_id'), // Polymorphic reference to created record
  convertedAt: timestamp('converted_at', { withTimezone: true }),
  convertedBy: uuid('converted_by'),
  conversionError: text('conversion_error'),

  // User-edited data (overrides extracted data during review)
  editedData: jsonb('edited_data').$type<ExtractedData>(),

  // Timestamps
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgIdx: index('pd_organization_idx').on(table.organizationId),
  subsidiaryIdx: index('pd_subsidiary_idx').on(table.subsidiaryId),
  statusIdx: index('pd_status_idx').on(table.status),
  documentTypeIdx: index('pd_document_type_idx').on(table.documentType),
  priorityIdx: index('pd_priority_idx').on(table.priority),
  messageIdIdx: index('pd_message_id_idx').on(table.messageId),
  receivedAtIdx: index('pd_received_at_idx').on(table.receivedAt),
  matchedVendorIdx: index('pd_matched_vendor_idx').on(table.matchedVendorId),
  conversionTargetIdx: index('pd_conversion_target_idx').on(table.conversionTargetType, table.convertedToId),
}));

/**
 * Pending Document Review History - Audit trail for review actions
 */
export const pendingDocumentReviewHistory = pgTable('pending_document_review_history', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Parent reference
  pendingDocumentId: uuid('pending_document_id')
    .notNull()
    .references(() => pendingDocuments.id, { onDelete: 'cascade' }),

  // Action details
  action: varchar('action', { length: 50 }).notNull(), // 'VIEWED', 'EDITED', 'APPROVED', 'REJECTED', 'CONVERTED', 'ARCHIVED'

  // Status transition
  fromStatus: pendingDocumentStatusEnum('from_status'),
  toStatus: pendingDocumentStatusEnum('to_status'),

  // Actor
  performedBy: uuid('performed_by').notNull(),
  performedByName: varchar('performed_by_name', { length: 255 }),

  // Details
  notes: text('notes'),
  changes: jsonb('changes').$type<Record<string, { old: unknown; new: unknown }>>(),

  // Timestamp
  performedAt: timestamp('performed_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  documentIdx: index('pdrh_document_idx').on(table.pendingDocumentId),
  performedByIdx: index('pdrh_performed_by_idx').on(table.performedBy),
  actionIdx: index('pdrh_action_idx').on(table.action),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const pendingDocumentsRelations = relations(pendingDocuments, ({ one, many }) => ({
  subsidiary: one(subsidiaries, {
    fields: [pendingDocuments.subsidiaryId],
    references: [subsidiaries.id],
  }),
  matchedVendor: one(entities, {
    fields: [pendingDocuments.matchedVendorId],
    references: [entities.id],
  }),
  reviewHistory: many(pendingDocumentReviewHistory),
}));

export const pendingDocumentReviewHistoryRelations = relations(pendingDocumentReviewHistory, ({ one }) => ({
  pendingDocument: one(pendingDocuments, {
    fields: [pendingDocumentReviewHistory.pendingDocumentId],
    references: [pendingDocuments.id],
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type PendingDocument = typeof pendingDocuments.$inferSelect;
export type NewPendingDocument = typeof pendingDocuments.$inferInsert;
export type UpdatePendingDocument = Partial<Omit<NewPendingDocument, 'id' | 'organizationId' | 'createdAt'>>;

export type PendingDocumentReviewHistoryRecord = typeof pendingDocumentReviewHistory.$inferSelect;
export type NewPendingDocumentReviewHistoryRecord = typeof pendingDocumentReviewHistory.$inferInsert;

// Full document with relations
export interface PendingDocumentWithRelations extends PendingDocument {
  subsidiary?: typeof subsidiaries.$inferSelect | null;
  matchedVendor?: typeof entities.$inferSelect | null;
  reviewHistory?: PendingDocumentReviewHistoryRecord[];
}
