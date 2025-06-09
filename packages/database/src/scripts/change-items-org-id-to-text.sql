-- Change organization_id columns from UUID to TEXT for items-related tables

-- Drop foreign key constraints first (only for tables that exist)
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_organization_id_organizations_id_fk;
ALTER TABLE item_categories DROP CONSTRAINT IF EXISTS item_categories_organization_id_organizations_id_fk;
ALTER TABLE units_of_measure DROP CONSTRAINT IF EXISTS units_of_measure_organization_id_organizations_id_fk;
ALTER TABLE lot_numbers DROP CONSTRAINT IF EXISTS lot_numbers_organization_id_organizations_id_fk;
ALTER TABLE serial_numbers DROP CONSTRAINT IF EXISTS serial_numbers_organization_id_organizations_id_fk;
ALTER TABLE price_lists DROP CONSTRAINT IF EXISTS price_lists_organization_id_organizations_id_fk;
ALTER TABLE vendor_items DROP CONSTRAINT IF EXISTS vendor_items_organization_id_organizations_id_fk;
ALTER TABLE item_audit_log DROP CONSTRAINT IF EXISTS item_audit_log_organization_id_organizations_id_fk;

-- Change column types from UUID to TEXT (only for tables that exist)
DO $$ 
BEGIN
    -- items table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'items') THEN
        ALTER TABLE items ALTER COLUMN organization_id TYPE TEXT USING organization_id::TEXT;
    END IF;
    
    -- item_categories table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'item_categories') THEN
        ALTER TABLE item_categories ALTER COLUMN organization_id TYPE TEXT USING organization_id::TEXT;
    END IF;
    
    -- units_of_measure table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'units_of_measure') THEN
        ALTER TABLE units_of_measure ALTER COLUMN organization_id TYPE TEXT USING organization_id::TEXT;
    END IF;
    
    -- lot_numbers table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lot_numbers') THEN
        ALTER TABLE lot_numbers ALTER COLUMN organization_id TYPE TEXT USING organization_id::TEXT;
    END IF;
    
    -- serial_numbers table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'serial_numbers') THEN
        ALTER TABLE serial_numbers ALTER COLUMN organization_id TYPE TEXT USING organization_id::TEXT;
    END IF;
    
    -- price_lists table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'price_lists') THEN
        ALTER TABLE price_lists ALTER COLUMN organization_id TYPE TEXT USING organization_id::TEXT;
    END IF;
    
    -- vendor_items table - Note: This table doesn't have organization_id, skip it
    
    -- item_audit_log table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'item_audit_log') THEN
        ALTER TABLE item_audit_log ALTER COLUMN organization_id TYPE TEXT USING organization_id::TEXT;
    END IF;
END $$;

-- Note: We're not adding foreign key constraints back because we're using Clerk's org IDs
-- The organizations table can still exist for storing org metadata, but it's not required for referential integrity