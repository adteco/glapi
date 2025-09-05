# TASK-005: Subscription tRPC Router Implementation

## Description
Create comprehensive tRPC router for subscription management following the established patterns in the codebase. Implement full CRUD operations, business logic, and validation.

## Acceptance Criteria
- [ ] Subscription tRPC router with all CRUD operations
- [ ] Input/output validation with Zod schemas  
- [ ] Subscription service class with business logic
- [ ] Revenue calculation integration endpoints
- [ ] Subscription lifecycle management (draft → active → cancelled)
- [ ] Error handling and appropriate HTTP status codes
- [ ] Unit tests for all router procedures
- [ ] Integration tests with database
- [ ] Type safety end-to-end

## Dependencies
- TASK-001: Subscription database schema
- TASK-003: Revenue recognition schema (for calculation endpoints)

## Estimated Effort
2 days

## Technical Implementation

### tRPC Router Structure
```typescript
// packages/trpc/src/routers/subscriptions.ts
import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { SubscriptionService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';

// Zod Schemas
const subscriptionSchema = z.object({
  entityId: z.string().uuid(),
  subscriptionNumber: z.string().min(1).optional(),
  status: z.enum(['draft', 'active', 'suspended', 'cancelled']).default('draft'),
  startDate: z.date(),
  endDate: z.date().optional(),
  contractValue: z.number().positive().optional(),
  billingFrequency: z.enum(['monthly', 'quarterly', 'annual']).optional(),
  autoRenew: z.boolean().default(false),
  items: z.array(z.object({
    itemId: z.string().uuid(),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
    discountPercentage: z.number().min(0).max(1).default(0),
    startDate: z.date(),
    endDate: z.date().optional()
  })).min(1)
});

export const subscriptionsRouter = router({
  // List subscriptions with filtering
  list: authenticatedProcedure
    .input(z.object({
      entityId: z.string().uuid().optional(),
      status: z.enum(['draft', 'active', 'suspended', 'cancelled']).optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50)
    }).optional())
    .query(async ({ ctx, input = {} }) => {
      const service = new SubscriptionService(ctx.serviceContext);
      return service.listSubscriptions(input);
    }),

  // Get single subscription with items
  get: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.serviceContext);
      const subscription = await service.getSubscriptionById(input.id);
      
      if (!subscription) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Subscription not found'
        });
      }
      
      return subscription;
    }),

  // Create subscription with items
  create: authenticatedProcedure
    .input(subscriptionSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.serviceContext);
      return service.createSubscription({
        ...input,
        organizationId: ctx.organizationId
      });
    }),

  // Update subscription
  update: authenticatedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: subscriptionSchema.partial()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.serviceContext);
      const updated = await service.updateSubscription(input.id, input.data);
      
      if (!updated) {
        throw new TRPCError({
          code: 'NOT_FOUND', 
          message: 'Subscription not found'
        });
      }
      
      return updated;
    }),

  // Activate subscription
  activate: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.serviceContext);
      return service.activateSubscription(input.id);
    }),

  // Cancel subscription  
  cancel: authenticatedProcedure
    .input(z.object({
      id: z.string().uuid(),
      cancellationDate: z.date(),
      reason: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.serviceContext);
      return service.cancelSubscription(input.id, input.cancellationDate, input.reason);
    }),

  // Calculate revenue recognition
  calculateRevenue: authenticatedProcedure
    .input(z.object({
      id: z.string().uuid(),
      calculationType: z.enum(['initial', 'modification', 'renewal']),
      effectiveDate: z.date()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.serviceContext);
      return service.calculateRevenue(input.id, input.calculationType, input.effectiveDate);
    }),

  // Get revenue schedule
  getRevenueSchedule: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.serviceContext);
      return service.getRevenueSchedule(input.id);
    })
});
```

### Service Class Implementation
```typescript
// packages/api-service/src/services/subscription-service.ts
export class SubscriptionService {
  constructor(private serviceContext: ServiceContext) {}

  async createSubscription(data: CreateSubscriptionData) {
    // 1. Validate entity exists
    // 2. Generate subscription number if not provided
    // 3. Create subscription record
    // 4. Create subscription items
    // 5. Return with relationships
  }

  async activateSubscription(subscriptionId: string) {
    // 1. Validate subscription exists and is in draft
    // 2. Validate all required fields present
    // 3. Update status to active
    // 4. Trigger revenue calculation
    // 5. Return updated subscription
  }

  async calculateRevenue(subscriptionId: string, type: string, effectiveDate: Date) {
    // 1. Get subscription with items
    // 2. Call revenue calculation engine
    // 3. Create/update performance obligations
    // 4. Generate revenue schedules
    // 5. Return calculation results
  }
}
```

### Test Requirements

#### Unit Tests - Router
```typescript
describe('Subscriptions Router', () => {
  describe('list', () => {
    it('should return paginated subscriptions', async () => {
      // Test pagination works correctly
    });
    
    it('should filter by entityId when provided', async () => {
      // Test filtering works
    });
    
    it('should filter by status when provided', async () => {
      // Test status filtering
    });
  });

  describe('create', () => {
    it('should create subscription with valid data', async () => {
      // Test successful creation
    });
    
    it('should validate required fields', async () => {
      // Test validation errors
    });
    
    it('should validate date ranges', async () => {
      // Test start date before end date
    });
    
    it('should validate items array not empty', async () => {
      // Test business rule validation
    });
  });

  describe('activate', () => {
    it('should activate draft subscription', async () => {
      // Test status transition
    });
    
    it('should fail if subscription already active', async () => {
      // Test invalid state transition
    });
  });
});
```

#### Integration Tests - Service
```typescript
describe('Subscription Service Integration', () => {
  it('should create subscription with database persistence', async () => {
    // Test end-to-end creation with database
  });
  
  it('should handle revenue calculation integration', async () => {
    // Test calculation engine integration
  });
});
```

### Error Handling
```typescript
// Common error scenarios to handle:
- Subscription not found (404)
- Validation errors (400) 
- Entity not found (400)
- Invalid state transitions (400)
- Database constraint violations (500)
- Revenue calculation failures (500)
```

### Files to Create
- `packages/trpc/src/routers/subscriptions.ts`
- `packages/api-service/src/services/subscription-service.ts`
- `packages/api-service/src/types/subscription-types.ts`
- `packages/trpc/src/routers/__tests__/subscriptions.test.ts`
- `packages/api-service/src/services/__tests__/subscription-service.test.ts`

### Definition of Done
- [ ] All router procedures implemented and tested
- [ ] Service class handles business logic correctly
- [ ] Validation schemas prevent invalid data
- [ ] Error handling provides meaningful messages
- [ ] Integration with revenue calculation works
- [ ] Type safety maintained throughout
- [ ] Performance acceptable for expected load
- [ ] Follows existing codebase patterns