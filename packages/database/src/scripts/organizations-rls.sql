-- ============================================================================
-- Organizations Table Row Level Security Policy
-- ============================================================================
-- SPECIAL CASE: This IS the organization table itself.
-- Users should only be able to see their OWN organization.
-- The check is: id = get_current_organization_id()
-- ============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;

-- SELECT: Users can only see their own organization
DO $$
BEGIN
  CREATE POLICY "org_isolation_select_organizations" ON organizations
    FOR SELECT USING (id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_organizations already exists, skipping.';
END $$;

-- INSERT: Users can only create their own organization (during onboarding)
-- Note: In practice, org creation is usually done by admin/system processes
DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_organizations" ON organizations
    FOR INSERT WITH CHECK (id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_organizations already exists, skipping.';
END $$;

-- UPDATE: Users can only update their own organization
DO $$
BEGIN
  CREATE POLICY "org_isolation_update_organizations" ON organizations
    FOR UPDATE
    USING (id = get_current_organization_id())
    WITH CHECK (id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_organizations already exists, skipping.';
END $$;

-- DELETE: Users can only delete their own organization
-- Note: Org deletion is a sensitive operation and should be restricted
DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_organizations" ON organizations
    FOR DELETE USING (id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_organizations already exists, skipping.';
END $$;
