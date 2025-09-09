import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { TestDatabase } from '../helpers/test-database';
import { TestDataGenerator } from '../helpers/test-data-generator';
import { RevenueCalculationEngine } from '@glapi/business';
import {
  subscriptions,
  subscriptionItems,
  performanceObligations,
  revenueSchedules,
  invoices,
  payments
} from '@glapi/database';
import { eq, and } from 'drizzle-orm';

describe('Complete Subscription Revenue Workflow', () => {
  let testDb: TestDatabase;
  let dataGenerator: TestDataGenerator;
  let revenueEngine: RevenueCalculationEngine;
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
    
    revenueEngine = new RevenueCalculationEngine(testDb.db, organizationId);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  beforeEach(async () => {
    // Clear relevant tables between tests
    await testDb.db.delete(payments);
    await testDb.db.delete(invoices);
    await testDb.db.delete(revenueSchedules);
    await testDb.db.delete(performanceObligations);
    await testDb.db.delete(subscriptionItems);
    await testDb.db.delete(subscriptions);
  });

  it('should handle complete subscription lifecycle', async () => {
    // Step 1: Create subscription with multiple items
    const licenseItemId = await dataGenerator.createSoftwareLicenseItem(organizationId);
    const maintenanceItemId = await dataGenerator.createMaintenanceItem(organizationId);
    
    const subscription = await dataGenerator.createSubscription(
      organizationId,
      customerId,
      [
        {
          itemId: licenseItemId,
          quantity: 1,
          unitPrice: 12000 // $12K annual license
        },
        {
          itemId: maintenanceItemId,
          quantity: 1,
          unitPrice: 2400 // $2.4K annual maintenance
        }
      ]
    );
    
    subscriptionId = subscription.id;

    expect(subscription.status).toBe('draft');
    expect(parseFloat(subscription.contractValue)).toBe(14400);

    // Step 2: Calculate revenue recognition
    const revenueCalculation = await revenueEngine.calculateRevenue(
      subscriptionId,
      'initial',
      new Date('2024-01-01')
    );

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
    await testDb.db
      .update(subscriptions)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(subscriptions.id, subscriptionId));

    const [activatedSubscription] = await testDb.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId));

    expect(activatedSubscription.status).toBe('active');

    // Step 4: Get revenue schedule
    const schedules = await testDb.db
      .select()
      .from(revenueSchedules)
      .where(eq(revenueSchedules.organizationId, organizationId));

    expect(schedules).toBeDefined();
    expect(schedules.length).toBeGreaterThan(0);

    // License should have immediate recognition
    const licenseSchedules = schedules.filter(s => {
      const obligation = revenueCalculation.performanceObligations.find(
        po => po.id === s.performanceObligationId && po.obligationType === 'product_license'
      );
      return obligation !== undefined;
    });
    
    expect(licenseSchedules.length).toBeGreaterThan(0);

    // Maintenance should have monthly recognition
    const maintenanceSchedules = schedules.filter(s => {
      const obligation = revenueCalculation.performanceObligations.find(
        po => po.id === s.performanceObligationId && po.obligationType === 'maintenance_support'
      );
      return obligation !== undefined;
    });
    
    expect(maintenanceSchedules.length).toBe(12); // Monthly over 12 months

    // Step 5: Generate invoice
    const invoice = await dataGenerator.createInvoice(
      subscriptionId,
      organizationId,
      customerId,
      14400 // Full annual amount
    );

    expect(parseFloat(invoice.totalAmount)).toBe(14400);

    // Step 6: Record payment
    const payment = await dataGenerator.createPayment(
      invoice.id,
      organizationId,
      14400
    );

    expect(payment.status).toBe('completed');

    // Step 7: Verify revenue recognition
    const recognitionResult = await revenueEngine.recognizeRevenue(
      new Date('2024-01-31')
    );

    expect(recognitionResult.totalRecognized).toBeGreaterThan(0);
    expect(recognitionResult.journalEntries.length).toBeGreaterThan(0);
  });

  it('should handle contract modifications correctly', async () => {
    // Create initial subscription
    const licenseItemId = await dataGenerator.createSoftwareLicenseItem(organizationId);
    
    const subscription = await dataGenerator.createSubscription(
      organizationId,
      customerId,
      [
        {
          itemId: licenseItemId,
          quantity: 1,
          unitPrice: 12000
        }
      ]
    );

    // Calculate initial revenue
    await revenueEngine.calculateRevenue(
      subscription.id,
      'initial',
      new Date('2024-01-01')
    );

    // Modify subscription - increase quantity
    await testDb.db
      .update(subscriptionItems)
      .set({ 
        quantity: '2',
        totalPrice: '24000',
        updatedAt: new Date()
      })
      .where(eq(subscriptionItems.subscriptionId, subscription.id));

    // Recalculate revenue for modification
    const revenueRecalculation = await revenueEngine.calculateRevenue(
      subscription.id,
      'modification',
      new Date('2024-06-01')
    );

    expect(revenueRecalculation.transactionPrice).toBeGreaterThan(12000);
    expect(revenueRecalculation.modifications).toBeDefined();
    expect(revenueRecalculation.modifications.length).toBeGreaterThan(0);
  });

  it('should handle kit/bundle items correctly', async () => {
    // Create kit item with components
    const licenseItemId = await dataGenerator.createSoftwareLicenseItem(organizationId);
    const maintenanceItemId = await dataGenerator.createMaintenanceItem(organizationId);
    
    const kitItemId = await dataGenerator.createKitItem(organizationId, [
      { componentItemId: licenseItemId, quantity: 1, allocationPercentage: 0.8 },
      { componentItemId: maintenanceItemId, quantity: 1, allocationPercentage: 0.2 }
    ]);

    const subscriptionWithKit = await dataGenerator.createSubscription(
      organizationId,
      customerId,
      [
        {
          itemId: kitItemId,
          quantity: 1,
          unitPrice: 15000
        }
      ]
    );

    const kitRevenueCalculation = await revenueEngine.calculateRevenue(
      subscriptionWithKit.id,
      'initial',
      new Date('2024-01-01')
    );

    // Should explode kit into separate performance obligations
    expect(kitRevenueCalculation.performanceObligations.length).toBeGreaterThan(1);
    
    // Verify allocation based on percentages
    const totalAllocated = kitRevenueCalculation.allocations.reduce(
      (sum, alloc) => sum + alloc.allocatedAmount,
      0
    );
    expect(totalAllocated).toBeCloseTo(15000, 2);

    // Verify license gets 80% allocation
    const licenseAllocation = kitRevenueCalculation.allocations.find(
      a => a.performanceObligationId === kitRevenueCalculation.performanceObligations.find(
        po => po.obligationType === 'product_license'
      )?.id
    );
    expect(licenseAllocation?.allocatedAmount).toBeCloseTo(12000, 2); // 80% of 15000
  });

  it('should handle subscription cancellation and refunds', async () => {
    // Create and activate subscription
    const licenseItemId = await dataGenerator.createSoftwareLicenseItem(organizationId);
    
    const subscription = await dataGenerator.createSubscription(
      organizationId,
      customerId,
      [
        {
          itemId: licenseItemId,
          quantity: 1,
          unitPrice: 12000
        }
      ]
    );

    // Calculate and recognize initial revenue
    await revenueEngine.calculateRevenue(
      subscription.id,
      'initial',
      new Date('2024-01-01')
    );

    await testDb.db
      .update(subscriptions)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(subscriptions.id, subscription.id));

    // Recognize some revenue
    await revenueEngine.recognizeRevenue(new Date('2024-03-31'));

    // Cancel subscription
    await testDb.db
      .update(subscriptions)
      .set({ 
        status: 'cancelled',
        cancellationDate: new Date('2024-04-01').toISOString().split('T')[0],
        updatedAt: new Date()
      })
      .where(eq(subscriptions.id, subscription.id));

    // Recalculate revenue for cancellation
    const cancellationCalculation = await revenueEngine.calculateRevenue(
      subscription.id,
      'cancellation',
      new Date('2024-04-01')
    );

    expect(cancellationCalculation.adjustments).toBeDefined();
    
    // Verify deferred revenue is properly adjusted
    const deferredSchedules = await testDb.db
      .select()
      .from(revenueSchedules)
      .where(
        and(
          eq(revenueSchedules.organizationId, organizationId),
          eq(revenueSchedules.status, 'cancelled')
        )
      );

    expect(deferredSchedules.length).toBeGreaterThan(0);
  });

  it('should handle multi-year subscriptions correctly', async () => {
    // Create 3-year subscription
    const licenseItemId = await dataGenerator.createSoftwareLicenseItem(organizationId);
    
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2026-12-31'); // 3 years
    const contractValue = 36000; // $36K for 3 years

    const [multiYearSubscription] = await testDb.db
      .insert(subscriptions)
      .values({
        id: 'multi-year-sub',
        organizationId,
        entityId: customerId,
        subscriptionNumber: `SUB-MULTI-${Date.now()}`,
        status: 'draft',
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        contractValue: contractValue.toString(),
        billingFrequency: 'annual',
        paymentTerms: 'net_30',
        autoRenew: false,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    await testDb.db
      .insert(subscriptionItems)
      .values({
        id: 'multi-year-item',
        subscriptionId: multiYearSubscription.id,
        itemId: licenseItemId,
        quantity: '1',
        unitPrice: contractValue.toString(),
        totalPrice: contractValue.toString(),
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        createdAt: new Date(),
        updatedAt: new Date()
      });

    const multiYearCalculation = await revenueEngine.calculateRevenue(
      multiYearSubscription.id,
      'initial',
      startDate
    );

    // Verify revenue is spread over 3 years
    const schedules = await testDb.db
      .select()
      .from(revenueSchedules)
      .where(eq(revenueSchedules.organizationId, organizationId));

    const year1Schedules = schedules.filter(s => s.periodStartDate.startsWith('2024'));
    const year2Schedules = schedules.filter(s => s.periodStartDate.startsWith('2025'));
    const year3Schedules = schedules.filter(s => s.periodStartDate.startsWith('2026'));

    expect(year1Schedules.length).toBeGreaterThan(0);
    expect(year2Schedules.length).toBeGreaterThan(0);
    expect(year3Schedules.length).toBeGreaterThan(0);
  });
});