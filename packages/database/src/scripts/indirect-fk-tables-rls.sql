-- ============================================================================
-- Indirect FK Tables Row Level Security Policies
-- ============================================================================
-- Tables that don't have organization_id directly but access it via FK chains:
--
-- price_list_labor_rates -> price_lists (org_id)
-- customer_price_lists -> price_lists (org_id) OR entities (org_id)
-- warehouse_price_lists -> warehouses (org_id) OR price_lists (org_id)
-- customer_accounting_lists -> accounting_lists (org_id)
-- charge_types_details -> accounting_lists (org_id)
-- modification_line_items -> contract_modifications (org_id)
-- business_transactions -> entities (org_id)
-- business_transaction_lines -> business_transactions -> entities
-- transaction_relationships -> business_transactions -> entities
-- transaction_lines -> performance_obligations chain
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check price_list organization ownership
CREATE OR REPLACE FUNCTION check_price_list_org(pl_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM price_lists
    WHERE id = pl_id
    AND organization_id = get_current_organization_id()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check accounting_list organization ownership
CREATE OR REPLACE FUNCTION check_accounting_list_org(al_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM accounting_lists
    WHERE id = al_id
    AND organization_id = get_current_organization_id()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check contract_modification organization ownership
CREATE OR REPLACE FUNCTION check_contract_modification_org(cm_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM contract_modifications
    WHERE id = cm_id
    AND organization_id = get_current_organization_id()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check entity organization ownership
CREATE OR REPLACE FUNCTION check_entity_org(e_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM entities
    WHERE id = e_id
    AND organization_id = get_current_organization_id()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check warehouse organization ownership
CREATE OR REPLACE FUNCTION check_warehouse_org(w_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM warehouses
    WHERE id = w_id
    AND organization_id = get_current_organization_id()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check business_transaction organization ownership (via entity)
CREATE OR REPLACE FUNCTION check_business_transaction_org(bt_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM business_transactions bt
    JOIN entities e ON bt.entity_id = e.id
    WHERE bt.id = bt_id
    AND e.organization_id = get_current_organization_id()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PRICE_LIST_LABOR_RATES (Indirect via price_lists)
-- ============================================================================

ALTER TABLE price_list_labor_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_list_labor_rates FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_price_list_labor_rates" ON price_list_labor_rates
    FOR SELECT USING (check_price_list_org(price_list_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_price_list_labor_rates already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_price_list_labor_rates" ON price_list_labor_rates
    FOR INSERT WITH CHECK (check_price_list_org(price_list_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_price_list_labor_rates already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_price_list_labor_rates" ON price_list_labor_rates
    FOR UPDATE
    USING (check_price_list_org(price_list_id))
    WITH CHECK (check_price_list_org(price_list_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_price_list_labor_rates already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_price_list_labor_rates" ON price_list_labor_rates
    FOR DELETE USING (check_price_list_org(price_list_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_price_list_labor_rates already exists, skipping.';
END $$;

-- ============================================================================
-- CUSTOMER_PRICE_LISTS (Indirect via entities)
-- ============================================================================

ALTER TABLE customer_price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_price_lists FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_customer_price_lists" ON customer_price_lists
    FOR SELECT USING (check_entity_org(customer_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_customer_price_lists already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_customer_price_lists" ON customer_price_lists
    FOR INSERT WITH CHECK (check_entity_org(customer_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_customer_price_lists already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_customer_price_lists" ON customer_price_lists
    FOR UPDATE
    USING (check_entity_org(customer_id))
    WITH CHECK (check_entity_org(customer_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_customer_price_lists already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_customer_price_lists" ON customer_price_lists
    FOR DELETE USING (check_entity_org(customer_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_customer_price_lists already exists, skipping.';
END $$;

-- ============================================================================
-- WAREHOUSE_PRICE_LISTS (Indirect via warehouses)
-- ============================================================================

ALTER TABLE warehouse_price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_price_lists FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_warehouse_price_lists" ON warehouse_price_lists
    FOR SELECT USING (check_warehouse_org(warehouse_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_warehouse_price_lists already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_warehouse_price_lists" ON warehouse_price_lists
    FOR INSERT WITH CHECK (check_warehouse_org(warehouse_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_warehouse_price_lists already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_warehouse_price_lists" ON warehouse_price_lists
    FOR UPDATE
    USING (check_warehouse_org(warehouse_id))
    WITH CHECK (check_warehouse_org(warehouse_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_warehouse_price_lists already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_warehouse_price_lists" ON warehouse_price_lists
    FOR DELETE USING (check_warehouse_org(warehouse_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_warehouse_price_lists already exists, skipping.';
END $$;

-- ============================================================================
-- CUSTOMER_ACCOUNTING_LISTS (Indirect via entities)
-- ============================================================================

ALTER TABLE customer_accounting_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_accounting_lists FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_customer_accounting_lists" ON customer_accounting_lists
    FOR SELECT USING (check_entity_org(customer_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_customer_accounting_lists already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_customer_accounting_lists" ON customer_accounting_lists
    FOR INSERT WITH CHECK (check_entity_org(customer_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_customer_accounting_lists already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_customer_accounting_lists" ON customer_accounting_lists
    FOR UPDATE
    USING (check_entity_org(customer_id))
    WITH CHECK (check_entity_org(customer_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_customer_accounting_lists already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_customer_accounting_lists" ON customer_accounting_lists
    FOR DELETE USING (check_entity_org(customer_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_customer_accounting_lists already exists, skipping.';
END $$;

-- ============================================================================
-- CHARGE_TYPES_DETAILS (Indirect via accounting_lists)
-- ============================================================================

ALTER TABLE charge_types_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE charge_types_details FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_charge_types_details" ON charge_types_details
    FOR SELECT USING (check_accounting_list_org(accounting_list_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_charge_types_details already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_charge_types_details" ON charge_types_details
    FOR INSERT WITH CHECK (check_accounting_list_org(accounting_list_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_charge_types_details already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_charge_types_details" ON charge_types_details
    FOR UPDATE
    USING (check_accounting_list_org(accounting_list_id))
    WITH CHECK (check_accounting_list_org(accounting_list_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_charge_types_details already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_charge_types_details" ON charge_types_details
    FOR DELETE USING (check_accounting_list_org(accounting_list_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_charge_types_details already exists, skipping.';
END $$;

-- ============================================================================
-- MODIFICATION_LINE_ITEMS (Indirect via contract_modifications)
-- ============================================================================

ALTER TABLE modification_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE modification_line_items FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_modification_line_items" ON modification_line_items
    FOR SELECT USING (check_contract_modification_org(modification_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_modification_line_items already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_modification_line_items" ON modification_line_items
    FOR INSERT WITH CHECK (check_contract_modification_org(modification_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_modification_line_items already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_modification_line_items" ON modification_line_items
    FOR UPDATE
    USING (check_contract_modification_org(modification_id))
    WITH CHECK (check_contract_modification_org(modification_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_modification_line_items already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_modification_line_items" ON modification_line_items
    FOR DELETE USING (check_contract_modification_org(modification_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_modification_line_items already exists, skipping.';
END $$;

-- ============================================================================
-- BUSINESS_TRANSACTIONS (Indirect via entities)
-- ============================================================================

ALTER TABLE business_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_transactions FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_business_transactions" ON business_transactions
    FOR SELECT USING (check_entity_org(entity_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_business_transactions already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_business_transactions" ON business_transactions
    FOR INSERT WITH CHECK (check_entity_org(entity_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_business_transactions already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_business_transactions" ON business_transactions
    FOR UPDATE
    USING (check_entity_org(entity_id))
    WITH CHECK (check_entity_org(entity_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_business_transactions already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_business_transactions" ON business_transactions
    FOR DELETE USING (check_entity_org(entity_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_business_transactions already exists, skipping.';
END $$;

-- ============================================================================
-- BUSINESS_TRANSACTION_LINES (Indirect via business_transactions -> entities)
-- ============================================================================

ALTER TABLE business_transaction_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_transaction_lines FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_business_transaction_lines" ON business_transaction_lines
    FOR SELECT USING (check_business_transaction_org(business_transaction_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_business_transaction_lines already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_business_transaction_lines" ON business_transaction_lines
    FOR INSERT WITH CHECK (check_business_transaction_org(business_transaction_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_business_transaction_lines already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_business_transaction_lines" ON business_transaction_lines
    FOR UPDATE
    USING (check_business_transaction_org(business_transaction_id))
    WITH CHECK (check_business_transaction_org(business_transaction_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_business_transaction_lines already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_business_transaction_lines" ON business_transaction_lines
    FOR DELETE USING (check_business_transaction_org(business_transaction_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_business_transaction_lines already exists, skipping.';
END $$;

-- ============================================================================
-- TRANSACTION_RELATIONSHIPS (Indirect via business_transactions -> entities)
-- ============================================================================

ALTER TABLE transaction_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_relationships FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_transaction_relationships" ON transaction_relationships
    FOR SELECT USING (check_business_transaction_org(parent_transaction_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_transaction_relationships already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_transaction_relationships" ON transaction_relationships
    FOR INSERT WITH CHECK (check_business_transaction_org(parent_transaction_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_transaction_relationships already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_transaction_relationships" ON transaction_relationships
    FOR UPDATE
    USING (check_business_transaction_org(parent_transaction_id))
    WITH CHECK (check_business_transaction_org(parent_transaction_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_transaction_relationships already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_transaction_relationships" ON transaction_relationships
    FOR DELETE USING (check_business_transaction_org(parent_transaction_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_transaction_relationships already exists, skipping.';
END $$;

-- ============================================================================
-- TRANSACTION_LINES (Indirect via performance_obligations chain)
-- Note: Uses check_performance_obligation_organization from revenue-recognition-rls.sql
-- ============================================================================

ALTER TABLE transaction_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_lines FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_transaction_lines" ON transaction_lines
    FOR SELECT USING (
      performance_obligation_id IS NULL
      OR check_performance_obligation_organization(performance_obligation_id)
    );
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_transaction_lines already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_transaction_lines" ON transaction_lines
    FOR INSERT WITH CHECK (
      performance_obligation_id IS NULL
      OR check_performance_obligation_organization(performance_obligation_id)
    );
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_transaction_lines already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_transaction_lines" ON transaction_lines
    FOR UPDATE
    USING (
      performance_obligation_id IS NULL
      OR check_performance_obligation_organization(performance_obligation_id)
    )
    WITH CHECK (
      performance_obligation_id IS NULL
      OR check_performance_obligation_organization(performance_obligation_id)
    );
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_transaction_lines already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_transaction_lines" ON transaction_lines
    FOR DELETE USING (
      performance_obligation_id IS NULL
      OR check_performance_obligation_organization(performance_obligation_id)
    );
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_transaction_lines already exists, skipping.';
END $$;

-- ============================================================================
-- NOTES
-- ============================================================================
-- products: GLOBAL table (no organization_id) - NO RLS needed
-- organizations: This IS the org table itself - requires special handling
-- See products-organizations-rls.sql for special cases
-- ============================================================================
