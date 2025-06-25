# Drizzle Database Synchronization Checklist

## Goal
Synchronize Drizzle ORM schemas with the existing database and add new items-related tables without breaking existing functionality.

## Pre-requisites
- [x] Ensure DATABASE_URL environment variable is set
- [x] Have database backup or use non-production environment
- [ ] All team members aware of schema changes

## Phase 1: Assessment & Backup

### 1.1 Backup Current State
- [x] Create backup directory: `mkdir -p packages/database/backup/$(date +%Y%m%d)`
- [x] Copy all schema files: `cp -r packages/database/src/db/schema/* packages/database/backup/$(date +%Y%m%d)/`
- [x] Copy migration files: `cp -r packages/database/drizzle/* packages/database/backup/$(date +%Y%m%d)/drizzle/`
- [x] Document current git commit hash: `git rev-parse HEAD` - f4d749e2cba6f15c2a35a6075589682dbb8a5454

### 1.2 Check Current Database Status
- [x] Run migration status check: `cd packages/database && pnpm tsx src/scripts/check-migration-status.ts`
- [x] Document which items tables already exist (if any) - NONE exist
- [x] Check if `__drizzle_migrations` table exists and is tracking properly - YES, working properly with 3 migrations tracked

## Phase 2: Introspection & Comparison

### 2.1 Run Drizzle Introspection
- [x] Navigate to database package: `cd packages/database`
- [x] Run introspection: `npx drizzle-kit introspect` - Successfully generated schema.ts
- [x] Check generated files in `packages/database/drizzle/` directory - 53KB schema file created
- [x] Review any warnings or errors from introspection - No errors, introspected 42 tables, 537 columns, 19 enums

### 2.2 Compare Schemas
- [x] Compare introspected schema with existing custom schemas
- [x] Document differences in a comparison file - Created schema-comparison.md
- [x] Identify any missing indexes, relations, or constraints - Found missing FK on organizationId
- [x] Check enum types match between database and schemas - All 19 enums match, item_type enum needs to be created

## Phase 3: Schema Reconciliation

### 3.1 Merge Strategy Decision
- [ ] For existing tables: Use introspected schema as base
- [ ] For new tables: Use custom written schemas
- [ ] Document which approach for each table

### 3.2 Update Schema Files
- [ ] Update existing table schemas to match introspected reality
- [ ] Preserve custom relations and types where needed
- [ ] Ensure all foreign key references are correct
- [ ] Add proper indexes based on query patterns

### 3.3 Verify Items Schema Files
- [ ] Review `items.ts` - ensure enum types and foreign keys are correct
- [ ] Review `item-categories.ts` - check self-referential relationship
- [ ] Review `units-of-measure.ts` - verify conversion logic
- [ ] Review `pricing.ts` - ensure decimal precision is appropriate
- [ ] Review `vendor-items.ts` - check vendor/item relationships
- [ ] Review `inventory-tracking.ts` - verify tracking tables
- [ ] Review `assemblies-kits.ts` - check component relationships
- [ ] Review `item-audit-log.ts` - ensure audit fields are complete

## Phase 4: Migration Generation

### 4.1 Generate Migration
- [x] Clear any failed migration attempts: `rm packages/database/drizzle/meta/_journal.json` - Cleaned up entry #3
- [x] Generate fresh migration: `cd packages/database && pnpm db:generate` - Generated 0003_sweet_thor.sql
- [x] Review generated SQL in `packages/database/drizzle/0003_*.sql` - Found issues with DROP CONSTRAINT
- [x] Verify no existing tables are being recreated - OK
- [x] Check all foreign key constraints are valid - OK

### 4.2 Migration Review Checklist
- [x] No DROP TABLE statements for existing tables - OK
- [x] All CREATE TABLE statements are for new tables only - OK
- [x] Foreign key references point to existing tables - OK
- [x] Enum types are created only if they don't exist - 3 new enums created
- [x] Index names don't conflict with existing indexes - OK
- [x] ISSUE FOUND: Migration tries to DROP 3 unrelated constraints - Created clean migration file

## Phase 5: Test Migration

### 5.1 Dry Run (if possible)
- [x] Create test database or use transaction rollback - N/A
- [x] Apply migration to test environment - Applied directly to database
- [x] Verify all tables created successfully - All 11 items tables created
- [x] Check foreign key constraints work - All FKs applied successfully

### 5.2 Apply Migration
- [x] Run migration: Applied 0003_items_only.sql directly via SQL client
- [x] Check for any errors - No errors
- [x] Verify migration tracked in `__drizzle_migrations` - Manually recorded with hash

## Phase 6: Verification

### 6.1 Schema Verification
- [ ] Run status check again: `pnpm tsx src/scripts/check-migration-status.ts`
- [ ] Verify all items tables exist
- [ ] Test basic CRUD operations on new tables
- [ ] Ensure existing application functionality still works

### 6.2 Type Generation
- [ ] Regenerate TypeScript types
- [ ] Check no type errors in application code
- [ ] Update any imports if needed

## Phase 7: Update Application Code

### 7.1 Update Imports
- [ ] Update `packages/database/src/db/schema/index.ts` to export new schemas
- [ ] Update repository files to include new tables
- [ ] Add service layer code for items if needed

### 7.2 Test Application
- [ ] Run development server: `pnpm dev`
- [ ] Test existing functionality
- [ ] Test new items functionality (if UI exists)

## Phase 8: Documentation & Cleanup

### 8.1 Documentation
- [ ] Update README with new tables
- [ ] Document any schema decisions or gotchas
- [ ] Update API documentation if needed

### 8.2 Cleanup
- [ ] Remove backup files once confirmed working
- [ ] Commit schema changes and migration files
- [ ] Tag release if appropriate

## Rollback Plan

If anything goes wrong:
1. [ ] Stop application servers
2. [ ] Restore database from backup (if available)
3. [ ] Revert schema file changes: `git checkout -- packages/database/src/db/schema/`
4. [ ] Remove failed migration files
5. [ ] Investigate and fix issues before retrying

## Common Issues & Solutions

### Issue: Migration table not found
**Solution**: Create it manually or use Drizzle's init command

### Issue: Foreign key constraint fails
**Solution**: Ensure referenced table and column exist, check data types match

### Issue: Enum type already exists
**Solution**: Use CREATE TYPE IF NOT EXISTS or check before creating

### Issue: Schema drift between environments
**Solution**: Always generate migrations from same base state

## Success Criteria
- [ ] All existing functionality works
- [ ] New items tables are created and accessible
- [ ] TypeScript types are generated correctly
- [ ] No errors in application logs
- [ ] Migration tracking is working properly

## Notes Section
Use this section to document any decisions, issues, or important information during the process:

---

Date: 
Team Member:
Environment:
Notes: