-- Create revenue recognition enums
CREATE TYPE obligation_type AS ENUM (
  'product_license',
  'maintenance_support',
  'professional_services',
  'hosting_services',
  'other'
);

CREATE TYPE satisfaction_method AS ENUM (
  'point_in_time',
  'over_time'
);

CREATE TYPE recognition_pattern AS ENUM (
  'straight_line',
  'proportional',
  'milestone_based',
  'usage_based'
);

CREATE TYPE schedule_status AS ENUM (
  'scheduled',
  'recognized',
  'deferred',
  'cancelled'
);

CREATE TYPE po_status AS ENUM (
  'active',
  'satisfied',
  'cancelled'
);

CREATE TYPE evidence_type AS ENUM (
  'standalone_sale',
  'competitor_pricing',
  'cost_plus_margin',
  'market_assessment'
);

CREATE TYPE confidence_level AS ENUM (
  'high',
  'medium',
  'low'
);

CREATE TYPE allocation_method AS ENUM (
  'ssp_proportional',
  'residual',
  'specified_percentage'
);

CREATE TYPE journal_status AS ENUM (
  'draft',
  'posted',
  'reversed'
);

-- Create performance_obligations table
CREATE TABLE IF NOT EXISTS performance_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id),
  item_id UUID NOT NULL REFERENCES items(id),
  obligation_type obligation_type NOT NULL,
  allocated_amount DECIMAL(12,2) NOT NULL,
  satisfaction_method satisfaction_method NOT NULL,
  satisfaction_period_months INTEGER,
  start_date DATE NOT NULL,
  end_date DATE,
  status po_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT allocated_amount_positive CHECK (allocated_amount >= 0),
  CONSTRAINT satisfaction_period_positive CHECK (satisfaction_period_months IS NULL OR satisfaction_period_months > 0),
  CONSTRAINT po_dates_valid CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Create revenue_schedules table
CREATE TABLE IF NOT EXISTS revenue_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  performance_obligation_id UUID NOT NULL REFERENCES performance_obligations(id) ON DELETE CASCADE,
  period_start_date DATE NOT NULL,
  period_end_date DATE NOT NULL,
  scheduled_amount DECIMAL(12,2) NOT NULL,
  recognized_amount DECIMAL(12,2) DEFAULT 0,
  recognition_date DATE,
  recognition_pattern recognition_pattern NOT NULL,
  status schedule_status NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT period_dates_valid CHECK (period_end_date >= period_start_date),
  CONSTRAINT amounts_non_negative CHECK (scheduled_amount >= 0 AND recognized_amount >= 0),
  CONSTRAINT recognized_not_exceed_scheduled CHECK (recognized_amount <= scheduled_amount)
);

-- Create ssp_evidence table
CREATE TABLE IF NOT EXISTS ssp_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  item_id UUID NOT NULL REFERENCES items(id),
  evidence_type evidence_type NOT NULL,
  evidence_date DATE NOT NULL,
  ssp_amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  evidence_source VARCHAR(255),
  confidence_level confidence_level NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT ssp_amount_positive CHECK (ssp_amount > 0)
);

-- Create contract_ssp_allocations table
CREATE TABLE IF NOT EXISTS contract_ssp_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id),
  performance_obligation_id UUID NOT NULL REFERENCES performance_obligations(id) ON DELETE CASCADE,
  ssp_amount DECIMAL(10,2) NOT NULL,
  allocated_amount DECIMAL(12,2) NOT NULL,
  allocation_percentage DECIMAL(7,4) NOT NULL,
  allocation_method allocation_method NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT ssp_amount_positive CHECK (ssp_amount > 0),
  CONSTRAINT allocated_amount_non_negative CHECK (allocated_amount >= 0),
  CONSTRAINT allocation_percentage_valid CHECK (allocation_percentage >= 0 AND allocation_percentage <= 100),
  CONSTRAINT po_subscription_unique UNIQUE (subscription_id, performance_obligation_id)
);

-- Create revenue_journal_entries table
CREATE TABLE IF NOT EXISTS revenue_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  revenue_schedule_id UUID NOT NULL REFERENCES revenue_schedules(id) ON DELETE CASCADE,
  accounting_period_id UUID REFERENCES accounting_periods(id),
  entry_date DATE NOT NULL,
  deferred_revenue_amount DECIMAL(12,2),
  recognized_revenue_amount DECIMAL(12,2),
  journal_entry_reference VARCHAR(255),
  status journal_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT amounts_non_negative CHECK (
    (deferred_revenue_amount IS NULL OR deferred_revenue_amount >= 0) AND
    (recognized_revenue_amount IS NULL OR recognized_revenue_amount >= 0)
  ),
  CONSTRAINT at_least_one_amount CHECK (
    deferred_revenue_amount IS NOT NULL OR recognized_revenue_amount IS NOT NULL
  )
);

-- Create indexes for better performance
CREATE INDEX idx_po_organization ON performance_obligations(organization_id);
CREATE INDEX idx_po_subscription ON performance_obligations(subscription_id);
CREATE INDEX idx_po_item ON performance_obligations(item_id);
CREATE INDEX idx_po_status ON performance_obligations(status);

CREATE INDEX idx_revenue_schedules_organization ON revenue_schedules(organization_id);
CREATE INDEX idx_revenue_schedules_po ON revenue_schedules(performance_obligation_id);
CREATE INDEX idx_revenue_schedules_period ON revenue_schedules(period_start_date, period_end_date);
CREATE INDEX idx_revenue_schedules_status ON revenue_schedules(status);

CREATE INDEX idx_ssp_evidence_organization ON ssp_evidence(organization_id);
CREATE INDEX idx_ssp_evidence_item ON ssp_evidence(item_id);
CREATE INDEX idx_ssp_evidence_active ON ssp_evidence(is_active, evidence_date DESC);

CREATE INDEX idx_contract_allocations_organization ON contract_ssp_allocations(organization_id);
CREATE INDEX idx_contract_allocations_subscription ON contract_ssp_allocations(subscription_id);
CREATE INDEX idx_contract_allocations_po ON contract_ssp_allocations(performance_obligation_id);

CREATE INDEX idx_journal_entries_organization ON revenue_journal_entries(organization_id);
CREATE INDEX idx_journal_entries_schedule ON revenue_journal_entries(revenue_schedule_id);
CREATE INDEX idx_journal_entries_period ON revenue_journal_entries(accounting_period_id);
CREATE INDEX idx_journal_entries_date ON revenue_journal_entries(entry_date);

-- Create triggers for updated_at
CREATE TRIGGER update_performance_obligations_updated_at 
  BEFORE UPDATE ON performance_obligations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_revenue_schedules_updated_at 
  BEFORE UPDATE ON revenue_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to calculate total recognized revenue for a performance obligation
CREATE OR REPLACE FUNCTION get_po_recognized_revenue(po_id UUID)
RETURNS DECIMAL(12,2) AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(recognized_amount) 
     FROM revenue_schedules 
     WHERE performance_obligation_id = po_id
       AND status = 'recognized'),
    0
  );
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate remaining revenue to recognize
CREATE OR REPLACE FUNCTION get_po_remaining_revenue(po_id UUID)
RETURNS DECIMAL(12,2) AS $$
DECLARE
  allocated DECIMAL(12,2);
  recognized DECIMAL(12,2);
BEGIN
  SELECT allocated_amount INTO allocated
  FROM performance_obligations
  WHERE id = po_id;
  
  recognized := get_po_recognized_revenue(po_id);
  
  RETURN COALESCE(allocated - recognized, 0);
END;
$$ LANGUAGE plpgsql;