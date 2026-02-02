-- Migration: Add RLS bypass support to Magic Inbox tables
-- Created: 2025-02-01
-- Description: Updates Magic Inbox RLS policies to allow internal system queries
--              to bypass RLS when the app.rls_bypass session variable is set.
--              This is needed for cross-tenant lookups like email lookup and
--              webhook secret verification.

-- ============================================================================
-- magic_inbox_email_registry - Update RLS policies with bypass support
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "org_isolation_select_magic_inbox_email_registry" ON "magic_inbox_email_registry";
DROP POLICY IF EXISTS "org_isolation_insert_magic_inbox_email_registry" ON "magic_inbox_email_registry";
DROP POLICY IF EXISTS "org_isolation_update_magic_inbox_email_registry" ON "magic_inbox_email_registry";
DROP POLICY IF EXISTS "org_isolation_delete_magic_inbox_email_registry" ON "magic_inbox_email_registry";

-- Create new policies with bypass support
-- SELECT: Allow if bypass flag is set OR organization matches
CREATE POLICY "org_isolation_select_magic_inbox_email_registry" ON "magic_inbox_email_registry"
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'true'
    OR organization_id::text = current_setting('app.current_organization_id', true)
  );

-- INSERT: Allow if bypass flag is set OR organization matches
CREATE POLICY "org_isolation_insert_magic_inbox_email_registry" ON "magic_inbox_email_registry"
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'true'
    OR organization_id::text = current_setting('app.current_organization_id', true)
  );

-- UPDATE: Allow if bypass flag is set OR organization matches (both USING and WITH CHECK)
CREATE POLICY "org_isolation_update_magic_inbox_email_registry" ON "magic_inbox_email_registry"
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'true'
    OR organization_id::text = current_setting('app.current_organization_id', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'true'
    OR organization_id::text = current_setting('app.current_organization_id', true)
  );

-- DELETE: Allow if bypass flag is set OR organization matches
CREATE POLICY "org_isolation_delete_magic_inbox_email_registry" ON "magic_inbox_email_registry"
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'true'
    OR organization_id::text = current_setting('app.current_organization_id', true)
  );

-- ============================================================================
-- magic_inbox_test_emails - Update RLS policies with bypass support
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "org_isolation_select_magic_inbox_test_emails" ON "magic_inbox_test_emails";
DROP POLICY IF EXISTS "org_isolation_insert_magic_inbox_test_emails" ON "magic_inbox_test_emails";
DROP POLICY IF EXISTS "org_isolation_update_magic_inbox_test_emails" ON "magic_inbox_test_emails";
DROP POLICY IF EXISTS "org_isolation_delete_magic_inbox_test_emails" ON "magic_inbox_test_emails";

-- Create new policies with bypass support
CREATE POLICY "org_isolation_select_magic_inbox_test_emails" ON "magic_inbox_test_emails"
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'true'
    OR organization_id::text = current_setting('app.current_organization_id', true)
  );

CREATE POLICY "org_isolation_insert_magic_inbox_test_emails" ON "magic_inbox_test_emails"
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'true'
    OR organization_id::text = current_setting('app.current_organization_id', true)
  );

CREATE POLICY "org_isolation_update_magic_inbox_test_emails" ON "magic_inbox_test_emails"
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'true'
    OR organization_id::text = current_setting('app.current_organization_id', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'true'
    OR organization_id::text = current_setting('app.current_organization_id', true)
  );

CREATE POLICY "org_isolation_delete_magic_inbox_test_emails" ON "magic_inbox_test_emails"
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'true'
    OR organization_id::text = current_setting('app.current_organization_id', true)
  );

-- ============================================================================
-- magic_inbox_usage - Update RLS policies with bypass support
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "org_isolation_select_magic_inbox_usage" ON "magic_inbox_usage";
DROP POLICY IF EXISTS "org_isolation_insert_magic_inbox_usage" ON "magic_inbox_usage";
DROP POLICY IF EXISTS "org_isolation_update_magic_inbox_usage" ON "magic_inbox_usage";
DROP POLICY IF EXISTS "org_isolation_delete_magic_inbox_usage" ON "magic_inbox_usage";

-- Create new policies with bypass support
CREATE POLICY "org_isolation_select_magic_inbox_usage" ON "magic_inbox_usage"
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'true'
    OR organization_id::text = current_setting('app.current_organization_id', true)
  );

CREATE POLICY "org_isolation_insert_magic_inbox_usage" ON "magic_inbox_usage"
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'true'
    OR organization_id::text = current_setting('app.current_organization_id', true)
  );

CREATE POLICY "org_isolation_update_magic_inbox_usage" ON "magic_inbox_usage"
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'true'
    OR organization_id::text = current_setting('app.current_organization_id', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'true'
    OR organization_id::text = current_setting('app.current_organization_id', true)
  );

CREATE POLICY "org_isolation_delete_magic_inbox_usage" ON "magic_inbox_usage"
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'true'
    OR organization_id::text = current_setting('app.current_organization_id', true)
  );
