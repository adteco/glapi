# Phase 1: Billing Queue and Invoice Orchestration

## Objective

Create an operational billing queue so finance can see what is pending billing, select items, and generate invoice drafts quickly.

This phase directly addresses immediate billing of existing time entries and project work.

## User Experience

### New page

- Route: `/transactions/sales/billing-queue`
- Primary views:
  - `Ready to Bill` (approved/unbilled work)
  - `In Draft Invoices` (selected but not sent)
  - `Recently Billed` (sent/posted history)

### Actions

1. Filter by customer, project, date range, source type
2. Select one or many billing candidates
3. Preview invoice totals grouped by customer/project
4. Create draft invoice(s)
5. Open invoice editor and send

## Data Model

### Existing sources

- Time entries (`time_entries`) with `status = APPROVED` and billable
- Project tasks (`project_tasks`) with `status = COMPLETED`, `is_billable = true`, `invoiced_at IS NULL`
- Optional later source adapters:
  - Sales order unbilled lines
  - Expense entries where billable amount exists

### Proposed additions

1. `invoice_source_allocations` table
   - Purpose: prevent double billing and preserve exact source-to-invoice traceability
   - Fields:
     - `id`
     - `organization_id`
     - `invoice_id`
     - `invoice_line_item_id`
     - `source_type` (`TIME_ENTRY`, `PROJECT_TASK`, `SALES_ORDER_LINE`, `EXPENSE_ENTRY`)
     - `source_id`
     - `source_hours` (nullable)
     - `source_amount`
     - `created_at`
   - Constraints:
     - Unique on `(source_type, source_id)` for active allocations

2. Optional helper columns (performance/ergonomics)
   - `time_entries.invoice_line_id` nullable
   - `expense_entries.invoice_line_id` nullable

## Concurrency and Idempotency Controls

1. `billingQueue.createDraftInvoices` requires request idempotency key
2. Candidate selection must validate source eligibility again at write time
3. Draft generation must run in a transaction with lock/version checks on source rows
4. Duplicate request replay must return prior draft result rather than create new invoices

## Rebill and Reversal Lifecycle

1. Source allocations remain locked while invoice is active
2. Voids/credits must transition allocation state so rebill is explicit and auditable
3. Partial rebill supports quantity/hour/amount-level transfer
4. Allocation lineage links original invoice, reversal document, and replacement invoice

## API Design

### New router: `billingQueue`

1. `billingQueue.listCandidates`
   - Returns normalized candidates from all supported source types
   - Includes customer/project context and calculated billable amount

2. `billingQueue.previewInvoiceDraft`
   - Input: selected candidate IDs
   - Output: grouped invoice preview (by customer, optional by project)

3. `billingQueue.createDraftInvoices`
   - Input: selected candidates + grouping strategy
   - Output: created invoice IDs
   - Transactional behavior:
     - Create invoices + lines
     - Create source allocations
     - Mark task/time source as invoiced in same transaction
     - Persist idempotency and allocation lineage metadata

## UI Components

1. Billing queue table with bulk selection
2. Summary sidebar
   - Total selected amount
   - Candidate count and hours
3. Draft creation dialog
   - Grouping options:
     - per customer
     - per project
     - per customer+project
4. Rebill dialog (phase extension)
   - select reversal mode
   - choose allocation transfer behavior

## Reporting Impact

- Dashboard cards should read from allocation-backed queries for accurate:
  - pending billing
  - billed this period
  - billing velocity

## Acceptance Criteria

1. Finance can see all invoice-eligible approved work in one queue
2. No source item can be billed twice
3. Draft invoice creation is transactional and auditable
4. Existing invoices flow continues to work unchanged
5. Dashboard pending billing decreases immediately after draft creation
6. Replayed create request does not create duplicate drafts
7. Voided/credited source items can be rebilled only through explicit rebill workflow

## Testing

- Unit:
  - source aggregation
  - amount calculations
  - double-billing prevention
- Integration:
  - draft generation transaction rollback behavior
  - concurrent draft generation race (same candidate set)
  - idempotent replay behavior
  - reversal and rebill allocation transfer
- E2E:
  - select pending items, create draft, send invoice
  - rebill after void/credit path

## Complexity and Estimate

- Complexity: Medium
- Estimate: 1-2 weeks
