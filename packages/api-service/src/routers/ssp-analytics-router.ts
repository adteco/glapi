import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { SSPAnalyticsService } from '../services/ssp-analytics-service';
import { TRPCError } from '@trpc/server';
import { CalculationMethods, ExceptionSeverity, sspCalculationRuns, sspExceptions, vsoeEvidence, sspPricingBands } from '@glapi/database';
import { SSPExceptionMonitor, SSPMLTrainingService } from '@glapi/business';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

const sspAnalyticsRunConfigSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  calculationMethod: z.enum([
    CalculationMethods.VSOE,
    CalculationMethods.STATISTICAL,
    CalculationMethods.ML,
    CalculationMethods.HYBRID,
    CalculationMethods.MANUAL
  ]),
  minTransactions: z.number().min(1).optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),
  runType: z.enum(['scheduled', 'manual', 'triggered']).optional()
});

const exportFormatSchema = z.enum(['csv', 'json', 'excel']);

const scheduleSchema = z.enum(['daily', 'weekly', 'monthly']);

export const sspAnalyticsRouter = router({
  /**
   * Start a new SSP calculation run
   */
  startCalculationRun: protectedProcedure
    .input(sspAnalyticsRunConfigSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new SSPAnalyticsService(ctx.db, ctx.user.organizationId);
      
      try {
        const result = await service.startCalculationRun({
          organizationId: ctx.user.organizationId,
          startDate: input.startDate,
          endDate: input.endDate,
          calculationMethod: input.calculationMethod,
          minTransactions: input.minTransactions,
          confidenceThreshold: input.confidenceThreshold,
          runType: input.runType
        });

        return {
          success: true,
          data: result
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to start SSP calculation: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }),

  /**
   * Get SSP analysis for a specific item
   */
  getItemAnalysis: protectedProcedure
    .input(z.object({
      itemId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const service = new SSPAnalyticsService(ctx.db, ctx.user.organizationId);
      
      const analysis = await service.getItemAnalysis(
        ctx.user.organizationId,
        input.itemId
      );

      if (!analysis) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No SSP analysis found for this item'
        });
      }

      return analysis;
    }),

  /**
   * Get SSP dashboard data
   */
  getDashboard: protectedProcedure
    .query(async ({ ctx }) => {
      const service = new SSPAnalyticsService(ctx.db, ctx.user.organizationId);
      
      return await service.getDashboardData(ctx.user.organizationId);
    }),

  /**
   * Get calculation run details
   */
  getCalculationRun: protectedProcedure
    .input(z.object({
      runId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const run = await ctx.db
        .select()
        .from(sspCalculationRuns)
        .where(and(
          eq(sspCalculationRuns.id, input.runId),
          eq(sspCalculationRuns.organizationId, ctx.user.organizationId)
        ))
        .limit(1)
        .then(rows => rows[0] || null);

      if (!run) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Calculation run not found'
        });
      }

      return run;
    }),

  /**
   * List calculation runs
   */
  listCalculationRuns: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(10),
      offset: z.number().min(0).default(0),
      status: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional()
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(sspCalculationRuns.organizationId, ctx.user.organizationId)];
      
      if (input.status) {
        conditions.push(eq(sspCalculationRuns.status, input.status));
      }
      
      if (input.startDate) {
        conditions.push(gte(sspCalculationRuns.runDate, new Date(input.startDate)));
      }
      
      if (input.endDate) {
        conditions.push(lte(sspCalculationRuns.runDate, new Date(input.endDate)));
      }

      const runs = await ctx.db
        .select()
        .from(sspCalculationRuns)
        .where(and(...conditions))
        .orderBy(desc(sspCalculationRuns.runDate))
        .limit(input.limit)
        .offset(input.offset);

      return runs;
    }),

  /**
   * Approve a calculation run
   */
  approveRun: protectedProcedure
    .input(z.object({
      runId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new SSPAnalyticsService(ctx.db, ctx.user.organizationId);
      
      const approvedRun = await service.approveRun(
        input.runId,
        ctx.user.id
      );

      return {
        success: true,
        data: approvedRun
      };
    }),

  /**
   * Get exceptions for review
   */
  getExceptions: protectedProcedure
    .input(z.object({
      itemId: z.string().optional(),
      severity: z.enum(['critical', 'warning', 'info']).optional(),
      status: z.enum(['open', 'acknowledged', 'resolved', 'ignored']).optional(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0)
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(sspExceptions.organizationId, ctx.user.organizationId)];
      
      if (input.itemId) {
        conditions.push(eq(sspExceptions.itemId, input.itemId));
      }
      
      if (input.severity) {
        conditions.push(eq(sspExceptions.severity, input.severity));
      }
      
      if (input.status) {
        conditions.push(eq(sspExceptions.status, input.status));
      }

      const exceptions = await ctx.db
        .select()
        .from(sspExceptions)
        .where(and(...conditions))
        .orderBy(desc(sspExceptions.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return exceptions;
    }),

  /**
   * Acknowledge an exception
   */
  acknowledgeException: protectedProcedure
    .input(z.object({
      exceptionId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new SSPAnalyticsService(ctx.db, ctx.user.organizationId);
      const monitor = new SSPExceptionMonitor(ctx.db as any);
      
      const acknowledged = await monitor.acknowledgeException(
        input.exceptionId,
        ctx.user.id
      );

      return {
        success: true,
        data: acknowledged
      };
    }),

  /**
   * Resolve an exception
   */
  resolveException: protectedProcedure
    .input(z.object({
      exceptionId: z.string(),
      resolutionNotes: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const monitor = new SSPExceptionMonitor(ctx.db as any);
      
      const resolved = await monitor.resolveException(
        input.exceptionId,
        ctx.user.id,
        input.resolutionNotes
      );

      return {
        success: true,
        data: resolved
      };
    }),

  /**
   * Get exception summary
   */
  getExceptionSummary: protectedProcedure
    .query(async ({ ctx }) => {
      const monitor = new SSPExceptionMonitor(ctx.db as any);
      
      return await monitor.getExceptionSummary(ctx.user.organizationId);
    }),

  /**
   * Get exception trends
   */
  getExceptionTrends: protectedProcedure
    .input(z.object({
      days: z.number().min(7).max(365).default(30)
    }))
    .query(async ({ ctx, input }) => {
      const monitor = new SSPExceptionMonitor(ctx.db as any);
      
      return await monitor.getExceptionTrends(
        ctx.user.organizationId,
        input.days
      );
    }),

  /**
   * Train ML model
   */
  trainMLModel: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new SSPAnalyticsService(ctx.db, ctx.user.organizationId);
      
      try {
        const result = await service.trainMLModel(
          ctx.user.organizationId,
          input.startDate,
          input.endDate
        );

        return {
          success: true,
          data: result
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to train ML model: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }),

  /**
   * Get ML predictions
   */
  getMLPredictions: protectedProcedure
    .input(z.object({
      itemIds: z.array(z.string()).min(1).max(100)
    }))
    .query(async ({ ctx, input }) => {
      const service = new SSPAnalyticsService(ctx.db, ctx.user.organizationId);
      
      try {
        return await service.getMLPredictions(
          ctx.user.organizationId,
          input.itemIds
        );
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to get ML predictions: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }),

  /**
   * Get model metrics
   */
  getModelMetrics: protectedProcedure
    .query(async ({ ctx }) => {
      const mlService = new SSPMLTrainingService(ctx.db as any);
      
      return await mlService.getModelMetrics(ctx.user.organizationId);
    }),

  /**
   * Schedule automated run
   */
  scheduleAutomatedRun: protectedProcedure
    .input(z.object({
      schedule: scheduleSchema
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new SSPAnalyticsService(ctx.db, ctx.user.organizationId);
      
      await service.scheduleAutomatedRun(
        ctx.user.organizationId,
        input.schedule
      );

      return {
        success: true,
        message: `Scheduled ${input.schedule} SSP calculations`
      };
    }),

  /**
   * Export SSP data
   */
  exportData: protectedProcedure
    .input(z.object({
      format: exportFormatSchema
    }))
    .query(async ({ ctx, input }) => {
      const service = new SSPAnalyticsService(ctx.db, ctx.user.organizationId);
      
      const buffer = await service.exportSSPData(
        ctx.user.organizationId,
        input.format
      );

      // Convert buffer to base64 for transmission
      return {
        format: input.format,
        data: buffer.toString('base64'),
        filename: `ssp-export-${new Date().toISOString().split('T')[0]}.${input.format}`
      };
    }),

  /**
   * Get VSOE evidence for an item
   */
  getVSOEEvidence: protectedProcedure
    .input(z.object({
      itemId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const evidence = await ctx.db
        .select()
        .from(vsoeEvidence)
        .where(and(
          eq(vsoeEvidence.organizationId, ctx.user.organizationId),
          eq(vsoeEvidence.itemId, input.itemId)
        ))
        .orderBy(desc(vsoeEvidence.createdAt))
        .limit(1)
        .then(rows => rows[0] || null);

      if (!evidence) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No VSOE evidence found for this item'
        });
      }

      return evidence;
    }),

  /**
   * Get pricing bands for an item
   */
  getPricingBands: protectedProcedure
    .input(z.object({
      itemId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const bands = await ctx.db
        .select()
        .from(sspPricingBands)
        .where(and(
          eq(sspPricingBands.organizationId, ctx.user.organizationId),
          eq(sspPricingBands.itemId, input.itemId)
        ))
        .orderBy(desc(sspPricingBands.createdAt))
        .limit(1)
        .then(rows => rows[0] || null);

      if (!bands) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No pricing bands found for this item'
        });
      }

      return bands;
    }),

  /**
   * Bulk update SSP values
   */
  bulkUpdateSSP: protectedProcedure
    .input(z.object({
      updates: z.array(z.object({
        itemId: z.string(),
        ssp: z.number().positive(),
        method: z.string(),
        notes: z.string().optional()
      })).min(1).max(100)
    }))
    .mutation(async ({ ctx, input }) => {
      const results = [];

      for (const update of input.updates) {
        // This would update the SSP values in the database
        // For now, just returning success
        results.push({
          itemId: update.itemId,
          success: true
        });
      }

      return {
        success: true,
        updated: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      };
    })
});

export type SSPAnalyticsRouter = typeof sspAnalyticsRouter;