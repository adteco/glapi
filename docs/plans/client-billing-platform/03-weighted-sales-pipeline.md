# Phase 4: Weighted Sales Pipeline

## Objective

Provide a real sales pipeline that supports:

1. Opportunity tracking with expected close dates
2. Probability-based weighting for forecast views
3. Estimate conversion tracking
4. Priority sorting for high-impact opportunities

## Current State

- Opportunities UI exists but is currently mock-backed:
  - `apps/web/src/app/transactions/sales/opportunities/page.tsx`
- Estimates backend already supports sales stage and probability fields:
  - `packages/trpc/src/routers/estimates.ts`
  - `packages/database/src/db/schema/transaction-types.ts`

## Design

## Data representation

Use `business_transactions` with transaction type `OPPORTUNITY` and existing opportunity fields:

- `sales_stage`
- `probability`
- `expected_close_date`
- `lead_source`
- `competitor`

This avoids adding a parallel opportunity table.

## Opportunity Lifecycle and Validation Rules

## Stage model

1. `LEAD`
2. `QUALIFIED`
3. `PROPOSAL`
4. `NEGOTIATION`
5. `CLOSED_WON`
6. `CLOSED_LOST`

## Validation

1. `expected_close_date` required for `PROPOSAL` and later stages
2. `probability` must be bounded `0..100`
3. Closed stages require close reason metadata
4. Stage transitions must be audit logged with actor and timestamp

## Forecast Integrity Controls

1. Weighted metrics exclude closed-lost items
2. Closed-won items move from pipeline metrics to realized conversion metrics
3. Snapshotted daily forecast values support trend and variance reporting

## Key metrics

1. Pipeline amount: sum(`total_amount`) grouped by `currency`
2. Weighted pipeline: sum(`total_amount * probability / 100`) grouped by `currency`
3. Stage velocity and aging
4. Forecast by close-date bucket (this month, next month, quarter)
5. Win/loss rates by source and rep

## API

Add `opportunities` router:

1. `opportunities.list`
2. `opportunities.create`
3. `opportunities.updateStage`
4. `opportunities.convertToEstimate`
5. `opportunities.analytics`

## UI

1. Replace mock list with TRPC-backed table
2. Add weighted amount column and close-date heat indicators
3. Add funnel view (stage totals, weighted totals)
4. Add conversion actions:
   - opportunity -> estimate
   - estimate -> customer/order

## Acceptance Criteria

1. Opportunities persist and load from backend
2. Weighted pipeline totals are visible on opportunity page and dashboard
3. Users can filter by stage, close date, probability, and source
4. Conversion to estimate is functional and tracked
5. Stage transition rules enforce required data and audit trail
6. Forecast metrics reconcile to opportunity snapshot data

## Complexity and Estimate

- Complexity: Medium
- Estimate: 1-2 weeks
