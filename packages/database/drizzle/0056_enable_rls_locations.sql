-- Enable RLS on locations table
-- organization_id is TEXT type in this table

-- Step 1: Enable RLS on the table
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations FORCE ROW LEVEL SECURITY;

-- Step 2: Drop any existing policies (in case of re-run)
DROP POLICY IF EXISTS "org_isolation_select_locations" ON locations;
DROP POLICY IF EXISTS "org_isolation_insert_locations" ON locations;
DROP POLICY IF EXISTS "org_isolation_update_locations" ON locations;
DROP POLICY IF EXISTS "org_isolation_delete_locations" ON locations;

-- Step 3: Create RLS policies using current_setting() directly
-- Cast organization_id to text for comparison with session variable
CREATE POLICY "org_isolation_select_locations" ON locations
  FOR SELECT USING (
    organization_id::text = current_setting('app.current_organization_id', true)
  );

CREATE POLICY "org_isolation_insert_locations" ON locations
  FOR INSERT WITH CHECK (
    organization_id::text = current_setting('app.current_organization_id', true)
  );

CREATE POLICY "org_isolation_update_locations" ON locations
  FOR UPDATE
  USING (organization_id::text = current_setting('app.current_organization_id', true))
  WITH CHECK (organization_id::text = current_setting('app.current_organization_id', true));

CREATE POLICY "org_isolation_delete_locations" ON locations
  FOR DELETE USING (
    organization_id::text = current_setting('app.current_organization_id', true)
  );
