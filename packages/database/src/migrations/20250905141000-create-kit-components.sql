-- Create kit_components table for managing kit/bundle relationships
CREATE TABLE IF NOT EXISTS kit_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  parent_item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  component_item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity DECIMAL(10,4) DEFAULT 1,
  allocation_percentage DECIMAL(5,4), -- If specified allocation
  is_separately_priced BOOLEAN DEFAULT false,
  fixed_price DECIMAL(10,2), -- If separately priced
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_parent_component UNIQUE (parent_item_id, component_item_id),
  CONSTRAINT no_self_reference CHECK (parent_item_id != component_item_id),
  CONSTRAINT valid_allocation_percentage CHECK (
    allocation_percentage IS NULL OR 
    (allocation_percentage > 0 AND allocation_percentage <= 1)
  ),
  CONSTRAINT quantity_positive CHECK (quantity > 0),
  CONSTRAINT fixed_price_positive CHECK (fixed_price IS NULL OR fixed_price >= 0),
  CONSTRAINT separately_priced_requires_fixed_price CHECK (
    (is_separately_priced = false) OR 
    (is_separately_priced = true AND fixed_price IS NOT NULL)
  )
);

-- Create indexes for efficient kit lookup
CREATE INDEX idx_kit_components_organization ON kit_components(organization_id);
CREATE INDEX idx_kit_components_parent ON kit_components(parent_item_id);
CREATE INDEX idx_kit_components_child ON kit_components(component_item_id);

-- Create trigger for updated_at
CREATE TRIGGER update_kit_components_updated_at 
  BEFORE UPDATE ON kit_components
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to check for circular references in kit hierarchy
CREATE OR REPLACE FUNCTION check_kit_circular_reference(
  p_parent_item_id UUID,
  p_component_item_id UUID,
  p_organization_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  has_circular BOOLEAN := false;
BEGIN
  -- Check if adding this component would create a circular reference
  WITH RECURSIVE kit_hierarchy AS (
    -- Start with the component item
    SELECT component_item_id as item_id
    FROM kit_components
    WHERE parent_item_id = p_component_item_id
      AND organization_id = p_organization_id
    
    UNION ALL
    
    -- Recursively find all sub-components
    SELECT kc.component_item_id
    FROM kit_components kc
    INNER JOIN kit_hierarchy kh ON kc.parent_item_id = kh.item_id
    WHERE kc.organization_id = p_organization_id
  )
  SELECT EXISTS (
    SELECT 1 FROM kit_hierarchy WHERE item_id = p_parent_item_id
  ) INTO has_circular;
  
  RETURN has_circular;
END;
$$ LANGUAGE plpgsql;

-- Function to validate kit component allocation percentages
CREATE OR REPLACE FUNCTION validate_kit_allocations(p_parent_item_id UUID)
RETURNS TABLE(
  is_valid BOOLEAN,
  total_percentage DECIMAL(7,4),
  message TEXT
) AS $$
DECLARE
  total_pct DECIMAL(7,4);
  has_percentages BOOLEAN;
  has_mixed BOOLEAN;
BEGIN
  -- Check if any components have allocation percentages
  SELECT 
    COUNT(*) FILTER (WHERE allocation_percentage IS NOT NULL) > 0,
    COALESCE(SUM(allocation_percentage), 0)
  INTO has_percentages, total_pct
  FROM kit_components
  WHERE parent_item_id = p_parent_item_id;
  
  -- Check for mixed allocation methods (some with %, some without)
  SELECT EXISTS (
    SELECT 1 
    FROM kit_components 
    WHERE parent_item_id = p_parent_item_id
      AND allocation_percentage IS NOT NULL
  ) AND EXISTS (
    SELECT 1 
    FROM kit_components 
    WHERE parent_item_id = p_parent_item_id
      AND allocation_percentage IS NULL
      AND is_separately_priced = false
  ) INTO has_mixed;
  
  -- Validate based on allocation method
  IF NOT has_percentages THEN
    -- No percentages specified - will use SSP allocation
    RETURN QUERY SELECT true, 0::DECIMAL(7,4), 'Using SSP-based allocation'::TEXT;
  ELSIF has_mixed THEN
    -- Mixed methods not allowed
    RETURN QUERY SELECT false, total_pct, 'Cannot mix percentage and SSP allocation methods'::TEXT;
  ELSIF total_pct > 1.0001 THEN  -- Allow tiny rounding errors
    -- Total exceeds 100%
    RETURN QUERY SELECT false, total_pct, 'Total allocation percentage exceeds 100%'::TEXT;
  ELSIF total_pct < 0.9999 THEN  -- Allow tiny rounding errors
    -- Total less than 100%
    RETURN QUERY SELECT false, total_pct, 'Total allocation percentage is less than 100%'::TEXT;
  ELSE
    -- Valid percentage allocation
    RETURN QUERY SELECT true, total_pct, 'Valid percentage allocation'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to explode a kit into its components with pricing
CREATE OR REPLACE FUNCTION explode_kit(
  p_parent_item_id UUID,
  p_total_price DECIMAL(12,2)
) RETURNS TABLE(
  component_item_id UUID,
  quantity DECIMAL(10,4),
  allocated_price DECIMAL(12,2),
  allocation_method TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kc.component_item_id,
    kc.quantity,
    CASE
      WHEN kc.is_separately_priced THEN kc.fixed_price
      WHEN kc.allocation_percentage IS NOT NULL THEN ROUND(p_total_price * kc.allocation_percentage, 2)
      ELSE NULL::DECIMAL(12,2)  -- Will need SSP calculation
    END as allocated_price,
    CASE
      WHEN kc.is_separately_priced THEN 'fixed'
      WHEN kc.allocation_percentage IS NOT NULL THEN 'percentage'
      ELSE 'ssp'
    END as allocation_method
  FROM kit_components kc
  WHERE kc.parent_item_id = p_parent_item_id;
END;
$$ LANGUAGE plpgsql;