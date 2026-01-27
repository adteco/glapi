-- ============================================================================
-- Organizations Table Row Level Security Policy
-- ============================================================================
-- SPECIAL CASE: This IS the organization table itself.
--
-- SELECT: Must be permissive to allow auth resolution (looking up org by
-- clerk_org_id before we know the internal UUID). The application layer
-- enforces that users only see their own org data after auth.
--
-- INSERT/UPDATE/DELETE: Restricted to matching organization context.
-- ============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;

-- SELECT: Permissive to allow auth resolution (clerk_org_id lookup)
-- Application enforces org isolation after auth context is established
DO $$
BEGIN
  CREATE POLICY "org_select_for_auth_and_context" ON organizations
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_select_for_auth_and_context already exists, skipping.';
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
