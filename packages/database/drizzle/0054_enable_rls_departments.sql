-- Enable RLS on departments table
-- organization_id is UUID type, so we cast to text for comparison

-- Step 1: Enable RLS on the table
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments FORCE ROW LEVEL SECURITY;

-- Step 2: Drop any existing policies (in case of re-run)
DROP POLICY IF EXISTS "org_isolation_select_departments" ON departments;
DROP POLICY IF EXISTS "org_isolation_insert_departments" ON departments;
DROP POLICY IF EXISTS "org_isolation_update_departments" ON departments;
DROP POLICY IF EXISTS "org_isolation_delete_departments" ON departments;

-- Step 3: Create RLS policies using current_setting() directly
CREATE POLICY "org_isolation_select_departments" ON departments
  FOR SELECT USING (
    organization_id::text = current_setting('app.current_organization_id', true)
  );

CREATE POLICY "org_isolation_insert_departments" ON departments
  FOR INSERT WITH CHECK (
    organization_id::text = current_setting('app.current_organization_id', true)
  );

CREATE POLICY "org_isolation_update_departments" ON departments
  FOR UPDATE
  USING (organization_id::text = current_setting('app.current_organization_id', true))
  WITH CHECK (organization_id::text = current_setting('app.current_organization_id', true));

CREATE POLICY "org_isolation_delete_departments" ON departments
  FOR DELETE USING (
    organization_id::text = current_setting('app.current_organization_id', true)
  );
