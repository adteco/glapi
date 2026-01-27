-- ============================================================================
-- Priority Tables Row Level Security Policies
-- ============================================================================
-- This script implements RLS policies for additional priority tables not
-- covered in core-rls-policies.sql.
--
-- Run this AFTER the core-rls-policies.sql script which defines the
-- get_current_organization_id() function.
--
-- Tables covered:
--   Priority 1: Projects & Financial Core
--     - projects (direct organization_id check)
--     - project_participants (indirect via project)
--     - project_cost_codes (indirect via project)
--     - project_budget_versions (indirect via project)
--     - project_budget_lines (indirect via budget_version)
--     - external_references (direct organization_id check)
--
--   Priority 2: GL & Accounting
--     - gl_journal_entries (direct organization_id check)
--     - journal_entry_batches (direct organization_id check)
--     - accounting_periods (direct organization_id check)
--     - exchange_rates (global data - no RLS, read-only for all)
--
-- IMPORTANT: Wraps all policy creation in DO blocks with exception handling
-- to provide idempotent behavior (IF NOT EXISTS equivalent).
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Helper function: Check project organization ownership
CREATE OR REPLACE FUNCTION check_project_organization(project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM projects
    WHERE id = project_id
    AND organization_id = get_current_organization_id()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Check budget version organization ownership (via project)
CREATE OR REPLACE FUNCTION check_budget_version_organization(budget_version_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM project_budget_versions bv
    JOIN projects p ON bv.project_id = p.id
    WHERE bv.id = budget_version_id
    AND p.organization_id = get_current_organization_id()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECTION 1: PROJECTS
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Projects RLS Policies
-- -----------------------------------------------------------------------------

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_projects" ON projects
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_projects already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_projects" ON projects
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_projects already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_projects" ON projects
    FOR UPDATE
    USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_projects already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_projects" ON projects
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_projects already exists, skipping.';
END $$;

-- -----------------------------------------------------------------------------
-- Project Participants RLS Policies (Indirect via project)
-- -----------------------------------------------------------------------------

ALTER TABLE project_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_participants FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_project_participants" ON project_participants
    FOR SELECT USING (check_project_organization(project_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_project_participants already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_project_participants" ON project_participants
    FOR INSERT WITH CHECK (check_project_organization(project_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_project_participants already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_project_participants" ON project_participants
    FOR UPDATE
    USING (check_project_organization(project_id))
    WITH CHECK (check_project_organization(project_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_project_participants already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_project_participants" ON project_participants
    FOR DELETE USING (check_project_organization(project_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_project_participants already exists, skipping.';
END $$;

-- -----------------------------------------------------------------------------
-- Project Cost Codes RLS Policies (Indirect via project)
-- -----------------------------------------------------------------------------

ALTER TABLE project_cost_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_cost_codes FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_project_cost_codes" ON project_cost_codes
    FOR SELECT USING (check_project_organization(project_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_project_cost_codes already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_project_cost_codes" ON project_cost_codes
    FOR INSERT WITH CHECK (check_project_organization(project_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_project_cost_codes already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_project_cost_codes" ON project_cost_codes
    FOR UPDATE
    USING (check_project_organization(project_id))
    WITH CHECK (check_project_organization(project_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_project_cost_codes already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_project_cost_codes" ON project_cost_codes
    FOR DELETE USING (check_project_organization(project_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_project_cost_codes already exists, skipping.';
END $$;

-- -----------------------------------------------------------------------------
-- Project Budget Versions RLS Policies (Indirect via project)
-- -----------------------------------------------------------------------------

ALTER TABLE project_budget_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_budget_versions FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_project_budget_versions" ON project_budget_versions
    FOR SELECT USING (check_project_organization(project_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_project_budget_versions already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_project_budget_versions" ON project_budget_versions
    FOR INSERT WITH CHECK (check_project_organization(project_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_project_budget_versions already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_project_budget_versions" ON project_budget_versions
    FOR UPDATE
    USING (check_project_organization(project_id))
    WITH CHECK (check_project_organization(project_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_project_budget_versions already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_project_budget_versions" ON project_budget_versions
    FOR DELETE USING (check_project_organization(project_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_project_budget_versions already exists, skipping.';
END $$;

-- -----------------------------------------------------------------------------
-- Project Budget Lines RLS Policies (Indirect via budget_version -> project)
-- -----------------------------------------------------------------------------

ALTER TABLE project_budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_budget_lines FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_project_budget_lines" ON project_budget_lines
    FOR SELECT USING (check_budget_version_organization(budget_version_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_project_budget_lines already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_project_budget_lines" ON project_budget_lines
    FOR INSERT WITH CHECK (check_budget_version_organization(budget_version_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_project_budget_lines already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_project_budget_lines" ON project_budget_lines
    FOR UPDATE
    USING (check_budget_version_organization(budget_version_id))
    WITH CHECK (check_budget_version_organization(budget_version_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_project_budget_lines already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_project_budget_lines" ON project_budget_lines
    FOR DELETE USING (check_budget_version_organization(budget_version_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_project_budget_lines already exists, skipping.';
END $$;

-- -----------------------------------------------------------------------------
-- External References RLS Policies
-- Note: organization_id can be NULL for global references, handle with care
-- -----------------------------------------------------------------------------

ALTER TABLE external_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_references FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_external_references" ON external_references
    FOR SELECT USING (
      organization_id = get_current_organization_id()
      OR organization_id IS NULL  -- Allow access to global references
    );
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_external_references already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_external_references" ON external_references
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_external_references already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_external_references" ON external_references
    FOR UPDATE
    USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_external_references already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_external_references" ON external_references
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_external_references already exists, skipping.';
END $$;

-- ============================================================================
-- SECTION 2: GL & ACCOUNTING
-- ============================================================================

-- -----------------------------------------------------------------------------
-- GL Journal Entries RLS Policies
-- -----------------------------------------------------------------------------

ALTER TABLE gl_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_journal_entries FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_gl_journal_entries" ON gl_journal_entries
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_gl_journal_entries already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_gl_journal_entries" ON gl_journal_entries
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_gl_journal_entries already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_gl_journal_entries" ON gl_journal_entries
    FOR UPDATE
    USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_gl_journal_entries already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_gl_journal_entries" ON gl_journal_entries
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_gl_journal_entries already exists, skipping.';
END $$;

-- -----------------------------------------------------------------------------
-- Journal Entry Batches RLS Policies
-- -----------------------------------------------------------------------------

ALTER TABLE journal_entry_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_batches FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_journal_entry_batches" ON journal_entry_batches
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_journal_entry_batches already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_journal_entry_batches" ON journal_entry_batches
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_journal_entry_batches already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_journal_entry_batches" ON journal_entry_batches
    FOR UPDATE
    USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_journal_entry_batches already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_journal_entry_batches" ON journal_entry_batches
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_journal_entry_batches already exists, skipping.';
END $$;

-- -----------------------------------------------------------------------------
-- Accounting Periods RLS Policies
-- -----------------------------------------------------------------------------

ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_periods FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_accounting_periods" ON accounting_periods
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_accounting_periods already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_accounting_periods" ON accounting_periods
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_accounting_periods already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_accounting_periods" ON accounting_periods
    FOR UPDATE
    USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_accounting_periods already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_accounting_periods" ON accounting_periods
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_accounting_periods already exists, skipping.';
END $$;

-- -----------------------------------------------------------------------------
-- Exchange Rates - NO RLS (global data)
-- Note: Exchange rates are global reference data, accessible to all organizations
-- They do not have an organization_id column
-- -----------------------------------------------------------------------------

-- No RLS policies for exchange_rates - intentionally left without RLS

-- ============================================================================
-- END OF PRIORITY TABLES RLS POLICIES
-- ============================================================================

-- Summary of tables with RLS enabled by this script:
--
-- Section 1 - Projects:
--   - projects (direct organization_id check)
--   - project_participants (indirect via project)
--   - project_cost_codes (indirect via project)
--   - project_budget_versions (indirect via project)
--   - project_budget_lines (indirect via budget_version -> project)
--   - external_references (direct organization_id check, NULL handling for global refs)
--
-- Section 2 - GL & Accounting:
--   - gl_journal_entries (direct organization_id check)
--   - journal_entry_batches (direct organization_id check)
--   - accounting_periods (direct organization_id check)
--   - exchange_rates (NO RLS - global reference data)
--
-- Helper functions defined:
--   - check_project_organization(project_id) - Validates project ownership
--   - check_budget_version_organization(budget_version_id) - Validates budget version ownership via project
