# 606Ledger Integration Implementation Plan

## Overview
Integration of ASC 606 revenue recognition features into GLAPI using tRPC-first approach with REST API exposure.

## Architecture Principles
- **API-First Design**: Define OpenAPI spec first, implement tRPC routers, expose as REST
- **tRPC Pattern**: All business logic in tRPC routers, REST endpoints are thin wrappers
- **Type Safety**: End-to-end TypeScript with Zod validation
- **Incremental Migration**: Add features without disrupting existing functionality

## Phase 1: Foundation (Week 1-2)

### 1.1 Database Schema Extensions
```typescript
// New tables to add to packages/database/src/db/schema/

// subscriptions.ts
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  entityId: uuid("entity_id").references(() => entities.id).notNull(), // Customer
  subscriptionNumber: varchar("subscription_number", { length: 100 }).notNull(),
  status: subscriptionStatusEnum("status").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  contractValue: decimal("contract_value", { precision: 12, scale: 2 }),
  billingFrequency: billingFrequencyEnum("billing_frequency"),
  autoRenew: boolean("auto_renew").default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// subscription_items.ts
export const subscriptionItems = pgTable("subscription_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id).notNull(),
  itemId: uuid("item_id").references(() => items.id).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 4 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 4 }).default("0"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  metadata: jsonb("metadata")
});

// sales_orders.ts
export const salesOrders = pgTable("sales_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  orderNumber: varchar("order_number", { length: 100 }).notNull(),
  entityId: uuid("entity_id").references(() => entities.id).notNull(),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id),
  orderDate: date("order_date").notNull(),
  orderType: orderTypeEnum("order_type"),
  status: orderStatusEnum("status").notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD"),
  metadata: jsonb("metadata")
});

// invoices.ts
export const invoices = pgTable("invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  invoiceNumber: varchar("invoice_number", { length: 100 }).notNull(),
  entityId: uuid("entity_id").references(() => entities.id).notNull(),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id),
  salesOrderId: uuid("sales_order_id").references(() => salesOrders.id),
  invoiceDate: date("invoice_date").notNull(),
  dueDate: date("due_date"),
  billingPeriodStart: date("billing_period_start"),
  billingPeriodEnd: date("billing_period_end"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  status: invoiceStatusEnum("status").notNull(),
  metadata: jsonb("metadata")
});

// invoice_line_items.ts
export const invoiceLineItems = pgTable("invoice_line_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceId: uuid("invoice_id").references(() => invoices.id).notNull(),
  subscriptionItemId: uuid("subscription_item_id").references(() => subscriptionItems.id),
  itemId: uuid("item_id").references(() => items.id),
  description: text("description"),
  quantity: decimal("quantity", { precision: 10, scale: 4 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull()
});

// payments.ts
export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  invoiceId: uuid("invoice_id").references(() => invoices.id),
  paymentDate: date("payment_date").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }),
  transactionReference: varchar("transaction_reference", { length: 255 }),
  status: paymentStatusEnum("status").notNull(),
  metadata: jsonb("metadata")
});

// kit_components.ts (for bundles)
export const kitComponents = pgTable("kit_components", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  parentItemId: uuid("parent_item_id").references(() => items.id).notNull(),
  componentItemId: uuid("component_item_id").references(() => items.id).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 4 }).default("1"),
  allocationPercentage: decimal("allocation_percentage", { precision: 5, scale: 4 }),
  isSeparatelyPriced: boolean("is_separately_priced").default(false)
});
```

### 1.2 Repository Layer
```typescript
// packages/database/src/repositories/

// subscription-repository.ts
export class SubscriptionRepository extends BaseRepository<typeof subscriptions> {
  async findWithItems(id: string) {
    return await this.db
      .select()
      .from(subscriptions)
      .leftJoin(subscriptionItems, eq(subscriptionItems.subscriptionId, subscriptions.id))
      .where(eq(subscriptions.id, id));
  }
  
  async calculateTotalValue(id: string) {
    // Calculate total contract value from items
  }
}

// Similar for: InvoiceRepository, PaymentRepository, SalesOrderRepository
```

## Phase 2: tRPC Router Implementation (Week 3-4)

### 2.1 tRPC Router Structure
```typescript
// packages/api-service/src/routers/

// subscription.router.ts
export const subscriptionRouter = router({
  list: protectedProcedure
    .input(z.object({
      entityId: z.string().uuid().optional(),
      status: z.enum(['draft', 'active', 'suspended', 'cancelled']).optional(),
      page: z.number().default(1),
      limit: z.number().default(50)
    }))
    .query(async ({ ctx, input }) => {
      return ctx.subscriptionService.list(input);
    }),
    
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.subscriptionService.getById(input.id);
    }),
    
  create: protectedProcedure
    .input(createSubscriptionSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.subscriptionService.create(input);
    }),
    
  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: updateSubscriptionSchema
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.subscriptionService.update(input.id, input.data);
    }),
    
  calculateRevenue: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      calculationType: z.enum(['initial', 'modification', 'renewal']),
      effectiveDate: z.date()
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.revenueCalculationEngine.calculate(input);
    }),
    
  getRevenueSchedule: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.revenueService.getSchedule(input.id);
    }),
    
  getRevenueComparison: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.revenueService.compareASC605vs606(input.id);
    })
});

// invoice.router.ts
export const invoiceRouter = router({
  list: protectedProcedure
    .input(listInvoicesSchema)
    .query(async ({ ctx, input }) => {
      return ctx.invoiceService.list(input);
    }),
    
  create: protectedProcedure
    .input(createInvoiceSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.invoiceService.create(input);
    }),
    
  send: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.invoiceService.send(input.id);
    }),
    
  void: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.invoiceService.void(input.id);
    })
});

// payment.router.ts
export const paymentRouter = router({
  create: protectedProcedure
    .input(createPaymentSchema)
    .mutation(async ({ ctx, input }) => {
      const payment = await ctx.paymentService.create(input);
      // Trigger revenue recognition if needed
      await ctx.revenueService.handlePayment(payment);
      return payment;
    }),
    
  refund: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      amount: z.number().positive()
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.paymentService.refund(input.id, input.amount);
    })
});

// revenue.router.ts
export const revenueRouter = router({
  schedules: protectedProcedure
    .input(z.object({
      startDate: z.date(),
      endDate: z.date(),
      entityId: z.string().uuid().optional()
    }))
    .query(async ({ ctx, input }) => {
      return ctx.revenueService.getSchedules(input);
    }),
    
  recognize: protectedProcedure
    .input(z.object({
      periodDate: z.date(),
      scheduleIds: z.array(z.string().uuid()).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.revenueService.recognizePeriod(input);
    }),
    
  reports: {
    summary: protectedProcedure
      .input(reportDateRangeSchema)
      .query(async ({ ctx, input }) => {
        return ctx.reportingService.revenueSummary(input);
      }),
      
    waterfall: protectedProcedure
      .input(reportDateRangeSchema)
      .query(async ({ ctx, input }) => {
        return ctx.reportingService.revenueWaterfall(input);
      }),
      
    deferredBalance: protectedProcedure
      .input(z.object({ asOfDate: z.date() }))
      .query(async ({ ctx, input }) => {
        return ctx.reportingService.deferredBalance(input.asOfDate);
      }),
      
    arr: protectedProcedure
      .query(async ({ ctx }) => {
        return ctx.reportingService.calculateARR();
      }),
      
    mrr: protectedProcedure
      .query(async ({ ctx }) => {
        return ctx.reportingService.calculateMRR();
      })
  }
});

// Combine into main app router
export const appRouter = router({
  // Existing routers
  customers: customerRouter,
  organizations: organizationRouter,
  
  // New 606Ledger routers
  subscriptions: subscriptionRouter,
  invoices: invoiceRouter,
  payments: paymentRouter,
  salesOrders: salesOrderRouter,
  revenue: revenueRouter
});
```

## Phase 3: REST API Exposure (Week 5)

### 3.1 REST Endpoint Mapping
```typescript
// apps/api/src/routes/v1/subscriptions.ts
import { Router } from 'express';
import { trpcClient } from '../../trpc-client';

const router = Router();

// GET /api/v1/subscriptions
router.get('/', async (req, res) => {
  try {
    const result = await trpcClient.subscriptions.list.query({
      entityId: req.query.entityId as string,
      status: req.query.status as any,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 50
    });
    res.json(result);
  } catch (error) {
    handleError(error, res);
  }
});

// GET /api/v1/subscriptions/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await trpcClient.subscriptions.get.query({ 
      id: req.params.id 
    });
    res.json(result);
  } catch (error) {
    handleError(error, res);
  }
});

// POST /api/v1/subscriptions
router.post('/', async (req, res) => {
  try {
    const result = await trpcClient.subscriptions.create.mutate(req.body);
    res.status(201).json(result);
  } catch (error) {
    handleError(error, res);
  }
});

// PUT /api/v1/subscriptions/:id
router.put('/:id', async (req, res) => {
  try {
    const result = await trpcClient.subscriptions.update.mutate({
      id: req.params.id,
      data: req.body
    });
    res.json(result);
  } catch (error) {
    handleError(error, res);
  }
});

// POST /api/v1/subscriptions/:id/calculate-revenue
router.post('/:id/calculate-revenue', async (req, res) => {
  try {
    const result = await trpcClient.subscriptions.calculateRevenue.mutate({
      id: req.params.id,
      calculationType: req.body.calculationType,
      effectiveDate: new Date(req.body.effectiveDate)
    });
    res.json(result);
  } catch (error) {
    handleError(error, res);
  }
});

// GET /api/v1/subscriptions/:id/revenue-schedule
router.get('/:id/revenue-schedule', async (req, res) => {
  try {
    const result = await trpcClient.subscriptions.getRevenueSchedule.query({
      id: req.params.id
    });
    res.json(result);
  } catch (error) {
    handleError(error, res);
  }
});

// GET /api/v1/subscriptions/:id/revenue-comparison
router.get('/:id/revenue-comparison', async (req, res) => {
  try {
    const result = await trpcClient.subscriptions.getRevenueComparison.query({
      id: req.params.id
    });
    res.json(result);
  } catch (error) {
    handleError(error, res);
  }
});

export default router;
```

### 3.2 OpenAPI Specification
```yaml
# apps/api/openapi/subscriptions.yaml
/subscriptions:
  get:
    summary: List subscriptions
    parameters:
      - name: entityId
        in: query
        schema:
          type: string
          format: uuid
      - name: status
        in: query
        schema:
          type: string
          enum: [draft, active, suspended, cancelled]
      - name: page
        in: query
        schema:
          type: integer
          default: 1
      - name: limit
        in: query
        schema:
          type: integer
          default: 50
    responses:
      200:
        description: List of subscriptions
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: array
                  items:
                    $ref: '#/components/schemas/Subscription'
                pagination:
                  $ref: '#/components/schemas/Pagination'
  
  post:
    summary: Create subscription
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/CreateSubscription'
    responses:
      201:
        description: Created subscription
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Subscription'

/subscriptions/{id}/calculate-revenue:
  post:
    summary: Calculate revenue recognition
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              calculationType:
                type: string
                enum: [initial, modification, renewal]
              effectiveDate:
                type: string
                format: date
    responses:
      200:
        description: Revenue calculation result
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RevenueCalculation'
```

## Phase 4: Revenue Calculation Engine (Week 6-7)

### 4.1 Core Calculation Service
```typescript
// packages/business/src/services/revenue-calculation-engine.ts

export class RevenueCalculationEngine {
  constructor(
    private db: Database,
    private performanceObligationService: PerformanceObligationService,
    private sspService: SSPService
  ) {}

  async calculate(params: {
    subscriptionId: string;
    calculationType: 'initial' | 'modification' | 'renewal';
    effectiveDate: Date;
  }) {
    // Step 1: Identify the contract
    const subscription = await this.getSubscriptionWithItems(params.subscriptionId);
    
    // Step 2: Identify performance obligations
    const obligations = await this.identifyPerformanceObligations(subscription);
    
    // Step 3: Determine transaction price
    const transactionPrice = this.calculateTransactionPrice(subscription);
    
    // Step 4: Allocate price to performance obligations
    const allocations = await this.allocatePrice(obligations, transactionPrice);
    
    // Step 5: Generate revenue schedules
    const schedules = await this.generateSchedules(allocations, subscription);
    
    // Step 6: Save to database
    await this.saveSchedules(schedules);
    
    return {
      subscriptionId: params.subscriptionId,
      transactionPrice,
      obligations,
      allocations,
      schedules
    };
  }

  private async identifyPerformanceObligations(subscription: Subscription) {
    const obligations = [];
    
    for (const item of subscription.items) {
      if (item.itemType === 'kit') {
        // Explode kit into components
        const components = await this.getKitComponents(item.id);
        for (const component of components) {
          obligations.push({
            itemId: component.componentItemId,
            obligationType: await this.determineObligationType(component),
            allocationMethod: component.allocationPercentage ? 'specified' : 'ssp'
          });
        }
      } else {
        obligations.push({
          itemId: item.id,
          obligationType: await this.determineObligationType(item),
          allocationMethod: 'ssp'
        });
      }
    }
    
    return obligations;
  }

  private async allocatePrice(obligations: any[], transactionPrice: number) {
    const sspValues = await this.sspService.getSSPValues(
      obligations.map(o => o.itemId)
    );
    
    const totalSSP = sspValues.reduce((sum, ssp) => sum + ssp.value, 0);
    
    return obligations.map(obligation => ({
      ...obligation,
      allocatedAmount: (sspValues.find(s => s.itemId === obligation.itemId).value / totalSSP) * transactionPrice
    }));
  }

  private async generateSchedules(allocations: any[], subscription: Subscription) {
    const schedules = [];
    
    for (const allocation of allocations) {
      if (allocation.obligationType === 'point_in_time') {
        // Recognize immediately
        schedules.push({
          performanceObligationId: allocation.id,
          scheduleDate: subscription.startDate,
          scheduledAmount: allocation.allocatedAmount,
          recognitionPattern: 'immediate'
        });
      } else {
        // Recognize over time
        const monthlyAmount = allocation.allocatedAmount / subscription.termMonths;
        for (let month = 0; month < subscription.termMonths; month++) {
          schedules.push({
            performanceObligationId: allocation.id,
            scheduleDate: addMonths(subscription.startDate, month),
            scheduledAmount: monthlyAmount,
            recognitionPattern: 'straight_line'
          });
        }
      }
    }
    
    return schedules;
  }
}
```

### 4.2 Kit/Bundle Processing
```typescript
// packages/business/src/services/kit-service.ts

export class KitService {
  async explodeKit(kitItemId: string): Promise<KitComponent[]> {
    const components = await this.db
      .select()
      .from(kitComponents)
      .where(eq(kitComponents.parentItemId, kitItemId));
    
    return components.map(component => ({
      ...component,
      effectivePrice: this.calculateComponentPrice(component)
    }));
  }

  private calculateComponentPrice(component: KitComponent) {
    if (component.isSeparatelyPriced) {
      return component.price;
    }
    
    if (component.allocationPercentage) {
      return parentPrice * component.allocationPercentage;
    }
    
    // Use SSP-based allocation
    return this.sspService.getSSP(component.componentItemId);
  }
}
```

## Phase 5: Testing & Migration (Week 8)

### 5.1 Testing Strategy
```typescript
// packages/api-service/src/routers/__tests__/subscription.test.ts
describe('Subscription Router', () => {
  it('should create subscription with proper revenue calculation', async () => {
    const subscription = await trpc.subscriptions.create.mutate({
      entityId: 'customer-123',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      items: [{
        itemId: 'item-001',
        quantity: 1,
        unitPrice: 1200
      }]
    });
    
    expect(subscription).toBeDefined();
    expect(subscription.contractValue).toBe(1200);
    
    // Verify revenue calculation
    const schedule = await trpc.subscriptions.getRevenueSchedule.query({
      id: subscription.id
    });
    
    expect(schedule.periods).toHaveLength(12);
    expect(schedule.periods[0].amount).toBe(100);
  });
});
```

### 5.2 Data Migration Scripts
```sql
-- Migrate existing contracts to subscriptions
INSERT INTO subscriptions (
  id,
  organization_id,
  entity_id,
  subscription_number,
  status,
  start_date,
  end_date,
  contract_value
)
SELECT
  id,
  organization_id,
  entity_id,
  contract_number,
  CASE contract_status
    WHEN 'signed' THEN 'active'
    WHEN 'terminated' THEN 'cancelled'
    ELSE contract_status
  END,
  effective_date,
  effective_date + INTERVAL '1 year',
  contract_value
FROM contracts;

-- Link existing performance obligations to subscription items
INSERT INTO subscription_items (
  subscription_id,
  item_id,
  quantity,
  unit_price,
  start_date,
  end_date
)
SELECT DISTINCT
  c.id,
  cli.item_id,
  cli.quantity,
  cli.unit_price,
  c.effective_date,
  c.effective_date + INTERVAL '1 year'
FROM contracts c
JOIN contract_line_items cli ON cli.contract_id = c.id;
```

## Phase 6: Documentation & API First Approach (Ongoing)

### 6.1 API Documentation Structure
```
docs/api/
├── openapi.yaml          # Main OpenAPI spec
├── schemas/
│   ├── subscription.yaml
│   ├── invoice.yaml
│   ├── payment.yaml
│   └── revenue.yaml
├── examples/
│   ├── create-subscription.json
│   ├── calculate-revenue.json
│   └── revenue-comparison.json
└── postman/
    └── 606Ledger.postman_collection.json
```

### 6.2 Developer Guide
```markdown
# 606Ledger API Developer Guide

## Quick Start

### 1. Create a Subscription
POST /api/v1/subscriptions

### 2. Calculate Revenue
POST /api/v1/subscriptions/{id}/calculate-revenue

### 3. Generate Invoice
POST /api/v1/invoices

### 4. Record Payment
POST /api/v1/payments

### 5. Recognize Revenue
POST /api/v1/revenue/recognize
```

## Implementation Timeline

| Phase | Duration | Deliverables |
|-------|----------|-------------|
| Phase 1: Foundation | 2 weeks | Database schemas, migrations, repositories |
| Phase 2: tRPC Routers | 2 weeks | All business logic in tRPC routers |
| Phase 3: REST API | 1 week | REST endpoints wrapping tRPC |
| Phase 4: Revenue Engine | 2 weeks | ASC 606 calculation engine |
| Phase 5: Testing | 1 week | Unit tests, integration tests, migration |
| Phase 6: Documentation | Ongoing | API docs, developer guides |

**Total: 8 weeks**

## Success Metrics
- All endpoints have < 200ms p95 latency
- 100% type safety from database to API
- Zero breaking changes to existing GLAPI functionality
- Complete API documentation with examples
- 80%+ test coverage on new code

## Next Steps
1. Review and approve implementation plan
2. Create feature branch: `feature/606ledger-integration`
3. Set up database migrations
4. Begin Phase 1 implementation