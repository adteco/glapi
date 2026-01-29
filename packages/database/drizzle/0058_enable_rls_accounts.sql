-- Enable RLS on accounts table
-- organization_id is TEXT type in this table

-- Step 1: Enable RLS on the table
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts FORCE ROW LEVEL SECURITY;

-- Step 2: Drop any existing policies (in case of re-run)
DROP POLICY IF EXISTS "org_isolation_select_accounts" ON accounts;
DROP POLICY IF EXISTS "org_isolation_insert_accounts" ON accounts;
DROP POLICY IF EXISTS "org_isolation_update_accounts" ON accounts;
DROP POLICY IF EXISTS "org_isolation_delete_accounts" ON accounts;

-- Step 3: Create RLS policies using current_setting() directly
-- Cast organization_id to text for comparison with session variable
CREATE POLICY "org_isolation_select_accounts" ON accounts
  FOR SELECT USING (
    organization_id::text = current_setting('app.current_organization_id', true)
  );

CREATE POLICY "org_isolation_insert_accounts" ON accounts
  FOR INSERT WITH CHECK (
    organization_id::text = current_setting('app.current_organization_id', true)
  );

CREATE POLICY "org_isolation_update_accounts" ON accounts
  FOR UPDATE
  USING (organization_id::text = current_setting('app.current_organization_id', true))
  WITH CHECK (organization_id::text = current_setting('app.current_organization_id', true));

CREATE POLICY "org_isolation_delete_accounts" ON accounts
  FOR DELETE USING (
    organization_id::text = current_setting('app.current_organization_id', true)
  );
