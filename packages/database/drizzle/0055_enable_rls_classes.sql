-- Enable RLS on classes table
-- organization_id is TEXT type in this table

-- Step 1: Enable RLS on the table
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes FORCE ROW LEVEL SECURITY;

-- Step 2: Drop any existing policies (in case of re-run)
DROP POLICY IF EXISTS "org_isolation_select_classes" ON classes;
DROP POLICY IF EXISTS "org_isolation_insert_classes" ON classes;
DROP POLICY IF EXISTS "org_isolation_update_classes" ON classes;
DROP POLICY IF EXISTS "org_isolation_delete_classes" ON classes;

-- Step 3: Create RLS policies using current_setting() directly
-- Cast organization_id to text for comparison with session variable
CREATE POLICY "org_isolation_select_classes" ON classes
  FOR SELECT USING (
    organization_id::text = current_setting('app.current_organization_id', true)
  );

CREATE POLICY "org_isolation_insert_classes" ON classes
  FOR INSERT WITH CHECK (
    organization_id::text = current_setting('app.current_organization_id', true)
  );

CREATE POLICY "org_isolation_update_classes" ON classes
  FOR UPDATE
  USING (organization_id::text = current_setting('app.current_organization_id', true))
  WITH CHECK (organization_id::text = current_setting('app.current_organization_id', true));

CREATE POLICY "org_isolation_delete_classes" ON classes
  FOR DELETE USING (
    organization_id::text = current_setting('app.current_organization_id', true)
  );
