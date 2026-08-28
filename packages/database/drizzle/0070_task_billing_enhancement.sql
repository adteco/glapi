-- Task Billing Enhancement Migration
-- Adds billing types to project tasks and links tasks to sales orders and invoices
-- This enables the workflow: Estimate -> Sales Order -> Task -> Completed Task -> Invoice

-- =============================================================================
-- STEP 1: Add billing_type enum to project_tasks
-- =============================================================================

-- Create the billing type enum
DO $$ BEGIN
  CREATE TYPE task_billing_type AS ENUM ('flat_fee', 'time_and_materials');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE project_milestone_status AS ENUM (
    'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  completed_date DATE,
  status project_milestone_status NOT NULL DEFAULT 'PENDING',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_billing_milestone BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  created_by UUID REFERENCES entities(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_milestones_project
  ON project_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_project_milestones_status
  ON project_milestones(project_id, status);
CREATE INDEX IF NOT EXISTS idx_project_milestones_target_date
  ON project_milestones(target_date);

-- Add billing-related columns to project_tasks
ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS milestone_id UUID,
  ADD COLUMN IF NOT EXISTS template_id UUID,
  ADD COLUMN IF NOT EXISTS task_name TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS activity_code_id UUID REFERENCES activity_codes(id),
  ADD COLUMN IF NOT EXISTS service_item_id UUID REFERENCES items(id),
  ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES entities(id),
  ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES entities(id),
  ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS actual_hours NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS depends_on_task_ids JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT,
  ADD COLUMN IF NOT EXISTS work_notes TEXT,
  ADD COLUMN IF NOT EXISTS review_notes TEXT,
  ADD COLUMN IF NOT EXISTS attachment_urls JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS is_billable BOOLEAN DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS billing_rate NUMERIC(15, 4),
  ADD COLUMN IF NOT EXISTS billing_type task_billing_type DEFAULT 'flat_fee',
  ADD COLUMN IF NOT EXISTS flat_fee_amount DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invoice_line_id UUID REFERENCES invoice_line_items(id);

-- Older construction deployments created a narrower project_tasks table with
-- `name` and no tenant column. Preserve those rows while evolving the table to
-- the application schema used by automated project billing.
UPDATE project_tasks task
SET organization_id = project.organization_id
FROM projects project
WHERE task.project_id = project.id
  AND task.organization_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_tasks'
      AND column_name = 'name'
  ) THEN
    EXECUTE 'UPDATE project_tasks SET task_name = name WHERE task_name IS NULL';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM project_tasks WHERE organization_id IS NULL) THEN
    ALTER TABLE project_tasks ALTER COLUMN organization_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM project_tasks WHERE task_name IS NULL) THEN
    ALTER TABLE project_tasks ALTER COLUMN task_name SET NOT NULL;
  END IF;
END $$;

-- Add index for finding billable completed tasks ready for invoicing
CREATE INDEX IF NOT EXISTS idx_project_tasks_billable_status
  ON project_tasks(project_id, status, is_billable)
  WHERE is_billable = true AND status = 'COMPLETED' AND invoiced_at IS NULL;

-- =============================================================================
-- STEP 2: Add task linkage to sales_order_lines
-- =============================================================================

-- Add linked_task_id to sales order lines
-- This allows a sales order line item to be linked to a project task
ALTER TABLE sales_order_lines
  ADD COLUMN IF NOT EXISTS linked_task_id UUID REFERENCES project_tasks(id);

-- Add index for looking up sales order lines by task
CREATE INDEX IF NOT EXISTS idx_sales_order_lines_task ON sales_order_lines(linked_task_id);

-- =============================================================================
-- STEP 3: Add task linkage to invoice_line_items
-- =============================================================================

-- Add linked_project_task_id to invoice line items
-- This tracks which invoice line came from which completed task
ALTER TABLE invoice_line_items
  ADD COLUMN IF NOT EXISTS linked_project_task_id UUID REFERENCES project_tasks(id);

-- Add index for looking up invoice lines by task
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_task ON invoice_line_items(linked_project_task_id);

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON COLUMN project_tasks.billing_type IS 'Type of billing: flat_fee (fixed amount) or time_and_materials (hourly rate x time)';
COMMENT ON COLUMN project_tasks.flat_fee_amount IS 'Fixed amount to bill for flat fee tasks';
COMMENT ON COLUMN project_tasks.invoiced_at IS 'Timestamp when this task was added to an invoice';
COMMENT ON COLUMN project_tasks.invoice_line_id IS 'Reference to the invoice line item created from this task';
COMMENT ON COLUMN sales_order_lines.linked_task_id IS 'Reference to a project task created from this sales order line';
COMMENT ON COLUMN invoice_line_items.linked_project_task_id IS 'Reference to the completed project task that generated this line';
