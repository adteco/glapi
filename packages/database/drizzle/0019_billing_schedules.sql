-- Billing Schedules for Subscription Billing
-- Implements scheduled invoice generation from subscriptions

-- Enum for billing schedule status
DO $$ BEGIN
  CREATE TYPE billing_schedule_status AS ENUM (
    'draft',
    'active',
    'paused',
    'completed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Enum for billing schedule line status
DO $$ BEGIN
  CREATE TYPE billing_schedule_line_status AS ENUM (
    'scheduled',
    'invoiced',
    'paid',
    'overdue',
    'cancelled',
    'skipped'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Billing schedules table - the overall schedule for a subscription
CREATE TABLE IF NOT EXISTS billing_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id),

  -- Schedule identifiers
  schedule_number VARCHAR(50) NOT NULL,

  -- Schedule timing
  start_date DATE NOT NULL,
  end_date DATE,
  frequency VARCHAR(20) NOT NULL,
  billing_day INTEGER DEFAULT 1,
  payment_terms_days INTEGER DEFAULT 30,

  -- Status
  status billing_schedule_status NOT NULL DEFAULT 'draft',

  -- Tracking fields
  next_billing_date DATE,
  last_billed_date DATE,
  last_billed_amount DECIMAL(12, 2),

  -- Totals
  total_scheduled_amount DECIMAL(15, 2) DEFAULT 0,
  total_invoiced_amount DECIMAL(15, 2) DEFAULT 0,
  total_paid_amount DECIMAL(15, 2) DEFAULT 0,

  -- Line counts
  total_lines INTEGER DEFAULT 0,
  invoiced_lines INTEGER DEFAULT 0,
  paid_lines INTEGER DEFAULT 0,

  -- Version tracking
  subscription_version_number INTEGER,

  -- Metadata
  notes TEXT,
  metadata JSONB,

  -- Audit fields
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE(organization_id, schedule_number)
);

-- Billing schedule lines - individual billing periods
CREATE TABLE IF NOT EXISTS billing_schedule_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_schedule_id UUID NOT NULL REFERENCES billing_schedules(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Sequence for ordering
  sequence_number INTEGER NOT NULL,

  -- Billing period
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,

  -- Expected billing date
  scheduled_billing_date DATE NOT NULL,

  -- Due date
  due_date DATE NOT NULL,

  -- Expected amount
  expected_amount DECIMAL(12, 2) NOT NULL,

  -- Proration fields
  is_prorated BOOLEAN DEFAULT FALSE,
  prorated_days INTEGER,
  full_period_days INTEGER,

  -- Invoice reference
  invoice_id UUID REFERENCES invoices(id),
  invoiced_date DATE,
  invoiced_amount DECIMAL(12, 2),

  -- Status
  status billing_schedule_line_status NOT NULL DEFAULT 'scheduled',

  -- Notes and metadata
  notes TEXT,
  metadata JSONB,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE(billing_schedule_id, sequence_number)
);

-- Indexes for billing_schedules
CREATE INDEX IF NOT EXISTS idx_billing_schedules_org_id
  ON billing_schedules(organization_id);

CREATE INDEX IF NOT EXISTS idx_billing_schedules_subscription_id
  ON billing_schedules(subscription_id);

CREATE INDEX IF NOT EXISTS idx_billing_schedules_status
  ON billing_schedules(status);

CREATE INDEX IF NOT EXISTS idx_billing_schedules_next_billing_date
  ON billing_schedules(next_billing_date);

-- Indexes for billing_schedule_lines
CREATE INDEX IF NOT EXISTS idx_billing_schedule_lines_schedule_id
  ON billing_schedule_lines(billing_schedule_id);

CREATE INDEX IF NOT EXISTS idx_billing_schedule_lines_org_id
  ON billing_schedule_lines(organization_id);

CREATE INDEX IF NOT EXISTS idx_billing_schedule_lines_status
  ON billing_schedule_lines(status);

CREATE INDEX IF NOT EXISTS idx_billing_schedule_lines_scheduled_date
  ON billing_schedule_lines(scheduled_billing_date);

CREATE INDEX IF NOT EXISTS idx_billing_schedule_lines_invoice_id
  ON billing_schedule_lines(invoice_id);

-- Add fields to subscriptions table for billing tracking
DO $$ BEGIN
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS active_billing_schedule_id UUID REFERENCES billing_schedules(id);
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS next_billing_date DATE;
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_billed_date DATE;
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_billed_amount DECIMAL(12, 2);
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Comments
COMMENT ON TABLE billing_schedules IS 'Tracks billing schedules generated from subscription contracts';
COMMENT ON TABLE billing_schedule_lines IS 'Individual billing period entries within a billing schedule';
