/**
 * Pending Documents tRPC Router
 *
 * Provides API endpoints for managing pending documents from Magic Inbox.
 * Supports listing, viewing, approving, rejecting, and archiving documents.
 */

import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { PendingDocumentsService, DocumentConversionService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';

// ============================================================================
// Schemas
// ============================================================================

const PendingDocumentStatusEnum = z.enum([
  'PENDING_REVIEW',
  'IN_REVIEW',
  'APPROVED',
  'REJECTED',
  'CONVERTED',
  'CONVERSION_FAILED',
  'ARCHIVED',
]);

const PendingDocumentTypeEnum = z.enum([
  'INVOICE',
  'PURCHASE_ORDER',
  'RECEIPT',
  'SHIPPING',
  'SUPPORT',
  'MARKETING',
  'CONTRACT',
  'REPORT',
  'NEWSLETTER',
  'MEETING',
  'CREDIT_MEMO',
  'UNKNOWN',
]);

const PendingDocumentPriorityEnum = z.enum(['HIGH', 'MEDIUM', 'LOW']);

const ConversionTargetTypeEnum = z.enum([
  'VENDOR_BILL',
  'PURCHASE_ORDER',
  'VENDOR_CREDIT',
  'SUPPORT_TICKET',
]);

// Extracted data schema for edits
const extractedEntitiesSchema = z
  .object({
    dates: z.array(z.string()).optional(),
    amounts: z.array(z.string()).optional(),
    identifiers: z.array(z.string()).optional(),
    people: z.array(z.string()).optional(),
    companies: z.array(z.string()).optional(),
  })
  .optional();

const extractedInvoiceDataSchema = z
  .object({
    vendorName: z.string().optional(),
    vendorEmail: z.string().optional(),
    vendorAddress: z.string().optional(),
    invoiceNumber: z.string().optional(),
    invoiceDate: z.string().optional(),
    dueDate: z.string().optional(),
    poNumber: z.string().optional(),
    subtotal: z.number().optional(),
    taxAmount: z.number().optional(),
    totalAmount: z.number().optional(),
    currency: z.string().optional(),
    lineItems: z
      .array(
        z.object({
          description: z.string().optional(),
          quantity: z.number().optional(),
          unitPrice: z.number().optional(),
          amount: z.number().optional(),
        })
      )
      .optional(),
    paymentTerms: z.string().optional(),
    notes: z.string().optional(),
  })
  .optional();

const extractedDataSchema = z
  .object({
    entities: extractedEntitiesSchema,
    invoice: extractedInvoiceDataSchema,
    rawAnalysis: z.record(z.unknown()).optional(),
  })
  .optional();

// Filter schema
const pendingDocumentFiltersSchema = z
  .object({
    status: z
      .union([PendingDocumentStatusEnum, z.array(PendingDocumentStatusEnum)])
      .optional(),
    documentType: z
      .union([PendingDocumentTypeEnum, z.array(PendingDocumentTypeEnum)])
      .optional(),
    priority: z
      .union([PendingDocumentPriorityEnum, z.array(PendingDocumentPriorityEnum)])
      .optional(),
    search: z.string().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    matchedVendorId: z.string().uuid().optional(),
  })
  .optional();

// ============================================================================
// Router
// ============================================================================

export const pendingDocumentsRouter = router({
  /**
   * List pending documents with filters and pagination
   */
  list: authenticatedProcedure
    .input(
      z
        .object({
          page: z.number().int().positive().optional(),
          limit: z.number().int().positive().max(100).optional(),
          orderBy: z
            .enum(['receivedAt', 'priority', 'documentType', 'status'])
            .optional(),
          orderDirection: z.enum(['asc', 'desc']).optional(),
          filters: pendingDocumentFiltersSchema,
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new PendingDocumentsService(ctx.serviceContext, { db: ctx.db });
      return service.list(
        { page: input?.page, limit: input?.limit },
        input?.filters || {},
        input?.orderBy || 'receivedAt',
        input?.orderDirection || 'desc'
      );
    }),

  /**
   * Get a single pending document by ID
   */
  getById: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new PendingDocumentsService(ctx.serviceContext, { db: ctx.db });
      const document = await service.getById(input.id);

      if (!document) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pending document not found',
        });
      }

      return document;
    }),

  /**
   * Get a pending document with its review history and matched vendor
   */
  getByIdWithHistory: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new PendingDocumentsService(ctx.serviceContext, { db: ctx.db });
      const document = await service.getByIdWithHistory(input.id);

      if (!document) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pending document not found',
        });
      }

      return document;
    }),

  /**
   * Update extracted data before approval
   */
  updateExtractedData: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        editedData: extractedDataSchema.unwrap(), // Make required
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new PendingDocumentsService(ctx.serviceContext, { db: ctx.db });
      return service.updateExtractedData(input.id, input.editedData);
    }),

  /**
   * Approve a pending document for conversion
   */
  approve: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        notes: z.string().max(1000).optional(),
        editedData: extractedDataSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new PendingDocumentsService(ctx.serviceContext, { db: ctx.db });
      return service.approve({
        id: input.id,
        notes: input.notes,
        editedData: input.editedData,
      });
    }),

  /**
   * Reject a pending document
   */
  reject: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().min(1).max(500),
        notes: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new PendingDocumentsService(ctx.serviceContext, { db: ctx.db });
      return service.reject({
        id: input.id,
        reason: input.reason,
        notes: input.notes,
      });
    }),

  /**
   * Archive a document (spam, duplicate, etc.)
   */
  archive: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new PendingDocumentsService(ctx.serviceContext, { db: ctx.db });
      return service.archive(input.id, input.reason);
    }),

  /**
   * Mark a document as converted (called after successful conversion)
   */
  markAsConverted: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        targetType: ConversionTargetTypeEnum,
        convertedToId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new PendingDocumentsService(ctx.serviceContext, { db: ctx.db });
      return service.markAsConverted(input.id, input.targetType, input.convertedToId);
    }),

  /**
   * Mark a document conversion as failed
   */
  markConversionFailed: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        error: z.string().max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new PendingDocumentsService(ctx.serviceContext, { db: ctx.db });
      return service.markConversionFailed(input.id, input.error);
    }),

  /**
   * Get counts by status for dashboard widget
   */
  getStatusCounts: authenticatedProcedure.query(async ({ ctx }) => {
    const service = new PendingDocumentsService(ctx.serviceContext, { db: ctx.db });
    return service.getStatusCounts();
  }),

  /**
   * Preview how a document would be converted to a vendor bill
   */
  previewConversion: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new DocumentConversionService(ctx.serviceContext, { db: ctx.db });
      return service.previewConversion(input.id);
    }),

  /**
   * Convert a pending document to a vendor bill
   */
  convertToVendorBill: authenticatedProcedure
    .input(
      z.object({
        pendingDocumentId: z.string().uuid(),
        vendorId: z.string().uuid().optional(),
        subsidiaryId: z.string().uuid().optional(),
        overrides: z
          .object({
            vendorInvoiceNumber: z.string().optional(),
            billDate: z.string().optional(),
            dueDate: z.string().optional(),
            memo: z.string().optional(),
            lines: z
              .array(
                z.object({
                  lineNumber: z.number().optional(),
                  itemName: z.string(),
                  itemDescription: z.string().optional(),
                  quantity: z.union([z.string(), z.number()]),
                  unitPrice: z.union([z.string(), z.number()]),
                })
              )
              .optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new DocumentConversionService(ctx.serviceContext, { db: ctx.db });
      return service.convertToVendorBill(input);
    }),
});
