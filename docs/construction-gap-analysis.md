# Construction Accounting Gap Analysis

Goal: clarify how the GLAPI construction accounting stack compares against NetSuite and QuickBooks so we can prioritize features, messaging, and delivery work.

## Feature Matrix Overview

| Capability | GLAPI (target) | NetSuite | QuickBooks Online/Enterprise |
|------------|----------------|----------|------------------------------|
| Multi-tenant architecture | ✅ Native: organizations + subsidiaries + RLS | ⚠️ OneWorld add-on required | ⚠️ One company file per entity |
| Projects / Jobs | ✅ Existing class/department/location segments + dedicated `projects` dimension (Phase 1) | ✅ Jobs & SuiteProjects | ✅ Basic jobs via customer/class tags |
| Commitments (subcontracts, POs) | ✅ `business_transactions` with `COMMITMENT` type + vendor linkage | ⚠️ Purchase orders only without custom bundle | ❌ Requires add-ons/manual tracking |
| Change Orders | ✅ `CHANGE_ORDER` transactions w/ parent/root chaining | ⚠️ Supported but requires workflow setup | ❌ Manual adjustments only |
| Pay applications / progress billing | ✅ Retainage + schedule-of-values fields | ⚠️ Available with SuiteProjects | ❌ Limited progress invoicing; no retainage |
| Retainage tracking | ✅ Header + line retainage; release posting rules | ⚠️ Requires customization | ❌ Not supported |
| Cost codes & budgets | ✅ Project cost codes + budget versions (Phase 2) | ✅ Job costing + budgets | ⚠️ Simple cost categories |
| Direct cost capture | ✅ GL transaction tagging (`project_id`, `activity_code_id`) | ✅ Vendor bills/expenses | ✅ Vendor bills/expenses (manual tie-out) |
| Work-in-progress reporting | ✅ `project_wip_summary` view + GL linkage (Phase 4) | ⚠️ Requires Advanced Projects | ⚠️ Spreadsheet-based |
| Approvals & audit trail | ✅ Transaction history + planned approval payloads | ⚠️ Workflow Engine | ⚠️ Basic approval levels |
| Integration-first API | ✅ External references table, ingest staging | ⚠️ SuiteTalk/SuiteQL (quota & auth friction) | ⚠️ Narrow REST API, low limits |
| Pricing / deployment | ✅ Modular SaaS; schema-only footprint | ❌ High license + services cost | ✅ Low cost but shallow feature set |

Legend: ✅ native/strong, ⚠️ available but complex/limited, ❌ missing.

## Job Costing Depth

GLAPI already exposes the core accounting segments—`classes`, `departments`, and `locations`—used by NetSuite-style ERPs. To deliver true job costing we are layering on:

1. **Projects dimension** (Phase 1): first-class `projects` table with organization/subsidiary scope, participant roles, and external references. Transactions and GL lines already carry a `project_id` column; we will enforce referential integrity once the table lands.
2. **Structured cost codes + budgets** (Phase 2): `project_cost_codes`, `project_budget_versions`, and `project_budget_lines` connect activity codes to project phases and cost types, enabling budget vs actual reporting without spreadsheets.
3. **Retainage-aware transactions** (Phase 3): pay apps, commitments, and change orders inherit retainage fields, schedule-of-values breakdowns, and posting rules that hit the GL with the correct cost vs retainage segregation.
4. **Reporting views** (Phase 4): materialized `project_wip_summary`, cash reconciliation joins, and budget vs actual dashboards ensure controllers have NetSuite-style visibility with less configuration.

With these layers, we match and in some areas exceed “native job costing”: every cost passes through the double-entry GL, is tagged to a project/cost code, and rolls into WIP automatically.

## NetSuite vs GLAPI

**NetSuite strengths** we acknowledge:
- Mature ERP covering procurement, payroll, CRM, and consolidations.
- Proven job costing with segment-based reporting and optional SuiteProjects feature set.
- Established ecosystem of SuiteApps and scripting APIs.

**Pain points we target:**
- High implementation and licensing overhead for contractors who only need commitments, pay apps, and WIP reporting.
- Construction workflows (retainage, subcontract management) often require custom SuiteScripts or third-party bundles.
- SuiteTalk/SuiteQL limits, token auth, and slow release cadence frustrate dev teams building integrations.

**GLAPI differentiation & actions:**
- Ship construction-first schema (projects, commitments, retainage) as defaults rather than customizations.
- Lean on the external references table + ingest pipelines to make integrations deterministic even under upstream rate limits.
- Close remaining gaps with focused investments in reporting packs, approval workflows, and admin tooling instead of broad ERP modules.

## QuickBooks vs GLAPI

**QuickBooks strengths:**
- Low cost, easy adoption, and a broad accountant partner network.
- Basic job costing via customers/classes, along with common AP workflows.
- Rich marketplace of third-party add-ons.

**Limitations pushing contractors away:**
- No consolidated multi-entity view; painful for GCs with multiple subsidiaries or joint ventures.
- Retainage and progress billing require spreadsheets or niche add-ons.
- WIP and committed cost reporting is manual and error-prone.
- API limits/structure make deep automation difficult as volumes grow.

**Our positioning:**
- Offer “QuickBooks-plus” construction accounting: commitments, change orders, retainage, and WIP backed by a proper GL.
- Provide migration tooling (via external references + staging queues) so historical QuickBooks data can be reconciled inside GLAPI without re-entry.
- Keep pricing modular so customers only pay for the construction-specific layers they outgrew QuickBooks to obtain.

## Closing the Remaining Gaps

| Gap | Plan |
|-----|------|
| Reporting (WIP, cash, budget vs actual) | Phase 4 deliverables: `project_wip_summary`, cash reconciliation joins, KPI snapshots; pair with docs + sample dashboards. |
| Compliance & approvals | Add lightweight approval states + `workflow_payload` JSON, tie into audit trail and RLS policies; surface in TRPC + UI. |
| Budgeting UI & import tooling | Build project budget import (CSV/API) backed by `project_budget_versions`, plus validation endpoints. |
| Field & vendor integrations | Standardize on `external_references` table, ship `integration_ingest_*` pipelines, and document webhook/ETL patterns. |
| Controller UX | Provide query templates and/or packaged Looker/Metabase models so finance teams can self-serve. |

## Strategic Positioning Summary

1. **Bridge QuickBooks and NetSuite/Procore** with construction-first accounting primitives layered on a multi-tenant GL platform.
2. **Lead with integration reliability**—external references, staged ingestion, and consistent transaction lineage are the antidote to Procore API fatigue.
3. **Invest in controller outcomes**—WIP, retainage, and cash reconciliation must be turnkey to win migrations from QuickBooks and keep NetSuite at bay.
4. **Stay modular**—focus on the construction accounting core while partnering for peripheral functions (HR, CRM, field management).

## Next Steps
- Validate the job costing plan and gap-closing roadmap with pilot customers and internal stakeholders.
- Sequence migrations: `activity_codes` alignment → `projects` dimension → budgets/retainage → reporting views.
- Build GTM messaging around “retainage without spreadsheets” and “WIP reporting without a six-month NetSuite project,” highlighting integration ease vs Procore.
