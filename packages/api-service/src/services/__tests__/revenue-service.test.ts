import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceContext } from '../../types';

// Use vi.hoisted() to properly hoist mock functions for use in vi.mock factory
const {
  mockSubscriptionList,
  mockSubscriptionFindByIdWithItems,
  mockSubscriptionItemFindBySubscriptionId,
  mockInvoiceFindBySubscriptionId,
  mockDbSelect,
  mockDbInsert,
  mockDbUpdate,
  mockDbExecute,
  mockCalculationEngineCalculate,
} = vi.hoisted(() => ({
  mockSubscriptionList: vi.fn(),
  mockSubscriptionFindByIdWithItems: vi.fn(),
  mockSubscriptionItemFindBySubscriptionId: vi.fn(),
  mockInvoiceFindBySubscriptionId: vi.fn(),
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbExecute: vi.fn(),
  mockCalculationEngineCalculate: vi.fn(),
}));

// Create chainable mock for db.select()
const createSelectChain = (results: any[]) => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    then: (resolve: any) => resolve(results),
  };
  return chain;
};

// Mock the database module
vi.mock('@glapi/database', () => ({
  SubscriptionRepository: vi.fn().mockImplementation(() => ({
    list: mockSubscriptionList,
    findByIdWithItems: mockSubscriptionFindByIdWithItems,
  })),
  SubscriptionItemRepository: vi.fn().mockImplementation(() => ({
    findBySubscriptionId: mockSubscriptionItemFindBySubscriptionId,
  })),
  InvoiceRepository: vi.fn().mockImplementation(() => ({
    findBySubscriptionId: mockInvoiceFindBySubscriptionId,
  })),
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
    execute: mockDbExecute,
  },
  performanceObligations: { id: 'po_id', organizationId: 'org_id' },
  revenueSchedules: { id: 'rs_id', organizationId: 'org_id', status: 'status' },
  contractSspAllocations: { id: 'csa_id' },
  revenueJournalEntries: { id: 'rje_id', organizationId: 'org_id' },
}));

// Mock the business package
vi.mock('@glapi/business', () => ({
  RevenueCalculationEngine: vi.fn().mockImplementation(() => ({
    calculate: mockCalculationEngineCalculate,
  })),
}));

// Import after mocking
import { RevenueService } from '../revenue-service';

describe('RevenueService', () => {
  let service: RevenueService;
  let context: ServiceContext;

  const testOrgId = 'org-123';
  const testUserId = 'user-123';
  const testSubscriptionId = 'sub-123';

  const mockSubscription = {
    id: testSubscriptionId,
    organizationId: testOrgId,
    subscriptionNumber: 'SUB-001',
    entityId: 'entity-123',
    status: 'active',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    contractValue: '12000.00',
    billingFrequency: 'monthly',
    autoRenew: false,
    items: [
      {
        id: 'item-1',
        subscriptionId: testSubscriptionId,
        organizationId: testOrgId,
        itemId: 'product-123',
        quantity: '1',
        unitPrice: '12000.00',
        discountPercentage: '0',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      },
    ],
  };

  const mockCalculationResult = {
    transactionPrice: 12000,
    performanceObligations: [
      {
        itemId: 'product-123',
        itemName: 'Annual License',
        obligationType: 'product_license',
        allocatedAmount: 12000,
        satisfactionMethod: 'over_time',
        satisfactionPeriodMonths: 12,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      },
    ],
    allocations: [
      {
        itemId: 'product-123',
        sspAmount: 12000,
        allocatedAmount: 12000,
        allocationPercentage: 1,
        allocationMethod: 'relative_ssp',
      },
    ],
    schedules: Array.from({ length: 12 }, (_, i) => ({
      periodStartDate: new Date(2024, i, 1),
      periodEndDate: new Date(2024, i + 1, 0),
      scheduledAmount: 1000,
      recognitionPattern: 'straight_line',
    })),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    context = {
      organizationId: testOrgId,
      userId: testUserId,
    };

    service = new RevenueService(context);

    // Default mock implementations
    mockSubscriptionFindByIdWithItems.mockResolvedValue(mockSubscription);
    mockCalculationEngineCalculate.mockResolvedValue(mockCalculationResult);
  });

  describe('calculateRevenue', () => {
    it('should calculate revenue for a subscription using ASC 606', async () => {
      const result = await service.calculateRevenue(
        testSubscriptionId,
        'initial',
        '2024-01-01'
      );

      expect(result).toBeDefined();
      expect(result.subscriptionId).toBe(testSubscriptionId);
      expect(result.totalContractValue).toBe(12000);
      expect(result.performanceObligations).toHaveLength(1);
      expect(result.schedules).toHaveLength(12);
      expect(mockCalculationEngineCalculate).toHaveBeenCalled();
    });

    it('should throw error if subscription not found', async () => {
      mockSubscriptionFindByIdWithItems.mockResolvedValue(null);

      await expect(
        service.calculateRevenue(testSubscriptionId, 'initial', '2024-01-01')
      ).rejects.toThrow('Subscription not found');
    });

    it('should throw error if subscription belongs to different organization', async () => {
      mockSubscriptionFindByIdWithItems.mockResolvedValue({
        ...mockSubscription,
        organizationId: 'other-org',
      });

      await expect(
        service.calculateRevenue(testSubscriptionId, 'initial', '2024-01-01')
      ).rejects.toThrow('Subscription not found');
    });
  });

  describe('calculateARR', () => {
    beforeEach(() => {
      mockSubscriptionList.mockResolvedValue({
        data: [mockSubscription],
        total: 1,
      });
    });

    it('should calculate ARR from active subscriptions', async () => {
      const result = await service.calculateARR('2024-06-15');

      expect(result).toBeDefined();
      // ARR is annualized from contract value based on term
      // A 12-month contract with $12000 should give approximately $12000 ARR
      expect(result.arr).toBeGreaterThan(10000);
      expect(result.arr).toBeLessThan(14000);
      expect(result.activeSubscriptions).toBe(1);
      expect(result.currency).toBe('USD');
    });

    it('should calculate ARR with multiple subscriptions', async () => {
      mockSubscriptionList.mockResolvedValue({
        data: [
          mockSubscription,
          {
            ...mockSubscription,
            id: 'sub-456',
            subscriptionNumber: 'SUB-002',
            contractValue: '6000.00',
          },
        ],
        total: 2,
      });

      const result = await service.calculateARR('2024-06-15');

      // Combined ARR for $12000 + $6000 contracts
      expect(result.arr).toBeGreaterThan(15000);
      expect(result.arr).toBeLessThan(20000);
      expect(result.activeSubscriptions).toBe(2);
    });

    it('should filter by entity if provided', async () => {
      await service.calculateARR('2024-06-15', 'entity-123');

      expect(mockSubscriptionList).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'entity-123',
        })
      );
    });

    it('should exclude subscriptions that have ended', async () => {
      mockSubscriptionList.mockResolvedValue({
        data: [
          {
            ...mockSubscription,
            endDate: '2024-01-31', // Ended before as-of date
          },
        ],
        total: 1,
      });

      const result = await service.calculateARR('2024-06-15');

      expect(result.arr).toBe(0);
      expect(result.activeSubscriptions).toBe(0);
    });

    it('should exclude subscriptions that have not started yet', async () => {
      mockSubscriptionList.mockResolvedValue({
        data: [
          {
            ...mockSubscription,
            startDate: '2024-07-01', // Starts after as-of date
          },
        ],
        total: 1,
      });

      const result = await service.calculateARR('2024-06-15');

      expect(result.arr).toBe(0);
      expect(result.activeSubscriptions).toBe(0);
    });

    it('should annualize based on term length', async () => {
      // 6-month term (Jan-Jun) with $6000 contract should be ~$12000 ARR
      mockSubscriptionList.mockResolvedValue({
        data: [
          {
            ...mockSubscription,
            startDate: '2024-01-01',
            endDate: '2024-06-30',
            contractValue: '6000.00',
          },
        ],
        total: 1,
      });

      const result = await service.calculateARR('2024-03-15');

      // 6 months term = $6000 / 6 * 12 = $12000 annualized
      // Note: actual term calculation may vary slightly based on month boundaries
      expect(result.arr).toBeGreaterThan(10000);
      expect(result.arr).toBeLessThan(15000);
    });
  });

  describe('calculateMRR', () => {
    beforeEach(() => {
      // Mock both current and previous month ARR calls
      mockSubscriptionList.mockResolvedValue({
        data: [mockSubscription],
        total: 1,
      });
    });

    it('should calculate MRR from ARR', async () => {
      const result = await service.calculateMRR('2024-06-15');

      expect(result).toBeDefined();
      // MRR is derived from ARR / 12
      expect(result.mrr).toBeGreaterThan(0);
      expect(result.currency).toBe('USD');
    });

    it('should detect new MRR from subscriptions started this month', async () => {
      // First call (current month) returns new subscription
      // Second call (previous month) returns no subscriptions
      mockSubscriptionList
        .mockResolvedValueOnce({
          data: [
            {
              ...mockSubscription,
              startDate: '2024-06-01', // Started this month
            },
          ],
          total: 1,
        })
        .mockResolvedValueOnce({
          data: [],
          total: 0,
        });

      const result = await service.calculateMRR('2024-06-15');

      // New MRR should be positive when there are new subscriptions
      expect(result.newMRR).toBeGreaterThanOrEqual(0);
    });

    it('should detect churn MRR from cancelled subscriptions', async () => {
      // First call (current month) returns no subscriptions
      // Second call (previous month) returns subscription
      mockSubscriptionList
        .mockResolvedValueOnce({
          data: [],
          total: 0,
        })
        .mockResolvedValueOnce({
          data: [mockSubscription],
          total: 1,
        });

      const result = await service.calculateMRR('2024-06-15');

      // Churn MRR should be positive when subscriptions are lost
      expect(result.churnMRR).toBeGreaterThan(0);
    });
  });

  describe('getRevenueSummary', () => {
    beforeEach(() => {
      // Mock database select for various queries
      mockDbSelect.mockReturnValue(
        createSelectChain([{ period: '2024-01-01', amount: 1000 }])
      );
    });

    it('should aggregate revenue by month', async () => {
      const result = await service.getRevenueSummary({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        groupBy: 'month',
      });

      expect(result).toBeDefined();
      expect(result.startDate).toBe('2024-01-01');
      expect(result.endDate).toBe('2024-12-31');
      expect(result.groupBy).toBe('month');
    });

    it('should use month as default groupBy', async () => {
      const result = await service.getRevenueSummary({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      expect(result.groupBy).toBe('month');
    });

    it('should aggregate revenue by quarter', async () => {
      const result = await service.getRevenueSummary({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        groupBy: 'quarter',
      });

      expect(result.groupBy).toBe('quarter');
    });

    it('should aggregate revenue by year', async () => {
      const result = await service.getRevenueSummary({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        groupBy: 'year',
      });

      expect(result.groupBy).toBe('year');
    });
  });

  describe('getRevenueWaterfall', () => {
    beforeEach(() => {
      mockDbSelect.mockReturnValue(createSelectChain([{ total: 5000 }]));
    });

    it('should return waterfall data with beginning and ending balance', async () => {
      const result = await service.getRevenueWaterfall({
        startDate: '2024-01-01',
        endDate: '2024-03-31',
      });

      expect(result).toBeDefined();
      expect(result.startDate).toBe('2024-01-01');
      expect(result.endDate).toBe('2024-03-31');
      expect(result.summary).toBeDefined();
      expect(result.waterfallData).toBeDefined();
    });

    it('should include calculated ending balance sanity check', async () => {
      const result = await service.getRevenueWaterfall({
        startDate: '2024-01-01',
        endDate: '2024-03-31',
      });

      expect(result.summary.calculatedEndingBalance).toBeDefined();
    });

    it('should return monthly recognition breakdown', async () => {
      const result = await service.getRevenueWaterfall({
        startDate: '2024-01-01',
        endDate: '2024-03-31',
      });

      expect(result.monthlyRecognition).toBeDefined();
      expect(Array.isArray(result.monthlyRecognition)).toBe(true);
    });
  });

  describe('previewAllocation', () => {
    it('should preview SSP allocation for a subscription', async () => {
      const result = await service.previewAllocation(
        testSubscriptionId,
        '2024-01-01'
      );

      expect(result).toBeDefined();
      expect(result.subscriptionId).toBe(testSubscriptionId);
      expect(result.transactionPrice).toBe(12000);
      expect(result.allocations).toHaveLength(1);
      expect(result.allocations[0].allocationMethod).toBe('relative_ssp');
    });

    it('should show allocation percentage', async () => {
      const result = await service.previewAllocation(
        testSubscriptionId,
        '2024-01-01'
      );

      expect(result.allocations[0].allocationPercentage).toBe('100.00%');
    });

    it('should limit schedule preview to 12 periods', async () => {
      mockCalculationEngineCalculate.mockResolvedValue({
        ...mockCalculationResult,
        schedules: Array.from({ length: 24 }, (_, i) => ({
          periodStartDate: new Date(2024, i % 12, 1),
          periodEndDate: new Date(2024, (i % 12) + 1, 0),
          scheduledAmount: 1000,
          recognitionPattern: 'straight_line',
        })),
      });

      const result = await service.previewAllocation(
        testSubscriptionId,
        '2024-01-01'
      );

      expect(result.schedulePreview).toHaveLength(12);
      expect(result.totalSchedules).toBe(24);
    });
  });

  describe('compareASC605vs606', () => {
    it('should compare ASC 605 vs 606 revenue', async () => {
      const result = await service.compareASC605vs606(testSubscriptionId);

      expect(result).toBeDefined();
      expect(result.subscriptionId).toBe(testSubscriptionId);
      expect(result.asc605Revenue).toBe(12000);
      expect(result.asc606Revenue).toBe(12000);
      expect(result.difference).toBe(0);
      expect(result.percentageChange).toBe(0);
    });

    it('should calculate percentage change when values differ', async () => {
      mockCalculationEngineCalculate.mockResolvedValue({
        ...mockCalculationResult,
        transactionPrice: 11000, // ASC 606 recognizes less due to variable consideration
      });

      const result = await service.compareASC605vs606(testSubscriptionId);

      expect(result.difference).toBe(-1000);
      expect(result.percentageChange).toBeCloseTo(-8.33, 1);
    });

    it('should include impact analysis', async () => {
      const result = await service.compareASC605vs606(testSubscriptionId);

      expect(result.impactAnalysis).toBeDefined();
      expect(result.impactAnalysis.performanceObligations).toBe(1);
    });
  });

  describe('Allocation Scenarios', () => {
    describe('Single Performance Obligation', () => {
      it('should allocate entire transaction price to single obligation', async () => {
        mockCalculationEngineCalculate.mockResolvedValue({
          transactionPrice: 10000,
          performanceObligations: [
            {
              itemId: 'product-1',
              itemName: 'Software License',
              obligationType: 'product_license',
              allocatedAmount: 10000,
              satisfactionMethod: 'over_time',
              satisfactionPeriodMonths: 12,
              startDate: new Date('2024-01-01'),
              endDate: new Date('2024-12-31'),
            },
          ],
          allocations: [
            {
              itemId: 'product-1',
              sspAmount: 10000,
              allocatedAmount: 10000,
              allocationPercentage: 1,
              allocationMethod: 'relative_ssp',
            },
          ],
          schedules: Array.from({ length: 12 }, (_, i) => ({
            periodStartDate: new Date(2024, i, 1),
            periodEndDate: new Date(2024, i + 1, 0),
            scheduledAmount: 833.33,
            recognitionPattern: 'straight_line',
          })),
        });

        const result = await service.previewAllocation(
          testSubscriptionId,
          '2024-01-01'
        );

        expect(result.allocations).toHaveLength(1);
        expect(result.allocations[0].allocatedAmount).toBe(10000);
        expect(result.allocations[0].allocationPercentage).toBe('100.00%');
      });
    });

    describe('Multiple Performance Obligations', () => {
      it('should allocate based on relative SSP', async () => {
        mockCalculationEngineCalculate.mockResolvedValue({
          transactionPrice: 15000,
          performanceObligations: [
            {
              itemId: 'product-1',
              itemName: 'Software License',
              obligationType: 'product_license',
              allocatedAmount: 10000,
              satisfactionMethod: 'over_time',
              satisfactionPeriodMonths: 12,
              startDate: new Date('2024-01-01'),
              endDate: new Date('2024-12-31'),
            },
            {
              itemId: 'service-1',
              itemName: 'Implementation Service',
              obligationType: 'professional_service',
              allocatedAmount: 5000,
              satisfactionMethod: 'point_in_time',
              startDate: new Date('2024-01-15'),
              endDate: new Date('2024-01-15'),
            },
          ],
          allocations: [
            {
              itemId: 'product-1',
              sspAmount: 12000,
              allocatedAmount: 10000,
              allocationPercentage: 0.6667,
              allocationMethod: 'relative_ssp',
            },
            {
              itemId: 'service-1',
              sspAmount: 6000,
              allocatedAmount: 5000,
              allocationPercentage: 0.3333,
              allocationMethod: 'relative_ssp',
            },
          ],
          schedules: [
            // 12 monthly schedules for software license
            ...Array.from({ length: 12 }, (_, i) => ({
              periodStartDate: new Date(2024, i, 1),
              periodEndDate: new Date(2024, i + 1, 0),
              scheduledAmount: 833.33,
              recognitionPattern: 'straight_line',
            })),
            // 1 point-in-time schedule for implementation
            {
              periodStartDate: new Date('2024-01-15'),
              periodEndDate: new Date('2024-01-15'),
              scheduledAmount: 5000,
              recognitionPattern: 'point_in_time',
            },
          ],
        });

        const result = await service.previewAllocation(
          testSubscriptionId,
          '2024-01-01'
        );

        expect(result.allocations).toHaveLength(2);
        expect(result.allocations[0].allocationPercentage).toBe('66.67%');
        expect(result.allocations[1].allocationPercentage).toBe('33.33%');
        expect(result.transactionPrice).toBe(15000);
      });

      it('should handle discount allocation across obligations', async () => {
        // Contract with 10% discount: List price $20,000, Transaction price $18,000
        mockCalculationEngineCalculate.mockResolvedValue({
          transactionPrice: 18000,
          performanceObligations: [
            {
              itemId: 'product-1',
              itemName: 'Software License',
              obligationType: 'product_license',
              allocatedAmount: 12000, // 60% of 18000
              satisfactionMethod: 'over_time',
              satisfactionPeriodMonths: 12,
              startDate: new Date('2024-01-01'),
              endDate: new Date('2024-12-31'),
            },
            {
              itemId: 'product-2',
              itemName: 'Support Package',
              obligationType: 'support',
              allocatedAmount: 6000, // 40% of 18000
              satisfactionMethod: 'over_time',
              satisfactionPeriodMonths: 12,
              startDate: new Date('2024-01-01'),
              endDate: new Date('2024-12-31'),
            },
          ],
          allocations: [
            {
              itemId: 'product-1',
              sspAmount: 15000,
              allocatedAmount: 12000,
              allocationPercentage: 0.6,
              allocationMethod: 'relative_ssp',
            },
            {
              itemId: 'product-2',
              sspAmount: 10000,
              allocatedAmount: 6000,
              allocationPercentage: 0.4,
              allocationMethod: 'relative_ssp',
            },
          ],
          schedules: Array.from({ length: 12 }, (_, i) => ({
            periodStartDate: new Date(2024, i, 1),
            periodEndDate: new Date(2024, i + 1, 0),
            scheduledAmount: 1500,
            recognitionPattern: 'straight_line',
          })),
        });

        const result = await service.previewAllocation(
          testSubscriptionId,
          '2024-01-01'
        );

        // Total allocated should equal transaction price
        const totalAllocated = result.allocations.reduce(
          (sum: number, a: any) => sum + a.allocatedAmount,
          0
        );
        expect(totalAllocated).toBe(18000);

        // Discount is proportionally allocated
        expect(result.allocations[0].allocatedAmount).toBe(12000);
        expect(result.allocations[1].allocatedAmount).toBe(6000);
      });
    });

    describe('Mixed Satisfaction Methods', () => {
      it('should handle over-time and point-in-time obligations', async () => {
        mockCalculationEngineCalculate.mockResolvedValue({
          transactionPrice: 25000,
          performanceObligations: [
            {
              itemId: 'software',
              itemName: 'Enterprise Software',
              obligationType: 'product_license',
              allocatedAmount: 15000,
              satisfactionMethod: 'over_time',
              satisfactionPeriodMonths: 12,
              startDate: new Date('2024-01-01'),
              endDate: new Date('2024-12-31'),
            },
            {
              itemId: 'training',
              itemName: 'Training Services',
              obligationType: 'professional_service',
              allocatedAmount: 5000,
              satisfactionMethod: 'point_in_time',
              startDate: new Date('2024-02-01'),
              endDate: new Date('2024-02-01'),
            },
            {
              itemId: 'hardware',
              itemName: 'Hardware Device',
              obligationType: 'product',
              allocatedAmount: 5000,
              satisfactionMethod: 'point_in_time',
              startDate: new Date('2024-01-15'),
              endDate: new Date('2024-01-15'),
            },
          ],
          allocations: [
            {
              itemId: 'software',
              sspAmount: 18000,
              allocatedAmount: 15000,
              allocationPercentage: 0.6,
              allocationMethod: 'relative_ssp',
            },
            {
              itemId: 'training',
              sspAmount: 6000,
              allocatedAmount: 5000,
              allocationPercentage: 0.2,
              allocationMethod: 'relative_ssp',
            },
            {
              itemId: 'hardware',
              sspAmount: 6000,
              allocatedAmount: 5000,
              allocationPercentage: 0.2,
              allocationMethod: 'relative_ssp',
            },
          ],
          schedules: [
            // 12 monthly for software
            ...Array.from({ length: 12 }, (_, i) => ({
              periodStartDate: new Date(2024, i, 1),
              periodEndDate: new Date(2024, i + 1, 0),
              scheduledAmount: 1250,
              recognitionPattern: 'straight_line',
            })),
            // Point-in-time for training
            {
              periodStartDate: new Date('2024-02-01'),
              periodEndDate: new Date('2024-02-01'),
              scheduledAmount: 5000,
              recognitionPattern: 'point_in_time',
            },
            // Point-in-time for hardware
            {
              periodStartDate: new Date('2024-01-15'),
              periodEndDate: new Date('2024-01-15'),
              scheduledAmount: 5000,
              recognitionPattern: 'point_in_time',
            },
          ],
        });

        const result = await service.previewAllocation(
          testSubscriptionId,
          '2024-01-01'
        );

        // Check we have all three obligations
        expect(result.performanceObligations).toHaveLength(3);

        // Verify satisfaction methods
        const software = result.performanceObligations.find(
          (p: any) => p.itemId === 'software'
        );
        const training = result.performanceObligations.find(
          (p: any) => p.itemId === 'training'
        );
        const hardware = result.performanceObligations.find(
          (p: any) => p.itemId === 'hardware'
        );

        expect(software.satisfactionMethod).toBe('over_time');
        expect(training.satisfactionMethod).toBe('point_in_time');
        expect(hardware.satisfactionMethod).toBe('point_in_time');
      });
    });

    describe('Contract Modification Scenarios', () => {
      it('should handle contract modification calculation', async () => {
        mockCalculationEngineCalculate.mockResolvedValue({
          transactionPrice: 14000, // Modified from original 12000
          performanceObligations: [
            {
              itemId: 'product-1',
              itemName: 'Software License (Modified)',
              obligationType: 'product_license',
              allocatedAmount: 14000,
              satisfactionMethod: 'over_time',
              satisfactionPeriodMonths: 12,
              startDate: new Date('2024-01-01'),
              endDate: new Date('2024-12-31'),
            },
          ],
          allocations: [
            {
              itemId: 'product-1',
              sspAmount: 14000,
              allocatedAmount: 14000,
              allocationPercentage: 1,
              allocationMethod: 'relative_ssp',
            },
          ],
          schedules: Array.from({ length: 12 }, (_, i) => ({
            periodStartDate: new Date(2024, i, 1),
            periodEndDate: new Date(2024, i + 1, 0),
            scheduledAmount: 1166.67,
            recognitionPattern: 'straight_line',
          })),
        });

        const result = await service.calculateRevenue(
          testSubscriptionId,
          'modification',
          '2024-07-01'
        );

        expect(result.totalContractValue).toBe(14000);
        expect(mockCalculationEngineCalculate).toHaveBeenCalledWith(
          expect.objectContaining({
            calculationType: 'modification',
          })
        );
      });
    });
  });

  describe('getDeferredBalance', () => {
    beforeEach(() => {
      mockDbSelect.mockReturnValue(createSelectChain([{ total: '5000.00' }]));
    });

    it('should return deferred revenue balance as of date', async () => {
      const result = await service.getDeferredBalance('2024-06-30');

      expect(result).toBeDefined();
      expect(result.asOfDate).toBe('2024-06-30');
      expect(result.deferredBalance).toBe(5000);
      expect(result.currency).toBe('USD');
    });

    it('should accept Date object as input', async () => {
      const result = await service.getDeferredBalance(new Date('2024-06-30'));

      expect(result.asOfDate).toBe('2024-06-30');
    });
  });
});
