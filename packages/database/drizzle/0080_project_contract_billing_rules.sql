-- Project contract and project-billing policy foundation.
-- Introduces immutable contract versions, effective-dated T&M rates,
-- fixed-fee billing milestones, and progress certifications.

CREATE TYPE project_contract_status AS ENUM (
  'draft', 'approved', 'active', 'suspended', 'completed', 'terminated', 'cancelled'
);

CREATE TYPE project_contract_version_status AS ENUM (
  'draft', 'approved', 'superseded', 'cancelled'
);

CREATE TYPE project_billing_grouping AS ENUM (
  'customer', 'project', 'customer_project'
);

CREATE TYPE project_billing_rule_type AS ENUM (
  'time_and_materials', 'fixed_fee_milestone', 'fixed_fee_progress'
);

CREATE TYPE project_billing_rate_scope AS ENUM (
  'default', 'person', 'role', 'task', 'item', 'cost_code'
);

CREATE TYPE project_progress_measure AS ENUM (
  'cost_to_cost', 'labor_hours', 'units_delivered', 'elapsed_time', 'manual_output'
);

CREATE TYPE project_billing_milestone_status AS ENUM (
  'pending', 'achieved', 'approved', 'invoiced', 'cancelled'
);

CREATE TYPE project_progress_certification_status AS ENUM (
  'draft', 'submitted', 'approved', 'rejected', 'invoiced', 'cancelled'
);

CREATE TYPE project_revenue_timing AS ENUM (
  'point_in_time', 'over_time'
);

CREATE TYPE project_revenue_recognition_method AS ENUM (
  'right_to_invoice',
  'cost_to_cost',
  'labor_hours',
  'units_delivered',
  'elapsed_time',
  'manual_output'
);

ALTER TYPE invoice_source_type ADD VALUE IF NOT EXISTS 'PROJECT_MILESTONE';
ALTER TYPE invoice_source_type ADD VALUE IF NOT EXISTS 'PROJECT_PROGRESS';

CREATE TABLE project_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subsidiary_id UUID NOT NULL REFERENCES subsidiaries(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  customer_id UUID NOT NULL REFERENCES entities(id),
  contract_number TEXT NOT NULL,
  name TEXT NOT NULL,
  status project_contract_status NOT NULL DEFAULT 'draft',
  transaction_currency_code CHAR(3) NOT NULL DEFAULT 'USD',
  functional_currency_code CHAR(3) NOT NULL DEFAULT 'USD',
  exchange_rate NUMERIC(18, 8) NOT NULL DEFAULT 1,
  start_date DATE NOT NULL,
  end_date DATE,
  signed_date DATE,
  current_version_id UUID,
  metadata JSONB,
  created_by UUID REFERENCES entities(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES entities(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_project_contracts_date_range CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT chk_project_contracts_exchange_rate CHECK (exchange_rate > 0),
  CONSTRAINT chk_project_contracts_currency CHECK (
    transaction_currency_code = upper(transaction_currency_code)
    AND functional_currency_code = upper(functional_currency_code)
  )
);

CREATE UNIQUE INDEX ux_project_contracts_org_number
  ON project_contracts(organization_id, contract_number);
CREATE INDEX idx_project_contracts_project
  ON project_contracts(organization_id, project_id);
CREATE INDEX idx_project_contracts_customer
  ON project_contracts(organization_id, customer_id);
CREATE INDEX idx_project_contracts_status
  ON project_contracts(organization_id, status);

CREATE TABLE project_contract_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_contract_id UUID NOT NULL REFERENCES project_contracts(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  status project_contract_version_status NOT NULL DEFAULT 'draft',
  billing_model project_billing_model NOT NULL,
  billing_grouping project_billing_grouping NOT NULL DEFAULT 'customer_project',
  transaction_price NUMERIC(18, 4) NOT NULL DEFAULT 0,
  variable_consideration NUMERIC(18, 4) NOT NULL DEFAULT 0,
  payment_terms_days INTEGER NOT NULL DEFAULT 30,
  effective_start_date DATE NOT NULL,
  effective_end_date DATE,
  supersedes_version_id UUID REFERENCES project_contract_versions(id),
  change_reason TEXT,
  metadata JSONB,
  approved_by UUID REFERENCES entities(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES entities(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_project_contract_versions_version CHECK (version_number > 0),
  CONSTRAINT chk_project_contract_versions_transaction_price CHECK (transaction_price >= 0),
  CONSTRAINT chk_project_contract_versions_payment_terms CHECK (payment_terms_days >= 0),
  CONSTRAINT chk_project_contract_versions_effective_range CHECK (
    effective_end_date IS NULL OR effective_end_date >= effective_start_date
  ),
  CONSTRAINT chk_project_contract_versions_approval CHECK (
    status IN ('draft', 'cancelled') OR (approved_at IS NOT NULL AND approved_by IS NOT NULL)
  )
);

CREATE UNIQUE INDEX ux_project_contract_versions_number
  ON project_contract_versions(project_contract_id, version_number);
CREATE UNIQUE INDEX ux_project_contract_versions_approved
  ON project_contract_versions(project_contract_id)
  WHERE status = 'approved';
CREATE INDEX idx_project_contract_versions_status
  ON project_contract_versions(organization_id, status);
CREATE INDEX idx_project_contract_versions_effective
  ON project_contract_versions(project_contract_id, effective_start_date);

ALTER TABLE project_contracts
  ADD CONSTRAINT fk_project_contracts_current_version
  FOREIGN KEY (current_version_id) REFERENCES project_contract_versions(id) ON DELETE SET NULL;

CREATE TABLE project_contract_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_contract_version_id UUID NOT NULL REFERENCES project_contract_versions(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  item_id UUID REFERENCES items(id),
  description TEXT NOT NULL,
  quantity NUMERIC(18, 4) NOT NULL DEFAULT 1,
  unit_price NUMERIC(18, 4) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
  transaction_price NUMERIC(18, 4) NOT NULL DEFAULT 0,
  ssp_amount NUMERIC(18, 4),
  service_start_date DATE,
  service_end_date DATE,
  revenue_timing project_revenue_timing NOT NULL,
  recognition_method project_revenue_recognition_method NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_project_contract_lines_number CHECK (line_number > 0),
  CONSTRAINT chk_project_contract_lines_amounts CHECK (
    quantity >= 0 AND unit_price >= 0 AND discount_amount >= 0 AND transaction_price >= 0
    AND (ssp_amount IS NULL OR ssp_amount >= 0)
  ),
  CONSTRAINT chk_project_contract_lines_service_range CHECK (
    service_end_date IS NULL OR service_start_date IS NULL OR service_end_date >= service_start_date
  )
);

CREATE UNIQUE INDEX ux_project_contract_lines_number
  ON project_contract_lines(project_contract_version_id, line_number);
CREATE INDEX idx_project_contract_lines_version
  ON project_contract_lines(project_contract_version_id);

CREATE TABLE project_billing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_contract_version_id UUID NOT NULL REFERENCES project_contract_versions(id) ON DELETE CASCADE,
  project_contract_line_id UUID REFERENCES project_contract_lines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rule_type project_billing_rule_type NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  effective_start_date DATE NOT NULL,
  effective_end_date DATE,
  currency_code CHAR(3) NOT NULL DEFAULT 'USD',
  grouping project_billing_grouping NOT NULL DEFAULT 'customer_project',
  default_rate NUMERIC(18, 6),
  fixed_fee_amount NUMERIC(18, 4),
  progress_measure project_progress_measure,
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB,
  created_by UUID REFERENCES entities(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES entities(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_project_billing_rules_effective_range CHECK (
    effective_end_date IS NULL OR effective_end_date >= effective_start_date
  ),
  CONSTRAINT chk_project_billing_rules_amounts CHECK (
    (default_rate IS NULL OR default_rate >= 0)
    AND (fixed_fee_amount IS NULL OR fixed_fee_amount >= 0)
  ),
  CONSTRAINT chk_project_billing_rules_currency CHECK (currency_code = upper(currency_code)),
  CONSTRAINT chk_project_billing_rules_policy_fields CHECK (
    (rule_type = 'time_and_materials' AND fixed_fee_amount IS NULL AND progress_measure IS NULL)
    OR (rule_type = 'fixed_fee_milestone' AND fixed_fee_amount IS NOT NULL AND progress_measure IS NULL)
    OR (rule_type = 'fixed_fee_progress' AND fixed_fee_amount IS NOT NULL AND progress_measure IS NOT NULL)
  )
);

CREATE INDEX idx_project_billing_rules_version
  ON project_billing_rules(organization_id, project_contract_version_id);
CREATE INDEX idx_project_billing_rules_effective
  ON project_billing_rules(project_contract_version_id, rule_type, effective_start_date);

CREATE TABLE project_billing_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  billing_rule_id UUID NOT NULL REFERENCES project_billing_rules(id) ON DELETE CASCADE,
  rate_scope project_billing_rate_scope NOT NULL,
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  role_key TEXT,
  project_task_id UUID REFERENCES project_tasks(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  project_cost_code_id UUID REFERENCES project_cost_codes(id) ON DELETE CASCADE,
  unit_rate NUMERIC(18, 6) NOT NULL,
  effective_start_date DATE NOT NULL,
  effective_end_date DATE,
  priority INTEGER NOT NULL DEFAULT 100,
  metadata JSONB,
  created_by UUID REFERENCES entities(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_project_billing_rates_effective_range CHECK (
    effective_end_date IS NULL OR effective_end_date >= effective_start_date
  ),
  CONSTRAINT chk_project_billing_rates_unit_rate CHECK (unit_rate >= 0),
  CONSTRAINT chk_project_billing_rates_scope_target CHECK (
    (rate_scope = 'default' AND entity_id IS NULL AND role_key IS NULL AND project_task_id IS NULL
      AND item_id IS NULL AND project_cost_code_id IS NULL)
    OR (rate_scope = 'person' AND entity_id IS NOT NULL)
    OR (rate_scope = 'role' AND role_key IS NOT NULL)
    OR (rate_scope = 'task' AND project_task_id IS NOT NULL)
    OR (rate_scope = 'item' AND item_id IS NOT NULL)
    OR (rate_scope = 'cost_code' AND project_cost_code_id IS NOT NULL)
  )
);

CREATE INDEX idx_project_billing_rates_resolution
  ON project_billing_rates(organization_id, billing_rule_id, rate_scope, effective_start_date DESC);
CREATE UNIQUE INDEX ux_project_billing_rates_effective_target
  ON project_billing_rates(
    billing_rule_id,
    rate_scope,
    COALESCE(entity_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(role_key, ''),
    COALESCE(project_task_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(item_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(project_cost_code_id, '00000000-0000-0000-0000-000000000000'::uuid),
    effective_start_date
  );

CREATE TABLE project_contract_billing_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  billing_rule_id UUID NOT NULL REFERENCES project_billing_rules(id) ON DELETE CASCADE,
  project_contract_line_id UUID REFERENCES project_contract_lines(id) ON DELETE SET NULL,
  project_milestone_id UUID REFERENCES project_milestones(id) ON DELETE SET NULL,
  sequence_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(18, 4),
  percentage NUMERIC(8, 4),
  target_date DATE,
  acceptance_condition TEXT NOT NULL,
  status project_billing_milestone_status NOT NULL DEFAULT 'pending',
  achieved_at TIMESTAMPTZ,
  achieved_by UUID REFERENCES entities(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES entities(id) ON DELETE SET NULL,
  invoiced_at TIMESTAMPTZ,
  metadata JSONB,
  created_by UUID REFERENCES entities(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_project_contract_billing_milestones_sequence CHECK (sequence_number > 0),
  CONSTRAINT chk_project_contract_billing_milestones_value CHECK (
    (amount IS NOT NULL AND percentage IS NULL AND amount >= 0)
    OR (amount IS NULL AND percentage IS NOT NULL AND percentage > 0 AND percentage <= 100)
  ),
  CONSTRAINT chk_project_contract_billing_milestones_approval CHECK (
    status IN ('pending', 'achieved', 'cancelled') OR (approved_at IS NOT NULL AND approved_by IS NOT NULL)
  )
);

CREATE UNIQUE INDEX ux_project_contract_billing_milestones_sequence
  ON project_contract_billing_milestones(billing_rule_id, sequence_number);
CREATE INDEX idx_project_contract_billing_milestones_status
  ON project_contract_billing_milestones(organization_id, status, target_date);

CREATE TABLE project_progress_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  billing_rule_id UUID NOT NULL REFERENCES project_billing_rules(id) ON DELETE CASCADE,
  certification_date DATE NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  cumulative_progress_percent NUMERIC(8, 4) NOT NULL,
  cumulative_billable_amount NUMERIC(18, 4) NOT NULL,
  status project_progress_certification_status NOT NULL DEFAULT 'draft',
  evidence JSONB,
  notes TEXT,
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES entities(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES entities(id) ON DELETE SET NULL,
  invoiced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_project_progress_certifications_version CHECK (version_number > 0),
  CONSTRAINT chk_project_progress_certifications_progress CHECK (
    cumulative_progress_percent >= 0 AND cumulative_progress_percent <= 100
    AND cumulative_billable_amount >= 0
  ),
  CONSTRAINT chk_project_progress_certifications_approval CHECK (
    status IN ('draft', 'submitted', 'rejected', 'cancelled')
    OR (approved_at IS NOT NULL AND approved_by IS NOT NULL)
  )
);

CREATE UNIQUE INDEX ux_project_progress_certifications_version
  ON project_progress_certifications(billing_rule_id, certification_date, version_number);
CREATE INDEX idx_project_progress_certifications_status
  ON project_progress_certifications(organization_id, status, certification_date);

-- Every project-contract table carries organization_id so tenant isolation is direct and auditable.
ALTER TABLE project_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_contract_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_contract_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_billing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_billing_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_contract_billing_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_progress_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation_project_contracts ON project_contracts
  USING (organization_id::text = current_setting('app.current_organization_id', true))
  WITH CHECK (organization_id::text = current_setting('app.current_organization_id', true));
CREATE POLICY org_isolation_project_contract_versions ON project_contract_versions
  USING (organization_id::text = current_setting('app.current_organization_id', true))
  WITH CHECK (organization_id::text = current_setting('app.current_organization_id', true));
CREATE POLICY org_isolation_project_contract_lines ON project_contract_lines
  USING (organization_id::text = current_setting('app.current_organization_id', true))
  WITH CHECK (organization_id::text = current_setting('app.current_organization_id', true));
CREATE POLICY org_isolation_project_billing_rules ON project_billing_rules
  USING (organization_id::text = current_setting('app.current_organization_id', true))
  WITH CHECK (organization_id::text = current_setting('app.current_organization_id', true));
CREATE POLICY org_isolation_project_billing_rates ON project_billing_rates
  USING (organization_id::text = current_setting('app.current_organization_id', true))
  WITH CHECK (organization_id::text = current_setting('app.current_organization_id', true));
CREATE POLICY org_isolation_project_contract_billing_milestones ON project_contract_billing_milestones
  USING (organization_id::text = current_setting('app.current_organization_id', true))
  WITH CHECK (organization_id::text = current_setting('app.current_organization_id', true));
CREATE POLICY org_isolation_project_progress_certifications ON project_progress_certifications
  USING (organization_id::text = current_setting('app.current_organization_id', true))
  WITH CHECK (organization_id::text = current_setting('app.current_organization_id', true));

COMMENT ON TABLE project_contracts IS
  'Commercial root for project billing and ASC 606; operational projects remain separate.';
COMMENT ON TABLE project_contract_versions IS
  'Immutable approved commercial terms; changes create a new version.';
COMMENT ON TABLE project_billing_rates IS
  'Effective-dated T&M rates resolved by source override, scoped rate, then contract default.';
COMMENT ON TABLE project_contract_billing_milestones IS
  'Commercial billing milestones optionally linked to operational project milestones.';
COMMENT ON TABLE project_progress_certifications IS
  'Immutable versions of approved cumulative billing progress.';
