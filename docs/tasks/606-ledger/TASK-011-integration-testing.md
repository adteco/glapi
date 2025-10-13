# TASK-011: Comprehensive Integration Testing

## Description
Implement comprehensive integration tests that validate the entire 606Ledger system end-to-end, including database interactions, tRPC router integration, revenue calculation workflows, and reporting accuracy.

## Acceptance Criteria
- [ ] End-to-end workflow tests (subscription → revenue → reporting)
- [ ] Database integration tests with real transactions
- [ ] tRPC router integration tests with authentication
- [ ] Revenue calculation engine integration tests
- [ ] API endpoint integration tests with proper error handling
- [ ] Performance tests for large datasets
- [ ] Data consistency validation tests
- [ ] Cross-service communication tests
- [ ] Test data generation and cleanup utilities
- [ ] CI/CD integration test pipeline

## Dependencies
- All previous tasks (TASK-001 through TASK-010)

## Estimated Effort
3 days

## Technical Implementation

### Test Structure
```
packages/
├── integration-tests/
│   ├── __tests__/
│   │   ├── subscription-workflow.test.ts
│   │   ├── revenue-calculation.test.ts
│   │   ├── invoice-payment.test.ts
│   │   ├── reporting-engine.test.ts
│   │   ├── api-endpoints.test.ts
│   │   └── performance.test.ts
│   ├── fixtures/
│   │   ├── subscription-data.ts
│   │   ├── item-catalog.ts
│   │   └── organization-setup.ts
│   ├── helpers/
│   │   ├── test-database.ts
│   │   ├── test-data-generator.ts
│   │   └── assertion-helpers.ts
│   └── utils/
│       ├── cleanup.ts
│       └── performance-monitor.ts
```

### End-to-End Workflow Tests
```typescript
// packages/integration-tests/__tests__/subscription-workflow.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestDatabase } from '../helpers/test-database';
import { TestDataGenerator } from '../helpers/test-data-generator';
import { trpcClient } from '../helpers/trpc-test-client';

describe('Complete Subscription Revenue Workflow', () => {
  let testDb: TestDatabase;
  let dataGenerator: TestDataGenerator;
  let organizationId: string;
  let customerId: string;
  let subscriptionId: string;

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.setup();
    
    dataGenerator = new TestDataGenerator(testDb.db);
    
    // Create test organization and customer
    const organization = await dataGenerator.createOrganization();
    const customer = await dataGenerator.createCustomer(organization.id);
    
    organizationId = organization.id;
    customerId = customer.id;
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  it('should handle complete subscription lifecycle', async () => {
    // Step 1: Create subscription with multiple items
    const subscriptionData = {
      entityId: customerId,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      items: [
        {
          itemId: await dataGenerator.createSoftwareLicenseItem(organizationId),
          quantity: 1,
          unitPrice: 12000 // $12K annual license
        },
        {
          itemId: await dataGenerator.createMaintenanceItem(organizationId),
          quantity: 1,
          unitPrice: 2400 // $2.4K annual maintenance
        }
      ]
    };

    const subscription = await trpcClient.subscriptions.create.mutate(subscriptionData);
    subscriptionId = subscription.id;

    expect(subscription.status).toBe('draft');
    expect(subscription.contractValue).toBe(14400);

    // Step 2: Calculate revenue recognition
    const revenueCalculation = await trpcClient.subscriptions.calculateRevenue.mutate({
      id: subscriptionId,
      calculationType: 'initial',
      effectiveDate: new Date('2024-01-01')
    });

    expect(revenueCalculation.performanceObligations).toHaveLength(2);
    expect(revenueCalculation.transactionPrice).toBe(14400);

    // Verify performance obligations
    const licenseObligation = revenueCalculation.performanceObligations.find(
      po => po.obligationType === 'product_license'
    );
    const maintenanceObligation = revenueCalculation.performanceObligations.find(
      po => po.obligationType === 'maintenance_support'
    );

    expect(licenseObligation?.satisfactionMethod).toBe('point_in_time');
    expect(maintenanceObligation?.satisfactionMethod).toBe('over_time');

    // Step 3: Activate subscription
    const activatedSubscription = await trpcClient.subscriptions.activate.mutate({
      id: subscriptionId
    });

    expect(activatedSubscription.status).toBe('active');

    // Step 4: Get revenue schedule
    const revenueSchedule = await trpcClient.subscriptions.getRevenueSchedule.query({
      id: subscriptionId
    });

    expect(revenueSchedule.schedules).toBeDefined();
    expect(revenueSchedule.schedules.length).toBeGreaterThan(0);

    // License should have immediate recognition
    const licenseSchedules = revenueSchedule.schedules.filter(
      s => s.performanceObligation.obligationType === 'product_license'
    );
    expect(licenseSchedules.some(s => s.recognitionPattern === 'immediate')).toBe(true);

    // Maintenance should have monthly recognition
    const maintenanceSchedules = revenueSchedule.schedules.filter(
      s => s.performanceObligation.obligationType === 'maintenance_support'
    );
    expect(maintenanceSchedules).toHaveLength(12); // Monthly over 12 months

    // Step 5: Generate and send invoice
    const invoice = await trpcClient.invoices.generateFromSubscription.mutate({
      subscriptionId,
      billingPeriodStart: new Date('2024-01-01'),
      billingPeriodEnd: new Date('2024-01-31'),
      invoiceDate: new Date('2024-01-01')
    });

    expect(invoice.totalAmount).toBe(12200); // License + 1 month maintenance
    expect(invoice.lineItems).toHaveLength(2);

    const sentInvoice = await trpcClient.invoices.send.mutate({
      id: invoice.id
    });

    expect(sentInvoice.status).toBe('sent');

    // Step 6: Record payment
    const payment = await trpcClient.payments.create.mutate({
      invoiceId: invoice.id,
      paymentDate: new Date('2024-01-15'),
      amount: invoice.totalAmount,
      paymentMethod: 'bank_transfer'
    });

    expect(payment.status).toBe('completed');

    // Step 7: Verify revenue recognition
    const recognitionResult = await trpcClient.revenue.recognize.mutate({
      periodDate: new Date('2024-01-31')
    });

    expect(recognitionResult.totalRecognized).toBeGreaterThan(0);

    // Step 8: Generate reports
    const arrReport = await trpcClient.revenue.reports.arr.query({
      asOfDate: new Date('2024-01-31')
    });

    expect(arrReport.totalARR).toBe(14400);

    const deferredBalance = await trpcClient.revenue.reports.deferredBalance.query({
      asOfDate: new Date('2024-01-31')
    });

    expect(deferredBalance.totalDeferred).toBeGreaterThan(0);
  });

  it('should handle contract modifications correctly', async () => {
    // Test subscription modification workflow
    const modificationData = {
      id: subscriptionId,
      data: {
        items: [
          {
            itemId: await dataGenerator.createSoftwareLicenseItem(organizationId),
            quantity: 2, // Increased quantity
            unitPrice: 12000
          }
        ]
      }
    };

    const modifiedSubscription = await trpcClient.subscriptions.update.mutate(modificationData);

    // Recalculate revenue
    const revenueRecalculation = await trpcClient.subscriptions.calculateRevenue.mutate({
      id: subscriptionId,
      calculationType: 'modification',
      effectiveDate: new Date('2024-06-01')
    });

    expect(revenueRecalculation.transactionPrice).toBeGreaterThan(14400);
  });

  it('should handle kit/bundle items correctly', async () => {
    // Create kit item with components
    const kitItemId = await dataGenerator.createKitItem(organizationId, [
      { componentItemId: await dataGenerator.createSoftwareLicenseItem(organizationId), quantity: 1, allocationPercentage: 0.8 },
      { componentItemId: await dataGenerator.createMaintenanceItem(organizationId), quantity: 1, allocationPercentage: 0.2 }
    ]);

    const subscriptionWithKit = await trpcClient.subscriptions.create.mutate({
      entityId: customerId,
      startDate: new Date('2024-01-01'),
      items: [
        {
          itemId: kitItemId,
          quantity: 1,
          unitPrice: 15000
        }
      ]
    });

    const kitRevenueCalculation = await trpcClient.subscriptions.calculateRevenue.mutate({
      id: subscriptionWithKit.id,
      calculationType: 'initial',
      effectiveDate: new Date('2024-01-01')
    });

    // Should explode kit into separate performance obligations
    expect(kitRevenueCalculation.performanceObligations.length).toBeGreaterThan(1);
    
    // Verify allocation based on percentages
    const totalAllocated = kitRevenueCalculation.allocations.reduce((sum, alloc) => sum + alloc.allocatedAmount, 0);
    expect(totalAllocated).toBeCloseTo(15000, 2);
  });
});
```

### Performance Tests
```typescript
// packages/integration-tests/__tests__/performance.test.ts
describe('Performance Tests', () => {
  it('should handle large subscription with many line items', async () => {
    const startTime = Date.now();
    
    // Create subscription with 100 line items
    const manyItemsSubscription = await createLargeSubscription(100);
    
    const calculationStartTime = Date.now();
    
    // Calculate revenue
    await trpcClient.subscriptions.calculateRevenue.mutate({
      id: manyItemsSubscription.id,
      calculationType: 'initial',
      effectiveDate: new Date('2024-01-01')
    });
    
    const calculationTime = Date.now() - calculationStartTime;
    const totalTime = Date.now() - startTime;
    
    // Performance expectations
    expect(calculationTime).toBeLessThan(2000); // < 2 seconds for calculation
    expect(totalTime).toBeLessThan(5000); // < 5 seconds total
  });

  it('should handle high volume revenue recognition', async () => {
    // Create 1000 revenue schedules
    const schedules = await dataGenerator.createManyRevenueSchedules(1000);
    
    const startTime = Date.now();
    
    // Process recognition for the period
    const result = await trpcClient.revenue.recognize.mutate({
      periodDate: new Date('2024-01-31')
    });
    
    const processingTime = Date.now() - startTime;
    
    expect(processingTime).toBeLessThan(3000); // < 3 seconds
    expect(result.processedSchedules).toBeGreaterThan(0);
  });

  it('should generate reports efficiently with large datasets', async () => {
    // Create test data with 500 subscriptions
    await dataGenerator.createManySubscriptions(500);
    
    const startTime = Date.now();
    
    // Generate ARR report
    const arrReport = await trpcClient.revenue.reports.arr.query();
    
    const reportTime = Date.now() - startTime;
    
    expect(reportTime).toBeLessThan(1000); // < 1 second
    expect(arrReport.totalARR).toBeGreaterThan(0);
  });
});
```

### Data Consistency Tests
```typescript
// packages/integration-tests/__tests__/data-consistency.test.ts
describe('Data Consistency Tests', () => {
  it('should maintain referential integrity across all operations', async () => {
    const subscription = await createTestSubscription();
    
    // Generate revenue calculation
    const calculation = await trpcClient.subscriptions.calculateRevenue.mutate({
      id: subscription.id,
      calculationType: 'initial',
      effectiveDate: new Date()
    });
    
    // Verify all performance obligations reference valid items
    for (const obligation of calculation.performanceObligations) {
      const item = await testDb.db
        .select()
        .from(items)
        .where(eq(items.id, obligation.itemId))
        .limit(1);
      
      expect(item).toHaveLength(1);
    }
    
    // Verify all revenue schedules reference valid performance obligations
    const schedules = await testDb.db
      .select()
      .from(revenueSchedules)
      .where(eq(revenueSchedules.organizationId, organizationId));
    
    for (const schedule of schedules) {
      const obligation = await testDb.db
        .select()
        .from(performanceObligations)
        .where(eq(performanceObligations.id, schedule.performanceObligationId))
        .limit(1);
      
      expect(obligation).toHaveLength(1);
    }
  });

  it('should handle concurrent operations correctly', async () => {
    const subscription = await createTestSubscription();
    
    // Simulate concurrent revenue calculations
    const promises = Array.from({ length: 10 }, () =>
      trpcClient.subscriptions.calculateRevenue.mutate({
        id: subscription.id,
        calculationType: 'initial',
        effectiveDate: new Date()
      })
    );
    
    const results = await Promise.all(promises);
    
    // All should succeed or fail consistently
    const firstResult = results[0];
    results.forEach(result => {
      expect(result.transactionPrice).toBe(firstResult.transactionPrice);
      expect(result.performanceObligations).toHaveLength(firstResult.performanceObligations.length);
    });
  });
});
```

### Test Utilities
```typescript
// packages/integration-tests/helpers/test-data-generator.ts
export class TestDataGenerator {
  constructor(private db: Database) {}

  async createOrganization(name = 'Test Organization'): Promise<Organization> {
    const [organization] = await this.db
      .insert(organizations)
      .values({
        name,
        slug: `test-org-${Date.now()}`,
        subscriptionStatus: 'active'
      })
      .returning();
    
    return organization;
  }

  async createCustomer(organizationId: string): Promise<Customer> {
    const [customer] = await this.db
      .insert(entities)
      .values({
        organizationId,
        entityType: 'customer',
        companyName: `Test Customer ${Date.now()}`,
        contactEmail: 'test@example.com'
      })
      .returning();
    
    return customer;
  }

  async createSoftwareLicenseItem(organizationId: string): Promise<string> {
    const [item] = await this.db
      .insert(items)
      .values({
        organizationId,
        itemNumber: `SW-${Date.now()}`,
        displayName: 'Software License',
        itemType: 'non_inventory',
        isActive: true,
        defaultPrice: 12000
      })
      .returning();
    
    return item.id;
  }

  async createKitItem(organizationId: string, components: KitComponent[]): Promise<string> {
    const [kitItem] = await this.db
      .insert(items)
      .values({
        organizationId,
        itemNumber: `KIT-${Date.now()}`,
        displayName: 'Software Bundle',
        itemType: 'kit',
        isActive: true
      })
      .returning();
    
    // Create kit components
    for (const component of components) {
      await this.db
        .insert(kitComponents)
        .values({
          organizationId,
          parentItemId: kitItem.id,
          componentItemId: component.componentItemId,
          quantity: component.quantity,
          allocationPercentage: component.allocationPercentage
        });
    }
    
    return kitItem.id;
  }

  async createManySubscriptions(count: number): Promise<string[]> {
    const subscriptionIds: string[] = [];
    const organization = await this.createOrganization();
    
    for (let i = 0; i < count; i++) {
      const customer = await this.createCustomer(organization.id);
      const itemId = await this.createSoftwareLicenseItem(organization.id);
      
      const [subscription] = await this.db
        .insert(subscriptions)
        .values({
          organizationId: organization.id,
          entityId: customer.id,
          subscriptionNumber: `SUB-${i.toString().padStart(6, '0')}`,
          status: 'active',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
          contractValue: Math.random() * 50000 + 10000 // Random value between 10K-60K
        })
        .returning();
      
      await this.db
        .insert(subscriptionItems)
        .values({
          subscriptionId: subscription.id,
          itemId,
          quantity: 1,
          unitPrice: subscription.contractValue,
          startDate: subscription.startDate,
          endDate: subscription.endDate
        });
      
      subscriptionIds.push(subscription.id);
    }
    
    return subscriptionIds;
  }
}
```

### Files to Create
- `packages/integration-tests/__tests__/subscription-workflow.test.ts`
- `packages/integration-tests/__tests__/revenue-calculation.test.ts`
- `packages/integration-tests/__tests__/invoice-payment.test.ts`
- `packages/integration-tests/__tests__/reporting-engine.test.ts`
- `packages/integration-tests/__tests__/api-endpoints.test.ts`
- `packages/integration-tests/__tests__/performance.test.ts`
- `packages/integration-tests/__tests__/data-consistency.test.ts`
- `packages/integration-tests/helpers/test-database.ts`
- `packages/integration-tests/helpers/test-data-generator.ts`
- `packages/integration-tests/helpers/assertion-helpers.ts`
- `packages/integration-tests/fixtures/` (data files)

### Definition of Done
- [ ] All end-to-end workflows tested and passing
- [ ] Performance tests validate system scales
- [ ] Data consistency verified across all operations
- [ ] Concurrent operations handled correctly
- [ ] Error scenarios tested and handled appropriately
- [ ] Test utilities support easy data generation
- [ ] CI/CD pipeline runs integration tests
- [ ] Test coverage reports generated
- [ ] Documentation for running integration tests complete