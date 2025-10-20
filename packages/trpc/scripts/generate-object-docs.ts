#!/usr/bin/env tsx
/**
 * Generate object documentation from database schemas
 */

import { writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

const OBJECTS_DIR = join(__dirname, '../../../apps/docs/content/docs/api/objects');
const SCHEMAS_DIR = join(__dirname, '../../database/src/db/schema');

// Ensure directory exists
mkdirSync(OBJECTS_DIR, { recursive: true });

// Object metadata with descriptions
const objectMetadata: Record<string, { title: string; description: string; category: string }> = {
  // Accounting Dimensions
  'vendor': { title: 'Vendor', description: 'Vendor entity schema and field reference', category: 'Accounting Dimensions' },
  'vendors': { title: 'Vendor', description: 'Vendor entity schema and field reference', category: 'Accounting Dimensions' },
  'organization': { title: 'Organization', description: 'Organization entity schema and field reference', category: 'Accounting Dimensions' },
  'organizations': { title: 'Organization', description: 'Organization entity schema and field reference', category: 'Accounting Dimensions' },
  'subsidiary': { title: 'Subsidiary', description: 'Subsidiary entity schema and field reference', category: 'Accounting Dimensions' },
  'subsidiaries': { title: 'Subsidiary', description: 'Subsidiary entity schema and field reference', category: 'Accounting Dimensions' },
  'department': { title: 'Department', description: 'Department entity schema and field reference', category: 'Accounting Dimensions' },
  'departments': { title: 'Department', description: 'Department entity schema and field reference', category: 'Accounting Dimensions' },
  'location': { title: 'Location', description: 'Location entity schema and field reference', category: 'Accounting Dimensions' },
  'locations': { title: 'Location', description: 'Location entity schema and field reference', category: 'Accounting Dimensions' },
  'class': { title: 'Class', description: 'Class/Cost Center entity schema and field reference', category: 'Accounting Dimensions' },
  'classes': { title: 'Class', description: 'Class/Cost Center entity schema and field reference', category: 'Accounting Dimensions' },
  'account': { title: 'Account', description: 'Chart of accounts entry schema and field reference', category: 'Accounting Dimensions' },
  'accounts': { title: 'Account', description: 'Chart of accounts entry schema and field reference', category: 'Accounting Dimensions' },

  // People & Entities
  'employee': { title: 'Employee', description: 'Employee entity schema and field reference', category: 'People & Entities' },
  'employees': { title: 'Employee', description: 'Employee entity schema and field reference', category: 'People & Entities' },
  'lead': { title: 'Lead', description: 'Lead entity schema and field reference', category: 'People & Entities' },
  'leads': { title: 'Lead', description: 'Lead entity schema and field reference', category: 'People & Entities' },
  'prospect': { title: 'Prospect', description: 'Prospect entity schema and field reference', category: 'People & Entities' },
  'prospects': { title: 'Prospect', description: 'Prospect entity schema and field reference', category: 'People & Entities' },
  'contact': { title: 'Contact', description: 'Contact entity schema and field reference', category: 'People & Entities' },
  'contacts': { title: 'Contact', description: 'Contact entity schema and field reference', category: 'People & Entities' },
  'entity': { title: 'Entity', description: 'Multi-type entity schema (Customer, Vendor, Employee, etc.)', category: 'People & Entities' },
  'entities': { title: 'Entity', description: 'Multi-type entity schema (Customer, Vendor, Employee, etc.)', category: 'People & Entities' },

  // Inventory & Products
  'item': { title: 'Item', description: 'Item/Product entity schema and field reference', category: 'Inventory & Products' },
  'items': { title: 'Item', description: 'Item/Product entity schema and field reference', category: 'Inventory & Products' },
  'warehouse': { title: 'Warehouse', description: 'Warehouse entity schema and field reference', category: 'Inventory & Products' },
  'warehouses': { title: 'Warehouse', description: 'Warehouse entity schema and field reference', category: 'Inventory & Products' },
  'price-list': { title: 'Price List', description: 'Price list entity schema and field reference', category: 'Inventory & Products' },
  'pricing': { title: 'Pricing', description: 'Pricing entity schema and field reference', category: 'Inventory & Products' },
  'unit-of-measure': { title: 'Unit of Measure', description: 'UOM entity schema and field reference', category: 'Inventory & Products' },
  'units-of-measure': { title: 'Unit of Measure', description: 'UOM entity schema and field reference', category: 'Inventory & Products' },
  'item-category': { title: 'Item Category', description: 'Item category schema and field reference', category: 'Inventory & Products' },
  'item-categories': { title: 'Item Category', description: 'Item category schema and field reference', category: 'Inventory & Products' },
  'kit-component': { title: 'Kit Component', description: 'Assembly/kit component schema and field reference', category: 'Inventory & Products' },
  'kit-components': { title: 'Kit Component', description: 'Assembly/kit component schema and field reference', category: 'Inventory & Products' },
  'assemblies-kits': { title: 'Assembly Kit', description: 'Assembly/kit schema and field reference', category: 'Inventory & Products' },
  'inventory-tracking': { title: 'Inventory Tracking', description: 'Inventory tracking schema and field reference', category: 'Inventory & Products' },
  'vendor-items': { title: 'Vendor Item', description: 'Vendor item relationship schema', category: 'Inventory & Products' },

  // Financial Objects
  'invoice': { title: 'Invoice', description: 'Invoice entity schema and field reference', category: 'Financial Objects' },
  'invoices': { title: 'Invoice', description: 'Invoice entity schema and field reference', category: 'Financial Objects' },
  'invoice-line-item': { title: 'Invoice Line Item', description: 'Invoice line item schema and field reference', category: 'Financial Objects' },
  'invoice-line-items': { title: 'Invoice Line Item', description: 'Invoice line item schema and field reference', category: 'Financial Objects' },
  'payment': { title: 'Payment', description: 'Payment entity schema and field reference', category: 'Financial Objects' },
  'payments': { title: 'Payment', description: 'Payment entity schema and field reference', category: 'Financial Objects' },
  'business-transaction': { title: 'Business Transaction', description: 'Business transaction schema and field reference', category: 'Financial Objects' },

  // Revenue Recognition
  'subscription': { title: 'Subscription', description: 'Subscription entity schema and field reference', category: 'Revenue Recognition' },
  'subscriptions': { title: 'Subscription', description: 'Subscription entity schema and field reference', category: 'Revenue Recognition' },
  'subscription-item': { title: 'Subscription Item', description: 'Subscription line item schema and field reference', category: 'Revenue Recognition' },
  'subscription-items': { title: 'Subscription Item', description: 'Subscription line item schema and field reference', category: 'Revenue Recognition' },
  'contract': { title: 'Contract', description: 'Contract entity schema and field reference', category: 'Revenue Recognition' },
  'contracts': { title: 'Contract', description: 'Contract entity schema and field reference', category: 'Revenue Recognition' },
  'contract-line-item': { title: 'Contract Line Item', description: 'Contract line item schema and field reference', category: 'Revenue Recognition' },
  'contract_line_items': { title: 'Contract Line Item', description: 'Contract line item schema and field reference', category: 'Revenue Recognition' },
  'performance-obligation': { title: 'Performance Obligation', description: 'Performance obligation schema and field reference', category: 'Revenue Recognition' },
  'performance_obligations': { title: 'Performance Obligation', description: 'Performance obligation schema and field reference', category: 'Revenue Recognition' },
  'revenue-schedule': { title: 'Revenue Schedule', description: 'Revenue schedule schema and field reference', category: 'Revenue Recognition' },
  'revenue-schedules': { title: 'Revenue Schedule', description: 'Revenue schedule schema and field reference', category: 'Revenue Recognition' },
  'revenue-journal-entry': { title: 'Revenue Journal Entry', description: 'Revenue journal entry schema and field reference', category: 'Revenue Recognition' },
  'revenue-journal-entries': { title: 'Revenue Journal Entry', description: 'Revenue journal entry schema and field reference', category: 'Revenue Recognition' },
  'ssp-evidence': { title: 'SSP Evidence', description: 'Standalone selling price evidence schema', category: 'Revenue Recognition' },
  'ssp-analytics': { title: 'SSP Analytics', description: 'SSP analytics schema and field reference', category: 'Revenue Recognition' },
  'contract-modification': { title: 'Contract Modification', description: 'Contract modification schema and field reference', category: 'Revenue Recognition' },
  'contract-modifications': { title: 'Contract Modification', description: 'Contract modification schema and field reference', category: 'Revenue Recognition' },
  'modification-line-items': { title: 'Modification Line Item', description: 'Contract modification line item schema', category: 'Revenue Recognition' },
  'contract-ssp-allocations': { title: 'Contract SSP Allocation', description: 'Contract SSP allocation schema', category: 'Revenue Recognition' },
  'recognition_patterns': { title: 'Recognition Pattern', description: 'Revenue recognition pattern schema', category: 'Revenue Recognition' },
  'catch-up-adjustments': { title: 'Catch-up Adjustment', description: 'Revenue catch-up adjustment schema', category: 'Revenue Recognition' },
  'revenue-forecasting': { title: 'Revenue Forecasting', description: 'Revenue forecasting schema', category: 'Revenue Recognition' },

  // General Ledger
  'gl-transaction': { title: 'GL Transaction', description: 'General ledger transaction schema', category: 'General Ledger' },
  'gl-transactions': { title: 'GL Transaction', description: 'General ledger transaction schema', category: 'General Ledger' },
  'gl-journal-entry': { title: 'GL Journal Entry', description: 'GL journal entry schema', category: 'General Ledger' },
  'gl-journal-entries': { title: 'GL Journal Entry', description: 'GL journal entry schema', category: 'General Ledger' },
  'gl-account-balance': { title: 'GL Account Balance', description: 'GL account balance schema', category: 'General Ledger' },
  'gl-account-balances': { title: 'GL Account Balance', description: 'GL account balance schema', category: 'General Ledger' },
  'gl-posting-rule': { title: 'GL Posting Rule', description: 'GL posting rule schema', category: 'General Ledger' },
  'gl-posting-rules': { title: 'GL Posting Rule', description: 'GL posting rule schema', category: 'General Ledger' },
  'gl-account-mappings': { title: 'GL Account Mapping', description: 'GL account mapping schema', category: 'General Ledger' },
  'accounting-period': { title: 'Accounting Period', description: 'Accounting period schema', category: 'General Ledger' },
  'accounting-periods': { title: 'Accounting Period', description: 'Accounting period schema', category: 'General Ledger' },
  'journal-entry-batches': { title: 'Journal Entry Batch', description: 'Journal entry batch schema', category: 'General Ledger' },

  // Supporting Objects
  'address': { title: 'Address', description: 'Address object schema', category: 'Supporting Objects' },
  'addresses': { title: 'Address', description: 'Address object schema', category: 'Supporting Objects' },
  'currency': { title: 'Currency', description: 'Currency entity schema', category: 'Supporting Objects' },
  'currencies': { title: 'Currency', description: 'Currency entity schema', category: 'Supporting Objects' },
  'tax-code': { title: 'Tax Code', description: 'Tax code entity schema', category: 'Supporting Objects' },
  'tax-codes': { title: 'Tax Code', description: 'Tax code entity schema', category: 'Supporting Objects' },
  'activity-code': { title: 'Activity Code', description: 'Activity code schema', category: 'Supporting Objects' },
  'activity-codes': { title: 'Activity Code', description: 'Activity code schema', category: 'Supporting Objects' },
  'products': { title: 'Product', description: 'Product entity schema', category: 'Supporting Objects' },
  'transaction-types': { title: 'Transaction Type', description: 'Transaction type schema', category: 'Supporting Objects' },
  'users': { title: 'User', description: 'User entity schema', category: 'Supporting Objects' },
  'projects': { title: 'Project', description: 'Project/construction project schema', category: 'Supporting Objects' },
  'revenue-enums': { title: 'Revenue Enums', description: 'Revenue recognition enumeration types', category: 'Supporting Objects' },
  'item-audit-log': { title: 'Item Audit Log', description: 'Item audit log schema', category: 'Supporting Objects' },
  'scenario-analysis': { title: 'Scenario Analysis', description: 'Revenue scenario analysis schema', category: 'Supporting Objects' },
  'cohort-analysis': { title: 'Cohort Analysis', description: 'Cohort analysis schema', category: 'Supporting Objects' },
  'churn-predictions': { title: 'Churn Prediction', description: 'Churn prediction schema', category: 'Supporting Objects' },
};

function generateObjectDoc(schemaName: string, meta: { title: string; description: string; category: string }): string {
  return `---
title: ${meta.title} Object
description: ${meta.description}
---

# ${meta.title} Object

Represents a ${meta.title.toLowerCase()} entity in GLAPI.

## Object Schema

\`\`\`json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "organizationId": "org_123abc",
  "status": "active",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
\`\`\`

## Field Reference

### Core Fields

#### \`id\`
- **Type**: UUID (string)
- **Required**: Auto-generated
- **Description**: Unique identifier for the ${meta.title.toLowerCase()}
- **Example**: \`"123e4567-e89b-12d3-a456-426614174000"\`

#### \`organizationId\`
- **Type**: string
- **Required**: Auto-assigned
- **Description**: Organization identifier for multi-tenant isolation
- **Example**: \`"org_123abc"\`

### Status Management

#### \`status\`
- **Type**: enum (string)
- **Required**: Yes (defaults to \`"active"\`)
- **Values**:
  - \`active\` - Record is active
  - \`inactive\` - Record is inactive but can be reactivated
  - \`archived\` - Record is archived (historical only)
- **Default**: \`"active"\`
- **Example**: \`"active"\`

### Timestamps

#### \`createdAt\`
- **Type**: datetime (ISO 8601 string)
- **Required**: Auto-generated
- **Description**: Timestamp when the record was created
- **Example**: \`"2025-01-15T10:30:00.000Z"\`

#### \`updatedAt\`
- **Type**: datetime (ISO 8601 string)
- **Required**: Auto-generated
- **Description**: Timestamp when the record was last updated
- **Example**: \`"2025-01-15T14:20:00.000Z"\`

## Validation Rules

### Creating a Record

**Minimum Required Fields:**
\`\`\`json
{
  "status": "active"
}
\`\`\`

### Updating a Record

All fields are optional when updating. Only provide fields you want to change:

\`\`\`json
{
  "status": "inactive"
}
\`\`\`

## Code Examples

### TypeScript

\`\`\`typescript
import { createTRPCClient } from '@trpc/client';
import type { AppRouter } from '@glapi/trpc';

const client = createTRPCClient<AppRouter>({
  // ... configuration
});

// Example usage
const record = await client.${schemaName.replace(/-/g, '')}s.get.query({
  id: '123e4567-e89b-12d3-a456-426614174000'
});

console.log(record.id);
\`\`\`

### Python

\`\`\`python
import requests

response = requests.get(
    'https://api.glapi.io/api/${schemaName}s/123e4567-e89b-12d3-a456-426614174000',
    headers={'Authorization': 'Bearer TOKEN'}
)

record = response.json()
print(record['id'])
\`\`\`

## Related Documentation

- [API Endpoints](/docs/api/endpoints)
- [Interactive API Reference](/api-reference)
`;
}

console.log('🚀 Generating object documentation from database schemas...\n');

// Read all schema files
const schemaFiles = readdirSync(SCHEMAS_DIR).filter(f => f.endsWith('.ts'));

let objectCount = 0;
const created: string[] = [];
const skipped: string[] = [];

for (const schemaFile of schemaFiles) {
  const schemaName = schemaFile.replace('.ts', '');

  // Skip index and special files
  if (schemaName === 'index' || schemaName === 'schema') {
    skipped.push(schemaName);
    continue;
  }

  // Skip customer (our template)
  if (schemaName === 'customer' || schemaName === 'customers') {
    skipped.push(schemaName);
    continue;
  }

  // Get metadata or use default
  const meta = objectMetadata[schemaName] || {
    title: schemaName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    description: `${schemaName} entity schema and field reference`,
    category: 'Other',
  };

  const filename = `${schemaName}.mdx`;
  const filepath = join(OBJECTS_DIR, filename);

  const content = generateObjectDoc(schemaName, meta);
  writeFileSync(filepath, content, 'utf-8');
  objectCount++;
  created.push(filename);
}

console.log(`✨ Generated ${objectCount} object documentation files!\n`);
console.log('📊 Summary:');
console.log(`   - Total objects documented: ${objectCount + 1} (including customer template)`);
console.log(`   - Skipped: ${skipped.length} (${skipped.join(', ')})`);
console.log(`   - Location: apps/docs/content/docs/api/objects/\n`);

if (objectCount > 50) {
  console.log(`\n📝 Note: Generated ${objectCount} files. You may want to review and enhance:`);
  console.log('   - Add specific field documentation for each object');
  console.log('   - Add relationships and examples');
  console.log('   - Customize based on actual schema definitions\n');
}
