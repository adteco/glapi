# Revenue Recognition API Documentation

## Overview

The Revenue Recognition API implements ASC 606 compliance for subscription-based revenue management. It provides endpoints for calculating revenue, managing performance obligations, handling SSP (Standalone Selling Price) evidence, and generating revenue reports.

## Base URL

```
https://api.example.com/api
```

## Authentication

All endpoints require authentication via Clerk. Include the session token in the request headers.

## Endpoints

### Revenue Calculation & Recognition

#### Calculate Revenue

**POST** `/revenue`

Calculate revenue for a subscription following ASC 606 5-step process.

```json
{
  "action": "calculate",
  "subscriptionId": "uuid",
  "calculationType": "initial | modification | renewal | termination",
  "effectiveDate": "2024-01-01",
  "options": {
    "forceRecalculation": false,
    "includeHistorical": false
  }
}
```

**Response:**
```json
{
  "subscriptionId": "uuid",
  "performanceObligations": [{
    "itemId": "uuid",
    "obligationType": "product_license",
    "allocatedAmount": 10000,
    "satisfactionMethod": "over_time",
    "satisfactionPeriodMonths": 12
  }],
  "totalContractValue": 50000,
  "recognitionPattern": "straight_line",
  "schedules": [{
    "periodStart": "2024-01-01",
    "periodEnd": "2024-01-31",
    "amount": 4166.67
  }]
}
```

#### Recognize Revenue

**POST** `/revenue`

Process revenue recognition for a period.

```json
{
  "action": "recognize",
  "periodDate": "2024-01-31",
  "scheduleIds": ["uuid1", "uuid2"],
  "dryRun": false
}
```

### Revenue Schedules

#### List Revenue Schedules

**GET** `/revenue-schedules`

Query Parameters:
- `subscriptionId` - Filter by subscription
- `performanceObligationId` - Filter by performance obligation
- `status` - Filter by status (scheduled, recognized, deferred, cancelled)
- `periodStart` - Start date filter
- `periodEnd` - End date filter
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50)

#### Get Revenue Schedule

**GET** `/revenue-schedules?id={id}`

#### Update Revenue Schedule

**PUT** `/revenue-schedules?id={id}`

```json
{
  "scheduledAmount": "5000.00",
  "recognitionDate": "2024-01-31",
  "status": "recognized"
}
```

### Performance Obligations

#### List Performance Obligations

**GET** `/performance-obligations`

Query Parameters:
- `subscriptionId` - Filter by subscription
- `status` - Filter by status (active, satisfied, cancelled)
- `obligationType` - Filter by type
- `page` - Page number
- `limit` - Items per page

#### Get Performance Obligation

**GET** `/performance-obligations?id={id}`

#### Satisfy Performance Obligation

**POST** `/performance-obligations`

```json
{
  "id": "uuid",
  "satisfactionDate": "2024-01-31",
  "satisfactionEvidence": "Delivery confirmation #12345"
}
```

### SSP (Standalone Selling Price)

#### List SSP Evidence

**GET** `/ssp`

Query Parameters:
- `itemId` - Filter by item
- `evidenceType` - Filter by type (standalone_sale, competitor_pricing, cost_plus_margin, market_assessment)
- `isActive` - Filter by active status
- `page` - Page number
- `limit` - Items per page

#### Create SSP Evidence

**POST** `/ssp`

```json
{
  "itemId": "uuid",
  "evidenceType": "standalone_sale",
  "evidenceDate": "2024-01-01",
  "sspAmount": 10000,
  "currency": "USD",
  "evidenceSource": "Contract #ABC123",
  "confidenceLevel": "high"
}
```

#### Get Current SSP

**GET** `/ssp?type=current&itemId={itemId}`

Returns the current best SSP for an item based on evidence hierarchy.

#### Get SSP Range

**GET** `/ssp?type=range&itemId={itemId}`

Returns statistical SSP range with confidence levels.

#### Get SSP Summary

**GET** `/ssp?type=summary&itemIds={id1},{id2}`

Returns SSP summary statistics for multiple items.

#### Update SSP Evidence

**PUT** `/ssp?id={id}`

```json
{
  "evidenceDate": "2024-01-01",
  "sspAmount": "11000.00",
  "confidenceLevel": "medium",
  "isActive": true
}
```

#### Deactivate SSP Evidence

**DELETE** `/ssp?id={id}`

### Revenue Reports

#### Revenue Summary

**GET** `/revenue?type=summary&startDate={date}&endDate={date}&groupBy={period}`

Parameters:
- `startDate` - Report start date
- `endDate` - Report end date
- `groupBy` - Grouping period (month, quarter, year)

#### ARR (Annual Recurring Revenue)

**GET** `/revenue?type=arr&asOfDate={date}`

#### MRR (Monthly Recurring Revenue)

**GET** `/revenue?type=mrr&forMonth={date}`

#### Deferred Revenue Balance

**GET** `/revenue?type=deferred&asOfDate={date}`

## Data Models

### Performance Obligation Types
- `product_license` - Software licenses
- `maintenance_support` - Support and maintenance
- `professional_services` - Implementation, training
- `hosting_services` - Cloud hosting
- `other` - Other services

### Satisfaction Methods
- `point_in_time` - Recognized at delivery
- `over_time` - Recognized over contract period

### SSP Evidence Types
- `standalone_sale` - Actual standalone sales (highest priority)
- `competitor_pricing` - Competitor price data
- `cost_plus_margin` - Cost plus margin approach
- `market_assessment` - Market analysis (lowest priority)

### Confidence Levels
- `high` - High confidence in SSP accuracy
- `medium` - Moderate confidence
- `low` - Low confidence, requires review

## Error Responses

All endpoints return standard error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

Common error codes:
- `401` - Unauthorized
- `404` - Resource not found
- `400` - Bad request/Invalid parameters
- `500` - Internal server error

## Rate Limits

- 100 requests per minute per organization
- 1000 requests per hour per organization

## Webhooks

Revenue recognition events can trigger webhooks:
- `revenue.calculated` - Revenue calculation completed
- `revenue.recognized` - Revenue recognition processed
- `obligation.satisfied` - Performance obligation satisfied
- `ssp.updated` - SSP evidence changed

## Best Practices

1. **SSP Management**: Maintain current SSP evidence for all items to ensure accurate revenue allocation
2. **Performance Obligations**: Clearly define obligations at contract inception
3. **Recognition Timing**: Run recognition process at period end for consistency
4. **Audit Trail**: All changes are logged for compliance
5. **Dry Run**: Use dry run mode to preview recognition before processing