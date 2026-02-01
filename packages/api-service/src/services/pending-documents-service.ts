/**
 * Pending Documents Service
 *
 * Manages pending documents from Magic Inbox for review and conversion.
 * Supports approval workflows and document-to-record conversion.
 */

import { BaseService } from './base-service';
import { ServiceError } from '../types/common.types';
import {
  db as defaultDb,
  pendingDocuments,
  pendingDocumentReviewHistory,
  entities,
  eq,
  and,
  desc,
  asc,
  ilike,
  inArray,
  type ContextualDatabase,
} from '@glapi/database';
import type {
  PendingDocument,
  NewPendingDocument,
  UpdatePendingDocument,
  PendingDocumentReviewHistoryRecord,
  NewPendingDocumentReviewHistoryRecord,
  PendingDocumentStatusValue,
  PendingDocumentTypeValue,
  PendingDocumentPriorityValue,
  ExtractedData,
  VALID_PENDING_DOCUMENT_TRANSITIONS,
} from '@glapi/database';

// ============================================================================
// Types
// ============================================================================

export interface PendingDocumentsServiceOptions {
  db?: ContextualDatabase;
}

export interface PendingDocumentFilters {
  status?: PendingDocumentStatusValue | PendingDocumentStatusValue[];
  documentType?: PendingDocumentTypeValue | PendingDocumentTypeValue[];
  priority?: PendingDocumentPriorityValue | PendingDocumentPriorityValue[];
  search?: string;
  startDate?: string;
  endDate?: string;
  matchedVendorId?: string;
}

export interface ApproveDocumentInput {
  id: string;
  notes?: string;
  editedData?: ExtractedData;
}

export interface RejectDocumentInput {
  id: string;
  reason: string;
  notes?: string;
}

export interface ConvertDocumentInput {
  id: string;
  targetType: 'VENDOR_BILL' | 'PURCHASE_ORDER' | 'VENDOR_CREDIT';
  overrideData?: ExtractedData;
}

// ============================================================================
// Service
// ============================================================================

export class PendingDocumentsService extends BaseService {
  private db: ContextualDatabase | typeof defaultDb;

  constructor(context = {}, options: PendingDocumentsServiceOptions = {}) {
    super(context);
    this.db = options.db || defaultDb;
  }

  // --------------------------------------------------------------------------
  // CRUD Operations
  // --------------------------------------------------------------------------

  /**
   * List pending documents with filters and pagination
   */
  async list(
    pagination: { page?: number; limit?: number } = {},
    filters: PendingDocumentFilters = {},
    orderBy: 'receivedAt' | 'priority' | 'documentType' | 'status' = 'receivedAt',
    orderDirection: 'asc' | 'desc' = 'desc'
  ) {
    const organizationId = this.requireOrganizationContext();
    const page = pagination.page || 1;
    const limit = Math.min(pagination.limit || 50, 100);
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [eq(pendingDocuments.organizationId, organizationId)];

    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      conditions.push(inArray(pendingDocuments.status, statuses));
    }

    if (filters.documentType) {
      const types = Array.isArray(filters.documentType) ? filters.documentType : [filters.documentType];
      conditions.push(inArray(pendingDocuments.documentType, types));
    }

    if (filters.priority) {
      const priorities = Array.isArray(filters.priority) ? filters.priority : [filters.priority];
      conditions.push(inArray(pendingDocuments.priority, priorities));
    }

    if (filters.search) {
      conditions.push(
        ilike(pendingDocuments.subject, `%${filters.search}%`)
      );
    }

    if (filters.matchedVendorId) {
      conditions.push(eq(pendingDocuments.matchedVendorId, filters.matchedVendorId));
    }

    // Build order clause
    const orderColumn = {
      receivedAt: pendingDocuments.receivedAt,
      priority: pendingDocuments.priority,
      documentType: pendingDocuments.documentType,
      status: pendingDocuments.status,
    }[orderBy];

    const orderFn = orderDirection === 'desc' ? desc : asc;

    // Execute query
    const [documents, countResult] = await Promise.all([
      this.db
        .select()
        .from(pendingDocuments)
        .where(and(...conditions))
        .orderBy(orderFn(orderColumn))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: pendingDocuments.id })
        .from(pendingDocuments)
        .where(and(...conditions)),
    ]);

    const total = countResult.length;

    return {
      data: documents,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single pending document by ID
   */
  async getById(id: string): Promise<PendingDocument | null> {
    const organizationId = this.requireOrganizationContext();

    const [document] = await this.db
      .select()
      .from(pendingDocuments)
      .where(
        and(
          eq(pendingDocuments.id, id),
          eq(pendingDocuments.organizationId, organizationId)
        )
      )
      .limit(1);

    return document || null;
  }

  /**
   * Get a pending document with its review history
   */
  async getByIdWithHistory(id: string) {
    const organizationId = this.requireOrganizationContext();

    const [document] = await this.db
      .select()
      .from(pendingDocuments)
      .where(
        and(
          eq(pendingDocuments.id, id),
          eq(pendingDocuments.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!document) {
      return null;
    }

    const history = await this.db
      .select()
      .from(pendingDocumentReviewHistory)
      .where(eq(pendingDocumentReviewHistory.pendingDocumentId, id))
      .orderBy(desc(pendingDocumentReviewHistory.performedAt));

    // Get matched vendor if present
    let matchedVendor = null;
    if (document.matchedVendorId) {
      const [vendor] = await this.db
        .select()
        .from(entities)
        .where(eq(entities.id, document.matchedVendorId))
        .limit(1);
      matchedVendor = vendor || null;
    }

    return {
      ...document,
      reviewHistory: history,
      matchedVendor,
    };
  }

  /**
   * Update extracted data (before approval)
   */
  async updateExtractedData(id: string, editedData: ExtractedData): Promise<PendingDocument> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const document = await this.getById(id);
    if (!document) {
      throw new ServiceError('Document not found', 'NOT_FOUND', 404);
    }

    if (document.status === 'CONVERTED' || document.status === 'ARCHIVED') {
      throw new ServiceError('Cannot edit converted or archived documents', 'INVALID_STATE', 400);
    }

    const [updated] = await this.db
      .update(pendingDocuments)
      .set({
        editedData,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(pendingDocuments.id, id),
          eq(pendingDocuments.organizationId, organizationId)
        )
      )
      .returning();

    // Record the edit in history
    await this.addHistoryRecord(id, 'EDITED', userId, document.status, document.status, {
      notes: 'Updated extracted data',
      changes: { editedData: { old: document.editedData as unknown, new: editedData as unknown } },
    });

    return updated;
  }

  /**
   * Approve a pending document for conversion
   */
  async approve(input: ApproveDocumentInput): Promise<PendingDocument> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const document = await this.getById(input.id);
    if (!document) {
      throw new ServiceError('Document not found', 'NOT_FOUND', 404);
    }

    // Validate state transition
    const validTransitions = ['PENDING_REVIEW', 'IN_REVIEW', 'CONVERSION_FAILED'];
    if (!validTransitions.includes(document.status)) {
      throw new ServiceError(
        `Cannot approve document in ${document.status} status`,
        'INVALID_STATE_TRANSITION',
        400
      );
    }

    const [updated] = await this.db
      .update(pendingDocuments)
      .set({
        status: 'APPROVED',
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewNotes: input.notes,
        editedData: input.editedData || document.editedData,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(pendingDocuments.id, input.id),
          eq(pendingDocuments.organizationId, organizationId)
        )
      )
      .returning();

    // Record approval in history
    await this.addHistoryRecord(input.id, 'APPROVED', userId, document.status, 'APPROVED', {
      notes: input.notes,
    });

    return updated;
  }

  /**
   * Reject a pending document
   */
  async reject(input: RejectDocumentInput): Promise<PendingDocument> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const document = await this.getById(input.id);
    if (!document) {
      throw new ServiceError('Document not found', 'NOT_FOUND', 404);
    }

    // Validate state transition
    const validTransitions = ['PENDING_REVIEW', 'IN_REVIEW', 'APPROVED'];
    if (!validTransitions.includes(document.status)) {
      throw new ServiceError(
        `Cannot reject document in ${document.status} status`,
        'INVALID_STATE_TRANSITION',
        400
      );
    }

    const [updated] = await this.db
      .update(pendingDocuments)
      .set({
        status: 'REJECTED',
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewNotes: input.notes,
        rejectionReason: input.reason,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(pendingDocuments.id, input.id),
          eq(pendingDocuments.organizationId, organizationId)
        )
      )
      .returning();

    // Record rejection in history
    await this.addHistoryRecord(input.id, 'REJECTED', userId, document.status, 'REJECTED', {
      notes: `Rejection reason: ${input.reason}${input.notes ? `. Notes: ${input.notes}` : ''}`,
    });

    return updated;
  }

  /**
   * Archive a document (mark as spam, duplicate, etc.)
   */
  async archive(id: string, reason?: string): Promise<PendingDocument> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const document = await this.getById(id);
    if (!document) {
      throw new ServiceError('Document not found', 'NOT_FOUND', 404);
    }

    if (document.status === 'CONVERTED') {
      throw new ServiceError('Cannot archive converted documents', 'INVALID_STATE', 400);
    }

    const [updated] = await this.db
      .update(pendingDocuments)
      .set({
        status: 'ARCHIVED',
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewNotes: reason,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(pendingDocuments.id, id),
          eq(pendingDocuments.organizationId, organizationId)
        )
      )
      .returning();

    // Record archival in history
    await this.addHistoryRecord(id, 'ARCHIVED', userId, document.status, 'ARCHIVED', {
      notes: reason,
    });

    return updated;
  }

  /**
   * Mark a document as converted (called after successful conversion)
   */
  async markAsConverted(
    id: string,
    targetType: 'VENDOR_BILL' | 'PURCHASE_ORDER' | 'VENDOR_CREDIT' | 'SUPPORT_TICKET',
    convertedToId: string
  ): Promise<PendingDocument> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const document = await this.getById(id);
    if (!document) {
      throw new ServiceError('Document not found', 'NOT_FOUND', 404);
    }

    if (document.status !== 'APPROVED') {
      throw new ServiceError('Only approved documents can be converted', 'INVALID_STATE', 400);
    }

    const [updated] = await this.db
      .update(pendingDocuments)
      .set({
        status: 'CONVERTED',
        conversionTargetType: targetType,
        convertedToId,
        convertedAt: new Date(),
        convertedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(pendingDocuments.id, id),
          eq(pendingDocuments.organizationId, organizationId)
        )
      )
      .returning();

    // Record conversion in history
    await this.addHistoryRecord(id, 'CONVERTED', userId, 'APPROVED', 'CONVERTED', {
      notes: `Converted to ${targetType}: ${convertedToId}`,
    });

    return updated;
  }

  /**
   * Mark a document conversion as failed
   */
  async markConversionFailed(id: string, error: string): Promise<PendingDocument> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const document = await this.getById(id);
    if (!document) {
      throw new ServiceError('Document not found', 'NOT_FOUND', 404);
    }

    const [updated] = await this.db
      .update(pendingDocuments)
      .set({
        status: 'CONVERSION_FAILED',
        conversionError: error,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(pendingDocuments.id, id),
          eq(pendingDocuments.organizationId, organizationId)
        )
      )
      .returning();

    // Record failure in history
    await this.addHistoryRecord(id, 'CONVERSION_FAILED', userId, document.status, 'CONVERSION_FAILED', {
      notes: `Conversion failed: ${error}`,
    });

    return updated;
  }

  /**
   * Get counts by status for dashboard
   */
  async getStatusCounts(): Promise<Record<PendingDocumentStatusValue, number>> {
    const organizationId = this.requireOrganizationContext();

    const results = await this.db
      .select({
        status: pendingDocuments.status,
        count: pendingDocuments.id,
      })
      .from(pendingDocuments)
      .where(eq(pendingDocuments.organizationId, organizationId));

    // Count by status
    const counts: Record<string, number> = {
      PENDING_REVIEW: 0,
      IN_REVIEW: 0,
      APPROVED: 0,
      REJECTED: 0,
      CONVERTED: 0,
      CONVERSION_FAILED: 0,
      ARCHIVED: 0,
    };

    results.forEach((row) => {
      if (row.status && counts[row.status] !== undefined) {
        counts[row.status]++;
      }
    });

    return counts as Record<PendingDocumentStatusValue, number>;
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private async addHistoryRecord(
    documentId: string,
    action: string,
    userId: string,
    fromStatus: PendingDocumentStatusValue | null,
    toStatus: PendingDocumentStatusValue,
    extra: { notes?: string; changes?: Record<string, { old: unknown; new: unknown }> } = {}
  ): Promise<void> {
    await this.db.insert(pendingDocumentReviewHistory).values({
      pendingDocumentId: documentId,
      action,
      performedBy: userId,
      fromStatus,
      toStatus,
      notes: extra.notes,
      changes: extra.changes,
    });
  }
}

// Export singleton-style function for simple usage
export const pendingDocumentsService = {
  create: (context = {}, options: PendingDocumentsServiceOptions = {}) =>
    new PendingDocumentsService(context, options),
};
