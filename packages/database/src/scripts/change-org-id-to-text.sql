-- Change organization_id columns from UUID to TEXT to store Clerk org IDs directly

-- Drop foreign key constraints first
ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_organization_id_organizations_id_fk;
ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_organization_id_organizations_id_fk;
ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_organization_id_organizations_id_fk;
ALTER TABLE subsidiaries DROP CONSTRAINT IF EXISTS subsidiaries_organization_id_organizations_id_fk;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_organization_id_organizations_id_fk;

-- Change column types from UUID to TEXT
ALTER TABLE classes ALTER COLUMN organization_id TYPE TEXT USING organization_id::TEXT;
ALTER TABLE departments ALTER COLUMN organization_id TYPE TEXT USING organization_id::TEXT;
ALTER TABLE locations ALTER COLUMN organization_id TYPE TEXT USING organization_id::TEXT;
ALTER TABLE subsidiaries ALTER COLUMN organization_id TYPE TEXT USING organization_id::TEXT;
ALTER TABLE customers ALTER COLUMN organization_id TYPE TEXT USING organization_id::TEXT;


-- Update any existing data to use Clerk format (org_xxx) if needed
-- This is a placeholder - adjust based on your actual data
UPDATE classes SET organization_id = 'org_development' WHERE organization_id = 'organization-default-dev';
UPDATE departments SET organization_id = 'org_development' WHERE organization_id = 'organization-default-dev';
UPDATE locations SET organization_id = 'org_development' WHERE organization_id = 'organization-default-dev';
UPDATE subsidiaries SET organization_id = 'org_development' WHERE organization_id = 'organization-default-dev';
UPDATE customers SET organization_id = 'org_development' WHERE organization_id = 'organization-default-dev';

-- Note: We're not adding foreign key constraints back because we're using Clerk's org IDs
-- The organizations table can still exist for storing org metadata, but it's not required for referential integrity