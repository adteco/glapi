# Phase 0: Hardening and Control Plane

## Objective

Establish non-functional controls before feature rollout so billing, payments, and customer portal flows are safe, auditable, and resilient.

## Scope

1. Idempotency and concurrency controls for all money-moving operations
2. Customer-center authentication and authorization model
3. Payment/invoice accounting state machine and posting policy
4. Tenant-domain hardening for subdomain and custom-domain access
5. Migration and backlog backfill controls
6. Observability, SLOs, alerting, and runbooks
7. Compliance controls for communications and payment event data

## Trust Boundaries

1. Internal operator context (GLAPI staff/admin)
2. Organization admin context (company owner/finance role)
3. Customer portal context (customer account users)
4. External payment network context (Stripe webhooks and redirects)

No context may infer access from URL/subdomain alone. Every request must resolve tenant + principal + explicit authorization policy.

## Idempotency and Concurrency Model

## Command idempotency requirements

1. `invoices.sendWithPaymentLink`
2. `payments.captureWebhookEvent` processing units
3. Any retryable operation creating external Stripe artifacts

## Technical controls

1. Persist idempotency key per command and actor scope
2. Apply DB uniqueness on semantic operation keys
3. Add replay-safe outbox/worker processing for external calls
4. Add row-level locking or optimistic version checks during invoice send and status mutation

## Accounting Lifecycle Model

## Canonical invoice statuses

1. `draft`
2. `sent`
3. `payment_pending`
4. `partial`
5. `paid`
6. `failed`
7. `overdue`
8. `void`

## Canonical payment statuses

1. `initiated`
2. `processing`
3. `succeeded`
4. `failed`
5. `reversed`
6. `disputed`

## Posting policy

1. Do not post cash on `initiated`/`processing`
2. Post cash and clear AR on `succeeded`
3. Post reversals/chargebacks for `reversed`/`disputed`
4. Keep immutable event trail for every state transition

## Source Allocation and Rebill Policy

1. Source allocations prevent duplicate billing while invoice is active
2. Void/credit/rebill transitions must explicitly release or transfer allocation records
3. Partial rebill must be supported with quantity/hour/amount granularity
4. Audit log must preserve original invoice lineage

## Customer Center AuthZ Model

## Required objects

1. Customer portal account
2. Membership mapping to `entity_id` + organization
3. Role model:
   - billing admin
   - billing viewer
   - payer

## Authorization rules

1. Users can only view invoices/payments for mapped entities
2. Users can only initiate payment for allowed entities
3. All mutation endpoints must enforce role capability checks

## Tenant Domain Hardening

1. Strict host allowlist and tenant resolution validation
2. Signed domain verification for custom domains
3. Automated certificate lifecycle monitoring
4. Host header and forwarded header normalization
5. Block tenant resolution fallback when host is ambiguous

## Webhook Security Controls

1. Verify Stripe signatures for every event
2. Store event IDs to block replay processing
3. Enforce bounded replay windows
4. Dead-letter queue for invalid/unprocessable events
5. Alert on signature failure spikes and processing lag

## Migration and Backfill Plan

1. Dry-run report for currently approved unbilled sources
2. Backfill allocations for already-billed historical invoices where possible
3. Reconciliation report before and after cutover
4. Kill switch to revert billing queue writes if mismatch detected

## Observability and SLOs

## Service-level objectives

1. Webhook-to-state-sync p95 < 60s
2. Invoice send success rate >= 99.5%
3. Duplicate billing incidents = 0
4. Billing queue load p95 < 2s (target tenant data size)

## Required telemetry

1. Structured audit logs for invoice/payment status transitions
2. Metrics for retries, dedupe drops, and reconciliation failures
3. Traces across send -> external payment -> webhook -> ledger update

## Release Gates

1. Threat model reviewed and signed off
2. AuthZ test matrix passes for customer center routes
3. Idempotency/race-condition integration tests pass
4. Reconciliation dry-run variance is within agreed threshold
5. Runbooks published for:
   - webhook outage
   - duplicate payment report
   - stuck processing payments

## Deliverables

1. Architecture decision record for auth/idempotency/lifecycle policy
2. Control checklist mapped to implementation tasks
3. Test strategy covering concurrency and replay scenarios
4. Go-live checklist and rollback plan

