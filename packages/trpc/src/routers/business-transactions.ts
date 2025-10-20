import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { 
  businessTransactions, 
  businessTransactionLines, 
  transactionTypes
} from '@glapi/database';
import { 
  eq,
  and,
  desc,
  asc,
  count,
  like,
  or,
  ilike,
  gte,
  lte
} from 'drizzle-orm';

// Input validation schemas
const createTransactionSchema = z.object({
  transactionTypeCode: z.string().min(1),
  entityId: z.string().uuid(),
  entityType: z.enum(['VENDOR', 'CUSTOMER', 'EMPLOYEE']),
  transactionDate: z.date(),
  dueDate: z.date().optional(),
  memo: z.string().optional(),
  externalReference: z.string().optional(),
  parentTransactionId: z.string().uuid().optional(),
  lines: z.array(z.object({
    itemId: z.string().uuid(),
    description: z.string().min(1),
    quantity: z.number().min(0),
    unitPrice: z.number().min(0),
    lineAmount: z.number().min(0),
    totalLineAmount: z.number().min(0),
    discountPercent: z.number().min(0).max(100).optional(),
    discountAmount: z.number().min(0).optional(),
    taxAmount: z.number().min(0).optional(),
    accountId: z.string().uuid().optional(),
    notes: z.string().optional(),
  })).min(1),
});

const updateTransactionSchema = z.object({
  id: z.string().uuid(),
  memo: z.string().optional(),
  dueDate: z.date().optional(),
  status: z.string().optional(),
  externalReference: z.string().optional(),
});

const listTransactionsSchema = z.object({
  filter: z.object({
    transactionTypeCode: z.string().optional(),
    entityType: z.enum(['VENDOR', 'CUSTOMER', 'EMPLOYEE']).optional(),
    entityId: z.string().uuid().optional(),
    status: z.string().optional(),
    dateFrom: z.date().optional(),
    dateTo: z.date().optional(),
  }).optional(),
  search: z.string().optional(),
  sort: z.object({
    field: z.enum(['transactionDate', 'totalAmount', 'status', 'transactionNumber']),
    direction: z.enum(['asc', 'desc']).default('desc'),
  }).optional(),
  pagination: z.object({
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(100).default(20),
  }).optional(),
});

// Business logic helpers
async function ensureTransactionType(db: any, typeCode: string) {
  const existingType = await db.select().from(transactionTypes).where(eq(transactionTypes.typeCode, typeCode)).limit(1);
  if (existingType.length > 0) {
    return existingType[0];
  }
  
  const transactionTypeData = {
    typeCode,
    typeName: typeCode.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
    typeCategory: typeCode.includes('PURCHASE') ? 'PURCHASE' : 'SALES',
    generatesGl: true,
    requiresApproval: false,
    canBeReversed: true,
    isActive: true,
    sortOrder: 0,
  };
  const [transactionType] = await db.insert(transactionTypes).values(transactionTypeData).returning();
  return transactionType;
}

function validateEntityTypeForTransaction(transactionTypeCode: string, entityType: string) {
  const validCombinations = {
    'PURCHASE_ORDER': ['VENDOR'],
    'SALES_ORDER': ['CUSTOMER'],
    'ESTIMATE': ['CUSTOMER'],
    'INVOICE': ['CUSTOMER'],
    'VENDOR_BILL': ['VENDOR'],
  };
  
  const validEntityTypes = validCombinations[transactionTypeCode as keyof typeof validCombinations];
  if (validEntityTypes && !validEntityTypes.includes(entityType)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Transaction type ${transactionTypeCode} must be used with entity type ${validEntityTypes.join(' or ')}`,
    });
  }
}

function calculateTransactionTotals(lines: any[]) {
  const subtotalAmount = lines.reduce((sum, line) => sum + Number(line.lineAmount), 0);
  const taxAmount = lines.reduce((sum, line) => sum + Number(line.taxAmount || 0), 0);
  const discountAmount = lines.reduce((sum, line) => sum + Number(line.discountAmount || 0), 0);
  const totalAmount = subtotalAmount + taxAmount - discountAmount;
  
  return {
    subtotalAmount: subtotalAmount.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    discountAmount: discountAmount.toFixed(2),
    totalAmount: totalAmount.toFixed(2),
    baseTotalAmount: totalAmount.toFixed(2), // Assuming USD for now
  };
}

export const businessTransactionsRouter = router({
  list: protectedProcedure
    .input(listTransactionsSchema)
    .query(async ({ input, ctx }) => {
      const { db, serviceContext } = ctx;
      
      if (!serviceContext?.organizationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Organization context required',
        });
      }

      const { filter, search, sort, pagination } = input;
      const { page = 1, limit = 20 } = pagination || {};
      const offset = (page - 1) * limit;

      // Build where conditions
      const whereConditions = [
        eq(businessTransactions.subsidiaryId, serviceContext.organizationId)
      ];

      // Apply filters
      if (filter?.transactionTypeCode) {
        // Need to join with transaction types to filter by code
        const transactionType = await ensureTransactionType(db, filter.transactionTypeCode);
        whereConditions.push(eq(businessTransactions.transactionTypeId, transactionType.id));
      }

      if (filter?.entityType) {
        whereConditions.push(eq(businessTransactions.entityType, filter.entityType));
      }

      if (filter?.entityId) {
        whereConditions.push(eq(businessTransactions.entityId, filter.entityId));
      }

      if (filter?.status) {
        whereConditions.push(eq(businessTransactions.status, filter.status));
      }

      if (filter?.dateFrom) {
        whereConditions.push(gte(businessTransactions.transactionDate, filter.dateFrom.toISOString().split('T')[0]));
      }

      if (filter?.dateTo) {
        whereConditions.push(lte(businessTransactions.transactionDate, filter.dateTo.toISOString().split('T')[0]));
      }

      // Apply search
      if (search) {
        const searchCondition = or(
          ilike(businessTransactions.transactionNumber, `%${search}%`),
          ilike(businessTransactions.memo, `%${search}%`),
          ilike(businessTransactions.externalReference, `%${search}%`)
        );
        if (searchCondition) {
          whereConditions.push(searchCondition);
        }
      }

      // Build order by
      const orderBy = [];
      if (sort?.field && sort?.direction) {
        const direction = sort.direction === 'desc' ? desc : asc;
        orderBy.push(direction(businessTransactions[sort.field]));
      } else {
        orderBy.push(desc(businessTransactions.transactionDate));
      }

      // Get total count
      const totalResult = await db
        .select({ count: count() })
        .from(businessTransactions)
        .where(and(...whereConditions));
      const total = totalResult[0]?.count || 0;

      // Get transactions
      const transactions = await db
        .select()
        .from(businessTransactions)
        .where(and(...whereConditions))
        .orderBy(...orderBy)
        .limit(limit)
        .offset(offset);

      return {
        data: transactions,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const { db, serviceContext } = ctx;
      
      if (!serviceContext?.organizationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Organization context required',
        });
      }

      const transaction = await db
        .select()
        .from(businessTransactions)
        .where(and(
          eq(businessTransactions.id, input.id),
          eq(businessTransactions.subsidiaryId, serviceContext.organizationId)
        ))
        .limit(1);

      if (!transaction.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Transaction not found',
        });
      }

      // Get transaction lines
      const lines = await db
        .select()
        .from(businessTransactionLines)
        .where(eq(businessTransactionLines.businessTransactionId, input.id))
        .orderBy(asc(businessTransactionLines.lineNumber));

      return {
        ...transaction[0],
        lines,
      };
    }),

  create: protectedProcedure
    .input(createTransactionSchema)
    .mutation(async ({ input, ctx }) => {
      const { db, serviceContext } = ctx;
      
      if (!serviceContext?.organizationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Organization context required',
        });
      }

      // Validate entity type for transaction type
      validateEntityTypeForTransaction(input.transactionTypeCode, input.entityType);

      // Ensure transaction type exists
      const transactionType = await ensureTransactionType(db, input.transactionTypeCode);

      // Calculate totals
      const totals = calculateTransactionTotals(input.lines);

      // Generate transaction number
      const transactionNumber = `${input.transactionTypeCode.substring(0, 2)}-${Math.random().toString(36).substring(7).toUpperCase()}`;

      // Create transaction
      const transactionData = {
        transactionNumber,
        transactionTypeId: transactionType.id,
        subsidiaryId: serviceContext.organizationId,
        entityId: input.entityId,
        entityType: input.entityType,
        transactionDate: input.transactionDate.toISOString().split('T')[0],
        dueDate: input.dueDate?.toISOString().split('T')[0],
        memo: input.memo,
        externalReference: input.externalReference,
        parentTransactionId: input.parentTransactionId,
        status: 'DRAFT',
        currencyCode: 'USD',
        exchangeRate: '1.0',
        ...totals,
      };

      const [transaction] = await db.insert(businessTransactions).values(transactionData).returning();

      // Create transaction lines
      const lineData = input.lines.map((line, index) => ({
        businessTransactionId: transaction.id,
        lineNumber: index + 1,
        lineType: 'ITEM',
        itemId: line.itemId,
        description: line.description,
        quantity: line.quantity.toString(),
        unitPrice: line.unitPrice.toString(),
        discountPercent: line.discountPercent?.toString() || '0',
        discountAmount: line.discountAmount?.toString() || '0',
        lineAmount: line.lineAmount.toString(),
        taxAmount: line.taxAmount?.toString() || '0',
        totalLineAmount: line.totalLineAmount.toString(),
        accountId: line.accountId,
        notes: line.notes,
      }));

      const lines = await db.insert(businessTransactionLines).values(lineData).returning();

      return {
        ...transaction,
        lines,
      };
    }),

  update: protectedProcedure
    .input(updateTransactionSchema)
    .mutation(async ({ input, ctx }) => {
      const { db, serviceContext } = ctx;
      
      if (!serviceContext?.organizationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Organization context required',
        });
      }

      // Verify transaction exists and belongs to organization
      const existing = await db
        .select()
        .from(businessTransactions)
        .where(and(
          eq(businessTransactions.id, input.id),
          eq(businessTransactions.subsidiaryId, serviceContext.organizationId)
        ))
        .limit(1);

      if (!existing.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Transaction not found',
        });
      }

      // Validate status transitions if status is being updated
      if (input.status && input.status !== existing[0].status) {
        // Add business logic for status transitions here
        const validTransitions = {
          'DRAFT': ['APPROVED', 'CANCELLED'],
          'APPROVED': ['POSTED', 'CANCELLED'],
          'POSTED': ['CLOSED'],
        };
        
        const currentStatus = existing[0].status;
        const validNextStatuses = validTransitions[currentStatus as keyof typeof validTransitions];
        
        if (validNextStatuses && !validNextStatuses.includes(input.status)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Cannot transition from ${currentStatus} to ${input.status}`,
          });
        }
      }

      // Update transaction
      const updateData = {
        memo: input.memo,
        dueDate: input.dueDate?.toISOString().split('T')[0],
        status: input.status,
        externalReference: input.externalReference,
        modifiedDate: new Date(),
      };

      // Remove undefined values
      const cleanUpdateData = Object.fromEntries(
        Object.entries(updateData).filter(([_, value]) => value !== undefined)
      );

      const [updated] = await db
        .update(businessTransactions)
        .set(cleanUpdateData)
        .where(eq(businessTransactions.id, input.id))
        .returning();

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const { db, serviceContext } = ctx;
      
      if (!serviceContext?.organizationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Organization context required',
        });
      }

      // Verify transaction exists and belongs to organization
      const existing = await db
        .select()
        .from(businessTransactions)
        .where(and(
          eq(businessTransactions.id, input.id),
          eq(businessTransactions.subsidiaryId, serviceContext.organizationId)
        ))
        .limit(1);

      if (!existing.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Transaction not found',
        });
      }

      // Soft delete by setting status to CANCELLED
      await db
        .update(businessTransactions)
        .set({ 
          status: 'CANCELLED',
          modifiedDate: new Date(),
        })
        .where(eq(businessTransactions.id, input.id));

      return { success: true };
    }),
});