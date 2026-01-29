# RLS Tier 1 Implementation Context

**Last Updated:** 2026-01-28

This document captures the key context, IDs, and decisions needed to resume RLS implementation work after context compaction.

## Organization Test Data

### Org A - Adteco (Default Test Organization)
```
Organization ID: ba3b8cdf-efc1-4a60-88be-ac203d263fe2
API Key: glapi_test_sk_1234567890abcdef
Subsidiary ID: d90771e4-e372-4089-a567-f2e5684c3427
User ID: api-key-user
```

### Org B - CJD-Consulting (Isolation Test Organization)
```
Organization ID: 456c2475-2277-4d90-929b-ae694a2a8577
API Key: glapi_test_sk_orgb_0987654321fedcba
Subsidiary ID: e5f2c7a8-1234-5678-90ab-cdef12345678
User ID: api-key-user
```

## Key Files

### Migration Files (Completed)
| File | Purpose |
|------|---------|
| `packages/database/drizzle/0053_enable_rls_entities.sql` | RLS for entities table |
| `packages/database/drizzle/0054_enable_rls_departments.sql` | RLS for departments table |

### Test Files (Completed)
| File | Purpose |
|------|---------|
| `tests/rls/entities-isolation.spec.ts` | Verifies customer isolation between orgs |
| `tests/rls/departments-isolation.spec.ts` | Verifies department isolation between orgs |

### API Key Configuration
| File | Purpose |
|------|---------|
| `apps/api/middleware.ts` | Defines API keys and org mappings |

### Test Helpers
| File | Purpose |
|------|---------|
| `tests/helpers/api-client.ts` | TRPC client factory with auth headers |

### Schema Reference
| File | Purpose |
|------|---------|
| `packages/database/drizzle/schema.ts` | Table definitions (check organization_id column type) |

### Playwright Configuration
| File | Purpose |
|------|---------|
| `playwright.config.ts` | Contains 'rls' project for targeted RLS test runs |

## Database Schema Context

### Table Structure for Remaining Tables

**classes** (line 536 in schema.ts):
```typescript
export const classes = pgTable("classes", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: text().notNull(),
  subsidiaryId: uuid("subsidiary_id"),
  isActive: boolean("is_active").default(true),
  code: text(),
  description: text(),
  organizationId: text("organization_id").notNull(),  // TEXT type
});
```

**locations** (line 560 in schema.ts):
```typescript
export const locations = pgTable("locations", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: text().notNull(),
  subsidiaryId: uuid("subsidiary_id"),
  organizationId: text("organization_id").notNull(),  // TEXT type
  // ... address fields
});
```

**subsidiaries** (line 578 in schema.ts):
```typescript
export const subsidiaries = pgTable("subsidiaries", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: text().notNull(),
  parentId: uuid("parent_id"),
  organizationId: text("organization_id").notNull(),  // TEXT type
  // ... other fields
});
```

**accounts** (line 405 in schema.ts):
```typescript
export const accounts = pgTable("accounts", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  organizationId: text("organization_id").notNull(),  // TEXT type
  accountNumber: text("account_number").notNull(),
  accountName: text("account_name").notNull(),
  // ... other fields
});
```

**Important:** Note that some tables use `text("organization_id")` (TEXT type) while others use UUID. For tables with TEXT type, no casting is needed in the RLS policy.

## Beads Issue Tracking

| Bead ID | Table | Status | Notes |
|---------|-------|--------|-------|
| glapi-qztx | Epic | open | Parent epic for all RLS work |
| glapi-j530 | classes | in_progress | Next up |
| glapi-4wby | locations | in_progress | After classes |
| glapi-8yvb | subsidiaries | in_progress | After locations |
| glapi-fivr | accounts | in_progress | After subsidiaries |

## Key Discoveries from Initial Work

### 1. Middleware Header Override Issue
**Problem:** The API middleware was overwriting x-organization-id header with the API key's hardcoded org, making isolation tests impossible.
**Solution:** Added second API key for Org B in `apps/api/middleware.ts`:
```typescript
const VALID_API_KEYS = {
  'glapi_test_sk_1234567890abcdef': { organizationId: 'ba3b8cdf-...' }, // Org A
  'glapi_test_sk_orgb_0987654321fedcba': { organizationId: '456c2475-...' }, // Org B
};
```

### 2. UUID vs TEXT Type Casting
**Finding:** Some tables have UUID type for organization_id, others have TEXT.
**Solution:** When organization_id is UUID, cast to text: `organization_id::text = current_setting(...)`
When organization_id is TEXT, no casting needed: `organization_id = current_setting(...)`

### 3. FORCE ROW LEVEL SECURITY
**Finding:** `ENABLE ROW LEVEL SECURITY` alone may not apply to table owners.
**Solution:** Add `FORCE ROW LEVEL SECURITY` to ensure RLS applies to all users including owner.

### 4. Playwright RLS Project
**Finding:** Needed targeted test execution for RLS tests.
**Solution:** Added 'rls' project to playwright.config.ts:
```typescript
{
  name: 'rls',
  testMatch: /tests\/rls\/.*\.spec\.ts/,
  use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
  dependencies: ['setup'],
}
```

## Commands Quick Reference

### Apply Migration
```bash
source .env && psql "${DATABASE_ADMIN_URL}" -f packages/database/drizzle/00XX_enable_rls_[table].sql
```

### Run Single RLS Test
```bash
pnpm exec playwright test tests/rls/[table]-isolation.spec.ts --project=rls
```

### Run All RLS Tests
```bash
pnpm exec playwright test --project=rls
```

### Check Bead Status
```bash
bd list --status in_progress
```

### Close Bead
```bash
bd close glapi-XXXX --reason "Completed"
```

## Environment Variables Required

Ensure `.env` contains:
```
DATABASE_ADMIN_URL=postgresql://admin:password@localhost:5432/glapi
```

## Related Skills and Guides

- `/Users/fredpope/Development/glapi/.claude/skills/glapi-rls-guide.md` - Comprehensive RLS implementation guide
- `/Users/fredpope/Development/glapi/.claude/skills/glapi-backend-guidelines.md` - Backend patterns including contextual DB
