/**
 * Magic Inbox Processor Types
 */

// ============================================================================
// SES Notification Types
// ============================================================================

export interface SESNotification {
  notificationType: 'Received';
  mail: SESMail;
  receipt: SESReceipt;
  content?: string; // Raw email content if using S3 action with "Add header: true"
}

export interface SESMail {
  timestamp: string;
  source: string;
  messageId: string;
  destination: string[];
  headersTruncated: boolean;
  headers: SESHeader[];
  commonHeaders: SESCommonHeaders;
}

export interface SESHeader {
  name: string;
  value: string;
}

export interface SESCommonHeaders {
  returnPath: string;
  from: string[];
  date: string;
  to: string[];
  messageId: string;
  subject: string;
}

export interface SESReceipt {
  timestamp: string;
  processingTimeMillis: number;
  recipients: string[];
  spamVerdict: { status: 'PASS' | 'FAIL' | 'GRAY' | 'PROCESSING_FAILED' };
  virusVerdict: { status: 'PASS' | 'FAIL' | 'GRAY' | 'PROCESSING_FAILED' };
  spfVerdict: { status: 'PASS' | 'FAIL' | 'GRAY' | 'PROCESSING_FAILED' | 'NONE' };
  dkimVerdict: { status: 'PASS' | 'FAIL' | 'GRAY' | 'PROCESSING_FAILED' | 'NONE' };
  dmarcVerdict: { status: 'PASS' | 'FAIL' | 'GRAY' | 'PROCESSING_FAILED' | 'NONE' };
  action: {
    type: 'SNS' | 'S3' | 'Lambda';
    topicArn?: string;
    bucketName?: string;
    objectKey?: string;
  };
}

// ============================================================================
// SNS Event Types
// ============================================================================

export interface SNSEvent {
  Records: SNSRecord[];
}

export interface SNSRecord {
  EventVersion: string;
  EventSubscriptionArn: string;
  EventSource: string;
  Sns: {
    Type: string;
    MessageId: string;
    TopicArn: string;
    Subject: string | null;
    Message: string; // JSON string containing SESNotification
    Timestamp: string;
    SignatureVersion: string;
    Signature: string;
    SigningCertUrl: string;
    UnsubscribeUrl: string;
    MessageAttributes: Record<string, SNSMessageAttribute>;
  };
}

export interface SNSMessageAttribute {
  Type: string;
  Value: string;
}

// ============================================================================
// GLAPI Types
// ============================================================================

export interface GlapiLookupResponse {
  organizationId: string;
  webhookUrl: string;
  webhookSecretHash: string;
}

/**
 * Webhook payload format expected by GLAPI
 * Must match the schema in apps/api/app/api/webhooks/magic-inbox/route.ts
 */
export interface GlapiWebhookPayload {
  messageId: string;
  orgId: string;
  sender: string;
  senderName?: string;
  recipients: string[];
  subject: string;
  documentType: DocumentType;
  confidence: number;
  priority?: 'high' | 'medium' | 'low';
  summary?: string;
  actionItems?: string[];
  entities?: {
    dates?: string[];
    amounts?: string[];
    identifiers?: string[];
    people?: string[];
    companies?: string[];
  };
  extractedInvoice?: ExtractedInvoiceData;
  s3Bucket: string;
  s3Key: string;
  metadata?: {
    headers?: Record<string, unknown>;
    securityInfo?: {
      spamVerdict?: string;
      virusVerdict?: string;
      spfVerdict?: string;
      dkimVerdict?: string;
      dmarcVerdict?: string;
    };
    attachments?: EmailAttachment[];
    processingInfo?: {
      attemptCount: number;
      lastProcessed: string;
      duration?: number;
      errors?: string[];
    };
  };
  receivedAt?: string;
}

export type DocumentType =
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

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  s3Key?: string; // If stored in S3
}

export interface ExtractedInvoiceData {
  vendorName?: string;
  vendorEmail?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  totalAmount?: number;
  currency?: string;
  lineItems?: Array<{
    description: string;
    quantity?: number;
    unitPrice?: number;
    amount?: number;
  }>;
  confidence: number;
}

// ============================================================================
// Processing Result
// ============================================================================

export interface ProcessingResult {
  success: boolean;
  messageId: string;
  organizationId?: string;
  pendingDocumentId?: string;
  error?: string;
}

// ============================================================================
// Configuration
// ============================================================================

export interface ProcessorConfig {
  /** GLAPI base URL */
  glapiBaseUrl: string;
  /** Internal API token for GLAPI */
  glapiInternalToken: string;
  /** S3 bucket for storing raw emails */
  emailStorageBucket?: string;
  /** Whether to enable AI extraction */
  enableAiExtraction: boolean;
  /** Anthropic API key for AI extraction */
  anthropicApiKey?: string;
}
