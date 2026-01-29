-- Fix Projects RLS Policies to use current_setting() directly
-- The get_current_organization_id() function has UUID type mismatch issues

-- Drop existing policies
DROP POLICY IF EXISTS "org_isolation_select_projects" ON projects;
DROP POLICY IF EXISTS "org_isolation_insert_projects" ON projects;
DROP POLICY IF EXISTS "org_isolation_update_projects" ON projects;
DROP POLICY IF EXISTS "org_isolation_delete_projects" ON projects;

-- Create new policies using current_setting() directly
CREATE POLICY "org_isolation_select_projects" ON projects
  FOR SELECT USING (
    organization_id::text = current_setting('app.current_organization_id', true)
  );

CREATE POLICY "org_isolation_insert_projects" ON projects
  FOR INSERT WITH CHECK (
    organization_id::text = current_setting('app.current_organization_id', true)
  );

CREATE POLICY "org_isolation_update_projects" ON projects
  FOR UPDATE
  USING (organization_id::text = current_setting('app.current_organization_id', true))
  WITH CHECK (organization_id::text = current_setting('app.current_organization_id', true));

CREATE POLICY "org_isolation_delete_projects" ON projects
  FOR DELETE USING (
    organization_id::text = current_setting('app.current_organization_id', true)
  );
