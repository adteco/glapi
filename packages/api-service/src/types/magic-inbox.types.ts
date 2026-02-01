/**
 * Magic Inbox Types
 *
 * Types for the Magic Inbox webhook integration with glapi.
 * These types define the payload structure received from magic-inbox-processor.
 */

import type {
  PendingDocumentTypeValue,
  PendingDocumentPriorityValue,
  ExtractedEntities,
  ExtractedInvoiceData,
} from '@glapi/database';

// ============================================================================
// Webhook Payload Types
// ============================================================================

/**
 * Document type classification from AI analysis
 * Maps to pending_document_type enum
 */
export type MagicInboxDocumentType =
  | 'invoice'
  | 'purchase_order'
  | 'receipt'
  | 'shipping'
  | 'support'
  | 'marketing'
  | 'contract'
  | 'report'
  | 'newsletter'
  | 'meeting'
  | 'credit_memo'
  | 'unknown';

/**
 * Priority level from AI analysis
 */
export type MagicInboxPriority = 'high' | 'medium' | 'low';

/**
 * Entities extracted by AI from the document
 */
export interface MagicInboxExtractedEntities {
  dates?: string[];
  amounts?: string[];
  identifiers?: string[];
  people?: string[];
  companies?: string[];
}

/**
 * Security verdicts from email processing
 */
export interface MagicInboxSecurityInfo {
  spamVerdict?: string;
  virusVerdict?: string;
  spfVerdict?: string;
  dkimVerdict?: string;
  dmarcVerdict?: string;
}

/**
 * Attachment information
 */
export interface MagicInboxAttachment {
  filename: string;
  contentType: string;
  size: number;
  s3Key?: string;
}

/**
 * Processing information from magic-inbox-processor
 */
export interface MagicInboxProcessingInfo {
  attemptCount: number;
  lastProcessed: string;
  duration?: number;
  errors?: string[];
}

/**
 * Main webhook payload from magic-inbox-processor
 */
export interface MagicInboxWebhookPayload {
  // Identification
  messageId: string;          // SES message ID - used for deduplication
  orgId: string;              // Organization identifier (email prefix or mapped org ID)

  // Sender info
  sender: string;             // Email address
  senderName?: string;        // Display name if available
  recipients: string[];       // Recipient email addresses
  subject: string;

  // Document classification
  documentType: MagicInboxDocumentType;
  confidence: number;         // 0-1 confidence score
  priority?: MagicInboxPriority;

  // AI analysis results
  summary?: string;
  actionItems?: string[];
  entities?: MagicInboxExtractedEntities;

  // Extracted structured data (for invoices/bills)
  extractedInvoice?: {
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
  };

  // S3 storage
  s3Bucket: string;
  s3Key: string;

  // Metadata
  metadata?: {
    headers?: Record<string, unknown>;
    securityInfo?: MagicInboxSecurityInfo;
    attachments?: MagicInboxAttachment[];
    processingInfo?: MagicInboxProcessingInfo;
  };

  // Timestamp
  receivedAt?: string;        // ISO timestamp when email was received
}

/**
 * Webhook response
 */
export interface MagicInboxWebhookResponse {
  received: boolean;
  documentId?: string;        // ID of created pending_document
  duplicate?: boolean;        // True if messageId already exists
  error?: string;
}

// ============================================================================
// Mapping Utilities
// ============================================================================

/**
 * Map magic inbox document type to database enum value
 */
export function mapDocumentType(type: MagicInboxDocumentType): PendingDocumentTypeValue {
  const mapping: Record<MagicInboxDocumentType, PendingDocumentTypeValue> = {
    invoice: 'INVOICE',
    purchase_order: 'PURCHASE_ORDER',
    receipt: 'RECEIPT',
    shipping: 'SHIPPING',
    support: 'SUPPORT',
    marketing: 'MARKETING',
    contract: 'CONTRACT',
    report: 'REPORT',
    newsletter: 'NEWSLETTER',
    meeting: 'MEETING',
    credit_memo: 'CREDIT_MEMO',
    unknown: 'UNKNOWN',
  };
  return mapping[type] || 'UNKNOWN';
}

/**
 * Map magic inbox priority to database enum value
 */
export function mapPriority(priority?: MagicInboxPriority): PendingDocumentPriorityValue {
  if (!priority) return 'MEDIUM';
  const mapping: Record<MagicInboxPriority, PendingDocumentPriorityValue> = {
    high: 'HIGH',
    medium: 'MEDIUM',
    low: 'LOW',
  };
  return mapping[priority] || 'MEDIUM';
}

/**
 * Map webhook entities to database format
 */
export function mapExtractedEntities(entities?: MagicInboxExtractedEntities): ExtractedEntities | undefined {
  if (!entities) return undefined;
  return {
    dates: entities.dates,
    amounts: entities.amounts,
    identifiers: entities.identifiers,
    people: entities.people,
    companies: entities.companies,
  };
}

/**
 * Map webhook invoice data to database format
 */
export function mapExtractedInvoice(invoice?: MagicInboxWebhookPayload['extractedInvoice']): ExtractedInvoiceData | undefined {
  if (!invoice) return undefined;
  return {
    vendorName: invoice.vendorName,
    vendorEmail: invoice.vendorEmail,
    vendorAddress: invoice.vendorAddress,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    poNumber: invoice.poNumber,
    subtotal: invoice.subtotal,
    taxAmount: invoice.taxAmount,
    totalAmount: invoice.totalAmount,
    currency: invoice.currency,
    lineItems: invoice.lineItems,
    paymentTerms: invoice.paymentTerms,
    notes: invoice.notes,
  };
}
