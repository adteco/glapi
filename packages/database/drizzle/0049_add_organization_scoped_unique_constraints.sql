-- Migration: Add organization-scoped unique constraints
-- Purpose: Ensure business entities are unique WITHIN an organization but can be duplicated ACROSS organizations
-- This supports multi-tenant data isolation

-- ============================================================================
-- DEPARTMENTS: Add unique constraint on (organization_id, code)
-- ============================================================================
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  -- Check for duplicates (only where code is not null)
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT organization_id, code, COUNT(*)
    FROM departments
    WHERE code IS NOT NULL
    GROUP BY organization_id, code
    HAVING COUNT(*) > 1
  ) dups;

  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Found % duplicate (organization_id, code) combinations in departments. Please resolve duplicates before applying this migration.', dup_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS departments_org_code_unique
  ON departments(organization_id, code)
  WHERE code IS NOT NULL;

-- ============================================================================
-- LOCATIONS: Add unique constraint on (organization_id, code)
-- ============================================================================
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  -- Check for duplicates (only where code is not null)
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT organization_id, code, COUNT(*)
    FROM locations
    WHERE code IS NOT NULL
    GROUP BY organization_id, code
    HAVING COUNT(*) > 1
  ) dups;

  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Found % duplicate (organization_id, code) combinations in locations. Please resolve duplicates before applying this migration.', dup_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS locations_org_code_unique
  ON locations(organization_id, code)
  WHERE code IS NOT NULL;

-- ============================================================================
-- CLASSES: Add unique constraint on (organization_id, code)
-- ============================================================================
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  -- Check for duplicates (only where code is not null)
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT organization_id, code, COUNT(*)
    FROM classes
    WHERE code IS NOT NULL
    GROUP BY organization_id, code
    HAVING COUNT(*) > 1
  ) dups;

  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Found % duplicate (organization_id, code) combinations in classes. Please resolve duplicates before applying this migration.', dup_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS classes_org_code_unique
  ON classes(organization_id, code)
  WHERE code IS NOT NULL;

-- ============================================================================
-- SUBSIDIARIES: Add unique constraint on (organization_id, code)
-- ============================================================================
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  -- Check for duplicates (only where code is not null)
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT organization_id, code, COUNT(*)
    FROM subsidiaries
    WHERE code IS NOT NULL
    GROUP BY organization_id, code
    HAVING COUNT(*) > 1
  ) dups;

  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Found % duplicate (organization_id, code) combinations in subsidiaries. Please resolve duplicates before applying this migration.', dup_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS subsidiaries_org_code_unique
  ON subsidiaries(organization_id, code)
  WHERE code IS NOT NULL;

-- ============================================================================
-- ACCOUNTING_PERIODS: Replace subsidiary-only constraint with org-scoped constraint
-- Old: idx_periods_sub_year_period on (subsidiary_id, fiscal_year, period_number)
-- New: idx_periods_org_sub_year_period on (organization_id, subsidiary_id, fiscal_year, period_number)
-- ============================================================================
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  -- Check for duplicates with the new constraint columns
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT organization_id, subsidiary_id, fiscal_year, period_number, COUNT(*)
    FROM accounting_periods
    GROUP BY organization_id, subsidiary_id, fiscal_year, period_number
    HAVING COUNT(*) > 1
  ) dups;

  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Found % duplicate (organization_id, subsidiary_id, fiscal_year, period_number) combinations in accounting_periods. Please resolve duplicates before applying this migration.', dup_count;
  END IF;
END $$;

-- Drop the old index if it exists
DROP INDEX IF EXISTS idx_periods_sub_year_period;

-- Create the new organization-scoped index
CREATE UNIQUE INDEX IF NOT EXISTS idx_periods_org_sub_year_period
  ON accounting_periods(organization_id, subsidiary_id, fiscal_year, period_number);

-- ============================================================================
-- SUMMARY OF CONSTRAINTS ADDED/MODIFIED
-- ============================================================================
--
-- Tables with NEW unique constraints:
-- 1. departments_org_code_unique: (organization_id, code) WHERE code IS NOT NULL
-- 2. locations_org_code_unique: (organization_id, code) WHERE code IS NOT NULL
-- 3. classes_org_code_unique: (organization_id, code) WHERE code IS NOT NULL
-- 4. subsidiaries_org_code_unique: (organization_id, code) WHERE code IS NOT NULL
--
-- Tables with MODIFIED unique constraints:
-- 5. accounting_periods:
--    - DROPPED: idx_periods_sub_year_period (subsidiary_id, fiscal_year, period_number)
--    - ADDED: idx_periods_org_sub_year_period (organization_id, subsidiary_id, fiscal_year, period_number)
--
-- Tables that ALREADY had proper organization-scoped constraints (no changes needed):
-- - items: idx_items_org_item_code (organization_id, item_code)
-- - item_categories: idx_item_categories_org_code (organization_id, code)
-- - entities: entities_org_code_unique (organization_id, code)
-- - projects: idx_projects_org_code (organization_id, project_code)
-- - accounts: accounts_organization_id_account_number_idx (organization_id, account_number)
-- - warehouses: warehouses_org_warehouse_id_idx (organization_id, warehouse_id)
-- - units_of_measure: idx_units_of_measure_org_code (organization_id, code)
--
