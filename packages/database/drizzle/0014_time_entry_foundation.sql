-- Migration 0014: Time Tracking Foundation (time entries, labor rates, assignments, approvals, batches, attachments)

-- Enums
DO $$ BEGIN
  CREATE TYPE time_entry_status AS ENUM ('DRAFT','SUBMITTED','APPROVED','REJECTED','POSTED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE time_entry_type AS ENUM ('REGULAR','OVERTIME','DOUBLE_TIME','PTO','SICK','HOLIDAY','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE approval_action AS ENUM ('SUBMITTED','APPROVED','REJECTED','RETURNED','CANCELLED','REOPENED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  subsidiary_id uuid REFERENCES subsidiaries(id),
  employee_id uuid NOT NULL REFERENCES users(id),
  project_id uuid REFERENCES projects(id),
  cost_code_id uuid REFERENCES project_cost_codes(id),
  entry_date date NOT NULL,
  hours numeric(6,2) NOT NULL,
  entry_type time_entry_type NOT NULL DEFAULT 'REGULAR',
  is_billable boolean NOT NULL DEFAULT true,
  billing_rate numeric(15,4),
  labor_rate numeric(15,4),
  labor_cost numeric(18,4),
  burden_rate numeric(15,4),
  burden_cost numeric(18,4),
  total_cost numeric(18,4),
  description text,
  internal_notes text,
  status time_entry_status NOT NULL DEFAULT 'DRAFT',
  submitted_at timestamptz,
  submitted_by uuid REFERENCES users(id),
  approved_at timestamptz,
  approved_by uuid REFERENCES users(id),
  rejected_at timestamptz,
  rejected_by uuid REFERENCES users(id),
  rejection_reason text,
  posted_at timestamptz,
  gl_transaction_id uuid,
  gl_posting_batch_id uuid,
  external_id text,
  external_source text,
  metadata jsonb,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_org_date ON time_entries (organization_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_employee_date ON time_entries (employee_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_project ON time_entries (project_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_status ON time_entries (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_time_entries_pending_approval ON time_entries (organization_id, status, submitted_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_time_entries_external ON time_entries (organization_id, external_source, external_id);

CREATE TABLE IF NOT EXISTS labor_cost_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  subsidiary_id uuid REFERENCES subsidiaries(id),
  employee_id uuid REFERENCES users(id),
  project_id uuid REFERENCES projects(id),
  cost_code_id uuid REFERENCES project_cost_codes(id),
  labor_role text,
  labor_rate numeric(15,4) NOT NULL,
  burden_rate numeric(15,4) NOT NULL DEFAULT 0,
  billing_rate numeric(15,4),
  overtime_multiplier numeric(4,2) NOT NULL DEFAULT 1.5,
  double_time_multiplier numeric(4,2) NOT NULL DEFAULT 2.0,
  effective_from date NOT NULL,
  effective_to date,
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  currency_code text NOT NULL DEFAULT 'USD',
  description text,
  metadata jsonb,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_project_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  employee_id uuid NOT NULL REFERENCES users(id),
  project_id uuid NOT NULL REFERENCES projects(id),
  role text,
  default_cost_code_id uuid REFERENCES project_cost_codes(id),
  budgeted_hours numeric(10,2),
  actual_hours numeric(10,2) NOT NULL DEFAULT 0,
  start_date date,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  can_approve_time boolean NOT NULL DEFAULT false,
  metadata jsonb,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT idx_employee_project_unique UNIQUE (employee_id, project_id)
);

CREATE TABLE IF NOT EXISTS time_entry_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id uuid NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
  action approval_action NOT NULL,
  previous_status time_entry_status,
  new_status time_entry_status NOT NULL,
  performed_by uuid NOT NULL REFERENCES users(id),
  performed_at timestamptz NOT NULL DEFAULT now(),
  comments text,
  metadata jsonb
);

CREATE TABLE IF NOT EXISTS time_entry_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  batch_number text NOT NULL,
  description text,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_entries integer NOT NULL DEFAULT 0,
  total_hours numeric(10,2) NOT NULL DEFAULT 0,
  total_cost numeric(18,4) NOT NULL DEFAULT 0,
  status time_entry_status NOT NULL DEFAULT 'DRAFT',
  submitted_at timestamptz,
  submitted_by uuid REFERENCES users(id),
  approved_at timestamptz,
  approved_by uuid REFERENCES users(id),
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS time_entry_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  time_entry_id uuid NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  content_type text,
  file_size bigint,
  uploaded_by uuid REFERENCES users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb
);

CREATE INDEX IF NOT EXISTS idx_time_entry_attachments_org_entry
  ON time_entry_attachments (organization_id, time_entry_id);
