-- Add missing columns to units_of_measure table
ALTER TABLE units_of_measure 
ADD COLUMN organization_id UUID NOT NULL REFERENCES organizations(id),
ADD COLUMN code VARCHAR(10) NOT NULL,
ADD COLUMN base_unit_id UUID REFERENCES units_of_measure(id),
ADD COLUMN conversion_factor DECIMAL(18,6) DEFAULT 1.0,
ADD COLUMN is_active BOOLEAN DEFAULT true,
ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
ADD COLUMN created_by UUID,
ADD COLUMN updated_by UUID;

-- Drop the existing unique constraint on name
ALTER TABLE units_of_measure DROP CONSTRAINT IF EXISTS units_of_measure_name_unique;

-- Add new unique constraints
CREATE UNIQUE INDEX idx_units_of_measure_org_code ON units_of_measure(organization_id, code);
CREATE UNIQUE INDEX idx_units_of_measure_org_abbrev ON units_of_measure(organization_id, abbreviation);

-- Update existing rows to have a default organization_id (you'll need to update this)
-- UPDATE units_of_measure SET organization_id = (SELECT id FROM organizations LIMIT 1);
-- UPDATE units_of_measure SET code = abbreviation;