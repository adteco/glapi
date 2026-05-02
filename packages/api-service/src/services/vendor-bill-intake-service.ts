import {
  and,
  db as defaultDb,
  entities,
  eq,
  ilike,
  or,
  pendingDocuments,
  sql,
  type ContextualDatabase,
} from '@glapi/database';
import type {
  ExtractedData,
  NewPendingDocument,
  PendingDocument,
  PendingDocumentMetadata,
} from '@glapi/database';
import { BaseService } from './base-service';
import { VendorBillApprovalRulesService } from './vendor-bill-approval-rules-service';

export interface VendorBillIntakeServiceOptions {
  db?: ContextualDatabase;
}

export interface CreateManualVendorBillUploadInput {
  file: {
    name: string;
    contentType?: string;
    size: number;
  };
  vendorId?: string;
  vendorName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  totalAmount?: number;
  memo?: string;
}

export interface PendingDocumentIntakeResult {
  document: PendingDocument;
  approval: {
    status: PendingDocument['status'];
    ruleId: string;
    reason: string;
  };
}

export class VendorBillIntakeService extends BaseService {
  private db: ContextualDatabase | typeof defaultDb;

  constructor(context = {}, options: VendorBillIntakeServiceOptions = {}) {
    super(context);
    this.db = options.db || defaultDb;
  }

  async createManualUpload(
    input: CreateManualVendorBillUploadInput
  ): Promise<PendingDocumentIntakeResult> {
    const organizationId = this.requireOrganizationContext();
    const extractedData = this.buildManualUploadExtractedData(input);
    const metadata: PendingDocumentMetadata = {
      attachments: [
        {
          filename: input.file.name,
          contentType: input.file.contentType || 'application/octet-stream',
          size: input.file.size,
        },
      ],
      processingInfo: {
        attemptCount: 1,
        lastProcessed: new Date().toISOString(),
      },
      webhookInfo: {
        receivedAt: new Date().toISOString(),
        sourceSystem: 'manual-vendor-bill-upload',
      },
    };

    const matchedVendorId =
      input.vendorId ||
      (await this.matchVendor({
        organizationId,
        vendorName: input.vendorName,
      }))?.id;

    const [document] = await this.db
      .insert(pendingDocuments)
      .values({
        organizationId,
        source: 'MANUAL_UPLOAD',
        documentType: 'INVOICE',
        status: 'PENDING_REVIEW',
        priority: 'MEDIUM',
        subject: input.file.name,
        summary: input.memo || `Uploaded vendor bill: ${input.file.name}`,
        confidenceScore: '0.5000',
        extractedData,
        metadata,
        matchedVendorId,
        matchedVendorConfidence: matchedVendorId ? '1.0000' : undefined,
        receivedAt: new Date(),
      } satisfies NewPendingDocument)
      .returning();

    return this.applyApprovalRules(document.id);
  }

  async applyApprovalRules(documentId: string): Promise<PendingDocumentIntakeResult> {
    const organizationId = this.requireOrganizationContext();
    const document = await this.getDocument(documentId, organizationId);

    let matchedVendorId = document.matchedVendorId;
    let matchedVendorConfidence = document.matchedVendorConfidence;

    if (!matchedVendorId) {
      const invoice = document.extractedData?.invoice;
      const matchedVendor = await this.matchVendor({
        organizationId,
        vendorEmail: invoice?.vendorEmail || document.senderEmail || undefined,
        vendorName: invoice?.vendorName,
      });

      if (matchedVendor) {
        matchedVendorId = matchedVendor.id;
        matchedVendorConfidence = matchedVendor.confidence.toFixed(4);
      }
    }

    const documentForRules = matchedVendorId
      ? { ...document, matchedVendorId, matchedVendorConfidence }
      : document;

    const rules = new VendorBillApprovalRulesService(this.context, { db: this.db });
    const decision = await rules.evaluate(documentForRules);

    const [updated] = await this.db
      .update(pendingDocuments)
      .set({
        status: decision.status,
        matchedVendorId,
        matchedVendorConfidence,
        reviewedAt: decision.status === 'APPROVED' ? new Date() : document.reviewedAt,
        reviewNotes: decision.status === 'APPROVED' ? decision.reason : document.reviewNotes,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(pendingDocuments.id, documentId),
          eq(pendingDocuments.organizationId, organizationId)
        )
      )
      .returning();

    return {
      document: updated,
      approval: {
        status: updated.status,
        ruleId: decision.ruleId,
        reason: decision.reason,
      },
    };
  }

  private async getDocument(documentId: string, organizationId: string): Promise<PendingDocument> {
    const [document] = await this.db
      .select()
      .from(pendingDocuments)
      .where(
        and(
          eq(pendingDocuments.id, documentId),
          eq(pendingDocuments.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!document) {
      throw new Error('Pending document not found');
    }

    return document;
  }

  private buildManualUploadExtractedData(input: CreateManualVendorBillUploadInput): ExtractedData {
    const invoice = {
      vendorName: input.vendorName,
      invoiceNumber: input.invoiceNumber || this.inferInvoiceNumber(input.file.name),
      invoiceDate: input.invoiceDate,
      dueDate: input.dueDate,
      totalAmount: input.totalAmount,
      notes: input.memo,
    };

    return {
      invoice,
      rawAnalysis: {
        intakeMode: 'manual_upload',
        extractionProvider: 'pending_ai_extraction',
      },
    };
  }

  private inferInvoiceNumber(filename: string): string | undefined {
    const match = filename.match(/(?:invoice|inv|bill)[-_ ]?([a-z0-9-]+)/i);
    return match?.[1];
  }

  private async matchVendor(input: {
    organizationId: string;
    vendorEmail?: string;
    vendorName?: string;
  }): Promise<{ id: string; name: string; confidence: number } | null> {
    const vendorTypeCondition = sql`(${entities.entityTypes} @> ARRAY['Vendor']::text[] OR ${entities.entityTypes} @> ARRAY['vendor']::text[])`;

    if (input.vendorEmail) {
      const [vendor] = await this.db
        .select({ id: entities.id, name: entities.name })
        .from(entities)
        .where(
          and(
            eq(entities.organizationId, input.organizationId),
            vendorTypeCondition,
            eq(entities.email, input.vendorEmail)
          )
        )
        .limit(1);

      if (vendor) {
        return { id: vendor.id, name: vendor.name, confidence: 0.95 };
      }
    }

    if (input.vendorName) {
      const [vendor] = await this.db
        .select({ id: entities.id, name: entities.name })
        .from(entities)
        .where(
          and(
            eq(entities.organizationId, input.organizationId),
            vendorTypeCondition,
            or(
              ilike(entities.name, input.vendorName),
              ilike(entities.displayName, input.vendorName),
              ilike(entities.name, `%${input.vendorName}%`)
            )
          )
        )
        .limit(1);

      if (vendor) {
        return { id: vendor.id, name: vendor.name, confidence: 0.8 };
      }
    }

    return null;
  }
}

export const vendorBillIntakeService = {
  create: (context = {}, options: VendorBillIntakeServiceOptions = {}) =>
    new VendorBillIntakeService(context, options),
};
