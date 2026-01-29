-- Enable RLS on entities table
-- This table stores customers, vendors, employees, and other entity types
-- organization_id is UUID type, so we cast to text for comparison

-- Step 1: Enable RLS on the table
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop any existing policies (in case of re-run)
DROP POLICY IF EXISTS "org_isolation_select_entities" ON entities;
DROP POLICY IF EXISTS "org_isolation_insert_entities" ON entities;
DROP POLICY IF EXISTS "org_isolation_update_entities" ON entities;
DROP POLICY IF EXISTS "org_isolation_delete_entities" ON entities;

-- Step 3: Create RLS policies using current_setting() directly
-- (Avoids the UUID type mismatch issue with get_current_organization_id())

CREATE POLICY "org_isolation_select_entities" ON entities
  FOR SELECT USING (
    organization_id::text = current_setting('app.current_organization_id', true)
  );

CREATE POLICY "org_isolation_insert_entities" ON entities
  FOR INSERT WITH CHECK (
    organization_id::text = current_setting('app.current_organization_id', true)
  );

CREATE POLICY "org_isolation_update_entities" ON entities
  FOR UPDATE
  USING (organization_id::text = current_setting('app.current_organization_id', true))
  WITH CHECK (organization_id::text = current_setting('app.current_organization_id', true));

CREATE POLICY "org_isolation_delete_entities" ON entities
  FOR DELETE USING (
    organization_id::text = current_setting('app.current_organization_id', true)
  );
