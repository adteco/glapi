# GLAPI System-of-Record Program Roadmap

This document orchestrates the work required to evolve GLAPI into a NetSuite-class, GAAP-compliant system of record. It converts the architectural intent described in `docs/design/overview_1.md`, `docs/event-sourced-gl.md`, and the schema/repository code in `packages/database` + `packages/api-service` into a sequenced program plan that downstream agents can translate into Beads.

---

## Purpose & Scope
- **Purpose:** deliver an auditable, extensible, API-first general ledger platform with full subledger coverage, compliance tooling, reporting, and ecosystem readiness.
- **Scope:** ledger core, subledgers (O2C, P2P, inventory, projects, revenue, subscription), compliance/controls, analytics, integrations, developer experience, and operational readiness.
- **Out of scope:** marketing site polish, experimental AI assistants beyond what is required for accounting workflows, and non-financial verticals.

## Guiding Principles
1. **Ledger-first correctness** – enforce double-entry posting, FX treatment, and period integrity before UI flourishes.
2. **Event-sourced auditability** – ship the event store/outbox/projection stack and treat the relational schema as read models.
3. **Multi-entity by default** – every feature respects organization/subsidiary access controls already hinted in repository code.
4. **Automation-ready** – APIs, SDKs, and workflow hooks are first-class; manual UI flows augment but never replace automation.
5. **Observability + controls** – traceability, approvals, and runbooks are shipped with each workstream.

## Program Structure
We run **cross-functional pods** that map to critical capability areas. Each pod owns design, implementation, quality gates, documentation, and migrations for their surface.

| Pod | Charter | Lead Inputs |
| --- | --- | --- |
| Ledger Core | event platform, posting engine, GL balances, accounting periods | `docs/design/overview_1.md`, `packages/database/src/db/schema/gl-*.ts` |
| Subledgers | O2C + P2P + inventory + project/service billing | `packages/database/src/repositories/*`, `docs/order-to-cash-process.md` |
| Compliance & Controls | roles, approvals, audit logging, close checklists | `production-readiness-checklist.md`, `multi-tentant-schema.md` |
| Reporting & Analytics | management/GAAP statements, consolidations, KPIs | `packages/database/src/repositories/gl-reporting-repository.ts` |
| Platform & Integrations | SDKs, migrations, connectors, workflow engine | `apps/api/docs/openapi-manual.yaml`, `packages/api-service` |
| Experience & Adoption | UX, onboarding, docs, enablement | `apps/web`, `docs/setup-guide.md` |

Pods coordinate via weekly integration demos and keep artifacts in shared threads (use Beads IDs as thread IDs per MCP Agent Mail guidance).

## Phased Roadmap
Timelines assume overlapping work; adjust durations based on staffing.

### Phase 0 – Foundation Hardening (Weeks 0‑3)
- **Goals:** stabilize baseline repo, document schema ownership, and unblock infra.
- **Deliverables:** repo health checklist (lint/type/test gates automated), environment matrix, data model catalog (link each table to owning pod), backlog triage session outputs.
- **Gating Criteria:** CI green, seed org + migrations reproducible, monitoring stack ready for future pods.

### Phase 1 – Ledger Core & Event Platform (Weeks 2‑8)
- **Goals:** build event store/outbox/projection services, enforce double-entry posting, implement accounting periods/close states, expose GL API endpoints with service tests.
- **Key Epics:** Event store schema + migration tooling, posting rules engine, FX remeasurement jobs, GL balances projections, RLS enforcement in services, journaling UI/API.
- **Success Metrics:** 100% of transactions flow through event pipeline, zero-balance enforcement, period close generates trial balance within 30s for seed org.

### Phase 2 – Subledger Workflow Pods (Weeks 6‑16)
- **Goals:** deliver end-to-end flows for Order-to-Cash, Procure-to-Pay, Inventory, Projects, and Subscription billing with auto-posting into GL.
- **Key Epics:** document lifecycle + approvals, accrual/deferral logic, inventory costing + adjustments, project/job-cost engine, revenue recognition + waterfall projections.
- **Success Metrics:** Reference tenant can execute O2C and P2P scenarios without manual SQL; audit trail ties subledger docs to GL entries.

### Phase 3 – Compliance, Controls, & Reporting (Weeks 10‑20)
- **Goals:** enforce role-based access, approvals, segregation of duties, audit logs, SOX-ready change management, consolidated reporting with eliminations and management KPIs.
- **Key Epics:** RBAC service, approval workflows, close checklist automation, consolidation engine (subsidiary eliminations, multi-book support), reporting APIs + scheduled outputs.
- **Success Metrics:** Close cycle automation covering 80% of tasks, ability to produce consolidated statements + segment reporting in UI/API, audit log coverage for all mutating actions.

### Phase 4 – Ecosystem & Growth (Weeks 16‑24)
- **Goals:** SDKs, connectors (bank feeds, payroll, CRM), workflow automation UX, migration/import tooling, GTM readiness.
- **Key Epics:** SDK generation from OpenAPI, integration framework, import wizard + validation, sandbox self-serve provisioning, documentation portal refresh.
- **Success Metrics:** Partners can build against SDK, at least two external system connectors in production, onboarding time < 1 day.

## Cross-Cutting Tracks
- **Data & Migration:** schema versioning, data quality checks, historical import strategies, anonymized sample datasets.
- **Testing & Quality:** contract tests for APIs, scenario tests in `packages/integration-tests`, performance regression harness for 1M+ events.
- **Security & Compliance:** threat modeling, encryption at rest/inflight, secrets management, compliance logging.
- **Observability & Operations:** dashboards (uptime, event lag, posting failures), alert playbooks, runbooks for close cycle support.

## Governance & Cadence
- **Weekly Program Sync:** review pod status, dependencies, risks, and demonstration of completed work.
- **Phase Gate Reviews:** verify success metrics + acceptance criteria before advancing.
- **Beads Workflow:** each epic/work packet is converted into a Bead (`bd-###`), with pods reserving files via MCP Agent Mail before editing. Include phase + pod tags in Bead metadata to maintain traceability.

## Risks & Mitigation
| Risk | Impact | Mitigation |
| --- | --- | --- |
| Event platform slips | Blocks all downstream pods | Start Phase 1 immediately after Phase 0, dedicate cluster team, add integration tests early |
| Compliance gaps discovered late | Rework reporting + workflows | Embed compliance lead in pods, run incremental SOX reviews each milestone |
| Integration debt accumulates | Limits adoption | Deliver SDK + connector framework in Phase 4 with dedicated resources, enforce API versioning |
| Performance regressions at scale | Undermines system-of-record promise | Introduce perf tests per phase, simulate 1M+ tx dataset before GA |

## Converting to Beads
1. Break each phase’s epics into discrete deliverables (see `docs/system-of-record-capability-backlog.md`).
2. Create Beads with identifiers `bd-gl-###`, referencing this roadmap section + pod ownership.
3. Reserve affected files with MCP Agent Mail before implementation.
4. Update Beads as phases advance; maintain a “blocked” status when dependencies (event store, RBAC, etc.) are outstanding.

## Next Steps
1. Hold a 1-hour planning workshop to assign pod leads and confirm staffing.
2. Use the capability backlog to seed the initial Beads board.
3. Schedule Phase 0 exit review (target: end of next sprint).
4. Establish recurring reporting (dashboard for pod burndown + risk log).

This roadmap should live alongside the evolving backlog; update it whenever phases complete or assumptions change.
