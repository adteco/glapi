import { z } from 'zod';
import { authenticatedProcedure, adminProcedure, router } from '../trpc';
import { ExpenseEntryService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';

const ExpenseEntryStatusEnum = z.enum([
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'REIMBURSED',
  'POSTED',
  'CANCELLED',
]);

const ExpenseCategoryEnum = z.enum([
  'TRAVEL',
  'LODGING',
  'MEALS',
  'TRANSPORTATION',
  'SUPPLIES',
  'EQUIPMENT',
  'MATERIALS',
  'SUBCONTRACTOR',
  'COMMUNICATIONS',
  'PROFESSIONAL_SERVICES',
  'INSURANCE',
  'PERMITS_FEES',
  'OTHER',
]);

const PaymentMethodEnum = z.enum([
  'CORPORATE_CARD',
  'PERSONAL_CARD',
  'CASH',
  'CHECK',
  'DIRECT_PAYMENT',
  'REIMBURSEMENT_PENDING',
  'OTHER',
]);

const createExpenseEntrySchema = z.object({
  projectId: z.string().uuid().optional(),
  costCodeId: z.string().uuid().optional(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  category: ExpenseCategoryEnum,
  merchantName: z.string().max(200).optional(),
  description: z.string().min(1).max(1000),
  amount: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Amount must be a positive number'),
  currencyCode: z.string().length(3).default('USD'),
  taxAmount: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  isTaxDeductible: z.boolean().default(true),
  paymentMethod: PaymentMethodEnum.default('PERSONAL_CARD'),
  requiresReimbursement: z.boolean().default(true),
  isBillable: z.boolean().default(false),
  billingMarkup: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  internalNotes: z.string().max(2000).optional(),
  externalId: z.string().max(100).optional(),
  externalSource: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateExpenseEntrySchema = z.object({
  projectId: z.string().uuid().nullable().optional(),
  costCodeId: z.string().uuid().nullable().optional(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  category: ExpenseCategoryEnum.optional(),
  merchantName: z.string().max(200).nullable().optional(),
  description: z.string().min(1).max(1000).optional(),
  amount: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  currencyCode: z.string().length(3).optional(),
  taxAmount: z.string().regex(/^\d+(\.\d{1,4})?$/).nullable().optional(),
  isTaxDeductible: z.boolean().optional(),
  paymentMethod: PaymentMethodEnum.optional(),
  requiresReimbursement: z.boolean().optional(),
  isBillable: z.boolean().optional(),
  billingMarkup: z.string().regex(/^\d+(\.\d{1,4})?$/).nullable().optional(),
  internalNotes: z.string().max(2000).nullable().optional(),
  externalId: z.string().max(100).nullable().optional(),
  externalSource: z.string().max(100).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

const expenseEntryFiltersSchema = z
  .object({
    employeeId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    costCodeId: z.string().uuid().optional(),
    status: z.union([ExpenseEntryStatusEnum, z.array(ExpenseEntryStatusEnum)]).optional(),
    category: z.union([ExpenseCategoryEnum, z.array(ExpenseCategoryEnum)]).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    isBillable: z.boolean().optional(),
    requiresReimbursement: z.boolean().optional(),
    reportId: z.string().uuid().optional(),
  })
  .optional();

const createExpenseReportSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  businessPurpose: z.string().max(500).optional(),
  projectId: z.string().uuid().optional(),
  expenseEntryIds: z.array(z.string().uuid()).optional(),
});

export const expenseEntriesRouter = router({
  // ========== Expense Entry CRUD Routes ==========

  /**
   * List expense entries with optional filters
   */
  list: authenticatedProcedure
    .input(
      z
        .object({
          page: z.number().int().positive().optional(),
          limit: z.number().int().positive().max(100).optional(),
          orderBy: z.enum(['expenseDate', 'createdAt', 'status', 'amount', 'category']).optional(),
          orderDirection: z.enum(['asc', 'desc']).optional(),
          filters: expenseEntryFiltersSchema,
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new ExpenseEntryService(ctx.serviceContext, { db: ctx.db });
      return service.list(
        { page: input?.page, limit: input?.limit },
        input?.filters || {},
        input?.orderBy || 'expenseDate',
        input?.orderDirection || 'desc'
      );
    }),

  /**
   * Get a single expense entry by ID
   */
  getById: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ExpenseEntryService(ctx.serviceContext, { db: ctx.db });
      const entry = await service.getById(input.id);

      if (!entry) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Expense entry not found',
        });
      }

      return entry;
    }),

  /**
   * Get an expense entry with relations
   */
  getByIdWithRelations: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ExpenseEntryService(ctx.serviceContext, { db: ctx.db });
      const entry = await service.getByIdWithRelations(input.id);

      if (!entry) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Expense entry not found',
        });
      }

      return entry;
    }),

  /**
   * Get entries pending approval
   */
  getPendingApprovals: authenticatedProcedure
    .input(
      z
        .object({
          page: z.number().int().positive().optional(),
          limit: z.number().int().positive().max(100).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new ExpenseEntryService(ctx.serviceContext, { db: ctx.db });
      return service.getPendingApprovals({ page: input?.page, limit: input?.limit });
    }),

  /**
   * Create a new expense entry
   */
  create: authenticatedProcedure.input(createExpenseEntrySchema).mutation(async ({ ctx, input }) => {
    const service = new ExpenseEntryService(ctx.serviceContext, { db: ctx.db });
    return service.create({
      expenseDate: input.expenseDate,
      category: input.category,
      description: input.description,
      amount: input.amount,
      currencyCode: input.currencyCode,
      paymentMethod: input.paymentMethod,
      projectId: input.projectId,
      costCodeId: input.costCodeId,
      merchantName: input.merchantName,
      taxAmount: input.taxAmount,
      isTaxDeductible: input.isTaxDeductible,
      requiresReimbursement: input.requiresReimbursement,
      isBillable: input.isBillable,
      billingMarkup: input.billingMarkup,
      internalNotes: input.internalNotes,
      externalId: input.externalId,
      externalSource: input.externalSource,
      metadata: input.metadata,
    });
  }),

  /**
   * Update an existing expense entry (DRAFT only)
   */
  update: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateExpenseEntrySchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new ExpenseEntryService(ctx.serviceContext, { db: ctx.db });
      return service.update(input.id, input.data);
    }),

  /**
   * Delete an expense entry (DRAFT only)
   */
  delete: authenticatedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const service = new ExpenseEntryService(ctx.serviceContext, { db: ctx.db });
    await service.delete(input.id);
    return { success: true };
  }),

  // ========== Approval Workflow Routes ==========

  /**
   * Submit expense entries for approval
   */
  submit: authenticatedProcedure
    .input(
      z.object({
        expenseEntryIds: z.array(z.string().uuid()).min(1),
        comments: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new ExpenseEntryService(ctx.serviceContext, { db: ctx.db });
      return service.submit({
        expenseEntryIds: input.expenseEntryIds,
        comments: input.comments,
      });
    }),

  /**
   * Approve submitted expense entries
   */
  approve: authenticatedProcedure
    .input(
      z.object({
        expenseEntryIds: z.array(z.string().uuid()).min(1),
        comments: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new ExpenseEntryService(ctx.serviceContext, { db: ctx.db });
      return service.approve({
        expenseEntryIds: input.expenseEntryIds,
        comments: input.comments,
      });
    }),

  /**
   * Reject submitted expense entries
   */
  reject: authenticatedProcedure
    .input(
      z.object({
        expenseEntryIds: z.array(z.string().uuid()).min(1),
        reason: z.string().min(1, 'Rejection reason is required').max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new ExpenseEntryService(ctx.serviceContext, { db: ctx.db });
      return service.reject({
        expenseEntryIds: input.expenseEntryIds,
        reason: input.reason,
      });
    }),

  /**
   * Return rejected expense entries to draft
   */
  returnToDraft: authenticatedProcedure
    .input(z.object({ expenseEntryIds: z.array(z.string().uuid()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const service = new ExpenseEntryService(ctx.serviceContext, { db: ctx.db });
      return service.returnToDraft(input.expenseEntryIds);
    }),

  // ========== Attachment Routes ==========

  /**
   * Get attachments for an expense entry
   */
  getAttachments: authenticatedProcedure
    .input(z.object({ expenseEntryId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ExpenseEntryService(ctx.serviceContext, { db: ctx.db });
      return service.getAttachments(input.expenseEntryId);
    }),

  /**
   * Delete an attachment
   */
  deleteAttachment: authenticatedProcedure
    .input(z.object({ attachmentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ExpenseEntryService(ctx.serviceContext, { db: ctx.db });
      await service.deleteAttachment(input.attachmentId);
      return { success: true };
    }),

  // ========== Expense Report Routes ==========

  /**
   * Create an expense report
   */
  createReport: authenticatedProcedure.input(createExpenseReportSchema).mutation(async ({ ctx, input }) => {
    const service = new ExpenseEntryService(ctx.serviceContext, { db: ctx.db });
    return service.createReport({
      title: input.title,
      description: input.description,
      businessPurpose: input.businessPurpose,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      projectId: input.projectId,
      expenseEntryIds: input.expenseEntryIds,
    });
  }),

  /**
   * List my expense reports
   */
  listReports: authenticatedProcedure
    .input(
      z
        .object({
          page: z.number().int().positive().optional(),
          limit: z.number().int().positive().max(100).optional(),
          status: ExpenseEntryStatusEnum.optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new ExpenseEntryService(ctx.serviceContext, { db: ctx.db });
      return service.listReports(
        { page: input?.page, limit: input?.limit },
        { status: input?.status }
      );
    }),

  /**
   * Get a report with its entries
   */
  getReportWithEntries: authenticatedProcedure
    .input(z.object({ reportId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ExpenseEntryService(ctx.serviceContext, { db: ctx.db });
      return service.getReportWithEntries(input.reportId);
    }),

  // ========== Reporting Routes ==========

  /**
   * Get my expense summary
   */
  getMySummary: authenticatedProcedure
    .input(
      z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        status: z.array(ExpenseEntryStatusEnum).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new ExpenseEntryService(ctx.serviceContext, { db: ctx.db });
      return service.getMySummary(input.startDate, input.endDate, input.status);
    }),

  /**
   * Get project expense totals
   */
  getProjectTotals: authenticatedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        status: z.array(ExpenseEntryStatusEnum).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new ExpenseEntryService(ctx.serviceContext, { db: ctx.db });
      return service.getProjectTotals(input.projectId, input.status);
    }),

  /**
   * Get approval history for an expense entry
   */
  getApprovalHistory: authenticatedProcedure
    .input(z.object({ expenseEntryId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ExpenseEntryService(ctx.serviceContext, { db: ctx.db });
      return service.getApprovalHistory(input.expenseEntryId);
    }),
});
