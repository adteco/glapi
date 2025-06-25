-- Fix organization_id column type for units_of_measure table
-- Change from UUID to TEXT to support values like 'org_development'

-- First drop the foreign key constraint if it exists
ALTER TABLE units_of_measure DROP CONSTRAINT IF EXISTS units_of_measure_organization_id_organizations_id_fk;

-- Change the column type from UUID to TEXT
ALTER TABLE units_of_measure ALTER COLUMN organization_id TYPE TEXT USING organization_id::TEXT;

-- Add created_by column if it doesn't exist
ALTER TABLE units_of_measure ADD COLUMN IF NOT EXISTS created_by TEXT;

-- Add updated_by column if it doesn't exist  
ALTER TABLE units_of_measure ADD COLUMN IF NOT EXISTS updated_by TEXT;