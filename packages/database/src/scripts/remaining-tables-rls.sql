-- ============================================================================
-- Comprehensive RLS Policies for All Remaining Tables with organization_id
-- ============================================================================
-- This script enables RLS for all 35 tables that have organization_id but
-- don't yet have RLS enabled. Uses a template pattern for consistency.
--
-- Run this AFTER items-rls-policies.sql and core-rls-policies.sql
-- ============================================================================

-- ============================================================================
-- TEMPLATE: For each table with organization_id column
-- ============================================================================

-- accounting_lists
ALTER TABLE accounting_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_lists FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_accounting_lists" ON accounting_lists FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_accounting_lists" ON accounting_lists FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_accounting_lists" ON accounting_lists FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_accounting_lists" ON accounting_lists FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- addresses
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_addresses" ON addresses FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_addresses" ON addresses FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_addresses" ON addresses FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_addresses" ON addresses FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- contract_modifications
ALTER TABLE contract_modifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_modifications FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_contract_modifications" ON contract_modifications FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_contract_modifications" ON contract_modifications FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_contract_modifications" ON contract_modifications FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_contract_modifications" ON contract_modifications FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- contracts
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_contracts" ON contracts FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_contracts" ON contracts FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_contracts" ON contracts FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_contracts" ON contracts FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- customer_warehouse_assignments
ALTER TABLE customer_warehouse_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_warehouse_assignments FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_customer_warehouse_assignments" ON customer_warehouse_assignments FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_customer_warehouse_assignments" ON customer_warehouse_assignments FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_customer_warehouse_assignments" ON customer_warehouse_assignments FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_customer_warehouse_assignments" ON customer_warehouse_assignments FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- employee_project_assignments
ALTER TABLE employee_project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_project_assignments FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_employee_project_assignments" ON employee_project_assignments FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_employee_project_assignments" ON employee_project_assignments FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_employee_project_assignments" ON employee_project_assignments FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_employee_project_assignments" ON employee_project_assignments FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- entities
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_entities" ON entities FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_entities" ON entities FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_entities" ON entities FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_entities" ON entities FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- entity_tasks
ALTER TABLE entity_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_tasks FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_entity_tasks" ON entity_tasks FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_entity_tasks" ON entity_tasks FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_entity_tasks" ON entity_tasks FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_entity_tasks" ON entity_tasks FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- item_audit_log
ALTER TABLE item_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_audit_log FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_item_audit_log" ON item_audit_log FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_item_audit_log" ON item_audit_log FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- item_categories
ALTER TABLE item_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_categories FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_item_categories" ON item_categories FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_item_categories" ON item_categories FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_item_categories" ON item_categories FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_item_categories" ON item_categories FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- item_cost_history
ALTER TABLE item_cost_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_cost_history FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_item_cost_history" ON item_cost_history FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_item_cost_history" ON item_cost_history FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- item_cost_layers
ALTER TABLE item_cost_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_cost_layers FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_item_cost_layers" ON item_cost_layers FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_item_cost_layers" ON item_cost_layers FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_item_cost_layers" ON item_cost_layers FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_item_cost_layers" ON item_cost_layers FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- item_costing_methods
ALTER TABLE item_costing_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_costing_methods FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_item_costing_methods" ON item_costing_methods FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_item_costing_methods" ON item_costing_methods FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_item_costing_methods" ON item_costing_methods FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_item_costing_methods" ON item_costing_methods FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- items
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE items FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_items" ON items FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_items" ON items FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_items" ON items FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_items" ON items FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- labor_cost_rates
ALTER TABLE labor_cost_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_cost_rates FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_labor_cost_rates" ON labor_cost_rates FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_labor_cost_rates" ON labor_cost_rates FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_labor_cost_rates" ON labor_cost_rates FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_labor_cost_rates" ON labor_cost_rates FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- lot_numbers
ALTER TABLE lot_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE lot_numbers FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_lot_numbers" ON lot_numbers FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_lot_numbers" ON lot_numbers FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_lot_numbers" ON lot_numbers FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_lot_numbers" ON lot_numbers FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- organization_costing_defaults
ALTER TABLE organization_costing_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_costing_defaults FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_organization_costing_defaults" ON organization_costing_defaults FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_organization_costing_defaults" ON organization_costing_defaults FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_organization_costing_defaults" ON organization_costing_defaults FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_organization_costing_defaults" ON organization_costing_defaults FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- price_lists
ALTER TABLE price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_lists FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_price_lists" ON price_lists FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_price_lists" ON price_lists FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_price_lists" ON price_lists FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_price_lists" ON price_lists FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- project_expense_attachments
ALTER TABLE project_expense_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_expense_attachments FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_project_expense_attachments" ON project_expense_attachments FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_project_expense_attachments" ON project_expense_attachments FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_project_expense_attachments" ON project_expense_attachments FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_project_expense_attachments" ON project_expense_attachments FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- project_expense_entries
ALTER TABLE project_expense_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_expense_entries FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_project_expense_entries" ON project_expense_entries FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_project_expense_entries" ON project_expense_entries FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_project_expense_entries" ON project_expense_entries FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_project_expense_entries" ON project_expense_entries FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- serial_numbers
ALTER TABLE serial_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE serial_numbers FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_serial_numbers" ON serial_numbers FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_serial_numbers" ON serial_numbers FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_serial_numbers" ON serial_numbers FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_serial_numbers" ON serial_numbers FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- subscription_items
ALTER TABLE subscription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_items FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_subscription_items" ON subscription_items FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_subscription_items" ON subscription_items FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_subscription_items" ON subscription_items FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_subscription_items" ON subscription_items FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- subscription_versions
ALTER TABLE subscription_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_versions FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_subscription_versions" ON subscription_versions FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_subscription_versions" ON subscription_versions FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_subscription_versions" ON subscription_versions FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_subscription_versions" ON subscription_versions FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_subscriptions" ON subscriptions FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_subscriptions" ON subscriptions FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_subscriptions" ON subscriptions FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_subscriptions" ON subscriptions FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- subsidiary_costing_config
ALTER TABLE subsidiary_costing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE subsidiary_costing_config FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_subsidiary_costing_config" ON subsidiary_costing_config FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_subsidiary_costing_config" ON subsidiary_costing_config FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_subsidiary_costing_config" ON subsidiary_costing_config FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_subsidiary_costing_config" ON subsidiary_costing_config FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- task_field_definitions
ALTER TABLE task_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_field_definitions FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_task_field_definitions" ON task_field_definitions FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_task_field_definitions" ON task_field_definitions FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_task_field_definitions" ON task_field_definitions FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_task_field_definitions" ON task_field_definitions FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- task_templates
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_task_templates" ON task_templates FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_task_templates" ON task_templates FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_task_templates" ON task_templates FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_task_templates" ON task_templates FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- test_gl
ALTER TABLE test_gl ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_gl FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_test_gl" ON test_gl FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_test_gl" ON test_gl FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_test_gl" ON test_gl FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_test_gl" ON test_gl FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- time_entries
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_time_entries" ON time_entries FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_time_entries" ON time_entries FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_time_entries" ON time_entries FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_time_entries" ON time_entries FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- time_entry_attachments
ALTER TABLE time_entry_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entry_attachments FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_time_entry_attachments" ON time_entry_attachments FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_time_entry_attachments" ON time_entry_attachments FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_time_entry_attachments" ON time_entry_attachments FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_time_entry_attachments" ON time_entry_attachments FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- time_entry_batches
ALTER TABLE time_entry_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entry_batches FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_time_entry_batches" ON time_entry_batches FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_time_entry_batches" ON time_entry_batches FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_time_entry_batches" ON time_entry_batches FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_time_entry_batches" ON time_entry_batches FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- units_of_measure
ALTER TABLE units_of_measure ENABLE ROW LEVEL SECURITY;
ALTER TABLE units_of_measure FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_units_of_measure" ON units_of_measure FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_units_of_measure" ON units_of_measure FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_units_of_measure" ON units_of_measure FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_units_of_measure" ON units_of_measure FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_users" ON users FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_users" ON users FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_users" ON users FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_users" ON users FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- warehouses
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_warehouses" ON warehouses FOR SELECT USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_warehouses" ON warehouses FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_warehouses" ON warehouses FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_warehouses" ON warehouses FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- workflows (NOTE: May have NULL org_id for system templates)
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows FORCE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "org_isolation_select_workflows" ON workflows FOR SELECT USING (organization_id = get_current_organization_id() OR organization_id IS NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_insert_workflows" ON workflows FOR INSERT WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_update_workflows" ON workflows FOR UPDATE USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_isolation_delete_workflows" ON workflows FOR DELETE USING (organization_id = get_current_organization_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- END
-- ============================================================================
