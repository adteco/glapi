# ASC 606 Revenue API

This API exposes an end-to-end ASC 606 flow:

1. Post a sales order.
2. Generate a revenue plan (obligations, schedules, waterfall).
3. Preview and apply software license changes (add/remove seats).
4. Recalculate revenue schedules and retrieve updated outputs.

Base path: `/api/revenue/asc606`

Required auth/context headers (same as other API routes):

- `x-organization-id`
- `x-user-id`

## 1) Create Sales Order + Generate Plan

`POST /api/revenue/asc606/sales-orders`

### Request

```json
{
  "order": {
    "subsidiaryId": "11111111-1111-1111-1111-111111111111",
    "entityId": "22222222-2222-2222-2222-222222222222",
    "orderDate": "2025-01-01",
    "currencyCode": "USD",
    "lines": [
      {
        "itemId": "33333333-3333-3333-3333-333333333333",
        "description": "SaaS License Seats",
        "quantity": 50,
        "unitPrice": 120,
        "revenueBehavior": "over_time",
        "sspAmount": 130,
        "listPrice": 120,
        "metadata": {
          "serviceStartDate": "2025-01-01",
          "serviceEndDate": "2025-12-31",
          "revenueBehavior": "over_time",
          "sspAmount": 130,
          "listPrice": 120
        }
      },
      {
        "itemId": "44444444-4444-4444-4444-444444444444",
        "description": "Implementation Services",
        "quantity": 1,
        "unitPrice": 18000
      }
    ]
  },
  "revenuePlan": {
    "billingFrequency": "monthly",
    "termMonths": 12,
    "autoActivateSubscription": true,
    "recognitionEffectiveDate": "2025-01-01"
  }
}
```

### Response

Returns:

- `order`
- `subscription`
- `calculation` (obligation allocation + generated schedule rows)
- `plan` with:
  - `summary` (`totalScheduled`, `totalRecognized`, `totalDeferred`)
  - `obligations`
  - `schedules`
  - `waterfall` (period, scheduled, recognized, deferredBalance)

Notes:

- Item defaults should be configured on the product record: `listPrice`, `defaultSspAmount`, `revenueBehavior`.
- Contract lines can override those defaults with `revenueBehavior`, `sspAmount`, and `listPrice`.

## 2) Generate Plan for Existing Sales Order

`POST /api/revenue/asc606/sales-orders/{salesOrderId}/plan`

Use this to regenerate or initialize ASC606 outputs for an existing order.

### Request

```json
{
  "revenuePlan": {
    "billingFrequency": "annual",
    "termMonths": 24
  }
}
```

## 3) Get Subscription Plan (Waterfall + Revenue Schedule)

`GET /api/revenue/asc606/subscriptions/{subscriptionId}/plan`

Optional query params:

- `startDate` (ISO date)
- `endDate` (ISO date)

### Example

```bash
curl -X GET \
  "http://localhost:3031/api/revenue/asc606/subscriptions/<subscriptionId>/plan?startDate=2025-01-01&endDate=2025-12-31" \
  -H "x-organization-id: <org-id>" \
  -H "x-user-id: <user-id>"
```

## 4) Software Company License What-If (Preview)

`POST /api/revenue/asc606/subscriptions/{subscriptionId}/license-changes/preview`

Use this before committing an amendment.

### Add seats request

```json
{
  "itemId": "33333333-3333-3333-3333-333333333333",
  "action": "add",
  "quantity": 10,
  "unitPrice": 120,
  "effectiveDate": "2025-04-01",
  "reason": "Upsell 10 seats"
}
```

### Remove seats request

```json
{
  "itemId": "33333333-3333-3333-3333-333333333333",
  "action": "remove",
  "quantity": 5,
  "effectiveDate": "2025-07-01",
  "reason": "Seat reduction"
}
```

### Response

Returns:

- `baseline`
- `scenario`
- `delta.transactionPrice`

## 5) Apply License Change + Recalculate

`POST /api/revenue/asc606/subscriptions/{subscriptionId}/license-changes/apply`

Same request shape as preview. This persists amendment and recalculates revenue.

### Response

Returns:

- `subscription` (amended version)
- `calculation` (re-run ASC 606 result)
- `plan` (updated obligations/schedules/waterfall)

## Suggested UI Flow

For a software company seat-based model:

1. Call create sales order endpoint to initialize the arrangement and ASC606 schedule.
2. Render `plan.waterfall` + `plan.schedules` in the UI.
3. On seat-change scenario, call `preview` endpoint for what-if impact.
4. On user confirm, call `apply` endpoint.
5. Refresh plan endpoint and re-render waterfall/schedule.

## Demo Seeding (Software Scenarios)

For sales demos and sandbox environments, you can seed typical software-company scenarios (prepaid annual, monthly billing, discount with SSP allocation, upsell, downsell, cancellation).

`POST /api/revenue/asc606/demo/seed`

Optional body:

```json
{ "forceRecalculate": false }
```

`GET /api/revenue/asc606/demo/scenarios`

Returns a list of seeded demo subscriptions for quick selection in the UI.
