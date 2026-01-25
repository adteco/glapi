-- Migration: Add organizationId column to tables with only indirect organization scoping
-- Purpose: Some tables only have organization scoping through subsidiaryId. This creates
-- a security risk if subsidiary access control fails. Adding explicit organizationId
-- columns provides defense-in-depth for multi-tenant isolation.
--
-- Tables affected:
--   1. accounting_periods
--   2. gl_transactions
--   3. gl_transaction_lines
--   4. gl_posting_rules
--   5. gl_account_balances

-- ============================================================================
-- 1. ACCOUNTING_PERIODS
-- ============================================================================

-- Add organizationId column (nullable initially for backfill)
ALTER TABLE accounting_periods
  ADD COLUMN IF NOT EXISTS organization_id UUID;

-- Backfill from subsidiaries table
UPDATE accounting_periods ap
SET organization_id = s.organization_id
FROM subsidiaries s
WHERE ap.subsidiary_id = s.id
  AND ap.organization_id IS NULL;

-- Handle orphaned records (subsidiaryId not found) - set to a placeholder or fail
-- In production, you should investigate any records that couldn't be backfilled
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM accounting_periods
  WHERE organization_id IS NULL;

  IF orphan_count > 0 THEN
    RAISE WARNING 'Found % accounting_periods records without organization_id after backfill. These may have invalid subsidiary_id values.', orphan_count;
  END IF;
END $$;

-- Make NOT NULL after backfill (will fail if any NULL values remain)
ALTER TABLE accounting_periods
  ALTER COLUMN organization_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE accounting_periods
  ADD CONSTRAINT accounting_periods_organization_id_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- Add index for query performance
CREATE INDEX IF NOT EXISTS idx_accounting_periods_organization_id
  ON accounting_periods(organization_id);

-- ============================================================================
-- 2. GL_TRANSACTIONS
-- ============================================================================

-- Add organizationId column (nullable initially for backfill)
ALTER TABLE gl_transactions
  ADD COLUMN IF NOT EXISTS organization_id UUID;

-- Backfill from subsidiaries table
UPDATE gl_transactions gt
SET organization_id = s.organization_id
FROM subsidiaries s
WHERE gt.subsidiary_id = s.id
  AND gt.organization_id IS NULL;

-- Handle orphaned records
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM gl_transactions
  WHERE organization_id IS NULL;

  IF orphan_count > 0 THEN
    RAISE WARNING 'Found % gl_transactions records without organization_id after backfill. These may have invalid subsidiary_id values.', orphan_count;
  END IF;
END $$;

-- Make NOT NULL after backfill
ALTER TABLE gl_transactions
  ALTER COLUMN organization_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE gl_transactions
  ADD CONSTRAINT gl_transactions_organization_id_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- Add index for query performance
CREATE INDEX IF NOT EXISTS idx_gl_transactions_organization_id
  ON gl_transactions(organization_id);

-- ============================================================================
-- 3. GL_TRANSACTION_LINES
-- ============================================================================

-- Add organizationId column (nullable initially for backfill)
ALTER TABLE gl_transaction_lines
  ADD COLUMN IF NOT EXISTS organization_id UUID;

-- Backfill from subsidiaries table
UPDATE gl_transaction_lines gtl
SET organization_id = s.organization_id
FROM subsidiaries s
WHERE gtl.subsidiary_id = s.id
  AND gtl.organization_id IS NULL;

-- Handle orphaned records
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM gl_transaction_lines
  WHERE organization_id IS NULL;

  IF orphan_count > 0 THEN
    RAISE WARNING 'Found % gl_transaction_lines records without organization_id after backfill. These may have invalid subsidiary_id values.', orphan_count;
  END IF;
END $$;

-- Make NOT NULL after backfill
ALTER TABLE gl_transaction_lines
  ALTER COLUMN organization_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE gl_transaction_lines
  ADD CONSTRAINT gl_transaction_lines_organization_id_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- Add index for query performance
CREATE INDEX IF NOT EXISTS idx_gl_transaction_lines_organization_id
  ON gl_transaction_lines(organization_id);

-- ============================================================================
-- 4. GL_POSTING_RULES
-- ============================================================================

-- Add organizationId column (nullable initially for backfill)
-- Note: gl_posting_rules.subsidiary_id is optional (null means global rule)
ALTER TABLE gl_posting_rules
  ADD COLUMN IF NOT EXISTS organization_id UUID;

-- Backfill from subsidiaries table where subsidiary_id is not null
UPDATE gl_posting_rules gpr
SET organization_id = s.organization_id
FROM subsidiaries s
WHERE gpr.subsidiary_id = s.id
  AND gpr.organization_id IS NULL
  AND gpr.subsidiary_id IS NOT NULL;

-- For global rules (subsidiary_id IS NULL), we need a different approach
-- They should still belong to an organization for proper RLS
-- If there are global rules, they need to be associated with an organization
-- This requires business decision - for now, warn about them
DO $$
DECLARE
  global_rule_count INTEGER;
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO global_rule_count
  FROM gl_posting_rules
  WHERE subsidiary_id IS NULL AND organization_id IS NULL;

  IF global_rule_count > 0 THEN
    RAISE WARNING 'Found % gl_posting_rules global rules (subsidiary_id IS NULL) without organization_id. These need manual assignment.', global_rule_count;
  END IF;

  SELECT COUNT(*) INTO orphan_count
  FROM gl_posting_rules
  WHERE subsidiary_id IS NOT NULL AND organization_id IS NULL;

  IF orphan_count > 0 THEN
    RAISE WARNING 'Found % gl_posting_rules records without organization_id after backfill. These may have invalid subsidiary_id values.', orphan_count;
  END IF;
END $$;

-- Make NOT NULL after backfill (will fail if any NULL values remain)
-- Uncomment this line only after manually handling global rules
ALTER TABLE gl_posting_rules
  ALTER COLUMN organization_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE gl_posting_rules
  ADD CONSTRAINT gl_posting_rules_organization_id_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- Add index for query performance
CREATE INDEX IF NOT EXISTS idx_gl_posting_rules_organization_id
  ON gl_posting_rules(organization_id);

-- ============================================================================
-- 5. GL_ACCOUNT_BALANCES
-- ============================================================================

-- Add organizationId column (nullable initially for backfill)
ALTER TABLE gl_account_balances
  ADD COLUMN IF NOT EXISTS organization_id UUID;

-- Backfill from subsidiaries table
UPDATE gl_account_balances gab
SET organization_id = s.organization_id
FROM subsidiaries s
WHERE gab.subsidiary_id = s.id
  AND gab.organization_id IS NULL;

-- Handle orphaned records
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM gl_account_balances
  WHERE organization_id IS NULL;

  IF orphan_count > 0 THEN
    RAISE WARNING 'Found % gl_account_balances records without organization_id after backfill. These may have invalid subsidiary_id values.', orphan_count;
  END IF;
END $$;

-- Make NOT NULL after backfill
ALTER TABLE gl_account_balances
  ALTER COLUMN organization_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE gl_account_balances
  ADD CONSTRAINT gl_account_balances_organization_id_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- Add index for query performance
CREATE INDEX IF NOT EXISTS idx_gl_account_balances_organization_id
  ON gl_account_balances(organization_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables (idempotent)
ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_transaction_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_posting_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_account_balances ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to allow re-running migration)
DROP POLICY IF EXISTS accounting_periods_org_isolation ON accounting_periods;
DROP POLICY IF EXISTS gl_transactions_org_isolation ON gl_transactions;
DROP POLICY IF EXISTS gl_transaction_lines_org_isolation ON gl_transaction_lines;
DROP POLICY IF EXISTS gl_posting_rules_org_isolation ON gl_posting_rules;
DROP POLICY IF EXISTS gl_account_balances_org_isolation ON gl_account_balances;

-- Create organization isolation policies
-- Note: get_current_organization_id() must be defined in your database
-- It typically reads from a session variable or JWT claim

CREATE POLICY accounting_periods_org_isolation ON accounting_periods
  FOR ALL
  USING (organization_id = get_current_organization_id())
  WITH CHECK (organization_id = get_current_organization_id());

CREATE POLICY gl_transactions_org_isolation ON gl_transactions
  FOR ALL
  USING (organization_id = get_current_organization_id())
  WITH CHECK (organization_id = get_current_organization_id());

CREATE POLICY gl_transaction_lines_org_isolation ON gl_transaction_lines
  FOR ALL
  USING (organization_id = get_current_organization_id())
  WITH CHECK (organization_id = get_current_organization_id());

CREATE POLICY gl_posting_rules_org_isolation ON gl_posting_rules
  FOR ALL
  USING (organization_id = get_current_organization_id())
  WITH CHECK (organization_id = get_current_organization_id());

CREATE POLICY gl_account_balances_org_isolation ON gl_account_balances
  FOR ALL
  USING (organization_id = get_current_organization_id())
  WITH CHECK (organization_id = get_current_organization_id());

-- ============================================================================
-- VERIFICATION QUERIES (for manual verification after migration)
-- ============================================================================

-- Uncomment and run these queries to verify the migration:
--
-- -- Check for any NULL organization_id values
-- SELECT 'accounting_periods' as table_name, COUNT(*) as null_count
-- FROM accounting_periods WHERE organization_id IS NULL
-- UNION ALL
-- SELECT 'gl_transactions', COUNT(*) FROM gl_transactions WHERE organization_id IS NULL
-- UNION ALL
-- SELECT 'gl_transaction_lines', COUNT(*) FROM gl_transaction_lines WHERE organization_id IS NULL
-- UNION ALL
-- SELECT 'gl_posting_rules', COUNT(*) FROM gl_posting_rules WHERE organization_id IS NULL
-- UNION ALL
-- SELECT 'gl_account_balances', COUNT(*) FROM gl_account_balances WHERE organization_id IS NULL;
--
-- -- Verify organization_id matches subsidiary's organization
-- SELECT 'accounting_periods' as table_name, COUNT(*) as mismatch_count
-- FROM accounting_periods ap
-- JOIN subsidiaries s ON ap.subsidiary_id = s.id
-- WHERE ap.organization_id != s.organization_id
-- UNION ALL
-- SELECT 'gl_transactions', COUNT(*)
-- FROM gl_transactions gt
-- JOIN subsidiaries s ON gt.subsidiary_id = s.id
-- WHERE gt.organization_id != s.organization_id
-- UNION ALL
-- SELECT 'gl_transaction_lines', COUNT(*)
-- FROM gl_transaction_lines gtl
-- JOIN subsidiaries s ON gtl.subsidiary_id = s.id
-- WHERE gtl.organization_id != s.organization_id
-- UNION ALL
-- SELECT 'gl_account_balances', COUNT(*)
-- FROM gl_account_balances gab
-- JOIN subsidiaries s ON gab.subsidiary_id = s.id
-- WHERE gab.organization_id != s.organization_id;
