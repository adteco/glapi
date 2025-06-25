-- Row Level Security Policies for Items System
-- This script should be run after the items tables are created

-- Enable RLS on all items-related tables
ALTER TABLE units_of_measure ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE lot_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE serial_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE assembly_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE kit_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_audit_log ENABLE ROW LEVEL SECURITY;

-- Function to get current organization_id from session
CREATE OR REPLACE FUNCTION get_current_organization_id()
RETURNS UUID AS $$
BEGIN
  RETURN COALESCE(
    current_setting('app.current_organization_id', true)::uuid,
    (auth.jwt() ->> 'organization_id')::uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Units of Measure RLS Policies
CREATE POLICY "Users can view their organization's units of measure"
  ON units_of_measure FOR SELECT
  USING (organization_id = get_current_organization_id());

CREATE POLICY "Users can create units of measure for their organization"
  ON units_of_measure FOR INSERT
  WITH CHECK (organization_id = get_current_organization_id());

CREATE POLICY "Users can update their organization's units of measure"
  ON units_of_measure FOR UPDATE
  USING (organization_id = get_current_organization_id())
  WITH CHECK (organization_id = get_current_organization_id());

CREATE POLICY "Users can delete their organization's units of measure"
  ON units_of_measure FOR DELETE
  USING (organization_id = get_current_organization_id());

-- Item Categories RLS Policies
CREATE POLICY "Users can view their organization's item categories"
  ON item_categories FOR SELECT
  USING (organization_id = get_current_organization_id());

CREATE POLICY "Users can create item categories for their organization"
  ON item_categories FOR INSERT
  WITH CHECK (organization_id = get_current_organization_id());

CREATE POLICY "Users can update their organization's item categories"
  ON item_categories FOR UPDATE
  USING (organization_id = get_current_organization_id())
  WITH CHECK (organization_id = get_current_organization_id());

CREATE POLICY "Users can delete their organization's item categories"
  ON item_categories FOR DELETE
  USING (organization_id = get_current_organization_id());

-- Items RLS Policies
CREATE POLICY "Users can view their organization's items"
  ON items FOR SELECT
  USING (organization_id = get_current_organization_id());

CREATE POLICY "Users can create items for their organization"
  ON items FOR INSERT
  WITH CHECK (organization_id = get_current_organization_id());

CREATE POLICY "Users can update their organization's items"
  ON items FOR UPDATE
  USING (organization_id = get_current_organization_id())
  WITH CHECK (organization_id = get_current_organization_id());

CREATE POLICY "Users can delete their organization's items"
  ON items FOR DELETE
  USING (organization_id = get_current_organization_id());

-- Price Lists RLS Policies
CREATE POLICY "Users can view their organization's price lists"
  ON price_lists FOR SELECT
  USING (organization_id = get_current_organization_id());

CREATE POLICY "Users can create price lists for their organization"
  ON price_lists FOR INSERT
  WITH CHECK (organization_id = get_current_organization_id());

CREATE POLICY "Users can update their organization's price lists"
  ON price_lists FOR UPDATE
  USING (organization_id = get_current_organization_id())
  WITH CHECK (organization_id = get_current_organization_id());

CREATE POLICY "Users can delete their organization's price lists"
  ON price_lists FOR DELETE
  USING (organization_id = get_current_organization_id());

-- Lot Numbers RLS Policies
CREATE POLICY "Users can view their organization's lot numbers"
  ON lot_numbers FOR SELECT
  USING (organization_id = get_current_organization_id());

CREATE POLICY "Users can create lot numbers for their organization"
  ON lot_numbers FOR INSERT
  WITH CHECK (organization_id = get_current_organization_id());

CREATE POLICY "Users can update their organization's lot numbers"
  ON lot_numbers FOR UPDATE
  USING (organization_id = get_current_organization_id())
  WITH CHECK (organization_id = get_current_organization_id());

CREATE POLICY "Users can delete their organization's lot numbers"
  ON lot_numbers FOR DELETE
  USING (organization_id = get_current_organization_id());

-- Serial Numbers RLS Policies
CREATE POLICY "Users can view their organization's serial numbers"
  ON serial_numbers FOR SELECT
  USING (organization_id = get_current_organization_id());

CREATE POLICY "Users can create serial numbers for their organization"
  ON serial_numbers FOR INSERT
  WITH CHECK (organization_id = get_current_organization_id());

CREATE POLICY "Users can update their organization's serial numbers"
  ON serial_numbers FOR UPDATE
  USING (organization_id = get_current_organization_id())
  WITH CHECK (organization_id = get_current_organization_id());

CREATE POLICY "Users can delete their organization's serial numbers"
  ON serial_numbers FOR DELETE
  USING (organization_id = get_current_organization_id());

-- Item Audit Log RLS Policies
CREATE POLICY "Users can view their organization's item audit logs"
  ON item_audit_log FOR SELECT
  USING (organization_id = get_current_organization_id());

CREATE POLICY "Users can create item audit logs for their organization"
  ON item_audit_log FOR INSERT
  WITH CHECK (organization_id = get_current_organization_id());

-- Helper function to check item organization ownership
CREATE OR REPLACE FUNCTION check_item_organization(item_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM items 
    WHERE id = item_id 
    AND organization_id = get_current_organization_id()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check price list organization ownership
CREATE OR REPLACE FUNCTION check_price_list_organization(price_list_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM price_lists 
    WHERE id = price_list_id 
    AND organization_id = get_current_organization_id()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check vendor organization ownership
CREATE OR REPLACE FUNCTION check_vendor_organization(vendor_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM entities 
    WHERE id = vendor_id 
    AND entity_type = 'vendor'
    AND organization_id = get_current_organization_id()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check customer organization ownership
CREATE OR REPLACE FUNCTION check_customer_organization(customer_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM entities 
    WHERE id = customer_id 
    AND entity_type = 'customer'
    AND organization_id = get_current_organization_id()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Item Pricing RLS Policies (uses item and price list ownership)
CREATE POLICY "Users can view item pricing for their organization"
  ON item_pricing FOR SELECT
  USING (
    check_item_organization(item_id) AND 
    check_price_list_organization(price_list_id)
  );

CREATE POLICY "Users can create item pricing for their organization"
  ON item_pricing FOR INSERT
  WITH CHECK (
    check_item_organization(item_id) AND 
    check_price_list_organization(price_list_id)
  );

CREATE POLICY "Users can update item pricing for their organization"
  ON item_pricing FOR UPDATE
  USING (
    check_item_organization(item_id) AND 
    check_price_list_organization(price_list_id)
  )
  WITH CHECK (
    check_item_organization(item_id) AND 
    check_price_list_organization(price_list_id)
  );

CREATE POLICY "Users can delete item pricing for their organization"
  ON item_pricing FOR DELETE
  USING (
    check_item_organization(item_id) AND 
    check_price_list_organization(price_list_id)
  );

-- Customer Price Lists RLS Policies
CREATE POLICY "Users can view customer price lists for their organization"
  ON customer_price_lists FOR SELECT
  USING (
    check_customer_organization(customer_id) AND
    check_price_list_organization(price_list_id)
  );

CREATE POLICY "Users can create customer price lists for their organization"
  ON customer_price_lists FOR INSERT
  WITH CHECK (
    check_customer_organization(customer_id) AND
    check_price_list_organization(price_list_id)
  );

CREATE POLICY "Users can update customer price lists for their organization"
  ON customer_price_lists FOR UPDATE
  USING (
    check_customer_organization(customer_id) AND
    check_price_list_organization(price_list_id)
  )
  WITH CHECK (
    check_customer_organization(customer_id) AND
    check_price_list_organization(price_list_id)
  );

CREATE POLICY "Users can delete customer price lists for their organization"
  ON customer_price_lists FOR DELETE
  USING (
    check_customer_organization(customer_id) AND
    check_price_list_organization(price_list_id)
  );

-- Vendor Items RLS Policies
CREATE POLICY "Users can view vendor items for their organization"
  ON vendor_items FOR SELECT
  USING (
    check_vendor_organization(vendor_id) AND
    check_item_organization(item_id)
  );

CREATE POLICY "Users can create vendor items for their organization"
  ON vendor_items FOR INSERT
  WITH CHECK (
    check_vendor_organization(vendor_id) AND
    check_item_organization(item_id)
  );

CREATE POLICY "Users can update vendor items for their organization"
  ON vendor_items FOR UPDATE
  USING (
    check_vendor_organization(vendor_id) AND
    check_item_organization(item_id)
  )
  WITH CHECK (
    check_vendor_organization(vendor_id) AND
    check_item_organization(item_id)
  );

CREATE POLICY "Users can delete vendor items for their organization"
  ON vendor_items FOR DELETE
  USING (
    check_vendor_organization(vendor_id) AND
    check_item_organization(item_id)
  );

-- Assembly Components RLS Policies
CREATE POLICY "Users can view assembly components for their organization"
  ON assembly_components FOR SELECT
  USING (
    check_item_organization(assembly_item_id) AND
    check_item_organization(component_item_id)
  );

CREATE POLICY "Users can create assembly components for their organization"
  ON assembly_components FOR INSERT
  WITH CHECK (
    check_item_organization(assembly_item_id) AND
    check_item_organization(component_item_id)
  );

CREATE POLICY "Users can update assembly components for their organization"
  ON assembly_components FOR UPDATE
  USING (
    check_item_organization(assembly_item_id) AND
    check_item_organization(component_item_id)
  )
  WITH CHECK (
    check_item_organization(assembly_item_id) AND
    check_item_organization(component_item_id)
  );

CREATE POLICY "Users can delete assembly components for their organization"
  ON assembly_components FOR DELETE
  USING (
    check_item_organization(assembly_item_id) AND
    check_item_organization(component_item_id)
  );

-- Kit Components RLS Policies
CREATE POLICY "Users can view kit components for their organization"
  ON kit_components FOR SELECT
  USING (
    check_item_organization(kit_item_id) AND
    check_item_organization(component_item_id)
  );

CREATE POLICY "Users can create kit components for their organization"
  ON kit_components FOR INSERT
  WITH CHECK (
    check_item_organization(kit_item_id) AND
    check_item_organization(component_item_id)
  );

CREATE POLICY "Users can update kit components for their organization"
  ON kit_components FOR UPDATE
  USING (
    check_item_organization(kit_item_id) AND
    check_item_organization(component_item_id)
  )
  WITH CHECK (
    check_item_organization(kit_item_id) AND
    check_item_organization(component_item_id)
  );

CREATE POLICY "Users can delete kit components for their organization"
  ON kit_components FOR DELETE
  USING (
    check_item_organization(kit_item_id) AND
    check_item_organization(component_item_id)
  );