-- 0074_invoice_source_allocations.sql
-- Adds source allocation locking to prevent duplicate billing across invoice sources.

-- =============================================================================
-- Enums
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_source_type') THEN
    CREATE TYPE invoice_source_type AS ENUM (
      'TIME_ENTRY',
      'PROJECT_TASK',
      'SALES_ORDER_LINE',
      'EXPENSE_ENTRY',
      'CREDIT_MEMO',
      'DISCOUNT'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_source_allocation_status') THEN
    CREATE TYPE invoice_source_allocation_status AS ENUM ('active', 'released', 'transferred');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_source_release_reason') THEN
    CREATE TYPE invoice_source_release_reason AS ENUM ('void', 'credit', 'writeoff', 'rebill_transfer');
  END IF;
END $$;

-- =============================================================================
-- Core allocation table
-- =============================================================================

CREATE TABLE IF NOT EXISTS invoice_source_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  invoice_line_item_id UUID NOT NULL REFERENCES invoice_line_items(id) ON DELETE CASCADE,
  source_type invoice_source_type NOT NULL,
  source_id UUID NOT NULL,
  source_hours NUMERIC(10, 2),
  source_amount_minor BIGINT NOT NULL,
  currency_code CHAR(3) NOT NULL,
  tax_amount_minor BIGINT,
  allocation_status invoice_source_allocation_status NOT NULL DEFAULT 'active',
  released_at TIMESTAMPTZ,
  release_reason invoice_source_release_reason,
  replaced_by_allocation_id UUID REFERENCES invoice_source_allocations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_invoice_source_allocations_release_timestamp
    CHECK (
      (allocation_status = 'active' AND released_at IS NULL)
      OR (allocation_status <> 'active' AND released_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_invoice_source_allocations_invoice
  ON invoice_source_allocations(invoice_id);

CREATE INDEX IF NOT EXISTS idx_invoice_source_allocations_invoice_line
  ON invoice_source_allocations(invoice_line_item_id);

CREATE INDEX IF NOT EXISTS idx_invoice_source_allocations_source
  ON invoice_source_allocations(organization_id, source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_invoice_source_allocations_status
  ON invoice_source_allocations(organization_id, allocation_status);

CREATE UNIQUE INDEX IF NOT EXISTS ux_invoice_source_allocations_active_source
  ON invoice_source_allocations(organization_id, source_type, source_id)
  WHERE allocation_status = 'active';

-- =============================================================================
-- Helper columns for source-level invoice linking
-- =============================================================================

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invoice_line_id UUID REFERENCES invoice_line_items(id);

ALTER TABLE expense_entries
  ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invoice_line_id UUID REFERENCES invoice_line_items(id);

CREATE INDEX IF NOT EXISTS idx_time_entries_billable_queue
  ON time_entries(organization_id, project_id, entry_date)
  WHERE is_billable = true AND status = 'APPROVED' AND invoiced_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_expense_entries_billable_queue
  ON expense_entries(organization_id, project_id, expense_date)
  WHERE is_billable = true AND status = 'APPROVED' AND invoiced_at IS NULL;
