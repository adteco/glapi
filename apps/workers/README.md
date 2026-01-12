# GLAPI Workers

Background worker service for reliable event processing using the transactional outbox pattern.

## Overview

This service polls the `event_outbox` table and publishes events to downstream consumers with:
- **At-least-once delivery** with idempotency guarantees
- **Exponential backoff** for failed events
- **Prometheus metrics** for observability
- **Health endpoints** for Kubernetes probes

## Quick Start

```bash
# Copy environment file
cp .env.example .env

# Edit DATABASE_URL and other settings
vim .env

# Development mode (with hot reload)
pnpm dev

# Production build
pnpm build
pnpm start
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | (required) | PostgreSQL connection string |
| `NODE_ENV` | `development` | Environment name |
| `LOG_LEVEL` | `info` | Log level (debug, info, warn, error) |
| `OUTBOX_POLL_INTERVAL_MS` | `1000` | Polling interval in ms |
| `OUTBOX_BATCH_SIZE` | `100` | Events per batch |
| `OUTBOX_MAX_RETRIES` | `5` | Max retry attempts |
| `OUTBOX_INITIAL_RETRY_DELAY_MS` | `1000` | Initial retry delay |
| `OUTBOX_BACKOFF_MULTIPLIER` | `2` | Exponential backoff factor |
| `OUTBOX_MAX_RETRY_DELAY_MS` | `300000` | Max retry delay (5 min) |
| `METRICS_PORT` | `9090` | HTTP server port |
| `METRICS_HOST` | `0.0.0.0` | HTTP server bind address |

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Aggregated health status |
| `GET /ready` | Readiness probe |
| `GET /live` | Liveness probe |
| `GET /metrics` | Prometheus metrics |

## Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `outbox_processor_running` | Gauge | Is processor running (1/0) |
| `outbox_events_processed_total` | Counter | Successfully processed events |
| `outbox_events_failed_total` | Counter | Failed events |
| `outbox_events_dead_lettered_total` | Counter | Events exceeding max retries |
| `outbox_events_pending` | Gauge | Pending event count |
| `outbox_oldest_event_age_seconds` | Gauge | Lag indicator |
| `outbox_event_processing_duration_seconds` | Histogram | Processing latency |

## Docker

```bash
# Build image
docker build -t glapi-workers .

# Run container
docker run -e DATABASE_URL=postgresql://... -p 9090:9090 glapi-workers
```

## Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: glapi-workers
spec:
  replicas: 1  # Scale carefully - uses FOR UPDATE SKIP LOCKED
  template:
    spec:
      containers:
      - name: workers
        image: glapi-workers:latest
        ports:
        - containerPort: 9090
          name: metrics
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: glapi-secrets
              key: database-url
        livenessProbe:
          httpGet:
            path: /live
            port: metrics
          initialDelaySeconds: 5
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: metrics
          initialDelaySeconds: 5
          periodSeconds: 10
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Outbox Processor                              │
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │ Poll Timer   │──▶│ Fetch Events │──▶│ Process & Publish    │ │
│  │ (1s default) │   │ (SKIP LOCKED)│   │ (In-Process/External)│ │
│  └──────────────┘   └──────────────┘   └──────────────────────┘ │
│                                                │                 │
│                            ┌───────────────────┴───────────┐    │
│                            ▼                               ▼    │
│                    ┌──────────────┐              ┌─────────────┐│
│                    │ Mark Success │              │ Schedule    ││
│                    │ (PUBLISHED)  │              │ Retry/DLQ   ││
│                    └──────────────┘              └─────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Event Publishers

The service supports pluggable publishers:

- **InProcessPublisher** (default): For development and simple deployments
- **Future**: Redis Streams, Kafka, AWS SNS/SQS

Register handlers for in-process publishing:

```typescript
import { inProcessPublisher } from './publishers/in-process-publisher.js';

// Handle specific topic
inProcessPublisher.on('gl.transactions', async (event) => {
  console.log('Transaction event:', event);
});

// Handle all events
inProcessPublisher.onAll(async (event) => {
  console.log('Event:', event.topic, event.id);
});
```

## Troubleshooting

### High lag (oldest_event_age_seconds increasing)

1. Check database connection health
2. Increase `OUTBOX_BATCH_SIZE`
3. Scale horizontally (multiple workers with SKIP LOCKED)
4. Check publisher health

### Events stuck in FAILED state

1. Check `errorMessage` column in `event_outbox`
2. Review logs for publisher errors
3. Events exceeding `OUTBOX_MAX_RETRIES` require manual intervention

### Manual retry dead-lettered events

```sql
-- Reset failed events for retry
UPDATE event_outbox
SET status = 'PENDING', retry_count = 0, next_retry_at = NULL
WHERE status = 'FAILED' AND retry_count >= 5;
```
