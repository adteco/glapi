# TASK-007: Revenue Recognition tRPC Router

## Description
Implement the core revenue recognition tRPC router that handles ASC 606 calculations, revenue schedules, and reporting. This is the heart of the 606Ledger system.

## Acceptance Criteria
- [ ] Revenue tRPC router with calculation endpoints
- [ ] Revenue schedule management procedures
- [ ] SSP (Standalone Selling Price) management endpoints
- [ ] Revenue recognition processing endpoints
- [ ] Revenue reporting procedures (ARR, MRR, deferred balance)
- [ ] Performance obligation management
- [ ] Comprehensive validation for ASC 606 rules
- [ ] Unit and integration tests for all procedures
- [ ] Error handling for complex calculations

## Dependencies
- TASK-003: Revenue recognition database schema
- TASK-005: Subscription tRPC router

## Estimated Effort
3 days

## Technical Implementation

### Revenue tRPC Router
```typescript
// packages/trpc/src/routers/revenue.ts
import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { RevenueService, SSPService } from '@glapi/api-service';

export const revenueRouter = router({
  // Calculate revenue for subscription
  calculate: authenticatedProcedure
    .input(z.object({
      subscriptionId: z.string().uuid(),
      calculationType: z.enum(['initial', 'modification', 'renewal', 'termination']),
      effectiveDate: z.date(),
      options: z.object({
        forceRecalculation: z.boolean().default(false),
        includeHistorical: z.boolean().default(false)
      }).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new RevenueService(ctx.serviceContext);
      return service.calculateRevenue(
        input.subscriptionId,
        input.calculationType,
        input.effectiveDate,
        input.options
      );
    }),

  // Get revenue schedules
  schedules: router({
    // List schedules with filtering
    list: authenticatedProcedure
      .input(z.object({
        subscriptionId: z.string().uuid().optional(),
        performanceObligationId: z.string().uuid().optional(),
        status: z.enum(['scheduled', 'recognized', 'deferred']).optional(),
        periodStart: z.date().optional(),
        periodEnd: z.date().optional(),
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
        return service.getRevenueScheduleById(input.id);
      }),

    // Update schedule (for adjustments)
    update: authenticatedProcedure
      .input(z.object({
        id: z.string().uuid(),
        data: z.object({
          scheduledAmount: z.number().positive().optional(),
          recognitionDate: z.date().optional(),
          status: z.enum(['scheduled', 'recognized', 'deferred']).optional()
        })
      }))
      .mutation(async ({ ctx, input }) => {
        const service = new RevenueService(ctx.serviceContext);
        return service.updateRevenueSchedule(input.id, input.data);
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
        return service.getPerformanceObligationById(input.id);
      }),

    // Mark obligation as satisfied
    satisfy: authenticatedProcedure
      .input(z.object({
        id: z.string().uuid(),
        satisfactionDate: z.date(),
        satisfactionEvidence: z.string().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        const service = new RevenueService(ctx.serviceContext);
        return service.satisfyPerformanceObligation(
          input.id,
          input.satisfactionDate,
          input.satisfactionEvidence
        );
      })
  }),

  // Revenue recognition processing
  recognize: authenticatedProcedure
    .input(z.object({
      periodDate: z.date(),
      scheduleIds: z.array(z.string().uuid()).optional(),
      dryRun: z.boolean().default(false)
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new RevenueService(ctx.serviceContext);
      return service.recognizeRevenue(
        input.periodDate,
        input.scheduleIds,
        input.dryRun
      );
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
        evidenceDate: z.date(),
        sspAmount: z.number().positive(),
        currency: z.string().length(3).default('USD'),
        evidenceSource: z.string().optional(),
        confidenceLevel: z.enum(['high', 'medium', 'low'])
      }))
      .mutation(async ({ ctx, input }) => {
        const service = new SSPService(ctx.serviceContext);
        return service.createSSPEvidence({
          ...input,
          organizationId: ctx.organizationId
        });
      }),

    // Get current SSP for item
    current: authenticatedProcedure
      .input(z.object({ itemId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const service = new SSPService(ctx.serviceContext);
        return service.getCurrentSSP(input.itemId);
      })
  }),

  // Revenue reports
  reports: router({
    // Revenue summary report
    summary: authenticatedProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
        groupBy: z.enum(['month', 'quarter', 'year']).default('month'),
        entityId: z.string().uuid().optional()
      }))
      .query(async ({ ctx, input }) => {
        const service = new RevenueService(ctx.serviceContext);
        return service.getRevenueSummary(input);
      }),

    // Deferred revenue balance
    deferredBalance: authenticatedProcedure
      .input(z.object({
        asOfDate: z.date().optional()
      }).optional())
      .query(async ({ ctx, input = {} }) => {
        const service = new RevenueService(ctx.serviceContext);
        return service.getDeferredBalance(input.asOfDate || new Date());
      }),

    // ARR calculation
    arr: authenticatedProcedure
      .input(z.object({
        asOfDate: z.date().optional(),
        entityId: z.string().uuid().optional()
      }).optional())
      .query(async ({ ctx, input = {} }) => {
        const service = new RevenueService(ctx.serviceContext);
        return service.calculateARR(input.asOfDate, input.entityId);
      }),

    // MRR calculation
    mrr: authenticatedProcedure
      .input(z.object({
        forMonth: z.date().optional(),
        entityId: z.string().uuid().optional()
      }).optional())
      .query(async ({ ctx, input = {} }) => {
        const service = new RevenueService(ctx.serviceContext);
        return service.calculateMRR(input.forMonth, input.entityId);
      }),

    // Revenue waterfall analysis
    waterfall: authenticatedProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
        compareToASC605: z.boolean().default(false)
      }))
      .query(async ({ ctx, input }) => {
        const service = new RevenueService(ctx.serviceContext);
        return service.getRevenueWaterfall(input);
      })
  }),

  // ASC 605 vs 606 comparison
  comparison: authenticatedProcedure
    .input(z.object({
      subscriptionId: z.string().uuid(),
      comparisonDate: z.date().optional()
    }))
    .query(async ({ ctx, input }) => {
      const service = new RevenueService(ctx.serviceContext);
      return service.compareASC605vs606(input.subscriptionId, input.comparisonDate);
    })
});
```

### Service Classes Key Methods
```typescript
// Revenue Service
export class RevenueService {
  async calculateRevenue(subscriptionId: string, type: string, effectiveDate: Date) {
    // ASC 606 5-step process:
    // 1. Identify the contract (subscription)
    // 2. Identify performance obligations
    // 3. Determine transaction price
    // 4. Allocate price to performance obligations
    // 5. Recognize revenue when obligations satisfied
  }

  async recognizeRevenue(periodDate: Date, scheduleIds?: string[], dryRun = false) {
    // 1. Get all scheduled revenue for period
    // 2. Validate satisfaction criteria met
    // 3. Create journal entries
    // 4. Update schedule status
    // 5. Return recognition summary
  }

  async satisfyPerformanceObligation(id: string, date: Date, evidence?: string) {
    // 1. Validate obligation exists and active
    // 2. Mark as satisfied
    // 3. Trigger immediate recognition if point-in-time
    // 4. Update related schedules
  }
}

// SSP Service
export class SSPService {
  async getCurrentSSP(itemId: string) {
    // 1. Get all active SSP evidence for item
    // 2. Apply hierarchy (standalone sale > competitor > cost+ > market)
    // 3. Consider confidence levels
    // 4. Return best available SSP with confidence
  }

  async createSSPEvidence(data: CreateSSPData) {
    // 1. Validate item exists
    // 2. Create evidence record
    // 3. Update SSP calculations for affected contracts
    // 4. Return created evidence
  }
}
```

### Test Requirements

#### Unit Tests
```typescript
describe('Revenue Router', () => {
  describe('calculate', () => {
    it('should perform initial revenue calculation', async () => {
      // Test 5-step ASC 606 process
    });
    
    it('should handle contract modifications', async () => {
      // Test modification scenarios
    });
    
    it('should validate effective dates', async () => {
      // Test date validation
    });
  });

  describe('recognize', () => {
    it('should recognize scheduled revenue for period', async () => {
      // Test revenue recognition process
    });
    
    it('should handle dry run mode', async () => {
      // Test preview functionality
    });
  });

  describe('reports', () => {
    it('should calculate ARR correctly', async () => {
      // Test ARR calculation
    });
    
    it('should generate revenue waterfall', async () => {
      // Test waterfall analysis
    });
  });
});
```

#### Integration Tests
```typescript
describe('Revenue Recognition Integration', () => {
  it('should handle complete revenue lifecycle', async () => {
    // 1. Create subscription
    // 2. Calculate revenue
    // 3. Generate schedules
    // 4. Recognize revenue
    // 5. Verify journal entries
  });
});
```

### Files to Create
- `packages/trpc/src/routers/revenue.ts`
- `packages/api-service/src/services/revenue-service.ts`
- `packages/api-service/src/services/ssp-service.ts`
- `packages/api-service/src/services/revenue-calculation-engine.ts`
- `packages/api-service/src/types/revenue-types.ts`
- Test files for all services and router

### Definition of Done
- [ ] All revenue calculation procedures work correctly
- [ ] SSP management handles all evidence types
- [ ] Revenue recognition processes schedules accurately
- [ ] Reporting endpoints return correct metrics
- [ ] Error handling covers calculation failures
- [ ] Performance acceptable for large datasets
- [ ] ASC 606 compliance verified
- [ ] Integration tests validate end-to-end workflows