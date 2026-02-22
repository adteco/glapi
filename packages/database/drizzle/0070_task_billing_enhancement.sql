-- Task Billing Enhancement Migration
-- Adds billing types to project tasks and links tasks to sales orders and invoices
-- This enables the workflow: Estimate -> Sales Order -> Task -> Completed Task -> Invoice

-- =============================================================================
-- STEP 1: Add billing_type enum to project_tasks
-- =============================================================================

-- Create the billing type enum
CREATE TYPE task_billing_type AS ENUM ('flat_fee', 'time_and_materials');

-- Add billing-related columns to project_tasks
ALTER TABLE project_tasks
  ADD COLUMN billing_type task_billing_type DEFAULT 'flat_fee',
  ADD COLUMN flat_fee_amount DECIMAL(12, 2),
  ADD COLUMN invoiced_at TIMESTAMPTZ,
  ADD COLUMN invoice_line_id UUID REFERENCES invoice_line_items(id);

-- Add index for finding billable completed tasks ready for invoicing
CREATE INDEX idx_project_tasks_billable_status
  ON project_tasks(project_id, status, is_billable)
  WHERE is_billable = true AND status = 'COMPLETED' AND invoiced_at IS NULL;

-- =============================================================================
-- STEP 2: Add task linkage to sales_order_lines
-- =============================================================================

-- Add linked_task_id to sales order lines
-- This allows a sales order line item to be linked to a project task
ALTER TABLE sales_order_lines
  ADD COLUMN linked_task_id UUID REFERENCES project_tasks(id);

-- Add index for looking up sales order lines by task
CREATE INDEX idx_sales_order_lines_task ON sales_order_lines(linked_task_id);

-- =============================================================================
-- STEP 3: Add task linkage to invoice_line_items
-- =============================================================================

-- Add linked_project_task_id to invoice line items
-- This tracks which invoice line came from which completed task
ALTER TABLE invoice_line_items
  ADD COLUMN linked_project_task_id UUID REFERENCES project_tasks(id);

-- Add index for looking up invoice lines by task
CREATE INDEX idx_invoice_line_items_task ON invoice_line_items(linked_project_task_id);

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON COLUMN project_tasks.billing_type IS 'Type of billing: flat_fee (fixed amount) or time_and_materials (hourly rate x time)';
COMMENT ON COLUMN project_tasks.flat_fee_amount IS 'Fixed amount to bill for flat fee tasks';
COMMENT ON COLUMN project_tasks.invoiced_at IS 'Timestamp when this task was added to an invoice';
COMMENT ON COLUMN project_tasks.invoice_line_id IS 'Reference to the invoice line item created from this task';
COMMENT ON COLUMN sales_order_lines.linked_task_id IS 'Reference to a project task created from this sales order line';
COMMENT ON COLUMN invoice_line_items.linked_project_task_id IS 'Reference to the completed project task that generated this line';
