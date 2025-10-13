import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { TestDatabase } from '../helpers/test-database';
import { TestDataGenerator } from '../helpers/test-data-generator';
import { RevenueCalculationEngine } from '@glapi/business';
import {
  subscriptions,
  subscriptionItems,
  performanceObligations,
  revenueSchedules,
  revenueJournalEntries
} from '@glapi/database';
import { eq, and, gte, lte } from 'drizzle-orm';

describe('Revenue Calculation Integration Tests', () => {
  let testDb: TestDatabase;
  let dataGenerator: TestDataGenerator;
  let revenueEngine: RevenueCalculationEngine;
  let organizationId: string;

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.setup();
    
    dataGenerator = new TestDataGenerator(testDb.db);
    
    const organization = await dataGenerator.createOrganization();
    organizationId = organization.id;
    
    revenueEngine = new RevenueCalculationEngine(testDb.db, organizationId);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  beforeEach(async () => {
    // Clear tables between tests
    await testDb.db.delete(revenueJournalEntries);
    await testDb.db.delete(revenueSchedules);
    await testDb.db.delete(performanceObligations);
    await testDb.db.delete(subscriptionItems);
    await testDb.db.delete(subscriptions);
  });

  describe('SSP Calculation', () => {
    it('should calculate SSP using observable prices', async () => {
      const customer = await dataGenerator.createCustomer(organizationId);
      const itemId = await dataGenerator.createSoftwareLicenseItem(organizationId);
      
      // Create multiple subscriptions with same item at different prices
      const prices = [12000, 12500, 11800, 12200, 12000];
      
      for (const price of prices) {
        await dataGenerator.createSubscription(
          organizationId,
          customer.id,
          [{ itemId, quantity: 1, unitPrice: price }]
        );
      }
      
      // Calculate SSP
      const ssp = await revenueEngine['calculateSSP'](itemId);
      
      // Should be median of observable prices
      expect(ssp).toBe(12000);
    });

    it('should handle items without observable prices', async () => {
      const itemId = await dataGenerator.createMaintenanceItem(organizationId);
      
      // Calculate SSP for item with no sales history
      const ssp = await revenueEngine['calculateSSP'](itemId);
      
      // Should fall back to default price or cost-plus margin
      expect(ssp).toBeGreaterThan(0);
    });
  });

  describe('Transaction Price Allocation', () => {
    it('should allocate transaction price based on relative SSP', async () => {
      const customer = await dataGenerator.createCustomer(organizationId);
      const licenseItemId = await dataGenerator.createSoftwareLicenseItem(organizationId);
      const maintenanceItemId = await dataGenerator.createMaintenanceItem(organizationId);
      
      // Create subscription with discount
      const subscription = await dataGenerator.createSubscription(
        organizationId,
        customer.id,
        [
          { itemId: licenseItemId, quantity: 1, unitPrice: 10000 }, // SSP: 12000
          { itemId: maintenanceItemId, quantity: 1, unitPrice: 2000 } // SSP: 2400
        ]
      );
      
      const calculation = await revenueEngine.calculateRevenue(
        subscription.id,
        'initial',
        new Date('2024-01-01')
      );
      
      // Total transaction price
      expect(calculation.transactionPrice).toBe(12000);
      
      // Check allocations
      const licenseAllocation = calculation.allocations.find(a => 
        calculation.performanceObligations.find(
          po => po.id === a.performanceObligationId && po.obligationType === 'product_license'
        )
      );
      
      const maintenanceAllocation = calculation.allocations.find(a =>
        calculation.performanceObligations.find(
          po => po.id === a.performanceObligationId && po.obligationType === 'maintenance_support'
        )
      );
      
      // Allocations should be proportional to SSP
      // License: 12000 / 14400 * 12000 = 10000
      // Maintenance: 2400 / 14400 * 12000 = 2000
      expect(licenseAllocation?.allocatedAmount).toBeCloseTo(10000, 2);
      expect(maintenanceAllocation?.allocatedAmount).toBeCloseTo(2000, 2);
    });

    it('should handle variable consideration correctly', async () => {
      const customer = await dataGenerator.createCustomer(organizationId);
      const itemId = await dataGenerator.createSoftwareLicenseItem(organizationId);
      
      // Create subscription with usage-based pricing
      const subscription = await dataGenerator.createSubscription(
        organizationId,
        customer.id,
        [
          { 
            itemId, 
            quantity: 1, 
            unitPrice: 10000 // Base price, with potential for overage
          }
        ]
      );
      
      // Add variable consideration metadata
      await testDb.db
        .update(subscriptions)
        .set({
          metadata: JSON.stringify({
            hasVariableConsideration: true,
            estimatedVariableAmount: 2000,
            variableConstraint: 0.8 // 80% constraint
          })
        })
        .where(eq(subscriptions.id, subscription.id));
      
      const calculation = await revenueEngine.calculateRevenue(
        subscription.id,
        'initial',
        new Date('2024-01-01')
      );
      
      // Should include constrained variable consideration
      expect(calculation.transactionPrice).toBeGreaterThan(10000);
      expect(calculation.variableConsideration).toBeDefined();
      expect(calculation.variableConsideration?.constrainedAmount).toBe(1600); // 2000 * 0.8
    });
  });

  describe('Revenue Recognition Patterns', () => {
    it('should recognize point-in-time obligations immediately', async () => {
      const customer = await dataGenerator.createCustomer(organizationId);
      const licenseItemId = await dataGenerator.createSoftwareLicenseItem(organizationId);
      
      const subscription = await dataGenerator.createSubscription(
        organizationId,
        customer.id,
        [{ itemId: licenseItemId, quantity: 1, unitPrice: 12000 }]
      );
      
      await revenueEngine.calculateRevenue(
        subscription.id,
        'initial',
        new Date('2024-01-01')
      );
      
      // Check revenue schedules
      const schedules = await testDb.db
        .select()
        .from(revenueSchedules)
        .where(eq(revenueSchedules.organizationId, organizationId));
      
      // Point-in-time should have single schedule on start date
      expect(schedules).toHaveLength(1);
      expect(schedules[0].periodStartDate).toBe('2024-01-01');
      expect(parseFloat(schedules[0].scheduledAmount)).toBe(12000);
    });

    it('should recognize over-time obligations ratably', async () => {
      const customer = await dataGenerator.createCustomer(organizationId);
      const maintenanceItemId = await dataGenerator.createMaintenanceItem(organizationId);
      
      const subscription = await dataGenerator.createSubscription(
        organizationId,
        customer.id,
        [{ itemId: maintenanceItemId, quantity: 1, unitPrice: 12000 }]
      );
      
      await revenueEngine.calculateRevenue(
        subscription.id,
        'initial',
        new Date('2024-01-01')
      );
      
      // Check revenue schedules
      const schedules = await testDb.db
        .select()
        .from(revenueSchedules)
        .where(eq(revenueSchedules.organizationId, organizationId))
        .orderBy(revenueSchedules.periodStartDate);
      
      // Over-time should have monthly schedules
      expect(schedules).toHaveLength(12);
      
      // Each month should have equal amount
      schedules.forEach(schedule => {
        expect(parseFloat(schedule.scheduledAmount)).toBeCloseTo(1000, 2); // 12000 / 12
      });
      
      // Verify date progression
      for (let i = 0; i < 12; i++) {
        const expectedDate = new Date(2024, i, 1);
        expect(schedules[i].periodStartDate).toBe(expectedDate.toISOString().split('T')[0]);
      }
    });

    it('should handle milestone-based recognition', async () => {
      const customer = await dataGenerator.createCustomer(organizationId);
      
      // Create implementation service item
      const [implementationItem] = await testDb.db
        .insert(items)
        .values({
          id: 'impl-item',
          organizationId,
          itemNumber: 'IMPL-001',
          displayName: 'Implementation Services',
          itemType: 'service',
          defaultPrice: '30000',
          revenueRecognitionPattern: 'milestone',
          performanceObligationType: 'professional_services',
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      const subscription = await dataGenerator.createSubscription(
        organizationId,
        customer.id,
        [{ itemId: implementationItem.id, quantity: 1, unitPrice: 30000 }]
      );
      
      // Add milestone metadata
      await testDb.db
        .update(subscriptions)
        .set({
          metadata: JSON.stringify({
            milestones: [
              { name: 'Project Kickoff', percentage: 0.2, expectedDate: '2024-01-15' },
              { name: 'Design Complete', percentage: 0.3, expectedDate: '2024-02-15' },
              { name: 'Implementation', percentage: 0.3, expectedDate: '2024-03-15' },
              { name: 'Go Live', percentage: 0.2, expectedDate: '2024-04-15' }
            ]
          })
        })
        .where(eq(subscriptions.id, subscription.id));
      
      await revenueEngine.calculateRevenue(
        subscription.id,
        'initial',
        new Date('2024-01-01')
      );
      
      // Check revenue schedules
      const schedules = await testDb.db
        .select()
        .from(revenueSchedules)
        .where(eq(revenueSchedules.organizationId, organizationId))
        .orderBy(revenueSchedules.periodStartDate);
      
      // Should have schedule for each milestone
      expect(schedules).toHaveLength(4);
      
      // Verify milestone amounts
      expect(parseFloat(schedules[0].scheduledAmount)).toBe(6000); // 20% of 30000
      expect(parseFloat(schedules[1].scheduledAmount)).toBe(9000); // 30% of 30000
      expect(parseFloat(schedules[2].scheduledAmount)).toBe(9000); // 30% of 30000
      expect(parseFloat(schedules[3].scheduledAmount)).toBe(6000); // 20% of 30000
    });
  });

  describe('Revenue Recognition Process', () => {
    it('should recognize revenue for a period correctly', async () => {
      const { subscription } = await dataGenerator.createCompleteScenario();
      
      await revenueEngine.calculateRevenue(
        subscription.id,
        'initial',
        new Date('2024-01-01')
      );
      
      // Activate subscription
      await testDb.db
        .update(subscriptions)
        .set({ status: 'active' })
        .where(eq(subscriptions.id, subscription.id));
      
      // Recognize revenue for January
      const recognitionResult = await revenueEngine.recognizeRevenue(
        new Date('2024-01-31')
      );
      
      expect(recognitionResult.totalRecognized).toBeGreaterThan(0);
      expect(recognitionResult.journalEntries.length).toBeGreaterThan(0);
      
      // Verify journal entries
      const journalEntries = await testDb.db
        .select()
        .from(revenueJournalEntries)
        .where(eq(revenueJournalEntries.organizationId, organizationId));
      
      expect(journalEntries.length).toBeGreaterThan(0);
      
      // Check that schedules are updated
      const updatedSchedules = await testDb.db
        .select()
        .from(revenueSchedules)
        .where(
          and(
            eq(revenueSchedules.organizationId, organizationId),
            eq(revenueSchedules.status, 'recognized')
          )
        );
      
      expect(updatedSchedules.length).toBeGreaterThan(0);
    });

    it('should handle partial period recognition', async () => {
      const customer = await dataGenerator.createCustomer(organizationId);
      const maintenanceItemId = await dataGenerator.createMaintenanceItem(organizationId);
      
      // Create subscription starting mid-month
      const [subscription] = await testDb.db
        .insert(subscriptions)
        .values({
          id: 'mid-month-sub',
          organizationId,
          entityId: customer.id,
          subscriptionNumber: 'SUB-MID',
          status: 'active',
          startDate: '2024-01-15', // Mid-month start
          endDate: '2024-12-31',
          contractValue: '12000',
          billingFrequency: 'monthly',
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      await testDb.db
        .insert(subscriptionItems)
        .values({
          id: 'mid-month-item',
          subscriptionId: subscription.id,
          itemId: maintenanceItemId,
          quantity: '1',
          unitPrice: '12000',
          totalPrice: '12000',
          startDate: '2024-01-15',
          endDate: '2024-12-31',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      
      await revenueEngine.calculateRevenue(
        subscription.id,
        'initial',
        new Date('2024-01-15')
      );
      
      // Recognize revenue for January
      const recognitionResult = await revenueEngine.recognizeRevenue(
        new Date('2024-01-31')
      );
      
      // First month should be prorated (17 days out of 31)
      const firstMonthRevenue = recognitionResult.journalEntries.find(
        je => je.periodStartDate === '2024-01-15'
      );
      
      const expectedAmount = (12000 / 12) * (17 / 31); // Prorated amount
      expect(firstMonthRevenue?.recognizedRevenueAmount).toBeCloseTo(expectedAmount, 2);
    });

    it('should prevent duplicate recognition', async () => {
      const { subscription } = await dataGenerator.createCompleteScenario();
      
      await revenueEngine.calculateRevenue(
        subscription.id,
        'initial',
        new Date('2024-01-01')
      );
      
      // Activate subscription
      await testDb.db
        .update(subscriptions)
        .set({ status: 'active' })
        .where(eq(subscriptions.id, subscription.id));
      
      // First recognition
      const firstResult = await revenueEngine.recognizeRevenue(
        new Date('2024-01-31')
      );
      
      expect(firstResult.totalRecognized).toBeGreaterThan(0);
      
      // Second recognition for same period
      const secondResult = await revenueEngine.recognizeRevenue(
        new Date('2024-01-31')
      );
      
      // Should not recognize again
      expect(secondResult.totalRecognized).toBe(0);
      expect(secondResult.journalEntries.length).toBe(0);
    });
  });

  describe('Contract Modifications', () => {
    it('should handle prospective modifications', async () => {
      const customer = await dataGenerator.createCustomer(organizationId);
      const itemId = await dataGenerator.createSoftwareLicenseItem(organizationId);
      
      const subscription = await dataGenerator.createSubscription(
        organizationId,
        customer.id,
        [{ itemId, quantity: 1, unitPrice: 12000 }]
      );
      
      // Initial calculation
      await revenueEngine.calculateRevenue(
        subscription.id,
        'initial',
        new Date('2024-01-01')
      );
      
      // Recognize some revenue
      await revenueEngine.recognizeRevenue(new Date('2024-03-31'));
      
      // Add new item (prospective modification)
      const newItemId = await dataGenerator.createMaintenanceItem(organizationId);
      
      await testDb.db
        .insert(subscriptionItems)
        .values({
          id: 'new-item',
          subscriptionId: subscription.id,
          itemId: newItemId,
          quantity: '1',
          unitPrice: '6000',
          totalPrice: '6000',
          startDate: '2024-04-01',
          endDate: '2024-12-31',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      
      // Recalculate for modification
      const modificationResult = await revenueEngine.calculateRevenue(
        subscription.id,
        'modification',
        new Date('2024-04-01')
      );
      
      expect(modificationResult.modifications).toBeDefined();
      expect(modificationResult.modifications.length).toBeGreaterThan(0);
      
      // New schedules should start from modification date
      const newSchedules = await testDb.db
        .select()
        .from(revenueSchedules)
        .where(
          and(
            eq(revenueSchedules.organizationId, organizationId),
            gte(revenueSchedules.periodStartDate, '2024-04-01')
          )
        );
      
      expect(newSchedules.length).toBeGreaterThan(0);
    });

    it('should handle cumulative catch-up adjustments', async () => {
      const customer = await dataGenerator.createCustomer(organizationId);
      const itemId = await dataGenerator.createMaintenanceItem(organizationId);
      
      const subscription = await dataGenerator.createSubscription(
        organizationId,
        customer.id,
        [{ itemId, quantity: 1, unitPrice: 12000 }]
      );
      
      // Initial calculation
      await revenueEngine.calculateRevenue(
        subscription.id,
        'initial',
        new Date('2024-01-01')
      );
      
      // Recognize revenue for 3 months
      await revenueEngine.recognizeRevenue(new Date('2024-01-31'));
      await revenueEngine.recognizeRevenue(new Date('2024-02-29'));
      await revenueEngine.recognizeRevenue(new Date('2024-03-31'));
      
      // Modify contract value (price increase)
      await testDb.db
        .update(subscriptionItems)
        .set({
          unitPrice: '18000',
          totalPrice: '18000'
        })
        .where(eq(subscriptionItems.subscriptionId, subscription.id));
      
      await testDb.db
        .update(subscriptions)
        .set({
          contractValue: '18000'
        })
        .where(eq(subscriptions.id, subscription.id));
      
      // Recalculate with cumulative catch-up
      const modificationResult = await revenueEngine.calculateRevenue(
        subscription.id,
        'modification',
        new Date('2024-04-01'),
        { adjustmentMethod: 'cumulative_catch_up' }
      );
      
      // Should have catch-up adjustment
      expect(modificationResult.adjustments).toBeDefined();
      const catchUpAdjustment = modificationResult.adjustments?.find(
        a => a.adjustmentType === 'cumulative_catch_up'
      );
      
      expect(catchUpAdjustment).toBeDefined();
      expect(catchUpAdjustment?.amount).toBeGreaterThan(0);
    });
  });
});