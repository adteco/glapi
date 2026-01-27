-- ============================================================================
-- Accounting Dimensions Row Level Security Policies
-- ============================================================================
-- Tables: accounts, classes, departments, locations, subsidiaries, activity_codes
-- Note: currencies and tax_codes are GLOBAL reference data without organization_id
-- ============================================================================

-- ============================================================================
-- ACCOUNTS
-- ============================================================================

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_accounts" ON accounts
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_accounts already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_accounts" ON accounts
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_accounts already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_accounts" ON accounts
    FOR UPDATE
    USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_accounts already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_accounts" ON accounts
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_accounts already exists, skipping.';
END $$;

-- ============================================================================
-- CLASSES
-- ============================================================================

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_classes" ON classes
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_classes already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_classes" ON classes
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_classes already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_classes" ON classes
    FOR UPDATE
    USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_classes already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_classes" ON classes
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_classes already exists, skipping.';
END $$;

-- ============================================================================
-- DEPARTMENTS
-- ============================================================================

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_departments" ON departments
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_departments already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_departments" ON departments
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_departments already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_departments" ON departments
    FOR UPDATE
    USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_departments already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_departments" ON departments
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_departments already exists, skipping.';
END $$;

-- ============================================================================
-- LOCATIONS
-- ============================================================================

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_locations" ON locations
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_locations already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_locations" ON locations
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_locations already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_locations" ON locations
    FOR UPDATE
    USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_locations already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_locations" ON locations
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_locations already exists, skipping.';
END $$;

-- ============================================================================
-- SUBSIDIARIES
-- ============================================================================

ALTER TABLE subsidiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE subsidiaries FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_subsidiaries" ON subsidiaries
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_subsidiaries already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_subsidiaries" ON subsidiaries
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_subsidiaries already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_subsidiaries" ON subsidiaries
    FOR UPDATE
    USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_subsidiaries already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_subsidiaries" ON subsidiaries
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_subsidiaries already exists, skipping.';
END $$;

-- ============================================================================
-- ACTIVITY CODES
-- ============================================================================

ALTER TABLE activity_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_codes FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_activity_codes" ON activity_codes
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_activity_codes already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_activity_codes" ON activity_codes
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_activity_codes already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_activity_codes" ON activity_codes
    FOR UPDATE
    USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_activity_codes already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_activity_codes" ON activity_codes
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_activity_codes already exists, skipping.';
END $$;

-- ============================================================================
-- NOTES ON GLOBAL TABLES (NO RLS)
-- ============================================================================
-- The following tables are GLOBAL reference data and do NOT have organization_id:
-- - currencies: Global currency definitions (USD, EUR, etc.)
-- - tax_codes: Global tax rate definitions
-- These tables should NOT have RLS as they are shared across all organizations.
-- ============================================================================
