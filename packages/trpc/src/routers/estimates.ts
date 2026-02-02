import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, authenticatedProcedure } from '../trpc';
import {
  businessTransactions,
  businessTransactionLines,
  transactionTypes,
  entities,
  items,
  projects
} from '@glapi/database';
import {
  eq,
  and,
  desc,
  asc,
  count,
  or,
  ilike,
  gte,
  lte
} from 'drizzle-orm';

// ============================================================================
// Zod Schemas
// ============================================================================

const estimateStatusSchema = z.enum([
  'DRAFT',
  'SENT',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',
  'CONVERTED',
  'CANCELLED',
]);

const salesStageSchema = z.enum([
  'LEAD',
  'QUALIFIED',
  'PROPOSAL',
  'NEGOTIATION',
  'CLOSED_WON',
  'CLOSED_LOST',
]);

const estimateLineInputSchema = z.object({
  id: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
  description: z.string().min(1),
  quantity: z.union([z.number().positive(), z.string()]),
  unitOfMeasure: z.string().optional(),
  unitPrice: z.union([z.number().min(0), z.string()]),
  discountAmount: z.union([z.number().min(0), z.string()]).optional(),
  discountPercent: z.union([z.number().min(0).max(100), z.string()]).optional(),
  taxAmount: z.union([z.number().min(0), z.string()]).optional(),
  taxCode: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  memo: z.string().optional(),
  _delete: z.boolean().optional(),
});

const createEstimateSchema = z.object({
  entityId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  transactionDate: z.coerce.date(),
  estimateValidUntil: z.coerce.date(),
  externalReference: z.string().optional(),
  currencyCode: z.string().length(3).default('USD'),
  exchangeRate: z.union([z.number().positive(), z.string()]).optional(),
  discountAmount: z.union([z.number().min(0), z.string()]).optional(),
  discountPercent: z.union([z.number().min(0).max(100), z.string()]).optional(),
  memo: z.string().optional(),
  internalNotes: z.string().optional(),
  salesStage: salesStageSchema.default('PROPOSAL'),
  probability: z.union([z.number().min(0).max(100), z.string()]).default(50),
  expectedCloseDate: z.coerce.date().optional(),
  leadSource: z.string().optional(),
  competitor: z.string().optional(),
  lines: z.array(estimateLineInputSchema).min(1),
});

const updateEstimateSchema = z.object({
  entityId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional().nullable(),
  transactionDate: z.coerce.date().optional(),
  estimateValidUntil: z.coerce.date().optional(),
  externalReference: z.string().optional(),
  currencyCode: z.string().length(3).optional(),
  exchangeRate: z.union([z.number().positive(), z.string()]).optional(),
  discountAmount: z.union([z.number().min(0), z.string()]).optional(),
  discountPercent: z.union([z.number().min(0).max(100), z.string()]).optional(),
  memo: z.string().optional(),
  internalNotes: z.string().optional(),
  salesStage: salesStageSchema.optional(),
  probability: z.union([z.number().min(0).max(100), z.string()]).optional(),
  expectedCloseDate: z.coerce.date().optional().nullable(),
  leadSource: z.string().optional(),
  competitor: z.string().optional(),
  lines: z.array(estimateLineInputSchema).optional(),
});

const estimateFiltersSchema = z.object({
  status: z.union([estimateStatusSchema, z.array(estimateStatusSchema)]).optional(),
  entityId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  salesStage: z.union([salesStageSchema, z.array(salesStageSchema)]).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  validUntilFrom: z.coerce.date().optional(),
  validUntilTo: z.coerce.date().optional(),
  minAmount: z.union([z.number().min(0), z.string()]).optional(),
  maxAmount: z.union([z.number().min(0), z.string()]).optional(),
  search: z.string().optional(),
});

// ============================================================================
// Helper Functions
// ============================================================================

async function ensureEstimateTransactionType(db: any) {
  const existingType = await db
    .select()
    .from(transactionTypes)
    .where(eq(transactionTypes.typeCode, 'ESTIMATE'))
    .limit(1);

  if (existingType.length > 0) {
    return existingType[0];
  }

  const [transactionType] = await db.insert(transactionTypes).values({
    typeCode: 'ESTIMATE',
    typeName: 'Sales Estimate',
    typeCategory: 'SALES',
    generatesGl: false,
    requiresApproval: false,
    canBeReversed: true,
    numberingSequence: 'EST-{YYYY}-{####}',
    isActive: true,
    sortOrder: 10,
  }).returning();

  return transactionType;
}

function generateEstimateNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `EST-${year}-${random}`;
}

function calculateTotals(lines: any[]) {
  let subtotal = 0;
  let totalTax = 0;
  let totalDiscount = 0;

  for (const line of lines) {
    const quantity = parseFloat(String(line.quantity)) || 0;
    const unitPrice = parseFloat(String(line.unitPrice)) || 0;
    const lineAmount = quantity * unitPrice;

    const discountPercent = parseFloat(String(line.discountPercent || 0));
    const discountAmount = parseFloat(String(line.discountAmount || 0)) || (lineAmount * discountPercent / 100);
    const taxAmount = parseFloat(String(line.taxAmount || 0));

    subtotal += lineAmount;
    totalDiscount += discountAmount;
    totalTax += taxAmount;
  }

  const total = subtotal - totalDiscount + totalTax;

  return {
    subtotalAmount: subtotal.toFixed(4),
    discountAmount: totalDiscount.toFixed(4),
    taxAmount: totalTax.toFixed(4),
    totalAmount: total.toFixed(4),
    baseTotalAmount: total.toFixed(4),
  };
}

// ============================================================================
// Estimates Router
// ============================================================================

export const estimatesRouter = router({
  // ========================================================================
  // CRUD Operations
  // ========================================================================

  /**
   * List estimates with filtering and pagination
   */
  list: authenticatedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
        filters: estimateFiltersSchema.optional(),
      }).optional()
    )
    .query(async ({ ctx, input = {} }) => {
      const { db, serviceContext } = ctx;

      if (!serviceContext?.organizationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Organization context required',
        });
      }

      const { page = 1, limit = 50, filters = {} } = input;
      const offset = (page - 1) * limit;

      // Ensure ESTIMATE transaction type exists
      const estimateType = await ensureEstimateTransactionType(db);

      // Build where conditions
      const whereConditions = [
        eq(businessTransactions.subsidiaryId, serviceContext.organizationId),
        eq(businessTransactions.transactionTypeId, estimateType.id),
      ];

      // Apply filters
      if (filters.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
        whereConditions.push(
          or(...statuses.map(s => eq(businessTransactions.status, s)))!
        );
      }

      if (filters.entityId) {
        whereConditions.push(eq(businessTransactions.entityId, filters.entityId));
      }

      if (filters.projectId) {
        whereConditions.push(eq(businessTransactions.projectId, filters.projectId));
      }

      if (filters.salesStage) {
        const stages = Array.isArray(filters.salesStage) ? filters.salesStage : [filters.salesStage];
        whereConditions.push(
          or(...stages.map(s => eq(businessTransactions.salesStage, s)))!
        );
      }

      if (filters.dateFrom) {
        whereConditions.push(gte(businessTransactions.transactionDate, filters.dateFrom.toISOString().split('T')[0]));
      }

      if (filters.dateTo) {
        whereConditions.push(lte(businessTransactions.transactionDate, filters.dateTo.toISOString().split('T')[0]));
      }

      if (filters.search) {
        const searchCondition = or(
          ilike(businessTransactions.transactionNumber, `%${filters.search}%`),
          ilike(businessTransactions.memo, `%${filters.search}%`),
          ilike(businessTransactions.externalReference, `%${filters.search}%`)
        );
        if (searchCondition) {
          whereConditions.push(searchCondition);
        }
      }

      // Get total count
      const totalResult = await db
        .select({ count: count() })
        .from(businessTransactions)
        .where(and(...whereConditions));
      const total = Number(totalResult[0]?.count || 0);

      // Get estimates with entity info
      const estimatesRaw = await db
        .select({
          id: businessTransactions.id,
          transactionNumber: businessTransactions.transactionNumber,
          entityId: businessTransactions.entityId,
          projectId: businessTransactions.projectId,
          transactionDate: businessTransactions.transactionDate,
          estimateValidUntil: businessTransactions.estimateValidUntil,
          subtotalAmount: businessTransactions.subtotalAmount,
          taxAmount: businessTransactions.taxAmount,
          discountAmount: businessTransactions.discountAmount,
          totalAmount: businessTransactions.totalAmount,
          status: businessTransactions.status,
          salesStage: businessTransactions.salesStage,
          probability: businessTransactions.probability,
          expectedCloseDate: businessTransactions.expectedCloseDate,
          leadSource: businessTransactions.leadSource,
          competitor: businessTransactions.competitor,
          memo: businessTransactions.memo,
          currencyCode: businessTransactions.currencyCode,
          createdDate: businessTransactions.createdDate,
          modifiedDate: businessTransactions.modifiedDate,
          entityName: entities.name,
          projectName: projects.name,
        })
        .from(businessTransactions)
        .leftJoin(entities, eq(businessTransactions.entityId, entities.id))
        .leftJoin(projects, eq(businessTransactions.projectId, projects.id))
        .where(and(...whereConditions))
        .orderBy(desc(businessTransactions.transactionDate))
        .limit(limit)
        .offset(offset);

      return {
        data: estimatesRaw.map((e: typeof estimatesRaw[number]) => ({
          ...e,
          customerName: e.entityName || 'Unknown',
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }),

  /**
   * Get a single estimate by ID
   */
  get: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { db, serviceContext } = ctx;

      if (!serviceContext?.organizationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Organization context required',
        });
      }

      const estimateType = await ensureEstimateTransactionType(db);

      const estimateResult = await db
        .select({
          id: businessTransactions.id,
          transactionNumber: businessTransactions.transactionNumber,
          entityId: businessTransactions.entityId,
          projectId: businessTransactions.projectId,
          transactionDate: businessTransactions.transactionDate,
          estimateValidUntil: businessTransactions.estimateValidUntil,
          subtotalAmount: businessTransactions.subtotalAmount,
          taxAmount: businessTransactions.taxAmount,
          discountAmount: businessTransactions.discountAmount,
          totalAmount: businessTransactions.totalAmount,
          status: businessTransactions.status,
          salesStage: businessTransactions.salesStage,
          probability: businessTransactions.probability,
          expectedCloseDate: businessTransactions.expectedCloseDate,
          leadSource: businessTransactions.leadSource,
          competitor: businessTransactions.competitor,
          memo: businessTransactions.memo,
          currencyCode: businessTransactions.currencyCode,
          externalReference: businessTransactions.externalReference,
          createdDate: businessTransactions.createdDate,
          modifiedDate: businessTransactions.modifiedDate,
          entityName: entities.name,
          projectName: projects.name,
        })
        .from(businessTransactions)
        .leftJoin(entities, eq(businessTransactions.entityId, entities.id))
        .leftJoin(projects, eq(businessTransactions.projectId, projects.id))
        .where(and(
          eq(businessTransactions.id, input.id),
          eq(businessTransactions.subsidiaryId, serviceContext.organizationId),
          eq(businessTransactions.transactionTypeId, estimateType.id)
        ))
        .limit(1);

      if (!estimateResult.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Estimate not found',
        });
      }

      // Get lines with item info
      const lines = await db
        .select({
          id: businessTransactionLines.id,
          lineNumber: businessTransactionLines.lineNumber,
          itemId: businessTransactionLines.itemId,
          description: businessTransactionLines.description,
          quantity: businessTransactionLines.quantity,
          unitOfMeasure: businessTransactionLines.unitOfMeasure,
          unitPrice: businessTransactionLines.unitPrice,
          discountPercent: businessTransactionLines.discountPercent,
          discountAmount: businessTransactionLines.discountAmount,
          lineAmount: businessTransactionLines.lineAmount,
          taxAmount: businessTransactionLines.taxAmount,
          totalLineAmount: businessTransactionLines.totalLineAmount,
          departmentId: businessTransactionLines.departmentId,
          locationId: businessTransactionLines.locationId,
          classId: businessTransactionLines.classId,
          projectId: businessTransactionLines.projectId,
          notes: businessTransactionLines.notes,
          itemName: items.name,
        })
        .from(businessTransactionLines)
        .leftJoin(items, eq(businessTransactionLines.itemId, items.id))
        .where(eq(businessTransactionLines.businessTransactionId, input.id))
        .orderBy(asc(businessTransactionLines.lineNumber));

      return {
        ...estimateResult[0],
        customerName: estimateResult[0].entityName || 'Unknown',
        lines,
      };
    }),

  /**
   * Create a new estimate
   */
  create: authenticatedProcedure
    .input(createEstimateSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, serviceContext, user } = ctx;

      if (!serviceContext?.organizationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Organization context required',
        });
      }

      const estimateType = await ensureEstimateTransactionType(db);
      const totals = calculateTotals(input.lines);
      const transactionNumber = generateEstimateNumber();

      // Create the estimate
      const [estimate] = await db.insert(businessTransactions).values({
        transactionNumber,
        transactionTypeId: estimateType.id,
        subsidiaryId: serviceContext.organizationId,
        entityId: input.entityId,
        entityType: 'CUSTOMER',
        projectId: input.projectId,
        transactionDate: input.transactionDate.toISOString().split('T')[0],
        estimateValidUntil: input.estimateValidUntil.toISOString().split('T')[0],
        externalReference: input.externalReference,
        currencyCode: input.currencyCode || 'USD',
        exchangeRate: String(input.exchangeRate || '1'),
        memo: input.memo,
        salesStage: input.salesStage,
        probability: String(input.probability),
        expectedCloseDate: input.expectedCloseDate?.toISOString().split('T')[0],
        leadSource: input.leadSource,
        competitor: input.competitor,
        status: 'DRAFT',
        ...totals,
        createdBy: user?.entityId ?? null,
        modifiedBy: user?.entityId ?? null,
      }).returning();

      // Create lines
      const lineData = input.lines.map((line, index) => {
        const quantity = parseFloat(String(line.quantity)) || 0;
        const unitPrice = parseFloat(String(line.unitPrice)) || 0;
        const lineAmount = quantity * unitPrice;
        const discountPercent = parseFloat(String(line.discountPercent || 0));
        const discountAmount = parseFloat(String(line.discountAmount || 0)) || (lineAmount * discountPercent / 100);
        const taxAmount = parseFloat(String(line.taxAmount || 0));
        const totalLineAmount = lineAmount - discountAmount + taxAmount;

        return {
          businessTransactionId: estimate.id,
          lineNumber: index + 1,
          lineType: 'ITEM',
          itemId: line.itemId,
          description: line.description,
          quantity: String(quantity),
          unitOfMeasure: line.unitOfMeasure,
          unitPrice: String(unitPrice),
          discountPercent: String(discountPercent),
          discountAmount: String(discountAmount),
          lineAmount: String(lineAmount),
          taxAmount: String(taxAmount),
          totalLineAmount: String(totalLineAmount),
          departmentId: line.departmentId,
          locationId: line.locationId,
          classId: line.classId,
          projectId: line.projectId,
          notes: line.memo,
        };
      });

      const lines = await db.insert(businessTransactionLines).values(lineData).returning();

      // Auto-promote entity to Prospect if currently a Lead
      if (input.entityId) {
        const entity = await db
          .select()
          .from(entities)
          .where(eq(entities.id, input.entityId))
          .limit(1);

        if (entity[0] && entity[0].entityTypes.includes('Lead') && !entity[0].entityTypes.includes('Prospect')) {
          const newTypes = entity[0].entityTypes.filter((t: string) => t !== 'Lead');
          newTypes.push('Prospect');
          await db.update(entities)
            .set({
              entityTypes: newTypes,
              updatedAt: new Date(),
            })
            .where(eq(entities.id, input.entityId));
        }
      }

      return {
        ...estimate,
        lines,
      };
    }),

  /**
   * Update an estimate (only in DRAFT status)
   */
  update: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateEstimateSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db, serviceContext, user } = ctx;

      if (!serviceContext?.organizationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Organization context required',
        });
      }

      const estimateType = await ensureEstimateTransactionType(db);

      // Get existing estimate
      const existing = await db
        .select()
        .from(businessTransactions)
        .where(and(
          eq(businessTransactions.id, input.id),
          eq(businessTransactions.subsidiaryId, serviceContext.organizationId),
          eq(businessTransactions.transactionTypeId, estimateType.id)
        ))
        .limit(1);

      if (!existing.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Estimate not found',
        });
      }

      if (!['DRAFT', 'SENT'].includes(existing[0].status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot update estimate in ${existing[0].status} status`,
        });
      }

      // Build update data
      const updateData: Record<string, any> = {
        modifiedDate: new Date(),
        modifiedBy: user?.entityId ?? null,
      };

      if (input.data.entityId !== undefined) updateData.entityId = input.data.entityId;
      if (input.data.projectId !== undefined) updateData.projectId = input.data.projectId;
      if (input.data.transactionDate) updateData.transactionDate = input.data.transactionDate.toISOString().split('T')[0];
      if (input.data.estimateValidUntil) updateData.estimateValidUntil = input.data.estimateValidUntil.toISOString().split('T')[0];
      if (input.data.externalReference !== undefined) updateData.externalReference = input.data.externalReference;
      if (input.data.currencyCode) updateData.currencyCode = input.data.currencyCode;
      if (input.data.exchangeRate !== undefined) updateData.exchangeRate = String(input.data.exchangeRate);
      if (input.data.memo !== undefined) updateData.memo = input.data.memo;
      if (input.data.salesStage) updateData.salesStage = input.data.salesStage;
      if (input.data.probability !== undefined) updateData.probability = String(input.data.probability);
      if (input.data.expectedCloseDate !== undefined) {
        updateData.expectedCloseDate = input.data.expectedCloseDate?.toISOString().split('T')[0] || null;
      }
      if (input.data.leadSource !== undefined) updateData.leadSource = input.data.leadSource;
      if (input.data.competitor !== undefined) updateData.competitor = input.data.competitor;

      // Handle lines update if provided
      if (input.data.lines) {
        // Delete existing lines
        await db.delete(businessTransactionLines)
          .where(eq(businessTransactionLines.businessTransactionId, input.id));

        // Recalculate totals
        const totals = calculateTotals(input.data.lines);
        Object.assign(updateData, totals);

        // Insert new lines
        const lineData = input.data.lines.map((line, index) => {
          const quantity = parseFloat(String(line.quantity)) || 0;
          const unitPrice = parseFloat(String(line.unitPrice)) || 0;
          const lineAmount = quantity * unitPrice;
          const discountPercent = parseFloat(String(line.discountPercent || 0));
          const discountAmount = parseFloat(String(line.discountAmount || 0)) || (lineAmount * discountPercent / 100);
          const taxAmount = parseFloat(String(line.taxAmount || 0));
          const totalLineAmount = lineAmount - discountAmount + taxAmount;

          return {
            businessTransactionId: input.id,
            lineNumber: index + 1,
            lineType: 'ITEM',
            itemId: line.itemId,
            description: line.description,
            quantity: String(quantity),
            unitOfMeasure: line.unitOfMeasure,
            unitPrice: String(unitPrice),
            discountPercent: String(discountPercent),
            discountAmount: String(discountAmount),
            lineAmount: String(lineAmount),
            taxAmount: String(taxAmount),
            totalLineAmount: String(totalLineAmount),
            departmentId: line.departmentId,
            locationId: line.locationId,
            classId: line.classId,
            projectId: line.projectId,
            notes: line.memo,
          };
        });

        await db.insert(businessTransactionLines).values(lineData);
      }

      const [updated] = await db
        .update(businessTransactions)
        .set(updateData)
        .where(eq(businessTransactions.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Delete an estimate (soft delete - set to CANCELLED)
   */
  delete: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { db, serviceContext, user } = ctx;

      if (!serviceContext?.organizationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Organization context required',
        });
      }

      const estimateType = await ensureEstimateTransactionType(db);

      const existing = await db
        .select()
        .from(businessTransactions)
        .where(and(
          eq(businessTransactions.id, input.id),
          eq(businessTransactions.subsidiaryId, serviceContext.organizationId),
          eq(businessTransactions.transactionTypeId, estimateType.id)
        ))
        .limit(1);

      if (!existing.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Estimate not found',
        });
      }

      await db
        .update(businessTransactions)
        .set({
          status: 'CANCELLED',
          modifiedDate: new Date(),
          modifiedBy: user?.entityId ?? null,
        })
        .where(eq(businessTransactions.id, input.id));

      return { success: true };
    }),

  // ========================================================================
  // Status Operations
  // ========================================================================

  /**
   * Send estimate to customer
   */
  send: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { db, serviceContext, user } = ctx;

      if (!serviceContext?.organizationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Organization context required',
        });
      }

      const estimateType = await ensureEstimateTransactionType(db);

      const existing = await db
        .select()
        .from(businessTransactions)
        .where(and(
          eq(businessTransactions.id, input.id),
          eq(businessTransactions.subsidiaryId, serviceContext.organizationId),
          eq(businessTransactions.transactionTypeId, estimateType.id)
        ))
        .limit(1);

      if (!existing.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Estimate not found',
        });
      }

      if (existing[0].status !== 'DRAFT') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only draft estimates can be sent',
        });
      }

      const [updated] = await db
        .update(businessTransactions)
        .set({
          status: 'SENT',
          modifiedDate: new Date(),
          modifiedBy: user?.entityId ?? null,
        })
        .where(eq(businessTransactions.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Mark estimate as accepted
   */
  accept: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { db, serviceContext, user } = ctx;

      if (!serviceContext?.organizationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Organization context required',
        });
      }

      const estimateType = await ensureEstimateTransactionType(db);

      const existing = await db
        .select()
        .from(businessTransactions)
        .where(and(
          eq(businessTransactions.id, input.id),
          eq(businessTransactions.subsidiaryId, serviceContext.organizationId),
          eq(businessTransactions.transactionTypeId, estimateType.id)
        ))
        .limit(1);

      if (!existing.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Estimate not found',
        });
      }

      if (!['DRAFT', 'SENT'].includes(existing[0].status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only draft or sent estimates can be accepted',
        });
      }

      const [updated] = await db
        .update(businessTransactions)
        .set({
          status: 'ACCEPTED',
          salesStage: 'CLOSED_WON',
          probability: '100',
          modifiedDate: new Date(),
          modifiedBy: user?.entityId ?? null,
        })
        .where(eq(businessTransactions.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Mark estimate as declined
   */
  decline: authenticatedProcedure
    .input(z.object({
      id: z.string().uuid(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db, serviceContext, user } = ctx;

      if (!serviceContext?.organizationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Organization context required',
        });
      }

      const estimateType = await ensureEstimateTransactionType(db);

      const existing = await db
        .select()
        .from(businessTransactions)
        .where(and(
          eq(businessTransactions.id, input.id),
          eq(businessTransactions.subsidiaryId, serviceContext.organizationId),
          eq(businessTransactions.transactionTypeId, estimateType.id)
        ))
        .limit(1);

      if (!existing.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Estimate not found',
        });
      }

      if (!['DRAFT', 'SENT'].includes(existing[0].status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only draft or sent estimates can be declined',
        });
      }

      const [updated] = await db
        .update(businessTransactions)
        .set({
          status: 'DECLINED',
          salesStage: 'CLOSED_LOST',
          probability: '0',
          memo: input.reason ? `${existing[0].memo || ''}\nDecline reason: ${input.reason}`.trim() : existing[0].memo,
          modifiedDate: new Date(),
          modifiedBy: user?.entityId ?? null,
        })
        .where(eq(businessTransactions.id, input.id))
        .returning();

      return updated;
    }),

  // ========================================================================
  // Conversion Operations
  // ========================================================================

  /**
   * Convert estimate to sales order
   */
  convertToSalesOrder: authenticatedProcedure
    .input(z.object({
      id: z.string().uuid(),
      orderDate: z.coerce.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db, serviceContext, user } = ctx;

      if (!serviceContext?.organizationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Organization context required',
        });
      }

      const estimateType = await ensureEstimateTransactionType(db);

      // Get the estimate
      const estimate = await db
        .select()
        .from(businessTransactions)
        .where(and(
          eq(businessTransactions.id, input.id),
          eq(businessTransactions.subsidiaryId, serviceContext.organizationId),
          eq(businessTransactions.transactionTypeId, estimateType.id)
        ))
        .limit(1);

      if (!estimate.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Estimate not found',
        });
      }

      if (!['DRAFT', 'SENT', 'ACCEPTED'].includes(estimate[0].status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only draft, sent, or accepted estimates can be converted to sales orders',
        });
      }

      // Get estimate lines
      const estimateLines = await db
        .select()
        .from(businessTransactionLines)
        .where(eq(businessTransactionLines.businessTransactionId, input.id))
        .orderBy(asc(businessTransactionLines.lineNumber));

      // Get or create SALES_ORDER transaction type
      let salesOrderType = await db
        .select()
        .from(transactionTypes)
        .where(eq(transactionTypes.typeCode, 'SALES_ORDER'))
        .limit(1);

      if (!salesOrderType.length) {
        [salesOrderType[0]] = await db.insert(transactionTypes).values({
          typeCode: 'SALES_ORDER',
          typeName: 'Sales Order',
          typeCategory: 'SALES',
          generatesGl: false,
          requiresApproval: false,
          canBeReversed: true,
          numberingSequence: 'SO-{YYYY}-{####}',
          isActive: true,
          sortOrder: 20,
        }).returning();
      }

      // Generate sales order number
      const year = new Date().getFullYear();
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      const salesOrderNumber = `SO-${year}-${random}`;

      // Create sales order
      const [salesOrder] = await db.insert(businessTransactions).values({
        transactionNumber: salesOrderNumber,
        transactionTypeId: salesOrderType[0].id,
        subsidiaryId: serviceContext.organizationId,
        entityId: estimate[0].entityId,
        entityType: 'CUSTOMER',
        projectId: estimate[0].projectId,
        transactionDate: (input.orderDate || new Date()).toISOString().split('T')[0],
        externalReference: estimate[0].externalReference,
        currencyCode: estimate[0].currencyCode,
        exchangeRate: estimate[0].exchangeRate,
        memo: estimate[0].memo,
        subtotalAmount: estimate[0].subtotalAmount,
        taxAmount: estimate[0].taxAmount,
        discountAmount: estimate[0].discountAmount,
        totalAmount: estimate[0].totalAmount,
        baseTotalAmount: estimate[0].baseTotalAmount,
        status: 'DRAFT',
        parentTransactionId: estimate[0].id,
        createdBy: user?.entityId ?? null,
        modifiedBy: user?.entityId ?? null,
      }).returning();

      // Copy lines
      const salesOrderLines = estimateLines.map((line: typeof estimateLines[number], index: number) => ({
        businessTransactionId: salesOrder.id,
        lineNumber: index + 1,
        lineType: line.lineType,
        itemId: line.itemId,
        description: line.description,
        quantity: line.quantity,
        unitOfMeasure: line.unitOfMeasure,
        unitPrice: line.unitPrice,
        discountPercent: line.discountPercent,
        discountAmount: line.discountAmount,
        lineAmount: line.lineAmount,
        taxAmount: line.taxAmount,
        totalLineAmount: line.totalLineAmount,
        departmentId: line.departmentId,
        locationId: line.locationId,
        classId: line.classId,
        projectId: line.projectId,
        notes: line.notes,
        parentLineId: line.id,
      }));

      await db.insert(businessTransactionLines).values(salesOrderLines);

      // Update estimate status
      await db
        .update(businessTransactions)
        .set({
          status: 'CONVERTED',
          salesStage: 'CLOSED_WON',
          probability: '100',
          modifiedDate: new Date(),
          modifiedBy: user?.entityId ?? null,
        })
        .where(eq(businessTransactions.id, input.id));

      // Auto-promote entity to Customer
      if (estimate[0].entityId) {
        const entity = await db
          .select()
          .from(entities)
          .where(eq(entities.id, estimate[0].entityId))
          .limit(1);

        if (entity[0] && !entity[0].entityTypes.includes('Customer')) {
          // Remove Lead/Prospect if present, add Customer
          const newTypes = entity[0].entityTypes.filter((t: string) => t !== 'Lead' && t !== 'Prospect');
          newTypes.push('Customer');
          await db.update(entities)
            .set({
              entityTypes: newTypes,
              updatedAt: new Date(),
            })
            .where(eq(entities.id, estimate[0].entityId));
        }
      }

      return salesOrder;
    }),

  /**
   * Create invoice from sales order
   */
  createInvoiceFromSalesOrder: authenticatedProcedure
    .input(z.object({
      salesOrderId: z.string().uuid(),
      invoiceDate: z.coerce.date().optional(),
      lineIds: z.array(z.string().uuid()).optional(), // Optional: specific lines to invoice
    }))
    .mutation(async ({ ctx, input }) => {
      const { db, serviceContext, user } = ctx;

      if (!serviceContext?.organizationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Organization context required',
        });
      }

      // Get or ensure SALES_ORDER transaction type exists
      let salesOrderType = await db
        .select()
        .from(transactionTypes)
        .where(eq(transactionTypes.typeCode, 'SALES_ORDER'))
        .limit(1);

      if (!salesOrderType.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Sales Order transaction type not found',
        });
      }

      // Get the sales order
      const salesOrder = await db
        .select()
        .from(businessTransactions)
        .where(and(
          eq(businessTransactions.id, input.salesOrderId),
          eq(businessTransactions.subsidiaryId, serviceContext.organizationId),
          eq(businessTransactions.transactionTypeId, salesOrderType[0].id)
        ))
        .limit(1);

      if (!salesOrder.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Sales order not found',
        });
      }

      if (salesOrder[0].status === 'CANCELLED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot create invoice from cancelled sales order',
        });
      }

      // Get sales order lines
      const salesOrderLines = await db
        .select()
        .from(businessTransactionLines)
        .where(eq(businessTransactionLines.businessTransactionId, input.salesOrderId))
        .orderBy(asc(businessTransactionLines.lineNumber));

      // Filter lines if specific lineIds provided
      const linesToInvoice = input.lineIds
        ? salesOrderLines.filter((line: typeof salesOrderLines[number]) => input.lineIds!.includes(line.id))
        : salesOrderLines;

      if (linesToInvoice.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No lines to invoice',
        });
      }

      // Get or create INVOICE transaction type
      let invoiceType = await db
        .select()
        .from(transactionTypes)
        .where(eq(transactionTypes.typeCode, 'INVOICE'))
        .limit(1);

      if (!invoiceType.length) {
        [invoiceType[0]] = await db.insert(transactionTypes).values({
          typeCode: 'INVOICE',
          typeName: 'Sales Invoice',
          typeCategory: 'SALES',
          generatesGl: true,
          requiresApproval: false,
          canBeReversed: true,
          numberingSequence: 'INV-{YYYY}-{####}',
          isActive: true,
          sortOrder: 30,
        }).returning();
      }

      // Generate invoice number
      const year = new Date().getFullYear();
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      const invoiceNumber = `INV-${year}-${random}`;

      // Calculate totals for lines being invoiced
      const totals = calculateTotals(linesToInvoice.map((line: typeof linesToInvoice[number]) => ({
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountPercent: line.discountPercent,
        discountAmount: line.discountAmount,
        taxAmount: line.taxAmount,
      })));

      // Create invoice
      const [invoice] = await db.insert(businessTransactions).values({
        transactionNumber: invoiceNumber,
        transactionTypeId: invoiceType[0].id,
        subsidiaryId: serviceContext.organizationId,
        entityId: salesOrder[0].entityId,
        entityType: 'CUSTOMER',
        projectId: salesOrder[0].projectId, // Preserve project reference
        transactionDate: (input.invoiceDate || new Date()).toISOString().split('T')[0],
        externalReference: salesOrder[0].externalReference,
        currencyCode: salesOrder[0].currencyCode,
        exchangeRate: salesOrder[0].exchangeRate,
        memo: salesOrder[0].memo,
        ...totals,
        status: 'DRAFT',
        parentTransactionId: salesOrder[0].id, // Link back to sales order
        createdBy: user?.entityId ?? null,
        modifiedBy: user?.entityId ?? null,
      }).returning();

      // Copy lines
      const invoiceLines = linesToInvoice.map((line: typeof linesToInvoice[number], index: number) => ({
        businessTransactionId: invoice.id,
        lineNumber: index + 1,
        lineType: line.lineType,
        itemId: line.itemId,
        description: line.description,
        quantity: line.quantity,
        unitOfMeasure: line.unitOfMeasure,
        unitPrice: line.unitPrice,
        discountPercent: line.discountPercent,
        discountAmount: line.discountAmount,
        lineAmount: line.lineAmount,
        taxAmount: line.taxAmount,
        totalLineAmount: line.totalLineAmount,
        departmentId: line.departmentId,
        locationId: line.locationId,
        classId: line.classId,
        projectId: line.projectId, // Preserve line-level project reference
        notes: line.notes,
        parentLineId: line.id,
      }));

      await db.insert(businessTransactionLines).values(invoiceLines);

      // Check if all lines have been invoiced to update sales order status
      const allLineIds = salesOrderLines.map((l: typeof salesOrderLines[number]) => l.id);
      const invoicedLineIds = linesToInvoice.map((l: typeof linesToInvoice[number]) => l.id);
      const fullyInvoiced = allLineIds.every((id: string) => invoicedLineIds.includes(id));

      if (fullyInvoiced) {
        await db
          .update(businessTransactions)
          .set({
            status: 'CLOSED',
            modifiedDate: new Date(),
            modifiedBy: user?.entityId ?? null,
          })
          .where(eq(businessTransactions.id, input.salesOrderId));
      }

      return invoice;
    }),

  /**
   * Get child transactions (e.g., sales orders converted from this estimate, invoices from sales order)
   */
  getChildTransactions: authenticatedProcedure
    .input(z.object({
      parentId: z.string().uuid(),
      typeCode: z.string().optional(), // Optional filter by type code
    }))
    .query(async ({ ctx, input }) => {
      const { db, serviceContext } = ctx;

      if (!serviceContext?.organizationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Organization context required',
        });
      }

      const whereConditions = [
        eq(businessTransactions.parentTransactionId, input.parentId),
        eq(businessTransactions.subsidiaryId, serviceContext.organizationId),
      ];

      // If type code filter is provided, add it
      if (input.typeCode) {
        const transType = await db
          .select({ id: transactionTypes.id })
          .from(transactionTypes)
          .where(eq(transactionTypes.typeCode, input.typeCode))
          .limit(1);

        if (transType[0]) {
          whereConditions.push(eq(businessTransactions.transactionTypeId, transType[0].id));
        }
      }

      const children = await db
        .select({
          id: businessTransactions.id,
          transactionNumber: businessTransactions.transactionNumber,
          transactionDate: businessTransactions.transactionDate,
          totalAmount: businessTransactions.totalAmount,
          status: businessTransactions.status,
          typeCode: transactionTypes.typeCode,
          typeName: transactionTypes.typeName,
          entityName: entities.name,
        })
        .from(businessTransactions)
        .leftJoin(transactionTypes, eq(businessTransactions.transactionTypeId, transactionTypes.id))
        .leftJoin(entities, eq(businessTransactions.entityId, entities.id))
        .where(and(...whereConditions))
        .orderBy(desc(businessTransactions.transactionDate));

      return children;
    }),

  /**
   * Get parent transaction (e.g., estimate that was converted to this sales order)
   */
  getParentTransaction: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { db, serviceContext } = ctx;

      if (!serviceContext?.organizationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Organization context required',
        });
      }

      // First get the transaction to find its parent
      const transaction = await db
        .select({ parentTransactionId: businessTransactions.parentTransactionId })
        .from(businessTransactions)
        .where(
          and(
            eq(businessTransactions.id, input.id),
            eq(businessTransactions.subsidiaryId, serviceContext.organizationId)
          )
        )
        .limit(1);

      if (!transaction[0]?.parentTransactionId) {
        return null;
      }

      const parent = await db
        .select({
          id: businessTransactions.id,
          transactionNumber: businessTransactions.transactionNumber,
          transactionDate: businessTransactions.transactionDate,
          totalAmount: businessTransactions.totalAmount,
          status: businessTransactions.status,
          typeCode: transactionTypes.typeCode,
          typeName: transactionTypes.typeName,
          entityName: entities.name,
        })
        .from(businessTransactions)
        .leftJoin(transactionTypes, eq(businessTransactions.transactionTypeId, transactionTypes.id))
        .leftJoin(entities, eq(businessTransactions.entityId, entities.id))
        .where(eq(businessTransactions.id, transaction[0].parentTransactionId))
        .limit(1);

      return parent[0] || null;
    }),

  /**
   * List transactions by project (estimates and sales orders)
   */
  listByProject: authenticatedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      typeCodes: z.array(z.string()).optional(), // Optional filter by type codes
    }))
    .query(async ({ ctx, input }) => {
      const { db, serviceContext } = ctx;

      if (!serviceContext?.organizationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Organization context required',
        });
      }

      const whereConditions = [
        eq(businessTransactions.projectId, input.projectId),
        eq(businessTransactions.subsidiaryId, serviceContext.organizationId),
      ];

      // If type codes filter is provided, add it
      if (input.typeCodes && input.typeCodes.length > 0) {
        const transTypes = await db
          .select({ id: transactionTypes.id })
          .from(transactionTypes)
          .where(or(...input.typeCodes.map(tc => eq(transactionTypes.typeCode, tc))));

        if (transTypes.length > 0) {
          whereConditions.push(
            or(...transTypes.map((t: { id: string }) => eq(businessTransactions.transactionTypeId, t.id)))!
          );
        }
      }

      const transactions = await db
        .select({
          id: businessTransactions.id,
          transactionNumber: businessTransactions.transactionNumber,
          transactionDate: businessTransactions.transactionDate,
          totalAmount: businessTransactions.totalAmount,
          status: businessTransactions.status,
          typeCode: transactionTypes.typeCode,
          typeName: transactionTypes.typeName,
          entityName: entities.name,
          projectName: projects.name,
        })
        .from(businessTransactions)
        .leftJoin(transactionTypes, eq(businessTransactions.transactionTypeId, transactionTypes.id))
        .leftJoin(entities, eq(businessTransactions.entityId, entities.id))
        .leftJoin(projects, eq(businessTransactions.projectId, projects.id))
        .where(and(...whereConditions))
        .orderBy(desc(businessTransactions.transactionDate));

      return transactions;
    }),
});
