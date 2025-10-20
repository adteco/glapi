#!/usr/bin/env tsx
/**
 * Generate documentation for all endpoints and objects
 */

import { writeFileSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const ENDPOINTS_DIR = join(__dirname, '../../../apps/docs/content/docs/api/endpoints');
const OBJECTS_DIR = join(__dirname, '../../../apps/docs/content/docs/api/objects');
const ROUTERS_DIR = join(__dirname, '../src/routers');

// Ensure directories exist
mkdirSync(ENDPOINTS_DIR, { recursive: true });
mkdirSync(OBJECTS_DIR, { recursive: true });

// Router metadata
const routerMetadata: Record<string, { title: string; description: string; tag: string; category: string }> = {
  vendors: {
    title: 'Vendors',
    description: 'Vendor management API endpoints',
    tag: 'Vendors',
    category: 'Accounting Dimensions',
  },
  organizations: {
    title: 'Organizations',
    description: 'Organization management API endpoints',
    tag: 'Organizations',
    category: 'Accounting Dimensions',
  },
  subsidiaries: {
    title: 'Subsidiaries',
    description: 'Subsidiary management API endpoints',
    tag: 'Subsidiaries',
    category: 'Accounting Dimensions',
  },
  departments: {
    title: 'Departments',
    description: 'Department management API endpoints',
    tag: 'Departments',
    category: 'Accounting Dimensions',
  },
  locations: {
    title: 'Locations',
    description: 'Location management API endpoints',
    tag: 'Locations',
    category: 'Accounting Dimensions',
  },
  classes: {
    title: 'Classes',
    description: 'Class/Cost Center management API endpoints',
    tag: 'Classes',
    category: 'Accounting Dimensions',
  },
  accounts: {
    title: 'Chart of Accounts',
    description: 'Chart of accounts management API endpoints',
    tag: 'Accounts',
    category: 'Accounting Dimensions',
  },
  employees: {
    title: 'Employees',
    description: 'Employee management API endpoints',
    tag: 'Employees',
    category: 'People & Entities',
  },
  leads: {
    title: 'Leads',
    description: 'Lead management API endpoints',
    tag: 'Leads',
    category: 'People & Entities',
  },
  prospects: {
    title: 'Prospects',
    description: 'Prospect management API endpoints',
    tag: 'Prospects',
    category: 'People & Entities',
  },
  contacts: {
    title: 'Contacts',
    description: 'Contact management API endpoints',
    tag: 'Contacts',
    category: 'People & Entities',
  },
  items: {
    title: 'Items',
    description: 'Item/Product management API endpoints',
    tag: 'Items',
    category: 'Inventory & Products',
  },
  warehouses: {
    title: 'Warehouses',
    description: 'Warehouse management API endpoints',
    tag: 'Warehouses',
    category: 'Inventory & Products',
  },
  'price-lists': {
    title: 'Price Lists',
    description: 'Price list management API endpoints',
    tag: 'Price Lists',
    category: 'Inventory & Products',
  },
  'units-of-measure': {
    title: 'Units of Measure',
    description: 'Unit of measure management API endpoints',
    tag: 'Units of Measure',
    category: 'Inventory & Products',
  },
  invoices: {
    title: 'Invoices',
    description: 'Invoice management API endpoints',
    tag: 'Invoices',
    category: 'Financial Operations',
  },
  payments: {
    title: 'Payments',
    description: 'Payment management API endpoints',
    tag: 'Payments',
    category: 'Financial Operations',
  },
  'business-transactions': {
    title: 'Business Transactions',
    description: 'Business transaction API endpoints',
    tag: 'Business Transactions',
    category: 'Financial Operations',
  },
  subscriptions: {
    title: 'Subscriptions',
    description: 'Subscription management API endpoints',
    tag: 'Subscriptions',
    category: 'Revenue Recognition',
  },
  revenue: {
    title: 'Revenue',
    description: 'Revenue recognition API endpoints',
    tag: 'Revenue',
    category: 'Revenue Recognition',
  },
};

function generateEndpointDoc(routerName: string, meta: typeof routerMetadata[string]): string {
  const singularName = routerName.replace(/-/g, ' ').replace(/s$/, '');
  const capitalizedSingular = singularName.charAt(0).toUpperCase() + singularName.slice(1);

  return `---
title: ${meta.title}
description: ${meta.description}
---

# ${meta.title} API

Manage ${routerName} in your organization.

## Base Path

\`\`\`
/api/${routerName}
\`\`\`

## Endpoints

### List ${meta.title}

List all ${routerName} in your organization.

\`\`\`http
GET /api/${routerName}
\`\`\`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| \`includeInactive\` | boolean | No | Include inactive records in the results |

**Example Request:**

\`\`\`bash
curl -H "Authorization: Bearer YOUR_TOKEN" \\
  https://api.glapi.io/api/${routerName}
\`\`\`

**Example Response:**

\`\`\`json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "organizationId": "org_123",
    "status": "active",
    "createdAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2025-01-15T10:30:00Z"
  }
]
\`\`\`

---

### Get ${capitalizedSingular}

Retrieve a specific ${singularName} by ID.

\`\`\`http
GET /api/${routerName}/{id}
\`\`\`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| \`id\` | UUID | Yes | ${capitalizedSingular} ID |

**Example Request:**

\`\`\`bash
curl -H "Authorization: Bearer YOUR_TOKEN" \\
  https://api.glapi.io/api/${routerName}/123e4567-e89b-12d3-a456-426614174000
\`\`\`

**Error Responses:**

- \`404 Not Found\` - ${capitalizedSingular} not found

---

### Create ${capitalizedSingular}

Create a new ${singularName}.

\`\`\`http
POST /api/${routerName}
\`\`\`

**Request Body:**

\`\`\`json
{
  "status": "active"
}
\`\`\`

**Example Request:**

\`\`\`bash
curl -X POST \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"status": "active"}' \\
  https://api.glapi.io/api/${routerName}
\`\`\`

---

### Update ${capitalizedSingular}

Update an existing ${singularName}.

\`\`\`http
PUT /api/${routerName}/{id}
\`\`\`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| \`id\` | UUID | Yes | ${capitalizedSingular} ID |

**Request Body:**

Provide only the fields you want to update. All fields are optional.

\`\`\`json
{
  "status": "inactive"
}
\`\`\`

**Example Request:**

\`\`\`bash
curl -X PUT \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"status": "inactive"}' \\
  https://api.glapi.io/api/${routerName}/123e4567-e89b-12d3-a456-426614174000
\`\`\`

**Error Responses:**

- \`404 Not Found\` - ${capitalizedSingular} not found

---

### Delete ${capitalizedSingular}

Delete a ${singularName}.

\`\`\`http
DELETE /api/${routerName}/{id}
\`\`\`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| \`id\` | UUID | Yes | ${capitalizedSingular} ID |

**Example Request:**

\`\`\`bash
curl -X DELETE \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  https://api.glapi.io/api/${routerName}/123e4567-e89b-12d3-a456-426614174000
\`\`\`

**Example Response:**

\`\`\`json
{
  "success": true
}
\`\`\`

**Error Responses:**

- \`404 Not Found\` - ${capitalizedSingular} not found

---

## Code Examples

### TypeScript

\`\`\`typescript
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@glapi/trpc';

const client = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'https://api.glapi.io/api/trpc',
      headers: () => ({
        Authorization: \`Bearer \${process.env.GLAPI_TOKEN}\`,
      }),
    }),
  ],
});

// List ${routerName}
const items = await client.${routerName.replace(/-/g, '')}.list.query();

// Get ${singularName}
const item = await client.${routerName.replace(/-/g, '')}.get.query({
  id: '123e4567-e89b-12d3-a456-426614174000'
});

// Create ${singularName}
const newItem = await client.${routerName.replace(/-/g, '')}.create.mutate({
  status: 'active',
});

// Update ${singularName}
const updated = await client.${routerName.replace(/-/g, '')}.update.mutate({
  id: '123e4567-e89b-12d3-a456-426614174000',
  data: {
    status: 'inactive',
  },
});

// Delete ${singularName}
await client.${routerName.replace(/-/g, '')}.delete.mutate({
  id: '123e4567-e89b-12d3-a456-426614174000'
});
\`\`\`

### Python

\`\`\`python
import requests
import os

API_BASE = 'https://api.glapi.io/api'
TOKEN = os.environ.get('GLAPI_TOKEN')
HEADERS = {
    'Authorization': f'Bearer {TOKEN}',
    'Content-Type': 'application/json',
}

# List ${routerName}
response = requests.get(f'{API_BASE}/${routerName}', headers=HEADERS)
items = response.json()

# Get ${singularName}
response = requests.get(
    f'{API_BASE}/${routerName}/123e4567-e89b-12d3-a456-426614174000',
    headers=HEADERS
)
item = response.json()

# Create ${singularName}
response = requests.post(
    f'{API_BASE}/${routerName}',
    headers=HEADERS,
    json={'status': 'active'}
)
new_item = response.json()

# Update ${singularName}
response = requests.put(
    f'{API_BASE}/${routerName}/123e4567-e89b-12d3-a456-426614174000',
    headers=HEADERS,
    json={'status': 'inactive'}
)
updated = response.json()

# Delete ${singularName}
response = requests.delete(
    f'{API_BASE}/${routerName}/123e4567-e89b-12d3-a456-426614174000',
    headers=HEADERS
)
\`\`\`

## Related Resources

- [Interactive API Reference](/api-reference)
- [Authentication](/docs/api/authentication)
`;
}

console.log('🚀 Generating endpoint documentation...\n');

let endpointCount = 0;
for (const [routerName, meta] of Object.entries(routerMetadata)) {
  const filename = `${routerName}.mdx`;
  const filepath = join(ENDPOINTS_DIR, filename);

  // Skip if already exists (customers.mdx is our template)
  if (routerName === 'customers') {
    console.log(`⏭️  Skipping ${filename} (template already exists)`);
    continue;
  }

  const content = generateEndpointDoc(routerName, meta);
  writeFileSync(filepath, content, 'utf-8');
  endpointCount++;
  console.log(`✅ Created ${filename}`);
}

console.log(`\n✨ Generated ${endpointCount} endpoint documentation files!\n`);
console.log('📊 Summary:');
console.log(`   - Total endpoints documented: ${endpointCount + 1} (including customers template)`);
console.log(`   - Location: apps/docs/content/docs/api/endpoints/\n`);
