import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestDatabase } from '../helpers/test-database';
import { TestDataGenerator } from '../helpers/test-data-generator';
import { RevenueCalculationEngine, RevenueReportingService } from '@glapi/business';
import {
  subscriptions,
  subscriptionItems,
  performanceObligations,
  revenueSchedules,
  items
} from '@glapi/database';
import { eq } from 'drizzle-orm';

describe('Performance Tests', () => {
  let testDb: TestDatabase;
  let dataGenerator: TestDataGenerator;
  let revenueEngine: RevenueCalculationEngine;
  let reportingService: RevenueReportingService;
  let organizationId: string;

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.setup();
    
    dataGenerator = new TestDataGenerator(testDb.db);
    
    const organization = await dataGenerator.createOrganization('Performance Test Org');
    organizationId = organization.id;
    
    revenueEngine = new RevenueCalculationEngine(testDb.db, organizationId);
    reportingService = new RevenueReportingService(testDb.db, organizationId);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  it('should handle large subscription with many line items', async () => {
    const customer = await dataGenerator.createCustomer(organizationId);
    
    // Create 100 different items
    const itemIds: string[] = [];
    for (let i = 0; i < 100; i++) {
      const [item] = await testDb.db
        .insert(items)
        .values({
          id: `perf-item-${i}`,
          organizationId,
          itemNumber: `ITEM-${i.toString().padStart(3, '0')}`,
          displayName: `Test Item ${i}`,
          itemType: i % 2 === 0 ? 'non_inventory' : 'service',
          defaultPrice: (1000 + i * 100).toString(),
          revenueRecognitionPattern: i % 2 === 0 ? 'point_in_time' : 'over_time',
          performanceObligationType: i % 2 === 0 ? 'product_license' : 'maintenance_support',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      itemIds.push(item.id);
    }
    
    // Create subscription with all items
    const subscriptionItems = itemIds.map((itemId, index) => ({
      itemId,
      quantity: 1,
      unitPrice: 1000 + index * 100
    }));
    
    const startTime = Date.now();
    
    const subscription = await dataGenerator.createSubscription(
      organizationId,
      customer.id,
      subscriptionItems
    );
    
    const creationTime = Date.now() - startTime;
    
    // Calculate revenue
    const calculationStartTime = Date.now();
    
    const calculation = await revenueEngine.calculateRevenue(
      subscription.id,
      'initial',
      new Date('2024-01-01')
    );
    
    const calculationTime = Date.now() - calculationStartTime;
    
    // Performance expectations
    expect(creationTime).toBeLessThan(3000); // < 3 seconds for creation
    expect(calculationTime).toBeLessThan(5000); // < 5 seconds for calculation
    expect(calculation.performanceObligations.length).toBe(100);
    
    // Verify all obligations were created
    const obligations = await testDb.db
      .select()
      .from(performanceObligations)
      .where(eq(performanceObligations.subscriptionId, subscription.id));
    
    expect(obligations.length).toBe(100);
  }, 20000); // Increase timeout for this test

  it('should handle high volume revenue recognition', async () => {
    // Create 1000 revenue schedules
    const schedules = await dataGenerator.createManyRevenueSchedules(1000);
    
    const startTime = Date.now();
    
    // Process recognition for the period
    const result = await revenueEngine.recognizeRevenue(
      new Date('2024-01-31')
    );
    
    const processingTime = Date.now() - startTime;
    
    // Performance expectations
    expect(processingTime).toBeLessThan(3000); // < 3 seconds
    expect(result.processedSchedules).toBeGreaterThan(0);
    
    // Verify journal entries were created
    expect(result.journalEntries.length).toBeGreaterThan(0);
  }, 10000);

  it('should generate reports efficiently with large datasets', async () => {
    // Create 500 subscriptions
    console.log('Creating 500 test subscriptions...');
    const subscriptionIds = await dataGenerator.createManySubscriptions(500);
    
    console.log('Calculating revenue for all subscriptions...');
    // Calculate revenue for all subscriptions
    for (const subscriptionId of subscriptionIds) {
      await revenueEngine.calculateRevenue(
        subscriptionId,
        'initial',
        new Date('2024-01-01')
      );
    }
    
    console.log('Generating ARR report...');
    const startTime = Date.now();
    
    // Generate ARR report
    const arrReport = await reportingService.calculateARR(new Date('2024-01-31'));
    
    const arrReportTime = Date.now() - startTime;
    
    console.log('Generating MRR report...');
    const mrrStartTime = Date.now();
    
    // Generate MRR report
    const mrrReport = await reportingService.calculateMRR(new Date('2024-01-31'));
    
    const mrrReportTime = Date.now() - mrrStartTime;
    
    console.log('Generating deferred balance report...');
    const deferredStartTime = Date.now();
    
    // Generate deferred balance report
    const deferredReport = await reportingService.getDeferredBalance(new Date('2024-01-31'));
    
    const deferredReportTime = Date.now() - deferredStartTime;
    
    // Performance expectations
    expect(arrReportTime).toBeLessThan(2000); // < 2 seconds
    expect(mrrReportTime).toBeLessThan(2000); // < 2 seconds
    expect(deferredReportTime).toBeLessThan(2000); // < 2 seconds
    
    // Verify reports have data
    expect(arrReport.totalARR).toBeGreaterThan(0);
    expect(mrrReport.totalMRR).toBeGreaterThan(0);
    expect(deferredReport.totalDeferred).toBeGreaterThanOrEqual(0);
  }, 60000); // Increase timeout for this test

  it('should handle concurrent revenue calculations efficiently', async () => {
    const customer = await dataGenerator.createCustomer(organizationId);
    
    // Create 10 subscriptions
    const subscriptionPromises = Array.from({ length: 10 }, async (_, i) => {
      const itemId = await dataGenerator.createSoftwareLicenseItem(organizationId);
      return dataGenerator.createSubscription(
        organizationId,
        customer.id,
        [{ itemId, quantity: 1, unitPrice: 10000 + i * 1000 }]
      );
    });
    
    const subscriptions = await Promise.all(subscriptionPromises);
    
    const startTime = Date.now();
    
    // Calculate revenue for all subscriptions concurrently
    const calculationPromises = subscriptions.map(subscription =>
      revenueEngine.calculateRevenue(
        subscription.id,
        'initial',
        new Date('2024-01-01')
      )
    );
    
    const calculations = await Promise.all(calculationPromises);
    
    const totalTime = Date.now() - startTime;
    
    // Performance expectations
    expect(totalTime).toBeLessThan(5000); // < 5 seconds for all concurrent calculations
    
    // Verify all calculations succeeded
    calculations.forEach(calc => {
      expect(calc.performanceObligations.length).toBeGreaterThan(0);
      expect(calc.transactionPrice).toBeGreaterThan(0);
    });
  });

  it('should efficiently query large revenue schedule datasets', async () => {
    // Create many revenue schedules across multiple subscriptions
    const subscriptionCount = 100;
    const schedulesPerSubscription = 12; // Monthly for a year
    
    console.log(`Creating ${subscriptionCount} subscriptions with ${schedulesPerSubscription} schedules each...`);
    
    for (let i = 0; i < subscriptionCount; i++) {
      await dataGenerator.createManyRevenueSchedules(schedulesPerSubscription);
    }
    
    const startTime = Date.now();
    
    // Query all schedules for a specific period
    const schedules = await testDb.db
      .select()
      .from(revenueSchedules)
      .where(eq(revenueSchedules.organizationId, organizationId));
    
    const queryTime = Date.now() - startTime;
    
    // Performance expectations
    expect(queryTime).toBeLessThan(1000); // < 1 second for query
    expect(schedules.length).toBeGreaterThanOrEqual(subscriptionCount * schedulesPerSubscription);
  }, 30000);

  it('should handle batch updates efficiently', async () => {
    // Create schedules to update
    const schedules = await dataGenerator.createManyRevenueSchedules(500);
    
    const startTime = Date.now();
    
    // Batch update all schedules to recognized
    await testDb.db.transaction(async (tx) => {
      for (const schedule of schedules) {
        await tx
          .update(revenueSchedules)
          .set({
            status: 'recognized',
            recognizedAmount: schedule.scheduledAmount,
            recognizedDate: new Date().toISOString().split('T')[0],
            updatedAt: new Date()
          })
          .where(eq(revenueSchedules.id, schedule.id));
      }
    });
    
    const updateTime = Date.now() - startTime;
    
    // Performance expectations
    expect(updateTime).toBeLessThan(5000); // < 5 seconds for 500 updates
    
    // Verify updates
    const updatedSchedules = await testDb.db
      .select()
      .from(revenueSchedules)
      .where(eq(revenueSchedules.status, 'recognized'));
    
    expect(updatedSchedules.length).toBe(500);
  });

  it('should calculate SSP efficiently with large historical data', async () => {
    const itemId = await dataGenerator.createSoftwareLicenseItem(organizationId);
    
    // Create many historical transactions for SSP calculation
    const transactionCount = 1000;
    
    console.log(`Creating ${transactionCount} historical transactions...`);
    
    for (let i = 0; i < transactionCount; i++) {
      const customer = await dataGenerator.createCustomer(organizationId);
      const price = 10000 + Math.floor(Math.random() * 5000); // Random price between 10K-15K
      
      await dataGenerator.createSubscription(
        organizationId,
        customer.id,
        [{ itemId, quantity: 1, unitPrice: price }]
      );
    }
    
    const startTime = Date.now();
    
    // Calculate SSP
    const ssp = await revenueEngine['calculateSSP'](itemId);
    
    const sspCalculationTime = Date.now() - startTime;
    
    // Performance expectations
    expect(sspCalculationTime).toBeLessThan(1000); // < 1 second
    expect(ssp).toBeGreaterThan(0);
    expect(ssp).toBeGreaterThanOrEqual(10000);
    expect(ssp).toBeLessThanOrEqual(15000);
  }, 60000);

  describe('Memory Usage Tests', () => {
    it('should not exceed memory limits with large result sets', async () => {
      // Create a very large dataset
      const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB
      
      // Create 1000 subscriptions
      await dataGenerator.createManySubscriptions(1000);
      
      // Generate large report
      const report = await reportingService.calculateARR(new Date('2024-01-31'));
      
      const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory should not increase by more than 500MB
      expect(memoryIncrease).toBeLessThan(500);
      
      // Report should still be generated
      expect(report.totalARR).toBeGreaterThan(0);
    }, 120000);
  });

  describe('Database Connection Pool Tests', () => {
    it('should handle connection pool efficiently under load', async () => {
      const concurrentOperations = 50;
      
      const startTime = Date.now();
      
      // Execute many concurrent database operations
      const operations = Array.from({ length: concurrentOperations }, async (_, i) => {
        const customer = await dataGenerator.createCustomer(organizationId);
        const itemId = await dataGenerator.createSoftwareLicenseItem(organizationId);
        
        return dataGenerator.createSubscription(
          organizationId,
          customer.id,
          [{ itemId, quantity: 1, unitPrice: 10000 }]
        );
      });
      
      const results = await Promise.all(operations);
      
      const totalTime = Date.now() - startTime;
      
      // Should complete within reasonable time despite connection pool limits
      expect(totalTime).toBeLessThan(10000); // < 10 seconds
      expect(results.length).toBe(concurrentOperations);
    });
  });
});