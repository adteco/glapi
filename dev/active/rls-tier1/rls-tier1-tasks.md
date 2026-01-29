# RLS Tier 1 Tasks

**Last Updated:** 2026-01-28

## Completed Tasks

### entities table
- [x] Create migration: `packages/database/drizzle/0053_enable_rls_entities.sql`
- [x] Apply migration via psql with admin credentials
- [x] Create test: `tests/rls/entities-isolation.spec.ts`
- [x] Verify all 5 test cases pass (create, get, list, update, delete isolation)
- [x] Commit changes

### departments table
- [x] Create migration: `packages/database/drizzle/0054_enable_rls_departments.sql`
- [x] Apply migration via psql with admin credentials
- [x] Create test: `tests/rls/departments-isolation.spec.ts`
- [x] Verify all 5 test cases pass
- [x] Commit changes

---

## Completed Tasks (All Done!)

### classes table (glapi-j530) ✅
- [x] Create migration: `packages/database/drizzle/0055_enable_rls_classes.sql`
- [x] Apply migration
- [x] Create test: `tests/rls/classes-isolation.spec.ts`
- [x] All 5 tests passing
- [x] Bead closed

### locations table (glapi-4wby) ✅
- [x] Create migration: `packages/database/drizzle/0056_enable_rls_locations.sql`
- [x] Apply migration
- [x] Create test: `tests/rls/locations-isolation.spec.ts`
- [x] All 5 tests passing
- [x] Bead closed

### subsidiaries table (glapi-8yvb) ✅
- [x] Create migration: `packages/database/drizzle/0057_enable_rls_subsidiaries.sql`
- [x] Apply migration
- [x] Create test: `tests/rls/subsidiaries-isolation.spec.ts`
- [x] All 5 tests passing
- [x] Bead closed

### accounts table (glapi-fivr) ✅
- [x] Create migration: `packages/database/drizzle/0058_enable_rls_accounts.sql`
- [x] Apply migration
- [x] Create test: `tests/rls/accounts-isolation.spec.ts`
- [x] All 5 tests passing (note: accounts uses paginated `.data` response, need limit:100 for tests)
- [x] Bead closed

---

## Final Verification ✅

- [x] Run full RLS test suite: `pnpm exec playwright test --project=rls`
- [x] All 32 tests pass (6 tables × 5 tests + 2 setup = 32)
- [x] Epic bead glapi-qztx closed

---

## Migration Template

For quick copy-paste (remember to replace `[TABLE]`):

```sql
-- Enable RLS on [TABLE] table
-- organization_id is TEXT type in this table

-- Step 1: Enable RLS on the table
ALTER TABLE [TABLE] ENABLE ROW LEVEL SECURITY;
ALTER TABLE [TABLE] FORCE ROW LEVEL SECURITY;

-- Step 2: Drop any existing policies (in case of re-run)
DROP POLICY IF EXISTS "org_isolation_select_[TABLE]" ON [TABLE];
DROP POLICY IF EXISTS "org_isolation_insert_[TABLE]" ON [TABLE];
DROP POLICY IF EXISTS "org_isolation_update_[TABLE]" ON [TABLE];
DROP POLICY IF EXISTS "org_isolation_delete_[TABLE]" ON [TABLE];

-- Step 3: Create RLS policies using current_setting() directly
CREATE POLICY "org_isolation_select_[TABLE]" ON [TABLE]
  FOR SELECT USING (
    organization_id = current_setting('app.current_organization_id', true)
  );

CREATE POLICY "org_isolation_insert_[TABLE]" ON [TABLE]
  FOR INSERT WITH CHECK (
    organization_id = current_setting('app.current_organization_id', true)
  );

CREATE POLICY "org_isolation_update_[TABLE]" ON [TABLE]
  FOR UPDATE
  USING (organization_id = current_setting('app.current_organization_id', true))
  WITH CHECK (organization_id = current_setting('app.current_organization_id', true));

CREATE POLICY "org_isolation_delete_[TABLE]" ON [TABLE]
  FOR DELETE USING (
    organization_id = current_setting('app.current_organization_id', true)
  );
```

---

## Test Template Structure

Each test file should include these 5 test cases:
1. `Org A can create [entity] and Org B cannot see it`
2. `Org B cannot list Org A [entities]`
3. `Org B cannot update Org A [entity]`
4. `Org B cannot delete Org A [entity]`
5. `Each organization only sees their own [entities]`

---

## Troubleshooting Quick Reference

### "permission denied" error
- Ensure migration is run with `DATABASE_ADMIN_URL` (admin credentials)
- Check that RLS policies were created successfully

### Tests fail with "NOT_FOUND" when expected to pass
- Verify the session variable is being set: `current_setting('app.current_organization_id', true)`
- Check that the API is using contextual DB connections

### Tests pass locally but fail in CI
- Ensure Org B subsidiary exists in test database
- Verify both API keys are configured in middleware
