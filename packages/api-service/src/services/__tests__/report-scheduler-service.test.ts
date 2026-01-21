import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceContext } from '../../types';

// Use vi.hoisted() to properly hoist mock functions
const {
  mockScheduleCreate,
  mockScheduleFindById,
  mockScheduleFindByIdWithExecutions,
  mockScheduleUpdate,
  mockScheduleDelete,
  mockScheduleList,
  mockScheduleFindDueSchedules,
  mockScheduleRecordSuccess,
  mockScheduleRecordFailure,
  mockScheduleSetErrorStatus,
  mockScheduleMarkCompleted,
  mockScheduleUpdateNextRunTime,
  mockExecutionCreate,
  mockExecutionFindById,
  mockExecutionMarkStarted,
  mockExecutionMarkCompleted,
  mockExecutionMarkFailed,
  mockExecutionGetNextNumber,
  mockScheduleGetStats,
} = vi.hoisted(() => ({
  mockScheduleCreate: vi.fn(),
  mockScheduleFindById: vi.fn(),
  mockScheduleFindByIdWithExecutions: vi.fn(),
  mockScheduleUpdate: vi.fn(),
  mockScheduleDelete: vi.fn(),
  mockScheduleList: vi.fn(),
  mockScheduleFindDueSchedules: vi.fn(),
  mockScheduleRecordSuccess: vi.fn(),
  mockScheduleRecordFailure: vi.fn(),
  mockScheduleSetErrorStatus: vi.fn(),
  mockScheduleMarkCompleted: vi.fn(),
  mockScheduleUpdateNextRunTime: vi.fn(),
  mockExecutionCreate: vi.fn(),
  mockExecutionFindById: vi.fn(),
  mockExecutionMarkStarted: vi.fn(),
  mockExecutionMarkCompleted: vi.fn(),
  mockExecutionMarkFailed: vi.fn(),
  mockExecutionGetNextNumber: vi.fn(),
  mockScheduleGetStats: vi.fn(),
}));

// Mock the database module
vi.mock('@glapi/database', () => ({
  ReportScheduleRepository: vi.fn().mockImplementation(() => ({
    create: mockScheduleCreate,
    findById: mockScheduleFindById,
    findByIdWithExecutions: mockScheduleFindByIdWithExecutions,
    update: mockScheduleUpdate,
    delete: mockScheduleDelete,
    list: mockScheduleList,
    findDueSchedules: mockScheduleFindDueSchedules,
    recordSuccess: mockScheduleRecordSuccess,
    recordFailure: mockScheduleRecordFailure,
    setErrorStatus: mockScheduleSetErrorStatus,
    markCompleted: mockScheduleMarkCompleted,
    updateNextRunTime: mockScheduleUpdateNextRunTime,
    createExecution: mockExecutionCreate,
    findExecutionById: mockExecutionFindById,
    markExecutionStarted: mockExecutionMarkStarted,
    markExecutionCompleted: mockExecutionMarkCompleted,
    markExecutionFailed: mockExecutionMarkFailed,
    getNextExecutionNumber: mockExecutionGetNextNumber,
    getScheduleStats: mockScheduleGetStats,
    listExecutions: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    findPendingExecutions: vi.fn().mockResolvedValue([]),
    findRetryableExecutions: vi.fn().mockResolvedValue([]),
  })),
  reportScheduleRepository: {
    create: mockScheduleCreate,
    findById: mockScheduleFindById,
    findByIdWithExecutions: mockScheduleFindByIdWithExecutions,
    update: mockScheduleUpdate,
    delete: mockScheduleDelete,
    list: mockScheduleList,
    findDueSchedules: mockScheduleFindDueSchedules,
    recordSuccess: mockScheduleRecordSuccess,
    recordFailure: mockScheduleRecordFailure,
    setErrorStatus: mockScheduleSetErrorStatus,
    markCompleted: mockScheduleMarkCompleted,
    updateNextRunTime: mockScheduleUpdateNextRunTime,
    createExecution: mockExecutionCreate,
    findExecutionById: mockExecutionFindById,
    markExecutionStarted: mockExecutionMarkStarted,
    markExecutionCompleted: mockExecutionMarkCompleted,
    markExecutionFailed: mockExecutionMarkFailed,
    getNextExecutionNumber: mockExecutionGetNextNumber,
    getScheduleStats: mockScheduleGetStats,
    listExecutions: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    findPendingExecutions: vi.fn().mockResolvedValue([]),
    findRetryableExecutions: vi.fn().mockResolvedValue([]),
  },
}));

// Import after mocking
import { ReportSchedulerService } from '../report-scheduler-service';

describe('ReportSchedulerService', () => {
  let service: ReportSchedulerService;
  let context: ServiceContext;

  const testOrgId = 'org-123';
  const testUserId = 'user-123';
  const testScheduleId = 'sched-123';
  const testExecutionId = 'exec-123';

  const mockSchedule = {
    id: testScheduleId,
    organizationId: testOrgId,
    name: 'Daily Income Statement',
    description: 'Daily financial report',
    reportType: 'income_statement',
    outputFormat: 'json',
    filters: { relativeDateRange: 'last_month' },
    frequency: 'daily',
    cronExpression: null,
    timezone: 'America/New_York',
    dayOfWeek: null,
    dayOfMonth: null,
    monthOfYear: null,
    timeOfDay: '06:00:00',
    status: 'active',
    isEnabled: true,
    nextRunAt: new Date('2026-01-21T06:00:00Z'),
    lastRunAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastErrorMessage: null,
    totalRuns: 0,
    successfulRuns: 0,
    failedRuns: 0,
    maxRetries: 3,
    retryDelaySeconds: 300,
    runUntil: null,
    maxRuns: null,
    notifyOnSuccess: false,
    notifyOnFailure: true,
    notificationEmails: [],
    deliveryConfig: null,
    tags: [],
    metadata: null,
    createdBy: testUserId,
    updatedBy: testUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockExecution = {
    id: testExecutionId,
    reportScheduleId: testScheduleId,
    organizationId: testOrgId,
    executionNumber: 1,
    status: 'pending',
    scheduledAt: new Date('2026-01-21T06:00:00Z'),
    startedAt: null,
    completedAt: null,
    durationMs: null,
    attemptNumber: 1,
    nextRetryAt: null,
    outputLocation: null,
    outputSizeBytes: null,
    rowCount: null,
    errorCode: null,
    errorMessage: null,
    errorStack: null,
    filtersSnapshot: { relativeDateRange: 'last_month' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    context = {
      organizationId: testOrgId,
      userId: testUserId,
    };

    service = new ReportSchedulerService(context);

    // Default mock implementations
    mockExecutionGetNextNumber.mockResolvedValue(1);
    mockScheduleGetStats.mockResolvedValue({
      total: 10,
      active: 5,
      paused: 2,
      error: 1,
      totalExecutionsToday: 20,
      successfulExecutionsToday: 18,
      failedExecutionsToday: 2,
    });
  });

  // ============================================================================
  // Schedule CRUD Tests
  // ============================================================================

  describe('createSchedule', () => {
    it('should create a new schedule with correct next run time', async () => {
      mockScheduleCreate.mockResolvedValue(mockSchedule);

      const result = await service.createSchedule({
        name: 'Daily Income Statement',
        reportType: 'income_statement',
        frequency: 'daily',
        timezone: 'America/New_York',
        timeOfDay: '06:00:00',
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('Daily Income Statement');
      expect(mockScheduleCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: testOrgId,
          name: 'Daily Income Statement',
          frequency: 'daily',
          status: 'draft',
          nextRunAt: expect.any(Date),
        })
      );
    });

    it('should validate cron expression for cron frequency', async () => {
      mockScheduleCreate.mockResolvedValue(mockSchedule);

      await expect(
        service.createSchedule({
          name: 'Test Schedule',
          reportType: 'income_statement',
          frequency: 'cron',
          cronExpression: '0 6 * * *', // Valid cron
        })
      ).resolves.toBeDefined();
    });

    it('should reject invalid cron expression', async () => {
      await expect(
        service.createSchedule({
          name: 'Test Schedule',
          reportType: 'income_statement',
          frequency: 'cron',
          cronExpression: 'invalid cron',
        })
      ).rejects.toThrow('Invalid cron expression');
    });

    it('should validate timezone', async () => {
      await expect(
        service.createSchedule({
          name: 'Test Schedule',
          reportType: 'income_statement',
          frequency: 'daily',
          timezone: 'Invalid/Timezone',
        })
      ).rejects.toThrow('Invalid timezone');
    });
  });

  describe('getSchedule', () => {
    it('should return schedule for same organization', async () => {
      mockScheduleFindById.mockResolvedValue(mockSchedule);

      const result = await service.getSchedule(testScheduleId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(testScheduleId);
    });

    it('should throw error for schedule in different organization', async () => {
      mockScheduleFindById.mockResolvedValue({
        ...mockSchedule,
        organizationId: 'other-org',
      });

      await expect(service.getSchedule(testScheduleId)).rejects.toThrow('Schedule not found');
    });

    it('should return null for non-existent schedule', async () => {
      mockScheduleFindById.mockResolvedValue(null);

      const result = await service.getSchedule('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateSchedule', () => {
    it('should update schedule and recalculate next run time if scheduling params change', async () => {
      mockScheduleFindById.mockResolvedValue(mockSchedule);
      mockScheduleUpdate.mockResolvedValue({
        ...mockSchedule,
        timeOfDay: '08:00:00',
      });

      const result = await service.updateSchedule(testScheduleId, {
        timeOfDay: '08:00:00',
      });

      expect(result.timeOfDay).toBe('08:00:00');
      expect(mockScheduleUpdate).toHaveBeenCalledWith(
        testScheduleId,
        expect.objectContaining({
          timeOfDay: '08:00:00',
          nextRunAt: expect.any(Date),
        })
      );
    });

    it('should throw error for non-existent schedule', async () => {
      mockScheduleFindById.mockResolvedValue(null);

      await expect(
        service.updateSchedule('non-existent', { name: 'New Name' })
      ).rejects.toThrow('Schedule not found');
    });
  });

  describe('listSchedules', () => {
    it('should list schedules with pagination', async () => {
      mockScheduleList.mockResolvedValue({
        data: [mockSchedule],
        total: 1,
      });

      const result = await service.listSchedules({ page: 1, limit: 50 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
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

  // ============================================================================
  // Schedule Status Management Tests
  // ============================================================================

  describe('activateSchedule', () => {
    it('should activate a draft schedule', async () => {
      const draftSchedule = { ...mockSchedule, status: 'draft' };
      mockScheduleFindById.mockResolvedValue(draftSchedule);
      mockScheduleUpdate.mockResolvedValue({ ...mockSchedule, status: 'active' });

      const result = await service.activateSchedule(testScheduleId);

      expect(result.status).toBe('active');
    });

    it('should not activate an already active schedule', async () => {
      mockScheduleFindById.mockResolvedValue(mockSchedule);

      await expect(service.activateSchedule(testScheduleId)).rejects.toThrow(
        'Cannot activate schedule in active status'
      );
    });
  });

  describe('pauseSchedule', () => {
    it('should pause an active schedule', async () => {
      mockScheduleFindById.mockResolvedValue(mockSchedule);
      mockScheduleUpdate.mockResolvedValue({ ...mockSchedule, status: 'paused' });

      const result = await service.pauseSchedule(testScheduleId);

      expect(result.status).toBe('paused');
    });

    it('should not pause a non-active schedule', async () => {
      mockScheduleFindById.mockResolvedValue({ ...mockSchedule, status: 'paused' });

      await expect(service.pauseSchedule(testScheduleId)).rejects.toThrow(
        'Cannot pause schedule in paused status'
      );
    });
  });

  // ============================================================================
  // Execution Management Tests
  // ============================================================================

  describe('createExecution', () => {
    it('should create a new execution for a schedule', async () => {
      mockScheduleFindById.mockResolvedValue(mockSchedule);
      mockExecutionCreate.mockResolvedValue(mockExecution);

      const result = await service.createExecution(testScheduleId, new Date());

      expect(result).toBeDefined();
      expect(result.reportScheduleId).toBe(testScheduleId);
      expect(result.executionNumber).toBe(1);
    });

    it('should throw error for non-existent schedule', async () => {
      mockScheduleFindById.mockResolvedValue(null);

      await expect(
        service.createExecution('non-existent', new Date())
      ).rejects.toThrow('Schedule not found');
    });
  });

  describe('startExecution', () => {
    it('should start a pending execution', async () => {
      mockExecutionFindById.mockResolvedValue(mockExecution);
      mockExecutionMarkStarted.mockResolvedValue({
        ...mockExecution,
        status: 'running',
        startedAt: new Date(),
      });

      const result = await service.startExecution(testExecutionId);

      expect(result.status).toBe('running');
      expect(result.startedAt).toBeDefined();
    });

    it('should not start a non-pending execution', async () => {
      mockExecutionFindById.mockResolvedValue({
        ...mockExecution,
        status: 'running',
      });

      await expect(service.startExecution(testExecutionId)).rejects.toThrow(
        'Cannot start execution in running status'
      );
    });
  });

  describe('completeExecution', () => {
    it('should complete execution and schedule next run', async () => {
      mockExecutionFindById.mockResolvedValue({
        ...mockExecution,
        status: 'running',
        startedAt: new Date(),
      });
      mockScheduleFindById.mockResolvedValue(mockSchedule);
      mockExecutionMarkCompleted.mockResolvedValue({
        ...mockExecution,
        status: 'completed',
        completedAt: new Date(),
      });
      mockScheduleRecordSuccess.mockResolvedValue({
        ...mockSchedule,
        totalRuns: 1,
        successfulRuns: 1,
      });

      const result = await service.completeExecution(testExecutionId, {
        outputLocation: 's3://reports/output.json',
        rowCount: 100,
      });

      expect(result.execution.status).toBe('completed');
      expect(result.schedule.totalRuns).toBe(1);
    });

    it('should mark schedule as completed when max runs reached', async () => {
      const scheduleAtMaxRuns = {
        ...mockSchedule,
        totalRuns: 9,
        maxRuns: 10,
      };
      mockExecutionFindById.mockResolvedValue({
        ...mockExecution,
        status: 'running',
      });
      mockScheduleFindById.mockResolvedValue(scheduleAtMaxRuns);
      mockExecutionMarkCompleted.mockResolvedValue({
        ...mockExecution,
        status: 'completed',
      });
      mockScheduleRecordSuccess.mockResolvedValue({
        ...scheduleAtMaxRuns,
        totalRuns: 10,
      });
      mockScheduleMarkCompleted.mockResolvedValue({
        ...scheduleAtMaxRuns,
        status: 'completed',
        totalRuns: 10,
      });

      const result = await service.completeExecution(testExecutionId, {});

      expect(mockScheduleMarkCompleted).toHaveBeenCalled();
    });
  });

  describe('failExecution', () => {
    it('should fail execution and schedule retry', async () => {
      mockExecutionFindById.mockResolvedValue({
        ...mockExecution,
        status: 'running',
        startedAt: new Date(),
        attemptNumber: 1,
      });
      mockScheduleFindById.mockResolvedValue(mockSchedule);
      mockExecutionMarkFailed.mockResolvedValue({
        ...mockExecution,
        status: 'failed',
        errorMessage: 'Test error',
        attemptNumber: 2,
      });
      mockScheduleRecordFailure.mockResolvedValue({
        ...mockSchedule,
        failedRuns: 1,
      });

      const result = await service.failExecution(testExecutionId, {
        errorMessage: 'Test error',
      });

      expect(result.execution.status).toBe('failed');
      expect(mockExecutionMarkFailed).toHaveBeenCalledWith(
        testExecutionId,
        expect.objectContaining({ errorMessage: 'Test error' }),
        expect.any(Date) // nextRetryAt
      );
    });

    it('should set schedule to error after max retries', async () => {
      mockExecutionFindById.mockResolvedValue({
        ...mockExecution,
        status: 'running',
        attemptNumber: 3, // Max retries reached
      });
      mockScheduleFindById.mockResolvedValue(mockSchedule);
      mockExecutionMarkFailed.mockResolvedValue({
        ...mockExecution,
        status: 'failed',
        attemptNumber: 4,
      });
      mockScheduleRecordFailure.mockResolvedValue({
        ...mockSchedule,
        failedRuns: 1,
      });
      mockScheduleSetErrorStatus.mockResolvedValue({
        ...mockSchedule,
        status: 'error',
      });

      const result = await service.failExecution(testExecutionId, {
        errorMessage: 'Max retries exceeded',
      });

      expect(mockScheduleSetErrorStatus).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Scheduling Edge Cases Tests
  // ============================================================================

  describe('calculateNextRunTime', () => {
    describe('daily frequency', () => {
      it('should calculate next run for tomorrow if time has passed today', () => {
        // Set a time that has passed today
        const now = new Date('2026-01-20T10:00:00Z');
        vi.setSystemTime(now);

        const nextRun = service.calculateNextRunTime({
          frequency: 'daily',
          timezone: 'UTC',
          timeOfDay: '06:00:00', // 6 AM already passed
        });

        // Should be tomorrow at 6 AM
        expect(nextRun.getDate()).toBe(21);
        expect(nextRun.getHours()).toBe(6);
      });

      it('should calculate next run for today if time has not passed', () => {
        const now = new Date('2026-01-20T05:00:00Z');
        vi.setSystemTime(now);

        const nextRun = service.calculateNextRunTime({
          frequency: 'daily',
          timezone: 'UTC',
          timeOfDay: '06:00:00',
        });

        expect(nextRun.getDate()).toBe(20);
        expect(nextRun.getHours()).toBe(6);
      });
    });

    describe('weekly frequency', () => {
      it('should calculate next run for target day of week', () => {
        // Monday
        const now = new Date('2026-01-20T10:00:00Z');
        vi.setSystemTime(now);

        const nextRun = service.calculateNextRunTime({
          frequency: 'weekly',
          timezone: 'UTC',
          dayOfWeek: 3, // Wednesday
          timeOfDay: '06:00:00',
        });

        // Should be Wednesday
        expect(nextRun.getDay()).toBe(3);
      });

      it('should calculate next week if target day has passed', () => {
        // Thursday
        const now = new Date('2026-01-22T10:00:00Z');
        vi.setSystemTime(now);

        const nextRun = service.calculateNextRunTime({
          frequency: 'weekly',
          timezone: 'UTC',
          dayOfWeek: 1, // Monday (passed)
          timeOfDay: '06:00:00',
        });

        // Should be next Monday
        expect(nextRun.getDay()).toBe(1);
        expect(nextRun > now).toBe(true);
      });
    });

    describe('monthly frequency', () => {
      it('should calculate next run for target day of month', () => {
        const now = new Date('2026-01-10T10:00:00Z');
        vi.setSystemTime(now);

        const nextRun = service.calculateNextRunTime({
          frequency: 'monthly',
          timezone: 'UTC',
          dayOfMonth: 15,
          timeOfDay: '06:00:00',
        });

        expect(nextRun.getDate()).toBe(15);
        expect(nextRun.getMonth()).toBe(0); // January
      });

      it('should handle months with fewer days', () => {
        const now = new Date('2026-02-01T10:00:00Z');
        vi.setSystemTime(now);

        const nextRun = service.calculateNextRunTime({
          frequency: 'monthly',
          timezone: 'UTC',
          dayOfMonth: 31, // February doesn't have 31 days
          timeOfDay: '06:00:00',
        });

        // Should use last day of February
        expect(nextRun.getDate()).toBe(28);
      });

      it('should go to next month if day has passed', () => {
        const now = new Date('2026-01-20T10:00:00Z');
        vi.setSystemTime(now);

        const nextRun = service.calculateNextRunTime({
          frequency: 'monthly',
          timezone: 'UTC',
          dayOfMonth: 15, // Passed
          timeOfDay: '06:00:00',
        });

        expect(nextRun.getMonth()).toBe(1); // February
        expect(nextRun.getDate()).toBe(15);
      });
    });

    describe('quarterly frequency', () => {
      it('should calculate next quarterly run', () => {
        const now = new Date('2026-01-10T10:00:00Z');
        vi.setSystemTime(now);

        const nextRun = service.calculateNextRunTime({
          frequency: 'quarterly',
          timezone: 'UTC',
          dayOfMonth: 15,
          timeOfDay: '06:00:00',
        });

        expect(nextRun.getDate()).toBe(15);
        expect(nextRun.getMonth()).toBe(0); // January (Q1 start)
      });

      it('should go to next quarter if current quarter date passed', () => {
        const now = new Date('2026-01-20T10:00:00Z');
        vi.setSystemTime(now);

        const nextRun = service.calculateNextRunTime({
          frequency: 'quarterly',
          timezone: 'UTC',
          dayOfMonth: 1, // Passed in Q1
          timeOfDay: '06:00:00',
        });

        // Should be April (Q2)
        expect(nextRun.getMonth()).toBe(3);
      });
    });

    describe('yearly frequency', () => {
      it('should calculate next yearly run', () => {
        const now = new Date('2026-01-10T10:00:00Z');
        vi.setSystemTime(now);

        const nextRun = service.calculateNextRunTime({
          frequency: 'yearly',
          timezone: 'UTC',
          monthOfYear: 3, // March
          dayOfMonth: 15,
          timeOfDay: '06:00:00',
        });

        expect(nextRun.getMonth()).toBe(2); // March (0-indexed)
        expect(nextRun.getDate()).toBe(15);
        expect(nextRun.getFullYear()).toBe(2026);
      });

      it('should go to next year if date passed', () => {
        const now = new Date('2026-06-10T10:00:00Z');
        vi.setSystemTime(now);

        const nextRun = service.calculateNextRunTime({
          frequency: 'yearly',
          timezone: 'UTC',
          monthOfYear: 1, // January (passed)
          dayOfMonth: 1,
          timeOfDay: '06:00:00',
        });

        expect(nextRun.getFullYear()).toBe(2027);
        expect(nextRun.getMonth()).toBe(0); // January
      });
    });

    describe('cron frequency', () => {
      it('should parse basic cron expression', () => {
        const now = new Date('2026-01-20T05:30:00Z');
        vi.setSystemTime(now);

        const nextRun = service.calculateNextRunTime({
          frequency: 'cron',
          cronExpression: '0 6 * * *', // Every day at 6 AM
          timezone: 'UTC',
          timeOfDay: '06:00:00',
        });

        expect(nextRun.getHours()).toBe(6);
        expect(nextRun.getMinutes()).toBe(0);
      });

      it('should handle step expressions', () => {
        const now = new Date('2026-01-20T00:00:00Z');
        vi.setSystemTime(now);

        const nextRun = service.calculateNextRunTime({
          frequency: 'cron',
          cronExpression: '*/15 * * * *', // Every 15 minutes
          timezone: 'UTC',
          timeOfDay: '06:00:00',
        });

        expect([0, 15, 30, 45]).toContain(nextRun.getMinutes());
      });

      it('should throw error for invalid cron', () => {
        expect(() =>
          service.calculateNextRunTime({
            frequency: 'cron',
            cronExpression: 'invalid',
            timezone: 'UTC',
            timeOfDay: '06:00:00',
          })
        ).toThrow();
      });
    });

    describe('once frequency', () => {
      it('should calculate single execution time', () => {
        const now = new Date('2026-01-20T05:00:00Z');
        vi.setSystemTime(now);

        const nextRun = service.calculateNextRunTime({
          frequency: 'once',
          timezone: 'UTC',
          timeOfDay: '06:00:00',
        });

        expect(nextRun.getHours()).toBe(6);
        expect(nextRun.getDate()).toBe(20); // Today since time hasn't passed
      });
    });
  });

  describe('validateCronExpression', () => {
    it('should accept valid 5-field cron expression', () => {
      expect(() => service.validateCronExpression('0 6 * * *')).not.toThrow();
    });

    it('should accept valid 6-field cron expression', () => {
      expect(() => service.validateCronExpression('0 0 6 * * *')).not.toThrow();
    });

    it('should reject expression with too few fields', () => {
      expect(() => service.validateCronExpression('0 6 *')).toThrow('must have 5 or 6 fields');
    });

    it('should reject expression with invalid characters', () => {
      expect(() => service.validateCronExpression('0 6 * * abc')).toThrow('invalid characters');
    });
  });

  describe('validateTimezone', () => {
    it('should accept valid IANA timezone', () => {
      expect(() => service.validateTimezone('America/New_York')).not.toThrow();
      expect(() => service.validateTimezone('Europe/London')).not.toThrow();
      expect(() => service.validateTimezone('UTC')).not.toThrow();
    });

    it('should reject invalid timezone', () => {
      expect(() => service.validateTimezone('Invalid/Timezone')).toThrow('Invalid timezone');
    });
  });

  // ============================================================================
  // Statistics Tests
  // ============================================================================

  describe('getStats', () => {
    it('should return scheduler statistics', async () => {
      const result = await service.getStats();

      expect(result.total).toBe(10);
      expect(result.active).toBe(5);
      expect(result.totalExecutionsToday).toBe(20);
      expect(mockScheduleGetStats).toHaveBeenCalledWith(testOrgId);
    });
  });
});
