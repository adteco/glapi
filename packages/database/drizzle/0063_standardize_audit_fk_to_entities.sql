-- Migration: Standardize audit column FK references to entities table
-- Created: 2026-01-31
-- Description: Updates created_by/modified_by foreign keys from users to entities table
-- Part of Phase 4 type centralization (glapi-qsjt)

-- ============================================================
-- CONSOLIDATION TABLES
-- ============================================================

-- consolidation_groups: created_by
ALTER TABLE "consolidation_groups" DROP CONSTRAINT IF EXISTS "consolidation_groups_created_by_users_id_fk";
ALTER TABLE "consolidation_groups" DROP CONSTRAINT IF EXISTS "consolidation_groups_created_by_fkey";
-- Add new FK to entities (only if column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'consolidation_groups' AND column_name = 'created_by') THEN
    ALTER TABLE "consolidation_groups"
      ADD CONSTRAINT "consolidation_groups_created_by_entities_fk"
      FOREIGN KEY ("created_by") REFERENCES "entities"("id") ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- constraint already exists
END $$;

-- elimination_rules: created_by
ALTER TABLE "elimination_rules" DROP CONSTRAINT IF EXISTS "elimination_rules_created_by_users_id_fk";
ALTER TABLE "elimination_rules" DROP CONSTRAINT IF EXISTS "elimination_rules_created_by_fkey";
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'elimination_rules' AND column_name = 'created_by') THEN
    ALTER TABLE "elimination_rules"
      ADD CONSTRAINT "elimination_rules_created_by_entities_fk"
      FOREIGN KEY ("created_by") REFERENCES "entities"("id") ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- consolidation_exchange_rates: created_by
ALTER TABLE "consolidation_exchange_rates" DROP CONSTRAINT IF EXISTS "consolidation_exchange_rates_created_by_users_id_fk";
ALTER TABLE "consolidation_exchange_rates" DROP CONSTRAINT IF EXISTS "consolidation_exchange_rates_created_by_fkey";
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'consolidation_exchange_rates' AND column_name = 'created_by') THEN
    ALTER TABLE "consolidation_exchange_rates"
      ADD CONSTRAINT "consolidation_exchange_rates_created_by_entities_fk"
      FOREIGN KEY ("created_by") REFERENCES "entities"("id") ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- consolidation_runs: created_by
ALTER TABLE "consolidation_runs" DROP CONSTRAINT IF EXISTS "consolidation_runs_created_by_users_id_fk";
ALTER TABLE "consolidation_runs" DROP CONSTRAINT IF EXISTS "consolidation_runs_created_by_fkey";
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'consolidation_runs' AND column_name = 'created_by') THEN
    ALTER TABLE "consolidation_runs"
      ADD CONSTRAINT "consolidation_runs_created_by_entities_fk"
      FOREIGN KEY ("created_by") REFERENCES "entities"("id") ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ============================================================
-- EXPENSE ENTRIES TABLES
-- ============================================================

-- expense_entries: created_by
ALTER TABLE "expense_entries" DROP CONSTRAINT IF EXISTS "expense_entries_created_by_users_id_fk";
ALTER TABLE "expense_entries" DROP CONSTRAINT IF EXISTS "expense_entries_created_by_fkey";
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'expense_entries' AND column_name = 'created_by') THEN
    ALTER TABLE "expense_entries"
      ADD CONSTRAINT "expense_entries_created_by_entities_fk"
      FOREIGN KEY ("created_by") REFERENCES "entities"("id") ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- expense_reports: created_by
ALTER TABLE "expense_reports" DROP CONSTRAINT IF EXISTS "expense_reports_created_by_users_id_fk";
ALTER TABLE "expense_reports" DROP CONSTRAINT IF EXISTS "expense_reports_created_by_fkey";
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'expense_reports' AND column_name = 'created_by') THEN
    ALTER TABLE "expense_reports"
      ADD CONSTRAINT "expense_reports_created_by_entities_fk"
      FOREIGN KEY ("created_by") REFERENCES "entities"("id") ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- expense_approvals: created_by
ALTER TABLE "expense_approvals" DROP CONSTRAINT IF EXISTS "expense_approvals_created_by_users_id_fk";
ALTER TABLE "expense_approvals" DROP CONSTRAINT IF EXISTS "expense_approvals_created_by_fkey";
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'expense_approvals' AND column_name = 'created_by') THEN
    ALTER TABLE "expense_approvals"
      ADD CONSTRAINT "expense_approvals_created_by_entities_fk"
      FOREIGN KEY ("created_by") REFERENCES "entities"("id") ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ============================================================
-- PROJECT TABLES
-- ============================================================

-- projects: created_by
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_created_by_users_id_fk";
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_created_by_fkey";
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'projects' AND column_name = 'created_by') THEN
    ALTER TABLE "projects"
      ADD CONSTRAINT "projects_created_by_entities_fk"
      FOREIGN KEY ("created_by") REFERENCES "entities"("id") ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- project_cost_codes: created_by
ALTER TABLE "project_cost_codes" DROP CONSTRAINT IF EXISTS "project_cost_codes_created_by_users_id_fk";
ALTER TABLE "project_cost_codes" DROP CONSTRAINT IF EXISTS "project_cost_codes_created_by_fkey";
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'project_cost_codes' AND column_name = 'created_by') THEN
    ALTER TABLE "project_cost_codes"
      ADD CONSTRAINT "project_cost_codes_created_by_entities_fk"
      FOREIGN KEY ("created_by") REFERENCES "entities"("id") ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- project_budget_versions: created_by, submitted_by, approved_by, locked_by
ALTER TABLE "project_budget_versions" DROP CONSTRAINT IF EXISTS "project_budget_versions_created_by_users_id_fk";
ALTER TABLE "project_budget_versions" DROP CONSTRAINT IF EXISTS "project_budget_versions_created_by_fkey";
ALTER TABLE "project_budget_versions" DROP CONSTRAINT IF EXISTS "project_budget_versions_submitted_by_fkey";
ALTER TABLE "project_budget_versions" DROP CONSTRAINT IF EXISTS "project_budget_versions_approved_by_fkey";
ALTER TABLE "project_budget_versions" DROP CONSTRAINT IF EXISTS "project_budget_versions_locked_by_fkey";
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'project_budget_versions' AND column_name = 'created_by') THEN
    ALTER TABLE "project_budget_versions"
      ADD CONSTRAINT "project_budget_versions_created_by_entities_fk"
      FOREIGN KEY ("created_by") REFERENCES "entities"("id") ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Note: If any of these columns contain user IDs that don't exist in entities,
-- the constraint creation will fail. In that case, you may need to:
-- 1. First run: UPDATE table SET created_by = NULL WHERE created_by NOT IN (SELECT id FROM entities);
-- 2. Then re-run this migration
