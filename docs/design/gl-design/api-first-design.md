# API-First Design for GL System

## Overview

This document outlines the API-first approach for the GL system, ensuring that all functionality is designed from the API perspective first, with the database and UI as implementation details.

## API-First Principles

1. **API Contract First**: Define OpenAPI specs before implementation
2. **Consumer-Driven**: Design based on client needs, not database structure
3. **Resource-Oriented**: RESTful resources that map to business concepts
4. **Event-Driven**: Real-time updates via webhooks/SSE
5. **Versioned**: Clear API versioning strategy

## Core API Resources

### 1. Transaction Resources

```yaml
# /api/v1/transactions
/transactions:
  post:
    summary: Create a new business transaction
    requestBody:
      content:
        application/json:
          schema:
            oneOf:
              - $ref: '#/components/schemas/SalesOrder'
              - $ref: '#/components/schemas/CustomerInvoice'
              - $ref: '#/components/schemas/PurchaseOrder'
              - $ref: '#/components/schemas/VendorBill'
    responses:
      201:
        description: Transaction created
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TransactionResponse'

/transactions/{id}:
  get:
    summary: Get transaction details
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: string
      - name: expand
        in: query
        schema:
          type: array
          items:
            type: string
            enum: [lines, gl_entries, relationships, audit_trail]
    responses:
      200:
        description: Transaction details
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TransactionResponse'

/transactions/{id}/actions:
  get:
    summary: Get available actions for a transaction
    responses:
      200:
        description: Available actions based on current state
        content:
          application/json:
            schema:
              type: object
              properties:
                actions:
                  type: array
                  items:
                    type: object
                    properties:
                      action:
                        type: string
                        enum: [approve, reject, post, void, reverse]
                      available:
                        type: boolean
                      reason:
                        type: string

/transactions/{id}/actions/{action}:
  post:
    summary: Perform an action on a transaction
    parameters:
      - name: action
        in: path
        required: true
        schema:
          type: string
          enum: [approve, reject, post, void, reverse]
    requestBody:
      content:
        application/json:
          schema:
            type: object
            properties:
              reason:
                type: string
              effective_date:
                type: string
                format: date
    responses:
      200:
        description: Action performed successfully
```

### 2. GL Entry Resources

```yaml
/gl-entries:
  get:
    summary: Query GL entries
    parameters:
      - name: date_from
        in: query
        schema:
          type: string
          format: date
      - name: date_to
        in: query
        schema:
          type: string
          format: date
      - name: account_ids
        in: query
        schema:
          type: array
          items:
            type: integer
      - name: dimensions
        in: query
        schema:
          type: object
          properties:
            subsidiary_id:
              type: integer
            department_id:
              type: integer
            location_id:
              type: integer
            class_id:
              type: integer
    responses:
      200:
        description: GL entries matching criteria
        content:
          application/json:
            schema:
              type: object
              properties:
                entries:
                  type: array
                  items:
                    $ref: '#/components/schemas/GLEntry'
                pagination:
                  $ref: '#/components/schemas/Pagination'

/gl-entries/balance:
  get:
    summary: Get account balances
    parameters:
      - name: as_of_date
        in: query
        schema:
          type: string
          format: date
      - name: account_ids
        in: query
        schema:
          type: array
          items:
            type: integer
      - name: group_by
        in: query
        schema:
          type: array
          items:
            type: string
            enum: [account, subsidiary, department, location, class]
    responses:
      200:
        description: Account balances
        content:
          application/json:
            schema:
              type: object
              properties:
                balances:
                  type: array
                  items:
                    $ref: '#/components/schemas/AccountBalance'
                as_of_date:
                  type: string
                  format: date
```

### 3. Reporting Resources

```yaml
/reports/financial-statements:
  post:
    summary: Generate financial statements
    requestBody:
      content:
        application/json:
          schema:
            type: object
            properties:
              statement_type:
                type: string
                enum: [balance_sheet, income_statement, cash_flow]
              period:
                type: object
                properties:
                  start_date:
                    type: string
                    format: date
                  end_date:
                    type: string
                    format: date
              comparison_periods:
                type: array
                items:
                  type: object
                  properties:
                    start_date:
                      type: string
                      format: date
                    end_date:
                      type: string
                      format: date
              dimensions:
                type: object
              format:
                type: string
                enum: [json, pdf, excel]
    responses:
      200:
        description: Generated financial statement
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/FinancialStatement'
          application/pdf:
            schema:
              type: string
              format: binary

/reports/trial-balance:
  get:
    summary: Generate trial balance
    parameters:
      - name: as_of_date
        in: query
        required: true
        schema:
          type: string
          format: date
      - name: level_of_detail
        in: query
        schema:
          type: string
          enum: [summary, detail, by_dimension]
    responses:
      200:
        description: Trial balance report
```

### 4. Configuration Resources

```yaml
/configuration/posting-rules:
  get:
    summary: Get GL posting rules
    parameters:
      - name: transaction_type
        in: query
        schema:
          type: string
      - name: active_only
        in: query
        schema:
          type: boolean
    responses:
      200:
        description: Posting rules
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: '#/components/schemas/PostingRule'

  post:
    summary: Create a new posting rule
    requestBody:
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/PostingRule'
    responses:
      201:
        description: Posting rule created

/configuration/accounting-periods:
  get:
    summary: Get accounting periods
    responses:
      200:
        description: List of accounting periods
        
  post:
    summary: Create a new accounting period
    requestBody:
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/AccountingPeriod'
```

### 5. Event Streaming Resources

```yaml
/events/subscribe:
  post:
    summary: Subscribe to real-time events
    requestBody:
      content:
        application/json:
          schema:
            type: object
            properties:
              event_types:
                type: array
                items:
                  type: string
                  enum: 
                    - transaction.created
                    - transaction.approved
                    - transaction.posted
                    - gl_entry.created
                    - balance.updated
                    - period.closed
              filters:
                type: object
                properties:
                  subsidiary_ids:
                    type: array
                    items:
                      type: integer
                  transaction_types:
                    type: array
                    items:
                      type: string
    responses:
      200:
        description: Subscription created
        content:
          application/json:
            schema:
              type: object
              properties:
                subscription_id:
                  type: string
                webhook_url:
                  type: string
                sse_url:
                  type: string

/events/webhooks:
  post:
    summary: Register a webhook endpoint
    requestBody:
      content:
        application/json:
          schema:
            type: object
            properties:
              url:
                type: string
              events:
                type: array
                items:
                  type: string
              secret:
                type: string
    responses:
      201:
        description: Webhook registered
```

## API Design Patterns

### 1. Resource Expansion

Allow clients to request related data in a single call:

```json
GET /api/v1/transactions/12345?expand=lines,gl_entries,relationships

{
  "id": "12345",
  "type": "customer_invoice",
  "number": "INV-2025-001",
  "lines": [...],
  "gl_entries": [...],
  "relationships": [...]
}
```

### 2. Bulk Operations

Support efficient bulk operations:

```json
POST /api/v1/transactions/bulk

{
  "operations": [
    {
      "method": "POST",
      "resource": "/transactions",
      "body": { ... }
    },
    {
      "method": "PATCH",
      "resource": "/transactions/123",
      "body": { ... }
    }
  ]
}
```

### 3. Async Operations

Long-running operations return immediately:

```json
POST /api/v1/reports/financial-statements

Response:
{
  "job_id": "abc123",
  "status": "processing",
  "progress_url": "/api/v1/jobs/abc123"
}
```

### 4. Field Selection

Allow clients to request specific fields:

```
GET /api/v1/transactions?fields=id,number,date,total_amount
```

### 5. Hypermedia Links

Include actionable links in responses:

```json
{
  "id": "12345",
  "status": "draft",
  "_links": {
    "self": "/api/v1/transactions/12345",
    "approve": "/api/v1/transactions/12345/actions/approve",
    "lines": "/api/v1/transactions/12345/lines",
    "gl_entries": "/api/v1/transactions/12345/gl-entries"
  }
}
```

## Error Handling

### Standard Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid data",
    "details": [
      {
        "field": "lines[0].account_id",
        "code": "REQUIRED",
        "message": "Account ID is required"
      }
    ],
    "request_id": "req_abc123",
    "documentation_url": "/docs/errors/VALIDATION_ERROR"
  }
}
```

### Error Codes

- 400: Bad Request (validation errors)
- 401: Unauthorized
- 403: Forbidden (RLS violation)
- 404: Not Found
- 409: Conflict (business rule violation)
- 422: Unprocessable Entity
- 429: Too Many Requests
- 500: Internal Server Error

## Versioning Strategy

### URL Versioning

```
/api/v1/transactions
/api/v2/transactions
```

### Version Lifecycle

1. **Active**: Current version, all features supported
2. **Deprecated**: Still functional but not recommended
3. **Sunset**: Read-only access only
4. **Retired**: No longer available

### Breaking Changes

- New required fields
- Removed fields
- Changed field types
- Modified business logic

### Non-Breaking Changes

- New optional fields
- New endpoints
- New query parameters
- Additional enum values

## Authentication & Authorization

### OAuth 2.0 / JWT

```http
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

### API Keys

```http
X-API-Key: glapi_live_sk_1234567890
```

### Scopes

- `transactions:read`
- `transactions:write`
- `transactions:approve`
- `gl:read`
- `gl:write`
- `reports:generate`
- `configuration:manage`

## Rate Limiting

### Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

### Tiers

- **Basic**: 1,000 requests/hour
- **Standard**: 10,000 requests/hour
- **Premium**: 100,000 requests/hour
- **Enterprise**: Unlimited

## SDK Generation

### OpenAPI-Based

Generate SDKs automatically from OpenAPI spec:

```typescript
// TypeScript SDK
import { GLAPIClient } from '@glapi/sdk';

const client = new GLAPIClient({
  apiKey: 'glapi_live_sk_...',
  version: 'v1'
});

// Create a transaction
const invoice = await client.transactions.create({
  type: 'customer_invoice',
  customer_id: 123,
  lines: [...]
});

// Post to GL
await client.transactions.actions.post(invoice.id, {
  effective_date: '2025-01-15'
});
```

### Language Support

- TypeScript/JavaScript
- Python
- Go
- Java
- C#
- Ruby

## Testing Strategy

### Contract Testing

Use Pact or similar for consumer-driven contracts

### Mock Server

Provide mock server based on OpenAPI spec

### Sandbox Environment

Full-featured testing environment with sample data

## Documentation

### Interactive API Explorer

- Swagger UI or similar
- Live testing capability
- Code examples

### Getting Started Guides

- Quick start
- Authentication
- Common use cases
- Best practices

### API Reference

- Auto-generated from OpenAPI
- Request/response examples
- Error scenarios
- Rate limits

## Monitoring & Analytics

### Metrics

- Request volume by endpoint
- Response times
- Error rates
- Usage by customer

### Logging

- Structured logging (JSON)
- Request/response bodies (with PII masking)
- Correlation IDs
- User attribution

### Alerts

- High error rates
- Slow response times
- Rate limit violations
- Unusual access patterns

## Implementation Priorities

### Phase 1: Core API Design
1. OpenAPI specification for all resources
2. API design review and approval
3. Mock server implementation

### Phase 2: Essential Endpoints
1. Transaction CRUD operations
2. GL entry queries
3. Basic reporting

### Phase 3: Advanced Features
1. Bulk operations
2. Event streaming
3. Async processing

### Phase 4: Developer Experience
1. SDK generation
2. Interactive documentation
3. Sandbox environment

### Phase 5: Operations
1. Monitoring and analytics
2. Rate limiting
3. Performance optimization