/**
 * Document Conversion Service
 *
 * Handles converting pending documents (from Magic Inbox) into
 * actual accounting records like vendor bills, purchase orders, etc.
 */

import { BaseService } from './base-service';
import { ServiceError } from '../types/common.types';
import { PendingDocumentsService } from './pending-documents-service';
import { VendorBillService } from './vendor-bill-service';
import {
  db as defaultDb,
  entities,
  subsidiaries,
  eq,
  and,
  ilike,
  sql,
  type ContextualDatabase,
} from '@glapi/database';
import type {
  PendingDocument,
  ExtractedData,
} from '@glapi/database';
import type {
  CreateVendorBillInput,
  CreateVendorBillLineInput,
  VendorBillWithDetails,
} from '../types/procure-to-pay.types';

// ============================================================================
// Types
// ============================================================================

export interface DocumentConversionServiceOptions {
  db?: ContextualDatabase;
}

export interface ConvertToVendorBillInput {
  pendingDocumentId: string;
  vendorId?: string;
  subsidiaryId?: string;
  overrides?: {
    vendorInvoiceNumber?: string;
    billDate?: string;
    dueDate?: string;
    memo?: string;
    lines?: CreateVendorBillLineInput[];
  };
}

export interface ConvertToVendorBillResult {
  vendorBill: VendorBillWithDetails;
  pendingDocument: PendingDocument;
  mappingDetails: {
    vendorMatched: boolean;
    extractedVendorName: string | null;
    extractedTotal: number | null;
    extractedInvoiceNumber: string | null;
  };
}

// ============================================================================
// Service
// ============================================================================

export class DocumentConversionService extends BaseService {
  private db: ContextualDatabase | typeof defaultDb;

  constructor(context = {}, options: DocumentConversionServiceOptions = {}) {
    super(context);
    this.db = options.db || defaultDb;
  }

  /**
   * Convert a pending document to a vendor bill
   */
  async convertToVendorBill(input: ConvertToVendorBillInput): Promise<ConvertToVendorBillResult> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // Get the pending document
    const pendingDocService = new PendingDocumentsService(this.context, { db: this.db });
    const document = await pendingDocService.getById(input.pendingDocumentId);

    if (!document) {
      throw new ServiceError('Pending document not found', 'NOT_FOUND', 404);
    }

    if (document.status !== 'APPROVED') {
      throw new ServiceError('Document must be approved before conversion', 'INVALID_STATE', 400);
    }

    // Extract data from the document
    const extractedData = (document.editedData || document.extractedData) as ExtractedData | null;
    const invoiceData = extractedData?.invoice;

    // Determine vendor ID
    let vendorId = input.vendorId || document.matchedVendorId;
    let vendorMatched = !!vendorId;

    // If no vendor ID, try to match by name from extracted data
    if (!vendorId && invoiceData?.vendorName) {
      const matchedVendor = await this.findVendorByName(invoiceData.vendorName, organizationId);
      if (matchedVendor) {
        vendorId = matchedVendor.id;
        vendorMatched = true;
      }
    }

    if (!vendorId) {
      throw new ServiceError(
        'Could not determine vendor. Please select a vendor manually.',
        'VENDOR_NOT_FOUND',
        400
      );
    }

    // Determine subsidiary
    let subsidiaryId = input.subsidiaryId;
    if (!subsidiaryId) {
      // Get default/first subsidiary for the organization
      const [defaultSub] = await this.db
        .select({ id: subsidiaries.id })
        .from(subsidiaries)
        .where(eq(subsidiaries.organizationId, organizationId))
        .limit(1);

      if (!defaultSub) {
        throw new ServiceError(
          'No subsidiary found. Please create a subsidiary first.',
          'SUBSIDIARY_NOT_FOUND',
          400
        );
      }
      subsidiaryId = defaultSub.id;
    }

    // Build vendor bill input
    const billDate = input.overrides?.billDate || invoiceData?.invoiceDate || new Date().toISOString().split('T')[0];
    const dueDate = input.overrides?.dueDate || invoiceData?.dueDate || this.calculateDueDate(billDate, 30);

    // Build line items
    const lines = input.overrides?.lines || this.buildLinesFromExtracted(invoiceData);

    const vendorBillInput: CreateVendorBillInput = {
      subsidiaryId,
      vendorId,
      vendorInvoiceNumber: input.overrides?.vendorInvoiceNumber || invoiceData?.invoiceNumber,
      billDate,
      dueDate,
      paymentTerms: invoiceData?.paymentTerms,
      memo: input.overrides?.memo || document.summary || undefined,
      internalNotes: `Converted from Magic Inbox document: ${document.id}`,
      metadata: {
        sourceDocument: {
          id: document.id,
          messageId: document.messageId,
          senderEmail: document.senderEmail,
          subject: document.subject,
        },
      },
      lines,
    };

    // Create the vendor bill
    const vendorBillService = new VendorBillService(this.context, { db: this.db });
    const vendorBill = await vendorBillService.createVendorBill(vendorBillInput);

    // Mark the pending document as converted
    const updatedDocument = await pendingDocService.markAsConverted(
      input.pendingDocumentId,
      'VENDOR_BILL',
      vendorBill.id
    );

    return {
      vendorBill,
      pendingDocument: updatedDocument,
      mappingDetails: {
        vendorMatched,
        extractedVendorName: invoiceData?.vendorName || null,
        extractedTotal: invoiceData?.totalAmount || null,
        extractedInvoiceNumber: invoiceData?.invoiceNumber || null,
      },
    };
  }

  /**
   * Get a preview of how a document would be converted
   * without actually creating the vendor bill
   */
  async previewConversion(pendingDocumentId: string): Promise<{
    document: PendingDocument;
    suggestedVendor: { id: string; name: string } | null;
    suggestedData: Partial<CreateVendorBillInput>;
    warnings: string[];
  }> {
    const organizationId = this.requireOrganizationContext();

    const pendingDocService = new PendingDocumentsService(this.context, { db: this.db });
    const document = await pendingDocService.getById(pendingDocumentId);

    if (!document) {
      throw new ServiceError('Pending document not found', 'NOT_FOUND', 404);
    }

    const extractedData = (document.editedData || document.extractedData) as ExtractedData | null;
    const invoiceData = extractedData?.invoice;
    const warnings: string[] = [];

    // Try to find suggested vendor
    let suggestedVendor: { id: string; name: string } | null = null;
    if (document.matchedVendorId) {
      const [vendor] = await this.db
        .select({ id: entities.id, name: entities.name })
        .from(entities)
        .where(
          and(
            eq(entities.id, document.matchedVendorId),
            eq(entities.organizationId, organizationId)
          )
        )
        .limit(1);
      if (vendor) {
        suggestedVendor = { id: vendor.id, name: vendor.name || 'Unknown' };
      }
    } else if (invoiceData?.vendorName) {
      const matched = await this.findVendorByName(invoiceData.vendorName, organizationId);
      if (matched) {
        suggestedVendor = matched;
      } else {
        warnings.push(`Could not find vendor matching "${invoiceData.vendorName}". You will need to select a vendor manually.`);
      }
    } else {
      warnings.push('No vendor name found in extracted data. You will need to select a vendor manually.');
    }

    // Build suggested data
    const billDate = invoiceData?.invoiceDate || new Date().toISOString().split('T')[0];
    const suggestedData: Partial<CreateVendorBillInput> = {
      vendorId: suggestedVendor?.id,
      vendorInvoiceNumber: invoiceData?.invoiceNumber,
      billDate,
      dueDate: invoiceData?.dueDate || this.calculateDueDate(billDate, 30),
      paymentTerms: invoiceData?.paymentTerms,
      memo: document.summary || undefined,
      lines: this.buildLinesFromExtracted(invoiceData),
    };

    // Add warnings for missing data
    if (!invoiceData?.invoiceNumber) {
      warnings.push('No invoice number found in extracted data.');
    }
    if (!invoiceData?.totalAmount) {
      warnings.push('No total amount found in extracted data.');
    }
    if (!invoiceData?.invoiceDate) {
      warnings.push('No invoice date found. Using current date.');
    }

    return {
      document,
      suggestedVendor,
      suggestedData,
      warnings,
    };
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private async findVendorByName(name: string, organizationId: string): Promise<{ id: string; name: string } | null> {
    // Try exact match first - entityTypes is an array, so we need to check if it contains 'vendor'
    const [exactMatch] = await this.db
      .select({ id: entities.id, name: entities.name })
      .from(entities)
      .where(
        and(
          eq(entities.organizationId, organizationId),
          ilike(entities.name, name)
        )
      )
      .limit(1);

    // Check if the entity is a vendor
    if (exactMatch) {
      const [vendor] = await this.db
        .select({ id: entities.id, name: entities.name, types: entities.entityTypes })
        .from(entities)
        .where(
          and(
            eq(entities.id, exactMatch.id),
            sql`'vendor' = ANY(${entities.entityTypes})`
          )
        )
        .limit(1);

      if (vendor) {
        return { id: vendor.id, name: vendor.name || 'Unknown' };
      }
    }

    // Try partial match
    const [partialMatch] = await this.db
      .select({ id: entities.id, name: entities.name, types: entities.entityTypes })
      .from(entities)
      .where(
        and(
          eq(entities.organizationId, organizationId),
          ilike(entities.name, `%${name}%`),
          sql`'vendor' = ANY(${entities.entityTypes})`
        )
      )
      .limit(1);

    if (partialMatch) {
      return { id: partialMatch.id, name: partialMatch.name || 'Unknown' };
    }

    return null;
  }

  private buildLinesFromExtracted(invoiceData: ExtractedData['invoice']): CreateVendorBillLineInput[] {
    if (!invoiceData) {
      return [];
    }

    // If we have line items, use them
    if (invoiceData.lineItems && invoiceData.lineItems.length > 0) {
      return invoiceData.lineItems.map((item, index) => ({
        lineNumber: index + 1,
        itemName: item.description || 'Service/Product',
        itemDescription: item.description,
        quantity: item.quantity?.toString() || '1',
        unitPrice: item.unitPrice?.toString() || item.amount?.toString() || '0',
      }));
    }

    // If no line items but we have a total, create a single line
    if (invoiceData.totalAmount) {
      return [{
        lineNumber: 1,
        itemName: 'Invoice Total',
        itemDescription: 'Total from invoice',
        quantity: '1',
        unitPrice: invoiceData.totalAmount.toString(),
      }];
    }

    return [];
  }

  private calculateDueDate(billDate: string, daysFromNow: number): string {
    const date = new Date(billDate);
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split('T')[0];
  }
}

// Export singleton-style function for simple usage
export const documentConversionService = {
  create: (context = {}, options: DocumentConversionServiceOptions = {}) =>
    new DocumentConversionService(context, options),
};
