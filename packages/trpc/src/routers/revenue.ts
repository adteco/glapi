import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { RevenueService, SSPService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';

export const revenueRouter = router({
  // Calculate revenue for subscription
  calculate: authenticatedProcedure
    .input(z.object({
      subscriptionId: z.string().uuid(),
      calculationType: z.enum(['initial', 'modification', 'renewal', 'termination']),
      effectiveDate: z.coerce.date(),
      options: z.object({
        forceRecalculation: z.boolean().default(false),
        includeHistorical: z.boolean().default(false)
      }).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new RevenueService(ctx.serviceContext);
      
      try {
        return await service.calculateRevenue(
          input.subscriptionId,
          input.calculationType,
          input.effectiveDate,
          input.options
        );
      } catch (error: any) {
        if (error.code === 'NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message
          });
        }
        throw error;
      }
    }),

  // Revenue schedules management
  schedules: router({
    // List schedules with filtering
    list: authenticatedProcedure
      .input(z.object({
        subscriptionId: z.string().uuid().optional(),
        performanceObligationId: z.string().uuid().optional(),
        status: z.enum(['scheduled', 'recognized', 'deferred']).optional(),
        periodStart: z.coerce.date().optional(),
        periodEnd: z.coerce.date().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50)
      }).optional())
      .query(async ({ ctx, input = {} }) => {
        const service = new RevenueService(ctx.serviceContext);
        return service.getRevenueSchedules(input);
      }),

    // Get schedule details
    get: authenticatedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const service = new RevenueService(ctx.serviceContext);
        const schedule = await service.getRevenueScheduleById(input.id);
        
        if (!schedule) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Revenue schedule not found'
          });
        }
        
        return schedule;
      }),

    // Update schedule (for adjustments)
    update: authenticatedProcedure
      .input(z.object({
        id: z.string().uuid(),
        data: z.object({
          scheduledAmount: z.string().optional(),
          recognitionDate: z.coerce.date().optional(),
          status: z.enum(['scheduled', 'recognized', 'deferred']).optional()
        })
      }))
      .mutation(async ({ ctx, input }) => {
        const service = new RevenueService(ctx.serviceContext);
        
        try {
          return await service.updateRevenueSchedule(input.id, {
            ...input.data,
            recognitionDate: input.data.recognitionDate?.toISOString().split('T')[0]
          } as any);
        } catch (error: any) {
          if (error.code === 'NOT_FOUND') {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: error.message
            });
          }
          throw error;
        }
      })
  }),

  // Performance obligations management
  performanceObligations: router({
    // List performance obligations
    list: authenticatedProcedure
      .input(z.object({
        subscriptionId: z.string().uuid().optional(),
        status: z.enum(['active', 'satisfied', 'cancelled']).optional(),
        obligationType: z.enum([
          'product_license',
          'maintenance_support', 
          'professional_services',
          'hosting_services',
          'other'
        ]).optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50)
      }).optional())
      .query(async ({ ctx, input = {} }) => {
        const service = new RevenueService(ctx.serviceContext);
        return service.getPerformanceObligations(input);
      }),

    // Get obligation details with schedules
    get: authenticatedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const service = new RevenueService(ctx.serviceContext);
        const obligation = await service.getPerformanceObligationById(input.id);
        
        if (!obligation) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Performance obligation not found'
          });
        }
        
        return obligation;
      }),

    // Mark obligation as satisfied
    satisfy: authenticatedProcedure
      .input(z.object({
        id: z.string().uuid(),
        satisfactionDate: z.coerce.date(),
        satisfactionEvidence: z.string().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        const service = new RevenueService(ctx.serviceContext);
        
        try {
          return await service.satisfyPerformanceObligation(
            input.id,
            input.satisfactionDate,
            input.satisfactionEvidence
          );
        } catch (error: any) {
          if (error.code === 'NOT_FOUND') {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: error.message
            });
          }
          if (error.code === 'ALREADY_SATISFIED') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error.message
            });
          }
          throw error;
        }
      })
  }),

  // Revenue recognition processing
  recognize: authenticatedProcedure
    .input(z.object({
      periodDate: z.coerce.date(),
      scheduleIds: z.array(z.string().uuid()).optional(),
      dryRun: z.boolean().default(false)
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new RevenueService(ctx.serviceContext);
      
      try {
        return await service.recognizeRevenue(
          input.periodDate,
          input.scheduleIds,
          input.dryRun
        );
      } catch (error: any) {
        if (error.code === 'RECOGNITION_FAILED') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message
          });
        }
        throw error;
      }
    }),

  // SSP management
  ssp: router({
    // List SSP evidence
    list: authenticatedProcedure
      .input(z.object({
        itemId: z.string().uuid().optional(),
        evidenceType: z.enum([
          'standalone_sale',
          'competitor_pricing',
          'cost_plus_margin',
          'market_assessment'
        ]).optional(),
        isActive: z.boolean().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50)
      }).optional())
      .query(async ({ ctx, input = {} }) => {
        const service = new SSPService(ctx.serviceContext);
        return service.getSSPEvidence(input);
      }),

    // Create SSP evidence
    create: authenticatedProcedure
      .input(z.object({
        itemId: z.string().uuid(),
        evidenceType: z.enum([
          'standalone_sale',
          'competitor_pricing',
          'cost_plus_margin',
          'market_assessment'
        ]),
        evidenceDate: z.coerce.date(),
        sspAmount: z.number().positive(),
        currency: z.string().length(3).default('USD'),
        evidenceSource: z.string().optional(),
        confidenceLevel: z.enum(['high', 'medium', 'low'])
      }))
      .mutation(async ({ ctx, input }) => {
        const service = new SSPService(ctx.serviceContext);
        
        try {
          return await service.createSSPEvidence({
            ...input,
            sspAmount: input.sspAmount
          } as any);
        } catch (error: any) {
          if (error.code === 'ITEM_NOT_FOUND') {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: error.message
            });
          }
          throw error;
        }
      }),

    // Get current SSP for item
    current: authenticatedProcedure
      .input(z.object({ itemId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const service = new SSPService(ctx.serviceContext);
        const ssp = await service.getCurrentSSP(input.itemId);
        
        if (!ssp) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'No SSP evidence found for this item'
          });
        }
        
        return ssp;
      }),

    // Update SSP evidence
    update: authenticatedProcedure
      .input(z.object({
        id: z.string().uuid(),
        data: z.object({
          evidenceDate: z.coerce.date().optional(),
          sspAmount: z.string().optional(),
          confidenceLevel: z.enum(['high', 'medium', 'low']).optional(),
          isActive: z.boolean().optional()
        })
      }))
      .mutation(async ({ ctx, input }) => {
        const service = new SSPService(ctx.serviceContext);
        
        try {
          const updated = await service.updateSSPEvidence(input.id, {
            ...input.data,
            evidenceDate: input.data.evidenceDate 
              ? (typeof input.data.evidenceDate === 'string' 
                  ? input.data.evidenceDate 
                  : input.data.evidenceDate.toISOString().split('T')[0])
              : undefined
          });
          
          if (!updated) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'SSP evidence not found'
            });
          }
          
          return updated;
        } catch (error: any) {
          if (error.code === 'NOT_FOUND') {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: error.message
            });
          }
          throw error;
        }
      }),

    // Deactivate SSP evidence
    deactivate: authenticatedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const service = new SSPService(ctx.serviceContext);
        
        try {
          const deactivated = await service.deactivateSSPEvidence(input.id);
          
          if (!deactivated) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'SSP evidence not found'
            });
          }
          
          return deactivated;
        } catch (error: any) {
          if (error.code === 'NOT_FOUND') {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: error.message
            });
          }
          throw error;
        }
      }),

    // Get SSP summary statistics
    summary: authenticatedProcedure
      .input(z.object({
        itemIds: z.array(z.string().uuid()).optional()
      }).optional())
      .query(async ({ ctx, input = {} }) => {
        const service = new SSPService(ctx.serviceContext);
        return service.getSSPSummary(input.itemIds);
      }),

    // Calculate SSP range with statistics
    range: authenticatedProcedure
      .input(z.object({ itemId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const service = new SSPService(ctx.serviceContext);
        const range = await service.calculateSSPRange(input.itemId);
        
        if (!range) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'No SSP evidence found for range calculation'
          });
        }
        
        return range;
      })
  }),

  // Revenue reports
  reports: router({
    // Revenue summary report
    summary: authenticatedProcedure
      .input(z.object({
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
        groupBy: z.enum(['month', 'quarter', 'year']).default('month'),
        entityId: z.string().uuid().optional()
      }))
      .query(async ({ ctx, input }) => {
        const service = new RevenueService(ctx.serviceContext);
        return service.getRevenueSummary({
          startDate: input.startDate,
          endDate: input.endDate,
          groupBy: input.groupBy || 'month',
          entityId: input.entityId
        });
      }),

    // Deferred revenue balance
    deferredBalance: authenticatedProcedure
      .input(z.object({
        asOfDate: z.coerce.date().optional()
      }).optional())
      .query(async ({ ctx, input = {} }) => {
        const service = new RevenueService(ctx.serviceContext);
        return service.getDeferredBalance(input.asOfDate || new Date());
      }),

    // ARR calculation
    arr: authenticatedProcedure
      .input(z.object({
        asOfDate: z.coerce.date().optional(),
        entityId: z.string().uuid().optional()
      }).optional())
      .query(async ({ ctx, input = {} }) => {
        const service = new RevenueService(ctx.serviceContext);
        return service.calculateARR(input.asOfDate, input.entityId);
      }),

    // MRR calculation
    mrr: authenticatedProcedure
      .input(z.object({
        forMonth: z.coerce.date().optional(),
        entityId: z.string().uuid().optional()
      }).optional())
      .query(async ({ ctx, input = {} }) => {
        const service = new RevenueService(ctx.serviceContext);
        return service.calculateMRR(input.forMonth, input.entityId);
      }),

    // Revenue waterfall analysis
    waterfall: authenticatedProcedure
      .input(z.object({
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
        compareToASC605: z.boolean().default(false)
      }))
      .query(async ({ ctx, input }) => {
        const service = new RevenueService(ctx.serviceContext);
        return service.getRevenueWaterfall({
          startDate: input.startDate,
          endDate: input.endDate,
          compareToASC605: input.compareToASC605 || false
        });
      }),

    // Recognition history
    recognitionHistory: authenticatedProcedure
      .input(z.object({
        subscriptionId: z.string().uuid().optional(),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50)
      }).optional())
      .query(async ({ ctx, input = {} }) => {
        const service = new RevenueService(ctx.serviceContext);
        return service.getRecognitionHistory(input);
      })
  }),

  // ASC 605 vs 606 comparison
  comparison: authenticatedProcedure
    .input(z.object({
      subscriptionId: z.string().uuid(),
      comparisonDate: z.coerce.date().optional()
    }))
    .query(async ({ ctx, input }) => {
      const service = new RevenueService(ctx.serviceContext);
      
      try {
        return await service.compareASC605vs606(
          input.subscriptionId, 
          input.comparisonDate
        );
      } catch (error: any) {
        if (error.code === 'NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message
          });
        }
        throw error;
      }
    }),

  // Allocation preview
  allocationPreview: authenticatedProcedure
    .input(z.object({
      subscriptionId: z.string().uuid(),
      effectiveDate: z.coerce.date()
    }))
    .query(async ({ ctx, input }) => {
      const service = new RevenueService(ctx.serviceContext);
      
      try {
        return await service.previewAllocation(
          input.subscriptionId,
          input.effectiveDate
        );
      } catch (error: any) {
        if (error.code === 'NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message
          });
        }
        throw error;
      }
    })
});