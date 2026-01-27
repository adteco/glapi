---
name: glapi-rls-guide
description: Row Level Security (RLS) implementation guide for GLAPI multi-tenant database isolation. Covers PostgreSQL RLS policies, session variables, contextual database connections, tRPC middleware, and common troubleshooting. Use when working with RLS, multi-tenancy, organization isolation, database security, or debugging RLS policy violations.
---

# GLAPI Row Level Security (RLS) Guide

## Purpose

This skill documents how Row Level Security is implemented in GLAPI to ensure multi-tenant data isolation. All database tables containing organization-specific data use RLS policies to prevent cross-tenant data access.

## Architecture Overview

### Flow Summary

```
Request → tRPC Middleware → Set Session Variable → RLS Policy Check → Query Execution
```

1. **Clerk Auth** provides organization ID (resolved to database UUID)
2. **tRPC middleware** creates contextual DB connection with session variable set
3. **PostgreSQL RLS policies** check `current_setting('app.current_organization_id')` against row's `organization_id`
4. **Queries filtered** automatically - users only see their organization's data

## Key Components

### 1. Session Variable

The foundation of RLS is the PostgreSQL session variable:

```sql
-- Set on each connection before queries
SELECT set_config('app.current_organization_id', '<uuid>', false);
```

- Must be a valid UUID (database organization ID, NOT Clerk org ID)
- Set per-connection, persists for connection lifetime
- Retrieved via `current_setting('app.current_organization_id', true)`

### 2. RLS Policy Pattern

**IMPORTANT**: Policies must use `current_setting()` directly, NOT the `get_current_organization_id()` function for INSERT operations:

```sql
-- CORRECT: Use current_setting directly
CREATE POLICY "org_isolation_insert_tablename" ON tablename
  FOR INSERT WITH CHECK (
    organization_id::text = current_setting('app.current_organization_id', true)
  );

-- For SELECT/UPDATE/DELETE, either works but direct is safer
CREATE POLICY "org_isolation_select_tablename" ON tablename
  FOR SELECT USING (
    organization_id::text = current_setting('app.current_organization_id', true)
  );
```

**Why cast to text?** The `organization_id` column may be UUID type, but `current_setting()` returns text. Casting both to text ensures consistent comparison.

### 3. Context Module (`packages/database/src/context.ts`)

Primary functions for RLS context:

```typescript
// Create a contextual DB with RLS set (used by tRPC)
const { db, release, client } = await createContextualDb({
  organizationId: 'uuid-here',
  userId: 'user-uuid',
});

// For one-off operations with automatic cleanup
await withOrganizationContext(
  { organizationId: 'uuid' },
  async (db) => {
    return db.select().from(table);
  }
);

// For transactions
await withOrganizationContextTransaction(
  { organizationId: 'uuid' },
  async (db) => {
    await db.insert(table).values({...});
  }
);
```

### 4. tRPC Middleware (`packages/trpc/src/trpc.ts`)

The `authenticatedProcedure` middleware:
1. Validates user has organizationId
2. Validates organizationId is UUID format
3. Creates contextual DB connection
4. **Verifies** RLS context was set correctly
5. Passes `ctx.db` (RLS-protected) to procedures
6. Releases connection in finally block

## Common Issues & Solutions

### Issue: "new row violates row-level security policy"

**Cause**: The session variable value doesn't match the `organization_id` being inserted.

**Debug Steps**:
1. Check what's being inserted vs what's in session:
```typescript
// Add debug in repository
const check = await this.db.execute(
  sql`SELECT current_setting('app.current_organization_id', true) as rls_org`
);
console.log('RLS org:', check.rows[0]?.rls_org);
console.log('Inserting org:', organizationId);
```

2. Verify the repository is using `ctx.db` not global `db`:
```typescript
// In service constructor - MUST pass options.db
this.repository = new SomeRepository(options.db);

// In router - MUST pass ctx.db
const service = new SomeService(ctx.serviceContext, { db: ctx.db });
```

### Issue: RLS policies blocking all operations

**Cause**: Session variable not set (returns NULL).

**Solution**: Ensure repository receives contextual db:
```typescript
// BaseRepository falls back to globalDb if no db passed
constructor(db?: ContextualDatabase) {
  this.db = db ?? globalDb; // globalDb has NO RLS context!
}
```

### Issue: Function type mismatch

**Cause**: `get_current_organization_id()` returns UUID, but comparison fails.

**Solution**: Use `current_setting()` directly in policies:
```sql
-- Instead of: get_current_organization_id()::text
-- Use: current_setting('app.current_organization_id', true)
```

## Creating RLS for New Tables

### Step 1: Enable RLS on table

```sql
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
ALTER TABLE new_table FORCE ROW LEVEL SECURITY;
```

### Step 2: Create policies

```sql
-- SELECT
CREATE POLICY "org_isolation_select_new_table" ON new_table
  FOR SELECT USING (
    organization_id::text = current_setting('app.current_organization_id', true)
  );

-- INSERT
CREATE POLICY "org_isolation_insert_new_table" ON new_table
  FOR INSERT WITH CHECK (
    organization_id::text = current_setting('app.current_organization_id', true)
  );

-- UPDATE
CREATE POLICY "org_isolation_update_new_table" ON new_table
  FOR UPDATE
  USING (organization_id::text = current_setting('app.current_organization_id', true))
  WITH CHECK (organization_id::text = current_setting('app.current_organization_id', true));

-- DELETE
CREATE POLICY "org_isolation_delete_new_table" ON new_table
  FOR DELETE USING (
    organization_id::text = current_setting('app.current_organization_id', true)
  );
```

### Step 3: Create migration file

Add to `packages/database/drizzle/NNNN_tablename_rls.sql`

## Repository Pattern Requirements

Every repository that accesses RLS-protected tables MUST:

1. Accept optional `db` in constructor
2. Use `this.db` for all queries (not imported global db)
3. Be instantiated with `ctx.db` from tRPC context

```typescript
// Repository
export class MyRepository extends BaseRepository {
  constructor(db?: ContextualDatabase) {
    super(db); // BaseRepository sets this.db
  }

  async findAll() {
    return this.db.select().from(myTable); // Uses contextual db
  }
}

// Service
export class MyService extends BaseService {
  private repo: MyRepository;

  constructor(context: ServiceContext, options: { db?: ContextualDatabase } = {}) {
    super(context);
    this.repo = new MyRepository(options.db); // Pass db through!
  }
}

// Router
const service = new MyService(ctx.serviceContext, { db: ctx.db });
```

## Quick Reference

| Component | Location | Purpose |
|-----------|----------|---------|
| Context functions | `packages/database/src/context.ts` | Set session variables |
| tRPC middleware | `packages/trpc/src/trpc.ts` | Create RLS db per request |
| Base repository | `packages/database/src/repositories/base-repository.ts` | Fallback logic |
| Migration files | `packages/database/drizzle/*.sql` | RLS policy definitions |

## Session Variable Reference

| Variable | Purpose |
|----------|---------|
| `app.current_organization_id` | Organization UUID for RLS |
| `app.current_user_id` | User UUID for audit trails |
