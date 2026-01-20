import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceContext, ServiceError } from '../../types';

// Use vi.hoisted() to properly hoist mock functions for use in vi.mock factory
const {
  mockScheduleCreate,
  mockScheduleCreateWithLines,
  mockScheduleFindById,
  mockScheduleFindByIdWithLines,
  mockScheduleFindBySubscriptionId,
  mockScheduleFindActiveBySubscriptionId,
  mockScheduleUpdate,
  mockScheduleList,
  mockScheduleFindLinesDueToBill,
  mockScheduleFindOverdueLines,
  mockScheduleMarkLineAsInvoiced,
  mockScheduleMarkLineAsPaid,
  mockScheduleMarkLineAsCancelled,
  mockScheduleFindLineById,
  mockScheduleFindLinesByScheduleId,
  mockScheduleGenerateScheduleNumber,
  mockSubscriptionFindByIdWithItems,
} = vi.hoisted(() => ({
  mockScheduleCreate: vi.fn(),
  mockScheduleCreateWithLines: vi.fn(),
  mockScheduleFindById: vi.fn(),
  mockScheduleFindByIdWithLines: vi.fn(),
  mockScheduleFindBySubscriptionId: vi.fn(),
  mockScheduleFindActiveBySubscriptionId: vi.fn(),
  mockScheduleUpdate: vi.fn(),
  mockScheduleList: vi.fn(),
  mockScheduleFindLinesDueToBill: vi.fn(),
  mockScheduleFindOverdueLines: vi.fn(),
  mockScheduleMarkLineAsInvoiced: vi.fn(),
  mockScheduleMarkLineAsPaid: vi.fn(),
  mockScheduleMarkLineAsCancelled: vi.fn(),
  mockScheduleFindLineById: vi.fn(),
  mockScheduleFindLinesByScheduleId: vi.fn(),
  mockScheduleGenerateScheduleNumber: vi.fn(),
  mockSubscriptionFindByIdWithItems: vi.fn(),
}));

// Mock the database module
vi.mock('@glapi/database', () => ({
  BillingScheduleRepository: vi.fn().mockImplementation(() => ({
    create: mockScheduleCreate,
    createWithLines: mockScheduleCreateWithLines,
    findById: mockScheduleFindById,
    findByIdWithLines: mockScheduleFindByIdWithLines,
    findBySubscriptionId: mockScheduleFindBySubscriptionId,
    findActiveBySubscriptionId: mockScheduleFindActiveBySubscriptionId,
    update: mockScheduleUpdate,
    list: mockScheduleList,
    findLinesDueToBill: mockScheduleFindLinesDueToBill,
    findOverdueLines: mockScheduleFindOverdueLines,
    markLineAsInvoiced: mockScheduleMarkLineAsInvoiced,
    markLineAsPaid: mockScheduleMarkLineAsPaid,
    markLineAsCancelled: mockScheduleMarkLineAsCancelled,
    findLineById: mockScheduleFindLineById,
    findLinesByScheduleId: mockScheduleFindLinesByScheduleId,
    generateScheduleNumber: mockScheduleGenerateScheduleNumber,
  })),
  SubscriptionRepository: vi.fn().mockImplementation(() => ({
    findByIdWithItems: mockSubscriptionFindByIdWithItems,
  })),
}));

// Import after mocking
import { BillingScheduleService } from '../billing-schedule-service';

describe('BillingScheduleService', () => {
  let service: BillingScheduleService;
  let context: ServiceContext;

  const testOrgId = 'org-123';
  const testUserId = 'user-123';
  const testSubscriptionId = 'sub-123';
  const testScheduleId = 'sched-123';
  const testLineId = 'line-123';

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
        unitPrice: '1000.00',
        discountPercentage: '0',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      },
    ],
  };

  const mockSchedule = {
    id: testScheduleId,
    organizationId: testOrgId,
    subscriptionId: testSubscriptionId,
    scheduleNumber: 'SCHED-000001',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    frequency: 'monthly',
    billingDay: 1,
    paymentTermsDays: 30,
    status: 'active',
    nextBillingDate: '2024-01-01',
    lastBilledDate: null,
    lastBilledAmount: null,
    totalScheduledAmount: '12000.00',
    totalInvoicedAmount: '0',
    totalPaidAmount: '0',
    totalLines: 12,
    invoicedLines: 0,
    paidLines: 0,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockScheduleLine = {
    id: testLineId,
    billingScheduleId: testScheduleId,
    organizationId: testOrgId,
    sequenceNumber: 1,
    billingPeriodStart: '2024-01-01',
    billingPeriodEnd: '2024-01-31',
    scheduledBillingDate: '2024-01-01',
    dueDate: '2024-01-31',
    expectedAmount: '1000.00',
    isProrated: false,
    status: 'scheduled',
    invoiceId: null,
    invoicedDate: null,
    invoicedAmount: null,
  };

  const mockScheduleWithLines = {
    ...mockSchedule,
    lines: [mockScheduleLine],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    context = {
      organizationId: testOrgId,
      userId: testUserId,
    };

    service = new BillingScheduleService(context);

    // Default mock implementations
    mockScheduleGenerateScheduleNumber.mockResolvedValue('SCHED-000001');
  });

  describe('generateBillingSchedule', () => {
    it('should generate a billing schedule for an active subscription', async () => {
      mockSubscriptionFindByIdWithItems.mockResolvedValue(mockSubscription);
      mockScheduleCreateWithLines.mockResolvedValue(mockScheduleWithLines);

      const result = await service.generateBillingSchedule({
        subscriptionId: testSubscriptionId,
      });

      expect(result).toBeDefined();
      expect(result.subscriptionId).toBe(testSubscriptionId);
      expect(mockScheduleCreateWithLines).toHaveBeenCalled();
    });

    it('should throw error if subscription not found', async () => {
      mockSubscriptionFindByIdWithItems.mockResolvedValue(null);

      await expect(
        service.generateBillingSchedule({ subscriptionId: testSubscriptionId })
      ).rejects.toThrow('Subscription not found');
    });

    it('should throw error if subscription is not active', async () => {
      mockSubscriptionFindByIdWithItems.mockResolvedValue({
        ...mockSubscription,
        status: 'draft',
      });

      await expect(
        service.generateBillingSchedule({ subscriptionId: testSubscriptionId })
      ).rejects.toThrow('Billing schedule can only be generated for active subscriptions');
    });

    it('should throw error if subscription has no items', async () => {
      mockSubscriptionFindByIdWithItems.mockResolvedValue({
        ...mockSubscription,
        items: [],
      });

      await expect(
        service.generateBillingSchedule({ subscriptionId: testSubscriptionId })
      ).rejects.toThrow('Subscription must have items to generate a billing schedule');
    });

    it('should use custom billing day if provided', async () => {
      mockSubscriptionFindByIdWithItems.mockResolvedValue(mockSubscription);
      mockScheduleCreateWithLines.mockResolvedValue(mockScheduleWithLines);

      await service.generateBillingSchedule({
        subscriptionId: testSubscriptionId,
        billingDay: 15,
      });

      expect(mockScheduleCreateWithLines).toHaveBeenCalledWith(
        expect.objectContaining({ billingDay: 15 }),
        expect.any(Array)
      );
    });

    it('should use custom payment terms if provided', async () => {
      mockSubscriptionFindByIdWithItems.mockResolvedValue(mockSubscription);
      mockScheduleCreateWithLines.mockResolvedValue(mockScheduleWithLines);

      await service.generateBillingSchedule({
        subscriptionId: testSubscriptionId,
        paymentTermsDays: 45,
      });

      expect(mockScheduleCreateWithLines).toHaveBeenCalledWith(
        expect.objectContaining({ paymentTermsDays: 45 }),
        expect.any(Array)
      );
    });
  });

  describe('getScheduleById', () => {
    it('should return schedule with lines', async () => {
      mockScheduleFindByIdWithLines.mockResolvedValue(mockScheduleWithLines);

      const result = await service.getScheduleById(testScheduleId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(testScheduleId);
      expect(result?.lines).toHaveLength(1);
    });

    it('should return null for non-existent schedule', async () => {
      mockScheduleFindByIdWithLines.mockResolvedValue(null);

      const result = await service.getScheduleById('non-existent');

      expect(result).toBeNull();
    });

    it('should return null for schedule in different organization', async () => {
      mockScheduleFindByIdWithLines.mockResolvedValue({
        ...mockScheduleWithLines,
        organizationId: 'other-org',
      });

      const result = await service.getScheduleById(testScheduleId);

      expect(result).toBeNull();
    });
  });

  describe('getActiveScheduleBySubscription', () => {
    it('should return active schedule for subscription', async () => {
      mockSubscriptionFindByIdWithItems.mockResolvedValue(mockSubscription);
      mockScheduleFindActiveBySubscriptionId.mockResolvedValue(mockSchedule);
      mockScheduleFindByIdWithLines.mockResolvedValue(mockScheduleWithLines);

      const result = await service.getActiveScheduleBySubscription(testSubscriptionId);

      expect(result).toBeDefined();
      expect(result?.status).toBe('active');
    });

    it('should throw error if subscription not found', async () => {
      mockSubscriptionFindByIdWithItems.mockResolvedValue(null);

      await expect(
        service.getActiveScheduleBySubscription(testSubscriptionId)
      ).rejects.toThrow('Subscription not found');
    });

    it('should return null if no active schedule exists', async () => {
      mockSubscriptionFindByIdWithItems.mockResolvedValue(mockSubscription);
      mockScheduleFindActiveBySubscriptionId.mockResolvedValue(null);

      const result = await service.getActiveScheduleBySubscription(testSubscriptionId);

      expect(result).toBeNull();
    });
  });

  describe('listSchedules', () => {
    it('should list schedules with pagination', async () => {
      mockScheduleList.mockResolvedValue({
        data: [mockSchedule],
        total: 1,
      });

      const result = await service.listSchedules({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by subscription ID', async () => {
      mockScheduleList.mockResolvedValue({
        data: [mockSchedule],
        total: 1,
      });

      await service.listSchedules({ subscriptionId: testSubscriptionId });

      expect(mockScheduleList).toHaveBeenCalledWith(
        expect.objectContaining({ subscriptionId: testSubscriptionId })
      );
    });

    it('should filter by status', async () => {
      mockScheduleList.mockResolvedValue({
        data: [mockSchedule],
        total: 1,
      });

      await service.listSchedules({ status: 'active' });

      expect(mockScheduleList).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' })
      );
    });
  });

  describe('getLinesDueToBill', () => {
    it('should return lines due for billing', async () => {
      mockScheduleFindLinesDueToBill.mockResolvedValue([mockScheduleLine]);

      const result = await service.getLinesDueToBill(new Date('2024-01-15'));

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('scheduled');
    });

    it('should use current date if not provided', async () => {
      mockScheduleFindLinesDueToBill.mockResolvedValue([]);

      await service.getLinesDueToBill();

      expect(mockScheduleFindLinesDueToBill).toHaveBeenCalledWith(
        testOrgId,
        expect.any(Date)
      );
    });
  });

  describe('getOverdueLines', () => {
    it('should return overdue lines', async () => {
      const overdueLine = { ...mockScheduleLine, status: 'invoiced' };
      mockScheduleFindOverdueLines.mockResolvedValue([overdueLine]);

      const result = await service.getOverdueLines(new Date('2024-02-15'));

      expect(result).toHaveLength(1);
    });
  });

  describe('markLineInvoiced', () => {
    it('should mark line as invoiced', async () => {
      const invoicedLine = {
        ...mockScheduleLine,
        status: 'invoiced',
        invoiceId: 'inv-123',
        invoicedAmount: '1000.00',
      };
      mockScheduleFindLineById.mockResolvedValue(mockScheduleLine);
      mockScheduleMarkLineAsInvoiced.mockResolvedValue(invoicedLine);

      const result = await service.markLineInvoiced(testLineId, 'inv-123', '1000.00');

      expect(result.status).toBe('invoiced');
      expect(result.invoiceId).toBe('inv-123');
    });

    it('should throw error if line not found', async () => {
      mockScheduleFindLineById.mockResolvedValue(null);

      await expect(
        service.markLineInvoiced(testLineId, 'inv-123', '1000.00')
      ).rejects.toThrow('Billing schedule line not found');
    });

    it('should throw error if line is not scheduled', async () => {
      mockScheduleFindLineById.mockResolvedValue({
        ...mockScheduleLine,
        status: 'invoiced',
      });

      await expect(
        service.markLineInvoiced(testLineId, 'inv-123', '1000.00')
      ).rejects.toThrow("Cannot invoice line with status 'invoiced'");
    });
  });

  describe('markLinePaid', () => {
    it('should mark line as paid', async () => {
      const invoicedLine = { ...mockScheduleLine, status: 'invoiced' };
      const paidLine = { ...invoicedLine, status: 'paid' };
      mockScheduleFindLineById.mockResolvedValue(invoicedLine);
      mockScheduleMarkLineAsPaid.mockResolvedValue(paidLine);

      const result = await service.markLinePaid(testLineId);

      expect(result.status).toBe('paid');
    });

    it('should throw error if line is not invoiced', async () => {
      mockScheduleFindLineById.mockResolvedValue(mockScheduleLine);

      await expect(service.markLinePaid(testLineId)).rejects.toThrow(
        "Cannot mark line as paid with status 'scheduled'"
      );
    });
  });

  describe('pauseSchedule', () => {
    it('should pause an active schedule', async () => {
      const pausedSchedule = { ...mockSchedule, status: 'paused' };
      mockScheduleFindById.mockResolvedValue(mockSchedule);
      mockScheduleUpdate.mockResolvedValue(pausedSchedule);

      const result = await service.pauseSchedule(testScheduleId, 'Customer requested');

      expect(result.status).toBe('paused');
      expect(mockScheduleUpdate).toHaveBeenCalledWith(
        testScheduleId,
        expect.objectContaining({ status: 'paused', notes: 'Customer requested' })
      );
    });

    it('should throw error if schedule not found', async () => {
      mockScheduleFindById.mockResolvedValue(null);

      await expect(service.pauseSchedule(testScheduleId)).rejects.toThrow(
        'Billing schedule not found'
      );
    });

    it('should throw error if schedule is not active', async () => {
      mockScheduleFindById.mockResolvedValue({
        ...mockSchedule,
        status: 'paused',
      });

      await expect(service.pauseSchedule(testScheduleId)).rejects.toThrow(
        "Cannot pause schedule with status 'paused'"
      );
    });
  });

  describe('resumeSchedule', () => {
    it('should resume a paused schedule', async () => {
      const pausedSchedule = { ...mockSchedule, status: 'paused' };
      const activeSchedule = { ...mockSchedule, status: 'active' };
      mockScheduleFindById.mockResolvedValue(pausedSchedule);
      mockScheduleUpdate.mockResolvedValue(activeSchedule);

      const result = await service.resumeSchedule(testScheduleId);

      expect(result.status).toBe('active');
    });

    it('should throw error if schedule is not paused', async () => {
      mockScheduleFindById.mockResolvedValue(mockSchedule);

      await expect(service.resumeSchedule(testScheduleId)).rejects.toThrow(
        "Cannot resume schedule with status 'active'"
      );
    });
  });

  describe('cancelSchedule', () => {
    it('should cancel an active schedule', async () => {
      const cancelledSchedule = { ...mockSchedule, status: 'cancelled' };
      mockScheduleFindById.mockResolvedValue(mockSchedule);
      mockScheduleUpdate.mockResolvedValue(cancelledSchedule);
      mockScheduleFindLinesByScheduleId.mockResolvedValue([mockScheduleLine]);
      mockScheduleMarkLineAsCancelled.mockResolvedValue({
        ...mockScheduleLine,
        status: 'cancelled',
      });

      const result = await service.cancelSchedule(testScheduleId, 'Subscription cancelled');

      expect(result.status).toBe('cancelled');
      expect(mockScheduleMarkLineAsCancelled).toHaveBeenCalled();
    });

    it('should throw error if schedule is already cancelled', async () => {
      mockScheduleFindById.mockResolvedValue({
        ...mockSchedule,
        status: 'cancelled',
      });

      await expect(service.cancelSchedule(testScheduleId)).rejects.toThrow(
        "Cannot cancel schedule with status 'cancelled'"
      );
    });

    it('should throw error if schedule is completed', async () => {
      mockScheduleFindById.mockResolvedValue({
        ...mockSchedule,
        status: 'completed',
      });

      await expect(service.cancelSchedule(testScheduleId)).rejects.toThrow(
        "Cannot cancel schedule with status 'completed'"
      );
    });
  });

  describe('Billing Period Calculations', () => {
    it('should generate correct number of monthly periods for a year', async () => {
      mockSubscriptionFindByIdWithItems.mockResolvedValue({
        ...mockSubscription,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        billingFrequency: 'monthly',
      });

      // Capture the lines passed to createWithLines
      let capturedLines: any[] = [];
      mockScheduleCreateWithLines.mockImplementation(async (schedData, lines) => {
        capturedLines = lines;
        return {
          ...mockScheduleWithLines,
          lines: lines.map((l: any, i: number) => ({ ...l, id: `line-${i}` })),
        };
      });

      await service.generateBillingSchedule({ subscriptionId: testSubscriptionId });

      expect(capturedLines).toHaveLength(12);
    });

    it('should generate correct number of quarterly periods for a year', async () => {
      mockSubscriptionFindByIdWithItems.mockResolvedValue({
        ...mockSubscription,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        billingFrequency: 'quarterly',
      });

      let capturedLines: any[] = [];
      mockScheduleCreateWithLines.mockImplementation(async (schedData, lines) => {
        capturedLines = lines;
        return {
          ...mockScheduleWithLines,
          lines: lines.map((l: any, i: number) => ({ ...l, id: `line-${i}` })),
        };
      });

      await service.generateBillingSchedule({ subscriptionId: testSubscriptionId });

      expect(capturedLines).toHaveLength(4);
    });

    it('should generate correct number of annual periods for a year', async () => {
      mockSubscriptionFindByIdWithItems.mockResolvedValue({
        ...mockSubscription,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        billingFrequency: 'annual',
      });

      let capturedLines: any[] = [];
      mockScheduleCreateWithLines.mockImplementation(async (schedData, lines) => {
        capturedLines = lines;
        return {
          ...mockScheduleWithLines,
          lines: lines.map((l: any, i: number) => ({ ...l, id: `line-${i}` })),
        };
      });

      await service.generateBillingSchedule({ subscriptionId: testSubscriptionId });

      expect(capturedLines).toHaveLength(1);
    });

    it('should calculate correct period amounts for monthly billing', async () => {
      mockSubscriptionFindByIdWithItems.mockResolvedValue({
        ...mockSubscription,
        items: [
          {
            id: 'item-1',
            quantity: '1',
            unitPrice: '12000.00', // Annual price
            discountPercentage: '0',
            startDate: '2024-01-01',
          },
        ],
      });

      let capturedLines: any[] = [];
      mockScheduleCreateWithLines.mockImplementation(async (schedData, lines) => {
        capturedLines = lines;
        return mockScheduleWithLines;
      });

      await service.generateBillingSchedule({ subscriptionId: testSubscriptionId });

      // Monthly amount should be 12000 / 12 = 1000
      expect(parseFloat(capturedLines[0].expectedAmount)).toBe(1000);
    });
  });
});
