-- Migration script for Departments, Locations, and Classes adding organizationId and other fields

-- Departments table updates
ALTER TABLE departments 
  ADD COLUMN organization_id UUID REFERENCES organizations(id),
  ADD COLUMN code VARCHAR(50),
  ADD COLUMN description VARCHAR(1000);

-- Make organization_id mandatory (after adding it to existing rows)
UPDATE departments SET organization_id = (
  SELECT organization_id FROM subsidiaries WHERE subsidiaries.id = departments.subsidiary_id
);
ALTER TABLE departments ALTER COLUMN organization_id SET NOT NULL;

-- Locations table updates
ALTER TABLE locations 
  ADD COLUMN organization_id UUID REFERENCES organizations(id),
  ADD COLUMN code VARCHAR(50),
  ADD COLUMN description VARCHAR(1000);

-- Make organization_id mandatory (after adding it to existing rows)
UPDATE locations SET organization_id = (
  SELECT organization_id FROM subsidiaries WHERE subsidiaries.id = locations.subsidiary_id
);
ALTER TABLE locations ALTER COLUMN organization_id SET NOT NULL;

-- Classes table updates
ALTER TABLE classes 
  ADD COLUMN organization_id UUID REFERENCES organizations(id),
  ADD COLUMN code VARCHAR(50),
  ADD COLUMN description VARCHAR(1000);

-- Make organization_id mandatory (after adding it to existing rows)
UPDATE classes SET organization_id = (
  SELECT organization_id FROM subsidiaries WHERE subsidiaries.id = classes.subsidiary_id
);
ALTER TABLE classes ALTER COLUMN organization_id SET NOT NULL;

-- Add indexes for better query performance
CREATE INDEX idx_departments_organization_id ON departments(organization_id);
CREATE INDEX idx_locations_organization_id ON locations(organization_id);
CREATE INDEX idx_classes_organization_id ON classes(organization_id);

-- Create unique constraints for organization + code combinations
ALTER TABLE departments ADD CONSTRAINT uq_departments_org_code UNIQUE (organization_id, code);
ALTER TABLE locations ADD CONSTRAINT uq_locations_org_code UNIQUE (organization_id, code);
ALTER TABLE classes ADD CONSTRAINT uq_classes_org_code UNIQUE (organization_id, code);