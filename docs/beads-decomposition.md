# Bead Decomposition Tracker

This document lists each open epic and its child tasks created on 2026-01-11.

## glapi-08e – Phase 3 - Close management automation
- **glapi-08e.1** – [08e] Build close task workspace: Implement tables/UI for close checklist tracking, owners, due dates, and attachments.
- **glapi-08e.2** – [08e] Automate variance/tie-out: Create variance reports comparing budgets vs actuals and tie-out templates auto-populated from GL.
- **glapi-08e.3** – [08e] Integrate close notifications: Hook close statuses into alerts/slack/email and document runbook for closing periods.

## glapi-0ib – Phase 2 - Project & time management
- **glapi-0ib.1** – [0ib] Project master data + tasks: Create project schema, participants, and task hierarchy with RLS + APIs.
- **glapi-0ib.2** – [0ib] Time/expense capture workflows: Build services/UI for time + expense entry with approvals and attachments.
- **glapi-0ib.3** – [0ib] Job cost posting + reporting: Route approved costs into WIP/expense accounts and deliver job cost reports.

## glapi-13p – Construction - WIP & percent complete reporting
- **glapi-13p.1** – [13p] Build WIP/percent-complete views: Create materialized views aggregating budget, actual, billed, and percent complete data per project/cost code.
- **glapi-13p.2** – [13p] Expose WIP dashboards & exports: Develop APIs/UI for WIP reports (over/under billings, retainage aging) with export formats.
- **glapi-13p.3** – [13p] Reconciliation & tie-out docs: Publish documentation/runbooks for reconciling WIP to GL and troubleshooting percent-complete variances.

## glapi-1y4 – Phase 2 - Procure-to-Pay workflows
- **glapi-1y4.1** – [1y4] Implement PO + receipt workflow: Create purchase order schema/APIs plus item receipt handling with approvals.
- **glapi-1y4.2** – [1y4] Build vendor bill + payment flow: Add vendor bill creation, matching to POs/receipts, and payment scheduling with postings.
- **glapi-1y4.3** – [1y4] UI + reporting for P2P: Deliver UI dashboards for commitments, approvals, and outstanding payables plus Playwright coverage.

## glapi-33o – Phase 4 - Conversational ledger interface
- **glapi-33o.1** – [33o] Define conversational intents & guardrails: Map supported intents, permissions, and safety rules for the conversational ledger assistant.
- **glapi-33o.2** – [33o] Implement NLU + action executor: Build service that interprets user prompts, maps to actions, and executes workflows with approvals.
- **glapi-33o.3** – [33o] UI embedding + observability: Embed assistant in web app, add telemetry/safety monitoring, and document usage.

## glapi-3gv – Phase 4 - Onboarding & setup experience
- **glapi-3gv.1** – [3gv] Implement onboarding wizard shell: Build onboarding experience with progress tracking, resume logic, and backend APIs for steps.
- **glapi-3gv.2** – [3gv] Add CoA & opening balance setup: Develop guided flows to configure chart of accounts and import opening balances.
- **glapi-3gv.3** – [3gv] Instrument onboarding analytics: Track completion metrics, drop-offs, and add contextual help links/content.

## glapi-3pq – Phase 3 - Unified audit logging
- **glapi-3pq.1** – [3pq] Implement audit log schema: Add audit log tables + drizzle models capturing actor, action, payload hash, and tenant context.
- **glapi-3pq.2** – [3pq] Build export + retention jobs: Expose APIs to query/export logs and schedule retention/purge jobs with encryption at rest.
- **glapi-3pq.3** – [3pq] Instrument monitoring/tests: Add coverage tests verifying audit hooks exist for mutating endpoints and dashboards alert on log gaps.

## glapi-4n3 – Phase 3 - Scheduled reporting & distribution
- **glapi-4n3.1** – [4n3] Build report scheduler service: Create scheduler + persistence for recurring report jobs with cron/interval support and tenant scoping.
- **glapi-4n3.2** – [4n3] Implement delivery connectors: Add email and webhook delivery pipelines with templating, attachments, and retry handling.
- **glapi-4n3.3** – [4n3] Admin UI & monitoring: Provide UI to manage schedules, view history, and instrument dashboards/alerts for failures.

## glapi-4px – Phase 4 - Documentation portal refresh
- **glapi-4px.1** – [4px] Set up documentation portal infrastructure: Choose doc engine, configure search/indexing, and integrate with CI for deploy previews.
- **glapi-4px.2** – [4px] Migrate & version existing docs: Import existing markdown, add versioning, and ensure redirects/links updated.
- **glapi-4px.3** – [4px] Embed code samples + SDK refs: Add interactive code samples, API references, and ensure docs CI validates snippets.

## glapi-58d – Phase 3 - Financial statement reporting
- **glapi-58d.1** – [58d] Implement statement query builder: Create reusable query layer for TB/IS/BS including period comparisons and segment filters.
- **glapi-58d.2** – [58d] Expose financial statement APIs: Add endpoints/export formats (CSV/PDF) for statements with formatting + rounding rules.
- **glapi-58d.3** – [58d] Build reporting UI components: Develop UI pages for TB/IS/BS with filters, drill-down, and saved views.

## glapi-80g – Phase 1 - Implement event store schema & migrations
- **glapi-80g.1** – [80g] Author event store migrations: Create drizzle migrations for event_store, event_outbox, and event_projections with required indexes and row-level security policies tied to organizations/subsidiaries.
- **glapi-80g.2** – [80g] Implement Drizzle models + repository: Add strongly typed models and repository helpers for persisting/reading events including pagination helpers and utilities for seed org setup.
- **glapi-80g.3** – [80g] Document event store operations: Write architecture/operational docs covering event sourcing tables, rollback procedures, and monitoring expectations in docs/event-sourced-gl.md.

## glapi-8rz – Construction - Project cost codes & budgets
- **glapi-8rz.1** – [8rz] Create project cost code schema: Add project_cost_codes table/migrations with validation + RLS, mapping to activity codes.
- **glapi-8rz.2** – [8rz] Build project budget APIs/import: Implement CRUD + CSV import for project_budget_versions/lines with validation + idempotent loader.
- **glapi-8rz.3** – [8rz] Develop project budget UI/reporting: Create UI for editing budget grids, variance dashboards, and docs explaining workflow.

## glapi-9ub – Phase 3 - Management & segment reporting
- **glapi-9ub.1** – [9ub] Create metrics service: Build service generating KPI aggregations with dimension filters (class/department/location).
- **glapi-9ub.2** – [9ub] Build dashboard widgets: Implement UI components for KPIs, sparklines, and saved dashboards with permissions.
- **glapi-9ub.3** – [9ub] Document custom metrics SDK: Write docs/examples for extending metrics service, including sample plugin/package.

## glapi-a3h – Phase 4 - SDKs & developer experience
- **glapi-a3h.1** – [a3h] Generate TypeScript SDK: Automate OpenAPI client generation/publishing for TypeScript/JS including auth helpers and testing.
- **glapi-a3h.2** – [a3h] Produce secondary language SDK: Build and publish SDK for a second language (Python/Go) with feature parity and docs.
- **glapi-a3h.3** – [a3h] Author developer quickstarts: Create code samples + guides showing authentication, posting a transaction, and reading reports using SDKs.

## glapi-bl8 – Phase 4 - External connectors (bank, payroll, CRM)
- **glapi-bl8.1** – [bl8] Build connector framework: Create shared connector SDK covering auth, rate limiting, retries, and monitoring hooks.
- **glapi-bl8.2** – [bl8] Deliver bank feed connector: Implement bank feed ingestion (Plaid/Yodlee) with mapping to cash accounts and reconciliation hooks.
- **glapi-bl8.3** – [bl8] Deliver payroll/CRM connectors: Ship payroll and CRM integrations with data mapping, monitoring, and runbooks.

## glapi-cb8 – Phase 1 - Real-time GL balance projections
- **glapi-cb8.1** – [cb8] Design balance projection tables: Add projection tables/materialized views for GL balances with partitioning + indexes for high volume.
- **glapi-cb8.2** – [cb8] Implement projection worker: Consume events/outbox to update balance projections with batching + replay support.
- **glapi-cb8.3** – [cb8] Expose balance query API: Provide TRPC/API endpoints plus caching for querying balances with pagination, filters, and SLA docs.

## glapi-crk – Phase 2 - Subscription billing & revenue recognition
- **glapi-crk.1** – [crk] Subscription lifecycle service: Implement subscription schema/APIs handling create, amend, cancel with versioning.
- **glapi-crk.2** – [crk] Billing schedule + invoicing: Generate billing schedules, create invoices, and sync to GL postings.
- **glapi-crk.3** – [crk] Revenue recognition engine: Build rev rec schedules/waterfalls tied to performance obligations with reporting.

## glapi-czl – Phase 1 - Enforce double-entry + FX handling
- **glapi-czl.1** – [czl] Enforce double-entry validation: Update repositories/services so transactions cannot post unless debit/credit totals balance per subsidiary/currency.
- **glapi-czl.2** – [czl] Implement FX capture & remeasurement: Persist FX rates on postings, add remeasurement job for open balances, and expose APIs to view FX adjustments.
- **glapi-czl.3** – [czl] Integration tests for O2C/P2P: Create end-to-end tests ensuring order-to-cash and procure-to-pay flows produce balanced postings and errors are surfaced via API.

## glapi-dcg – Phase 4 - Workflow automation engine
- **glapi-dcg.1** – [dcg] Design workflow builder schema: Model workflow definitions, triggers, and actions plus persistence/migrations for automation engine.
- **glapi-dcg.2** – [dcg] Implement execution engine: Build worker/runtime evaluating workflow rules, invoking actions/webhooks, and handling retries.
- **glapi-dcg.3** – [dcg] Build workflow designer UI: Create UI to configure workflows, preview actions, and monitor executions.

## glapi-h13 – Phase 2 - Order-to-Cash lifecycle
- **glapi-h13.1** – [h13] Implement sales order service: Build sales order schema, migrations, and service APIs covering creation, edits, and state transitions.
- **glapi-h13.2** – [h13] Extend invoicing + posting hooks: Connect invoices to posting engine, ensure revenue/billing data flows into GL with approvals.
- **glapi-h13.3** – [h13] Build O2C UI + Playwright tests: Create UI for managing O2C pipeline (orders, invoices, fulfillment) and add Playwright coverage.

## glapi-i4b – Phase 3 - Role-based access control
- **glapi-i4b.1** – [i4b] Create RBAC schema + migrations: Introduce roles, permissions, and assignment tables with RLS and seeding for default roles.
- **glapi-i4b.2** – [i4b] Build policy enforcement middleware: Implement authorization middleware/policies for TRPC + services with caching and evaluation tests.
- **glapi-i4b.3** – [i4b] Deliver RBAC admin UI: Create admin pages to assign roles, view permissions, and emit audit logs for changes.

## glapi-plr – Phase 1 - Accounting period management
- **glapi-plr.1** – [plr] Build accounting_periods schema: Create accounting period tables, migrations, and data loader for historical periods with organization/subsidiary scope.
- **glapi-plr.2** – [plr] Implement period management APIs: Add service + TRPC endpoints to open/close/lock periods with RBAC checks and audit logging.
- **glapi-plr.3** – [plr] Build UI workflow + docs: Create UI for viewing periods, triggering close steps, and documenting playbooks in production readiness guide.

## glapi-qii – Phase 3 - Consolidations & multi-book support
- **glapi-qii.1** – [qii] Model consolidation configs: Define entities/books relationships, ownership %, and elimination mapping tables/migrations.
- **glapi-qii.2** – [qii] Build elimination/translation engine: Implement batch job that creates elimination journals and FX translation adjustments per book.
- **glapi-qii.3** – [qii] Deliver consolidation reports: Expose reports/API summarizing consolidated results with eliminations and book switching.

## glapi-r16 – Phase 3 - Approvals & segregation of duties
- **glapi-r16.1** – [r16] Design approval/SOD schema: Model approval chains, step types, and segregation rules with migrations + admin APIs.
- **glapi-r16.2** – [r16] Implement workflow engine: Create service that enforces approvals on transactions, emits tasks, and integrates with notifications.
- **glapi-r16.3** – [r16] Publish policy templates + docs: Document recommended approval/SOD patterns and provide seed templates + Playwright coverage for UI.

## glapi-rme – Phase 1 - Outbox processor & event publisher
- **glapi-rme.1** – [rme] Implement outbox worker core: Build worker process that polls event_outbox in order, publishes messages, and marks them complete with idempotency + dead letter support.
- **glapi-rme.2** – [rme] Add monitoring & alerting: Instrument worker with metrics (lag, failures, retries) and hook into monitoring dashboards/alerts for SRE visibility.
- **glapi-rme.3** – [rme] Deployment runbook & smoke tests: Create deployment configuration, CI smoke test, and runbook describing scaling, config, and recovery procedures for the outbox worker.

## glapi-svz – Phase 1 - Event ingestion service & SDK
- **glapi-svz.1** – [svz] Define BaseEvent contracts: Create shared TypeScript interfaces, validation schema, and type guards for BaseEvent plus unit tests to ensure required metadata is captured.
- **glapi-svz.2** – [svz] Build ingestion service: Implement service that persists events into event_store with retries, idempotency keys, and tracing hooks; expose TRPC endpoints/hooks for callers.
- **glapi-svz.3** – [svz] Publish event SDK + examples: Package reusable client helpers, add docs and sample usage (e.g., for GL transactions) showing how to emit events with correlation IDs.

## glapi-t0b – Phase 2 - Cash application & customer payments
- **glapi-t0b.1** – [t0b] Build payment capture APIs: Implement payment receipt/unapplied cash storage with validations + posting hooks.
- **glapi-t0b.2** – [t0b] Implement bank deposit batching: Add workflows for grouping payments into deposits, updating clearing accounts, and linking to bank accounts.
- **glapi-t0b.3** – [t0b] Reconciliation & exception UI: Provide UI/reporting for unapplied cash, over/short situations, and reconciliation with bank statements.

## glapi-vi9 – Phase 4 - Migration & import toolkit
- **glapi-vi9.1** – [vi9] Design import schema + CLI: Define staging tables + CLI tool for importing master/transactional data with validation.
- **glapi-vi9.2** – [vi9] Build UI migration wizard: Create UX for mapping source fields, previewing imports, and tracking progress.
- **glapi-vi9.3** – [vi9] Implement rollback/audit logging: Add rollback commands, audit logs, and documentation for migration operations.

## glapi-wyc – Construction - Schedule of values & pay applications
- **glapi-wyc.1** – [wyc] Model schedule-of-values tables: Create project_schedule_values schema capturing phases, percent complete, retainage, and ties to budgets.
- **glapi-wyc.2** – [wyc] Implement pay application workflow: Build pay app entities, approvals, and GL posting hooks for owner billing + retainage.
- **glapi-wyc.3** – [wyc] SOV UI + import/export: Deliver grid UI for SOV management with CSV import/export and Playwright coverage.

## glapi-ysf – Phase 2 - Inventory costing & adjustments
- **glapi-ysf.1** – [ysf] Implement costing configuration: Add tables/UI to configure costing method per item/subsidiary (FIFO/LIFO/average) with validation.
- **glapi-ysf.2** – [ysf] Build adjustment/transfer workflows: Create APIs/UI for inventory adjustments and transfers with posting hooks.
- **glapi-ysf.3** – [ysf] Inventory valuation reporting: Provide valuation reports per warehouse/item including cost layers and tie-outs.

## glapi-yuk – Phase 3 - Compliance evidence tooling
- **glapi-yuk.1** – [yuk] Implement evidence bundle generator: Build service that collates audit logs, approvals, and code refs into exportable bundles per period/change.
- **glapi-yuk.2** – [yuk] Integrate change management workflow: Add workflow/UI for requesting, approving, and documenting change controls tied to evidence bundles.
- **glapi-yuk.3** – [yuk] Automate retention + exports: Schedule exports to secure storage, enforce retention policies, and document compliance process.

## glapi-z5t – Phase 1 - Posting engine & chart-of-accounts config
- **glapi-z5t.1** – [z5t] Model chart-of-accounts metadata: Design configuration structures for accounts, segments, and posting attributes plus admin tooling to manage them.
- **glapi-z5t.2** – [z5t] Implement posting rules DSL: Create DSL/runtime that translates business events into debit/credit lines with reusable components and thorough unit tests.
- **glapi-z5t.3** – [z5t] Provide developer guide & samples: Document posting engine usage, add sample rule packages, and integrate linting to catch invalid rule deployments.

## glapi-zo0 – Construction - Time tracking & labor costing
- **glapi-zo0.1** – [zo0] Create time entry schema: Introduce time_entries, labor_cost_rates, and mapping tables with migrations + RLS.
- **glapi-zo0.2** – [zo0] Build time entry UI + approvals: Provide web/mobile-friendly UI for logging/approving time with billable flags and attachments.
- **glapi-zo0.3** – [zo0] Labor posting + billing integration: Calculate labor costs, post to WIP/payroll clearing, and optionally create billing lines from approved time.

## glapi-zrw – Phase 0 - CI/CD quality gates
- **glapi-zrw.1** – [zrw] Configure turbo/PNPM pipelines: Set up CI workflow running pnpm lint, type-check, and targeted tests with caching + matrix strategy.
- **glapi-zrw.2** – [zrw] Provide local reproduction scripts: Add scripts/docs so developers can mirror CI commands locally with consistent env vars.
- **glapi-zrw.3** – [zrw] Add CI metrics dashboard: Instrument build durations + failure trends and publish dashboard for engineering visibility.
