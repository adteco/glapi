import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { ContractModificationService } from '../services/contract-modification-service';
import { TRPCError } from '@trpc/server';
import { ModificationType, ModificationMethod, ModificationStatus } from '@glapi/database/schema';

// Input schemas
const modificationChangesSchema = z.object({
  addItems: z.array(z.object({
    itemId: z.string(),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
    discountPercent: z.number().min(0).max(100).optional(),
    startDate: z.date().optional(),
    endDate: z.date().optional()
  })).optional(),
  removeItems: z.array(z.string()).optional(),
  modifyItems: z.array(z.object({
    subscriptionItemId: z.string(),
    newQuantity: z.number().positive().optional(),
    newUnitPrice: z.number().positive().optional(),
    newDiscountPercent: z.number().min(0).max(100).optional(),
    newEndDate: z.date().optional()
  })).optional(),
  termExtension: z.object({
    newEndDate: z.date(),
    prorationMethod: z.enum(['daily', 'monthly']).optional()
  }).optional(),
  earlyTermination: z.object({
    terminationDate: z.date(),
    refundPolicy: z.enum(['none', 'prorated', 'full']).optional()
  }).optional(),
  partialTermination: z.object({
    itemIds: z.array(z.string()),
    terminationDate: z.date(),
    refundPolicy: z.enum(['none', 'prorated', 'full']).optional()
  }).optional()
});

const modificationRequestSchema = z.object({
  subscriptionId: z.string(),
  modificationType: z.enum(Object.values(ModificationType) as [string, ...string[]]),
  effectiveDate: z.date(),
  changes: modificationChangesSchema,
  reason: z.string().optional(),
  notes: z.string().optional()
});

const approvalRequestSchema = z.object({
  modificationId: z.string(),
  action: z.enum(['approve', 'reject', 'request_info']),
  comments: z.string().optional(),
  conditions: z.record(z.any()).optional()
});

const modificationFiltersSchema = z.object({
  subscriptionId: z.string().optional(),
  status: z.string().optional(),
  modificationType: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  minAmount: z.number().optional(),
  maxAmount: z.number().optional()
});

export const contractModificationsRouter = router({
  /**
   * Create a new contract modification
   */
  create: protectedProcedure
    .input(z.object({
      request: modificationRequestSchema,
      preview: z.boolean().optional(),
      autoSubmit: z.boolean().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ContractModificationService(ctx.db);
      
      try {
        const result = await service.createModification(
          {
            ...input.request,
            requestedBy: ctx.user.id
          },
          {
            preview: input.preview,
            autoSubmit: input.autoSubmit
          }
        );

        return {
          success: true,
          data: result
        };
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to create modification'
        });
      }
    }),

  /**
   * Preview modification impact
   */
  preview: protectedProcedure
    .input(modificationRequestSchema)
    .query(async ({ ctx, input }) => {
      const service = new ContractModificationService(ctx.db);
      
      try {
        const result = await service.previewModification({
          ...input,
          requestedBy: ctx.user.id
        });

        return result;
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to preview modification'
        });
      }
    }),

  /**
   * Get modification by ID
   */
  get: protectedProcedure
    .input(z.object({
      modificationId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const service = new ContractModificationService(ctx.db);
      
      const modification = await service.getModification(input.modificationId);
      
      if (!modification) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Modification not found'
        });
      }

      return modification;
    }),

  /**
   * List modifications
   */
  list: protectedProcedure
    .input(z.object({
      filters: modificationFiltersSchema,
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0)
    }))
    .query(async ({ ctx, input }) => {
      const service = new ContractModificationService(ctx.db);
      
      return await service.listModifications(
        input.filters,
        {
          limit: input.limit,
          offset: input.offset
        }
      );
    }),

  /**
   * Submit modification for approval
   */
  submitForApproval: protectedProcedure
    .input(z.object({
      modificationId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ContractModificationService(ctx.db);
      
      try {
        const approvalStatus = await service.submitForApproval(
          input.modificationId,
          ctx.user.id
        );

        return {
          success: true,
          data: approvalStatus
        };
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to submit for approval'
        });
      }
    }),

  /**
   * Process approval action
   */
  processApproval: protectedProcedure
    .input(approvalRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ContractModificationService(ctx.db);
      
      try {
        const approvalStatus = await service.processApproval({
          ...input,
          approverId: ctx.user.id,
          approverRole: ctx.user.role // Assuming role is available in context
        });

        return {
          success: true,
          data: approvalStatus
        };
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to process approval'
        });
      }
    }),

  /**
   * Apply an approved modification
   */
  apply: protectedProcedure
    .input(z.object({
      modificationId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ContractModificationService(ctx.db);
      
      try {
        await service.applyModification(input.modificationId);

        return {
          success: true,
          message: 'Modification applied successfully'
        };
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to apply modification'
        });
      }
    }),

  /**
   * Process partial termination
   */
  partialTermination: protectedProcedure
    .input(z.object({
      subscriptionId: z.string(),
      itemsToTerminate: z.array(z.string()),
      terminationDate: z.date(),
      refundPolicy: z.enum(['none', 'prorated', 'full']).optional(),
      finalInvoice: z.boolean().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ContractModificationService(ctx.db);
      
      try {
        const result = await service.processPartialTermination(
          input.subscriptionId,
          input.itemsToTerminate,
          input.terminationDate,
          {
            refundPolicy: input.refundPolicy,
            finalInvoice: input.finalInvoice,
            requestedBy: ctx.user.id
          }
        );

        return {
          success: true,
          data: result
        };
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to process partial termination'
        });
      }
    }),

  /**
   * Process upgrade/downgrade
   */
  upgradeDowngrade: protectedProcedure
    .input(z.object({
      subscriptionId: z.string(),
      fromItemId: z.string(),
      toItemId: z.string(),
      effectiveDate: z.date(),
      creditPolicy: z.enum(['full', 'prorated', 'none']).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ContractModificationService(ctx.db);
      
      try {
        const result = await service.processUpgradeDowngrade(
          input.subscriptionId,
          {
            fromItemId: input.fromItemId,
            toItemId: input.toItemId,
            effectiveDate: input.effectiveDate,
            creditPolicy: input.creditPolicy,
            requestedBy: ctx.user.id
          }
        );

        return {
          success: true,
          data: result
        };
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to process upgrade/downgrade'
        });
      }
    }),

  /**
   * Process blend and extend
   */
  blendAndExtend: protectedProcedure
    .input(z.object({
      subscriptionId: z.string(),
      newTermEndDate: z.date(),
      priceAdjustment: z.number().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ContractModificationService(ctx.db);
      
      try {
        const result = await service.processBlendAndExtend(
          input.subscriptionId,
          input.newTermEndDate,
          input.priceAdjustment,
          ctx.user.id
        );

        return {
          success: true,
          data: result
        };
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to process blend and extend'
        });
      }
    }),

  /**
   * Get pending approvals for current user
   */
  getPendingApprovals: protectedProcedure
    .query(async ({ ctx }) => {
      const service = new ContractModificationService(ctx.db);
      
      return await service.getPendingApprovals(
        ctx.user.id,
        ctx.user.role // Assuming role is available
      );
    }),

  /**
   * Recall modification from approval
   */
  recall: protectedProcedure
    .input(z.object({
      modificationId: z.string(),
      reason: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ContractModificationService(ctx.db);
      
      try {
        await service.recallModification(
          input.modificationId,
          ctx.user.id,
          input.reason
        );

        return {
          success: true,
          message: 'Modification recalled successfully'
        };
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to recall modification'
        });
      }
    }),

  /**
   * Delegate approval
   */
  delegateApproval: protectedProcedure
    .input(z.object({
      modificationId: z.string(),
      toApproverId: z.string(),
      reason: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ContractModificationService(ctx.db);
      
      try {
        await service.delegateApproval(
          input.modificationId,
          ctx.user.id,
          input.toApproverId,
          input.reason
        );

        return {
          success: true,
          message: 'Approval delegated successfully'
        };
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to delegate approval'
        });
      }
    }),

  /**
   * Get modification statistics
   */
  getStatistics: protectedProcedure
    .input(z.object({
      organizationId: z.string(),
      startDate: z.date().optional(),
      endDate: z.date().optional()
    }))
    .query(async ({ ctx, input }) => {
      const service = new ContractModificationService(ctx.db);
      
      return await service.getStatistics(
        input.organizationId,
        input.startDate && input.endDate
          ? { startDate: input.startDate, endDate: input.endDate }
          : undefined
      );
    }),

  /**
   * Cancel draft modification
   */
  cancel: protectedProcedure
    .input(z.object({
      modificationId: z.string(),
      reason: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ContractModificationService(ctx.db);
      
      try {
        await service.cancelModification(
          input.modificationId,
          ctx.user.id,
          input.reason
        );

        return {
          success: true,
          message: 'Modification cancelled successfully'
        };
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to cancel modification'
        });
      }
    })
});

export type ContractModificationsRouter = typeof contractModificationsRouter;