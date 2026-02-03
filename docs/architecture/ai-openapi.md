# OpenAPI-Driven AI Chat Agent Architecture

> **Document Location**: `docs/architecture/ai-openapi.md`
> This document will be committed to the repository for team review.

## Executive Summary

This document outlines an architectural approach where the **OpenAPI specification becomes the single source of truth** for how the GLAPI AI assistant interacts with the application. Rather than maintaining separate, manually-synced definitions in the intent catalog and TRPC MCP client, we derive AI capabilities directly from the OpenAPI spec.

---

## Current State Analysis

### What Exists Today

| Component | Location | Lines | Purpose |
|-----------|----------|-------|---------|
| Intent Catalog | `apps/web/src/lib/ai/intents.ts` | 692 | 50+ manually defined intents |
| TRPC MCP Client | `apps/web/src/lib/ai/trpc-mcp-client.ts` | 443 | Manual tool→TRPC mapping |
| OpenAPI Generator | `packages/trpc/scripts/generate-openapi.ts` | - | Generates spec from routers |
| OpenAPI Spec | `apps/docs/public/api/openapi.json` | 4,277 | 42 endpoints documented |

### Problems with Current Approach

1. **Triple Maintenance Burden**: Changes require updates to TRPC routers, intent catalog, AND MCP client
2. **Drift Risk**: Tool definitions can become out of sync with actual API capabilities
3. **No Single Source of Truth**: Developers must check 3+ files to understand AI capabilities
4. **Manual Schema Duplication**: Request/response schemas defined separately in each layer
5. **Context Window Pollution**: Sending 50+ tool definitions (~5k tokens) on every turn degrades performance and confuses the model
6. **Opaque Failure Modes**: LLM parameter hallucinations result in generic TRPC errors with no self-correction capability
7. **Binary Confirmation Model**: High-risk actions use simple "confirm?" dialogs without showing users what will actually happen

---

## Proposed Architecture

### Core Concept

```
┌─────────────────────────────────────────────────────────────────────┐
│                         OpenAPI Spec                                │
│                    (Single Source of Truth)                         │
│  ┌───────────────┬──────────────────┬────────────────────────────┐ │
│  │ Endpoints     │ Schemas          │ AI Extensions              │ │
│  │ /customers    │ CustomerSchema   │ x-ai-tool: list_customers  │ │
│  │ /vendors      │ VendorSchema     │ x-ai-risk: LOW             │ │
│  │ /invoices     │ InvoiceSchema    │ x-ai-confirm: true         │ │
│  └───────────────┴──────────────────┴────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
         ┌──────────────────┐        ┌──────────────────┐
         │ AI Tool Generator│        │ REST API Server  │
         │ (Build Time)     │        │ (Runtime)        │
         └────────┬─────────┘        └──────────────────┘
                  │
                  ▼
         ┌──────────────────────────────────────────────┐
         │          Generated AI Tools                  │
         │  - Function declarations for LLM            │
         │  - Parameter schemas                        │
         │  - Risk levels & confirmation requirements  │
         │  - Guardrail metadata                       │
         └──────────────────────────────────────────────┘
```

---

## Benefits

### 1. **Single Source of Truth**
- OpenAPI spec defines ALL capabilities
- AI tools are generated, not manually maintained
- API documentation automatically reflects AI capabilities

### 2. **Self-Documenting**
- Developers see exactly what AI can do by reading the spec
- AI capabilities documented alongside API endpoints
- Interactive documentation (Swagger/Scalar) shows AI extensions

### 3. **Type Safety End-to-End**
- Zod schemas → OpenAPI → AI Function Declarations
- Request/response types validated at every layer
- TypeScript types generated from spec

### 4. **Extensibility**
- Add AI capability by adding OpenAPI extension
- Custom extensions for risk levels, permissions, rate limits
- Easy to enable/disable AI operations per endpoint

### 5. **Standards Compliance**
- OpenAPI 3.0/3.1 is widely adopted
- Works with existing tooling (editors, validators, generators)
- Portable to other AI providers (Claude, GPT, Gemini all support function calling)

### 6. **Reduced Maintenance**
- No more manual sync between intents.ts, trpc-mcp-client.ts, and routers
- Schema changes automatically propagate
- Easier onboarding for new developers

---

## Production-Ready Enhancements

Three architectural features make this system production-ready at scale:

### 1. Dynamic Tool Scoping (Performance & Accuracy)

**Problem**: Sending 50+ tool definitions (~5k+ tokens) in every system prompt increases latency, costs, and makes the LLM prone to selecting wrong tools.

**Solution**: Tag tools with contextual `scopes` (e.g., `global`, `sales`, `invoicing`). At runtime, only load relevant tools based on user's current page/route/state.

```typescript
// Before: Load ALL 50+ tools (5k tokens)
const tools = AI_TOOLS;

// After: Load only relevant tools (~1.5k tokens, 70% reduction)
const tools = getToolsByScope(['global', 'invoicing']);
```

**Benefits**:
- **Cost/Latency**: Reduces prompt size by ~70%
- **Accuracy**: LLM won't suggest "delete user" when user is asking about invoices
- **Focus**: Model has fewer options to choose from, improving precision

**Scope Examples**:
| Scope | Tools Included |
|-------|----------------|
| `global` | list_customers, search, get_organization_info |
| `sales` | create_quote, list_opportunities, get_customer |
| `invoicing` | create_invoice, list_invoices, apply_payment |
| `accounting` | create_journal_entry, close_period, run_report |

### 2. Zod-Based Intermediate Validation (Self-Healing)

**Problem**: If LLM sends `limit: "fifty"` (string) instead of `limit: 50` (number), TRPC throws a generic 400 error. The AI crashes or says "Something went wrong."

**Solution**: Each generated tool includes a runtime Zod schema. The executor validates parameters **before** calling TRPC, returning structured errors that enable the LLM to self-correct.

```typescript
// LLM sends invalid params
const params = { limit: "fifty" }; // Wrong type!

// Executor catches and returns actionable error
{
  error: "ArgumentValidationFailed",
  details: {
    fieldErrors: {
      limit: ["Expected number, received string"]
    }
  },
  hint: "Please correct the parameters and try again"
}

// LLM reads error, fixes itself, retries with:
const params = { limit: 50 }; // Correct!
```

**Benefits**:
- **Self-Healing**: AI fixes its own type errors without user intervention
- **Safety**: Malformed data never reaches business logic/database
- **Debugging**: Clear error messages for developers

### 3. Dry-Run Simulation Support (User Experience)

**Problem**: High-risk actions use binary "confirm?" dialogs. Users can't see what will happen before confirming.

**Solution**: Tools can declare `supportsDryRun: true`. Before committing, the AI calls the action in simulation mode to show the user exactly what will happen.

```typescript
// User: "Create an invoice for Acme"

// Step 1: AI calls preview
const preview = await previewAction('create_invoice', {
  customerId: 'acme-123',
  items: [{ description: 'Consulting', amount: 5000 }]
}, { caller });

// Preview returns:
{
  preview: true,
  wouldCreate: {
    invoiceNumber: "INV-2024-0042",
    customer: "Acme Corporation",
    lineItems: [{ description: "Consulting", amount: 5000 }],
    total: 5000,
    dueDate: "2024-02-15"
  },
  accountingImpact: {
    debit: { account: "Accounts Receivable", amount: 5000 },
    credit: { account: "Revenue", amount: 5000 }
  }
}

// Step 2: AI shows user the preview and asks for confirmation
// Step 3: User confirms, AI executes without dryRun flag
```

**Benefits**:
- **Transparency**: Users see exactly what will happen
- **Confidence**: Reduces fear of AI "doing something wrong"
- **Audit**: Preview data can be logged for compliance

---

## Technical Overview

### Phase 1: OpenAPI Extension Schema

Define custom extensions for AI-specific metadata:

```yaml
# OpenAPI extensions for AI tools
x-ai-tool:
  name: list_customers          # Tool name for LLM
  description: "Search and retrieve customer records"
  scopes: ["global", "sales"]   # Contextual scoping for dynamic loading
  enabled: true                 # Feature flag

x-ai-risk:
  level: LOW | MEDIUM | HIGH | CRITICAL
  requiresConfirmation: boolean
  supportsDryRun: boolean       # Can we simulate this action?
  confirmationMessage: string   # Custom message for user

x-ai-permissions:
  required:
    - read:customers
    - read:contacts
  minimumRole: staff | manager | accountant | admin

x-ai-rate-limit:
  requestsPerMinute: 60
  burstLimit: 10

x-ai-parameters:
  search:
    aiDescription: "Natural language search term"
    examples: ["Acme", "customers in California"]
  limit:
    aiDescription: "Maximum results (1-100)"
    default: 50
```

### Phase 2: Enhanced OpenAPI Generation

Extend current generator to include AI metadata:

**File**: `packages/trpc/src/openapi-generator.ts`

```typescript
// Example enhanced path generation
{
  "/api/customers": {
    "get": {
      "operationId": "listCustomers",
      "summary": "List all customers",
      "x-ai-tool": {
        "name": "list_customers",
        "description": "Retrieve and search customer records in the system",
        "scopes": ["global", "sales"],
        "enabled": true
      },
      "x-ai-risk": {
        "level": "LOW",
        "requiresConfirmation": false,
        "supportsDryRun": false
      },
      "x-ai-permissions": {
        "required": ["read:customers"],
        "minimumRole": "viewer"
      },
      "x-ai-rate-limit": {
        "requestsPerMinute": 60
      },
      "parameters": [...],
      "responses": {...}
    }
  }
}
```

### Phase 3: AI Tool Generator

Create a build-time tool that generates AI function declarations from OpenAPI:

**File**: `packages/trpc/scripts/generate-ai-tools.ts`

```typescript
import { z, ZodSchema } from 'zod';

interface GeneratedAITool {
  // For LLM function calling
  functionDeclaration: {
    name: string;
    description: string;
    parameters: JSONSchema;
  };

  // Runtime validation schema (enables self-healing on LLM errors)
  inputSchema: ZodSchema;

  // For guardrails system
  metadata: {
    riskLevel: RiskLevel;
    requiresConfirmation: boolean;
    supportsDryRun: boolean;      // Can simulate before committing
    requiredPermissions: string[];
    minimumRole: UserRole;
    rateLimitPerMinute: number;
    scopes: string[];             // Dynamic tool loading contexts
  };

  // For execution
  endpoint: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    operationId: string;
  };
}
```

**Output**: `apps/web/src/lib/ai/generated/tools.ts`

```typescript
// Auto-generated from OpenAPI spec
// DO NOT EDIT MANUALLY

import { z } from 'zod';

export const AI_TOOLS: GeneratedAITool[] = [
  {
    functionDeclaration: {
      name: "list_customers",
      description: "Retrieve and search customer records",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Search term" },
          limit: { type: "number", description: "Max results" }
        }
      }
    },
    // Runtime Zod schema for validation (enables LLM self-correction)
    inputSchema: z.object({
      search: z.string().optional(),
      limit: z.number().min(1).max(100).optional()
    }),
    metadata: {
      riskLevel: "LOW",
      requiresConfirmation: false,
      supportsDryRun: false,
      requiredPermissions: ["read:customers"],
      minimumRole: "viewer",
      rateLimitPerMinute: 60,
      scopes: ["global", "sales"]
    },
    endpoint: {
      method: "GET",
      path: "/api/customers",
      operationId: "listCustomers"
    }
  },
  // ... 40+ more tools auto-generated
];

// Helper for retrieving scoped tools (reduces context window by ~70%)
export const getToolsByScope = (scopes: string[]): GeneratedAITool[] => {
  return AI_TOOLS.filter(tool =>
    tool.metadata.scopes.some(s => scopes.includes(s))
  );
};

// Get tool by name
export const getToolByName = (name: string): GeneratedAITool | undefined => {
  return AI_TOOLS.find(t => t.functionDeclaration.name === name);
};
```

### Phase 4: Runtime Execution (Dual-Mode)

Support **both** HTTP and TRPC execution - TRPC for internal AI (performance), HTTP for external integrations.

#### Generated Executor Module

**File**: `apps/web/src/lib/ai/generated/executor.ts`

```typescript
import { z } from 'zod';
import { AI_TOOLS, getToolByName, type GeneratedAITool } from './tools';
import type { Caller } from '@glapi/trpc';

// Validation result type for self-healing capability
export type ValidationResult =
  | { success: true; data: unknown }
  | { success: false; error: 'ArgumentValidationFailed'; details: z.ZodError['flatten'] };

// Auto-generated TRPC mappings (for internal AI - no HTTP overhead)
const TRPC_HANDLERS: Record<string, (caller: Caller, params: any) => Promise<any>> = {
  listCustomers: (caller, p) => caller.customers.list(p),
  getCustomer: (caller, p) => caller.customers.get(p),
  createCustomer: (caller, p) => caller.customers.create(p),
  listVendors: (caller, p) => caller.vendors.list(p),
  // ... all 40+ operations auto-generated
};

// Validate parameters using Zod schema (enables LLM self-correction)
export function validateToolParams(
  tool: GeneratedAITool,
  params: unknown
): ValidationResult {
  const validation = tool.inputSchema.safeParse(params);
  if (!validation.success) {
    return {
      success: false,
      error: 'ArgumentValidationFailed',
      details: validation.error.flatten()
    };
  }
  return { success: true, data: validation.data };
}

// TRPC execution with validation (internal AI chat - recommended for performance)
export async function executeViaTRPC(
  tool: GeneratedAITool,
  params: unknown,
  caller: Caller,
  options?: { dryRun?: boolean }
): Promise<unknown> {
  // Validate parameters first - enables self-healing
  const validation = validateToolParams(tool, params);
  if (!validation.success) {
    // Return structured error so LLM can self-correct
    return {
      error: validation.error,
      details: validation.details,
      hint: 'Please correct the parameters and try again'
    };
  }

  const handler = TRPC_HANDLERS[tool.endpoint.operationId];
  if (!handler) throw new Error(`No TRPC handler for ${tool.endpoint.operationId}`);

  // If dry run requested and supported, add dryRun flag
  const finalParams = options?.dryRun && tool.metadata.supportsDryRun
    ? { ...validation.data, dryRun: true }
    : validation.data;

  return handler(caller, finalParams);
}

// HTTP execution with validation (external integrations, SDK, testing)
export async function executeViaHTTP(
  tool: GeneratedAITool,
  params: unknown,
  baseUrl: string,
  authToken: string,
  options?: { dryRun?: boolean }
): Promise<unknown> {
  // Validate parameters first
  const validation = validateToolParams(tool, params);
  if (!validation.success) {
    return {
      error: validation.error,
      details: validation.details,
      hint: 'Please correct the parameters and try again'
    };
  }

  const url = new URL(tool.endpoint.path, baseUrl);

  // Add dryRun query param if requested and supported
  if (options?.dryRun && tool.metadata.supportsDryRun) {
    url.searchParams.set('dryRun', 'true');
  }

  // GET requests use query params, others use body
  if (tool.endpoint.method === 'GET') {
    Object.entries(validation.data as Record<string, unknown>).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, String(v));
    });
  }

  const response = await fetch(url.toString(), {
    method: tool.endpoint.method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: tool.endpoint.method !== 'GET' ? JSON.stringify(validation.data) : undefined
  });

  return response.json();
}

// Unified executor (picks best method based on context)
export async function executeTool(
  toolName: string,
  params: unknown,
  context: { caller?: Caller; baseUrl?: string; authToken?: string },
  options?: { dryRun?: boolean }
): Promise<unknown> {
  const tool = getToolByName(toolName);
  if (!tool) throw new Error(`Unknown tool: ${toolName}`);

  // Prefer TRPC if caller available (server-side)
  if (context.caller) {
    return executeViaTRPC(tool, params, context.caller, options);
  }

  // Fall back to HTTP (client-side or external)
  if (context.baseUrl && context.authToken) {
    return executeViaHTTP(tool, params, context.baseUrl, context.authToken, options);
  }

  throw new Error('No execution context provided');
}

// Preview/dry-run helper for high-risk actions
export async function previewAction(
  toolName: string,
  params: unknown,
  context: { caller?: Caller; baseUrl?: string; authToken?: string }
): Promise<unknown> {
  const tool = getToolByName(toolName);
  if (!tool) throw new Error(`Unknown tool: ${toolName}`);

  if (!tool.metadata.supportsDryRun) {
    throw new Error(`Tool ${toolName} does not support dry run previews`);
  }

  return executeTool(toolName, params, context, { dryRun: true });
}
```

#### Usage Examples

```typescript
// Internal AI chat (server-side API route)
const result = await executeTool('list_customers', { search: 'Acme' }, { caller });

// External SDK or client integration
const result = await executeTool('list_customers', { search: 'Acme' }, {
  baseUrl: 'https://api.glapi.io',
  authToken: userToken
});
```

### Phase 5: Guardrails Integration

Replace manual intent lookup with generated tool metadata:

```typescript
// Before (manual)
const intent = getIntentByMcpTool(toolName);
if (intent.riskLevel === 'HIGH') { ... }

// After (generated)
const tool = AI_TOOLS.find(t => t.functionDeclaration.name === toolName);
if (tool.metadata.riskLevel === 'HIGH') { ... }
```

---

## User Experience

### For End Users (No Change)

The chat experience remains identical:
- "List all customers" → AI lists customers
- "Create invoice for Acme" → Confirmation dialog → Invoice created
- Risk-based confirmations work the same way

### For Developers (Improved)

**Adding a new AI capability:**

Before (Current):
1. Add TRPC router procedure
2. Add intent to `intents.ts` (50+ lines)
3. Add tool mapping in `trpc-mcp-client.ts` (20+ lines)
4. Test all three layers

After (Proposed):
1. Add TRPC router procedure with `x-ai-*` annotations
2. Run `pnpm generate:ai-tools`
3. Done - AI capability automatically available

**Example workflow:**

```typescript
// packages/trpc/src/routers/customers.ts
export const customersRouter = router({
  list: authenticatedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/customers',
        // AI extensions - this is all you need!
        'x-ai-tool': { name: 'list_customers', enabled: true },
        'x-ai-risk': { level: 'LOW' },
        'x-ai-permissions': { required: ['read:customers'] }
      }
    })
    .input(listCustomersSchema)
    .query(...)
});
```

### For Operations/Security (Enhanced)

- Complete audit trail of AI capabilities in version control
- Single place to enable/disable AI features
- Clear visibility into risk levels and permission requirements
- API spec can be reviewed by security team

---

## Implementation Plan

### Stage 1: Foundation
**Goal**: Define the extension schema and type system

1. Create `packages/trpc/src/ai-extensions.ts`:
   - Zod schemas for `x-ai-tool`, `x-ai-risk`, `x-ai-permissions`, etc.
   - TypeScript interfaces for generated tools
   - Validation functions

2. Update `packages/trpc/src/openapi-generator.ts`:
   - Parse AI extensions from router metadata
   - Include extensions in generated OpenAPI spec

### Stage 2: Generator
**Goal**: Build the AI tool generation pipeline

1. Create `packages/trpc/scripts/generate-ai-tools.ts`:
   - Read OpenAPI spec from `apps/docs/public/api/openapi.json`
   - Extract operations with `x-ai-tool` extensions
   - Generate `tools.ts` (function declarations + metadata)
   - Generate `executor.ts` (TRPC handlers + HTTP methods)

2. Add scripts to `packages/trpc/package.json`:
   ```json
   "generate:ai-tools": "tsx scripts/generate-ai-tools.ts",
   "generate:api": "pnpm generate-openapi && pnpm generate:ai-tools"
   ```

3. Create `packages/trpc/scripts/watch-ai-tools.ts` for dev mode

### Stage 3: Full Migration
**Goal**: Convert all 50+ intents to OpenAPI extensions

1. Annotate all routers in `packages/trpc/src/routers/`:
   - Add `x-ai-tool` to each AI-enabled procedure
   - Add `x-ai-risk` with risk levels from current intents
   - Add `x-ai-permissions` from current permission requirements

2. Run generator to create initial `generated/` files

3. Update consumers to use generated tools:
   - `guardrails.ts`: Import `AI_TOOLS` instead of `INTENT_CATALOG`
   - `gemini-conversational-service.ts`: Use generated function declarations
   - `action-executor.ts`: Use generated executor
   - `trpc-mcp-client.ts`: Delegate to generated executor

### Stage 4: Auto-Sync Integration
**Goal**: Ensure tools stay in sync automatically

1. Update `turbo.json` with generation pipeline
2. Add pre-commit hook for generation verification
3. Add CI check that fails if generated files are stale
4. Document the regeneration workflow

### Stage 5: Cleanup & Documentation
**Goal**: Remove legacy code and document new system

1. Remove `apps/web/src/lib/ai/intents.ts`
2. Simplify `trpc-mcp-client.ts` to thin wrapper
3. Update tests to use generated tools
4. Create `docs/ai-openapi-extensions.md` developer guide
5. Update README with new workflow

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `packages/trpc/src/ai-extensions.ts` | Extension type definitions & Zod schemas |
| `packages/trpc/scripts/generate-ai-tools.ts` | AI tool generator script |
| `packages/trpc/scripts/watch-ai-tools.ts` | Dev file watcher for auto-regen |
| `apps/web/src/lib/ai/generated/tools.ts` | Generated tool definitions |
| `apps/web/src/lib/ai/generated/executor.ts` | Generated TRPC+HTTP executor |
| `apps/web/src/lib/ai/generated/index.ts` | Generated module exports |
| `docs/ai-openapi-extensions.md` | Extension schema documentation |

### Modified Files
| File | Changes |
|------|---------|
| `packages/trpc/src/openapi-generator.ts` | Add AI extension parsing & output |
| `packages/trpc/src/routers/*.ts` | Add `x-ai-*` metadata to procedures |
| `packages/trpc/package.json` | Add `generate:ai-tools` script |
| `turbo.json` | Add generation pipeline |
| `apps/web/src/lib/ai/guardrails.ts` | Import from generated, remove intent lookup |
| `apps/web/src/lib/ai/gemini-conversational-service.ts` | Use generated function declarations |
| `apps/web/src/lib/ai/action-executor.ts` | Use generated executor |
| `apps/web/src/lib/ai/trpc-mcp-client.ts` | Simplify to use generated executor |
| `.husky/pre-commit` | Add generation verification |

### Files to Remove
| File | Reason |
|------|--------|
| `apps/web/src/lib/ai/intents.ts` | Replaced by `generated/tools.ts` |

### Generated Files (Do Not Edit)
| File | Contents |
|------|----------|
| `apps/web/src/lib/ai/generated/tools.ts` | AI_TOOLS array with 40+ tool definitions |
| `apps/web/src/lib/ai/generated/executor.ts` | TRPC_HANDLERS mapping + execute functions |
| `apps/web/src/lib/ai/generated/index.ts` | Re-exports for clean imports |

---

## Verification Plan

### Build-Time Validation
```bash
# Generate OpenAPI spec
pnpm --filter @glapi/trpc generate-openapi

# Generate AI tools from spec
pnpm --filter @glapi/trpc generate-ai-tools

# Verify TypeScript compiles
pnpm type-check

# Run AI-related tests
pnpm test --filter="**/ai/**"
```

### Runtime Testing
1. Start dev server: `pnpm dev`
2. Open chat assistant in web app
3. Test queries:
   - "List all customers" → Should return customer list
   - "Create a customer named Test Corp" → Should show confirmation
   - "Show me invoices" → Should return invoice list
4. Verify guardrails:
   - Test with viewer role → Should block write operations
   - Test rate limiting → Should throttle after limit

### Integration Tests
```bash
# Run existing AI tests
pnpm --filter web test:run -- src/lib/ai
```

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Execution Strategy** | Both HTTP + TRPC | HTTP for external integrations/SDK, TRPC for internal AI (performance) |
| **Migration Approach** | Full migration + auto-sync | Complete conversion with automated regeneration on schema changes |
| **Extension Namespace** | `x-ai-*` | Simple, clear, follows OpenAPI extension conventions |
| **Tool Loading** | Dynamic scoping | Reduces context window by ~70%, improves accuracy |
| **Validation Layer** | Zod schemas in executor | Enables LLM self-correction, prevents malformed data reaching DB |
| **High-Risk Actions** | Dry-run simulation | Users see preview before committing, builds trust |

---

## Auto-Sync Mechanism

Critical requirement: AI tools must automatically update when the OpenAPI spec changes.

### Build Pipeline Integration

```bash
# Combined generation command
pnpm generate:api    # Runs both in sequence

# Individual commands
pnpm --filter @glapi/trpc generate-openapi    # Step 1: OpenAPI from routers
pnpm --filter @glapi/trpc generate-ai-tools   # Step 2: AI tools from OpenAPI
```

### File Watcher (Development)

```typescript
// packages/trpc/scripts/watch-ai-tools.ts
import chokidar from 'chokidar';

// Watch for router changes
chokidar.watch('src/routers/**/*.ts', {
  ignoreInitial: true
}).on('change', async (path) => {
  console.log(`Router changed: ${path}`);
  await exec('pnpm generate:api');
  console.log('AI tools regenerated');
});
```

### CI/CD Verification

```yaml
# .github/workflows/ci.yml
- name: Verify AI tools are up-to-date
  run: |
    pnpm generate:api
    git diff --exit-code apps/web/src/lib/ai/generated/
    # Fails if generated files differ from committed
```

### Pre-commit Hook

```bash
# .husky/pre-commit
pnpm generate:api
git add apps/web/src/lib/ai/generated/
```

### Turborepo Integration

```json
// turbo.json
{
  "pipeline": {
    "generate:openapi": {
      "outputs": ["apps/docs/public/api/openapi.json"],
      "inputs": ["packages/trpc/src/routers/**/*.ts"]
    },
    "generate:ai-tools": {
      "dependsOn": ["generate:openapi"],
      "outputs": ["apps/web/src/lib/ai/generated/**"],
      "inputs": ["apps/docs/public/api/openapi.json"]
    },
    "build": {
      "dependsOn": ["generate:ai-tools"]
    }
  }
}
```

---

## Appendix: Sample Annotated OpenAPI Spec

```yaml
openapi: 3.0.3
info:
  title: GLAPI - AI-Enhanced Accounting API
  version: 1.0.0
  x-ai-capabilities:
    enabled: true
    version: 1.0
    defaultScopes: ["global"]  # Tools loaded by default

paths:
  /api/customers:
    get:
      operationId: listCustomers
      summary: List all customers
      x-ai-tool:
        name: list_customers
        description: >
          Retrieve and search customer records. Use search parameter
          for natural language queries like "customers in California"
          or "Acme Corporation".
        scopes: ["global", "sales"]  # Loaded in global + sales contexts
        enabled: true
        exampleUtterances:
          - "List all customers"
          - "Show me customers"
          - "Find customers named Acme"
      x-ai-risk:
        level: LOW
        requiresConfirmation: false
        supportsDryRun: false
      x-ai-permissions:
        required: [read:customers]
        minimumRole: viewer
      x-ai-rate-limit:
        requestsPerMinute: 60
      parameters:
        - name: search
          in: query
          schema:
            type: string
          x-ai-parameter:
            description: Natural language search query
            examples: ["Acme", "California customers"]
      responses:
        200:
          description: Customer list
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CustomerList'

  /api/invoices:
    post:
      operationId: createInvoice
      summary: Create a new invoice
      x-ai-tool:
        name: create_invoice
        description: Create a new customer invoice
        scopes: ["invoicing", "sales"]  # Only loaded in invoicing/sales contexts
        enabled: true
      x-ai-risk:
        level: HIGH
        requiresConfirmation: true
        supportsDryRun: true  # Enables preview before commit
        confirmationMessage: >
          You are about to create an invoice for {customer}
          totaling {amount}. This will affect accounts receivable.
      x-ai-permissions:
        required: [write:invoices]
        minimumRole: accountant
      x-ai-rate-limit:
        requestsPerMinute: 20
      x-ai-financial-limits:
        staff: 10000
        manager: 100000
        accountant: 1000000
      parameters:
        - name: dryRun
          in: query
          description: If true, returns preview without committing
          schema:
            type: boolean
            default: false
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateInvoiceInput'
      responses:
        200:
          description: Invoice created (or preview if dryRun=true)
          content:
            application/json:
              schema:
                oneOf:
                  - $ref: '#/components/schemas/Invoice'
                  - $ref: '#/components/schemas/InvoicePreview'
```
