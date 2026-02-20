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
2. `payments.captureWebhookEvent`
   - Receives Stripe events and reconciles:
     - paid
     - payment_failed
     - refunded
     - dispute opened/closed

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

## Security and Compliance

1. No card/bank details stored in GLAPI database
2. Payment data tokenized through Stripe Elements/hosted flows
3. Signed webhook verification and idempotent event processing
4. Role-constrained admin actions for Stripe account linking

## Migration/Compatibility Notes

- Existing organization-level card storage paths (`/api/billing/*`) can remain for internal product billing.
- Customer AR collection must route through Connect-aware code paths.

## Acceptance Criteria

1. A company admin can connect Stripe from GLAPI settings
2. Sent invoices contain live payment links
3. Customer can pay invoice via card or ACH
4. Payment status reflects back to GLAPI within webhook SLA
5. Customer portal shows complete transaction history for that customer
6. Tenant subdomain routing works for all active organizations

## Complexity and Estimate

- Stripe Connect + payment links + webhooks: High, 2-4 weeks
- Customer center UI + auth + tenancy: Medium-High, 2-3 weeks

