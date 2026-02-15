import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { RevenueService, SSPService, SubscriptionService, CustomerService } from '@glapi/api-service';
import { items, subscriptions, unitsOfMeasure } from '@glapi/database/schema';
import { TRPCError } from '@trpc/server';
import { createReadOnlyAIMeta, createWriteAIMeta } from '../ai-meta';
import { and, desc, eq, ilike } from 'drizzle-orm';

export const revenueRouter = router({
  // Calculate revenue for subscription
  calculate: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('calculate_revenue', 'Calculate revenue for subscription (ASC 606)', {
      scopes: ['revenue', 'subscriptions', 'accounting'],
      permissions: ['write:revenue'],
      riskLevel: 'MEDIUM',
    }) })
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
        status: z.enum(['Pending', 'InProcess', 'Fulfilled', 'PartiallyFulfilled', 'Cancelled']).optional(),
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
    .meta({ ai: createWriteAIMeta('recognize_revenue', 'Process revenue recognition for a period', {
      scopes: ['revenue', 'accounting'],
      permissions: ['write:revenue'],
      riskLevel: 'HIGH',
    }) })
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
          'customer_pricing',
          'comparable_sales',
          'market_research',
          'cost_plus'
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
          'customer_pricing',
          'comparable_sales',
          'market_research',
          'cost_plus'
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
    .meta({ ai: createReadOnlyAIMeta('compare_asc_standards', 'Compare ASC 605 vs 606 revenue treatment', {
      scopes: ['revenue', 'reporting', 'accounting'],
      permissions: ['read:revenue'],
    }) })
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
    .meta({ ai: createReadOnlyAIMeta('preview_revenue_allocation', 'Preview revenue allocation for subscription', {
      scopes: ['revenue', 'subscriptions', 'accounting'],
      permissions: ['read:revenue'],
    }) })
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
    }),

  // Subscription-level plan for UI/API waterfall + schedules
  subscriptionPlan: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('get_subscription_revenue_plan', 'Get ASC 606 plan for a subscription', {
      scopes: ['revenue', 'subscriptions', 'accounting'],
      permissions: ['read:revenue'],
    }) })
    .input(z.object({
      subscriptionId: z.string().uuid(),
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const service = new RevenueService(ctx.serviceContext, { db: ctx.db });
      return service.getSubscriptionPlan({
        subscriptionId: input.subscriptionId,
        startDate: input.startDate,
        endDate: input.endDate,
      });
    }),

  /**
   * Seed demo software-company ASC-606 scenarios (prepaid, monthly, discount, cancel, upsell, downsell).
   *
   * Intended for sales demos and sandbox environments.
   */
  seedSoftwareDemoScenarios: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('seed_asc606_software_demo', 'Seed ASC 606 demo scenarios for software subscriptions', {
      scopes: ['revenue', 'subscriptions', 'sales'],
      permissions: ['write:revenue', 'write:subscriptions', 'write:customers'],
      riskLevel: 'HIGH',
    }) })
    .input(z.object({
      /**
       * If true, reruns revenue calculations for existing demo subscriptions.
       * Does not delete subscriptions.
       */
      forceRecalculate: z.boolean().default(false),
    }).optional())
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId;
      const demoTag = 'asc606-software-v1';
      const forceRecalculate = input?.forceRecalculate ?? false;

      const subscriptionService = new SubscriptionService(ctx.serviceContext, { db: ctx.db });
      const revenueService = new RevenueService(ctx.serviceContext, { db: ctx.db });
      const customerService = new CustomerService(ctx.serviceContext, { db: ctx.db });

      // 1) Ensure unit-of-measure (EA) exists for demo items.
      const [existingUom] = await ctx.db.select()
        .from(unitsOfMeasure)
        .where(and(
          eq(unitsOfMeasure.organizationId, organizationId),
          eq(unitsOfMeasure.code, 'EA')
        ))
        .limit(1);

      const uom = existingUom || (await ctx.db.insert(unitsOfMeasure).values({
        organizationId,
        code: 'EA',
        name: 'Each',
        abbreviation: 'EA',
        decimalPlaces: 0,
        isActive: true,
        createdBy: String(ctx.user?.id || ''),
        updatedBy: String(ctx.user?.id || ''),
      }).returning())[0];

      // 2) Ensure demo items exist (created via direct insert to avoid GL-account validation).
      async function ensureItem(params: {
        itemCode: string;
        name: string;
        description: string;
        defaultPrice: number;
        defaultSspAmount: number;
        revenueBehavior: 'over_time' | 'point_in_time';
      }) {
        const [existing] = await ctx.db.select()
          .from(items)
          .where(and(
            eq(items.organizationId, organizationId),
            eq(items.itemCode, params.itemCode)
          ))
          .limit(1);

        if (existing) return existing;

        const [created] = await ctx.db.insert(items).values({
          organizationId,
          itemCode: params.itemCode,
          name: params.name,
          description: params.description,
          itemType: 'SERVICE',
          unitOfMeasureId: uom.id,
          // Avoid hard dependencies on chart-of-accounts seeding for demo environments.
          isTaxable: false,
          isSaleable: false,
          isPurchasable: false,
          defaultPrice: String(params.defaultPrice),
          defaultSspAmount: String(params.defaultSspAmount),
          revenueBehavior: params.revenueBehavior,
          createdBy: null,
          updatedBy: null,
        }).returning();

        return created;
      }

      const seatItem = await ensureItem({
        itemCode: 'DEMO-SAAS-SEAT',
        name: 'SaaS License Seat (Term)',
        description: 'Seat-based term license recognized over time (straight-line).',
        defaultPrice: 120,
        defaultSspAmount: 120,
        revenueBehavior: 'over_time',
      });

      const implItem = await ensureItem({
        itemCode: 'DEMO-IMPL-SVC',
        name: 'Implementation Services',
        description: 'One-time implementation recognized at a point in time.',
        defaultPrice: 4000,
        defaultSspAmount: 4000,
        revenueBehavior: 'point_in_time',
      });

      // 3) Ensure a demo customer exists.
      const existingCustomers = await customerService.listCustomers({ page: 1, limit: 200 });
      const demoCustomer =
        existingCustomers.data.find((c) => c.companyName === 'Demo SaaSCo') ||
        (await customerService.createCustomer({
          organizationId,
          companyName: 'Demo SaaSCo',
          customerId: 'DEMO-SAASCO',
          status: 'active',
        } as any));

      const startDate = new Date('2026-01-01T00:00:00Z');
      const endDate = new Date('2026-12-31T00:00:00Z');

      const scenarios: Array<{
        id: string;
        label: string;
        subscriptionId: string;
        subscriptionNumber: string;
        plan: any;
      }> = [];

      async function getOrCreateSubscriptionByNumber(subscriptionNumber: string, createFn: () => Promise<string>) {
        const existing = await subscriptionService.getSubscriptionByNumber(subscriptionNumber);
        if (existing) return existing.id;
        return createFn();
      }

      async function recalc(subscriptionId: string, calculationType: 'initial' | 'modification' | 'termination', effectiveDate: Date) {
        await revenueService.calculateRevenue(subscriptionId, calculationType, effectiveDate, { forceRecalculation: true });
        return revenueService.getSubscriptionPlan({ subscriptionId });
      }

      // A) $12,000 prepaid annually, recognized over 12 months
      {
        const subscriptionNumber = 'DEMO-ASC606-PREPAID-ANNUAL-12K';
        const subscriptionId = await getOrCreateSubscriptionByNumber(subscriptionNumber, async () => {
          const created = await subscriptionService.createSubscription({
            entityId: demoCustomer.id,
            subscriptionNumber,
            status: 'active',
            startDate,
            endDate,
            billingFrequency: 'annual',
            renewalTermMonths: 12,
            contractValue: 12000,
            metadata: { demoTag, scenario: 'prepaid_annual_12k' },
            items: [
              {
                itemId: seatItem.id,
                quantity: 100,
                unitPrice: 120,
                startDate,
                endDate,
                metadata: {
                  revenueBehavior: 'over_time',
                  sspAmount: 120,
                  listPrice: 120,
                },
              },
            ],
          } as any);
          return created.id;
        });

        const plan = forceRecalculate ? await recalc(subscriptionId, 'initial', startDate) : await revenueService.getSubscriptionPlan({ subscriptionId });
        scenarios.push({ id: 'prepaid_annual_12k', label: 'Prepaid Annual ($12k) Straight-Line', subscriptionId, subscriptionNumber, plan });
      }

      // B) $12,000 billed monthly, same revenue recognition (billing vs recognition)
      {
        const subscriptionNumber = 'DEMO-ASC606-BILLED-MONTHLY-12K';
        const subscriptionId = await getOrCreateSubscriptionByNumber(subscriptionNumber, async () => {
          const created = await subscriptionService.createSubscription({
            entityId: demoCustomer.id,
            subscriptionNumber,
            status: 'active',
            startDate,
            endDate,
            billingFrequency: 'monthly',
            renewalTermMonths: 12,
            contractValue: 12000,
            metadata: { demoTag, scenario: 'billed_monthly_12k' },
            items: [
              {
                itemId: seatItem.id,
                quantity: 100,
                unitPrice: 120,
                startDate,
                endDate,
                metadata: {
                  revenueBehavior: 'over_time',
                  sspAmount: 120,
                  listPrice: 120,
                },
              },
            ],
          } as any);
          return created.id;
        });

        const plan = forceRecalculate ? await recalc(subscriptionId, 'initial', startDate) : await revenueService.getSubscriptionPlan({ subscriptionId });
        scenarios.push({ id: 'billed_monthly_12k', label: 'Monthly Billed ($12k) Straight-Line', subscriptionId, subscriptionNumber, plan });
      }

      // C) Discounted bundle (SSP reallocation across subscription + implementation)
      {
        const subscriptionNumber = 'DEMO-ASC606-BUNDLE-DISCOUNT-SSP';
        const subscriptionId = await getOrCreateSubscriptionByNumber(subscriptionNumber, async () => {
          const created = await subscriptionService.createSubscription({
            entityId: demoCustomer.id,
            subscriptionNumber,
            status: 'active',
            startDate,
            endDate,
            billingFrequency: 'annual',
            renewalTermMonths: 12,
            // Transaction price discounted vs total SSP.
            contractValue: 14000, // 100 seats @ $100 (10k) + impl $4k
            metadata: { demoTag, scenario: 'bundle_discount_ssp_realloc' },
            items: [
              {
                itemId: seatItem.id,
                quantity: 100,
                unitPrice: 100, // discounted vs listPrice/SSP
                startDate,
                endDate,
                metadata: {
                  revenueBehavior: 'over_time',
                  sspAmount: 120, // per-seat SSP
                  listPrice: 120,
                },
              },
              {
                itemId: implItem.id,
                quantity: 1,
                unitPrice: 4000,
                startDate,
                endDate: startDate,
                metadata: {
                  revenueBehavior: 'point_in_time',
                  sspAmount: 4000,
                  listPrice: 4000,
                },
              },
            ],
          } as any);
          return created.id;
        });

        const plan = forceRecalculate ? await recalc(subscriptionId, 'initial', startDate) : await revenueService.getSubscriptionPlan({ subscriptionId });
        scenarios.push({ id: 'bundle_discount_ssp_realloc', label: 'Bundle Discount (SSP Allocation)', subscriptionId, subscriptionNumber, plan });
      }

      // D) Add seats mid-term (upsell)
      {
        const subscriptionNumber = 'DEMO-ASC606-UPSELL-ADD-SEATS';
        const subscriptionId = await getOrCreateSubscriptionByNumber(subscriptionNumber, async () => {
          const created = await subscriptionService.createSubscription({
            entityId: demoCustomer.id,
            subscriptionNumber,
            status: 'active',
            startDate,
            endDate,
            billingFrequency: 'monthly',
            renewalTermMonths: 12,
            contractValue: 12000,
            metadata: { demoTag, scenario: 'upsell_add_seats' },
            items: [
              {
                itemId: seatItem.id,
                quantity: 100,
                unitPrice: 120,
                startDate,
                endDate,
                metadata: {
                  revenueBehavior: 'over_time',
                  sspAmount: 120,
                  listPrice: 120,
                },
              },
            ],
          } as any);

          await revenueService.calculateRevenue(created.id, 'initial', startDate, { forceRecalculation: true });

          const effectiveDate = new Date('2026-04-01T00:00:00Z');
          await subscriptionService.amendSubscription({
            subscriptionId: created.id,
            effectiveDate,
            reason: 'Upsell: add 20 seats',
            changes: {
              contractValue: 14400,
              items: [
                {
                  itemId: seatItem.id,
                  quantity: 120,
                  unitPrice: 120,
                  startDate,
                  endDate,
                  metadata: {
                    revenueBehavior: 'over_time',
                    sspAmount: 120,
                    listPrice: 120,
                  },
                },
              ],
              metadata: { demoTag, scenario: 'upsell_add_seats', lastEvent: 'upsell' },
            } as any,
          });

          await revenueService.calculateRevenue(created.id, 'modification', effectiveDate, { forceRecalculation: true });
          return created.id;
        });

        const plan = forceRecalculate
          ? await recalc(subscriptionId, 'modification', new Date('2026-04-01T00:00:00Z'))
          : await revenueService.getSubscriptionPlan({ subscriptionId });
        scenarios.push({ id: 'upsell_add_seats', label: 'Upsell (Add Seats) Mid-Term', subscriptionId, subscriptionNumber, plan });
      }

      // E) Remove seats mid-term (downsell)
      {
        const subscriptionNumber = 'DEMO-ASC606-DOWNSELL-REMOVE-SEATS';
        const subscriptionId = await getOrCreateSubscriptionByNumber(subscriptionNumber, async () => {
          const created = await subscriptionService.createSubscription({
            entityId: demoCustomer.id,
            subscriptionNumber,
            status: 'active',
            startDate,
            endDate,
            billingFrequency: 'monthly',
            renewalTermMonths: 12,
            contractValue: 12000,
            metadata: { demoTag, scenario: 'downsell_remove_seats' },
            items: [
              {
                itemId: seatItem.id,
                quantity: 100,
                unitPrice: 120,
                startDate,
                endDate,
                metadata: {
                  revenueBehavior: 'over_time',
                  sspAmount: 120,
                  listPrice: 120,
                },
              },
            ],
          } as any);

          await revenueService.calculateRevenue(created.id, 'initial', startDate, { forceRecalculation: true });

          const effectiveDate = new Date('2026-07-01T00:00:00Z');
          await subscriptionService.amendSubscription({
            subscriptionId: created.id,
            effectiveDate,
            reason: 'Downsell: remove 30 seats',
            changes: {
              contractValue: 8400,
              items: [
                {
                  itemId: seatItem.id,
                  quantity: 70,
                  unitPrice: 120,
                  startDate,
                  endDate,
                  metadata: {
                    revenueBehavior: 'over_time',
                    sspAmount: 120,
                    listPrice: 120,
                  },
                },
              ],
              metadata: { demoTag, scenario: 'downsell_remove_seats', lastEvent: 'downsell' },
            } as any,
          });

          await revenueService.calculateRevenue(created.id, 'modification', effectiveDate, { forceRecalculation: true });
          return created.id;
        });

        const plan = forceRecalculate
          ? await recalc(subscriptionId, 'modification', new Date('2026-07-01T00:00:00Z'))
          : await revenueService.getSubscriptionPlan({ subscriptionId });
        scenarios.push({ id: 'downsell_remove_seats', label: 'Downsell (Remove Seats) Mid-Term', subscriptionId, subscriptionNumber, plan });
      }

      // F) Cancellation mid-term (prorated contract value through cancellation date)
      {
        const subscriptionNumber = 'DEMO-ASC606-CANCELLATION-MIDTERM';
        const subscriptionId = await getOrCreateSubscriptionByNumber(subscriptionNumber, async () => {
          const created = await subscriptionService.createSubscription({
            entityId: demoCustomer.id,
            subscriptionNumber,
            status: 'active',
            startDate,
            endDate,
            billingFrequency: 'monthly',
            renewalTermMonths: 12,
            contractValue: 12000,
            metadata: { demoTag, scenario: 'cancellation_midterm' },
            items: [
              {
                itemId: seatItem.id,
                quantity: 100,
                unitPrice: 120,
                startDate,
                endDate,
                metadata: {
                  revenueBehavior: 'over_time',
                  sspAmount: 120,
                  listPrice: 120,
                },
              },
            ],
          } as any);

          await revenueService.calculateRevenue(created.id, 'initial', startDate, { forceRecalculation: true });

          const cancellationDate = new Date('2026-06-30T00:00:00Z');
          // Reprice the contract to the earned portion (6 of 12 months).
          await subscriptionService.amendSubscription({
            subscriptionId: created.id,
            effectiveDate: cancellationDate,
            reason: 'Customer cancellation (prorated)',
            changes: {
              endDate: cancellationDate,
              contractValue: 6000,
              items: [
                {
                  itemId: seatItem.id,
                  quantity: 100,
                  unitPrice: 60, // 6/12 of $120 per seat
                  startDate,
                  endDate: cancellationDate,
                  metadata: {
                    revenueBehavior: 'over_time',
                    sspAmount: 120,
                    listPrice: 120,
                  },
                },
              ],
              metadata: { demoTag, scenario: 'cancellation_midterm', lastEvent: 'cancellation' },
            } as any,
          });

          await subscriptionService.cancelSubscription(created.id, cancellationDate, 'Cancelled at end of June');
          await revenueService.calculateRevenue(created.id, 'termination', cancellationDate, { forceRecalculation: true });
          return created.id;
        });

        const plan = forceRecalculate
          ? await recalc(subscriptionId, 'termination', new Date('2026-06-30T00:00:00Z'))
          : await revenueService.getSubscriptionPlan({ subscriptionId });
        scenarios.push({ id: 'cancellation_midterm', label: 'Cancellation Mid-Term (Prorated)', subscriptionId, subscriptionNumber, plan });
      }

      return {
        demoTag,
        customer: { id: demoCustomer.id, companyName: demoCustomer.companyName },
        items: {
          seat: { id: seatItem.id, itemCode: seatItem.itemCode, name: seatItem.name },
          implementation: { id: implItem.id, itemCode: implItem.itemCode, name: implItem.name },
        },
        scenarios,
      };
    }),

  listSoftwareDemoScenarios: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('list_asc606_software_demo', 'List seeded ASC 606 software demo scenarios', {
      scopes: ['revenue', 'subscriptions'],
      permissions: ['read:revenue', 'read:subscriptions'],
    }) })
    .query(async ({ ctx }) => {
      const organizationId = ctx.organizationId;
      type DemoScenarioRow = {
        id: string;
        subscriptionNumber: string;
        status: string;
        startDate: string;
        endDate: string | null;
        contractValue: string | null;
        billingFrequency: string | null;
        metadata: unknown;
        createdAt: Date | null;
      };

      const rows = await ctx.db.select({
        id: subscriptions.id,
        subscriptionNumber: subscriptions.subscriptionNumber,
        status: subscriptions.status,
        startDate: subscriptions.startDate,
        endDate: subscriptions.endDate,
        contractValue: subscriptions.contractValue,
        billingFrequency: subscriptions.billingFrequency,
        metadata: subscriptions.metadata,
        createdAt: subscriptions.createdAt,
      })
        .from(subscriptions)
        .where(and(
          eq(subscriptions.organizationId, organizationId),
          ilike(subscriptions.subscriptionNumber, 'DEMO-ASC606-%')
        ))
        .orderBy(desc(subscriptions.createdAt))
        .limit(50) as DemoScenarioRow[];

      return rows.map((row: DemoScenarioRow) => ({
        ...row,
        contractValue: row.contractValue ? Number(row.contractValue) : 0,
      }));
    }),
});
