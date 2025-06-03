# API Documentation Guide

This guide ensures that every API endpoint is properly documented, tested, and accessible to users.

## 📋 API Documentation Checklist

For **EVERY** API endpoint, you MUST:

### 1. Update OpenAPI Specification
Location: `/docs/api-specs/[entity].openapi.yaml`

```yaml
paths:
  /api/v1/customers/{id}:
    get:
      summary: Get customer by ID
      description: Retrieve a single customer by their unique identifier
      tags:
        - Customers
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Customer found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Customer'
        '404':
          description: Customer not found
        '401':
          description: Unauthorized
```

### 2. Create/Update User Documentation
Location: `/apps/docs/src/app/api/[endpoint]/page.mdx`

Required sections:
- Overview
- Authentication
- Request format
- Response format
- Error codes
- Examples (curl, JavaScript, Python)
- Rate limiting
- Pagination (if applicable)

### 3. Create Test Script
Location: `/apps/api/test-[feature].sh` or `.http` file

```bash
#!/bin/bash
# test-customers.sh

API_URL="http://localhost:3001"
TOKEN="your-test-token"

# Test: Get all customers
echo "Testing GET /api/v1/customers..."
curl -X GET "$API_URL/api/v1/customers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

## 📁 File Structure for API Documentation

```
/glapi
├── docs/
│   └── api-specs/
│       ├── customers.openapi.yaml      # OpenAPI spec
│       ├── vendors.openapi.yaml
│       └── ...
├── apps/
│   ├── api/
│   │   ├── test-customers.sh          # Test scripts
│   │   └── test-vendors.sh
│   └── docs/
│       └── src/app/api/
│           ├── customers/
│           │   └── page.mdx            # User-facing docs
│           ├── vendors/
│           │   └── page.mdx
│           └── ...
```

## 📝 User Documentation Template

Create this for every endpoint at `/apps/docs/src/app/api/[endpoint]/page.mdx`:

```mdx
# [Entity] API

## Overview

Brief description of what this API does and its purpose.

## Base URL

```
https://api.glapi.com/api/v1
```

## Authentication

All requests require a Bearer token in the Authorization header:

```
Authorization: Bearer YOUR_API_TOKEN
```

## Endpoints

### List [Entities]

```
GET /api/v1/[entities]
```

Retrieve a paginated list of [entities].

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | integer | 1 | Page number |
| limit | integer | 20 | Items per page (max 100) |
| orderBy | string | name | Sort field |
| orderDirection | string | asc | Sort direction (asc/desc) |

#### Example Request

```bash
curl -X GET "https://api.glapi.com/api/v1/customers?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

#### Example Response

```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "companyName": "Acme Corp",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "pages": 10
  }
}
```

### Get [Entity] by ID

```
GET /api/v1/[entities]/{id}
```

[Continue with all CRUD operations...]

## Error Responses

### 400 Bad Request

```json
{
  "error": "Invalid request",
  "message": "The request body is invalid",
  "details": [
    {
      "field": "companyName",
      "message": "Company name is required"
    }
  ]
}
```

### 401 Unauthorized

```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing authentication token"
}
```

### 404 Not Found

```json
{
  "error": "Not found",
  "message": "Customer with ID 123 not found"
}
```

## Rate Limiting

API requests are limited to:
- 100 requests per minute for authenticated users
- 10 requests per minute for unauthenticated users

Rate limit headers:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## Code Examples

### JavaScript/TypeScript

```typescript
const response = await fetch('https://api.glapi.com/api/v1/customers', {
  headers: {
    'Authorization': 'Bearer YOUR_API_TOKEN',
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
```

### Python

```python
import requests

headers = {
    'Authorization': 'Bearer YOUR_API_TOKEN',
    'Content-Type': 'application/json'
}

response = requests.get('https://api.glapi.com/api/v1/customers', headers=headers)
data = response.json()
```

## Webhooks

[If applicable, document webhook events]

## Changelog

See [CHANGELOG.md](/changelog) for recent changes to this endpoint.
```

## 🧪 Testing Requirements

### 1. Manual Testing Script
Every endpoint needs a test script:

```bash
#!/bin/bash
# test-api-endpoint.sh

# Configuration
API_URL="${API_URL:-http://localhost:3001}"
TOKEN="${TOKEN:-test-token}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "Testing Customer API..."

# Test 1: List customers
echo -n "GET /api/v1/customers... "
RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/api/v1/customers" \
  -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Success${NC}"
else
    echo -e "${RED}✗ Failed (HTTP $HTTP_CODE)${NC}"
    echo "$BODY"
fi

# Test 2: Create customer
echo -n "POST /api/v1/customers... "
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/v1/customers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Test Company",
    "contactEmail": "test@example.com",
    "status": "active"
  }')
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "201" ]; then
    echo -e "${GREEN}✓ Success${NC}"
    CUSTOMER_ID=$(echo "$BODY" | jq -r '.id')
else
    echo -e "${RED}✗ Failed (HTTP $HTTP_CODE)${NC}"
    echo "$BODY"
fi

# Continue with UPDATE, DELETE tests...
```

### 2. HTTP Test Files
Alternative: Use `.http` files for VS Code REST Client:

```http
### Get all customers
GET {{baseUrl}}/api/v1/customers
Authorization: Bearer {{token}}

### Create customer
POST {{baseUrl}}/api/v1/customers
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "companyName": "Test Company",
  "contactEmail": "test@example.com",
  "status": "active"
}

### Update customer
PUT {{baseUrl}}/api/v1/customers/{{customerId}}
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "companyName": "Updated Company Name"
}

### Delete customer
DELETE {{baseUrl}}/api/v1/customers/{{customerId}}
Authorization: Bearer {{token}}
```

## 🚀 Automation Scripts

### Generate OpenAPI from Routes
```bash
#!/bin/bash
# scripts/generate-openapi.sh
# TODO: Implement OpenAPI generation from route definitions
```

### Validate Documentation Completeness
```bash
#!/bin/bash
# scripts/check-api-docs.sh

echo "Checking API documentation completeness..."

# Find all route files
ROUTES=$(find apps/api/src/routes -name "*.ts" -not -name "*.test.ts")

MISSING_DOCS=0

for ROUTE in $ROUTES; do
    ROUTE_NAME=$(basename "$ROUTE" .ts)
    ENTITY=${ROUTE_NAME%Routes}
    
    # Check OpenAPI spec exists
    if [ ! -f "docs/api-specs/${ENTITY}.openapi.yaml" ]; then
        echo "❌ Missing OpenAPI spec for $ENTITY"
        MISSING_DOCS=1
    fi
    
    # Check user docs exist
    if [ ! -f "apps/docs/src/app/api/${ENTITY}/page.mdx" ]; then
        echo "❌ Missing user docs for $ENTITY"
        MISSING_DOCS=1
    fi
    
    # Check test script exists
    if [ ! -f "apps/api/test-${ENTITY}.sh" ] && [ ! -f "apps/api/test-${ENTITY}.http" ]; then
        echo "⚠️  Missing test script for $ENTITY"
    fi
done

if [ $MISSING_DOCS -eq 0 ]; then
    echo "✅ All API documentation is complete!"
else
    echo "❌ Some API documentation is missing!"
    exit 1
fi
```

## 📊 Documentation Standards

### Response Format Standards
All API responses should follow this format:

#### Success Response
```json
{
  "data": { ... } or [ ... ],
  "pagination": { // if applicable
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  },
  "meta": { // optional
    "version": "1.0",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

#### Error Response
```json
{
  "error": "SHORT_ERROR_CODE",
  "message": "Human readable error message",
  "details": [ // optional
    {
      "field": "fieldName",
      "message": "Field-specific error"
    }
  ],
  "requestId": "uuid" // for debugging
}
```

### Status Code Standards
- 200: Success (GET, PUT)
- 201: Created (POST)
- 204: No Content (DELETE)
- 400: Bad Request (validation errors)
- 401: Unauthorized (missing/invalid token)
- 403: Forbidden (lacks permission)
- 404: Not Found
- 409: Conflict (duplicate resource)
- 422: Unprocessable Entity (business logic errors)
- 429: Too Many Requests
- 500: Internal Server Error

## 🔄 Process Flow

1. **Design** → Define endpoint in OpenAPI spec
2. **Implement** → Build the endpoint
3. **Test** → Create and run test scripts
4. **Document** → Write user-facing documentation
5. **Review** → Check all documentation is complete
6. **Deploy** → Include docs in deployment

## ⚠️ CRITICAL: No API Without Docs!

**NEVER merge an API change without:**
1. ✅ OpenAPI specification
2. ✅ User documentation page
3. ✅ Test scripts/files
4. ✅ Example requests/responses
5. ✅ Error documentation
6. ✅ Authentication details
7. ✅ Changelog entry

This is not optional - it's a core requirement for every API endpoint!