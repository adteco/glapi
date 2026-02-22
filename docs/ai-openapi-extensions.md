# AI OpenAPI Extensions Guide

> **Document Location**: `docs/ai-openapi-extensions.md`
> **Target Audience**: Developers adding AI capabilities to tRPC procedures
> **Related**: [Architecture Overview](./architecture/ai-openapi.md) | [Extension Schemas](../packages/api-service/src/ai/openapi-extensions.ts)

## Quick Start

To make a tRPC procedure AI-enabled, add metadata with the `ai` property:

```typescript
import { createReadOnlyAIMeta } from '../ai-meta';

export const customersRouter = router({
  list: authenticatedProcedure
    .meta({
      ai: createReadOnlyAIMeta(
        'list_customers',
        'Search and retrieve customer records by name, status, or location'
      ),
    })
    .input(listCustomersSchema)
    .query(async ({ input, ctx }) => {
      // Implementation
    }),
});
```

The OpenAPI generator automatically emits `x-ai-*` extensions, and the AI tool generator creates function declarations for the LLM.

---

## Extension Reference

### Required Extensions

Every AI-enabled procedure must have these three extensions:

#### x-ai-tool

Core tool metadata that identifies the procedure to the LLM.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | `string` | Yes | - | Unique identifier in `snake_case` (e.g., `list_customers`) |
| `description` | `string` | Yes | - | LLM-facing description (10-500 chars, be specific!) |
| `version` | `number` | No | `1` | Contract version; increment on breaking changes |
| `stability` | `'stable' \| 'beta' \| 'experimental'` | No | `'stable'` | Affects how tool is exposed |
| `deprecated` | `boolean` | No | `false` | Mark as deprecated |
| `replacement` | `string` | No | - | Tool name to use instead (when deprecated) |
| `scopes` | `string[]` | No | `['global']` | Contexts for dynamic loading |
| `enabled` | `boolean` | No | `true` | Feature flag |
| `exampleUtterances` | `string[]` | No | - | Natural language examples |

**Example:**
```typescript
tool: {
  name: 'list_customers',
  description: 'Search and retrieve customer records. Supports filtering by name, status, state, and date range.',
  version: 1,
  stability: 'stable',
  scopes: ['global', 'sales', 'crm'],
  exampleUtterances: [
    'List all customers',
    'Show me customers in California',
    'Find active customers',
  ],
}
```

**Best Practices:**
- Tool names must be unique across the entire API
- Descriptions should be actionable: explain what the tool does, not what it is
- Include searchable scopes to reduce context window usage

---

#### x-ai-risk

Risk assessment determining confirmation and audit behavior.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `level` | `'LOW' \| 'MEDIUM' \| 'HIGH' \| 'CRITICAL'` | Yes | - | Risk level |
| `requiresConfirmation` | `boolean` | No | `false` | Prompt user before execution |
| `supportsDryRun` | `boolean` | No | `false` | Enable preview mode |
| `confirmationMessage` | `string` | No | - | Custom confirmation prompt |

**Risk Level Guidelines:**

| Level | Use For | Examples |
|-------|---------|----------|
| `LOW` | Read-only operations | List, get, search |
| `MEDIUM` | Reversible writes | Create, update |
| `HIGH` | Financial or hard-to-reverse operations | Create invoice, approve payment |
| `CRITICAL` | Irreversible or bulk operations | Delete, close period, bulk update |

**Example:**
```typescript
risk: {
  level: 'HIGH',
  requiresConfirmation: true,
  supportsDryRun: true,
  confirmationMessage: 'Create invoice for {customer} totaling {amount}?',
}
```

---

#### x-ai-permissions

Permission requirements for tool execution.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `required` | `string[]` | Yes | - | Permission scopes (e.g., `['read:customers']`) |
| `minimumRole` | `'viewer' \| 'staff' \| 'manager' \| 'accountant' \| 'admin'` | Yes | - | Minimum role level |

**Permission Format:** `{action}:{resource}` where action is `read`, `write`, `delete`, or `admin`.

**Example:**
```typescript
permissions: {
  required: ['read:customers', 'read:contacts'],
  minimumRole: 'viewer',
}
```

**Role Hierarchy:**
```
viewer → staff → manager → accountant → admin
```
Each role inherits permissions from lower roles.

---

### Optional Extensions

#### x-ai-policy

Multi-tenant safety and policy engine rules.

| Field | Type | Description |
|-------|------|-------------|
| `allowTiers` | `string[]` | Subscription tiers that can use this tool |
| `requireMfaForRisk` | `RiskLevel[]` | Risk levels requiring MFA |
| `rowScope` | `string` | CEL expression for RLS filtering |
| `maxAffectedRecords` | `number` | Maximum records per call |

**Example:**
```typescript
policy: {
  allowTiers: ['pro', 'enterprise'],
  requireMfaForRisk: ['HIGH', 'CRITICAL'],
  rowScope: 'record.orgId == caller.orgId',
  maxAffectedRecords: 100,
}
```

---

#### x-ai-rate-limit

Rate limiting configuration.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `requestsPerMinute` | `number` | - | Max requests per minute (1-1000) |
| `burstLimit` | `number` | - | Max concurrent requests (1-100) |
| `scope` | `'user' \| 'organization' \| 'global'` | `'user'` | Rate limit scope |

**Example:**
```typescript
rateLimit: {
  requestsPerMinute: 60,
  burstLimit: 10,
  scope: 'user',
}
```

**Recommended Limits by Operation Type:**

| Operation | requestsPerMinute |
|-----------|-------------------|
| List/Search | 60 |
| Get by ID | 60 |
| Create | 30 |
| Update | 30 |
| Delete | 10 |

---

#### x-ai-output

Response shaping and redaction rules.

| Field | Type | Description |
|-------|------|-------------|
| `includeFields` | `string[]` | Allowlist of fields to return |
| `redactFields` | `string[]` | Fields to mask (e.g., PII) |
| `maxItems` | `number` | Maximum array items (1-1000) |
| `maxTokens` | `number` | Approximate token budget (1-10000) |

**Example:**
```typescript
output: {
  includeFields: ['id', 'name', 'status', 'createdAt'],
  redactFields: ['taxId', 'ssn', 'bankAccount'],
  maxItems: 50,
  maxTokens: 500,
}
```

**When to Use:**
- `includeFields`: When you want to limit response size for token efficiency
- `redactFields`: Always redact PII and financial identifiers
- `maxItems`: For list operations to prevent overwhelming the LLM

---

#### x-ai-idempotency

Idempotency configuration for write operations.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `keySource` | `'header' \| 'parameter' \| 'auto'` | `'auto'` | Source of idempotency key |
| `ttlSeconds` | `number` | `86400` | Key retention period (max 7 days) |

**Example:**
```typescript
idempotency: {
  keySource: 'auto',
  ttlSeconds: 86400, // 24 hours
}
```

Use for all create/update operations to prevent duplicate submissions.

---

#### x-ai-timeouts

Timeout configuration.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `softMs` | `number` | `3000` | Soft timeout - trigger warning |
| `hardMs` | `number` | `10000` | Hard timeout - abort execution |
| `retryable` | `boolean` | `true` | Whether timeout errors should retry |

**Example:**
```typescript
timeouts: {
  softMs: 3000,
  hardMs: 10000,
  retryable: true,
}
```

---

#### x-ai-cache

Result caching configuration.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable caching |
| `ttlSeconds` | `number` | `300` | Cache TTL (max 24 hours) |
| `varyBy` | `string[]` | - | Parameters affecting cache key |
| `invalidateOn` | `string[]` | - | Domain events that clear cache |

**Example:**
```typescript
cache: {
  enabled: true,
  ttlSeconds: 60,
  varyBy: ['search', 'limit', 'offset'],
  invalidateOn: ['customer.created', 'customer.updated'],
}
```

---

#### x-ai-errors

Error catalog for known error conditions.

| Field | Type | Description |
|-------|------|-------------|
| `code` | `string` | Error code identifier |
| `retryable` | `boolean` | LLM should retry with corrected params |
| `userSafeMessage` | `string` | Message safe to display to users |

**Example:**
```typescript
errors: [
  {
    code: 'ArgumentValidationFailed',
    retryable: false,
    userSafeMessage: 'One or more inputs are invalid.',
  },
  {
    code: 'RateLimited',
    retryable: true,
    userSafeMessage: 'Too many requests. Please try again shortly.',
  },
  {
    code: 'NotFound',
    retryable: false,
    userSafeMessage: 'The requested resource was not found.',
  },
]
```

---

#### x-ai-async

Async/long-running operation configuration.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable async mode |
| `statusEndpoint` | `string` | - | Polling endpoint template |
| `terminalStates` | `string[]` | `['succeeded', 'failed', 'canceled']` | Completion states |
| `polling.minMs` | `number` | `500` | Minimum polling interval |
| `polling.maxMs` | `number` | `5000` | Maximum polling interval |

**Example:**
```typescript
async: {
  enabled: true,
  statusEndpoint: '/api/jobs/{jobId}',
  terminalStates: ['succeeded', 'failed', 'canceled'],
  polling: {
    minMs: 500,
    maxMs: 5000,
  },
}
```

---

#### x-ai-financial-limits

Financial amount limits by role.

| Field | Type | Description |
|-------|------|-------------|
| `staff` | `number` | Max amount for staff role |
| `manager` | `number` | Max amount for manager role |
| `accountant` | `number` | Max amount for accountant role |
| `admin` | `number` | Max amount for admin role (optional) |

**Example:**
```typescript
financialLimits: {
  staff: 10000,      // $10,000
  manager: 100000,   // $100,000
  accountant: 1000000, // $1,000,000
  // admin: unlimited by default
}
```

---

## Helper Functions

The `@glapi/trpc/ai-meta` module provides helper functions for common patterns.

### createReadOnlyAIMeta

For read-only query operations (list, get, search).

```typescript
import { createReadOnlyAIMeta } from '../ai-meta';

const aiMeta = createReadOnlyAIMeta(
  'list_customers',
  'Search and retrieve customer records',
  {
    scopes: ['global', 'sales'],
    minimumRole: 'viewer',
    permissions: ['read:customers'],
    cache: { enabled: true, ttlSeconds: 60 },
    rateLimit: { requestsPerMinute: 60 },
  }
);
```

**Defaults:**
- Risk level: `LOW`
- Requires confirmation: `false`
- Supports dry run: `false`
- Minimum role: `viewer`

---

### createWriteAIMeta

For create/update mutations.

```typescript
import { createWriteAIMeta } from '../ai-meta';

const aiMeta = createWriteAIMeta(
  'create_customer',
  'Create a new customer record',
  {
    scopes: ['global', 'sales'],
    minimumRole: 'staff',
    permissions: ['write:customers'],
    riskLevel: 'MEDIUM',
    requiresConfirmation: true,
    supportsDryRun: true,
  }
);
```

**Defaults:**
- Risk level: `MEDIUM`
- Requires confirmation: `true`
- Supports dry run: `true`
- Minimum role: `staff`
- Rate limit: 30/min
- Idempotency: enabled

---

### createDeleteAIMeta

For delete mutations.

```typescript
import { createDeleteAIMeta } from '../ai-meta';

const aiMeta = createDeleteAIMeta(
  'delete_customer',
  'Permanently delete a customer record',
  {
    scopes: ['global', 'admin'],
    minimumRole: 'manager',
    riskLevel: 'HIGH',
  }
);
```

**Defaults:**
- Risk level: `HIGH`
- Requires confirmation: `true`
- Supports dry run: `true`
- Minimum role: `manager`
- Rate limit: 10/min
- Confirmation message: "Are you sure you want to delete this {resource}? This action cannot be undone."

---

## Complete Examples

### Read-Only List Endpoint

```typescript
export const customersRouter = router({
  list: authenticatedProcedure
    .meta({
      ai: {
        tool: {
          name: 'list_customers',
          description: 'Search and list customer records with filtering and pagination',
          scopes: ['global', 'sales', 'crm'],
          version: 1,
          stability: 'stable',
          enabled: true,
          exampleUtterances: [
            'List all customers',
            'Show me customers in California',
            'Find customers created this month',
          ],
        },
        risk: {
          level: 'LOW',
          requiresConfirmation: false,
          supportsDryRun: false,
        },
        permissions: {
          required: ['read:customers'],
          minimumRole: 'viewer',
        },
        cache: {
          enabled: true,
          ttlSeconds: 60,
          varyBy: ['search', 'status', 'limit', 'offset'],
          invalidateOn: ['customer.created', 'customer.updated', 'customer.deleted'],
        },
        rateLimit: {
          requestsPerMinute: 60,
          scope: 'user',
        },
        output: {
          redactFields: ['taxId'],
          maxItems: 100,
        },
      },
    })
    .input(listCustomersSchema)
    .query(async ({ input, ctx }) => {
      return ctx.customerService.list(input);
    }),
});
```

### High-Risk Financial Operation

```typescript
export const invoicesRouter = router({
  create: authenticatedProcedure
    .meta({
      ai: {
        tool: {
          name: 'create_invoice',
          description: 'Create a new customer invoice with line items',
          scopes: ['invoicing', 'accounting'],
          version: 1,
          stability: 'stable',
          enabled: true,
        },
        risk: {
          level: 'HIGH',
          requiresConfirmation: true,
          supportsDryRun: true,
          confirmationMessage: 'Create invoice for {customer} totaling {total}? This will affect accounts receivable.',
        },
        permissions: {
          required: ['write:invoices'],
          minimumRole: 'accountant',
        },
        policy: {
          allowTiers: ['pro', 'enterprise'],
          requireMfaForRisk: ['CRITICAL'],
        },
        rateLimit: {
          requestsPerMinute: 20,
          scope: 'user',
        },
        financialLimits: {
          staff: 10000,
          manager: 100000,
          accountant: 1000000,
        },
        idempotency: {
          keySource: 'auto',
          ttlSeconds: 86400,
        },
        errors: [
          { code: 'CustomerNotFound', retryable: false, userSafeMessage: 'Customer not found.' },
          { code: 'InvalidLineItems', retryable: false, userSafeMessage: 'Invalid line items provided.' },
          { code: 'ExceedsLimit', retryable: false, userSafeMessage: 'Amount exceeds your approval limit.' },
        ],
      },
    })
    .input(createInvoiceSchema)
    .mutation(async ({ input, ctx }) => {
      if (input.dryRun) {
        return ctx.invoiceService.preview(input);
      }
      return ctx.invoiceService.create(input);
    }),
});
```

---

## Tool Scopes

Scopes control which tools are loaded based on user context, reducing token usage by ~70%.

### Available Scopes

| Scope | When Loaded | Example Tools |
|-------|-------------|---------------|
| `global` | Always | list_customers, search, get_organization_info |
| `sales` | Sales pages/workflows | create_quote, list_opportunities, get_customer |
| `invoicing` | Invoice workflows | create_invoice, list_invoices, apply_payment |
| `accounting` | GL and reporting | create_journal_entry, close_period, run_report |
| `inventory` | Inventory management | list_items, adjust_stock, transfer_inventory |
| `purchasing` | Purchase workflows | create_po, list_vendors, receive_goods |
| `reporting` | Report generation | run_report, schedule_report, export_data |
| `admin` | Admin functions | manage_users, update_settings, audit_logs |
| `crm` | CRM workflows | list_leads, convert_prospect, log_activity |
| `projects` | Project management | list_projects, log_time, bill_project |

### Assigning Scopes

Always include `global` plus relevant domain scopes:

```typescript
scopes: ['global', 'sales', 'crm']  // Sales-related tool
scopes: ['global', 'accounting']     // Accounting tool
scopes: ['global', 'admin']          // Admin-only tool
```

---

## Workflow Integration

### After Adding AI Metadata

1. **Regenerate tools:**
   ```bash
   pnpm --filter @glapi/trpc generate:ai-tools
   ```

2. **Verify TypeScript:**
   ```bash
   pnpm type-check
   ```

3. **Run tests:**
   ```bash
   pnpm --filter @glapi/trpc test:run
   ```

### Pre-commit Hook

The pre-commit hook automatically regenerates AI tools when router files change. Generated files are committed alongside your changes.

### CI Verification

CI validates that generated files are up-to-date:
```bash
pnpm generate:api
git diff --exit-code apps/web/src/lib/ai/generated/
```

---

## Troubleshooting

### Tool Not Appearing

1. Check that `ai.tool.enabled` is `true`
2. Verify the tool name is unique (snake_case)
3. Run `pnpm generate:ai-tools` to regenerate
4. Check that the procedure has proper input/output schemas

### Validation Errors

The LLM may send invalid parameters. The executor validates inputs and returns structured errors for self-correction:

```json
{
  "error": {
    "code": "ArgumentValidationFailed",
    "details": {
      "fieldErrors": {
        "limit": ["Expected number, received string"]
      }
    },
    "hint": "Please correct the parameters and try again"
  }
}
```

### Permission Denied

Check that:
1. User has all permissions in `permissions.required`
2. User's role meets `permissions.minimumRole`
3. Organization tier matches `policy.allowTiers` (if set)

### Rate Limited

The tool returns retryable error with retry-after hint:

```json
{
  "error": {
    "code": "RateLimited",
    "retryable": true,
    "userSafeMessage": "Too many requests. Please try again shortly.",
    "retryAfterMs": 5000
  }
}
```

---

## Migration from Legacy Intents

If migrating from the legacy `intents.ts` system:

1. Find the intent in `apps/web/src/lib/ai/intents.ts`
2. Map properties to AI meta:
   - `name` → `tool.name`
   - `description` → `tool.description`
   - `riskLevel` → `risk.level`
   - `requiresConfirmation` → `risk.requiresConfirmation`
   - `requiredPermissions` → `permissions.required`
3. Add metadata to the tRPC procedure
4. Run generator to verify
5. Remove intent from legacy file after full migration

---

## Related Documentation

- [AI OpenAPI Architecture](./architecture/ai-openapi.md) - Full architecture overview
- [Extension Zod Schemas](../packages/api-service/src/ai/openapi-extensions.ts) - Type definitions
- [AI Meta Types](../packages/trpc/src/ai-meta.ts) - TypeScript interfaces and helpers
- [OpenAPI Generator](../packages/trpc/src/openapi-generator.ts) - Extension emitters
