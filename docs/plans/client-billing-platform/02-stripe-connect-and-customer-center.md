# Phase 2-3: Stripe Connect and Customer Center

## Objective

Enable each GLAPI company to connect its own Stripe account, send payable invoices, and provide customers a secure portal for transaction history and payments (card + ACH).

## Scope

### In scope

1. Stripe Connect onboarding for companies (platform tenants)
2. Invoice payment links tied to connected accounts
3. Payment webhook synchronization to GLAPI invoices/payments
4. Customer center for invoice/payment history and pay-now actions
5. Subdomain tenancy and optional custom domain support

### Out of scope (first release)

- Full subscription billing migration
- Multi-currency payout automation
- White-label theme builders

## Data Model Changes

### Organizations

Add Stripe Connect configuration fields on `organizations`:

- `stripe_account_id`
- `stripe_connect_status` (`not_connected`, `pending`, `active`, `restricted`)
- `stripe_charges_enabled`
- `stripe_payouts_enabled`
- `stripe_onboarding_completed_at`

### Customer mapping

Store external customer mapping (entity -> Stripe customer):

- Option A: dedicated table `entity_payment_profiles`
- Option B: entity metadata keys

Recommendation: Option A for queryability and integrity.

### Idempotency and event ledger

Add control tables:

1. `command_idempotency`
   - tracks operation key, actor scope, request hash, and result reference
2. `external_event_receipts`
   - stores webhook event id, signature validation result, processed timestamp, processing outcome

## API Design

### Admin/organization endpoints

1. `stripeConnect.createOnboardingLink`
2. `stripeConnect.getStatus`
3. `stripeConnect.refreshAccountCapabilities`
4. `stripeConnect.disconnect` (guarded)

### Invoice/payment endpoints

1. `invoices.sendWithPaymentLink`
   - Creates or updates Stripe customer (connected account context)
   - Creates Stripe invoice or hosted payment flow
   - Stores hosted payment URL and external IDs
   - Requires idempotency key and semantic duplicate protection
2. `payments.captureWebhookEvent`
   - Receives Stripe events and reconciles:
     - paid
     - payment_failed
     - refunded
     - dispute opened/closed
   - Must be replay-safe and idempotent by external event id

## Customer Center Authorization Model

## Principal model

1. Portal users map to organization + customer entity memberships
2. Roles:
   - billing_viewer
   - payer
   - billing_admin

## Authorization model

1. Every read/write endpoint enforces:
   - tenant context
   - entity membership
   - role capability
2. Invoice/payment access is denied by default unless explicitly mapped
3. Admin impersonation (if enabled) requires audited privileged session markers

## Customer Center Architecture

## Deployment strategy

### Recommended first release

Single deployment, multi-tenant routing by subdomain:

- `https://{org-slug}.clients.glapi.com`

Why:
- lower operational overhead
- shared release train
- shared observability/security controls

### Optional later

Per-tenant custom domain:

- `https://billing.customer-domain.com`
- DNS verification + cert automation + tenant-domain mapping table

## Portal capabilities

1. Login and tenant resolution
2. Transaction history
   - invoices
   - payments
   - refunds/credits
3. Invoice detail + downloadable document
4. Pay now with card or ACH
5. Receipts and payment status timeline

## Accounting Lifecycle and Posting Rules

1. Separate payment transport status from accounting posting status
2. Post cash/AR relief only on terminal success state
3. Model ACH return and dispute flows as explicit reversal events
4. Preserve immutable transition history for:
   - invoice status
   - payment status
   - posting actions

## Domain and Tenant Hardening

1. Host allowlist and strict tenant resolution
2. Signed custom-domain ownership verification
3. Automated certificate issuance and expiration monitoring
4. Canonical host redirects to prevent ambiguous tenant routing
5. Reject requests with host/tenant mismatches

## Security and Compliance

1. No card/bank details stored in GLAPI database
2. Payment data tokenized through Stripe Elements/hosted flows
3. Signed webhook verification and idempotent event processing
4. Role-constrained admin actions for Stripe account linking
5. Secrets rotation policy for webhook signing and API credentials
6. Audit logs for:
   - account connect/disconnect
   - invoice send/link generation
   - payment and reconciliation state transitions
7. PII retention and redaction policy for payment payload fragments

## Migration/Compatibility Notes

- Existing organization-level card storage paths (`/api/billing/*`) can remain for internal product billing.
- Customer AR collection must route through Connect-aware code paths.
- Cutover requires migration playbook:
  - map entities to Stripe customer profiles
  - validate invoice external id consistency
  - run backfill reconciliation report before enabling live writes

## Observability and SLOs

1. Invoice payment-link generation success >= 99.5%
2. Webhook processing success >= 99.9%
3. Webhook-to-invoice-state sync p95 < 60s
4. Alerting:
   - signature verification failures
   - reconciliation mismatches
   - webhook backlog growth
   - repeated idempotency collisions

## Acceptance Criteria

1. A company admin can connect Stripe from GLAPI settings
2. Sent invoices contain live payment links
3. Customer can pay invoice via card or ACH
4. Payment status reflects back to GLAPI within webhook SLA
5. Customer portal shows complete transaction history for that customer
6. Tenant subdomain routing works for all active organizations
7. Replayed send-payment-link requests are idempotent
8. Unauthorized customer cannot read or pay unrelated invoices
9. Dispute/refund/reversal state transitions reconcile correctly in GLAPI

## Complexity and Estimate

- Stripe Connect + payment links + webhooks: High, 2-4 weeks
- Customer center UI + auth + tenancy: Medium-High, 2-3 weeks
