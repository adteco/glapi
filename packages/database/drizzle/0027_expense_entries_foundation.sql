-- Project expense-entry foundation
--
-- The table is part of the Drizzle application schema and is consumed by the
-- project-billing candidate queue, but older deployments only contain the
-- separate construction `project_expense_entries` table.

DO $$ BEGIN
  CREATE TYPE expense_entry_status AS ENUM (
    'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REIMBURSED', 'POSTED', 'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE expense_category AS ENUM (
    'TRAVEL', 'LODGING', 'MEALS', 'TRANSPORTATION', 'SUPPLIES', 'EQUIPMENT',
    'MATERIALS', 'SUBCONTRACTOR', 'COMMUNICATIONS', 'PROFESSIONAL_SERVICES',
    'INSURANCE', 'PERMITS_FEES', 'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE expense_payment_method AS ENUM (
    'CORPORATE_CARD', 'PERSONAL_CARD', 'CASH', 'CHECK', 'DIRECT_PAYMENT',
    'REIMBURSEMENT_PENDING', 'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS expense_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  subsidiary_id UUID REFERENCES subsidiaries(id),
  employee_id UUID NOT NULL REFERENCES entities(id),
  project_id UUID REFERENCES projects(id),
  cost_code_id UUID REFERENCES project_cost_codes(id),
  expense_date DATE NOT NULL,
  category expense_category NOT NULL,
  merchant_name TEXT,
  description TEXT NOT NULL,
  amount NUMERIC(18, 4) NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'USD',
  exchange_rate NUMERIC(18, 8) DEFAULT 1,
  amount_in_base_currency NUMERIC(18, 4),
  tax_amount NUMERIC(18, 4),
  is_tax_deductible BOOLEAN NOT NULL DEFAULT true,
  payment_method expense_payment_method NOT NULL DEFAULT 'PERSONAL_CARD',
  requires_reimbursement BOOLEAN NOT NULL DEFAULT true,
  reimbursement_amount NUMERIC(18, 4),
  is_billable BOOLEAN NOT NULL DEFAULT false,
  billing_markup NUMERIC(6, 4),
  billable_amount NUMERIC(18, 4),
  invoiced_at TIMESTAMPTZ,
  invoice_line_id UUID,
  internal_notes TEXT,
  status expense_entry_status NOT NULL DEFAULT 'DRAFT',
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  rejected_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES users(id),
  rejection_reason TEXT,
  reimbursed_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  gl_transaction_id UUID,
  gl_posting_batch_id UUID,
  external_id TEXT,
  external_source TEXT,
  metadata JSONB,
  created_by UUID REFERENCES entities(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_entries_org_date
  ON expense_entries(organization_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expense_entries_employee_date
  ON expense_entries(employee_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expense_entries_project
  ON expense_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_expense_entries_status
  ON expense_entries(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_expense_entries_pending_approval
  ON expense_entries(organization_id, status, submitted_at);
CREATE INDEX IF NOT EXISTS idx_expense_entries_category
  ON expense_entries(organization_id, category);
CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_entries_external
  ON expense_entries(organization_id, external_source, external_id);
