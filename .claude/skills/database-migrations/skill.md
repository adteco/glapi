---
name: database-migrations
description: Database schema changes, migrations, and table modifications for GLAPI
version: 1.0.0
---

# Database Migrations Skill

This skill provides guidance for making database schema changes in the GLAPI monorepo.

## Critical Rules

### 1. Never Use Drizzle Kit for Migrations

**Drizzle Kit migrations (`pnpm db:migrate`) are unreliable in this codebase. Always use direct `psql` execution.**

```bash
# WRONG - Don't use this
pnpm db:migrate

# CORRECT - Use psql directly
source .env && psql "$DATABASE_ADMIN_URL" -f packages/database/drizzle/0059_migration.sql
```

### 2. Always Use Admin Database URL

The standard `DATABASE_URL` connects as `glapiuser` with limited permissions. For DDL operations (CREATE, ALTER, DROP), you **must** use `DATABASE_ADMIN_URL`:

```bash
# Source environment variables first
source /path/to/glapi/.env

# Run migration with admin privileges
psql "$DATABASE_ADMIN_URL" -f packages/database/drizzle/NNNN_migration_name.sql
```

### 3. Migration File Location and Naming

All migrations go in `packages/database/drizzle/` with sequential numbering:

```
packages/database/drizzle/
├── 0058_enable_rls_accounts.sql
├── 0059_project_budget_customer_fields.sql
├── 0060_project_types_lookup.sql
└── ...
```

## Creating a New Table

### Step 1: Create the Schema File

Create `packages/database/src/db/schema/my-table.ts`:

```typescript
import { pgTable, uuid, text, boolean, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';

export const myTable = pgTable('my_table', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  code: text('code').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgCodeUnique: uniqueIndex('my_table_org_code_unique').on(table.organizationId, table.code),
}));

export const myTableRelations = relations(myTable, ({ one }) => ({
  organization: one(organizations, {
    fields: [myTable.organizationId],
    references: [organizations.id],
  }),
}));

export type MyTable = typeof myTable.$inferSelect;
export type NewMyTable = typeof myTable.$inferInsert;
```

### Step 2: Export from Schema Index

Add to `packages/database/src/db/schema/index.ts`:

```typescript
import * as myTable from './my-table';

export const schema = {
  // ... existing schemas
  ...myTable,
};

export { myTable } from './my-table';
export type { MyTable, NewMyTable } from './my-table';
```

### Step 3: Create Migration SQL

Create `packages/database/drizzle/NNNN_create_my_table.sql`:

```sql
-- Migration: Create my_table
-- Created: YYYY-MM-DD
-- Description: Creates the my_table lookup table

-- Create the table
CREATE TABLE IF NOT EXISTS "my_table" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "code" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS "my_table_org_code_unique"
  ON "my_table" ("organization_id", "code");

-- Enable RLS
ALTER TABLE "my_table" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "my_table" FORCE ROW LEVEL SECURITY;

-- Drop existing policies (for idempotency)
DROP POLICY IF EXISTS "org_isolation_select_my_table" ON "my_table";
DROP POLICY IF EXISTS "org_isolation_insert_my_table" ON "my_table";
DROP POLICY IF EXISTS "org_isolation_update_my_table" ON "my_table";
DROP POLICY IF EXISTS "org_isolation_delete_my_table" ON "my_table";

-- Create RLS policies
CREATE POLICY "org_isolation_select_my_table" ON "my_table"
  FOR SELECT USING (
    organization_id::text = current_setting('app.current_organization_id', true)
  );

CREATE POLICY "org_isolation_insert_my_table" ON "my_table"
  FOR INSERT WITH CHECK (
    organization_id::text = current_setting('app.current_organization_id', true)
  );

CREATE POLICY "org_isolation_update_my_table" ON "my_table"
  FOR UPDATE
  USING (organization_id::text = current_setting('app.current_organization_id', true))
  WITH CHECK (organization_id::text = current_setting('app.current_organization_id', true));

CREATE POLICY "org_isolation_delete_my_table" ON "my_table"
  FOR DELETE USING (
    organization_id::text = current_setting('app.current_organization_id', true)
  );
```

### Step 4: Run the Migration

```bash
source .env && psql "$DATABASE_ADMIN_URL" -f packages/database/drizzle/NNNN_create_my_table.sql
```

## Adding Columns to Existing Tables

### Step 1: Update Schema TypeScript

Edit the existing schema file in `packages/database/src/db/schema/`.

### Step 2: Create Migration SQL

```sql
-- Migration: Add columns to my_table
-- Created: YYYY-MM-DD

ALTER TABLE "my_table" ADD COLUMN IF NOT EXISTS "new_column" text;
ALTER TABLE "my_table" ADD COLUMN IF NOT EXISTS "another_column" numeric(18, 4);

-- If adding a foreign key
ALTER TABLE "my_table" ADD COLUMN IF NOT EXISTS "related_id" uuid;
ALTER TABLE "my_table" ADD CONSTRAINT "my_table_related_id_fk"
  FOREIGN KEY ("related_id") REFERENCES "related_table"("id") ON DELETE SET NULL;

-- If adding an index
CREATE INDEX IF NOT EXISTS "idx_my_table_new_column" ON "my_table" ("new_column");
```

## Common Errors and Solutions

### "permission denied for schema public"
**Cause:** Using `DATABASE_URL` instead of `DATABASE_ADMIN_URL`
**Fix:** Use admin credentials for DDL operations

### "must be owner of table"
**Cause:** Using `DATABASE_URL` instead of `DATABASE_ADMIN_URL`
**Fix:** Use admin credentials for DDL operations

### "relation does not exist"
**Cause:** Dependent migration not yet run
**Fix:** Run migrations in sequential order

### "duplicate key value violates unique constraint"
**Cause:** Index already exists
**Fix:** Use `IF NOT EXISTS` in index creation

### "policy already exists"
**Cause:** Re-running migration without `DROP POLICY IF EXISTS`
**Fix:** Always include `DROP POLICY IF EXISTS` before `CREATE POLICY`

## Full Stack Changes Checklist

When adding a new table/feature:

1. [ ] Create schema TypeScript file (`packages/database/src/db/schema/`)
2. [ ] Export from schema index
3. [ ] Create migration SQL file
4. [ ] Run migration via psql
5. [ ] Create repository (`packages/database/src/repositories/`)
6. [ ] Export from repository index
7. [ ] Create service (`packages/api-service/src/services/`)
8. [ ] Export from service index
9. [ ] Create tRPC router (`packages/trpc/src/routers/`)
10. [ ] Register router in main router
11. [ ] Build all packages to verify types
