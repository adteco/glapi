-- ============================================================================
-- Migration: Fix Remaining RLS Helper Functions Type Mismatch
-- ============================================================================
-- Problem: Additional indirect FK helper functions were not updated when
-- get_current_organization_id() was changed to return TEXT in migration 0050.
-- Migration 0062 fixed some but not all helper functions.
--
-- Solution: Update remaining helper functions to cast UUID columns to TEXT
-- before comparison with get_current_organization_id().
--
-- Part of Phase 5 type centralization (glapi-b1eq)
-- ============================================================================

-- ============================================================================
-- Update check_workflow_organization
-- ============================================================================

CREATE OR REPLACE FUNCTION check_workflow_organization(workflow_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  org_id_text TEXT;
BEGIN
  org_id_text := get_current_organization_id();
  IF org_id_text IS NULL OR org_id_text = '' THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM workflows
    WHERE id = workflow_id
    AND (
      organization_id::text = org_id_text
      OR organization_id IS NULL  -- System templates are accessible to all
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Update check_time_entry_organization
-- ============================================================================

CREATE OR REPLACE FUNCTION check_time_entry_organization(time_entry_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  org_id_text TEXT;
BEGIN
  org_id_text := get_current_organization_id();
  IF org_id_text IS NULL OR org_id_text = '' THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM time_entries
    WHERE id = time_entry_id
    AND organization_id::text = org_id_text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Update check_purchase_order_organization
-- ============================================================================

CREATE OR REPLACE FUNCTION check_purchase_order_organization(purchase_order_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  org_id_text TEXT;
BEGIN
  org_id_text := get_current_organization_id();
  IF org_id_text IS NULL OR org_id_text = '' THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM purchase_orders
    WHERE id = purchase_order_id
    AND organization_id::text = org_id_text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Update check_receipt_organization
-- ============================================================================

CREATE OR REPLACE FUNCTION check_receipt_organization(receipt_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  org_id_text TEXT;
BEGIN
  org_id_text := get_current_organization_id();
  IF org_id_text IS NULL OR org_id_text = '' THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM purchase_order_receipts
    WHERE id = receipt_id
    AND organization_id::text = org_id_text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Update check_project_template_organization
-- ============================================================================

CREATE OR REPLACE FUNCTION check_project_template_organization(project_template_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  org_id_text TEXT;
BEGIN
  org_id_text := get_current_organization_id();
  IF org_id_text IS NULL OR org_id_text = '' THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM project_templates
    WHERE id = project_template_id
    AND organization_id::text = org_id_text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Update check_performance_obligation_organization
-- Note: performance_obligations.organization_id may be TEXT, check and handle
-- ============================================================================

CREATE OR REPLACE FUNCTION check_performance_obligation_organization(po_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  org_id_text TEXT;
BEGIN
  org_id_text := get_current_organization_id();
  IF org_id_text IS NULL OR org_id_text = '' THEN
    RETURN FALSE;
  END IF;

  -- performance_obligations.id is TEXT, organization_id may be UUID or TEXT
  RETURN EXISTS (
    SELECT 1 FROM performance_obligations
    WHERE id = po_id
    AND organization_id::text = org_id_text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
