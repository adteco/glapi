/**
 * Magic Inbox Service
 *
 * Handles receiving and processing documents from the Magic Inbox webhook.
 * Creates pending documents for human review and manages the conversion workflow.
 */

import { db, pendingDocuments, eq, organizations, withOrganizationContext } from '@glapi/database';
import type {
  NewPendingDocument,
  PendingDocument,
  ExtractedData,
  PendingDocumentMetadata,
} from '@glapi/database';
import {
  type MagicInboxWebhookPayload,
  type MagicInboxWebhookResponse,
  mapDocumentType,
  mapPriority,
  mapExtractedEntities,
  mapExtractedInvoice,
} from '../types/magic-inbox.types';
import { MagicInboxUsageService } from './magic-inbox-usage-service';
import { VendorBillIntakeService } from './vendor-bill-intake-service';

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Process an incoming webhook payload from magic-inbox-processor
 * Creates a pending document for review
 */
export async function processMagicInboxWebhook(
  payload: MagicInboxWebhookPayload
): Promise<MagicInboxWebhookResponse> {
  // Resolve organization ID first (needed for per-org duplicate check)
  const organizationId = await resolveOrganizationId(payload.orgId);

  if (!organizationId) {
    console.error(`[MagicInbox] Could not resolve organization for orgId: ${payload.orgId}`);
    return {
      received: false,
      error: `Unknown organization: ${payload.orgId}`,
    };
  }

  // Check for duplicate by messageId WITHIN this organization
  // (same email to different orgs should create separate documents)
  if (payload.messageId) {
    const existing = await withOrganizationContext(
      { organizationId },
      async (contextDb) => {
        return contextDb.query.pendingDocuments.findFirst({
          where: eq(pendingDocuments.messageId, payload.messageId),
        });
      }
    );

    if (existing) {
      console.log(`[MagicInbox] Duplicate messageId for org ${organizationId}: ${payload.messageId}`);
      return {
        received: true,
        duplicate: true,
        documentId: existing.id,
      };
    }
  }

  // Build extracted data
  const extractedData: ExtractedData = {
    entities: mapExtractedEntities(payload.entities),
    invoice: mapExtractedInvoice(payload.extractedInvoice),
    rawAnalysis: payload.metadata as Record<string, unknown>,
  };

  // Build metadata
  const metadata: PendingDocumentMetadata = {
    headers: payload.metadata?.headers,
    securityInfo: payload.metadata?.securityInfo,
    attachments: payload.metadata?.attachments,
    processingInfo: payload.metadata?.processingInfo,
    webhookInfo: {
      receivedAt: new Date().toISOString(),
      sourceSystem: 'magic-inbox-processor',
    },
  };

  // Create the pending document
  const newDocument: NewPendingDocument = {
    organizationId,
    source: 'MAGIC_INBOX',
    messageId: payload.messageId,
    documentType: mapDocumentType(payload.documentType),
    status: 'PENDING_REVIEW',
    priority: mapPriority(payload.priority),
    senderEmail: payload.sender,
    senderName: payload.senderName,
    recipients: payload.recipients.join(', '),
    subject: payload.subject,
    s3Bucket: payload.s3Bucket,
    s3Key: payload.s3Key,
    confidenceScore: payload.confidence.toFixed(4),
    summary: payload.summary,
    actionItems: payload.actionItems,
    extractedData,
    metadata,
    receivedAt: payload.receivedAt ? new Date(payload.receivedAt) : new Date(),
  };

  // Use RLS context for the insert - pendingDocuments table has RLS policies
  const [document] = await withOrganizationContext(
    { organizationId },
    async (contextDb) => {
      return contextDb
        .insert(pendingDocuments)
        .values(newDocument)
        .returning();
    }
  );

  let processedDocument = document;
  if (document.documentType === 'INVOICE') {
    try {
      const intakeService = new VendorBillIntakeService({ organizationId });
      const result = await intakeService.applyApprovalRules(document.id);
      processedDocument = result.document;
      console.log(
        `[MagicInbox] Applied bill approval rule ${result.approval.ruleId} to ${document.id}: ${result.approval.status}`
      );
    } catch (approvalError) {
      console.error(`[MagicInbox] Failed to apply bill approval rules for ${document.id}:`, approvalError);
    }
  }

  console.log(`[MagicInbox] Created pending document ${processedDocument.id} for org ${organizationId}`);

  // Track usage for billing
  try {
    const usageService = new MagicInboxUsageService({ organizationId });
    await usageService.recordDocumentProcessed(processedDocument.id);
    console.log(`[MagicInbox] Recorded usage for document ${processedDocument.id}`);
  } catch (usageError) {
    // Log but don't fail the webhook - usage tracking is not critical path
    console.error(`[MagicInbox] Failed to record usage for document ${document.id}:`, usageError);
  }

  return {
    received: true,
    documentId: processedDocument.id,
  };
}

/**
 * Resolve an orgId to a database organization ID
 * The orgId could be:
 * - An actual UUID organization ID
 * - An email prefix (e.g., "acme" from "acme@adteco.app")
 * - A Clerk organization ID
 */
async function resolveOrganizationId(orgId: string): Promise<string | null> {
  // If it looks like a UUID, try direct lookup
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(orgId)) {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    });
    if (org) return org.id;
  }

  // Try to find by Clerk ID
  const orgByClerkId = await db.query.organizations.findFirst({
    where: eq(organizations.clerkOrgId, orgId),
  });
  if (orgByClerkId) return orgByClerkId.id;

  // Try to find by slug (email prefix mapping)
  const orgBySlug = await db.query.organizations.findFirst({
    where: eq(organizations.slug, orgId),
  });
  if (orgBySlug) return orgBySlug.id;

  // Try by name as fallback
  const orgByName = await db.query.organizations.findFirst({
    where: eq(organizations.name, orgId),
  });
  if (orgByName) return orgByName.id;

  // If orgId is 'test-org' or similar, look for a test organization
  if (orgId === 'test-org' || orgId === 'test') {
    const testOrg = await db.query.organizations.findFirst();
    if (testOrg) {
      const testOrgId = testOrg.id as unknown as string;
      console.log(`[MagicInbox] Using fallback org ${testOrgId} for test orgId: ${orgId}`);
      return testOrgId;
    }
  }

  return null;
}

/**
 * Get a pending document by ID
 */
export async function getPendingDocumentById(id: string): Promise<PendingDocument | null> {
  const document = await db.query.pendingDocuments.findFirst({
    where: eq(pendingDocuments.id, id),
  });
  return document ?? null;
}

/**
 * Get a pending document by message ID (for deduplication checks)
 */
export async function getPendingDocumentByMessageId(messageId: string): Promise<PendingDocument | null> {
  const document = await db.query.pendingDocuments.findFirst({
    where: eq(pendingDocuments.messageId, messageId),
  });
  return document ?? null;
}

// Export as object for consistency with other services
export const magicInboxService = {
  processMagicInboxWebhook,
  getPendingDocumentById,
  getPendingDocumentByMessageId,
  resolveOrganizationId,
};
