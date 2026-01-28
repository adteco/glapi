# RLS Tier 1 Implementation Plan

**Last Updated:** 2026-01-28
**Branch:** working-0127b
**Epic:** glapi-qztx (Enable RLS on all user-facing tables)

## Overview

This document outlines the plan for enabling PostgreSQL Row Level Security (RLS) on Tier 1 tables in the GLAPI multi-tenant application. RLS provides database-level tenant isolation, ensuring that organizations cannot access each other's data even if application-level checks fail.

## Goal

Enable RLS on the six primary user-facing accounting dimension tables:
1. entities (customers/vendors/employees)
2. departments
3. classes
4. locations
5. subsidiaries
6. accounts

## Status Summary

| Table | Migration | Test File | Status |
|-------|-----------|-----------|--------|
| entities | 0053_enable_rls_entities.sql | entities-isolation.spec.ts | ✅ COMPLETE |
| departments | 0054_enable_rls_departments.sql | departments-isolation.spec.ts | ✅ COMPLETE |
| classes | 0055_enable_rls_classes.sql | classes-isolation.spec.ts | ✅ COMPLETE |
| locations | 0056_enable_rls_locations.sql | locations-isolation.spec.ts | ✅ COMPLETE |
| subsidiaries | 0057_enable_rls_subsidiaries.sql | subsidiaries-isolation.spec.ts | ✅ COMPLETE |
| accounts | 0058_enable_rls_accounts.sql | accounts-isolation.spec.ts | ✅ COMPLETE |

**All Tier 1 RLS work completed on 2026-01-28. All 32 tests passing.**

## Implementation Pattern

Each table follows the same implementation pattern:

### Step 1: Create Migration File
Location: `packages/database/drizzle/00XX_enable_rls_[table].sql`

```sql
-- Enable RLS on [table] table
-- organization_id is UUID type, so we cast to text for comparison

-- Step 1: Enable RLS on the table
ALTER TABLE [table] ENABLE ROW LEVEL SECURITY;
ALTER TABLE [table] FORCE ROW LEVEL SECURITY;

-- Step 2: Drop any existing policies (in case of re-run)
DROP POLICY IF EXISTS "org_isolation_select_[table]" ON [table];
DROP POLICY IF EXISTS "org_isolation_insert_[table]" ON [table];
DROP POLICY IF EXISTS "org_isolation_update_[table]" ON [table];
DROP POLICY IF EXISTS "org_isolation_delete_[table]" ON [table];

-- Step 3: Create RLS policies using current_setting() directly
CREATE POLICY "org_isolation_select_[table]" ON [table]
  FOR SELECT USING (
    organization_id::text = current_setting('app.current_organization_id', true)
  );

CREATE POLICY "org_isolation_insert_[table]" ON [table]
  FOR INSERT WITH CHECK (
    organization_id::text = current_setting('app.current_organization_id', true)
  );

CREATE POLICY "org_isolation_update_[table]" ON [table]
  FOR UPDATE
  USING (organization_id::text = current_setting('app.current_organization_id', true))
  WITH CHECK (organization_id::text = current_setting('app.current_organization_id', true));

CREATE POLICY "org_isolation_delete_[table]" ON [table]
  FOR DELETE USING (
    organization_id::text = current_setting('app.current_organization_id', true)
  );
```

### Step 2: Apply Migration
```bash
source .env && psql "${DATABASE_ADMIN_URL}" -f packages/database/drizzle/00XX_enable_rls_[table].sql
```

### Step 3: Create Isolation Test
Location: `tests/rls/[table]-isolation.spec.ts`

The test should verify:
1. Org A can create records and see them
2. Org B cannot see Org A's records via get()
3. Org B cannot see Org A's records via list()
4. Org B cannot update Org A's records
5. Org B cannot delete Org A's records
6. Each organization only sees their own records in list()

### Step 4: Run Tests
```bash
pnpm exec playwright test tests/rls/[table]-isolation.spec.ts --project=rls
```

### Step 5: Commit and Close Bead
```bash
git add packages/database/drizzle/00XX_enable_rls_[table].sql tests/rls/[table]-isolation.spec.ts
git commit -m "feat(rls): enable RLS on [table] table with isolation tests"
bd close glapi-XXXX --reason "Completed"
```

## Key Technical Details

### RLS Session Variable
- The RLS policies use `current_setting('app.current_organization_id', true)` to get the current tenant context
- The application sets this via `SET app.current_organization_id = '<uuid>'` at the start of each request
- The `true` parameter makes the function return NULL instead of erroring if the variable is not set

### Type Casting
- The `organization_id` column is UUID type in most tables
- The session variable is TEXT type
- We cast with `organization_id::text` for comparison

### FORCE ROW LEVEL SECURITY
- Use `ALTER TABLE ... FORCE ROW LEVEL SECURITY` to ensure RLS applies even to table owners
- This is critical for proper isolation in all scenarios

## Dependencies and Prerequisites

1. **Database Admin Access**: Migrations must be run with DATABASE_ADMIN_URL credentials
2. **Org B Setup**: CJD-Consulting organization must exist with:
   - Organization ID: `456c2475-2277-4d90-929b-ae694a2a8577`
   - API Key: `glapi_test_sk_orgb_0987654321fedcba`
   - Subsidiary ID: `e5f2c7a8-1234-5678-90ab-cdef12345678`
3. **API Middleware**: The middleware must set org context from API key (not override with client header)

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing queries | Test each table in isolation before enabling RLS |
| Missing session variable | Use `current_setting(..., true)` to return NULL instead of error |
| Performance impact | RLS adds minimal overhead; index on organization_id already exists |
| Migration rollback | Keep DROP POLICY statements for idempotent reruns |

## Related Documentation

- `/Users/fredpope/Development/glapi/.claude/skills/glapi-rls-guide.md` - Full RLS implementation guide
- `/Users/fredpope/Development/glapi/packages/database/drizzle/0052_fix_projects_rls_policies.sql` - Reference migration

## Next Actions

1. Complete remaining 4 tables (classes, locations, subsidiaries, accounts)
2. Run full RLS test suite to verify all tables
3. Update Beads to mark completed tasks
4. Consider Tier 2 tables for RLS enablement
