# Event Service Documentation

## Overview

The Event Service provides a high-level API for emitting events to the event store with support for:

- **Automatic versioning** - Tracks event versions per aggregate
- **Correlation tracking** - Links related events across operations
- **Optimistic concurrency** - Prevents conflicting writes
- **Retry with backoff** - Handles transient failures
- **Structured logging** - Comprehensive operation logging
- **Outbox pattern** - Reliable event publishing

## Quick Start

```typescript
import { EventService, EventCategory, TransactionEvents } from '@glapi/api-service';

// Create service with context
const eventService = new EventService({
  organizationId: 'org-123',
  userId: 'user-456',
});

// Emit a single event
const result = await eventService.emit({
  eventType: TransactionEvents.POSTED,
  eventCategory: EventCategory.ACCOUNTING,
  aggregateId: 'txn-789',
  aggregateType: 'GLTransaction',
  data: {
    transactionNumber: 'GL-2025-001',
    debitAmount: 1000,
    creditAmount: 1000,
    currency: 'USD',
  },
});

console.log('Event emitted:', result.event.id);
```

## API Reference

### Constructor

```typescript
const service = new EventService(context, options?);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| context | ServiceContext | Required. Contains organizationId and userId |
| options.logger | EventServiceLogger | Optional. Custom logger implementation |
| options.retryConfig | RetryConfig | Optional. Retry behavior configuration |

### emit(input)

Emit a single event to the event store.

```typescript
const result = await eventService.emit<PaymentData>({
  eventType: 'PaymentCompleted',
  eventCategory: EventCategory.PAYMENT,
  aggregateId: 'payment-123',
  aggregateType: 'Payment',
  data: { amount: 500, currency: 'USD' },
  // Optional fields
  correlationId: 'corr-abc',      // Auto-generated if not provided
  causationId: 'parent-event-id', // Links to parent event
  expectedVersion: 3,              // For optimistic concurrency
  publishConfig: {                 // For outbox pattern
    topic: 'payments.completed',
    partitionKey: 'customer-456',
  },
});
```

**Returns:** `EmitEventResult`

| Field | Type | Description |
|-------|------|-------------|
| event | EventStoreRecord | The persisted event |
| published | boolean | Always false (outbox processor handles publishing) |
| outboxId | string? | Outbox entry ID if publishConfig was provided |

### emitBatch(inputs, sharedCorrelationId?)

Emit multiple events atomically.

```typescript
const results = await eventService.emitBatch([
  {
    eventType: 'ItemAdded',
    eventCategory: EventCategory.TRANSACTION,
    aggregateId: 'order-123',
    aggregateType: 'Order',
    data: { itemId: 'item-1', quantity: 2 },
  },
  {
    eventType: 'ItemAdded',
    eventCategory: EventCategory.TRANSACTION,
    aggregateId: 'order-123',
    aggregateType: 'Order',
    data: { itemId: 'item-2', quantity: 1 },
  },
], 'shared-correlation-id');
```

### getAggregateHistory(aggregateType, aggregateId, options?)

Get all events for an aggregate (for rebuilding state).

```typescript
const events = await eventService.getAggregateHistory(
  'GLTransaction',
  'txn-123',
  { fromVersion: 5, limit: 100 }
);
```

### getCorrelatedEvents(correlationId)

Get all events sharing a correlation ID (for distributed tracing).

```typescript
const events = await eventService.getCorrelatedEvents('corr-abc');
```

### getAggregateVersion(aggregateType, aggregateId)

Get the current version of an aggregate.

```typescript
const version = await eventService.getAggregateVersion('GLTransaction', 'txn-123');
```

### startCorrelation()

Generate a new correlation ID for linking related events.

```typescript
const correlationId = eventService.startCorrelation();
```

### causedBy(parentEventId)

Helper for creating causation chains.

```typescript
const result = await eventService.emit({
  eventType: 'JournalEntryCreated',
  causationId: eventService.causedBy(previousEvent.id),
  // ... other fields
});
```

## Sample Integration: GL Transaction Flow

Here's a complete example showing how to integrate the Event Service with GL transaction posting:

```typescript
import {
  EventService,
  EventCategory,
  TransactionEvents,
  createEventInput,
} from '@glapi/api-service';

class GLPostingService {
  private eventService: EventService;

  constructor(context: ServiceContext) {
    this.eventService = new EventService(context);
  }

  async postTransaction(transactionId: string, lines: TransactionLine[]): Promise<void> {
    // Start a correlation context for this operation
    const correlationId = this.eventService.startCorrelation();

    try {
      // 1. Emit transaction creation event
      const createResult = await this.eventService.emit({
        eventType: TransactionEvents.CREATED,
        eventCategory: EventCategory.ACCOUNTING,
        aggregateId: transactionId,
        aggregateType: 'GLTransaction',
        correlationId,
        data: {
          transactionId,
          lineCount: lines.length,
          totalDebit: lines.reduce((sum, l) => sum + (l.debitAmount || 0), 0),
          totalCredit: lines.reduce((sum, l) => sum + (l.creditAmount || 0), 0),
        },
        publishConfig: {
          topic: 'gl.transactions.created',
          partitionKey: transactionId,
        },
      });

      // 2. Validate and post - emit approval event
      const approveResult = await this.eventService.emit({
        eventType: TransactionEvents.APPROVED,
        eventCategory: EventCategory.APPROVAL,
        aggregateId: transactionId,
        aggregateType: 'GLTransaction',
        correlationId,
        causationId: this.eventService.causedBy(createResult.event.id),
        expectedVersion: 1, // Expect version 1 from create
        data: {
          approvedBy: this.eventService['context'].userId,
          approvedAt: new Date().toISOString(),
        },
      });

      // 3. Post to ledger - emit posted event
      await this.eventService.emit({
        eventType: TransactionEvents.POSTED,
        eventCategory: EventCategory.ACCOUNTING,
        aggregateId: transactionId,
        aggregateType: 'GLTransaction',
        correlationId,
        causationId: this.eventService.causedBy(approveResult.event.id),
        expectedVersion: 2,
        data: {
          postedAt: new Date().toISOString(),
          journalEntryNumber: await this.generateJournalNumber(),
          lines: lines.map((l) => ({
            accountId: l.accountId,
            debit: l.debitAmount,
            credit: l.creditAmount,
          })),
        },
        publishConfig: {
          topic: 'gl.transactions.posted',
          partitionKey: transactionId,
        },
      });

      console.log(`Transaction ${transactionId} posted. Correlation: ${correlationId}`);
    } catch (error) {
      // Handle errors - correlation ID helps with debugging
      console.error(`Failed to post transaction. Correlation: ${correlationId}`, error);
      throw error;
    }
  }

  async reverseTransaction(transactionId: string, reason: string): Promise<void> {
    const correlationId = this.eventService.startCorrelation();

    // Get current version for optimistic concurrency
    const currentVersion = await this.eventService.getAggregateVersion(
      'GLTransaction',
      transactionId
    );

    await this.eventService.emit({
      eventType: TransactionEvents.REVERSED,
      eventCategory: EventCategory.ACCOUNTING,
      aggregateId: transactionId,
      aggregateType: 'GLTransaction',
      correlationId,
      expectedVersion: currentVersion,
      data: {
        reversedAt: new Date().toISOString(),
        reversedBy: this.eventService['context'].userId,
        reason,
        originalVersion: currentVersion,
      },
      publishConfig: {
        topic: 'gl.transactions.reversed',
        partitionKey: transactionId,
      },
    });
  }

  private async generateJournalNumber(): Promise<string> {
    // Implementation details...
    return `JE-${Date.now()}`;
  }
}
```

## Subscription Events Example

```typescript
import { EventService, EventCategory, SubscriptionEvents } from '@glapi/api-service';

class SubscriptionLifecycleService {
  private eventService: EventService;

  constructor(context: ServiceContext) {
    this.eventService = new EventService(context);
  }

  async createSubscription(subscription: SubscriptionData): Promise<void> {
    const correlationId = this.eventService.startCorrelation();

    await this.eventService.emit({
      eventType: SubscriptionEvents.CREATED,
      eventCategory: EventCategory.SUBSCRIPTION,
      aggregateId: subscription.id,
      aggregateType: 'Subscription',
      correlationId,
      data: subscription,
      publishConfig: {
        topic: 'subscriptions.lifecycle',
        partitionKey: subscription.customerId,
      },
    });
  }

  async cancelSubscription(subscriptionId: string, reason: string): Promise<void> {
    await this.eventService.emit({
      eventType: SubscriptionEvents.CANCELLED,
      eventCategory: EventCategory.SUBSCRIPTION,
      aggregateId: subscriptionId,
      aggregateType: 'Subscription',
      data: {
        cancelledAt: new Date().toISOString(),
        reason,
      },
      publishConfig: {
        topic: 'subscriptions.lifecycle',
        partitionKey: subscriptionId,
      },
    });
  }
}
```

## Event Categories

| Category | Use Case |
|----------|----------|
| TRANSACTION | GL and business transactions |
| APPROVAL | Workflow approvals and rejections |
| PAYMENT | Payment processing events |
| ACCOUNTING | Core accounting operations |
| SUBSCRIPTION | Subscription lifecycle events |
| PROJECT | Project management events |
| CONTRACT | Contract lifecycle events |
| INVENTORY | Inventory operations |
| SYSTEM | System and administrative events |

## Predefined Event Types

### TransactionEvents
- `CREATED` - Transaction created
- `UPDATED` - Transaction modified
- `POSTED` - Transaction posted to ledger
- `REVERSED` - Transaction reversed
- `APPROVED` - Transaction approved
- `REJECTED` - Transaction rejected

### ContractEvents
- `CREATED` - Contract created
- `ACTIVATED` - Contract activated
- `MODIFIED` - Contract terms modified
- `TERMINATED` - Contract terminated
- `RENEWED` - Contract renewed

### SubscriptionEvents
- `CREATED` - Subscription created
- `ACTIVATED` - Subscription activated
- `PAUSED` - Subscription paused
- `RESUMED` - Subscription resumed
- `CANCELLED` - Subscription cancelled
- `RENEWED` - Subscription renewed
- `UPGRADED` - Plan upgraded
- `DOWNGRADED` - Plan downgraded

### PaymentEvents
- `INITIATED` - Payment initiated
- `COMPLETED` - Payment completed
- `FAILED` - Payment failed
- `REFUNDED` - Payment refunded

## Retry Configuration

```typescript
const service = new EventService(context, {
  retryConfig: {
    maxRetries: 3,         // Number of retry attempts
    baseDelayMs: 100,      // Initial delay between retries
    maxDelayMs: 5000,      // Maximum delay cap
    backoffFactor: 2,      // Exponential backoff multiplier
  },
});
```

## Custom Logger

```typescript
import pino from 'pino';

const logger = pino({ level: 'debug' });

const service = new EventService(context, {
  logger: {
    debug: (msg, ctx) => logger.debug(ctx, msg),
    info: (msg, ctx) => logger.info(ctx, msg),
    warn: (msg, ctx) => logger.warn(ctx, msg),
    error: (msg, ctx) => logger.error(ctx, msg),
  },
});
```

## Error Handling

| Error Code | Description | HTTP Status |
|------------|-------------|-------------|
| MISSING_ORGANIZATION_CONTEXT | No organization ID in context | 401 |
| CONCURRENCY_CONFLICT | Expected version mismatch | 409 |
| RETRY_EXHAUSTED | All retry attempts failed | 500 |

```typescript
try {
  await eventService.emit(eventInput);
} catch (error) {
  if (error instanceof ServiceError) {
    switch (error.code) {
      case 'CONCURRENCY_CONFLICT':
        // Reload aggregate and retry
        break;
      case 'RETRY_EXHAUSTED':
        // Log and alert - possible system issue
        break;
    }
  }
}
```

## Related Documentation

- [Event Store Schema](/packages/database/docs/EVENT_STORE.md) - Database schema and rollback
- [Design Overview](/docs/design/overview_1.md) - Full architecture
