import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RevenueReportingService } from '../revenue-reporting-service';
import { db } from '@glapi/database';

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field, value) => ({ field, value, op: 'eq' })),
  and: vi.fn((...conditions) => ({ conditions, op: 'and' })),
  or: vi.fn((...conditions) => ({ conditions, op: 'or' })),
  gte: vi.fn((field, value) => ({ field, value, op: 'gte' })),
  lte: vi.fn((field, value) => ({ field, value, op: 'lte' })),
  sql: vi.fn((template, ...values) => ({ 
    template, 
    values, 
    op: 'sql',
    mapWith: vi.fn(() => 'sql_mapped')
  })),
  desc: vi.fn((field) => ({ field, op: 'desc' }))
}));

// Mock the database
vi.mock('@glapi/database', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  subscriptions: {
    organizationId: 'organizationId',
    status: 'status',
    startDate: 'startDate',
    endDate: 'endDate',
    entityId: 'entityId',
    id: 'id'
  },
  subscriptionItems: {
    subscriptionId: 'subscriptionId'
  },
  revenueSchedules: {
    organizationId: 'organizationId',
    periodStartDate: 'periodStartDate',
    periodEndDate: 'periodEndDate',
    performanceObligationId: 'performanceObligationId',
    scheduledAmount: 'scheduledAmount',
    recognizedAmount: 'recognizedAmount',
    status: 'status',
    id: 'id'
  },
  performanceObligations: {
    id: 'id',
    subscriptionId: 'subscriptionId'
  },
  revenueJournalEntries: {
    organizationId: 'organizationId',
    entryDate: 'entryDate',
    recognizedRevenueAmount: 'recognizedRevenueAmount'
  }
}));

describe('RevenueReportingService', () => {
  let service: RevenueReportingService;
  const mockOrganizationId = 'org-123';
  const mockDate = new Date('2024-01-31');

  beforeEach(() => {
    service = new RevenueReportingService(db, mockOrganizationId);
    vi.clearAllMocks();
  });

  describe('calculateARR', () => {
    it('should calculate total ARR from active subscriptions', async () => {
      // Arrange
      const mockSubscriptions = [
        {
          id: 'sub-1',
          organizationId: mockOrganizationId,
          entityId: 'customer-1',
          contractValue: '120000', // $120k annual
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          status: 'active',
          billingFrequency: 'annual',
          items: [
            {
              itemId: 'item-1',
              itemName: 'Software License',
              quantity: '10',
              unitPrice: '12000'
            }
          ]
        },
        {
          id: 'sub-2',
          organizationId: mockOrganizationId,
          entityId: 'customer-2',
          contractValue: '36000', // $36k annual
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          status: 'active',
          billingFrequency: 'monthly',
          items: [
            {
              itemId: 'item-2',
              itemName: 'Support',
              quantity: '1',
              unitPrice: '3000'
            }
          ]
        }
      ];

      vi.mocked(db.select).mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockResolvedValue(mockSubscriptions.map(sub => ({
          subscriptions: sub,
          subscription_items: sub.items[0] || null
        }))),
      } as any));

      // Act
      const result = await service.calculateARR(mockDate);

      // Assert
      expect(result.totalARR).toBe(156000); // $120k + $36k
      expect(result.arrByCustomer).toHaveLength(2);
      expect(result.arrByProduct).toHaveLength(2);
      expect(result.newARR).toBeGreaterThanOrEqual(0);
      expect(result.netARRGrowth).toBeDefined();
    });

    it('should calculate ARR movements (new, expansion, contraction, churn)', async () => {
      // Arrange - mock data for ARR movements
      const startOfYear = new Date('2024-01-01');
      const mockMovements = {
        newARR: 50000,
        expansionARR: 20000,
        contractionARR: 10000,
        churnARR: 5000
      };

      // Act
      const result = await service.calculateARR(mockDate);

      // Assert
      expect(result.newARR).toBe(mockMovements.newARR);
      expect(result.expansionARR).toBe(mockMovements.expansionARR);
      expect(result.contractionARR).toBe(mockMovements.contractionARR);
      expect(result.churnARR).toBe(mockMovements.churnARR);
      expect(result.netARRGrowth).toBe(
        mockMovements.newARR + mockMovements.expansionARR - 
        mockMovements.contractionARR - mockMovements.churnARR
      );
    });

    it('should group ARR by customer and product', async () => {
      // Test ARR grouping logic
      const result = await service.calculateARR(mockDate);
      
      expect(result.arrByCustomer).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            entityId: expect.any(String),
            customerName: expect.any(String),
            arr: expect.any(Number),
            subscriptionCount: expect.any(Number)
          })
        ])
      );
      
      expect(result.arrByProduct).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            itemId: expect.any(String),
            productName: expect.any(String),
            arr: expect.any(Number),
            subscriptionCount: expect.any(Number)
          })
        ])
      );
    });
  });

  describe('calculateMRR', () => {
    it('should calculate monthly recurring revenue', async () => {
      // Arrange
      const mockSchedules = [
        {
          revenue_schedules: {
            scheduledAmount: '10000',
            periodStartDate: '2024-01-01',
            periodEndDate: '2024-01-31'
          },
          performance_obligations: {
            satisfactionMethod: 'over_time'
          },
          subscriptions: {
            entityId: 'customer-1'
          }
        },
        {
          revenue_schedules: {
            scheduledAmount: '5000',
            periodStartDate: '2024-01-01',
            periodEndDate: '2024-01-31'
          },
          performance_obligations: {
            satisfactionMethod: 'over_time'
          },
          subscriptions: {
            entityId: 'customer-2'
          }
        }
      ];

      vi.mocked(db.select).mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockSchedules.map(s => ({
          scheduledAmount: s.revenue_schedules.scheduledAmount,
          periodStartDate: s.revenue_schedules.periodStartDate,
          periodEndDate: s.revenue_schedules.periodEndDate,
          performanceObligationId: 'po-1'
        }))),
        leftJoin: vi.fn().mockReturnThis(),
      } as any));

      // Act
      const result = await service.calculateMRR(mockDate);

      // Assert
      expect(result.totalMRR).toBe(15000); // $10k + $5k
      expect(result.newMRR).toBeGreaterThanOrEqual(0);
      expect(result.expansionMRR).toBeGreaterThanOrEqual(0);
      expect(result.contractionMRR).toBeGreaterThanOrEqual(0);
      expect(result.churnMRR).toBeGreaterThanOrEqual(0);
      expect(result.mrrCohorts).toBeDefined();
    });

    it('should generate MRR cohort analysis', async () => {
      // Act
      const result = await service.calculateMRR(mockDate);

      // Assert
      expect(result.mrrCohorts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            cohortMonth: expect.any(Date),
            monthsSinceStart: expect.any(Number),
            customersCount: expect.any(Number),
            mrr: expect.any(Number),
            retentionRate: expect.any(Number)
          })
        ])
      );
    });

    it('should handle different billing frequencies correctly', async () => {
      // Arrange - annual subscription should be divided by 12 for MRR
      const mockAnnualSchedule = {
        revenue_schedules: {
          scheduledAmount: '120000', // Annual amount
          periodStartDate: '2024-01-01',
          periodEndDate: '2024-12-31'
        },
        performance_obligations: {
          satisfactionMethod: 'over_time'
        }
      };

      // Act & Assert
      const monthlyAmount = service['annualizeAndMonthlyConvert'](
        '120000',
        'over_time'
      );
      expect(monthlyAmount).toBe(10000); // $120k / 12 = $10k
    });
  });

  describe('getDeferredBalance', () => {
    it('should calculate total deferred revenue balance', async () => {
      // Arrange
      const mockDeferredSchedules = [
        {
          revenue_schedules: {
            scheduledAmount: '50000',
            recognizedAmount: '10000',
            periodStartDate: '2024-02-01',
            status: 'scheduled'
          },
          subscriptions: {
            entityId: 'customer-1',
            customerName: 'Customer One'
          }
        },
        {
          revenue_schedules: {
            scheduledAmount: '30000',
            recognizedAmount: '0',
            periodStartDate: '2024-03-01',
            status: 'scheduled'
          },
          subscriptions: {
            entityId: 'customer-2',
            customerName: 'Customer Two'
          }
        }
      ];

      vi.mocked(db.select).mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockDeferredSchedules.map(s => ({
          id: 'sched-1',
          scheduledAmount: s.revenue_schedules.scheduledAmount,
          recognizedAmount: s.revenue_schedules.recognizedAmount,
          periodStartDate: s.revenue_schedules.periodStartDate,
          periodEndDate: '2024-02-28',
          performanceObligationId: 'po-1',
          status: s.revenue_schedules.status
        }))),
        leftJoin: vi.fn().mockReturnThis(),
      } as any));

      // Act
      const result = await service.getDeferredBalance(mockDate);

      // Assert
      expect(result.totalDeferred).toBe(70000); // (50k - 10k) + 30k
      expect(result.currentPortion).toBeGreaterThanOrEqual(0);
      expect(result.longTermPortion).toBeGreaterThanOrEqual(0);
      expect(result.deferredByCustomer).toHaveLength(2);
      expect(result.agingBuckets).toHaveLength(5);
    });

    it('should separate current vs long-term portions', async () => {
      // Act
      const result = await service.getDeferredBalance(mockDate);

      // Assert
      expect(result.currentPortion + result.longTermPortion).toBe(result.totalDeferred);
      expect(result.currentPortion).toBeGreaterThanOrEqual(0);
      expect(result.longTermPortion).toBeGreaterThanOrEqual(0);
    });

    it('should age deferred revenue into buckets', async () => {
      // Act
      const result = await service.getDeferredBalance(mockDate);

      // Assert
      expect(result.agingBuckets).toEqual([
        { period: '0-30 days', amount: expect.any(Number) },
        { period: '31-90 days', amount: expect.any(Number) },
        { period: '91-365 days', amount: expect.any(Number) },
        { period: '1-2 years', amount: expect.any(Number) },
        { period: '2+ years', amount: expect.any(Number) }
      ]);

      const totalAged = result.agingBuckets.reduce((sum, bucket) => sum + bucket.amount, 0);
      expect(totalAged).toBeCloseTo(result.totalDeferred, 2);
    });
  });

  describe('getRevenueWaterfall', () => {
    it('should generate revenue waterfall analysis', async () => {
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      // Mock the recognized revenue query
      vi.mocked(db.select).mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ total: 500000 }]),
      } as any));

      // Act
      const result = await service.getRevenueWaterfall({
        startDate,
        endDate,
        compareToASC605: false
      });

      // Assert
      expect(result.waterfall).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            component: 'Beginning Deferred Revenue',
            amount: expect.any(Number),
            type: 'opening'
          }),
          expect.objectContaining({
            component: 'New Bookings',
            amount: expect.any(Number),
            type: 'addition'
          }),
          expect.objectContaining({
            component: 'Revenue Recognized',
            amount: expect.any(Number),
            type: 'subtraction'
          }),
          expect.objectContaining({
            component: 'Ending Deferred Revenue',
            amount: expect.any(Number),
            type: 'closing'
          })
        ])
      );
    });

    it('should include ASC 605 comparison when requested', async () => {
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      // Mock the recognized revenue query
      vi.mocked(db.select).mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ total: 500000 }]),
      } as any));

      // Act
      const result = await service.getRevenueWaterfall({
        startDate,
        endDate,
        compareToASC605: true
      });

      // Assert
      expect(result.asc605Comparison).toBeDefined();
      expect(result.asc605Comparison).toEqual(
        expect.objectContaining({
          asc605Revenue: expect.any(Number),
          asc606Revenue: expect.any(Number),
          difference: expect.any(Number),
          percentageDifference: expect.any(Number)
        })
      );
    });
  });

  describe('compareASC605vs606', () => {
    it('should compare revenue under different standards', async () => {
      // Arrange
      const subscriptionId = 'sub-123';
      const comparisonDate = new Date('2024-01-31');

      // Act
      const result = await service.compareASC605vs606(subscriptionId, comparisonDate);

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          subscriptionId,
          comparisonDate,
          asc605: expect.objectContaining({
            totalRecognized: expect.any(Number),
            recognitionPattern: expect.any(String),
            keyAssumptions: expect.any(Array)
          }),
          asc606: expect.objectContaining({
            totalRecognized: expect.any(Number),
            recognitionPattern: expect.any(String),
            keyAssumptions: expect.any(Array)
          }),
          variance: expect.objectContaining({
            amount: expect.any(Number),
            percentage: expect.any(Number),
            explanation: expect.any(Array)
          })
        })
      );
    });

    it('should explain variance between standards', async () => {
      // Act
      const result = await service.compareASC605vs606('sub-123', mockDate);

      // Assert
      expect(result.variance.explanation).toEqual(
        expect.arrayContaining([
          expect.any(String)
        ])
      );
      expect(result.variance.explanation.length).toBeGreaterThan(0);
    });
  });

  describe('Revenue Summary', () => {
    it('should generate revenue summary with grouping', async () => {
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      // Mock the database queries
      vi.mocked(db.select).mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ total: 1000000 }]),
      } as any));

      // Act
      const result = await service.getRevenueSummary({
        startDate,
        endDate,
        groupBy: 'month'
      });

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          startDate,
          endDate,
          groupBy: 'month',
          recognized: expect.any(Number),
          deferred: expect.any(Number),
          scheduled: expect.any(Number),
          periods: expect.any(Array)
        })
      );
    });
  });
});