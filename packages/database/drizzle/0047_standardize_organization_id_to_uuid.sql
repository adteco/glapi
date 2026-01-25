-- Migration: Standardize organizationId column types from TEXT to UUID
-- This migration:
-- 1. Maps Clerk org IDs to database UUIDs
-- 2. Converts organization_id columns from TEXT to UUID
--
-- IMPORTANT: This handles the case where organization_id contains Clerk IDs (org_xxx)
-- instead of database UUIDs.

-- ==============================================================================
-- PART 0: Create a mapping function from Clerk org ID to database UUID
-- ==============================================================================

CREATE OR REPLACE FUNCTION get_org_uuid_from_text(org_text TEXT)
RETURNS UUID AS $$
DECLARE
  result UUID;
BEGIN
  -- If it's already a valid UUID, return it
  BEGIN
    result := org_text::uuid;
    RETURN result;
  EXCEPTION WHEN invalid_text_representation THEN
    -- Not a UUID, continue to look up by Clerk ID
    NULL;
  END;

  -- Look up by clerk_org_id
  SELECT id INTO result FROM organizations WHERE clerk_org_id = org_text;

  -- If found, return it
  IF result IS NOT NULL THEN
    RETURN result;
  END IF;

  -- Handle special development cases - map to Adteco dev org
  IF org_text LIKE 'org_development%' OR org_text = 'org_development' THEN
    RETURN 'ba3b8cdf-efc1-4a60-88be-ac203d263fe2'::uuid;
  END IF;

  -- If nothing found, return NULL (will cause NOT NULL constraint to fail, highlighting bad data)
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- PART 1: Update organization_id values from Clerk IDs to database UUIDs
-- ==============================================================================

-- departments
UPDATE departments SET organization_id = get_org_uuid_from_text(organization_id)::text
WHERE organization_id IS NOT NULL AND organization_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- subsidiaries
UPDATE subsidiaries SET organization_id = get_org_uuid_from_text(organization_id)::text
WHERE organization_id IS NOT NULL AND organization_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- locations
UPDATE locations SET organization_id = get_org_uuid_from_text(organization_id)::text
WHERE organization_id IS NOT NULL AND organization_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- classes
UPDATE classes SET organization_id = get_org_uuid_from_text(organization_id)::text
WHERE organization_id IS NOT NULL AND organization_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- addresses
UPDATE addresses SET organization_id = get_org_uuid_from_text(organization_id)::text
WHERE organization_id IS NOT NULL AND organization_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- entities
UPDATE entities SET organization_id = get_org_uuid_from_text(organization_id)::text
WHERE organization_id IS NOT NULL AND organization_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- items
UPDATE items SET organization_id = get_org_uuid_from_text(organization_id)::text
WHERE organization_id IS NOT NULL AND organization_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- accounts
UPDATE accounts SET organization_id = get_org_uuid_from_text(organization_id)::text
WHERE organization_id IS NOT NULL AND organization_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- item_categories
UPDATE item_categories SET organization_id = get_org_uuid_from_text(organization_id)::text
WHERE organization_id IS NOT NULL AND organization_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- units_of_measure
UPDATE units_of_measure SET organization_id = get_org_uuid_from_text(organization_id)::text
WHERE organization_id IS NOT NULL AND organization_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- warehouses
UPDATE warehouses SET organization_id = get_org_uuid_from_text(organization_id)::text
WHERE organization_id IS NOT NULL AND organization_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- lot_numbers
UPDATE lot_numbers SET organization_id = get_org_uuid_from_text(organization_id)::text
WHERE organization_id IS NOT NULL AND organization_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- serial_numbers
UPDATE serial_numbers SET organization_id = get_org_uuid_from_text(organization_id)::text
WHERE organization_id IS NOT NULL AND organization_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- item_audit_log
UPDATE item_audit_log SET organization_id = get_org_uuid_from_text(organization_id)::text
WHERE organization_id IS NOT NULL AND organization_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- price_lists
UPDATE price_lists SET organization_id = get_org_uuid_from_text(organization_id)::text
WHERE organization_id IS NOT NULL AND organization_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- contract_modifications
UPDATE contract_modifications SET organization_id = get_org_uuid_from_text(organization_id)::text
WHERE organization_id IS NOT NULL AND organization_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- catch_up_adjustments
UPDATE catch_up_adjustments SET organization_id = get_org_uuid_from_text(organization_id)::text
WHERE organization_id IS NOT NULL AND organization_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- saved_report_configs
UPDATE saved_report_configs SET organization_id = get_org_uuid_from_text(organization_id)::text
WHERE organization_id IS NOT NULL AND organization_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- test_gl
UPDATE test_gl SET organization_id = get_org_uuid_from_text(organization_id)::text
WHERE organization_id IS NOT NULL AND organization_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- ==============================================================================
-- PART 2: Drop indexes that will interfere with type changes
-- ==============================================================================

-- Drop unique constraint on entities first (it depends on the index)
ALTER TABLE entities DROP CONSTRAINT IF EXISTS entities_org_code_unique;

-- Drop indexes
DROP INDEX IF EXISTS idx_departments_org;
DROP INDEX IF EXISTS idx_subsidiaries_org;
DROP INDEX IF EXISTS idx_locations_org;
DROP INDEX IF EXISTS idx_classes_org;
DROP INDEX IF EXISTS idx_items_org_item_code;
DROP INDEX IF EXISTS idx_item_categories_org_code;
DROP INDEX IF EXISTS idx_units_of_measure_org_code;
DROP INDEX IF EXISTS entities_org_code_unique;

-- ==============================================================================
-- PART 3: Convert TEXT columns to UUID
-- ==============================================================================

-- Core tables
ALTER TABLE departments ALTER COLUMN organization_id TYPE UUID USING organization_id::uuid;
ALTER TABLE subsidiaries ALTER COLUMN organization_id TYPE UUID USING organization_id::uuid;
ALTER TABLE locations ALTER COLUMN organization_id TYPE UUID USING organization_id::uuid;
ALTER TABLE classes ALTER COLUMN organization_id TYPE UUID USING organization_id::uuid;
ALTER TABLE addresses ALTER COLUMN organization_id TYPE UUID USING organization_id::uuid;
ALTER TABLE entities ALTER COLUMN organization_id TYPE UUID USING organization_id::uuid;
ALTER TABLE items ALTER COLUMN organization_id TYPE UUID USING organization_id::uuid;
ALTER TABLE accounts ALTER COLUMN organization_id TYPE UUID USING organization_id::uuid;
ALTER TABLE item_categories ALTER COLUMN organization_id TYPE UUID USING organization_id::uuid;
ALTER TABLE units_of_measure ALTER COLUMN organization_id TYPE UUID USING organization_id::uuid;
ALTER TABLE warehouses ALTER COLUMN organization_id TYPE UUID USING organization_id::uuid;
ALTER TABLE lot_numbers ALTER COLUMN organization_id TYPE UUID USING organization_id::uuid;
ALTER TABLE serial_numbers ALTER COLUMN organization_id TYPE UUID USING organization_id::uuid;
ALTER TABLE item_audit_log ALTER COLUMN organization_id TYPE UUID USING organization_id::uuid;
ALTER TABLE price_lists ALTER COLUMN organization_id TYPE UUID USING organization_id::uuid;
ALTER TABLE contract_modifications ALTER COLUMN organization_id TYPE UUID USING organization_id::uuid;
ALTER TABLE catch_up_adjustments ALTER COLUMN organization_id TYPE UUID USING organization_id::uuid;
ALTER TABLE saved_report_configs ALTER COLUMN organization_id TYPE UUID USING organization_id::uuid;
ALTER TABLE test_gl ALTER COLUMN organization_id TYPE UUID USING organization_id::uuid;

-- ==============================================================================
-- PART 4: Add foreign key constraints
-- ==============================================================================

ALTER TABLE departments ADD CONSTRAINT departments_organization_id_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE subsidiaries ADD CONSTRAINT subsidiaries_organization_id_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE locations ADD CONSTRAINT locations_organization_id_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE classes ADD CONSTRAINT classes_organization_id_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE addresses ADD CONSTRAINT addresses_organization_id_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE entities ADD CONSTRAINT entities_organization_id_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE items ADD CONSTRAINT items_organization_id_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE accounts ADD CONSTRAINT accounts_organization_id_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE item_categories ADD CONSTRAINT item_categories_organization_id_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE units_of_measure ADD CONSTRAINT units_of_measure_organization_id_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE warehouses ADD CONSTRAINT warehouses_organization_id_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE lot_numbers ADD CONSTRAINT lot_numbers_organization_id_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE serial_numbers ADD CONSTRAINT serial_numbers_organization_id_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE item_audit_log ADD CONSTRAINT item_audit_log_organization_id_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE price_lists ADD CONSTRAINT price_lists_organization_id_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE contract_modifications ADD CONSTRAINT contract_modifications_organization_id_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE catch_up_adjustments ADD CONSTRAINT catch_up_adjustments_organization_id_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE saved_report_configs ADD CONSTRAINT saved_report_configs_organization_id_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE test_gl ADD CONSTRAINT test_gl_organization_id_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- ==============================================================================
-- PART 5: Recreate indexes
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_departments_org ON departments(organization_id);
CREATE INDEX IF NOT EXISTS idx_subsidiaries_org ON subsidiaries(organization_id);
CREATE INDEX IF NOT EXISTS idx_locations_org ON locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_classes_org ON classes(organization_id);
CREATE INDEX IF NOT EXISTS idx_items_org_item_code ON items(organization_id, item_code);
CREATE INDEX IF NOT EXISTS idx_item_categories_org_code ON item_categories(organization_id, code);
CREATE INDEX IF NOT EXISTS idx_units_of_measure_org_code ON units_of_measure(organization_id, code);

-- Recreate unique constraint on entities
CREATE UNIQUE INDEX IF NOT EXISTS entities_org_code_unique ON entities(organization_id, code);

-- ==============================================================================
-- PART 6: Cleanup
-- ==============================================================================

DROP FUNCTION IF EXISTS get_org_uuid_from_text(TEXT);

-- Verify counts
DO $$
DECLARE
  bad_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_count FROM departments WHERE organization_id IS NULL;
  IF bad_count > 0 THEN
    RAISE WARNING 'Found % departments with NULL organization_id after migration', bad_count;
  END IF;
END $$;
