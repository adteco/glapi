# Event Store Documentation

## Overview

The Event Store is the foundational component for event sourcing in the GLAPI system. It provides:

- **Complete auditability** - Every state change is captured as an immutable event
- **Temporal queries** - Reconstruct state at any point in time
- **CQRS support** - Separate read models (projections) from the event log
- **Distributed tracing** - Correlation/causation IDs for tracing event chains

## Tables

### event_store

The core immutable event log. All business events are stored here.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key (auto-generated) |
| event_type | text | Specific event type (e.g., 'TransactionPosted') |
| event_category | enum | High-level category (TRANSACTION, APPROVAL, etc.) |
| aggregate_id | text | ID of the entity being changed |
| aggregate_type | text | Type of entity (e.g., 'GLTransaction') |
| event_version | bigint | Version within aggregate (for optimistic concurrency) |
| global_sequence | bigint | Monotonically increasing for global ordering |
| event_data | jsonb | Event payload (immutable) |
| metadata | jsonb | Additional context (optional) |
| event_timestamp | timestamp(6) | When the event occurred |
| user_id | text | User who triggered the event |
| session_id | text | Session identifier |
| correlation_id | uuid | Groups related events |
| causation_id | uuid | Parent event that caused this |
| organization_id | text | Multi-tenant organization ID |

### event_outbox

Transactional outbox for reliable event publishing.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| event_id | uuid | Reference to event_store |
| topic | text | Pub/sub topic name |
| partition_key | text | For ordered processing |
| payload | jsonb | Message to publish |
| status | enum | PENDING, PUBLISHED, or FAILED |
| retry_count | integer | Number of publish attempts |
| next_retry_at | timestamp | When to retry failed publishes |
| error_message | text | Last error if FAILED |

### event_projections

Tracks read model state built from events.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| projection_name | text | Name (e.g., 'AccountBalance') |
| aggregate_id | text | Entity this projection is for |
| aggregate_type | text | Type of entity |
| last_event_version | bigint | Last processed event version |
| last_global_sequence | bigint | Checkpoint for catch-up |
| projection_data | jsonb | Current projection state |

## Ownership

- **Package**: `@glapi/database`
- **Schema file**: `src/db/schema/event-store.ts`
- **Migration**: `drizzle/0008_event_store_foundation.sql`
- **Service layer**: `@glapi/api-service` (event ingestion service)

## Usage

### TypeScript Types

```typescript
import {
  eventStore,
  eventOutbox,
  eventProjections,
  EventStoreRecord,
  NewEventStoreRecord,
  BaseEvent,
  EventCategory,
} from '@glapi/database/schema';

// Create a new event
const newEvent: NewEventStoreRecord = {
  eventType: 'TransactionPosted',
  eventCategory: 'ACCOUNTING',
  aggregateId: 'txn-123',
  aggregateType: 'GLTransaction',
  eventVersion: 1,
  globalSequence: 1001,
  eventData: { transactionId: 'txn-123', amount: 1000 },
  eventTimestamp: new Date(),
  correlationId: '550e8400-e29b-41d4-a716-446655440000',
  organizationId: 'org-456',
};
```

### Event Categories

| Category | Description |
|----------|-------------|
| TRANSACTION | GL and business transactions |
| APPROVAL | Workflow approvals |
| PAYMENT | Payment processing |
| ACCOUNTING | Core accounting operations |
| SUBSCRIPTION | Subscription lifecycle |
| PROJECT | Project management |
| CONTRACT | Contract lifecycle |
| INVENTORY | Inventory operations |
| SYSTEM | System events |

## Query Patterns

### Get events for an aggregate
```sql
SELECT * FROM event_store
WHERE aggregate_type = 'GLTransaction'
  AND aggregate_id = 'txn-123'
ORDER BY event_version ASC;
```

### Get events by correlation ID
```sql
SELECT * FROM event_store
WHERE correlation_id = '550e8400-e29b-41d4-a716-446655440000'
ORDER BY global_sequence ASC;
```

### Get pending outbox events
```sql
SELECT * FROM event_outbox
WHERE status = 'PENDING'
ORDER BY created_at ASC
LIMIT 100;
```

### Rebuild projection from events
```sql
-- Get all events since last checkpoint
SELECT * FROM event_store
WHERE global_sequence > (
  SELECT last_global_sequence FROM event_projections
  WHERE projection_name = 'AccountBalance' AND aggregate_id = 'acc-123'
)
ORDER BY global_sequence ASC;
```

## Rollback Plan

### Migration Rollback

To rollback the event store migration:

```sql
-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS "event_projections";
DROP TABLE IF EXISTS "event_outbox";
DROP TABLE IF EXISTS "event_store";

-- Drop sequence
DROP SEQUENCE IF EXISTS event_store_global_sequence_seq;

-- Drop enums
DROP TYPE IF EXISTS "outbox_status_enum";
DROP TYPE IF EXISTS "event_category_enum";
```

### Data Recovery

Events are immutable by design. If incorrect events are stored:

1. **Corrective Events**: Create new events that correct the state (preferred)
2. **Projection Rebuild**: Rebuild projections excluding bad events
3. **Emergency Delete**: Only in extreme cases with audit trail

### Backup Considerations

- Event store should be backed up with high frequency
- Point-in-time recovery capability is essential
- Consider separate backup strategy for events vs projections

## Performance Considerations

### Indexes

The schema includes indexes optimized for:
- Aggregate lookups (most common)
- Correlation tracing
- Time-based queries
- Global sequence ordering
- Organization-scoped queries

### Partitioning (Future)

For high-volume deployments, consider partitioning by:
- Time (monthly partitions)
- Organization (for multi-tenant isolation)

### Monitoring

Key metrics to monitor:
- Events per second
- Outbox queue depth
- Failed publish rate
- Projection lag (global_sequence difference)

## Related Documentation

- [Design Overview](/docs/design/overview_1.md) - Full event-driven architecture
- [System of Record Roadmap](/docs/system-of-record-roadmap.md) - Implementation phases
- [Capability Backlog](/docs/system-of-record-capability-backlog.md) - Detailed work packets
