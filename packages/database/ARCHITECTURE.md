# Database Package Architecture

## Overview
This package provides a centralized database access layer using PostgreSQL and Drizzle ORM. It serves as the single source of truth for database schema definitions and connections across the entire application.

## Key Design Decisions

### PostgreSQL with Drizzle ORM
- Using PostgreSQL as the primary database
- Drizzle ORM for type-safe database operations
- Direct connection strategy (no connection pooling middleware)
- Hosted on Vercel Postgres

### Package Structure

packages/database/
├── src/
│   └── db/
│       └── schema.ts    # Database schema definitions
├── migrations/         # Generated SQL migrations
├── index.ts           # Public API exports
└── drizzle.config.ts  # Drizzle configuration


### Schema Design Principles
- Use PostgreSQL-native data types
- Enforce constraints at database level
- Include timestamps for all tables
- Use snake_case for database naming

### Type Safety
- All schemas generate TypeScript types
- Exports are fully typed for consuming applications
- No raw SQL queries without type safety

### Environment Configuration
Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string

## Usage
This package should be imported by other packages/apps that need database access:

typescript
import { db, projects } from '@glapi/database'

## Row-Level Security Architecture

**CRITICAL: This is a multi-tenant accounting system. Data isolation between organizations is mandatory and non-negotiable. Data leakage between tenants is not tolerable.**

The system implements PostgreSQL Row-Level Security (RLS) at the database level for defense-in-depth:

### PostgreSQL RLS Implementation

1. **RLS Enabled with Force**: All multi-tenant tables have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and `ALTER TABLE ... FORCE ROW LEVEL SECURITY`. The FORCE option ensures RLS applies even to table owners.

2. **Session Context**: Organization context is set via PostgreSQL session variables:
   ```sql
   SELECT set_config('app.current_organization_id', '<uuid>', false);
   ```

3. **Context Function**: The `get_current_organization_id()` function retrieves the current organization:
   ```sql
   CREATE OR REPLACE FUNCTION get_current_organization_id()
   RETURNS TEXT AS $$
     SELECT current_setting('app.current_organization_id', true);
   $$ LANGUAGE sql STABLE SECURITY DEFINER;
   ```

4. **Policy Pattern for Tables with organization_id**:
   ```sql
   CREATE POLICY "org_isolation_select_tablename" ON tablename
     FOR SELECT USING (organization_id::text = get_current_organization_id() OR organization_id IS NULL);

   CREATE POLICY "org_isolation_insert_tablename" ON tablename
     FOR INSERT WITH CHECK (organization_id::text = get_current_organization_id());

   CREATE POLICY "org_isolation_update_tablename" ON tablename
     FOR UPDATE USING (organization_id::text = get_current_organization_id())
     WITH CHECK (organization_id::text = get_current_organization_id());

   CREATE POLICY "org_isolation_delete_tablename" ON tablename
     FOR DELETE USING (organization_id::text = get_current_organization_id());
   ```

5. **Join-Based Policies for Child Tables**: Tables secured through parent relationships use helper functions:
   ```sql
   CREATE FUNCTION check_project_task_organization(task_id UUID)
   RETURNS BOOLEAN AS $$
     SELECT EXISTS (
       SELECT 1 FROM project_tasks pt
       JOIN projects p ON pt.project_id = p.id
       WHERE pt.id = task_id
       AND p.organization_id::text = get_current_organization_id()
     );
   $$ LANGUAGE sql STABLE SECURITY DEFINER;
   ```

### Application-Level Enforcement (Defense in Depth)

In addition to database RLS, the application layer provides:

1. **Organization Isolation**: Every major table has an `organization_id` column that links records to a specific organization
2. **Authentication**: Clerk provides the authenticated user's organization ID, which is resolved to a database UUID
3. **Contextual Database Connection**: The `createContextualDb()` function creates database connections with RLS context already set
4. **RLS Verification**: The tRPC middleware verifies that RLS context was properly established before proceeding
5. **Repository Pattern**: Repository methods provide additional filtering as a fallback safety measure

### Tables with RLS Enabled

All of the following tables have RLS enabled with FORCE and appropriate policies:
- workflows, workflow_steps, workflow_instances, workflow_step_instances
- accounting_periods, contracts, entity_tasks
- gl_account_balances, gl_transactions
- labor_cost_rates, task_field_definitions, task_templates
- time_entries, time_entry_batches
- departments, activity_codes, revenue_recognition_patterns, ssp_evidence
- project_tasks (join-based), revenue_journal_entries (join-based), revenue_schedules (join-based)
- organizations (SELECT allowed for auth resolution)

### NEVER Disable RLS

**DO NOT** disable RLS on any multi-tenant table. If a table has RLS enabled but no policies, queries will return no rows (fail-safe). This is by design - always create appropriate policies rather than disabling RLS.

## Future Considerations
- Connection pooling configuration
- Read replicas support
- Migration automation
- Backup strategies
- Audit logging for sensitive operations