# Integration: caret-fast ↔ glapi

**Status:** Draft — design phase, no code shipped yet
**Owner (caret-fast side):** Fred Pope
**Owner (glapi side):** TBD
**Last updated:** 2026-05-24

---

## 1. Purpose

caret-fast is adopting glapi as its **ASC 606 revenue engine**. This document is the integration contract between the two systems. It exists in the glapi repo so anyone working on glapi can see what caret-fast depends on and what glapi-side work is required to make the integration possible.

### Why we picked glapi over building in caret-fast

caret-fast has the skeleton (contracts, performance obligations, revenue schedules) but no working modification engine. glapi already has:

- Explicit ASC 606 treatment classification (separate contract / cumulative catch-up / prospective / blend-and-extend)
- Per-treatment impact calculation (`calculateCumulativeCatchUpImpact`, `calculateProspectiveImpact`, `calculateSeparateContractImpact`)
- Subscription versions with full JSONB snapshots
- SSP evidence model separate from line items
- Approval workflow

Building the same engine again would be redundant. glapi has gaps (distinct test, contract combination, GL posting) but those are smaller than starting over.

---

## 2. Division of responsibilities

| Concern | Owner | Notes |
|---|---|---|
| Subscriptions, contract modifications, performance obligations, revenue schedules, SSP, journal entry calculation | **glapi** | System of record for all ASC 606 state |
| Customers, products/items (caret-fast catalog), orders, communications, admin UI | **caret-fast** | |
| NetSuite I/O (read for seed, write for journal push) | **caret-fast** | glapi has no NetSuite connector and is not getting one |
| Identity mapping (caret-fast customer/product IDs ↔ glapi entityId/itemId) | **caret-fast** | Mapping tables live in caret-fast DB |
| Auth, org context, API keys | Both | API keys live in caret-fast's Vercel env; glapi validates |

---

## 3. Architecture

```
┌─────────────┐         ┌──────────────────────┐         ┌─────────────┐
│  NetSuite   │◄────────│      caret-fast      │────────►│    glapi    │
│  (legacy)   │  seed   │  • UI / admin        │ HTTPS   │  • ASC 606  │
│             │   +     │  • orders, comms     │ +SDK    │    engine   │
│             │  push   │  • identity mapping  │         │  • subs SOR │
└─────────────┘ journal │  • NS gateway        │         │  • POs, RS  │
                 entries└──────────────────────┘         └─────────────┘
```

**Flow at a glance:**

1. **Seed**: caret-fast reads existing NetSuite contracts → maps customers/items to glapi → creates subscriptions in glapi
2. **Modifications**: caret-fast UI captures change → previews via glapi → user confirms → applies via glapi
3. **Display**: caret-fast renders revenue schedules and POs by reading glapi
4. **GL push**: caret-fast cron pulls new journal entries from glapi → posts to NetSuite with idempotency keys

---

## 4. Glapi-side prep required before integration

These are tasks that must be done in the glapi repo before caret-fast can build against the integration. Each should be filed as a glapi-side issue.

### 4.1 Publish `@glapi/sdk` to private npm registry

**Current state:** SDK exists at `packages/sdk/`, version `0.1.0`, not published anywhere.

**Required:**

- Decide registry (GitHub Packages, npm private, Verdaccio, AWS CodeArtifact)
- Set up publish credentials in glapi CI
- Add `prepublishOnly` and version-bump tooling (changesets recommended)
- Publish first version (`0.1.0` or `1.0.0-alpha.1`)
- Document install: `pnpm add @glapi/sdk` with registry config

**Acceptance:** caret-fast can `pnpm add @glapi/sdk` and import `configure`, `SubscriptionsService`, `RevenueService` etc.

### 4.2 Add ASC 606 routes to the OpenAPI spec and regenerate SDK

**Gap:** The actual ASC 606 routes (which caret-fast needs) are NOT in the generated SDK today. The SDK is generated from `apps/docs/public/api/openapi.json`, which currently covers only the standard CRUD endpoints.

**Routes that exist but aren't in the SDK:**

- `POST /api/revenue/asc606/sales-orders` — create sales order + revenue plan
- `GET /api/revenue/asc606/sales-orders/{salesOrderId}/plan`
- `GET /api/revenue/asc606/subscriptions/{subscriptionId}/plan`
- `POST /api/revenue/asc606/subscriptions/{subscriptionId}/license-changes/preview`
- `POST /api/revenue/asc606/subscriptions/{subscriptionId}/license-changes/apply`

**Required:**

- Add OpenAPI definitions for these 5 routes with full request/response schemas
- Regenerate SDK (`pnpm --filter @glapi/sdk generate && pnpm --filter @glapi/sdk build`)
- Verify generated services include `RevenueAsc606Service` or similar
- Publish new SDK version

**Acceptance:** caret-fast can call `RevenueAsc606Service.previewLicenseChange({ subscriptionId, body: { itemId, action, quantity, ... } })` in a typed manner.

### 4.3 Confirm API key auth path works through the SDK

**Current state:** SDK config (`packages/sdk/src/index.ts`) sets `OpenAPI.TOKEN` and was written assuming Clerk Bearer tokens. Fastify backend at `apps/api-fastify/src/auth.ts` supports API key auth via `Authorization: Bearer <key>` or `x-api-key` header (key format `glapi_<env>_sk_<random>`).

**Required:**

- Verify that setting `OpenAPI.TOKEN = "glapi_prod_sk_xxx"` produces a request with `Authorization: Bearer glapi_prod_sk_xxx` that the Fastify auth middleware accepts
- If not, add an SDK config path for API key (e.g., `configure({ apiKey: "..." })`) that sets `OpenAPI.HEADERS = { Authorization: "Bearer <key>" }`
- Document for caret-fast which form is canonical

**Acceptance:** caret-fast wrapper code can authenticate with one of: `configure({ token: "<api_key>" })` or `configure({ apiKey: "<api_key>" })` and reach any endpoint with no further auth setup per call.

### 4.4 Provision API keys for caret-fast environments

**Required:**

- Generate API keys for: `caret-fast-dev`, `caret-fast-preview`, `caret-fast-prod`
- Each key tied to the correct glapi `organizationId`
- Document how to rotate
- Hand off keys to caret-fast owner via secure channel

**Acceptance:** caret-fast has 3 API keys stored in Vercel env vars, and each can authenticate against the correct glapi environment.

### 4.5 Confirm or build entity/item creation endpoints

**Caret-fast needs to create entities (customers) and items (products) in glapi** when seeding from NetSuite, since glapi has no NetSuite connector.

**Required:**

- Confirm `POST /api/customers` (or whatever endpoint maps to `entities`) is callable with org context and returns a glapi `entityId` (UUID)
- Confirm `POST /api/items` is callable and returns a glapi `itemId` (UUID)
- Confirm both accept idempotency (so a re-seed doesn't create duplicates) — either via `externalReference` field, a unique key on a caret-fast-supplied identifier, or a "find or create" mode
- If no idempotency support exists, add it (acceptance below)

**Acceptance:** caret-fast can call create-customer and create-item repeatedly with the same external reference and receive the same UUID back without creating duplicates.

### 4.6 (Optional, phase 2) Webhook or polling endpoint for new journal entries

For the GL push to NetSuite, caret-fast needs to discover newly created journal entries in glapi.

**Required (phase 2):**

- Option A: caret-fast polls `GET /api/revenue/journal-entries?status=draft&since=<timestamp>`
- Option B: glapi emits a webhook on journal entry creation to a caret-fast-owned endpoint

Either is acceptable. Polling is simpler for phase 2; webhook is better long term.

---

## 5. Auth & environment

| Variable | Purpose | Example |
|---|---|---|
| `GLAPI_BASE_URL` | Base URL for glapi API in this environment | `https://api.glapi.example/api` |
| `GLAPI_API_KEY` | API key issued by glapi to this caret-fast environment | `glapi_prod_sk_xxxxxxxxxxxx` |
| `GLAPI_ORGANIZATION_ID` | glapi org UUID that caret-fast tenant maps to | `e8b1c…` |

Headers caret-fast sends with every glapi request:

- `Authorization: Bearer <GLAPI_API_KEY>`
- `x-organization-id: <GLAPI_ORGANIZATION_ID>`
- `x-user-id: <caret-fast actor user id>` — for audit trail on glapi side
- `x-idempotency-key: <uuid>` — on mutations, to allow safe retry

---

## 6. Identity model

caret-fast and glapi have separate databases. Identity is mapped in caret-fast via the existing **Application Connector Framework (ACF) ledger** — the `connector_entity_mappings` table at `packages/database/src/schema/connectorEntityMappings.ts`.

This is the same pattern caret-fast already uses for NetSuite, Stripe, Salesforce, and Zendesk. No dedicated glapi tables are introduced.

**Mapping rows for the glapi integration:**

| Column | Customer mapping | Product mapping |
|---|---|---|
| `organizationId` | caret-fast org UUID | caret-fast org UUID |
| `masterId` | caret-fast customer UUID | caret-fast product UUID |
| `connectorName` | `'glapi'` | `'glapi'` |
| `entityName` | `'entity'` | `'item'` |
| `entityId` | glapi entityId (UUID as text) | glapi itemId (UUID as text) |

**Properties:**

- Mapping is created on first push to glapi via `GlapiIdentityMapper` service
- Subsequent glapi calls translate caret-fast IDs → glapi UUIDs via a lookup on `(organizationId, connectorName, entityName, masterId)`
- glapi never sees caret-fast IDs; caret-fast never displays glapi UUIDs
- `masterId` doubles as the linkage point for cross-system identity: the same `masterId` can have mapping rows for `connectorName='netsuite'`, `'stripe'`, `'glapi'`, etc., letting us join across systems when needed (e.g., reconciling glapi journal entries against NetSuite GL posts)
- The existing unique constraint `(organizationId, connectorName, entityName, entityId)` prevents duplicate glapi entity registrations

---

## 7. Endpoint contracts caret-fast depends on

These are the endpoints caret-fast will call. Request/response shapes below match what's in `tests/karate/asc606-revenue.feature` and the route handlers under `apps/api/app/api/revenue/asc606/`.

### 7.1 Create sales order + initial revenue plan

**`POST /api/revenue/asc606/sales-orders`**

Used by caret-fast during NetSuite seed (one call per existing contract).

Request:

```json
{
  "order": {
    "subsidiaryId": "uuid",
    "entityId": "uuid",
    "orderDate": "2026-01-01",
    "currencyCode": "USD",
    "lines": [
      {
        "itemId": "uuid",
        "description": "Software License Seats",
        "quantity": 10,
        "unitPrice": 120,
        "revenueBehavior": "over_time",
        "sspAmount": 130,
        "listPrice": 120,
        "metadata": {
          "serviceStartDate": "2026-01-01",
          "serviceEndDate": "2026-12-31"
        }
      }
    ]
  },
  "revenuePlan": {
    "billingFrequency": "monthly",
    "termMonths": 12,
    "autoActivateSubscription": true,
    "recognitionEffectiveDate": "2026-01-01"
  }
}
```

Response (201):

```json
{
  "order": { "id": "uuid", "...": "..." },
  "subscription": { "id": "uuid", "...": "..." },
  "plan": {
    "summary": { "totalScheduled": 1200, "totalRecognized": 0, "...": "..." },
    "obligations": [{ "id": "uuid", "...": "..." }],
    "schedules": [{ "id": "uuid", "periodStart": "...", "scheduledAmount": 100 }],
    "waterfall": [{ "period": "2026-01", "scheduled": 100, "recognized": 0 }]
  }
}
```

### 7.2 Preview license change

**`POST /api/revenue/asc606/subscriptions/{subscriptionId}/license-changes/preview`**

Used by caret-fast UI when user is editing a subscription, before they confirm.

Request:

```json
{
  "itemId": "uuid",
  "action": "add" | "remove",
  "quantity": 5,
  "unitPrice": 120,
  "effectiveDate": "2026-04-01",
  "reason": "Upsell 5 seats"
}
```

Response (200):

```json
{
  "baseline": { "summary": "...", "schedules": [], "obligations": [] },
  "scenario": { "summary": "...", "schedules": [], "obligations": [] },
  "delta": {
    "transactionPrice": 600,
    "treatmentClassification": "prospective" | "separate_contract" | "cumulative_catchup",
    "...": "..."
  }
}
```

### 7.3 Apply license change

**`POST /api/revenue/asc606/subscriptions/{subscriptionId}/license-changes/apply`**

Same request shape as preview. Mutates state and returns the new plan.

Response (200):

```json
{
  "subscription": { "id": "uuid", "...": "..." },
  "calculation": { "...": "..." },
  "plan": {
    "summary": { "totalScheduled": "..." },
    "obligations": [],
    "schedules": [],
    "waterfall": []
  }
}
```

### 7.4 Get subscription plan

**`GET /api/revenue/asc606/subscriptions/{subscriptionId}/plan`**

Used by caret-fast subscription tab to render current state.

### 7.5 Standard CRUD (already in SDK)

- `POST /api/customers` — create entity
- `POST /api/items` — create item
- `GET /api/subscriptions/{id}` — read subscription
- `GET /api/revenue/schedules` — list schedules

---

## 8. caret-fast-side work (out of scope for this doc, but listed for context)

This is what caret-fast will build in its own repo. Listed here so glapi-side reviewers can see how the contract is consumed, not as a task list for glapi.

- `packages/glapi-client` — typed wrapper around `@glapi/sdk` injecting auth/org/idempotency
- `glapi_entity_map` and `glapi_item_map` tables + Drizzle schema
- `GlapiIdentityMapper` service
- `NetsuiteToGlapiSeedService` — reads NS contracts, calls 7.1 per contract
- `GlapiSubscriptionReader` — reads 7.4 for display
- `Customer_SubscriptionTab` real UI (currently placeholder) — calls 7.2/7.4
- `/api/health/glapi` healthcheck

caret-fast tracks these tasks in its own `bd` issue tracker under a "Integrate glapi as ASC 606 revenue engine" epic.

---

## 9. Out of scope (for now)

- GL push to NetSuite from caret-fast (phase 2)
- Glapi distinct-test improvement (already a known gap in glapi, not blocking integration)
- Glapi contract combination (ASC 606-10-25-9) — same
- Multi-currency support
- Fiscal period locking on glapi side

---

## 10. Open questions

1. **Does glapi's `POST /api/customers` accept an idempotency key or external reference for safe re-seed?** If not, caret-fast risks creating duplicates on re-run. (See 4.5.)
2. **Does the SDK accept API key auth as currently written, or does it need a config branch?** (See 4.3.)
3. **Is `subsidiaryId` required on sales order creation?** caret-fast may not have a meaningful subsidiary mapping for all NS contracts.
4. **What happens to a subscription in glapi when a NetSuite contract is voided after seed?** Cascade delete? Cancel? Manual reconciliation?
5. **Webhook vs. polling for journal entries** (phase 2) — preference?

Answers go inline in this doc as they're resolved.

---

## 11. Change log

| Date | Change | Author |
|---|---|---|
| 2026-05-24 | Initial draft | Fred Pope |
