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

## Key metrics

1. Pipeline amount: sum(`total_amount`)
2. Weighted pipeline: sum(`total_amount * probability / 100`)
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

## Complexity and Estimate

- Complexity: Medium
- Estimate: 1-2 weeks

