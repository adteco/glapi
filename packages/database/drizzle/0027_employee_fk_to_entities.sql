-- Migration: Change employee FK references from users to entities
-- This migration updates employee_id foreign key constraints to reference
-- the entities table instead of the users table.
--
-- Rationale: Employees are business entities (stored in entities table),
-- while users are system accounts (for audit/workflow). The time/expense
-- entry forms select employees from the entities table, so the FK should
-- reference entities.id, not users.id.

-- =============================================================================
-- TIME_ENTRIES TABLE
-- =============================================================================

-- Drop the old foreign key constraint
ALTER TABLE "time_entries" DROP CONSTRAINT IF EXISTS "time_entries_employee_id_users_id_fk";

-- Add new foreign key constraint referencing entities
ALTER TABLE "time_entries"
  ADD CONSTRAINT "time_entries_employee_id_entities_id_fk"
  FOREIGN KEY ("employee_id") REFERENCES "entities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- =============================================================================
-- LABOR_COST_RATES TABLE
-- =============================================================================

-- Drop the old foreign key constraint
ALTER TABLE "labor_cost_rates" DROP CONSTRAINT IF EXISTS "labor_cost_rates_employee_id_users_id_fk";

-- Add new foreign key constraint referencing entities
ALTER TABLE "labor_cost_rates"
  ADD CONSTRAINT "labor_cost_rates_employee_id_entities_id_fk"
  FOREIGN KEY ("employee_id") REFERENCES "entities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- =============================================================================
-- EMPLOYEE_PROJECT_ASSIGNMENTS TABLE
-- =============================================================================

-- Drop the old foreign key constraint
ALTER TABLE "employee_project_assignments" DROP CONSTRAINT IF EXISTS "employee_project_assignments_employee_id_users_id_fk";

-- Add new foreign key constraint referencing entities
ALTER TABLE "employee_project_assignments"
  ADD CONSTRAINT "employee_project_assignments_employee_id_entities_id_fk"
  FOREIGN KEY ("employee_id") REFERENCES "entities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- =============================================================================
-- EXPENSE_ENTRIES TABLE
-- =============================================================================

-- Drop the old foreign key constraint
ALTER TABLE "expense_entries" DROP CONSTRAINT IF EXISTS "expense_entries_employee_id_users_id_fk";

-- Add new foreign key constraint referencing entities
ALTER TABLE "expense_entries"
  ADD CONSTRAINT "expense_entries_employee_id_entities_id_fk"
  FOREIGN KEY ("employee_id") REFERENCES "entities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- =============================================================================
-- EXPENSE_REPORTS TABLE
-- =============================================================================

-- Drop the old foreign key constraint
ALTER TABLE "expense_reports" DROP CONSTRAINT IF EXISTS "expense_reports_employee_id_users_id_fk";

-- Add new foreign key constraint referencing entities
ALTER TABLE "expense_reports"
  ADD CONSTRAINT "expense_reports_employee_id_entities_id_fk"
  FOREIGN KEY ("employee_id") REFERENCES "entities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
