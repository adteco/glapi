-- Migration: Migrate FK references from users to entities
-- Purpose: Update all foreign key constraints to reference entities.id instead of users.id
-- Prerequisites: Run 0029_entities_auth_fields.sql and 0030_migrate_users_to_entities.sql first

-- ============================================================================
-- PHASE 1: Add new entity_id columns alongside existing user_id columns
-- ============================================================================

-- gl_transactions table
ALTER TABLE gl_transactions ADD COLUMN IF NOT EXISTS created_by_entity_id UUID REFERENCES entities(id);
ALTER TABLE gl_transactions ADD COLUMN IF NOT EXISTS modified_by_entity_id UUID REFERENCES entities(id);
ALTER TABLE gl_transactions ADD COLUMN IF NOT EXISTS posted_by_entity_id UUID REFERENCES entities(id);

-- gl_posting_rules table
ALTER TABLE gl_posting_rules ADD COLUMN IF NOT EXISTS created_by_entity_id UUID REFERENCES entities(id);

-- gl_audit_trail table
ALTER TABLE gl_audit_trail ADD COLUMN IF NOT EXISTS user_entity_id UUID REFERENCES entities(id);

-- expense_entries table
ALTER TABLE expense_entries ADD COLUMN IF NOT EXISTS submitted_by_entity_id UUID REFERENCES entities(id);
ALTER TABLE expense_entries ADD COLUMN IF NOT EXISTS approved_by_entity_id UUID REFERENCES entities(id);
ALTER TABLE expense_entries ADD COLUMN IF NOT EXISTS rejected_by_entity_id UUID REFERENCES entities(id);
ALTER TABLE expense_entries ADD COLUMN IF NOT EXISTS created_by_entity_id UUID REFERENCES entities(id);

-- expense_attachments table
ALTER TABLE expense_attachments ADD COLUMN IF NOT EXISTS uploaded_by_entity_id UUID REFERENCES entities(id);

-- expense_entry_approvals table
ALTER TABLE expense_entry_approvals ADD COLUMN IF NOT EXISTS performed_by_entity_id UUID REFERENCES entities(id);

-- expense_reports table
ALTER TABLE expense_reports ADD COLUMN IF NOT EXISTS submitted_by_entity_id UUID REFERENCES entities(id);
ALTER TABLE expense_reports ADD COLUMN IF NOT EXISTS approved_by_entity_id UUID REFERENCES entities(id);
ALTER TABLE expense_reports ADD COLUMN IF NOT EXISTS created_by_entity_id UUID REFERENCES entities(id);

-- expense_policies table
ALTER TABLE expense_policies ADD COLUMN IF NOT EXISTS created_by_entity_id UUID REFERENCES entities(id);

-- time_entries table
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS submitted_by_entity_id UUID REFERENCES entities(id);
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS approved_by_entity_id UUID REFERENCES entities(id);
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS rejected_by_entity_id UUID REFERENCES entities(id);
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS created_by_entity_id UUID REFERENCES entities(id);

-- labor_cost_rates table
ALTER TABLE labor_cost_rates ADD COLUMN IF NOT EXISTS created_by_entity_id UUID REFERENCES entities(id);

-- employee_project_assignments table
ALTER TABLE employee_project_assignments ADD COLUMN IF NOT EXISTS created_by_entity_id UUID REFERENCES entities(id);

-- time_entry_approvals table
ALTER TABLE time_entry_approvals ADD COLUMN IF NOT EXISTS performed_by_entity_id UUID REFERENCES entities(id);

-- time_entry_batches table
ALTER TABLE time_entry_batches ADD COLUMN IF NOT EXISTS submitted_by_entity_id UUID REFERENCES entities(id);
ALTER TABLE time_entry_batches ADD COLUMN IF NOT EXISTS approved_by_entity_id UUID REFERENCES entities(id);
ALTER TABLE time_entry_batches ADD COLUMN IF NOT EXISTS created_by_entity_id UUID REFERENCES entities(id);

-- project_cost_codes table
ALTER TABLE project_cost_codes ADD COLUMN IF NOT EXISTS created_by_entity_id UUID REFERENCES entities(id);

-- project_budget_versions table
ALTER TABLE project_budget_versions ADD COLUMN IF NOT EXISTS created_by_entity_id UUID REFERENCES entities(id);
ALTER TABLE project_budget_versions ADD COLUMN IF NOT EXISTS submitted_by_entity_id UUID REFERENCES entities(id);
ALTER TABLE project_budget_versions ADD COLUMN IF NOT EXISTS approved_by_entity_id UUID REFERENCES entities(id);
ALTER TABLE project_budget_versions ADD COLUMN IF NOT EXISTS locked_by_entity_id UUID REFERENCES entities(id);

-- project_milestones table
ALTER TABLE project_milestones ADD COLUMN IF NOT EXISTS created_by_entity_id UUID REFERENCES entities(id);

-- project_task_templates table
ALTER TABLE project_task_templates ADD COLUMN IF NOT EXISTS created_by_entity_id UUID REFERENCES entities(id);

-- project_tasks table
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS created_by_entity_id UUID REFERENCES entities(id);

-- project_templates table
ALTER TABLE project_templates ADD COLUMN IF NOT EXISTS created_by_entity_id UUID REFERENCES entities(id);

-- business_transactions table
ALTER TABLE business_transactions ADD COLUMN IF NOT EXISTS created_by_entity_id UUID REFERENCES entities(id);
ALTER TABLE business_transactions ADD COLUMN IF NOT EXISTS modified_by_entity_id UUID REFERENCES entities(id);
ALTER TABLE business_transactions ADD COLUMN IF NOT EXISTS approved_by_entity_id UUID REFERENCES entities(id);

-- approval_instances table
ALTER TABLE approval_instances ADD COLUMN IF NOT EXISTS submitted_by_entity_id UUID REFERENCES entities(id);

-- approval_actions table
ALTER TABLE approval_actions ADD COLUMN IF NOT EXISTS actor_entity_id UUID REFERENCES entities(id);
ALTER TABLE approval_actions ADD COLUMN IF NOT EXISTS delegated_to_entity_id UUID REFERENCES entities(id);

-- consolidation_groups table
ALTER TABLE consolidation_groups ADD COLUMN IF NOT EXISTS created_by_entity_id UUID REFERENCES entities(id);

-- elimination_rules table
ALTER TABLE elimination_rules ADD COLUMN IF NOT EXISTS created_by_entity_id UUID REFERENCES entities(id);

-- project_schedule_of_values table
ALTER TABLE project_schedule_of_values ADD COLUMN IF NOT EXISTS approved_by_entity_id UUID REFERENCES entities(id);
ALTER TABLE project_schedule_of_values ADD COLUMN IF NOT EXISTS created_by_entity_id UUID REFERENCES entities(id);
ALTER TABLE project_schedule_of_values ADD COLUMN IF NOT EXISTS updated_by_entity_id UUID REFERENCES entities(id);

-- sov_change_orders table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sov_change_orders') THEN
    EXECUTE 'ALTER TABLE sov_change_orders ADD COLUMN IF NOT EXISTS requested_by_entity_id UUID REFERENCES entities(id)';
    EXECUTE 'ALTER TABLE sov_change_orders ADD COLUMN IF NOT EXISTS approved_by_entity_id UUID REFERENCES entities(id)';
    EXECUTE 'ALTER TABLE sov_change_orders ADD COLUMN IF NOT EXISTS rejected_by_entity_id UUID REFERENCES entities(id)';
    EXECUTE 'ALTER TABLE sov_change_orders ADD COLUMN IF NOT EXISTS created_by_entity_id UUID REFERENCES entities(id)';
  END IF;
END $$;

-- pay_applications table
ALTER TABLE pay_applications ADD COLUMN IF NOT EXISTS submitted_by_entity_id UUID REFERENCES entities(id);
ALTER TABLE pay_applications ADD COLUMN IF NOT EXISTS reviewed_by_entity_id UUID REFERENCES entities(id);
ALTER TABLE pay_applications ADD COLUMN IF NOT EXISTS approved_by_entity_id UUID REFERENCES entities(id);
ALTER TABLE pay_applications ADD COLUMN IF NOT EXISTS certified_by_entity_id UUID REFERENCES entities(id);
ALTER TABLE pay_applications ADD COLUMN IF NOT EXISTS rejected_by_entity_id UUID REFERENCES entities(id);
ALTER TABLE pay_applications ADD COLUMN IF NOT EXISTS voided_by_entity_id UUID REFERENCES entities(id);
ALTER TABLE pay_applications ADD COLUMN IF NOT EXISTS created_by_entity_id UUID REFERENCES entities(id);
ALTER TABLE pay_applications ADD COLUMN IF NOT EXISTS updated_by_entity_id UUID REFERENCES entities(id);

-- ============================================================================
-- PHASE 2: Populate new entity_id columns from user_entity_mapping
-- ============================================================================

-- gl_transactions
UPDATE gl_transactions t SET created_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.created_by = m.user_id AND t.created_by IS NOT NULL;
UPDATE gl_transactions t SET modified_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.modified_by = m.user_id AND t.modified_by IS NOT NULL;
UPDATE gl_transactions t SET posted_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.posted_by = m.user_id AND t.posted_by IS NOT NULL;

-- gl_posting_rules
UPDATE gl_posting_rules t SET created_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.created_by = m.user_id AND t.created_by IS NOT NULL;

-- gl_audit_trail
UPDATE gl_audit_trail t SET user_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.user_id = m.user_id AND t.user_id IS NOT NULL;

-- expense_entries
UPDATE expense_entries t SET submitted_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.submitted_by = m.user_id AND t.submitted_by IS NOT NULL;
UPDATE expense_entries t SET approved_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.approved_by = m.user_id AND t.approved_by IS NOT NULL;
UPDATE expense_entries t SET rejected_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.rejected_by = m.user_id AND t.rejected_by IS NOT NULL;
UPDATE expense_entries t SET created_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.created_by = m.user_id AND t.created_by IS NOT NULL;

-- expense_attachments
UPDATE expense_attachments t SET uploaded_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.uploaded_by = m.user_id AND t.uploaded_by IS NOT NULL;

-- expense_entry_approvals
UPDATE expense_entry_approvals t SET performed_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.performed_by = m.user_id AND t.performed_by IS NOT NULL;

-- expense_reports
UPDATE expense_reports t SET submitted_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.submitted_by = m.user_id AND t.submitted_by IS NOT NULL;
UPDATE expense_reports t SET approved_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.approved_by = m.user_id AND t.approved_by IS NOT NULL;
UPDATE expense_reports t SET created_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.created_by = m.user_id AND t.created_by IS NOT NULL;

-- expense_policies
UPDATE expense_policies t SET created_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.created_by = m.user_id AND t.created_by IS NOT NULL;

-- time_entries
UPDATE time_entries t SET submitted_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.submitted_by = m.user_id AND t.submitted_by IS NOT NULL;
UPDATE time_entries t SET approved_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.approved_by = m.user_id AND t.approved_by IS NOT NULL;
UPDATE time_entries t SET rejected_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.rejected_by = m.user_id AND t.rejected_by IS NOT NULL;
UPDATE time_entries t SET created_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.created_by = m.user_id AND t.created_by IS NOT NULL;

-- labor_cost_rates
UPDATE labor_cost_rates t SET created_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.created_by = m.user_id AND t.created_by IS NOT NULL;

-- employee_project_assignments
UPDATE employee_project_assignments t SET created_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.created_by = m.user_id AND t.created_by IS NOT NULL;

-- time_entry_approvals
UPDATE time_entry_approvals t SET performed_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.performed_by = m.user_id AND t.performed_by IS NOT NULL;

-- time_entry_batches
UPDATE time_entry_batches t SET submitted_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.submitted_by = m.user_id AND t.submitted_by IS NOT NULL;
UPDATE time_entry_batches t SET approved_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.approved_by = m.user_id AND t.approved_by IS NOT NULL;
UPDATE time_entry_batches t SET created_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.created_by = m.user_id AND t.created_by IS NOT NULL;

-- project_cost_codes
UPDATE project_cost_codes t SET created_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.created_by = m.user_id AND t.created_by IS NOT NULL;

-- project_budget_versions
UPDATE project_budget_versions t SET created_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.created_by = m.user_id AND t.created_by IS NOT NULL;
UPDATE project_budget_versions t SET submitted_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.submitted_by = m.user_id AND t.submitted_by IS NOT NULL;
UPDATE project_budget_versions t SET approved_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.approved_by = m.user_id AND t.approved_by IS NOT NULL;
UPDATE project_budget_versions t SET locked_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.locked_by = m.user_id AND t.locked_by IS NOT NULL;

-- project_milestones
UPDATE project_milestones t SET created_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.created_by = m.user_id AND t.created_by IS NOT NULL;

-- project_task_templates
UPDATE project_task_templates t SET created_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.created_by = m.user_id AND t.created_by IS NOT NULL;

-- project_tasks
UPDATE project_tasks t SET created_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.created_by = m.user_id AND t.created_by IS NOT NULL;

-- project_templates
UPDATE project_templates t SET created_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.created_by = m.user_id AND t.created_by IS NOT NULL;

-- business_transactions
UPDATE business_transactions t SET created_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.created_by = m.user_id AND t.created_by IS NOT NULL;
UPDATE business_transactions t SET modified_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.modified_by = m.user_id AND t.modified_by IS NOT NULL;
UPDATE business_transactions t SET approved_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.approved_by = m.user_id AND t.approved_by IS NOT NULL;

-- approval_instances
UPDATE approval_instances t SET submitted_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.submitted_by = m.user_id AND t.submitted_by IS NOT NULL;

-- approval_actions
UPDATE approval_actions t SET actor_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.actor_id = m.user_id AND t.actor_id IS NOT NULL;
UPDATE approval_actions t SET delegated_to_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.delegated_to = m.user_id AND t.delegated_to IS NOT NULL;

-- consolidation_groups
UPDATE consolidation_groups t SET created_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.created_by = m.user_id AND t.created_by IS NOT NULL;

-- elimination_rules
UPDATE elimination_rules t SET created_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.created_by = m.user_id AND t.created_by IS NOT NULL;

-- project_schedule_of_values
UPDATE project_schedule_of_values t SET approved_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.approved_by = m.user_id AND t.approved_by IS NOT NULL;
UPDATE project_schedule_of_values t SET created_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.created_by = m.user_id AND t.created_by IS NOT NULL;
UPDATE project_schedule_of_values t SET updated_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.updated_by = m.user_id AND t.updated_by IS NOT NULL;

-- sov_change_orders (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sov_change_orders') THEN
    EXECUTE 'UPDATE sov_change_orders t SET requested_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.requested_by = m.user_id AND t.requested_by IS NOT NULL';
    EXECUTE 'UPDATE sov_change_orders t SET approved_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.approved_by = m.user_id AND t.approved_by IS NOT NULL';
    EXECUTE 'UPDATE sov_change_orders t SET rejected_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.rejected_by = m.user_id AND t.rejected_by IS NOT NULL';
    EXECUTE 'UPDATE sov_change_orders t SET created_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.created_by = m.user_id AND t.created_by IS NOT NULL';
  END IF;
END $$;

-- pay_applications
UPDATE pay_applications t SET submitted_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.submitted_by = m.user_id AND t.submitted_by IS NOT NULL;
UPDATE pay_applications t SET reviewed_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.reviewed_by = m.user_id AND t.reviewed_by IS NOT NULL;
UPDATE pay_applications t SET approved_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.approved_by = m.user_id AND t.approved_by IS NOT NULL;
UPDATE pay_applications t SET certified_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.certified_by = m.user_id AND t.certified_by IS NOT NULL;
UPDATE pay_applications t SET rejected_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.rejected_by = m.user_id AND t.rejected_by IS NOT NULL;
UPDATE pay_applications t SET voided_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.voided_by = m.user_id AND t.voided_by IS NOT NULL;
UPDATE pay_applications t SET created_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.created_by = m.user_id AND t.created_by IS NOT NULL;
UPDATE pay_applications t SET updated_by_entity_id = m.entity_id FROM user_entity_mapping m WHERE t.updated_by = m.user_id AND t.updated_by IS NOT NULL;

-- ============================================================================
-- PHASE 3: Verification queries (run manually to confirm migration success)
-- ============================================================================

-- Verify gl_transactions migration completeness
-- SELECT COUNT(*) as unmapped FROM gl_transactions WHERE created_by IS NOT NULL AND created_by_entity_id IS NULL;

-- Verify all tables have matching entity IDs for non-null user IDs
-- SELECT 'gl_transactions.created_by' as field, COUNT(*) as unmapped FROM gl_transactions WHERE created_by IS NOT NULL AND created_by_entity_id IS NULL
-- UNION ALL SELECT 'expense_entries.submitted_by', COUNT(*) FROM expense_entries WHERE submitted_by IS NOT NULL AND submitted_by_entity_id IS NULL
-- ... etc for all fields

-- ============================================================================
-- NOTE: The final step (dropping old columns and renaming new ones) should be
-- done in a separate migration after verifying all data is correctly migrated
-- and all application code has been updated to use the new columns.
-- See migration 0032_finalize_fk_migration.sql for the cleanup phase.
-- ============================================================================
