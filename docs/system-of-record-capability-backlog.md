# System-of-Record Capability Backlog

Use this backlog to create Beads for the large-scale implementation described in `docs/system-of-record-roadmap.md`. Each workstream is organized into epics with clearly scoped work packets, suggested acceptance criteria, and dependency notes. Replace the placeholder IDs (`GL-BD-###`) with actual Bead IDs when instantiating tasks.

## Legend
- **Tier:** sequencing guidance (T0 = prerequisite, T1 = early, T2 = later phase).
- **Outputs:** tangible artifacts that demonstrate completion (code, docs, migrations, dashboards).
- **Dependencies:** upstream work, data, or tooling that must exist before starting.
- **Quality:** required documentation + automated test suites for “definition of done.” See `docs/system-of-record-quality-plan.md` for detailed expectations.

---

## 1. Ledger Core & Event Platform
| Tier | Epic | Work Packet | Outputs / Acceptance Criteria | Dependencies | Bead Seeds |
| --- | --- | --- | --- | --- | --- |
| T0 | Event Store Foundation | Implement `event_store`, `event_outbox`, and `event_projections` tables with migrations + seed scripts. Wire into Drizzle config. | Migrations, TypeScript models, automated migration test, documentation in `packages/database`. | None | GL-BD-001 |
| T0 | Event Store Foundation | Build event ingestion SDK + persistence service in `packages/api-service` with retries and telemetry. | Service module, unit tests, logging hooks. | GL-BD-001 | GL-BD-002 |
| T0 | Event Store Foundation | Implement outbox processor worker (`apps/api` background job or new worker app). | Worker deployment, monitoring dashboard, failure alerting. | GL-BD-002 | GL-BD-003 |
| T1 | Posting Engine | Define chart-of-accounts metadata, posting rules DSL, and validation library in `packages/business`. | Posting configuration files, unit tests per transaction type, docs. | GL-BD-002 | GL-BD-010 |
| T1 | Posting Engine | Enforce double-entry + FX handling in `gl-transaction-repository` + service layer. | API rejects unbalanced entries, FX remeasurement stored, integration tests. | GL-BD-010 | GL-BD-011 |
| T1 | Period Management | Implement accounting periods lifecycle (open/close/lock) + REST endpoints. | Tables, service + UI, blocked mutations for closed periods. | GL-BD-001 | GL-BD-012 |
| T1 | Projections | Build real-time balance projections + caching layer for GL accounts. | Projection service, API endpoints, performance test to 1M tx. | GL-BD-003, GL-BD-012 | GL-BD-013 |

## 2. Subledger Workstreams
| Tier | Epic | Work Packet | Outputs / Acceptance Criteria | Dependencies | Bead Seeds |
| --- | --- | --- | --- | --- | --- |
| T1 | Order-to-Cash | Sales order + invoice lifecycle APIs/UI with approval routing. | CRUD + state machine, joining to GL postings, scenario tests. | GL-BD-011 | GL-BD-020 |
| T1 | Order-to-Cash | Cash application + customer payments, including bank deposit batches. | Payment repository updates, reconciliation rules, ledger postings. | GL-BD-020, GL-BD-070 | GL-BD-021 |
| T1 | Procure-to-Pay | Purchase order, bills, and bill payments with 3-way match checks. | Workflow service, variance reporting, posting hooks. | GL-BD-011 | GL-BD-030 |
| T1 | Inventory | Costing engine (FIFO/LIFO/average config) + adjustments/transfer flows. | Inventory projections, audit trail, GL integration tests. | GL-BD-030 | GL-BD-031 |
| T2 | Projects & Time | Project master data, time/expense capture, job-cost allocations. | Database schema, approval UI, posting to WIP accounts. | GL-BD-011 | GL-BD-040 |
| T2 | Subscription & Revenue | Subscription lifecycle (create, amend, cancel) with billing schedules and revenue recognition waterfall. | Schedules table updates, integration with performance obligations, regression tests. | GL-BD-010 | GL-BD-041 |

## 3. Compliance & Controls
| Tier | Epic | Work Packet | Outputs / Acceptance Criteria | Dependencies | Bead Seeds |
| --- | --- | --- | --- | --- | --- |
| T0 | Access Control | Implement RBAC: roles, permissions, enforcement middleware, admin UI. | Policy engine, tests, doc for role templates. | GL-BD-001 | GL-BD-050 |
| T0 | Audit Logging | Event-driven audit log for all mutating actions with secure retention. | Log table, event subscriber, API export. | GL-BD-003 | GL-BD-051 |
| T1 | Approvals & SoD | Configurable approval chains per document type + segregation enforcement. | Workflow DSL, UI, blocking logic, unit + e2e tests. | GL-BD-050 | GL-BD-052 |
| T1 | Close Management | Close checklist automation, variance alerts, tie-out templates. | Close tasks DB, notifications, reporting view. | GL-BD-012 | GL-BD-053 |
| T2 | Compliance Tooling | SOX-ready change management + audit packages (exported bundles). | Evidence export script, documentation, scheduling. | GL-BD-051 | GL-BD-054 |

## 4. Reporting & Analytics
| Tier | Epic | Work Packet | Outputs / Acceptance Criteria | Dependencies | Bead Seeds |
| --- | --- | --- | --- | --- | --- |
| T1 | Financial Statements | API + UI for Trial Balance, Income Statement, Balance Sheet w/ multi-entity filters. | Queries in `gl-reporting-repository`, caching, pdf/csv export. | GL-BD-013 | GL-BD-060 |
| T1 | Consolidations | Subsidiary eliminations, multi-book support, FX translation adjustments. | Consolidation engine, tests with sample org, dashboards. | GL-BD-060 | GL-BD-061 |
| T2 | Management Reporting | Segment/class/location reporting, KPIs, dashboard widgets. | Metrics service, UI components, doc. | GL-BD-061 | GL-BD-062 |
| T2 | Scheduled Reporting | Report scheduling + distribution (email/webhooks). | Scheduler service, notification integration, audit log entries. | GL-BD-062, GL-BD-052 | GL-BD-063 |

## 5. Platform, Integrations, & Tooling
| Tier | Epic | Work Packet | Outputs / Acceptance Criteria | Dependencies | Bead Seeds |
| --- | --- | --- | --- | --- | --- |
| T0 | CI/CD & Quality Gates | Automated `pnpm lint`, `type-check`, and critical tests per PR with reporting. | Updated GitHub Actions/turbo pipeline, docs. | None | GL-BD-070 |
| T1 | SDK & Developer Experience | Generate client SDKs from OpenAPI, add examples + quickstarts. | SDK packages, docs, publish pipeline. | GL-BD-070 | GL-BD-071 |
| T1 | Workflow Automation | Build workflow engine (webhooks, rules, task orchestration). | Service, UI builder, tests, docs. | GL-BD-052 | GL-BD-072 |
| T2 | Connectors | Bank feed ingestion, payroll, CRM connectors with mapping + monitoring. | Connector framework, at least two production connectors. | GL-BD-071 | GL-BD-073 |
| T2 | Migration Toolkit | Import wizard, validation, rollback tooling, audit logs. | CLI/UX, docs, sample data sets. | GL-BD-070 | GL-BD-074 |

## 6. Experience & Adoption
| Tier | Epic | Work Packet | Outputs / Acceptance Criteria | Dependencies | Bead Seeds |
| --- | --- | --- | --- | --- | --- |
| T1 | Onboarding UX | Guided setup wizard (entity, CoA, opening balances) + contextual docs. | UI flows, analytics, success metrics. | GL-BD-071, GL-BD-013 | GL-BD-080 |
| T1 | Documentation Portal | Consolidate docs into searchable portal with versioning + code samples. | Static site or doc tool, CI deploy, search. | GL-BD-071 | GL-BD-081 |
| T2 | Conversational Interface | Embed conversational ledger assistant for workflows (based on `docs/conversational-general-ledger.md`). | Chat service, action framework, guardrails. | GL-BD-072 | GL-BD-082 |

---

## Backlog Grooming Checklist
1. Confirm dependencies resolved (Phase, Tier).
2. Attach references (design docs, schema files, API specs) to each Bead.
3. Define acceptance tests (unit/integration/e2e) before starting.
4. Reserve files using MCP Agent Mail before editing code or docs.
5. Update this backlog as new epics emerge or scope shifts.

Maintaining this backlog keeps the Beads board aligned with the overarching roadmap while giving contributors clear, auditable slices of work.
