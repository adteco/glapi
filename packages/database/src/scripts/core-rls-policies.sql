-- ============================================================================
-- Core Row Level Security Policies
-- ============================================================================
-- This script implements RLS policies for core business tables.
-- Run this AFTER the items-rls-policies.sql script which defines the
-- get_current_organization_id() function.
--
-- Tables covered (Priority 1-5 from RLS Audit):
--   Priority 1: Core Financial - contracts, invoices
--   Priority 2: Accounting - accounts
--   Priority 3: Procure-to-Pay - purchase_orders, purchase_order_receipts
--   Priority 5: Time Tracking - time_entries, labor_cost_rates,
--               employee_project_assignments, time_entry_batches
--   Priority 7: Project Tasks - project_milestones, project_task_templates,
--               project_tasks, project_templates
--   Infrastructure: entities, entity_tasks, task_field_definitions,
--                   task_templates, workflows, workflow_groups, workflow_components
--
-- IMPORTANT: Wraps all policy creation in DO blocks with exception handling
-- to provide idempotent behavior (IF NOT EXISTS equivalent).
-- ============================================================================

-- ============================================================================
-- Ensure get_current_organization_id() function exists
-- (Should already exist from items-rls-policies.sql, but included for safety)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_current_organization_id()
RETURNS UUID AS $$
BEGIN
  RETURN COALESCE(
    current_setting('app.current_organization_id', true)::uuid,
    (auth.jwt() ->> 'organization_id')::uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Helper function: Check workflow organization ownership
-- Used for indirect RLS on workflow_groups and workflow_components
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
-- Helper function: Check time entry organization ownership
-- Used for indirect RLS on time_entry_approvals
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
-- Helper function: Check purchase order organization ownership
-- Used for indirect RLS on purchase_order_lines and purchase_order_approval_history
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
-- Helper function: Check receipt organization ownership
-- Used for indirect RLS on purchase_order_receipt_lines
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
-- SECTION 1: CORE ENTITIES (entities table)
-- Note: entities.organization_id is TEXT, not UUID, so we use text comparison
-- ============================================================================

-- Enable RLS
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_entities" ON entities
    FOR SELECT USING (organization_id = get_current_organization_id()::text);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_entities already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_entities" ON entities
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id()::text);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_entities already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_entities" ON entities
    FOR UPDATE
    USING (organization_id = get_current_organization_id()::text)
    WITH CHECK (organization_id = get_current_organization_id()::text);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_entities already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_entities" ON entities
    FOR DELETE USING (organization_id = get_current_organization_id()::text);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_entities already exists, skipping.';
END $$;

-- ============================================================================
-- SECTION 2: PRIORITY 1 - CORE FINANCIAL (contracts, invoices)
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Contracts RLS Policies
-- -----------------------------------------------------------------------------

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_contracts" ON contracts
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_contracts already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_contracts" ON contracts
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_contracts already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_contracts" ON contracts
    FOR UPDATE
    USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_contracts already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_contracts" ON contracts
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_contracts already exists, skipping.';
END $$;

-- -----------------------------------------------------------------------------
-- Invoices RLS Policies
-- -----------------------------------------------------------------------------

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_invoices" ON invoices
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_invoices already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_invoices" ON invoices
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_invoices already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_invoices" ON invoices
    FOR UPDATE
    USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_invoices already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_invoices" ON invoices
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_invoices already exists, skipping.';
END $$;

-- ============================================================================
-- SECTION 3: PRIORITY 2 - ACCOUNTING (accounts)
-- Note: accounts.organization_id is TEXT, not UUID
-- ============================================================================

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_accounts" ON accounts
    FOR SELECT USING (organization_id = get_current_organization_id()::text);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_accounts already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_accounts" ON accounts
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id()::text);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_accounts already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_accounts" ON accounts
    FOR UPDATE
    USING (organization_id = get_current_organization_id()::text)
    WITH CHECK (organization_id = get_current_organization_id()::text);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_accounts already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_accounts" ON accounts
    FOR DELETE USING (organization_id = get_current_organization_id()::text);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_accounts already exists, skipping.';
END $$;

-- ============================================================================
-- SECTION 4: PRIORITY 3 - PROCURE-TO-PAY
-- (purchase_orders, purchase_order_lines, purchase_order_receipts,
--  purchase_order_receipt_lines, purchase_order_approval_history)
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Purchase Orders RLS Policies
-- -----------------------------------------------------------------------------

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_purchase_orders" ON purchase_orders
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_purchase_orders already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_purchase_orders" ON purchase_orders
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_purchase_orders already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_purchase_orders" ON purchase_orders
    FOR UPDATE
    USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_purchase_orders already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_purchase_orders" ON purchase_orders
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_purchase_orders already exists, skipping.';
END $$;

-- -----------------------------------------------------------------------------
-- Purchase Order Lines RLS Policies (Indirect via PO)
-- -----------------------------------------------------------------------------

ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_lines FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_po_lines" ON purchase_order_lines
    FOR SELECT USING (check_purchase_order_organization(purchase_order_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_po_lines already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_po_lines" ON purchase_order_lines
    FOR INSERT WITH CHECK (check_purchase_order_organization(purchase_order_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_po_lines already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_po_lines" ON purchase_order_lines
    FOR UPDATE
    USING (check_purchase_order_organization(purchase_order_id))
    WITH CHECK (check_purchase_order_organization(purchase_order_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_po_lines already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_po_lines" ON purchase_order_lines
    FOR DELETE USING (check_purchase_order_organization(purchase_order_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_po_lines already exists, skipping.';
END $$;

-- -----------------------------------------------------------------------------
-- Purchase Order Receipts RLS Policies
-- -----------------------------------------------------------------------------

ALTER TABLE purchase_order_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_receipts FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_po_receipts" ON purchase_order_receipts
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_po_receipts already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_po_receipts" ON purchase_order_receipts
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_po_receipts already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_po_receipts" ON purchase_order_receipts
    FOR UPDATE
    USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_po_receipts already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_po_receipts" ON purchase_order_receipts
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_po_receipts already exists, skipping.';
END $$;

-- -----------------------------------------------------------------------------
-- Purchase Order Receipt Lines RLS Policies (Indirect via Receipt)
-- -----------------------------------------------------------------------------

ALTER TABLE purchase_order_receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_receipt_lines FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_po_receipt_lines" ON purchase_order_receipt_lines
    FOR SELECT USING (check_receipt_organization(receipt_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_po_receipt_lines already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_po_receipt_lines" ON purchase_order_receipt_lines
    FOR INSERT WITH CHECK (check_receipt_organization(receipt_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_po_receipt_lines already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_po_receipt_lines" ON purchase_order_receipt_lines
    FOR UPDATE
    USING (check_receipt_organization(receipt_id))
    WITH CHECK (check_receipt_organization(receipt_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_po_receipt_lines already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_po_receipt_lines" ON purchase_order_receipt_lines
    FOR DELETE USING (check_receipt_organization(receipt_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_po_receipt_lines already exists, skipping.';
END $$;

-- -----------------------------------------------------------------------------
-- Purchase Order Approval History RLS Policies (Indirect via PO, Append-only)
-- Note: Audit tables should ideally be SELECT + INSERT only
-- -----------------------------------------------------------------------------

ALTER TABLE purchase_order_approval_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_approval_history FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_po_approval_history" ON purchase_order_approval_history
    FOR SELECT USING (check_purchase_order_organization(purchase_order_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_po_approval_history already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_po_approval_history" ON purchase_order_approval_history
    FOR INSERT WITH CHECK (check_purchase_order_organization(purchase_order_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_po_approval_history already exists, skipping.';
END $$;

-- No UPDATE or DELETE policies for audit table (append-only)

-- ============================================================================
-- SECTION 5: PRIORITY 5 - TIME TRACKING
-- (time_entries, labor_cost_rates, employee_project_assignments,
--  time_entry_batches, time_entry_approvals)
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Time Entries RLS Policies
-- -----------------------------------------------------------------------------

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_time_entries" ON time_entries
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_time_entries already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_time_entries" ON time_entries
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_time_entries already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_time_entries" ON time_entries
    FOR UPDATE
    USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_time_entries already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_time_entries" ON time_entries
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_time_entries already exists, skipping.';
END $$;

-- -----------------------------------------------------------------------------
-- Labor Cost Rates RLS Policies
-- -----------------------------------------------------------------------------

ALTER TABLE labor_cost_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_cost_rates FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_labor_cost_rates" ON labor_cost_rates
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_labor_cost_rates already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_labor_cost_rates" ON labor_cost_rates
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_labor_cost_rates already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_labor_cost_rates" ON labor_cost_rates
    FOR UPDATE
    USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_labor_cost_rates already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_labor_cost_rates" ON labor_cost_rates
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_labor_cost_rates already exists, skipping.';
END $$;

-- -----------------------------------------------------------------------------
-- Employee Project Assignments RLS Policies
-- -----------------------------------------------------------------------------

ALTER TABLE employee_project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_project_assignments FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_emp_project_assignments" ON employee_project_assignments
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_emp_project_assignments already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_emp_project_assignments" ON employee_project_assignments
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_emp_project_assignments already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_emp_project_assignments" ON employee_project_assignments
    FOR UPDATE
    USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_emp_project_assignments already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_emp_project_assignments" ON employee_project_assignments
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_emp_project_assignments already exists, skipping.';
END $$;

-- -----------------------------------------------------------------------------
-- Time Entry Batches RLS Policies
-- -----------------------------------------------------------------------------

ALTER TABLE time_entry_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entry_batches FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_time_entry_batches" ON time_entry_batches
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_time_entry_batches already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_time_entry_batches" ON time_entry_batches
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_time_entry_batches already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_time_entry_batches" ON time_entry_batches
    FOR UPDATE
    USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_time_entry_batches already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_time_entry_batches" ON time_entry_batches
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_time_entry_batches already exists, skipping.';
END $$;

-- -----------------------------------------------------------------------------
-- Time Entry Approvals RLS Policies (Indirect via time_entry, Append-only)
-- Note: Audit tables should ideally be SELECT + INSERT only
-- -----------------------------------------------------------------------------

ALTER TABLE time_entry_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entry_approvals FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_time_entry_approvals" ON time_entry_approvals
    FOR SELECT USING (check_time_entry_organization(time_entry_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_time_entry_approvals already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_time_entry_approvals" ON time_entry_approvals
    FOR INSERT WITH CHECK (check_time_entry_organization(time_entry_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_time_entry_approvals already exists, skipping.';
END $$;

-- No UPDATE or DELETE policies for audit table (append-only)

-- ============================================================================
-- SECTION 6: PRIORITY 7 - PROJECT TASKS
-- (project_milestones, project_task_templates, project_tasks, project_templates,
--  project_template_tasks)
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Project Milestones RLS Policies
-- -----------------------------------------------------------------------------

ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_milestones FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_project_milestones" ON project_milestones
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_project_milestones already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_project_milestones" ON project_milestones
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_project_milestones already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_project_milestones" ON project_milestones
    FOR UPDATE
    USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_project_milestones already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_project_milestones" ON project_milestones
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_project_milestones already exists, skipping.';
END $$;

-- -----------------------------------------------------------------------------
-- Project Task Templates RLS Policies
-- -----------------------------------------------------------------------------

ALTER TABLE project_task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_task_templates FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_project_task_templates" ON project_task_templates
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_project_task_templates already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_project_task_templates" ON project_task_templates
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_project_task_templates already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_project_task_templates" ON project_task_templates
    FOR UPDATE
    USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_project_task_templates already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_project_task_templates" ON project_task_templates
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_project_task_templates already exists, skipping.';
END $$;

-- -----------------------------------------------------------------------------
-- Project Tasks RLS Policies
-- -----------------------------------------------------------------------------

ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_project_tasks" ON project_tasks
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_project_tasks already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_project_tasks" ON project_tasks
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_project_tasks already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_project_tasks" ON project_tasks
    FOR UPDATE
    USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_project_tasks already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_project_tasks" ON project_tasks
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_project_tasks already exists, skipping.';
END $$;

-- -----------------------------------------------------------------------------
-- Project Templates RLS Policies
-- -----------------------------------------------------------------------------

ALTER TABLE project_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_templates FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_project_templates" ON project_templates
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_project_templates already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_project_templates" ON project_templates
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_project_templates already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_project_templates" ON project_templates
    FOR UPDATE
    USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_project_templates already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_project_templates" ON project_templates
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_project_templates already exists, skipping.';
END $$;

-- -----------------------------------------------------------------------------
-- Project Template Tasks RLS Policies (Indirect via project_template)
-- Helper function to check project template organization
-- -----------------------------------------------------------------------------

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

ALTER TABLE project_template_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_template_tasks FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_project_template_tasks" ON project_template_tasks
    FOR SELECT USING (check_project_template_organization(project_template_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_project_template_tasks already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_project_template_tasks" ON project_template_tasks
    FOR INSERT WITH CHECK (check_project_template_organization(project_template_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_project_template_tasks already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_project_template_tasks" ON project_template_tasks
    FOR UPDATE
    USING (check_project_template_organization(project_template_id))
    WITH CHECK (check_project_template_organization(project_template_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_project_template_tasks already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_project_template_tasks" ON project_template_tasks
    FOR DELETE USING (check_project_template_organization(project_template_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_project_template_tasks already exists, skipping.';
END $$;

-- ============================================================================
-- SECTION 7: ENTITY TASKS SYSTEM
-- (entity_tasks, task_field_definitions, task_templates)
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Entity Tasks RLS Policies
-- -----------------------------------------------------------------------------

ALTER TABLE entity_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_tasks FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_entity_tasks" ON entity_tasks
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_entity_tasks already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_entity_tasks" ON entity_tasks
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_entity_tasks already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_entity_tasks" ON entity_tasks
    FOR UPDATE
    USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_entity_tasks already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_entity_tasks" ON entity_tasks
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_entity_tasks already exists, skipping.';
END $$;

-- -----------------------------------------------------------------------------
-- Task Field Definitions RLS Policies
-- -----------------------------------------------------------------------------

ALTER TABLE task_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_field_definitions FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_task_field_definitions" ON task_field_definitions
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_task_field_definitions already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_task_field_definitions" ON task_field_definitions
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_task_field_definitions already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_task_field_definitions" ON task_field_definitions
    FOR UPDATE
    USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_task_field_definitions already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_task_field_definitions" ON task_field_definitions
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_task_field_definitions already exists, skipping.';
END $$;

-- -----------------------------------------------------------------------------
-- Task Templates RLS Policies
-- -----------------------------------------------------------------------------

ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_task_templates" ON task_templates
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_task_templates already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_task_templates" ON task_templates
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_task_templates already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_task_templates" ON task_templates
    FOR UPDATE
    USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_task_templates already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_task_templates" ON task_templates
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_task_templates already exists, skipping.';
END $$;

-- ============================================================================
-- SECTION 8: WORKFLOWS
-- (workflows, workflow_groups, workflow_components)
-- Note: workflows can have NULL organization_id for system templates
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Workflows RLS Policies
-- Special handling: NULL organization_id means system template (accessible to all)
-- -----------------------------------------------------------------------------

ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_workflows" ON workflows
    FOR SELECT USING (
      organization_id = get_current_organization_id()
      OR organization_id IS NULL  -- System templates accessible to all
    );
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_workflows already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_workflows" ON workflows
    FOR INSERT WITH CHECK (
      organization_id = get_current_organization_id()
      -- Note: Only system admins should insert with NULL organization_id
      -- This should be controlled at the application layer
    );
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_workflows already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_workflows" ON workflows
    FOR UPDATE
    USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
    -- Note: System templates (NULL org_id) cannot be updated via RLS
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_workflows already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_workflows" ON workflows
    FOR DELETE USING (organization_id = get_current_organization_id());
    -- Note: System templates (NULL org_id) cannot be deleted via RLS
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_workflows already exists, skipping.';
END $$;

-- -----------------------------------------------------------------------------
-- Workflow Groups RLS Policies (Indirect via workflow)
-- -----------------------------------------------------------------------------

ALTER TABLE workflow_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_groups FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_workflow_groups" ON workflow_groups
    FOR SELECT USING (check_workflow_organization(workflow_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_workflow_groups already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_workflow_groups" ON workflow_groups
    FOR INSERT WITH CHECK (check_workflow_organization(workflow_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_workflow_groups already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_workflow_groups" ON workflow_groups
    FOR UPDATE
    USING (check_workflow_organization(workflow_id))
    WITH CHECK (check_workflow_organization(workflow_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_workflow_groups already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_workflow_groups" ON workflow_groups
    FOR DELETE USING (check_workflow_organization(workflow_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_workflow_groups already exists, skipping.';
END $$;

-- -----------------------------------------------------------------------------
-- Workflow Components RLS Policies (Indirect via workflow)
-- -----------------------------------------------------------------------------

ALTER TABLE workflow_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_components FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_workflow_components" ON workflow_components
    FOR SELECT USING (check_workflow_organization(workflow_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_workflow_components already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_workflow_components" ON workflow_components
    FOR INSERT WITH CHECK (check_workflow_organization(workflow_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_workflow_components already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_workflow_components" ON workflow_components
    FOR UPDATE
    USING (check_workflow_organization(workflow_id))
    WITH CHECK (check_workflow_organization(workflow_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_workflow_components already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_workflow_components" ON workflow_components
    FOR DELETE USING (check_workflow_organization(workflow_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_workflow_components already exists, skipping.';
END $$;

-- ============================================================================
-- END OF CORE RLS POLICIES
-- ============================================================================

-- Summary of tables with RLS enabled by this script:
--
-- Section 1 - Core Entities:
--   - entities (direct organization_id check, TEXT type)
--
-- Section 2 - Priority 1 Core Financial:
--   - contracts (direct organization_id check)
--   - invoices (direct organization_id check)
--
-- Section 3 - Priority 2 Accounting:
--   - accounts (direct organization_id check, TEXT type)
--
-- Section 4 - Priority 3 Procure-to-Pay:
--   - purchase_orders (direct organization_id check)
--   - purchase_order_lines (indirect via purchase_order)
--   - purchase_order_receipts (direct organization_id check)
--   - purchase_order_receipt_lines (indirect via receipt)
--   - purchase_order_approval_history (indirect via purchase_order, append-only)
--
-- Section 5 - Priority 5 Time Tracking:
--   - time_entries (direct organization_id check)
--   - labor_cost_rates (direct organization_id check)
--   - employee_project_assignments (direct organization_id check)
--   - time_entry_batches (direct organization_id check)
--   - time_entry_approvals (indirect via time_entry, append-only)
--
-- Section 6 - Priority 7 Project Tasks:
--   - project_milestones (direct organization_id check)
--   - project_task_templates (direct organization_id check)
--   - project_tasks (direct organization_id check)
--   - project_templates (direct organization_id check)
--   - project_template_tasks (indirect via project_template)
--
-- Section 7 - Entity Tasks System:
--   - entity_tasks (direct organization_id check)
--   - task_field_definitions (direct organization_id check)
--   - task_templates (direct organization_id check)
--
-- Section 8 - Workflows:
--   - workflows (direct check with NULL handling for system templates)
--   - workflow_groups (indirect via workflow)
--   - workflow_components (indirect via workflow)
--
-- Helper functions defined:
--   - get_current_organization_id() - Gets org_id from session or JWT
--   - check_workflow_organization(workflow_id) - Validates workflow ownership
--   - check_time_entry_organization(time_entry_id) - Validates time entry ownership
--   - check_purchase_order_organization(purchase_order_id) - Validates PO ownership
--   - check_receipt_organization(receipt_id) - Validates receipt ownership
--   - check_project_template_organization(project_template_id) - Validates project template ownership
