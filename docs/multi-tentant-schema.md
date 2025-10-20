# Multi-Tenant Construction Accounting Schema

## Goals
- Recreate construction accounting workflows inside GLAPI while keeping everything multi-tenant aware.
- Support job-costing, commitments, change management, and cash reconciliation on top of the existing `business_transactions` + general ledger foundation.
- Minimize churn to the current schema by extending shared primitives (transactions, entities, GL) instead of building one-off tables per document type.

## Construction Scope Snapshot
The initial parity target covers:
- Project master data (jobs, participants, cost codes, cost types, budgets).
- Contracting flows: prime contracts, commitments (subcontracts + purchase orders), change orders (owner + commitment).
- Progress + requisitioning: schedule of values, pay applications, retainage tracking, vendor invoices, owner billings, cash receipts/disbursements.
- Auditability: lifecycle state history, GL posting, cross-document relationships, and document attachments.

## What We Already Have
| Domain area | Current assets | Coverage | Gaps for construction accounting |
|-------------|----------------|----------|----------------------------------|
| Generic transactions | `business_transactions` + `business_transaction_lines` ([packages/database/drizzle/schema.ts:421](packages/database/drizzle/schema.ts:421)) | Core header/lines, project + class references, parent/root chaining, GL linkage | Lacks project master data to point at, schedule-of-values metadata, retainage percentages, draw status fields |
| Transaction lineage | `transaction_relationships` ([packages/database/drizzle/schema.ts:600](packages/database/drizzle/schema.ts:600)) | Can connect draw → contract or CO → commitment | Need explicit relationship types for construction (e.g. `schedule_of_values`, `owner_draw`, `retainage_release`) |
| GL + audit | `gl_transactions`, `gl_transaction_lines`, `gl_posting_rules` ([packages/database/drizzle/schema.ts:130](packages/database/drizzle/schema.ts:130)) | Double-entry posting, subsidiary scoping, links back to source transaction | Posting rules do not yet know about construction scenarios (retainage, WIP segregation) |
| Parties & orgs | `organizations`, `entities`, `subsidiaries`, `addresses` ([packages/database/drizzle/schema.ts:697](packages/database/drizzle/schema.ts:697)) | Multi-tenant orgs, vendors/customers/employees | Need project participant roles (owner, GC, architect, etc.) |
| Items & cost structure | `items`, `activity_codes`, `classes`, `departments` ([packages/database/drizzle/schema.ts:710](packages/database/drizzle/schema.ts:710)) | Catalog + dimensional tagging | `activity_codes` lacks tenant + subsidiary columns and cost-type semantics; no project-level budget grid |

## Proposed Extensions

### 1. Projects & Participants
Create a dedicated `projects` table scoped by tenant/subsidiary.
```sql
projects (
  id uuid PK,
  organization_id uuid FK -> organizations,
  subsidiary_id uuid FK -> subsidiaries,
  project_code text UNIQUE within org,
  name text,
  status text check in ('planning','active','substantial_completion','closed'),
  start_date date,
  end_date date,
  external_source text, -- 'procore', 'manual', etc.
  external_reference text, -- upstream ID
  job_number text,
  project_type text,
  retainage_percent numeric(5,2) default 0,
  currency_code text,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)
```

Add `project_participants` for owner/GC/sub roles and `project_addresses` if we need site/ship-to separation.

### 2. Cost Codes & Budgets
- Align `activity_codes` definition with the richer tenant-aware version in `packages/database/src/db/schema/activity-codes.ts` by backfilling the missing columns in the generated schema.
- Introduce `project_cost_codes` (project-specific overrides + status) and `project_budget_versions` + `project_budget_lines` for the budget grid (cost code × cost type).
- Map lines via existing `business_transaction_lines.activity_code_id` and optionally a new `cost_type` enum to support labor/material/sub.

### 3. Transaction Typing & Metadata
Add construction-specific `transaction_types` rows and extend headers/lines with lightweight fields rather than new tables wherever possible.

| Document | Representation | Notes |
|----------|----------------|-------|
| Prime Contract | `business_transactions` with `transaction_type_code = 'PRIME_CONTRACT'` | Link to `projects.id`, capture schedule of values on lines, use `transaction_relationships` to tie payment apps |
| Commitment (Subcontract/PO) | `business_transactions` w/ type `'COMMITMENT'` | Use `entity_id` to reference vendor, leverage parent/root for revisions |
| Change Orders | `business_transactions` w/ type `'CHANGE_ORDER'` | Distinguish owner vs commitment via `workflow_status` or subtype column; relate to base doc via `parent_transaction_id` |
| Pay Application / Requisition | `business_transactions` w/ type `'PAY_APP'` | New fields: `through_date`, `retainage_percent`, `retainage_amount` |
| Vendor Invoice | Existing `'VENDOR_BILL'` type | Tie to commitment via `transaction_relationships` |
| Cash Receipt / Disbursement | Reuse GL cash transactions but flag `project_id` to support job-cost cash reconciliation |

Header additions:
- `retainage_percent`, `retainage_released_percent` (nullable numeric).
- `period_start_date`, `period_end_date` for pay apps.
- `workflow_payload jsonb` for storing approval metadata synced from construction platform.

Line additions:
- `schedule_value`, `work_completed_to_date`, `retainage_amount`, `stored_material_amount` numeric columns.

### 4. Lifecycle & Audit
- Add `project_status_history` table for key state changes.
- Reuse existing `gl_audit_trail` but add `project_id` to the log entries.
- Ensure all project-scoped tables ship with RLS policies referencing `organization_id`/`subsidiary_id`.

### 5. Integration Touchpoints
- Store upstream identifiers on projects, transactions, and lines via a shared `external_references` table to simplify bi-directional sync.
- Create staging tables for rate-limited bulk loads (`integration_ingest_jobs`, `integration_ingest_documents`) to buffer API usage and allow replay.

### External References
- Introduce a shared `external_references` table to map any record to upstream systems.
  - Columns: `id`, `object_type`, `object_id`, `provider`, `external_id`, `metadata`, timestamps.
  - Unique `(provider, external_id)` prevents duplicates while keeping the core tables provider-agnostic.
  - Enables multi-provider sync in parallel (Procore today, QuickBooks tomorrow) without schema churn.
- Use simple join conventions: e.g. `projects.id` ↔ `external_references` via `object_type = 'project'`.
- Leverage metadata for versioning or webhook checkpoints.

## Multi-Tenancy & Isolation
- Every new table includes `organization_id` (and `subsidiary_id` where financial). Row Level Security must filter by the Clerk organization or selected subsidiary.
- When extending existing tables (e.g., `business_transactions`), add RLS predicates that join through `subsidiary_id -> subsidiaries.organization_id` so cross-tenant leakage is impossible.
- Align the duplicated `activity_codes` definitions so migrations, TypeScript types, and generated schema stay in sync.

## GL & Cash Positioning
- Extend `gl_posting_rules` to understand construction-specific `transaction_type_id` values (retainage, cost accrual, revenue recognition, cash release).
- Use `transaction_relationships` to tie pay apps ↔ GL cash entries for reconciliation reporting.
- Consider a materialized view `project_wip_summary` that joins `gl_transaction_lines` on `project_id` for Work-In-Progress dashboards.

## Implementation Implications
1. **Baseline migrations**: add `projects` + supportive tables, patch `activity_codes`, extend `business_transactions` / `_lines`. Ensure drizzle schema + typed schema stay aligned. Migration `packages/database/drizzle/0007_construction_projects.sql` seeds the initial project/external reference footprint.
2. **Enum & seed updates**: register new `transaction_types`, add default posting rules, seed cost-type enums.
3. **Service layer**: update TRPC/business services to accept `projectId`, retainage, schedule amounts, and enforce RLS.
4. **Integration layer**: build sync jobs using new staging tables, map documents to transaction types.
5. **Reporting**: deliver WIP, commitment exposure, and cash reconciliation views using GL + project metadata.

## Open Questions
- Do we model segments (Division, Cost Code, Cost Type) separately or flatten into a single code string?
- How much of construction platform's approval workflow do we mirror versus store as opaque payloads?
- Should retainage live at the header level only, or support line-level overrides (mirroring owner-requested adjustments)?
- Are direct costs treated as their own transaction type or as GL journal entries with a `project_id` tag?

These answers will shape the migration strategy and API surface; we should resolve them before writing the first migration.
