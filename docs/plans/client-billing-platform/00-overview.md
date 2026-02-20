# Client Billing Platform Expansion Plan

## Overview

This plan expands GLAPI from internal invoicing workflows into a full quote-to-cash platform with:

1. Billable work selection from timesheets and project work
2. Invoice send and payment collection
3. Customer self-service portal with transaction history
4. Stripe Connect per company (card + ACH)
5. Sales pipeline with weighted opportunities
6. Campaign manager for prospect nurture

The immediate business priority is accelerating cash collection from already-approved time/work.

## Current State

### Existing capabilities we can build on

- Unbilled and backlog analytics:
  - `packages/trpc/src/routers/project-analytics.ts`
  - `apps/web/src/app/dashboard/page.tsx`
- Invoice CRUD and status transitions:
  - `packages/trpc/src/routers/invoices.ts`
  - `packages/api-service/src/services/invoice-service.ts`
  - `apps/web/src/app/transactions/sales/invoices/page.tsx`
- Billable completed task selection for invoicing:
  - `packages/trpc/src/routers/project-tasks.ts`
  - `packages/api-service/src/services/project-task-service.ts`
- Basic Stripe integration for organization payment methods:
  - `apps/api/app/api/billing/*`
  - `apps/web/src/components/billing/stripe-payment-methods.tsx`
- Prospect and communication workflow foundations:
  - `packages/trpc/src/routers/prospects.ts`
  - `packages/trpc/src/routers/communication-workflows.ts`
  - `packages/trpc/src/routers/communication-events.ts`

### Gaps

- No dedicated billing queue to convert approved/unbilled work into invoice drafts
- Invoice send does not yet perform delivery and payment-link generation
- No customer-facing payment portal and no Stripe Connect onboarding
- Opportunities page is UI-heavy but currently mock-backed
  - `apps/web/src/app/transactions/sales/opportunities/page.tsx`
- No first-class campaign object/pipeline tied to prospects/opportunities

## Target Architecture

1. Internal Billing Queue
   - Unified list of invoice-eligible work items (time entries, tasks, sales-order lines, expenses)
   - Bulk selection and draft invoice generation

2. Invoice + Payment Rails
   - Internal invoice record remains GLAPI system of record
   - Stripe used for payment orchestration and hosted payment links
   - Webhook-driven payment state synchronization

3. Customer Center
   - Authenticated customer portal for transaction history, invoices, receipts, and payments
   - Multi-tenant by subdomain, custom domain optional per company

4. Revenue Pipeline and Campaigns
   - Weighted pipeline forecast on opportunities
   - Campaign stages and communication automation for prospects/leads

## Phases and Difficulty

| Phase | Outcome | Complexity | Estimate |
|---|---|---:|---:|
| Phase 1 | Billing queue + draft creation + source locking | Medium | 1-2 weeks |
| Phase 2 | Stripe Connect onboarding + invoice payment links + webhooks | High | 2-4 weeks |
| Phase 3 | Customer center (history + pay now + receipts) | Medium-High | 2-3 weeks |
| Phase 4 | Weighted opportunity pipeline (real backend + dashboard) | Medium | 1-2 weeks |
| Phase 5 | Campaign manager with nurture workflow integration | Medium-High | 2-4 weeks |

Total: 8-15 weeks for full production-grade rollout.

## Sequencing Recommendation

To prioritize profit stream acceleration:

1. Deliver Phase 1 first
2. Deliver Phase 2 minimum path (invoice payment link + webhook sync)
3. Roll out customer center once payment reliability is in place
4. Build pipeline and campaigns after billing cashflow is stable

## Deliverables in This Plan Set

- `docs/plans/client-billing-platform/01-billing-queue-and-invoice-orchestration.md`
- `docs/plans/client-billing-platform/02-stripe-connect-and-customer-center.md`
- `docs/plans/client-billing-platform/03-weighted-sales-pipeline.md`
- `docs/plans/client-billing-platform/04-campaign-manager.md`
- `docs/plans/client-billing-platform/05-beads-breakdown.md`
