import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceContext, ServiceError } from '../../types';

// Define EventCategory enum to match the database schema
const EventCategory = {
  ACCOUNTING: 'ACCOUNTING',
  TRANSACTION: 'TRANSACTION',
  CONTRACT: 'CONTRACT',
  REVENUE: 'REVENUE',
} as const;

// Use vi.hoisted() to properly hoist mock functions for use in vi.mock factory
const {
  mockAppendEvent,
  mockAppendEvents,
  mockGetLatestVersion,
  mockQueryEvents,
  mockGetEventById,
} = vi.hoisted(() => ({
  mockAppendEvent: vi.fn(),
  mockAppendEvents: vi.fn(),
  mockGetLatestVersion: vi.fn(),
  mockQueryEvents: vi.fn(),
  mockGetEventById: vi.fn(),
}));

// Mock the database modules
vi.mock('@glapi/database', () => ({
  eventStoreRepository: {
    appendEvent: mockAppendEvent,
    appendEvents: mockAppendEvents,
    getLatestVersion: mockGetLatestVersion,
    queryEvents: mockQueryEvents,
    getEventById: mockGetEventById,
  },
  EventStoreRepository: vi.fn(),
}));

vi.mock('@glapi/database/schema', () => ({
  EventCategory: {
    ACCOUNTING: 'ACCOUNTING',
    TRANSACTION: 'TRANSACTION',
    CONTRACT: 'CONTRACT',
    REVENUE: 'REVENUE',
  },
}));

// Import after mocking
import { EventService, EmitEventInput } from '../event-service';

describe('EventService', () => {
  let service: EventService;
  let context: ServiceContext;

  // Mock logger
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    context = {
      organizationId: 'test-org-123',
      userId: 'test-user-123',
    };

    service = new EventService(context, {
      logger: mockLogger,
      retryConfig: {
        maxRetries: 2,
        baseDelayMs: 10, // Short delays for tests
        maxDelayMs: 50,
        backoffFactor: 2,
      },
    });
  });

  describe('emit', () => {
    const validEventInput: EmitEventInput = {
      eventType: 'TransactionPosted',
      eventCategory: EventCategory.ACCOUNTING,
      aggregateId: 'txn-123',
      aggregateType: 'GLTransaction',
      data: { amount: 1000, currency: 'USD' },
    };

    beforeEach(() => {
      mockGetLatestVersion.mockResolvedValue(0);
      mockAppendEvent.mockResolvedValue({
        event: {
          id: 'event-123',
          eventType: 'TransactionPosted',
          eventCategory: EventCategory.ACCOUNTING,
          aggregateId: 'txn-123',
          aggregateType: 'GLTransaction',
          eventVersion: 1,
          globalSequence: 1001,
          eventData: { amount: 1000, currency: 'USD' },
          correlationId: 'corr-123',
          organizationId: context.organizationId,
          createdAt: new Date(),
          eventTimestamp: new Date(),
        },
        outboxEntry: undefined,
      });
    });

    it('should emit a valid event', async () => {
      const result = await service.emit(validEventInput);

      expect(result.event).toBeDefined();
      expect(result.event.id).toBe('event-123');
      expect(result.event.eventType).toBe('TransactionPosted');
      expect(result.event.eventVersion).toBe(1);
      expect(result.published).toBe(false);
    });

    it('should auto-generate correlation ID when not provided', async () => {
      await service.emit(validEventInput);

      expect(mockAppendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: expect.any(String),
        }),
        undefined
      );
    });

    it('should use provided correlation ID', async () => {
      const input = {
        ...validEventInput,
        correlationId: 'custom-corr-id',
      };

      await service.emit(input);

      expect(mockAppendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: 'custom-corr-id',
        }),
        undefined
      );
    });

    it('should increment version from current aggregate version', async () => {
      mockGetLatestVersion.mockResolvedValue(5);

      await service.emit(validEventInput);

      expect(mockAppendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventVersion: 6,
        }),
        undefined
      );
    });

    it('should include user context in event', async () => {
      await service.emit(validEventInput);

      expect(mockAppendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user-123',
          organizationId: 'test-org-123',
        }),
        undefined
      );
    });

    it('should pass publish config to repository', async () => {
      const input = {
        ...validEventInput,
        publishConfig: {
          topic: 'accounting.transactions',
          partitionKey: 'txn-123',
        },
      };

      await service.emit(input);

      expect(mockAppendEvent).toHaveBeenCalledWith(
        expect.any(Object),
        {
          topic: 'accounting.transactions',
          partitionKey: 'txn-123',
        }
      );
    });

    it('should log event emission', async () => {
      await service.emit(validEventInput);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Emitting event',
        expect.objectContaining({
          eventType: 'TransactionPosted',
          aggregateType: 'GLTransaction',
          aggregateId: 'txn-123',
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Event emitted successfully',
        expect.objectContaining({
          eventId: 'event-123',
          eventType: 'TransactionPosted',
          version: 1,
        })
      );
    });

    describe('optimistic concurrency', () => {
      it('should throw CONCURRENCY_CONFLICT when expected version does not match', async () => {
        mockGetLatestVersion.mockResolvedValue(5);

        const input = {
          ...validEventInput,
          expectedVersion: 3, // Mismatch - current is 5
        };

        await expect(service.emit(input)).rejects.toThrow(ServiceError);
        await expect(service.emit(input)).rejects.toMatchObject({
          code: 'CONCURRENCY_CONFLICT',
          statusCode: 409,
        });
      });

      it('should succeed when expected version matches', async () => {
        mockGetLatestVersion.mockResolvedValue(5);

        const input = {
          ...validEventInput,
          expectedVersion: 5,
        };

        const result = await service.emit(input);
        expect(result.event).toBeDefined();
      });
    });

    describe('retry behavior', () => {
      it('should retry on transient failures', async () => {
        mockAppendEvent
          .mockRejectedValueOnce(new Error('Connection timeout'))
          .mockRejectedValueOnce(new Error('Connection timeout'))
          .mockResolvedValue({
            event: {
              id: 'event-123',
              eventType: 'TransactionPosted',
              eventVersion: 1,
              globalSequence: 1001,
            },
          });

        const result = await service.emit(validEventInput);

        expect(result.event.id).toBe('event-123');
        expect(mockAppendEvent).toHaveBeenCalledTimes(3);
        expect(mockLogger.warn).toHaveBeenCalledTimes(2);
      });

      it('should throw RETRY_EXHAUSTED after max retries', async () => {
        mockAppendEvent.mockRejectedValue(new Error('Database unavailable'));

        await expect(service.emit(validEventInput)).rejects.toThrow(ServiceError);
        await expect(service.emit(validEventInput)).rejects.toMatchObject({
          code: 'RETRY_EXHAUSTED',
          statusCode: 500,
        });
      });

      it('should not retry concurrency conflicts', async () => {
        mockGetLatestVersion.mockResolvedValue(5);

        const input = {
          ...validEventInput,
          expectedVersion: 3,
        };

        await expect(service.emit(input)).rejects.toMatchObject({
          code: 'CONCURRENCY_CONFLICT',
        });

        // Should only be called once for version check, not retried
        expect(mockGetLatestVersion).toHaveBeenCalledTimes(2); // Once per emit call
      });
    });

    describe('missing context', () => {
      it('should throw error when organization context is missing', async () => {
        const serviceWithoutOrg = new EventService({ userId: 'user-123' });

        await expect(serviceWithoutOrg.emit(validEventInput)).rejects.toThrow(ServiceError);
        await expect(serviceWithoutOrg.emit(validEventInput)).rejects.toMatchObject({
          code: 'MISSING_ORGANIZATION_CONTEXT',
        });
      });
    });
  });

  describe('emitBatch', () => {
    const batchInputs: EmitEventInput[] = [
      {
        eventType: 'TransactionCreated',
        eventCategory: EventCategory.TRANSACTION,
        aggregateId: 'txn-1',
        aggregateType: 'GLTransaction',
        data: { amount: 100 },
      },
      {
        eventType: 'TransactionCreated',
        eventCategory: EventCategory.TRANSACTION,
        aggregateId: 'txn-2',
        aggregateType: 'GLTransaction',
        data: { amount: 200 },
      },
    ];

    beforeEach(() => {
      mockGetLatestVersion.mockResolvedValue(0);
      mockAppendEvents.mockResolvedValue([
        {
          event: { id: 'event-1', eventVersion: 1, globalSequence: 1001 },
        },
        {
          event: { id: 'event-2', eventVersion: 1, globalSequence: 1002 },
        },
      ]);
    });

    it('should emit multiple events atomically', async () => {
      const results = await service.emitBatch(batchInputs);

      expect(results).toHaveLength(2);
      expect(results[0].event.id).toBe('event-1');
      expect(results[1].event.id).toBe('event-2');
    });

    it('should use shared correlation ID', async () => {
      await service.emitBatch(batchInputs, 'shared-corr-id');

      expect(mockAppendEvents).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            event: expect.objectContaining({
              correlationId: 'shared-corr-id',
            }),
          }),
        ])
      );
    });

    it('should track versions per aggregate', async () => {
      const inputsWithSameAggregate: EmitEventInput[] = [
        {
          eventType: 'Event1',
          eventCategory: EventCategory.TRANSACTION,
          aggregateId: 'txn-same',
          aggregateType: 'GLTransaction',
          data: { step: 1 },
        },
        {
          eventType: 'Event2',
          eventCategory: EventCategory.TRANSACTION,
          aggregateId: 'txn-same',
          aggregateType: 'GLTransaction',
          data: { step: 2 },
        },
      ];

      await service.emitBatch(inputsWithSameAggregate);

      expect(mockAppendEvents).toHaveBeenCalledWith([
        expect.objectContaining({
          event: expect.objectContaining({
            eventVersion: 1,
          }),
        }),
        expect.objectContaining({
          event: expect.objectContaining({
            eventVersion: 2,
          }),
        }),
      ]);
    });
  });

  describe('getAggregateHistory', () => {
    beforeEach(() => {
      mockQueryEvents.mockResolvedValue([
        { id: 'event-1', eventVersion: 1 },
        { id: 'event-2', eventVersion: 2 },
        { id: 'event-3', eventVersion: 3 },
      ]);
    });

    it('should return events for aggregate', async () => {
      const events = await service.getAggregateHistory('GLTransaction', 'txn-123');

      expect(events).toHaveLength(3);
      expect(mockQueryEvents).toHaveBeenCalledWith(
        context.organizationId,
        expect.objectContaining({
          aggregateType: 'GLTransaction',
          aggregateId: 'txn-123',
          orderBy: 'asc',
        })
      );
    });

    it('should support fromVersion filter', async () => {
      await service.getAggregateHistory('GLTransaction', 'txn-123', { fromVersion: 2 });

      expect(mockQueryEvents).toHaveBeenCalledWith(
        context.organizationId,
        expect.objectContaining({
          fromVersion: 2,
        })
      );
    });
  });

  describe('getCorrelatedEvents', () => {
    beforeEach(() => {
      mockQueryEvents.mockResolvedValue([
        { id: 'event-1', correlationId: 'corr-123' },
        { id: 'event-2', correlationId: 'corr-123' },
      ]);
    });

    it('should return events by correlation ID', async () => {
      const events = await service.getCorrelatedEvents('corr-123');

      expect(events).toHaveLength(2);
      expect(mockQueryEvents).toHaveBeenCalledWith(
        context.organizationId,
        expect.objectContaining({
          correlationId: 'corr-123',
          orderBy: 'asc',
        })
      );
    });
  });

  describe('getAggregateVersion', () => {
    it('should return current version', async () => {
      mockGetLatestVersion.mockResolvedValue(5);

      const version = await service.getAggregateVersion('GLTransaction', 'txn-123');

      expect(version).toBe(5);
      expect(mockGetLatestVersion).toHaveBeenCalledWith(
        context.organizationId,
        'GLTransaction',
        'txn-123'
      );
    });

    it('should return 0 for new aggregate', async () => {
      mockGetLatestVersion.mockResolvedValue(0);

      const version = await service.getAggregateVersion('GLTransaction', 'new-txn');

      expect(version).toBe(0);
    });
  });

  describe('startCorrelation', () => {
    it('should return a valid UUID', () => {
      const correlationId = service.startCorrelation();

      expect(correlationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('should log the new correlation', () => {
      service.startCorrelation();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Started new correlation context',
        expect.objectContaining({
          correlationId: expect.any(String),
        })
      );
    });
  });

  describe('causedBy', () => {
    it('should return the parent event ID', () => {
      const causationId = service.causedBy('parent-event-123');

      expect(causationId).toBe('parent-event-123');
    });
  });
});
