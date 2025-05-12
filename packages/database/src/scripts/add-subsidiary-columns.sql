-- Add organization_id column and foreign key constraint
ALTER TABLE subsidiaries ADD COLUMN organization_id UUID REFERENCES organizations(id);

-- Add code column
ALTER TABLE subsidiaries ADD COLUMN code VARCHAR(50);

-- Add description column
ALTER TABLE subsidiaries ADD COLUMN description VARCHAR(1000);

-- Make baseCurrencyId nullable since it's optional in our model
ALTER TABLE subsidiaries ALTER COLUMN base_currency_id DROP NOT NULL;

-- Update existing records with a default organization_id if needed
-- Replace '3a089ae1-8d1a-4e55-af27-9f9c164d3db9' with your actual default organization ID
UPDATE subsidiaries SET organization_id = '3a089ae1-8d1a-4e55-af27-9f9c164d3db9' WHERE organization_id IS NULL;

-- Update existing records with a default code
UPDATE subsidiaries SET code = 'SUB-' || SUBSTRING(id::text, 1, 8) WHERE code IS NULL;

-- Make organization_id NOT NULL after populating it
ALTER TABLE subsidiaries ALTER COLUMN organization_id SET NOT NULL;

-- Make code NOT NULL after populating it
ALTER TABLE subsidiaries ALTER COLUMN code SET NOT NULL;