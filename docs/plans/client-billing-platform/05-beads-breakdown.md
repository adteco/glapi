# Beads Breakdown: Client Billing Platform

## Epic Structure

1. Epic 0: Hardening and control plane (release blocker)
2. Epic A: Billing queue and invoice orchestration (cash acceleration)
3. Epic B: Stripe Connect and payment links
4. Epic C: Customer center portal
5. Epic D: Weighted sales pipeline
6. Epic E: Campaign manager

## Proposed Issues and Order

### Epic 0: Hardening and control plane (must complete before B/C production rollout)

1. Threat model and trust-boundary review for payment and portal surfaces
2. Implement PostgreSQL RLS policies for all portal/payment-facing tables
3. Implement command idempotency framework for invoice send and webhook processing
4. Build webhook DLQ and manual reconciler admin UI
5. Finalize payment/invoice lifecycle policy for success/failure/refund/dispute/ACH return
6. Implement admin impersonation markers and privileged audit logging
7. Implement tenant-domain hardening and custom-domain verification controls
8. Build migration/backfill reconciliation tooling and kill-switch controls
9. Ship observability dashboards, SLO alerts, and incident runbooks
10. Add race/replay/authz/accounting reconciliation integration test suite

### Epic A: Billing queue and invoice orchestration

1. Create invoice source allocation schema and repository support
2. Implement billingQueue router (`listCandidates`, `previewInvoiceDraft`, `createDraftInvoices`)
3. Build billing queue UI page and bulk selection flow
4. Add integration tests for no-double-billing and transactional draft generation
5. Add rebill/void/credit allocation transfer flows and lineage reporting

### Epic B: Stripe Connect and payment links

1. Add organization Stripe Connect fields and status model
2. Add `entity_payment_profiles` schema and repository
3. Implement Connect onboarding/status APIs
4. Implement send-with-payment-link invoice path via Stripe Checkout Session
5. Implement webhook reconciliation and idempotency ledger

### Epic C: Customer center portal

1. Implement tenant subdomain routing for customer center
2. Build customer portal auth lifecycle (invite, login, session, reset, logout)
3. Build customer auth + transaction history pages
4. Build pay-now flow (checkout handoff + return/status)
5. Add custom-domain mapping capability (optional after subdomain launch)

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

1. Epic 0 is a hard release blocker for Epics B and C production rollout.
2. Epic A starts immediately and can ship independently.
3. Epic B may start in parallel with Epic A for scaffolding and non-production paths, but production enablement requires Epic 0 completion.
4. Epic C depends on Epic B payment-link/webhook baseline and Epic 0 controls.
5. Epic D can run in parallel once capacity is available.
6. Epic E depends on prospect/opportunity consistency from Epic D.

## Priority Recommendation

1. `P0`: Epic 0
2. `P0`: Epic A
3. `P1`: Epic B
4. `P1`: Epic C
5. `P2`: Epic D
6. `P2`: Epic E

## Existing Beads (2026-02-20)

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

## Bead Additions Completed (2026-02-20)

1. Epic 0 feature created: `glapi-2nwo.8`.
2. Epic 0 tasks created:
   - `glapi-2nwo.8.2`
   - `glapi-2nwo.8.3`
   - `glapi-2nwo.8.4`
   - `glapi-2nwo.8.5`
   - `glapi-2nwo.8.6`
3. Blocker links added:
   - `glapi-2nwo.8` blocks `glapi-2nwo.2`
   - `glapi-2nwo.8` blocks `glapi-2nwo.3`
4. Portal auth lifecycle task made explicit:
   - Updated `glapi-2nwo.3.3` title/description to include invite/login/session/reset/logout and membership mapping.
