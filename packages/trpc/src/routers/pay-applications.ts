import { z } from 'zod';
import { authenticatedProcedure, adminProcedure, router } from '../trpc';
import { PayApplicationService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';
import { createReadOnlyAIMeta, createWriteAIMeta, createDeleteAIMeta } from '../ai-meta';

const PayAppStatusEnum = z.enum([
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'CERTIFIED',
  'BILLED',
  'PAID',
  'REJECTED',
  'VOIDED',
]);

const PayAppTypeEnum = z.enum(['PROGRESS', 'FINAL', 'RETAINAGE_RELEASE']);

const RetainageReleaseTypeEnum = z.enum(['PARTIAL', 'FINAL', 'PUNCHLIST']);

const createPayAppSchema = z.object({
  projectId: z.string().uuid(),
  scheduleOfValuesId: z.string().uuid(),
  applicationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  periodFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payAppType: PayAppTypeEnum.default('PROGRESS'),
  contractorId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  architectId: z.string().uuid().optional(),
  retainagePercent: z.number().min(0).max(100).optional(),
  retainageReleaseAmount: z.number().nonnegative().optional(),
  retainageReleasePercent: z.number().min(0).max(100).optional(),
  externalReference: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

const updatePayAppLinesSchema = z.object({
  payApplicationId: z.string().uuid(),
  lines: z.array(
    z.object({
      id: z.string().uuid(),
      thisWorkCompleted: z.number().nonnegative().optional(),
      thisMaterialsStored: z.number().nonnegative().optional(),
      retainagePercent: z.number().min(0).max(100).optional(),
      notes: z.string().max(500).optional(),
    })
  ),
});

const payAppFiltersSchema = z
  .object({
    projectId: z.string().uuid().optional(),
    scheduleOfValuesId: z.string().uuid().optional(),
    status: z.union([PayAppStatusEnum, z.array(PayAppStatusEnum)]).optional(),
    payAppType: z.union([PayAppTypeEnum, z.array(PayAppTypeEnum)]).optional(),
    periodFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    periodTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    search: z.string().max(100).optional(),
  })
  .optional();

const createRetainageReleaseSchema = z.object({
  projectId: z.string().uuid(),
  payApplicationId: z.string().uuid().optional(),
  releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  releaseType: RetainageReleaseTypeEnum.default('PARTIAL'),
  releaseAmount: z.number().nonnegative(),
  releasePercent: z.number().min(0).max(100).optional(),
  requiresPunchlistComplete: z.boolean().optional(),
  requiresLienWaivers: z.boolean().optional(),
  requiresWarrantyDocuments: z.boolean().optional(),
  externalReference: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  lines: z
    .array(
      z.object({
        sovLineId: z.string().uuid(),
        lineNumber: z.number().int().positive(),
        releaseAmount: z.number().nonnegative(),
        notes: z.string().max(500).optional(),
      })
    )
    .optional(),
});

export const payApplicationsRouter = router({
  // ========== Pay Application CRUD Routes ==========

  /**
   * List pay applications with optional filters
   */
  list: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('list_pay_applications', 'List pay applications with optional filters', {
      scopes: ['pay-applications', 'construction', 'billing'],
      permissions: ['read:pay-applications'],
    }) })
    .input(
      z
        .object({
          page: z.number().int().positive().optional(),
          limit: z.number().int().positive().max(100).optional(),
          filters: payAppFiltersSchema,
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new PayApplicationService(ctx.serviceContext);
      const filters = input?.filters || {};
      // Convert status to array if it's a single value
      const statusArray = filters.status
        ? Array.isArray(filters.status) ? filters.status : [filters.status]
        : undefined;
      const payAppTypeArray = filters.payAppType
        ? Array.isArray(filters.payAppType) ? filters.payAppType : [filters.payAppType]
        : undefined;

      return service.list(
        { page: input?.page, limit: input?.limit },
        {
          organizationId: ctx.serviceContext.organizationId!,
          projectId: filters.projectId,
          scheduleOfValuesId: filters.scheduleOfValuesId,
          status: statusArray,
          payAppType: payAppTypeArray,
          periodFrom: filters.periodFrom,
          periodTo: filters.periodTo,
          search: filters.search,
        }
      );
    }),

  /**
   * Get a single pay application by ID
   */
  getById: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('get_pay_application', 'Get a single pay application by ID', {
      scopes: ['pay-applications', 'construction', 'billing'],
      permissions: ['read:pay-applications'],
    }) })
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new PayApplicationService(ctx.serviceContext);
      const payApp = await service.getById(input.id);

      if (!payApp) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pay application not found',
        });
      }

      return payApp;
    }),

  /**
   * Get pay application lines with progress
   */
  getLines: authenticatedProcedure
    .input(z.object({ payApplicationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new PayApplicationService(ctx.serviceContext);
      return service.getLines(input.payApplicationId);
    }),

  /**
   * Create a new pay application
   */
  create: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('create_pay_application', 'Create a new pay application', {
      scopes: ['pay-applications', 'construction', 'billing'],
      permissions: ['write:pay-applications'],
      riskLevel: 'MEDIUM',
    }) })
    .input(createPayAppSchema).mutation(async ({ ctx, input }) => {
    const service = new PayApplicationService(ctx.serviceContext);
    return service.create({
      organizationId: ctx.serviceContext.organizationId!,
      projectId: input.projectId,
      scheduleOfValuesId: input.scheduleOfValuesId,
      applicationDate: input.applicationDate,
      periodFrom: input.periodFrom,
      periodTo: input.periodTo,
      payAppType: input.payAppType,
      contractorId: input.contractorId,
      ownerId: input.ownerId,
      architectId: input.architectId,
      retainagePercent: input.retainagePercent,
      retainageReleaseAmount: input.retainageReleaseAmount,
      retainageReleasePercent: input.retainageReleasePercent,
      externalReference: input.externalReference,
      notes: input.notes,
    });
  }),

  /**
   * Update pay application lines (billing progress)
   */
  updateLines: authenticatedProcedure.input(updatePayAppLinesSchema).mutation(async ({ ctx, input }) => {
    const service = new PayApplicationService(ctx.serviceContext);
    return service.updateLines({
      payApplicationId: input.payApplicationId,
      lines: input.lines.map(line => ({
        id: line.id,
        thisWorkCompleted: line.thisWorkCompleted,
        thisMaterialsStored: line.thisMaterialsStored,
        retainagePercent: line.retainagePercent,
        notes: line.notes,
      })),
    });
  }),

  /**
   * Delete a pay application (DRAFT only)
   */
  delete: authenticatedProcedure
    .meta({ ai: createDeleteAIMeta('delete_pay_application', 'Delete a pay application (DRAFT only)', {
      scopes: ['pay-applications', 'construction', 'billing'],
      permissions: ['delete:pay-applications'],
      riskLevel: 'MEDIUM',
    }) })
    .input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const service = new PayApplicationService(ctx.serviceContext);
    await service.delete(input.id);
    return { success: true };
  }),

  // ========== Workflow Routes ==========

  /**
   * Submit pay application for review
   */
  submit: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('submit_pay_application', 'Submit pay application for review', {
      scopes: ['pay-applications', 'construction', 'billing'],
      permissions: ['write:pay-applications'],
      riskLevel: 'MEDIUM',
    }) })
    .input(
      z.object({
        payApplicationId: z.string().uuid(),
        notes: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new PayApplicationService(ctx.serviceContext);
      return service.submit({
        payApplicationId: input.payApplicationId,
        submittedBy: ctx.serviceContext.userId || '',
        notes: input.notes,
      });
    }),

  /**
   * Approve pay application
   */
  approve: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('approve_pay_application', 'Approve pay application', {
      scopes: ['pay-applications', 'construction', 'billing'],
      permissions: ['approve:pay-applications'],
      riskLevel: 'HIGH',
    }) })
    .input(
      z.object({
        payApplicationId: z.string().uuid(),
        approvedAmount: z.number().nonnegative().optional(),
        notes: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new PayApplicationService(ctx.serviceContext);
      return service.approve({
        payApplicationId: input.payApplicationId,
        approvedBy: ctx.serviceContext.userId || '',
        approvedAmount: input.approvedAmount,
        notes: input.notes,
      });
    }),

  /**
   * Reject pay application
   */
  reject: authenticatedProcedure
    .input(
      z.object({
        payApplicationId: z.string().uuid(),
        reason: z.string().min(1, 'Rejection reason is required').max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new PayApplicationService(ctx.serviceContext);
      return service.reject({
        payApplicationId: input.payApplicationId,
        rejectedBy: ctx.serviceContext.userId || '',
        reason: input.reason,
      });
    }),

  /**
   * Certify pay application (architect certification)
   */
  certify: authenticatedProcedure
    .input(
      z.object({
        payApplicationId: z.string().uuid(),
        certificationNumber: z.string().max(50).optional(),
        notes: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new PayApplicationService(ctx.serviceContext);
      return service.certify({
        payApplicationId: input.payApplicationId,
        certifiedBy: ctx.serviceContext.userId || '',
        certificationNumber: input.certificationNumber,
        notes: input.notes,
      });
    }),

  /**
   * Mark pay application as billed
   */
  bill: authenticatedProcedure
    .input(
      z.object({
        payApplicationId: z.string().uuid(),
        invoiceNumber: z.string().min(1).max(50),
        invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new PayApplicationService(ctx.serviceContext);
      return service.bill({
        payApplicationId: input.payApplicationId,
        invoiceNumber: input.invoiceNumber,
        invoiceDate: input.invoiceDate,
        billedBy: ctx.serviceContext.userId || '',
      });
    }),

  /**
   * Record payment received
   */
  recordPayment: authenticatedProcedure
    .input(
      z.object({
        payApplicationId: z.string().uuid(),
        paidAmount: z.number().nonnegative(),
        paidDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        checkNumber: z.string().max(50).optional(),
        paymentReference: z.string().max(100).optional(),
        notes: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new PayApplicationService(ctx.serviceContext);
      return service.recordPayment({
        payApplicationId: input.payApplicationId,
        paidAmount: input.paidAmount,
        paidDate: input.paidDate,
        checkNumber: input.checkNumber,
        paymentReference: input.paymentReference,
        notes: input.notes,
      });
    }),

  /**
   * Void pay application
   */
  void: adminProcedure
    .input(
      z.object({
        payApplicationId: z.string().uuid(),
        reason: z.string().min(1, 'Void reason is required').max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new PayApplicationService(ctx.serviceContext);
      return service.void({
        payApplicationId: input.payApplicationId,
        voidedBy: ctx.serviceContext.userId || '',
        reason: input.reason,
      });
    }),

  /**
   * Revert rejected pay application to draft
   */
  revertToDraft: authenticatedProcedure
    .input(z.object({ payApplicationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new PayApplicationService(ctx.serviceContext);
      return service.revertToDraft(input.payApplicationId);
    }),

  // ========== Validation Routes ==========

  /**
   * Validate pay application
   */
  validate: authenticatedProcedure
    .input(z.object({ payApplicationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new PayApplicationService(ctx.serviceContext);
      return service.validate(input.payApplicationId);
    }),

  /**
   * Validate pay application math
   */
  validateMath: authenticatedProcedure
    .input(z.object({ payApplicationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new PayApplicationService(ctx.serviceContext);
      return service.validateMath(input.payApplicationId);
    }),

  // ========== G702 Export Routes ==========

  /**
   * Generate AIA G702 Application and Certificate for Payment
   */
  generateG702: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('generate_g702', 'Generate AIA G702 Application and Certificate for Payment', {
      scopes: ['pay-applications', 'construction', 'reporting'],
      permissions: ['read:pay-applications'],
    }) })
    .input(z.object({ payApplicationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new PayApplicationService(ctx.serviceContext);
      return service.generateG702(input.payApplicationId);
    }),

  // ========== Approval History Routes ==========

  /**
   * Get approval history for a pay application
   */
  getApprovalHistory: authenticatedProcedure
    .input(z.object({ payApplicationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new PayApplicationService(ctx.serviceContext);
      return service.getApprovalHistory(input.payApplicationId);
    }),

  // ========== Retainage Release Routes ==========

  /**
   * Create a retainage release
   */
  createRetainageRelease: authenticatedProcedure.input(createRetainageReleaseSchema).mutation(async ({ ctx, input }) => {
    const service = new PayApplicationService(ctx.serviceContext);
    return service.createRetainageRelease({
      organizationId: ctx.serviceContext.organizationId!,
      projectId: input.projectId,
      payApplicationId: input.payApplicationId,
      releaseDate: input.releaseDate,
      releaseType: input.releaseType,
      releaseAmount: input.releaseAmount,
      releasePercent: input.releasePercent,
      requiresPunchlistComplete: input.requiresPunchlistComplete,
      requiresLienWaivers: input.requiresLienWaivers,
      requiresWarrantyDocuments: input.requiresWarrantyDocuments,
      externalReference: input.externalReference,
      notes: input.notes,
      lines: input.lines?.map(line => ({
        sovLineId: line.sovLineId,
        lineNumber: line.lineNumber,
        releaseAmount: line.releaseAmount,
        notes: line.notes,
      })),
    });
  }),

  /**
   * Approve a retainage release
   */
  approveRetainageRelease: authenticatedProcedure
    .input(
      z.object({
        retainageReleaseId: z.string().uuid(),
        approvedAmount: z.number().nonnegative().optional(),
        notes: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new PayApplicationService(ctx.serviceContext);
      return service.approveRetainageRelease({
        retainageReleaseId: input.retainageReleaseId,
        approvedBy: ctx.serviceContext.userId || '',
        approvedAmount: input.approvedAmount,
        notes: input.notes,
      });
    }),

  /**
   * Get retainage releases for a project
   */
  getRetainageReleases: authenticatedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new PayApplicationService(ctx.serviceContext);
      return service.getRetainageReleases(input.projectId);
    }),

  // ========== Reporting Routes ==========

  /**
   * Get pay application summary by project
   */
  getProjectSummary: authenticatedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new PayApplicationService(ctx.serviceContext);
      const result = await service.list(
        { page: 1, limit: 100 },
        { organizationId: ctx.serviceContext.organizationId!, projectId: input.projectId }
      );

      // Calculate summary totals
      const summary = {
        totalPayApps: result.total,
        draftCount: 0,
        submittedCount: 0,
        approvedCount: 0,
        certifiedCount: 0,
        billedCount: 0,
        paidCount: 0,
        totalBilled: 0,
        totalPaid: 0,
        totalRetainage: 0,
        outstandingBalance: 0,
      };

      for (const payApp of result.data) {
        switch (payApp.status) {
          case 'DRAFT':
            summary.draftCount++;
            break;
          case 'SUBMITTED':
            summary.submittedCount++;
            break;
          case 'APPROVED':
            summary.approvedCount++;
            break;
          case 'CERTIFIED':
            summary.certifiedCount++;
            break;
          case 'BILLED':
            summary.billedCount++;
            summary.totalBilled += payApp.currentPaymentDue;
            summary.outstandingBalance += payApp.currentPaymentDue;
            break;
          case 'PAID':
            summary.paidCount++;
            summary.totalBilled += payApp.currentPaymentDue;
            summary.totalPaid += payApp.currentPaymentDue;
            break;
        }
        summary.totalRetainage += payApp.totalRetainage;
      }

      return summary;
    }),
});
