# System-of-Record Documentation & Testing Plan

This plan translates the capabilities in `docs/system-of-record-roadmap.md` and the Beads backlog into concrete documentation and automated testing requirements. Treat these as non-negotiable acceptance criteria: no epic is “done” until the associated docs/tests exist and pass in CI.

## Quality Principles
1. **Docs and tests ship with features** – every pull request that adds functionality must add/extend the relevant docs and test suites.
2. **Executable specs** – prioritize automated tests (unit/integration/e2e/perf) over manual checklists wherever possible.
3. **Traceability** – cross-reference doc pages and test files with the owning Bead ID for future audits.
4. **Continuous validation** – CI must run the applicable suites (`pnpm lint`, `pnpm type-check`, package-specific tests, Playwright for UI, etc.) before merge.

## Coverage Matrix

| Capability Area | Required Documentation | Required Automated Tests | Notes |
| --- | --- | --- | --- |
| **Event Store & Outbox (glapi-80g, glapi-svz, glapi-rme)** | Architecture update in `docs/event-sourced-gl.md`, schema reference in `packages/database/README`, runbook in `monitoring/` | Unit tests for event SDK, integration tests for persistence/outbox worker, failure/retry tests, performance test simulating 1M events | Add migration docs with rollback instructions |
| **Posting Engine & GL Enforcement (glapi-z5t, glapi-czl)** | Posting DSL guide + sample configs in `docs/transaction-based-design.md`, developer guide in `packages/business/README` | Unit tests for rule evaluation, integration tests validating balanced postings across transaction types, mutation tests to ensure rejects | Document FX handling, rounding, and currency policies |
| **Accounting Periods & Close (glapi-plr, glapi-08e)** | Close handbook update, UI walkthrough, API reference additions | Service tests for state transitions, e2e tests for blocking postings, Playwright flows for close checklist UX | Link to compliance evidence export doc |
| **Balance Projections & Reporting (glapi-cb8, glapi-58d, glapi-qii, glapi-9ub, glapi-4n3)** | Reporting user guide, API docs, data dictionary updates | Integration tests for projection accuracy, snapshot tests for statements, Playwright coverage for reporting UI, load/perf tests | Provide sample trial balance exports |
| **Subledger Pods (glapi-h13, t0b, 1y4, ysf, 0ib, crk)** | End-to-end process docs (O2C, P2P, Inventory, Projects, Subscription) in `docs/order-to-cash-process.md` and new sections per module; user onboarding checklists | Unit tests for services, integration tests for posting to GL, Playwright scenarios covering approvals + state changes, contract tests for APIs | Include sample data fixtures referenced in docs |
| **Compliance & Controls (glapi-i4b, 3pq, r16, yuk)** | Security model doc, RBAC reference, audit logging spec, SOX checklist | Security-focused unit tests (policy evaluation), integration tests for audit log coverage, e2e tests for approval flows, snapshot tests for evidence exports | Ensure docs reference log retention + compliance requirements (see `docs/compliance/evidence-bundles.md`) |
| **Platform & Integrations (glapi-zrw, a3h, dcg, bl8, vi9)** | Dev onboarding guide, SDK quickstarts, connector manuals, migration playbook | CI pipeline tests, SDK contract tests, integration tests for connectors against mocks, migration tool unit/integration tests | Provide sample `.env` requirements in docs |
| **Experience & Adoption (glapi-3gv, 4px, 33o)** | Onboarding UX manual, documentation portal architecture doc, conversational agent usage + safety guide | Playwright tests for onboarding wizard, doc site build tests, automated safety/regression tests for conversational flows | Add analytics dashboards for adoption metrics |

## Documentation Requirements
- **Location:** Prefer existing topical docs where possible; otherwise create new files under `docs/` with clear naming.
- **Structure:** Include overview, prerequisites, step-by-step guides, API references, and troubleshooting sections. Reference the owning Bead ID near the top of each doc.
- **Versioning:** For API/SDK docs, maintain version tags and changelog entries.
- **Runbooks:** Operational features must provide runbooks (e.g., event/outbox worker, connectors) under `monitoring/` or `docs/runbooks/`.

## Testing Requirements
- **Unit Tests:** Cover pure business logic (posting rules, RBAC policies, DSL evaluation). Live in the owning package (e.g., `packages/business/src/__tests__`).
- **Integration Tests:** Use `packages/integration-tests` to validate workflows across repositories/services. Include fixtures for typical ledger scenarios.
- **E2E/UI Tests:** Add Playwright specs under `tests/` for user flows (approvals, onboarding, reporting exports, etc.).
- **Performance Tests:** For event pipeline and projections, add benchmark scripts (can live under `packages/business/perf` or `scripts/`) and integrate into CI for nightly runs.
- **Security/Compliance Tests:** Include policy simulation tests (SoD violations, unauthorized actions) and ensure audit logging coverage is asserted.

## Workflow Checklist
1. **Before implementation:** update the Quality section of the relevant backlog entry with doc/test plan.
2. **During development:** keep docs/tests in the same PR; reference Bead ID and affected doc/test files in commit messages.
3. **Code review:** verify docs and tests exist and link back to this plan.
4. **CI enforcement:** ensure `pnpm lint`, `pnpm type-check`, and relevant package tests + Playwright specs run automatically (glapi-zrw).
5. **Release readiness:** update `DOCUMENTATION-COMPLETE.md` and `production-readiness-checklist.md` when epics complete.

Refer back to this plan whenever scoping new work to maintain parity with the NetSuite-class quality bar.
