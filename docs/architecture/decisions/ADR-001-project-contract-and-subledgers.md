# ADR-001: Project Contract and Accounting Subledgers

- Status: Accepted for implementation
- Date: 2026-08-26
- Owners: Finance platform
- Beads: `glapi-1x1`, `glapi-1x1.1.1`

## Context

GLAPI already has projects, project tasks, time entries, invoices, subscription billing schedules,
performance obligations, revenue schedules, and revenue journal entries. These capabilities do not yet
share a canonical project contract. As a result:

- a project only declares `fixed_fee` or `time_and_materials` without effective-dated commercial terms;
- subscription billing schedules cannot represent project milestones or certified progress;
- invoice source allocations exist but are not used by billing services;
- invoice timing can be confused with revenue timing;
- revenue recognition writes schedule and journal rows without a period-run boundary; and
- project billing, ASC 606, AR, cash, and GL cannot be reconciled through one immutable lineage.

This decision defines the domain boundary that subsequent schema, service, API, and UI work must follow.

## Decision summary

Introduce a versioned `project_contract` aggregate as the commercial root for project billing and ASC 606.
The project remains the operational container for work, people, budgets, costs, and delivery. The project
contract owns enforceable customer terms and connects four separate subledgers:

1. Billing eligibility and billing schedules
2. ASC 606 performance obligations and revenue schedules
3. Accounts receivable, credits, and cash application
4. General-ledger postings and reversals

Billing does not recognize revenue. Revenue recognition does not create an invoice. Both consume the same
approved contract version and reconcile through contract lines, performance obligations, source allocations,
and immutable accounting events.

## Domain ownership

| Aggregate or ledger | Owns | Does not own |
| --- | --- | --- |
| Project | Delivery dates, tasks, time, costs, budgets, progress | Customer pricing, invoicing, revenue policy |
| Project contract | Customer, currency, consideration, terms, contract versions | Work-entry approval, AR settlement |
| Billing subledger | Billable sources, milestones, billing schedules, invoice-source lineage | Satisfaction of performance obligations |
| Revenue subledger | Obligations, SSP allocation, satisfaction measurements, revenue schedules | Invoice or payment status |
| AR and cash | Issued invoices, credits, payments, open balance | Revenue-recognition policy |
| GL | Posted balanced journals and reversals | Mutable operational workflow state |

## Canonical aggregate

### Project contract

A project may have multiple contracts over its life, but each contract belongs to exactly one organization,
subsidiary, customer, and project. A contract has one active approved version at a time.

Required identity and control fields:

- `id`, `organization_id`, `subsidiary_id`, `project_id`, `customer_id`
- `contract_number`, `name`, `status`
- `transaction_currency_code`, `functional_currency_code`, `exchange_rate`
- `start_date`, `end_date`, `signed_date`
- `current_version_id`
- `created_by`, `created_at`, `updated_at`

Contract status follows this state machine:

| From | Allowed transitions | Meaning |
| --- | --- | --- |
| `draft` | `approved`, `cancelled` | Terms remain editable and produce no accounting |
| `approved` | `active`, `cancelled` | Terms are frozen; activation may generate schedules |
| `active` | `suspended`, `completed`, `terminated` | Billing and recognition may run |
| `suspended` | `active`, `terminated` | New processing is paused; history is unchanged |
| `completed` | none | Obligations are satisfied and no consideration remains open |
| `terminated` | none | Early termination is handled by a final modification/reversal |
| `cancelled` | none | Never activated and has no accounting effect |

### Contract versions and modifications

Approved terms are immutable. Corrections or scope/price/date changes create a new contract version and a
modification record; they never overwrite a version already used for billing or recognition.

A version owns:

- enforceable consideration and variable-consideration constraints;
- payment terms and billing grouping policy;
- billing model and effective-dated rate or milestone rules;
- contract lines and promised goods or services;
- SSP evidence references and revenue-recognition policy; and
- approval identity, timestamp, and rationale.

Modifications are classified explicitly as:

- `separate_contract` when added distinct goods or services are priced at standalone selling price;
- `prospective` for remaining distinct goods or services;
- `cumulative_catch_up` when the remaining goods or services are not distinct from a partially satisfied
  obligation; or
- `termination` for an early end and any required refunds, credits, or reversals.

The classification, effective date, affected obligations, and accounting rationale are persisted.

### Contract lines

Contract lines represent priced promises, not invoice lines. A line includes quantity, unit price, discount,
transaction price contribution, service dates, billing rule, revenue rule, item or service reference, and SSP
evidence. One contract line may map to one or more performance obligations, and one obligation may receive
allocated consideration from multiple contract lines.

## Supported billing policies

### Time and materials

Billing candidates come only from approved, billable, unallocated sources. Initial source adapters are time
entries and completed project tasks. Rates resolve in this order:

1. Explicit source override approved for billing
2. Effective-dated contract rate for person, role, task, item, or cost code
3. Contract default rate

The selected rate and rule version are copied onto the invoice-source allocation so later rate changes cannot
alter billing history.

The ASC 606 policy is independent:

- `right_to_invoice` may recognize revenue in the amount billable when that amount directly corresponds to
  value transferred to the customer; or
- another over-time input/output method may be configured when the right-to-invoice practical expedient is
  not appropriate.

Eligibility for invoicing never proves that a performance obligation is satisfied.

### Fixed-fee milestones

A billing milestone contains an amount or percentage, target date, acceptance condition, and approval state.
An approved milestone becomes billable according to its billing rule.

A milestone is not automatically a revenue event. A contract may explicitly link a milestone to a point-in-time
obligation, but date- or payment-based milestones normally remain billing events while revenue follows the
configured satisfaction method.

### Fixed-fee progress billing

Certified billing progress determines cumulative billable consideration:

`cumulative billable = contract billing basis × certified billing progress`

The current billing candidate is cumulative billable less active prior billing allocations and credits.
Certification identity, evidence, date, percentage, and rule version are immutable.

Revenue progress is measured separately using the obligation's configured method, such as cost-to-cost,
labor-hours, units delivered, elapsed time, or a supported output measure. Billing progress and revenue progress
may be equal only when the contract policy and evidence say they are.

## Billing subledger

The billing queue is a read model over eligible sources. Preview is side-effect free. Draft creation is one
database transaction that:

1. Revalidates and locks every selected source
2. Resolves the approved contract version and effective billing rule
3. Creates invoice headers and lines
4. Creates immutable invoice-source allocations
5. Marks source items as allocated or invoiced
6. Stores the idempotency request hash and result
7. Writes domain events and outbox records

The partial unique constraint on active source allocations remains the last line of defense against double
billing. Exact idempotent replay returns the original result. Reuse of a key with a different request hash is a
conflict.

Void, credit, and rebill operations append allocation transitions. They do not delete or repurpose the original
allocation. Partial rebills transfer explicit hours, quantity, or amount and link predecessor and replacement.

## Revenue subledger

Contract activation identifies performance obligations and allocates transaction price using approved SSP
evidence. Each obligation defines:

- satisfaction timing: `point_in_time` or `over_time`;
- recognition method: `right_to_invoice`, `cost_to_cost`, `labor_hours`, `units_delivered`, `elapsed_time`, or
  `manual_output`;
- service or delivery period;
- allocated transaction price and currency;
- progress source and approval requirements; and
- revenue, contract-asset, and contract-liability accounts.

Revenue schedules are versioned projections of an obligation. Regeneration supersedes remaining schedule rows;
it does not mutate recognized rows. Rounding residuals are applied deterministically to the final open schedule
line so allocated consideration equals recognized plus remaining consideration.

### Recognition runs

Recognition is performed through a period-run aggregate rather than independent row mutations:

| State | Allowed transitions | Effect |
| --- | --- | --- |
| `draft` | `approved`, `cancelled` | Calculates proposed entries without posting |
| `approved` | `posting`, `cancelled` | Freezes scope, inputs, and totals |
| `posting` | `posted`, `failed` | Transactionally creates recognition events and journals |
| `failed` | `posting`, `cancelled` | Retry uses the same run and idempotency identity |
| `posted` | `reversing` | Immutable successful result |
| `reversing` | `reversed`, `failed` | Creates linked opposite entries |
| `reversed` | none | Original and reversal remain visible |
| `cancelled` | none | No accounting effect |

A posted or closed accounting period rejects new recognition, modification, billing-posting, and reversal dates
inside that period unless the period is reopened by an authorized accounting-period workflow.

## Accounting and contract position

For each contract, obligation, customer, currency, and reporting date:

`contract position = cumulative recognized revenue - cumulative net billing`

- A positive position is a contract asset.
- A negative position is a contract liability.
- Zero has neither balance.

The posting engine records the delta from the previously posted contract position. It must not present both a
contract asset and contract liability for the same unit of account. Invoice posting establishes AR and changes
the contract position; cash application changes cash and AR but never revenue.

Required posting behavior:

| Event | Debit | Credit |
| --- | --- | --- |
| Revenue ahead of billing | Contract asset | Revenue |
| Billing ahead of revenue | Accounts receivable | Contract liability |
| Billing of an existing contract asset | Accounts receivable | Contract asset, then contract liability for any excess billing |
| Recognition against existing liability | Contract liability | Revenue |
| Customer payment | Cash or undeposited funds | Accounts receivable |
| Reversal | Exact opposite accounts and dimensions | Exact opposite accounts and dimensions |

Entries carry organization, subsidiary, customer, project, contract, contract version, obligation, source event,
accounting period, transaction currency, functional currency, exchange rate, and idempotency identity.

## Reconciliation invariants

These invariants are enforced by services and conformance tests:

1. Contract transaction price equals the sum of obligation allocations after deterministic rounding.
2. Cumulative recognized revenue plus remaining allocated revenue equals allocated transaction price, adjusted
   only by approved modifications.
3. Cumulative net billing equals active invoice-source allocations plus issued milestone/progress billing less
   credits and voided or transferred allocations.
4. Contract asset less contract liability equals cumulative recognized revenue less cumulative net billing.
5. Open AR equals issued invoices less applied cash, credits, write-offs, and reversals.
6. Every posted event produces a balanced journal in transaction and functional currency.
7. Every revenue schedule row is recognized at most once unless a linked reversal restores it to an explicitly
   reprocessable state.
8. Every billable source has at most one active allocation.
9. Billing schedule changes cannot mutate revenue schedules, and revenue schedule changes cannot mutate invoice
   eligibility.
10. Tenant, subsidiary, project, customer, currency, contract version, and period dimensions agree across all
    linked records.

## API boundaries

The Fastify/OpenAPI surface will expose commands and queries around the aggregate rather than direct table CRUD:

- `POST /v1/project-contracts`
- `POST /v1/project-contracts/{id}/versions`
- `POST /v1/project-contracts/{id}/approve`
- `POST /v1/project-contracts/{id}/activate`
- `POST /v1/project-contracts/{id}/modifications/preview`
- `POST /v1/project-contracts/{id}/modifications/apply`
- `GET /v1/billing-queue/candidates`
- `POST /v1/billing-queue/preview`
- `POST /v1/billing-queue/draft-invoices`
- `POST /v1/invoices/{id}/void-or-rebill`
- `GET /v1/project-contracts/{id}/revenue-plan`
- `POST /v1/revenue-runs`
- `POST /v1/revenue-runs/{id}/approve`
- `POST /v1/revenue-runs/{id}/post`
- `POST /v1/revenue-runs/{id}/reverse`
- `GET /v1/project-contracts/{id}/reconciliation`

All mutation endpoints require an `Idempotency-Key`, actor context, organization context, and an approved contract
version where applicable. Direct schedule mutation remains an internal administrative exception with heightened
authorization and audit logging.

## Database impact

The implementation is expected to add or extend these structures:

- `project_contracts`
- `project_contract_versions`
- `project_contract_lines`
- `project_contract_modifications`
- `project_billing_rules`
- `project_billing_milestones`
- `project_progress_certifications`
- `performance_obligations.project_contract_version_id`
- `performance_obligations.project_contract_line_id`
- `revenue_schedules.schedule_version` and supersession lineage
- `revenue_recognition_runs` and run lines
- reusable command idempotency, financial event, and outbox tables
- accounting dimension references on revenue journals and invoice-source allocations

Existing subscription contracts continue to use the current tables during migration. New project-contract tables
must not overload subscription billing schedules or encode accounting policy only in JSON metadata.

## Authorization and tenancy

Every new table includes `organization_id` and PostgreSQL RLS. Foreign-key relationships are validated within the
same tenant; knowing a UUID is never sufficient authorization. Contract approval, recognition-run approval,
posting, period reopening, void, credit, and rebill are separate permissions. The actor approving a run cannot be
silently replaced by the posting worker identity; both are recorded.

## Migration and rollout

1. Add project-contract tables and nullable lineage columns without changing existing behavior.
2. Backfill a draft contract for eligible projects and generate a reconciliation-only report.
3. Require explicit review and approval before a backfilled contract can drive billing or revenue.
4. Implement T&M billing candidates and source locking behind an organization feature flag.
5. Add fixed-fee milestones and progress certification.
6. Generate project obligations and schedules in parallel-read mode and compare with expected results.
7. Enable posting only after golden scenarios and tenant/concurrency tests pass.
8. Port the complete vertical to Fastify and remove the feature flag organization by organization.

Rollback disables new commands but never deletes contract versions, allocations, events, schedules, or journals.

## Consequences

### Positive

- Billing and revenue timing can differ without losing reconciliation.
- Project pricing and accounting policy become versioned, reviewable business records.
- T&M and fixed-fee projects share one auditable workflow.
- Idempotency, reversals, and period controls are designed into the command boundary.
- Existing ASC 606 and invoice components can be adapted rather than replaced wholesale.

### Costs and tradeoffs

- The model adds a contract aggregate instead of treating the project or invoice as the contract.
- Existing subscription-focused schedules require adapters during migration.
- Accounting events and schedule versions increase storage, but eliminate destructive recalculation.
- Fixed-fee billing and revenue progress require separate approvals and may intentionally show different values.

## Rejected alternatives

### Treat the project as the contract

Rejected because a project can have multiple commercial agreements, renewals, change orders, currencies, or
customers over time, while operational work must remain continuous.

### Use invoices as the revenue-recognition source

Rejected because billing timing is not evidence of performance under ASC 606 and would misstate contract assets,
contract liabilities, and revenue for advance or arrears billing.

### Reuse subscription billing schedules for projects

Rejected because subscription frequency and item proration do not model milestone approval, certified progress,
effective-dated labor rates, or source-level billing lineage.

### Store contract policy only in project metadata

Rejected because JSON-only policy cannot provide referential integrity, effective dating, RLS-friendly queries,
stable OpenAPI contracts, or reliable accounting reconciliation.
