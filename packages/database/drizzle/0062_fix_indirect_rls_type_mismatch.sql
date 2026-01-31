-- ============================================================================
-- Migration: Fix Indirect FK RLS Helper Functions Type Mismatch
-- ============================================================================
-- Problem: The indirect FK helper functions (check_entity_org, check_price_list_org,
-- etc.) were not updated when get_current_organization_id() was changed to return
-- TEXT in migration 0050. This causes type mismatches when comparing UUID columns
-- with TEXT values.
--
-- Solution: Update all indirect FK helper functions to cast UUID columns to TEXT
-- before comparison with get_current_organization_id().
-- ============================================================================

-- ============================================================================
-- Update check_entity_org to handle UUID -> TEXT comparison
-- ============================================================================

CREATE OR REPLACE FUNCTION check_entity_org(e_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  org_id_text TEXT;
BEGIN
  org_id_text := get_current_organization_id();
  IF org_id_text IS NULL OR org_id_text = '' THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM entities
    WHERE id = e_id
    AND organization_id::text = org_id_text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Update check_price_list_org to handle UUID -> TEXT comparison
-- ============================================================================

CREATE OR REPLACE FUNCTION check_price_list_org(pl_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  org_id_text TEXT;
BEGIN
  org_id_text := get_current_organization_id();
  IF org_id_text IS NULL OR org_id_text = '' THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM price_lists
    WHERE id = pl_id
    AND organization_id::text = org_id_text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Update check_accounting_list_org to handle UUID -> TEXT comparison
-- ============================================================================

CREATE OR REPLACE FUNCTION check_accounting_list_org(al_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  org_id_text TEXT;
BEGIN
  org_id_text := get_current_organization_id();
  IF org_id_text IS NULL OR org_id_text = '' THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM accounting_lists
    WHERE id = al_id
    AND organization_id::text = org_id_text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Update check_contract_modification_org to handle UUID -> TEXT comparison
-- ============================================================================

CREATE OR REPLACE FUNCTION check_contract_modification_org(cm_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  org_id_text TEXT;
BEGIN
  org_id_text := get_current_organization_id();
  IF org_id_text IS NULL OR org_id_text = '' THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM contract_modifications
    WHERE id = cm_id
    AND organization_id::text = org_id_text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Update check_warehouse_org to handle UUID -> TEXT comparison
-- ============================================================================

CREATE OR REPLACE FUNCTION check_warehouse_org(w_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  org_id_text TEXT;
BEGIN
  org_id_text := get_current_organization_id();
  IF org_id_text IS NULL OR org_id_text = '' THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM warehouses
    WHERE id = w_id
    AND organization_id::text = org_id_text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Update check_business_transaction_org to handle UUID -> TEXT comparison
-- ============================================================================

CREATE OR REPLACE FUNCTION check_business_transaction_org(bt_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  org_id_text TEXT;
BEGIN
  org_id_text := get_current_organization_id();
  IF org_id_text IS NULL OR org_id_text = '' THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM business_transactions bt
    JOIN entities e ON bt.entity_id = e.id
    WHERE bt.id = bt_id
    AND e.organization_id::text = org_id_text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
