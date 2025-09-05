# TASK-008: REST API Endpoint Implementation

## Description
Create REST API endpoints that expose tRPC routers as traditional HTTP endpoints for external integrations. Implement proper OpenAPI documentation and follow RESTful conventions.

## Acceptance Criteria
- [ ] REST endpoints for all subscription operations
- [ ] REST endpoints for invoice and payment operations
- [ ] REST endpoints for revenue recognition
- [ ] Proper HTTP status codes and error responses
- [ ] Request/response validation middleware
- [ ] OpenAPI 3.0 specification generated
- [ ] API versioning (v1) implemented
- [ ] Authentication middleware integration
- [ ] Rate limiting and request logging
- [ ] Comprehensive API tests

## Dependencies
- TASK-005: Subscription tRPC router
- TASK-006: Invoice/Payment tRPC routers
- TASK-007: Revenue recognition tRPC router

## Estimated Effort
2 days

## Technical Implementation

### REST API Structure
Following the existing pattern from the CLAUDE.md note that tRPC routes are exposed via Next.js reverse proxy (not Express), we'll implement these as Next.js API routes.

```typescript
// apps/web/src/app/api/v1/subscriptions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { trpcClient } from '@/lib/trpc-client';
import { validateApiKey, handleApiError } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    await validateApiKey(request);
    
    const searchParams = request.nextUrl.searchParams;
    const result = await trpcClient.subscriptions.list.query({
      entityId: searchParams.get('entityId') || undefined,
      status: searchParams.get('status') as any,
      page: Number(searchParams.get('page')) || 1,
      limit: Number(searchParams.get('limit')) || 50
    });
    
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await validateApiKey(request);
    
    const body = await request.json();
    const result = await trpcClient.subscriptions.create.mutate(body);
    
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
```

### API Routes Structure
```
apps/web/src/app/api/v1/
├── subscriptions/
│   ├── route.ts                    # GET, POST /api/v1/subscriptions
│   ├── [id]/
│   │   ├── route.ts               # GET, PUT, DELETE /api/v1/subscriptions/{id}
│   │   ├── activate/route.ts      # POST /api/v1/subscriptions/{id}/activate
│   │   ├── cancel/route.ts        # POST /api/v1/subscriptions/{id}/cancel
│   │   ├── calculate-revenue/route.ts  # POST /api/v1/subscriptions/{id}/calculate-revenue
│   │   └── revenue-schedule/route.ts   # GET /api/v1/subscriptions/{id}/revenue-schedule
├── invoices/
│   ├── route.ts                    # GET, POST /api/v1/invoices
│   ├── [id]/
│   │   ├── route.ts               # GET, PUT /api/v1/invoices/{id}
│   │   ├── send/route.ts          # POST /api/v1/invoices/{id}/send
│   │   ├── void/route.ts          # POST /api/v1/invoices/{id}/void
│   │   └── payments/route.ts      # GET /api/v1/invoices/{id}/payments
│   ├── generate/route.ts           # POST /api/v1/invoices/generate
│   └── aging/route.ts             # GET /api/v1/invoices/aging
├── payments/
│   ├── route.ts                    # GET, POST /api/v1/payments
│   ├── [id]/
│   │   ├── route.ts               # GET /api/v1/payments/{id}
│   │   └── refund/route.ts        # POST /api/v1/payments/{id}/refund
└── revenue/
    ├── calculate/route.ts          # POST /api/v1/revenue/calculate
    ├── schedules/route.ts          # GET /api/v1/revenue/schedules
    ├── recognize/route.ts          # POST /api/v1/revenue/recognize
    ├── performance-obligations/route.ts  # GET /api/v1/revenue/performance-obligations
    ├── ssp/route.ts               # GET, POST /api/v1/revenue/ssp
    └── reports/
        ├── summary/route.ts        # GET /api/v1/revenue/reports/summary
        ├── arr/route.ts           # GET /api/v1/revenue/reports/arr
        ├── mrr/route.ts           # GET /api/v1/revenue/reports/mrr
        └── deferred-balance/route.ts  # GET /api/v1/revenue/reports/deferred-balance
```

### API Utility Functions
```typescript
// apps/web/src/lib/api-utils.ts
import { NextRequest, NextResponse } from 'next/server';
import { TRPCError } from '@trpc/server';

export async function validateApiKey(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey) {
    throw new Error('API key required');
  }
  
  // Validate against stored API keys
  // Implementation depends on auth system
}

export function handleApiError(error: unknown) {
  console.error('API Error:', error);
  
  if (error instanceof TRPCError) {
    const statusCode = getHttpStatusFromTRPCCode(error.code);
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: statusCode }
    );
  }
  
  if (error instanceof Error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
  
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}

function getHttpStatusFromTRPCCode(code: string): number {
  switch (code) {
    case 'NOT_FOUND': return 404;
    case 'BAD_REQUEST': return 400;
    case 'UNAUTHORIZED': return 401;
    case 'FORBIDDEN': return 403;
    case 'CONFLICT': return 409;
    case 'INTERNAL_SERVER_ERROR': return 500;
    default: return 500;
  }
}
```

### OpenAPI Documentation
```yaml
# apps/web/public/api-docs/openapi.yaml
openapi: 3.0.0
info:
  title: 606Ledger API
  description: Revenue Recognition API following ASC 606
  version: 1.0.0
  contact:
    name: API Support
    email: api-support@glapi.com

servers:
  - url: https://api.glapi.com/v1
    description: Production server
  - url: https://staging-api.glapi.com/v1
    description: Staging server

security:
  - ApiKeyAuth: []

paths:
  /subscriptions:
    get:
      summary: List subscriptions
      parameters:
        - name: entityId
          in: query
          schema:
            type: string
            format: uuid
          description: Filter by customer ID
        - name: status
          in: query
          schema:
            type: string
            enum: [draft, active, suspended, cancelled]
          description: Filter by subscription status
        - name: page
          in: query
          schema:
            type: integer
            minimum: 1
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 50
      responses:
        '200':
          description: List of subscriptions
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Subscription'
                  pagination:
                    $ref: '#/components/schemas/Pagination'
    
    post:
      summary: Create subscription
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateSubscription'
      responses:
        '201':
          description: Created subscription
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Subscription'

  /subscriptions/{id}/calculate-revenue:
    post:
      summary: Calculate revenue recognition
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                calculationType:
                  type: string
                  enum: [initial, modification, renewal, termination]
                effectiveDate:
                  type: string
                  format: date
              required:
                - calculationType
                - effectiveDate
      responses:
        '200':
          description: Revenue calculation result
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/RevenueCalculation'

components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: x-api-key
  
  schemas:
    Subscription:
      type: object
      properties:
        id:
          type: string
          format: uuid
        organizationId:
          type: string
          format: uuid
        subscriptionNumber:
          type: string
        entityId:
          type: string
          format: uuid
        status:
          type: string
          enum: [draft, active, suspended, cancelled]
        startDate:
          type: string
          format: date
        endDate:
          type: string
          format: date
        contractValue:
          type: number
          format: decimal
        items:
          type: array
          items:
            $ref: '#/components/schemas/SubscriptionItem'
    
    SubscriptionItem:
      type: object
      properties:
        id:
          type: string
          format: uuid
        itemId:
          type: string
          format: uuid
        quantity:
          type: number
        unitPrice:
          type: number
          format: decimal
        discountPercentage:
          type: number
          minimum: 0
          maximum: 1
```

### Test Requirements

#### API Endpoint Tests
```typescript
// apps/web/src/app/api/v1/__tests__/subscriptions.test.ts
describe('Subscriptions API Endpoints', () => {
  describe('GET /api/v1/subscriptions', () => {
    it('should return paginated subscriptions', async () => {
      const response = await request(app)
        .get('/api/v1/subscriptions')
        .set('x-api-key', 'test-key')
        .expect(200);
      
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
    });
    
    it('should require API key', async () => {
      await request(app)
        .get('/api/v1/subscriptions')
        .expect(401);
    });
    
    it('should filter by entityId', async () => {
      const entityId = 'customer-uuid';
      const response = await request(app)
        .get(`/api/v1/subscriptions?entityId=${entityId}`)
        .set('x-api-key', 'test-key')
        .expect(200);
      
      response.body.data.forEach(sub => {
        expect(sub.entityId).toBe(entityId);
      });
    });
  });

  describe('POST /api/v1/subscriptions', () => {
    it('should create subscription with valid data', async () => {
      const subscriptionData = {
        entityId: 'customer-uuid',
        startDate: '2024-01-01',
        items: [{
          itemId: 'item-uuid',
          quantity: 1,
          unitPrice: 1000
        }]
      };
      
      const response = await request(app)
        .post('/api/v1/subscriptions')
        .set('x-api-key', 'test-key')
        .send(subscriptionData)
        .expect(201);
      
      expect(response.body.entityId).toBe(subscriptionData.entityId);
    });
    
    it('should validate required fields', async () => {
      await request(app)
        .post('/api/v1/subscriptions')
        .set('x-api-key', 'test-key')
        .send({})
        .expect(400);
    });
  });
});
```

#### Integration Tests
```typescript
describe('API Integration Tests', () => {
  it('should handle complete subscription to revenue flow', async () => {
    // 1. Create subscription via API
    // 2. Calculate revenue via API
    // 3. Generate invoice via API
    // 4. Record payment via API
    // 5. Verify revenue recognition via API
  });
});
```

### Files to Create
- Next.js API route files (as listed above)
- `apps/web/src/lib/api-utils.ts`
- `apps/web/src/lib/trpc-client.ts` (if not exists)
- `apps/web/public/api-docs/openapi.yaml`
- `apps/web/src/app/api/v1/__tests__/` (test files)
- API documentation components

### Definition of Done
- [ ] All REST endpoints implemented and tested
- [ ] OpenAPI documentation complete and accurate
- [ ] Error handling returns appropriate HTTP status codes
- [ ] API key authentication working
- [ ] Rate limiting implemented
- [ ] Integration tests verify end-to-end functionality
- [ ] Performance acceptable under load
- [ ] Documentation deployed and accessible