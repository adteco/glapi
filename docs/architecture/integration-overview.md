# GLAPI + Magneteco Integration Architecture

## Principle: Right Tool for the Job

| Layer | What It's For | Not For |
|-------|---------------|---------|
| **OpenAPI** | Data access, CRUD, direct operations | Workflows, prompts, context |
| **MCP** | Resources, prompts, multi-step workflows | CRUD (use OpenAPI) |
| **Magneteco** | Orchestration, patterns, context graph | Raw data storage |

## The Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     magic-inbox-processor                           │
│  1. Receive email                                                   │
│  2. AI analysis (document type, entities, amounts)                  │
│  3. Webhook to Magneteco                                            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         MAGNETECO                                   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Integration Registry                                        │   │
│  │  • GLAPI OpenAPI spec (cached)                              │   │
│  │  • 71 discovered operations                                  │   │
│  │  • Auth credentials (vault)                                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                               │                                     │
│  ┌────────────────────────────▼────────────────────────────────┐   │
│  │  Context Graph                                               │   │
│  │  • "Acme Corp invoices → always match PO first"             │   │
│  │  • "Amounts > $10k → require manager approval"              │   │
│  │  • Historical patterns from process mining                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                               │                                     │
│  ┌────────────────────────────▼────────────────────────────────┐   │
│  │  Action Dispatcher                                           │   │
│  │  1. vendors.getByName(invoice.vendorName)     → GLAPI API   │   │
│  │  2. purchaseOrders.match(vendorId, amount)    → GLAPI API   │   │
│  │  3. bills.create({...})                       → GLAPI API   │   │
│  │  4. (if needed) request_approval              → GLAPI MCP   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                               │                                     │
│  ┌────────────────────────────▼────────────────────────────────┐   │
│  │  Pattern Learning                                            │   │
│  │  • Records action sequence as trace                          │   │
│  │  • Mines patterns: invoice → lookup → match → create         │   │
│  │  • Suggests optimizations                                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               │ REST API calls
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           GLAPI                                     │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  OpenAPI Spec (/api/openapi.json)                            │  │
│  │  • 71 operations with x-ai-* extensions                      │  │
│  │  • Source of truth for capabilities                          │  │
│  │  • Self-documenting, versioned                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                               │                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Lean MCP (mcp.glapi.adteco.app)                             │  │
│  │                                                               │  │
│  │  Resources:                                                   │  │
│  │  • glapi://prompts/invoice-processing                        │  │
│  │  • glapi://prompts/po-matching                               │  │
│  │  • glapi://context/pending-approvals                         │  │
│  │                                                               │  │
│  │  Tools (workflows only):                                      │  │
│  │  • process_inbound_document (multi-step orchestration)       │  │
│  │  • suggest_action (context-aware recommendation)             │  │
│  │  • whats_pending (aggregated intelligence)                   │  │
│  │  • request_approval (human-in-the-loop)                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                               │                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  tRPC Backend                                                 │  │
│  │  • Actual business logic                                      │  │
│  │  • Database operations                                        │  │
│  │  • Validation, authorization                                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## What Goes Where

### GLAPI OpenAPI (71 operations)
```
customers.list       vendors.getById      invoices.create
customers.get        vendors.create       invoices.update
customers.create     vendors.update       invoices.delete
customers.update     bills.list           contracts.list
customers.delete     bills.create         ... etc
```

### GLAPI MCP (lean - 6-10 tools)
```
Resources:
  - prompts/invoice-processing
  - prompts/po-matching
  - prompts/vendor-identification
  - context/pending-approvals
  - context/alerts
  - templates/wip-report

Tools:
  - process_inbound_document    (workflow)
  - suggest_action              (intelligence)
  - whats_pending               (aggregation)
  - summarize_entity            (aggregation)
  - request_approval            (human-in-the-loop)
  - reconcile_period            (batch operation)
```

### Magneteco
```
Integration Registry:
  - Stores GLAPI OpenAPI spec URL
  - Caches discovered operations
  - Manages credentials

Context Graph:
  - Vendor-specific handling rules
  - Approval thresholds
  - Historical patterns

Action Dispatcher:
  - Executes GLAPI API calls
  - Handles auth, retries
  - Emits traces for learning

Pattern Mining:
  - Learns action sequences
  - Suggests automation opportunities
  - Builds process graph
```

## Implementation Order

1. **GLAPI: Expose OpenAPI spec endpoint**
   - Already have generator, need to serve it at `/api/openapi.json`

2. **Magneteco: Integration registry schema**
   - Add tables for integrations, discovered_operations
   - Add API routes for CRUD

3. **Magneteco: OpenAPI sync service**
   - Fetch spec, extract operations, store in DB
   - Schedule periodic sync

4. **Magneteco: Action dispatcher**
   - Execute operations via REST
   - Handle auth, retries, caching
   - Emit traces

5. **GLAPI: Lean MCP implementation**
   - Replace current manual tools with resources/prompts
   - Add workflow tools (process_inbound_document, etc.)

6. **Magneteco: Chat interface**
   - `/integrations`, `/operations`, `/test` commands
   - Workflow builder

7. **Wire up magic-inbox-processor**
   - Webhook to Magneteco instead of direct GLAPI
   - Magneteco orchestrates based on context
