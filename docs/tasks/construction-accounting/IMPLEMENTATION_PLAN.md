# Construction Accounting Implementation Plan

> Tracks the work required to bring the construction accounting schema and features into GLAPI.

## Guiding Objectives
- Stand up tenant-isolated project + job-cost master data that mirrors construction platform.
- Extend shared transaction + GL primitives instead of building siloed modules.
- Deliver auditable cash reconciliation that ties commitments, pay apps, vendor bills, and ledger entries together.

## Milestones & Phases

### Phase 0 – Schema Alignment Foundations
- [ ] Backfill `activity_codes` columns (`organization_id`, `subsidiary_id`, `revenue_account_id`, `cost_account_id`) so generated schema matches typed schema.
- [ ] Add missing RLS policies for `activity_codes`, `business_transactions`, and `business_transaction_lines` to enforce tenant scope.
- [ ] Create migration scaffolding + testing harness for construction accounting tables.
  - Migration `0007_construction_projects.sql` introduces projects/external references foundation.

### Phase 1 – Project Master Data
- [ ] Migrate `projects`, `project_participants`, `project_addresses` tables with indexes + RLS.
- [ ] Build TRPC service endpoints for CRUD + list including external references.
- [ ] Seed Clerk org ↔ subsidiary mapping rules to support project scoping.

### Phase 2 – Cost Structure & Budgets
- [ ] Create `project_cost_codes`, `project_budget_versions`, `project_budget_lines` tables.
- [ ] Wire `business_transaction_lines` to enforce valid `(project_id, cost_code_id)` combinations.
- [ ] Import baseline budget via staging tables + idempotent loader.
- [ ] Publish budget authoring UI + API (align with `apps/web/.../budgets` patterns) and document budget import process.

### Phase 2b – Schedule of Values & Pay Applications
- [ ] Model `project_schedule_values` rows (one per cost code/phase) with committed, approved, billed, and retainage tracking.
- [ ] Extend `business_transactions` to support `PAY_APP`, `OWNER_BILLING`, and `RETAINAGE_RELEASE` line metadata (e.g., percent complete, retainage percent, billed-to-date).
- [ ] Build pay application workflow (draft → submitted → approved → billed) with approvals + integrations to owner billing and GL postings.
- [ ] Document schedule-of-values usage, import/export flows, and add Playwright coverage for the SOV grid + pay app approval UX.

### Phase 2c – Time Tracking & Labor Costing
- [ ] Introduce `time_entries`, `labor_cost_rates`, and mapping tables linking employees/vendors to projects and cost codes.
- [ ] Build APIs/UI to log, edit, and approve time against projects, including billable/non-billable flags and memo fields.
- [ ] Implement posting hooks: approved time entries create labor cost accruals (DR WIP, CR payroll clearing) and optionally feed billing.
- [ ] Document time entry lifecycle and add integration/e2e tests ensuring hours roll into project budgets + WIP.

### Phase 3 – Transaction Typing & Retainage Workflow
- [ ] Add new `transaction_types` (`PRIME_CONTRACT`, `COMMITMENT`, `CHANGE_ORDER`, `PAY_APP`, `RETAINAGE_RELEASE`, `OWNER_BILLING`).
- [ ] Extend `business_transactions`/`_lines` with retainage + schedule-of-values fields and regenerate Drizzle schema.
- [ ] Implement posting rule templates for commitments, pay apps, retainage, and owner billings.

### Phase 4 – Cash, Reporting, and Sync
- [ ] Build `integration_ingest_*` staging queues and background jobs for rate-limited sync.
- [ ] Deliver WIP + cash reconciliation views/materialized tables tied to GL (`project_wip_summary`, `project_cash_positions`, `project_percent_complete`).
- [ ] Add percent-complete calculations (budget, earned value, cost-to-complete) that feed WIP summaries and Pay App validation.
- [ ] Expose reporting APIs/UI dashboards (WIP, percent complete, retainage aging) and document reconciliation workflows.

## Dependencies & Considerations
- Coordinate with authentication layer to fetch Clerk org context for RLS (shared with existing GL features).
- Ensure migrations are backfilled in a sandbox before cutting over production tenants.
- Align naming conventions with existing docs (`docs/transaction-based-design.md`, `docs/event-sourced-gl.md`).

## Task Tracker
| Status | Task | Owner | Notes |
|--------|------|-------|-------|
| ☐ TODO | Align `activity_codes` schema + RLS | | Requires migration + TypeScript updates |
| ☐ TODO | Add `projects` + participants tables | | Include external refs + RLS |
| ☐ TODO | Implement project budget structures | | Depends on projects |
| ☐ TODO | Deliver schedule-of-values + pay application workflow | | Needs project budgets + retainage fields |
| ☐ TODO | Ship time tracking + labor costing tied to projects | | Requires employees + cost code linkage |
| ☐ TODO | Add construction transaction types + fields | | Blocks posting rule work |
| ☐ TODO | Extend posting rules for retainage + WIP | | Needs GL review |
| ☐ TODO | Build ingest pipeline | | Requires API credentials + external refs hooks |
| ☐ TODO | Publish WIP & cash/percent-complete reports | | After posting rules validated |

## Reporting Cadence
- Weekly schema status review during engineering sync.
- Demo checkpoints at the end of each phase with sample data flowing end-to-end.

## Definition of Done
- Tenants can create/import projects, commitments, change orders, and pay apps with IDs.
- Retainage and payment workflows reconcile to cash via GL postings and reporting views.
- Documentation updated (`docs/multi-tentant-schema.md`, API & runbooks) and integration tests cover primary flows.
