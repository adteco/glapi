-- ============================================================================
-- Migration: Fix RLS Organization ID Type Mismatch
-- ============================================================================
-- Problem: The get_current_organization_id() function returns UUID and tries
-- to cast the session variable to UUID. But Clerk organization IDs are TEXT
-- (format: "org_xxxxx"), which cannot be cast to UUID.
--
-- Solution: Change get_current_organization_id() to return TEXT, and update
-- RLS policies to cast appropriately based on column type.
-- ============================================================================

-- ============================================================================
-- STEP 1: Update get_current_organization_id() to return TEXT
-- ============================================================================

CREATE OR REPLACE FUNCTION get_current_organization_id()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    current_setting('app.current_organization_id', true),
    (auth.jwt() ->> 'organization_id')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 2: Update helper functions that use get_current_organization_id()
-- ============================================================================

-- Helper function: Check workflow organization ownership
-- workflows.organization_id is UUID, so we need to cast
CREATE OR REPLACE FUNCTION check_workflow_organization(workflow_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  org_id_text TEXT;
BEGIN
  org_id_text := get_current_organization_id();
  -- Handle NULL or empty organization context
  IF org_id_text IS NULL OR org_id_text = '' THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM workflows w
    WHERE w.id = workflow_id
    AND (
      w.organization_id::text = org_id_text
      OR w.organization_id IS NULL  -- System templates accessible to all
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Check time entry organization ownership
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

-- Helper function: Check purchase order organization ownership
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

-- Helper function: Check receipt organization ownership
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

-- Helper function: Check project template organization ownership
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
-- STEP 3: Drop and recreate RLS policies with correct type handling
-- ============================================================================
-- For tables with UUID organization_id: compare organization_id::text = get_current_organization_id()
-- For tables with TEXT organization_id: compare organization_id = get_current_organization_id()

-- -----------------------------------------------------------------------------
-- Subsidiaries (TEXT column - was migrated)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "org_isolation_select_subsidiaries" ON subsidiaries;
DROP POLICY IF EXISTS "org_isolation_insert_subsidiaries" ON subsidiaries;
DROP POLICY IF EXISTS "org_isolation_update_subsidiaries" ON subsidiaries;
DROP POLICY IF EXISTS "org_isolation_delete_subsidiaries" ON subsidiaries;
DROP POLICY IF EXISTS "subsidiaries_org_isolation" ON subsidiaries;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_subsidiaries" ON subsidiaries
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_subsidiaries" ON subsidiaries
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_subsidiaries" ON subsidiaries
    FOR UPDATE USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_subsidiaries" ON subsidiaries
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Accounting Periods (UUID column)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "org_isolation_select_accounting_periods" ON accounting_periods;
DROP POLICY IF EXISTS "org_isolation_insert_accounting_periods" ON accounting_periods;
DROP POLICY IF EXISTS "org_isolation_update_accounting_periods" ON accounting_periods;
DROP POLICY IF EXISTS "org_isolation_delete_accounting_periods" ON accounting_periods;
DROP POLICY IF EXISTS "accounting_periods_org_isolation" ON accounting_periods;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_accounting_periods" ON accounting_periods
    FOR SELECT USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_accounting_periods" ON accounting_periods
    FOR INSERT WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_accounting_periods" ON accounting_periods
    FOR UPDATE USING (organization_id::text = get_current_organization_id())
    WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_accounting_periods" ON accounting_periods
    FOR DELETE USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Workflows (UUID column, with NULL handling for system templates)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "org_isolation_select_workflows" ON workflows;
DROP POLICY IF EXISTS "org_isolation_insert_workflows" ON workflows;
DROP POLICY IF EXISTS "org_isolation_update_workflows" ON workflows;
DROP POLICY IF EXISTS "org_isolation_delete_workflows" ON workflows;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_workflows" ON workflows
    FOR SELECT USING (
      organization_id::text = get_current_organization_id()
      OR organization_id IS NULL  -- System templates accessible to all
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_workflows" ON workflows
    FOR INSERT WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_workflows" ON workflows
    FOR UPDATE USING (organization_id::text = get_current_organization_id())
    WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_workflows" ON workflows
    FOR DELETE USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Classes (TEXT column - was migrated)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "org_isolation_select_classes" ON classes;
DROP POLICY IF EXISTS "org_isolation_insert_classes" ON classes;
DROP POLICY IF EXISTS "org_isolation_update_classes" ON classes;
DROP POLICY IF EXISTS "org_isolation_delete_classes" ON classes;
DROP POLICY IF EXISTS "classes_org_isolation" ON classes;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_classes" ON classes
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_classes" ON classes
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_classes" ON classes
    FOR UPDATE USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_classes" ON classes
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Departments (TEXT column - was migrated)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "org_isolation_select_departments" ON departments;
DROP POLICY IF EXISTS "org_isolation_insert_departments" ON departments;
DROP POLICY IF EXISTS "org_isolation_update_departments" ON departments;
DROP POLICY IF EXISTS "org_isolation_delete_departments" ON departments;
DROP POLICY IF EXISTS "departments_org_isolation" ON departments;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_departments" ON departments
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_departments" ON departments
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_departments" ON departments
    FOR UPDATE USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_departments" ON departments
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Locations (TEXT column - was migrated)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "org_isolation_select_locations" ON locations;
DROP POLICY IF EXISTS "org_isolation_insert_locations" ON locations;
DROP POLICY IF EXISTS "org_isolation_update_locations" ON locations;
DROP POLICY IF EXISTS "org_isolation_delete_locations" ON locations;
DROP POLICY IF EXISTS "locations_org_isolation" ON locations;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_locations" ON locations
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_locations" ON locations
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_locations" ON locations
    FOR UPDATE USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_locations" ON locations
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Customers (TEXT column - was migrated)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "org_isolation_select_customers" ON customers;
DROP POLICY IF EXISTS "org_isolation_insert_customers" ON customers;
DROP POLICY IF EXISTS "org_isolation_update_customers" ON customers;
DROP POLICY IF EXISTS "org_isolation_delete_customers" ON customers;
DROP POLICY IF EXISTS "customers_org_isolation" ON customers;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_customers" ON customers
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_customers" ON customers
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_customers" ON customers
    FOR UPDATE USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_customers" ON customers
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- GL Transactions (UUID column)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "org_isolation_select_gl_transactions" ON gl_transactions;
DROP POLICY IF EXISTS "org_isolation_insert_gl_transactions" ON gl_transactions;
DROP POLICY IF EXISTS "org_isolation_update_gl_transactions" ON gl_transactions;
DROP POLICY IF EXISTS "org_isolation_delete_gl_transactions" ON gl_transactions;
DROP POLICY IF EXISTS "gl_transactions_org_isolation" ON gl_transactions;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_gl_transactions" ON gl_transactions
    FOR SELECT USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_gl_transactions" ON gl_transactions
    FOR INSERT WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_gl_transactions" ON gl_transactions
    FOR UPDATE USING (organization_id::text = get_current_organization_id())
    WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_gl_transactions" ON gl_transactions
    FOR DELETE USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- GL Account Balances (UUID column)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "org_isolation_select_gl_account_balances" ON gl_account_balances;
DROP POLICY IF EXISTS "org_isolation_insert_gl_account_balances" ON gl_account_balances;
DROP POLICY IF EXISTS "org_isolation_update_gl_account_balances" ON gl_account_balances;
DROP POLICY IF EXISTS "org_isolation_delete_gl_account_balances" ON gl_account_balances;
DROP POLICY IF EXISTS "gl_account_balances_org_isolation" ON gl_account_balances;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_gl_account_balances" ON gl_account_balances
    FOR SELECT USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_gl_account_balances" ON gl_account_balances
    FOR INSERT WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_gl_account_balances" ON gl_account_balances
    FOR UPDATE USING (organization_id::text = get_current_organization_id())
    WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_gl_account_balances" ON gl_account_balances
    FOR DELETE USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Contracts (UUID column)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "org_isolation_select_contracts" ON contracts;
DROP POLICY IF EXISTS "org_isolation_insert_contracts" ON contracts;
DROP POLICY IF EXISTS "org_isolation_update_contracts" ON contracts;
DROP POLICY IF EXISTS "org_isolation_delete_contracts" ON contracts;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_contracts" ON contracts
    FOR SELECT USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_contracts" ON contracts
    FOR INSERT WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_contracts" ON contracts
    FOR UPDATE USING (organization_id::text = get_current_organization_id())
    WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_contracts" ON contracts
    FOR DELETE USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Invoices (UUID column)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "org_isolation_select_invoices" ON invoices;
DROP POLICY IF EXISTS "org_isolation_insert_invoices" ON invoices;
DROP POLICY IF EXISTS "org_isolation_update_invoices" ON invoices;
DROP POLICY IF EXISTS "org_isolation_delete_invoices" ON invoices;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_invoices" ON invoices
    FOR SELECT USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_invoices" ON invoices
    FOR INSERT WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_invoices" ON invoices
    FOR UPDATE USING (organization_id::text = get_current_organization_id())
    WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_invoices" ON invoices
    FOR DELETE USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Time Entries (UUID column)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "org_isolation_select_time_entries" ON time_entries;
DROP POLICY IF EXISTS "org_isolation_insert_time_entries" ON time_entries;
DROP POLICY IF EXISTS "org_isolation_update_time_entries" ON time_entries;
DROP POLICY IF EXISTS "org_isolation_delete_time_entries" ON time_entries;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_time_entries" ON time_entries
    FOR SELECT USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_time_entries" ON time_entries
    FOR INSERT WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_time_entries" ON time_entries
    FOR UPDATE USING (organization_id::text = get_current_organization_id())
    WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_time_entries" ON time_entries
    FOR DELETE USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Purchase Orders (UUID column)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "org_isolation_select_purchase_orders" ON purchase_orders;
DROP POLICY IF EXISTS "org_isolation_insert_purchase_orders" ON purchase_orders;
DROP POLICY IF EXISTS "org_isolation_update_purchase_orders" ON purchase_orders;
DROP POLICY IF EXISTS "org_isolation_delete_purchase_orders" ON purchase_orders;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_purchase_orders" ON purchase_orders
    FOR SELECT USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_purchase_orders" ON purchase_orders
    FOR INSERT WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_purchase_orders" ON purchase_orders
    FOR UPDATE USING (organization_id::text = get_current_organization_id())
    WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_purchase_orders" ON purchase_orders
    FOR DELETE USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Purchase Order Receipts (UUID column)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "org_isolation_select_po_receipts" ON purchase_order_receipts;
DROP POLICY IF EXISTS "org_isolation_insert_po_receipts" ON purchase_order_receipts;
DROP POLICY IF EXISTS "org_isolation_update_po_receipts" ON purchase_order_receipts;
DROP POLICY IF EXISTS "org_isolation_delete_po_receipts" ON purchase_order_receipts;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_po_receipts" ON purchase_order_receipts
    FOR SELECT USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_po_receipts" ON purchase_order_receipts
    FOR INSERT WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_po_receipts" ON purchase_order_receipts
    FOR UPDATE USING (organization_id::text = get_current_organization_id())
    WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_po_receipts" ON purchase_order_receipts
    FOR DELETE USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Labor Cost Rates (UUID column)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "org_isolation_select_labor_cost_rates" ON labor_cost_rates;
DROP POLICY IF EXISTS "org_isolation_insert_labor_cost_rates" ON labor_cost_rates;
DROP POLICY IF EXISTS "org_isolation_update_labor_cost_rates" ON labor_cost_rates;
DROP POLICY IF EXISTS "org_isolation_delete_labor_cost_rates" ON labor_cost_rates;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_labor_cost_rates" ON labor_cost_rates
    FOR SELECT USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_labor_cost_rates" ON labor_cost_rates
    FOR INSERT WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_labor_cost_rates" ON labor_cost_rates
    FOR UPDATE USING (organization_id::text = get_current_organization_id())
    WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_labor_cost_rates" ON labor_cost_rates
    FOR DELETE USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Employee Project Assignments (UUID column)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "org_isolation_select_emp_project_assignments" ON employee_project_assignments;
DROP POLICY IF EXISTS "org_isolation_insert_emp_project_assignments" ON employee_project_assignments;
DROP POLICY IF EXISTS "org_isolation_update_emp_project_assignments" ON employee_project_assignments;
DROP POLICY IF EXISTS "org_isolation_delete_emp_project_assignments" ON employee_project_assignments;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_emp_project_assignments" ON employee_project_assignments
    FOR SELECT USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_emp_project_assignments" ON employee_project_assignments
    FOR INSERT WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_emp_project_assignments" ON employee_project_assignments
    FOR UPDATE USING (organization_id::text = get_current_organization_id())
    WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_emp_project_assignments" ON employee_project_assignments
    FOR DELETE USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Time Entry Batches (UUID column)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "org_isolation_select_time_entry_batches" ON time_entry_batches;
DROP POLICY IF EXISTS "org_isolation_insert_time_entry_batches" ON time_entry_batches;
DROP POLICY IF EXISTS "org_isolation_update_time_entry_batches" ON time_entry_batches;
DROP POLICY IF EXISTS "org_isolation_delete_time_entry_batches" ON time_entry_batches;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_time_entry_batches" ON time_entry_batches
    FOR SELECT USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_time_entry_batches" ON time_entry_batches
    FOR INSERT WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_time_entry_batches" ON time_entry_batches
    FOR UPDATE USING (organization_id::text = get_current_organization_id())
    WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_time_entry_batches" ON time_entry_batches
    FOR DELETE USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Project Milestones (UUID column)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "org_isolation_select_project_milestones" ON project_milestones;
DROP POLICY IF EXISTS "org_isolation_insert_project_milestones" ON project_milestones;
DROP POLICY IF EXISTS "org_isolation_update_project_milestones" ON project_milestones;
DROP POLICY IF EXISTS "org_isolation_delete_project_milestones" ON project_milestones;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_project_milestones" ON project_milestones
    FOR SELECT USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_project_milestones" ON project_milestones
    FOR INSERT WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_project_milestones" ON project_milestones
    FOR UPDATE USING (organization_id::text = get_current_organization_id())
    WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_project_milestones" ON project_milestones
    FOR DELETE USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Project Task Templates (UUID column)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "org_isolation_select_project_task_templates" ON project_task_templates;
DROP POLICY IF EXISTS "org_isolation_insert_project_task_templates" ON project_task_templates;
DROP POLICY IF EXISTS "org_isolation_update_project_task_templates" ON project_task_templates;
DROP POLICY IF EXISTS "org_isolation_delete_project_task_templates" ON project_task_templates;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_project_task_templates" ON project_task_templates
    FOR SELECT USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_project_task_templates" ON project_task_templates
    FOR INSERT WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_project_task_templates" ON project_task_templates
    FOR UPDATE USING (organization_id::text = get_current_organization_id())
    WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_project_task_templates" ON project_task_templates
    FOR DELETE USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Project Tasks (UUID column)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "org_isolation_select_project_tasks" ON project_tasks;
DROP POLICY IF EXISTS "org_isolation_insert_project_tasks" ON project_tasks;
DROP POLICY IF EXISTS "org_isolation_update_project_tasks" ON project_tasks;
DROP POLICY IF EXISTS "org_isolation_delete_project_tasks" ON project_tasks;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_project_tasks" ON project_tasks
    FOR SELECT USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_project_tasks" ON project_tasks
    FOR INSERT WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_project_tasks" ON project_tasks
    FOR UPDATE USING (organization_id::text = get_current_organization_id())
    WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_project_tasks" ON project_tasks
    FOR DELETE USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Project Templates (UUID column)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "org_isolation_select_project_templates" ON project_templates;
DROP POLICY IF EXISTS "org_isolation_insert_project_templates" ON project_templates;
DROP POLICY IF EXISTS "org_isolation_update_project_templates" ON project_templates;
DROP POLICY IF EXISTS "org_isolation_delete_project_templates" ON project_templates;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_project_templates" ON project_templates
    FOR SELECT USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_project_templates" ON project_templates
    FOR INSERT WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_project_templates" ON project_templates
    FOR UPDATE USING (organization_id::text = get_current_organization_id())
    WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_project_templates" ON project_templates
    FOR DELETE USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Entity Tasks (UUID column)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "org_isolation_select_entity_tasks" ON entity_tasks;
DROP POLICY IF EXISTS "org_isolation_insert_entity_tasks" ON entity_tasks;
DROP POLICY IF EXISTS "org_isolation_update_entity_tasks" ON entity_tasks;
DROP POLICY IF EXISTS "org_isolation_delete_entity_tasks" ON entity_tasks;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_entity_tasks" ON entity_tasks
    FOR SELECT USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_entity_tasks" ON entity_tasks
    FOR INSERT WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_entity_tasks" ON entity_tasks
    FOR UPDATE USING (organization_id::text = get_current_organization_id())
    WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_entity_tasks" ON entity_tasks
    FOR DELETE USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Task Field Definitions (UUID column)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "org_isolation_select_task_field_definitions" ON task_field_definitions;
DROP POLICY IF EXISTS "org_isolation_insert_task_field_definitions" ON task_field_definitions;
DROP POLICY IF EXISTS "org_isolation_update_task_field_definitions" ON task_field_definitions;
DROP POLICY IF EXISTS "org_isolation_delete_task_field_definitions" ON task_field_definitions;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_task_field_definitions" ON task_field_definitions
    FOR SELECT USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_task_field_definitions" ON task_field_definitions
    FOR INSERT WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_task_field_definitions" ON task_field_definitions
    FOR UPDATE USING (organization_id::text = get_current_organization_id())
    WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_task_field_definitions" ON task_field_definitions
    FOR DELETE USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Task Templates (UUID column)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "org_isolation_select_task_templates" ON task_templates;
DROP POLICY IF EXISTS "org_isolation_insert_task_templates" ON task_templates;
DROP POLICY IF EXISTS "org_isolation_update_task_templates" ON task_templates;
DROP POLICY IF EXISTS "org_isolation_delete_task_templates" ON task_templates;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_task_templates" ON task_templates
    FOR SELECT USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_task_templates" ON task_templates
    FOR INSERT WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_task_templates" ON task_templates
    FOR UPDATE USING (organization_id::text = get_current_organization_id())
    WITH CHECK (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_task_templates" ON task_templates
    FOR DELETE USING (organization_id::text = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
