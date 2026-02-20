# Beads Breakdown: Client Billing Platform

## Epic Structure

1. Epic A: Billing queue and invoice orchestration (cash acceleration)
2. Epic B: Stripe Connect and payment links
3. Epic C: Customer center portal
4. Epic D: Weighted sales pipeline
5. Epic E: Campaign manager

## Proposed Issues and Order

### Epic A: Billing queue and invoice orchestration

1. Create invoice source allocation schema and repository support
2. Implement billingQueue router (`listCandidates`, `previewInvoiceDraft`, `createDraftInvoices`)
3. Build billing queue UI page and bulk selection flow
4. Add integration tests for no-double-billing and transactional draft generation

### Epic B: Stripe Connect and payment links

1. Add organization Stripe Connect fields and status model
2. Implement Connect onboarding/status APIs
3. Implement send-with-payment-link invoice path
4. Implement webhook reconciliation and idempotency

### Epic C: Customer center portal

1. Implement tenant subdomain routing for customer center
2. Build customer auth and transaction history pages
3. Build pay-now flow (card + ACH) with Stripe Elements or hosted handoff
4. Add custom-domain mapping capability (optional after subdomain launch)

### Epic D: Weighted sales pipeline

1. Implement opportunities router and persistence (replace mock data)
2. Build weighted pipeline analytics and dashboard widgets
3. Implement opportunity-to-estimate conversion flow

### Epic E: Campaign manager

1. Add campaign and campaign member schema
2. Implement campaigns router and stage progression
3. Integrate campaigns with communication workflows/events
4. Build campaign analytics and conversion reporting

## Dependency Outline

1. Epic A is independent and should start first
2. Epic B depends on baseline invoice send flow, but can begin in parallel with Epic A
3. Epic C depends on Epic B payment-link and webhook baseline
4. Epic D can run in parallel with Epic B/C once a team is free
5. Epic E depends on prospect/opportunity consistency from Epic D

## Priority Recommendation

1. `P0`: Epic A
2. `P1`: Epic B
3. `P1`: Epic C
4. `P2`: Epic D
5. `P2`: Epic E

## Recommended Post-Review Additions (Not Yet Added to Beads)

## Hardening track (Phase 0)

1. Threat model and trust-boundary review for customer center and payment flows
2. Idempotency framework for invoice send and webhook processing
3. Payment/invoice lifecycle policy and posting/reversal rules
4. Tenant-domain hardening controls (host validation and custom-domain verification)
5. Migration/backfill reconciliation runbook for existing unbilled and billed records
6. Observability/SLO dashboards and alert policy
7. Incident runbooks for webhook backlog, reconciliation drift, and duplicate charge reports

## Test track

1. AuthZ matrix tests for portal access boundaries
2. Race-condition integration tests for draft generation and invoice send
3. Replay tests for webhook idempotency and out-of-order events
4. Accounting reconciliation assertions for success/failure/refund/dispute paths

## Created Beads (2026-02-20)

- Program epic: `glapi-2nwo`
- Phase 1 feature: `glapi-2nwo.1`
- Phase 1 tasks:
  - `glapi-2nwo.1.3`
  - `glapi-2nwo.1.4`
  - `glapi-2nwo.1.6`
- Phase 2 feature: `glapi-2nwo.2`
- Phase 2 tasks:
  - `glapi-2nwo.2.2`
  - `glapi-2nwo.2.5`
  - `glapi-2nwo.2.6`
- Phase 3 feature: `glapi-2nwo.3`
- Phase 3 tasks:
  - `glapi-2nwo.3.3`
  - `glapi-2nwo.3.4`
- Phase 4 feature: `glapi-2nwo.6`
- Phase 4 tasks:
  - `glapi-2nwo.6.1`
  - `glapi-2nwo.6.2`
- Phase 5 feature: `glapi-2nwo.7`
- Phase 5 tasks:
  - `glapi-2nwo.7.1`
  - `glapi-2nwo.7.2`
