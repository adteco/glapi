# ADR-001 Golden Accounting Scenarios

- Status: Accepted test specification
- Date: 2026-08-26
- Parent decision: [ADR-001](./ADR-001-project-contract-and-subledgers.md)
- Beads: `glapi-1x1.1.2`

These scenarios are normative fixtures for project billing, ASC 606, AR, and GL conformance tests. Implementations
may add records or dimensions, but the monetary outputs and invariants below must remain unchanged.

## Fixture conventions

- Functional and transaction currency are USD.
- Amounts are decimal strings with two fractional digits at API boundaries.
- Revenue allocation and progress calculations use at least four decimal places internally.
- Final posted amounts round half away from zero to currency precision.
- Dates are UTC date-only values.
- `B` means cumulative net billing: issued invoices less voids and credits.
- `R` means cumulative recognized revenue after reversals.
- Contract position is `R - B`: positive is a contract asset; negative is a contract liability.
- An invoice is posted before same-day revenue recognition unless a scenario says otherwise.
- Tax, discounts outside stated contract consideration, FX, and payment fees are zero.
- Every journal line carries organization, subsidiary, customer, project, contract, contract version, source event,
  and accounting-period dimensions.

Common IDs:

| Dimension | Stable fixture value |
| --- | --- |
| Organization | `org-golden` |
| Subsidiary | `sub-golden-us` |
| Customer | `cust-golden` |
| Project | `project-golden` |
| AR account | `1100-accounts-receivable` |
| Contract asset account | `1150-contract-assets` |
| Cash account | `1000-cash` |
| Contract liability account | `2300-contract-liabilities` |
| Services revenue account | `4000-services-revenue` |

## G-001: T&M right-to-invoice in the same period

### Inputs

| Field | Value |
| --- | --- |
| Contract | `contract-tm-001`, version 1 |
| Billing model | `time_and_materials` |
| Revenue method | `right_to_invoice` |
| Effective rate | $150.00 per approved hour |
| January source | `time-jan-001`, 10 approved billable hours |
| February source | `time-feb-001`, 8 approved billable hours |
| Payment terms | Net 30 |

### Expected billing

| Date | Action | Source allocation | Invoice amount |
| --- | --- | --- | ---: |
| 2026-01-31 | Create and issue `INV-TM-001` | 10.00 h × $150.00 | $1,500.00 |
| 2026-02-28 | Create and issue `INV-TM-002` | 8.00 h × $150.00 | $1,200.00 |

Each source has exactly one active allocation. Replaying either draft command with the same idempotency key returns
the original invoice. A different payload with the same key returns a conflict.

### Expected ASC 606 output

One over-time performance obligation uses the right-to-invoice practical expedient.

| Period | Recognized in period | Cumulative R |
| --- | ---: | ---: |
| January 2026 | $1,500.00 | $1,500.00 |
| February 2026 | $1,200.00 | $2,700.00 |

### Expected journals

| Event | Debit | Credit |
| --- | --- | --- |
| January invoice | AR $1,500.00 | Contract liability $1,500.00 |
| January recognition | Contract liability $1,500.00 | Services revenue $1,500.00 |
| February invoice | AR $1,200.00 | Contract liability $1,200.00 |
| February recognition | Contract liability $1,200.00 | Services revenue $1,200.00 |
| Payment of January invoice | Cash $1,500.00 | AR $1,500.00 |

### Period balances and invariants

| Period end | B | R | Contract asset | Contract liability | Open AR |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2026-01-31 | $1,500.00 | $1,500.00 | $0.00 | $0.00 | $1,500.00 |
| 2026-02-28 | $2,700.00 | $2,700.00 | $0.00 | $0.00 | $1,200.00 |

`R - B = 0.00` at both period ends. Cumulative revenue and cumulative net billing both equal $2,700.00.

## G-002: T&M revenue ahead of delayed billing

### Inputs

| Field | Value |
| --- | --- |
| Contract | `contract-tm-002`, version 1 |
| Billing model | `time_and_materials` |
| Revenue method | `labor_hours` |
| Rate and allocated value | $150.00 per transferred hour |
| Satisfaction evidence | 10 hours approved for delivery on 2026-01-31 |
| Billing approval | Delayed until 2026-02-05 |

### Expected schedules and billing

January recognition is $1,500.00. The source does not enter the billing queue until February approval. February
billing creates `INV-TM-003` for $1,500.00 and one active allocation.

### Expected journals

| Date | Event | Debit | Credit |
| --- | --- | --- | --- |
| 2026-01-31 | Revenue recognition | Contract asset $1,500.00 | Services revenue $1,500.00 |
| 2026-02-05 | Invoice | AR $1,500.00 | Contract asset $1,500.00 |

### Period balances and invariants

| Date | B | R | Contract asset | Contract liability | Open AR |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2026-01-31 | $0.00 | $1,500.00 | $1,500.00 | $0.00 | $0.00 |
| 2026-02-05 | $1,500.00 | $1,500.00 | $0.00 | $0.00 | $1,500.00 |

At January end, `R - B = 1,500.00`, equal to the contract asset. Billing clears the asset without changing revenue.

## G-003: Fixed fee billed in advance and recognized over time

### Inputs

| Field | Value |
| --- | --- |
| Contract | `contract-fixed-001`, version 1 |
| Fixed consideration | $12,000.00 |
| Billing | 100% on activation, 2026-01-01 |
| Obligation | One stand-ready service obligation |
| Revenue method | `elapsed_time`, monthly, January through December 2026 |
| Allocation | $12,000.00 |

### Expected billing and revenue schedule

`INV-FIXED-001` is issued for $12,000.00 on January 1. Twelve revenue rows recognize $1,000.00 on each month end.
Invoice payment timing has no effect on the revenue schedule.

### Expected journals through February

| Date | Event | Debit | Credit |
| --- | --- | --- | --- |
| 2026-01-01 | Invoice | AR $12,000.00 | Contract liability $12,000.00 |
| 2026-01-31 | January recognition | Contract liability $1,000.00 | Services revenue $1,000.00 |
| 2026-02-28 | February recognition | Contract liability $1,000.00 | Services revenue $1,000.00 |

### Period balances and invariants

| Period end | B | R | Contract asset | Contract liability | Remaining allocation |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2026-01-31 | $12,000.00 | $1,000.00 | $0.00 | $11,000.00 | $11,000.00 |
| 2026-02-28 | $12,000.00 | $2,000.00 | $0.00 | $10,000.00 | $10,000.00 |
| 2026-12-31 | $12,000.00 | $12,000.00 | $0.00 | $0.00 | $0.00 |

At every period end, `allocated price = cumulative R + remaining allocation` and `R - B` equals the negative
contract-liability balance.

## G-004: Discounted fixed-fee milestone bundle

### Inputs and allocation

| Promise | SSP | Revenue policy |
| --- | ---: | --- |
| Implementation | $48,000.00 | Point in time on customer acceptance |
| Twelve months support | $72,000.00 | Elapsed time over 12 months |
| Total SSP | $120,000.00 |  |

Contract consideration is $108,000.00, a $12,000.00 bundle discount allocated proportionately.

| Obligation | Allocation percentage | Allocated price |
| --- | ---: | ---: |
| Implementation | 40% | $43,200.00 |
| Support | 60% | $64,800.00 |

Billing milestones are 50% ($54,000.00) on signing and 50% ($54,000.00) on implementation acceptance.

### Expected events

| Date | Event | Billing | Revenue |
| --- | --- | ---: | ---: |
| 2026-01-01 | Signing milestone issued | $54,000.00 | $0.00 |
| 2026-01-31 | First support month | $0.00 | $5,400.00 |
| 2026-02-15 | Implementation accepted and second milestone issued | $54,000.00 | $43,200.00 |
| 2026-02-28 | Second support month | $0.00 | $5,400.00 |

### Expected journals and balances

| Date | Posting | Debit | Credit |
| --- | --- | --- | --- |
| 2026-01-01 | Signing invoice | AR $54,000.00 | Contract liability $54,000.00 |
| 2026-01-31 | Support revenue | Contract liability $5,400.00 | Services revenue $5,400.00 |
| 2026-02-15 | Acceptance invoice | AR $54,000.00 | Contract liability $54,000.00 |
| 2026-02-15 | Implementation revenue | Contract liability $43,200.00 | Services revenue $43,200.00 |
| 2026-02-28 | Support revenue | Contract liability $5,400.00 | Services revenue $5,400.00 |

At February end, `B = 108,000.00`, `R = 54,000.00`, contract liability is $54,000.00, implementation remaining
allocation is zero, and support remaining allocation is $54,000.00. The signing milestone did not satisfy the
implementation obligation.

## G-005: Progress billing crosses from contract asset to liability

### Inputs

| Field | Value |
| --- | --- |
| Contract | `contract-progress-001`, version 1 |
| Fixed consideration | $100,000.00 |
| Obligation | One integrated service satisfied over time |
| Revenue method | `cost_to_cost` |
| Expected total cost | $80,000.00 |
| Billing method | Certified progress |

### January

- Actual eligible cost: $20,000.00, or 25% revenue progress.
- Cumulative revenue: 25% × $100,000.00 = $25,000.00.
- Certified billing progress: 20%.
- Cumulative billing: $20,000.00.

| Posting | Debit | Credit |
| --- | --- | --- |
| Revenue | Contract asset $25,000.00 | Services revenue $25,000.00 |
| Invoice | AR $20,000.00 | Contract asset $20,000.00 |

January ends with a $5,000.00 contract asset because `R - B = 25,000.00 - 20,000.00`.

### February cumulative result

- Actual eligible cost: $40,000.00 cumulative, or 50% revenue progress.
- Cumulative revenue: $50,000.00; February revenue is $25,000.00.
- Certified billing progress: 60%.
- Cumulative billing: $60,000.00; February invoice is $40,000.00.

| Posting | Debit | Credit |
| --- | --- | --- |
| February revenue | Contract asset $25,000.00 | Services revenue $25,000.00 |
| February invoice | AR $40,000.00 | Contract asset $30,000.00 and contract liability $10,000.00 |

February ends with no contract asset and a $10,000.00 contract liability because `R - B = -10,000.00`. The
posting engine consumes the existing contract asset before creating a liability; it does not present both.

## G-006: Cumulative catch-up contract modification

### Original contract and pre-modification state

| Field | Value |
| --- | --- |
| Contract | `contract-progress-002`, version 1 |
| Consideration | $100,000.00 |
| Expected total cost | $80,000.00 |
| Actual eligible cost | $20,000.00 |
| Progress | 25% |
| Cumulative revenue | $25,000.00 |
| Cumulative billing | $0.00 |
| Contract asset | $25,000.00 |

### Modification

On 2026-02-10, non-distinct scope is added to the integrated obligation. Additional consideration is $10,000.00
and expected total cost increases to $100,000.00. Version 2 therefore has transaction price $110,000.00.

The revised cumulative revenue is:

`$20,000 actual cost ÷ $100,000 expected cost × $110,000 price = $22,000.00`

The cumulative catch-up adjustment is `22,000.00 - 25,000.00 = -3,000.00`.

| Date | Posting | Debit | Credit |
| --- | --- | --- | --- |
| 2026-02-10 | Catch-up reduction | Services revenue $3,000.00 | Contract asset $3,000.00 |

After modification, `R = 22,000.00`, `B = 0.00`, contract asset is $22,000.00, and remaining allocated revenue is
$88,000.00. Version 1 schedules remain immutable; version 2 supersedes only their unrecognized remainder.

## G-007: Void and rebill preserves source lineage

### Inputs

Ten approved T&M hours at $150.00 were billed to the wrong customer invoice grouping on `INV-VOID-001`. The
amount and revenue measurement are correct. The January period remains open.

### Expected allocation lifecycle

| Allocation | Invoice | Status | Amount | Link |
| --- | --- | --- | ---: | --- |
| `alloc-void-001` | `INV-VOID-001` | `released` | $1,500.00 | replaced by `alloc-rebill-001` |
| `alloc-rebill-001` | `INV-REBILL-001` | `active` | $1,500.00 | predecessor `alloc-void-001` |

The source is never simultaneously connected to two active allocations. The void command reverses the original
invoice accounting; the rebill command creates a new invoice and allocation rather than mutating the old records.

| Posting | Debit | Credit |
| --- | --- | --- |
| Original invoice | AR $1,500.00 | Contract liability $1,500.00 |
| Void | Contract liability $1,500.00 | AR $1,500.00 |
| Replacement invoice | AR $1,500.00 | Contract liability $1,500.00 |

Net billing remains $1,500.00. Recognized revenue is unchanged. Replaying void or rebill with the original exact
request is a no-op returning the original command result.

## G-008: Recognition reversal after period close

### Inputs

January recognition run `RUN-JAN-001` posted $1,000.00 and January was subsequently closed. On February 5,
finance determines that the January satisfaction evidence was invalid and approves a reversal dated February 5.

### Expected behavior

- GLAPI rejects a reversal dated in January while the period is closed.
- `RUN-JAN-001` and its journal remain immutable and posted.
- Reversal run `RUN-FEB-REV-001` links to the original run and schedule row.
- The reversal posts in February and records the approving actor separately from the worker actor.

| Date | Posting | Debit | Credit |
| --- | --- | --- | --- |
| 2026-01-31 | Original recognition | Contract liability $1,000.00 | Services revenue $1,000.00 |
| 2026-02-05 | Linked reversal | Services revenue $1,000.00 | Contract liability $1,000.00 |

After reversal, cumulative net revenue for the contract is $0.00 and the contract liability is restored by
$1,000.00. The original schedule row is marked reversed through lineage, not deleted. A replacement recognition
requires new approved evidence and a new run identity.

## Cross-scenario executable assertions

Every implementation test derived from these fixtures must assert:

1. `sum(obligation allocations) = approved transaction price`.
2. `sum(debits) = sum(credits)` for every journal and currency.
3. `contract asset - contract liability = R - B` at each reporting date.
4. `R + remaining allocated revenue = allocated transaction price`, adjusted for approved modifications.
5. `open AR = issued invoices - cash - credits - voids - write-offs`.
6. No source has more than one active invoice-source allocation.
7. No revenue schedule row has more than one active recognition event.
8. Exact idempotent replay returns the original resource IDs and creates no new financial records.
9. Reuse of an idempotency key with a different request hash returns a conflict.
10. Voids, credits, modifications, supersessions, and reversals retain predecessor/successor lineage.
11. Closed periods reject backdated financial mutations.
12. A principal from another organization cannot read or mutate any fixture record, even with a known UUID.

## Initial conformance mapping

| Scenario | Primary future test layer |
| --- | --- |
| G-001 | Billing service, right-to-invoice revenue, end-to-end |
| G-002 | Contract-asset posting and delayed billing |
| G-003 | Revenue schedule and contract-liability rollforward |
| G-004 | SSP allocation, milestone billing, point-in-time acceptance |
| G-005 | Progress certification and contract-position crossing |
| G-006 | Modification engine and cumulative catch-up |
| G-007 | Allocation concurrency, void, rebill, and lineage |
| G-008 | Accounting periods, recognition runs, and reversals |

The database and service tasks must translate these stable IDs and values into typed fixtures rather than inventing
new expected amounts independently.
