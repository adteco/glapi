-- Migration: 0022_consolidation_configs.sql
-- Description: Create consolidation configuration tables for multi-book accounting
-- Supports: consolidation groups, elimination rules, FX translation, intercompany mappings

-- ==========================================
-- Enums
-- ==========================================

DO $$ BEGIN
  CREATE TYPE consolidation_method AS ENUM ('FULL', 'PROPORTIONAL', 'EQUITY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE elimination_type AS ENUM (
    'INTERCOMPANY_RECEIVABLE',
    'INTERCOMPANY_REVENUE',
    'INTERCOMPANY_INVESTMENT',
    'INTERCOMPANY_DIVIDEND',
    'UNREALIZED_PROFIT',
    'CUSTOM'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE translation_method AS ENUM (
    'CURRENT_RATE',
    'TEMPORAL',
    'MONETARY_NONMONETARY'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE consolidation_run_status AS ENUM (
    'DRAFT',
    'IN_PROGRESS',
    'COMPLETED',
    'FAILED',
    'REVERSED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ==========================================
-- Consolidation Groups
-- ==========================================

CREATE TABLE IF NOT EXISTS consolidation_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  parent_subsidiary_id UUID NOT NULL REFERENCES subsidiaries(id),
  consolidation_currency_id UUID NOT NULL REFERENCES currencies(id),
  translation_method translation_method NOT NULL DEFAULT 'CURRENT_RATE',
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_date DATE NOT NULL,
  end_date DATE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_consol_group_org_code
  ON consolidation_groups(organization_id, code);

COMMENT ON TABLE consolidation_groups IS 'Defines groups of subsidiaries for consolidated financial reporting';
COMMENT ON COLUMN consolidation_groups.parent_subsidiary_id IS 'The parent/holding company subsidiary';
COMMENT ON COLUMN consolidation_groups.consolidation_currency_id IS 'Target currency for consolidated statements';
COMMENT ON COLUMN consolidation_groups.translation_method IS 'Default FX translation method for this group';

-- ==========================================
-- Consolidation Group Members
-- ==========================================

CREATE TABLE IF NOT EXISTS consolidation_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES consolidation_groups(id) ON DELETE CASCADE,
  subsidiary_id UUID NOT NULL REFERENCES subsidiaries(id),
  ownership_percent DECIMAL(5,2) NOT NULL CHECK (ownership_percent >= 0 AND ownership_percent <= 100),
  voting_percent DECIMAL(5,2) CHECK (voting_percent >= 0 AND voting_percent <= 100),
  consolidation_method consolidation_method NOT NULL DEFAULT 'FULL',
  minority_interest_account_id UUID REFERENCES accounts(id),
  effective_date DATE NOT NULL,
  end_date DATE,
  sequence_number INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_consol_member_group_sub
  ON consolidation_group_members(group_id, subsidiary_id);

COMMENT ON TABLE consolidation_group_members IS 'Links subsidiaries to consolidation groups with ownership details';
COMMENT ON COLUMN consolidation_group_members.ownership_percent IS 'Percentage ownership (0-100)';
COMMENT ON COLUMN consolidation_group_members.consolidation_method IS 'FULL=100% consolidate, PROPORTIONAL=by ownership %, EQUITY=equity method';
COMMENT ON COLUMN consolidation_group_members.sequence_number IS 'Order in which subsidiaries are processed during consolidation';

-- ==========================================
-- Elimination Rules
-- ==========================================

CREATE TABLE IF NOT EXISTS elimination_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES consolidation_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  elimination_type elimination_type NOT NULL,
  sequence_number INTEGER NOT NULL DEFAULT 10,

  -- Source side (to be eliminated)
  source_subsidiary_id UUID REFERENCES subsidiaries(id),
  source_account_id UUID REFERENCES accounts(id),
  source_account_pattern TEXT,

  -- Target side (counterparty)
  target_subsidiary_id UUID REFERENCES subsidiaries(id),
  target_account_id UUID REFERENCES accounts(id),
  target_account_pattern TEXT,

  -- Elimination posting accounts
  elimination_debit_account_id UUID REFERENCES accounts(id),
  elimination_credit_account_id UUID REFERENCES accounts(id),

  is_automatic BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_date DATE NOT NULL,
  end_date DATE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_elim_rule_group_type
  ON elimination_rules(group_id, elimination_type);

COMMENT ON TABLE elimination_rules IS 'Defines rules for eliminating intercompany transactions during consolidation';
COMMENT ON COLUMN elimination_rules.source_account_pattern IS 'SQL LIKE pattern for matching source accounts (e.g., 1200%)';
COMMENT ON COLUMN elimination_rules.is_automatic IS 'If true, rule is auto-applied during consolidation runs';

-- ==========================================
-- FX Translation Rules
-- ==========================================

CREATE TABLE IF NOT EXISTS fx_translation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES consolidation_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  account_sub_type TEXT,
  account_pattern TEXT,
  rate_type TEXT NOT NULL CHECK (rate_type IN ('CURRENT', 'HISTORICAL', 'AVERAGE')),
  cta_account_id UUID REFERENCES accounts(id),
  sequence_number INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fx_rule_group_acct
  ON fx_translation_rules(group_id, account_type);

COMMENT ON TABLE fx_translation_rules IS 'Defines how different account types are translated for FX consolidation';
COMMENT ON COLUMN fx_translation_rules.rate_type IS 'CURRENT=period-end rate, HISTORICAL=transaction date rate, AVERAGE=period average';
COMMENT ON COLUMN fx_translation_rules.cta_account_id IS 'Cumulative Translation Adjustment equity account';

-- ==========================================
-- Consolidation Exchange Rates
-- ==========================================

CREATE TABLE IF NOT EXISTS consolidation_exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  from_currency_id UUID NOT NULL REFERENCES currencies(id),
  to_currency_id UUID NOT NULL REFERENCES currencies(id),
  period_id UUID NOT NULL REFERENCES accounting_periods(id),
  rate_type TEXT NOT NULL CHECK (rate_type IN ('CURRENT', 'HISTORICAL', 'AVERAGE')),
  rate DECIMAL(18,8) NOT NULL CHECK (rate > 0),
  rate_date DATE NOT NULL,
  source TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_consol_rate_currency_period
  ON consolidation_exchange_rates(from_currency_id, to_currency_id, period_id, rate_type);

COMMENT ON TABLE consolidation_exchange_rates IS 'Exchange rates used for FX translation during consolidation';
COMMENT ON COLUMN consolidation_exchange_rates.rate IS 'Exchange rate: 1 from_currency = rate to_currency';

-- ==========================================
-- Consolidation Runs
-- ==========================================

CREATE TABLE IF NOT EXISTS consolidation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES consolidation_groups(id),
  period_id UUID NOT NULL REFERENCES accounting_periods(id),
  run_number INTEGER NOT NULL,
  status consolidation_run_status NOT NULL DEFAULT 'DRAFT',
  run_type TEXT NOT NULL CHECK (run_type IN ('PRELIMINARY', 'FINAL')),
  description TEXT,

  -- Statistics
  subsidiaries_processed INTEGER NOT NULL DEFAULT 0,
  eliminations_generated INTEGER NOT NULL DEFAULT 0,
  translation_adjustments INTEGER NOT NULL DEFAULT 0,
  total_debit_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
  total_credit_amount DECIMAL(18,4) NOT NULL DEFAULT 0,

  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  reversed_at TIMESTAMPTZ,
  reversed_by_run_id UUID,

  -- Audit
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_consol_run_group_period
  ON consolidation_runs(group_id, period_id, run_number);

CREATE INDEX IF NOT EXISTS idx_consol_run_status
  ON consolidation_runs(status, group_id);

COMMENT ON TABLE consolidation_runs IS 'Tracks each consolidation execution for a group/period';
COMMENT ON COLUMN consolidation_runs.run_type IS 'PRELIMINARY for testing, FINAL for official consolidation';

-- ==========================================
-- Consolidation Adjustments
-- ==========================================

CREATE TABLE IF NOT EXISTS consolidation_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES consolidation_runs(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('ELIMINATION', 'TRANSLATION', 'MINORITY_INTEREST', 'MANUAL')),

  -- Source information
  elimination_rule_id UUID REFERENCES elimination_rules(id),
  source_subsidiary_id UUID REFERENCES subsidiaries(id),
  target_subsidiary_id UUID REFERENCES subsidiaries(id),

  -- Journal entry details
  line_number INTEGER NOT NULL,
  account_id UUID NOT NULL REFERENCES accounts(id),
  description TEXT,
  debit_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
  credit_amount DECIMAL(18,4) NOT NULL DEFAULT 0,

  -- FX Translation details
  original_currency_code TEXT,
  original_amount DECIMAL(18,4),
  exchange_rate DECIMAL(18,8),
  translated_amount DECIMAL(18,4),
  cta_amount DECIMAL(18,4),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consol_adj_run_line
  ON consolidation_adjustments(run_id, line_number);

CREATE INDEX IF NOT EXISTS idx_consol_adj_type
  ON consolidation_adjustments(adjustment_type, run_id);

COMMENT ON TABLE consolidation_adjustments IS 'Individual journal entries generated during consolidation';
COMMENT ON COLUMN consolidation_adjustments.cta_amount IS 'Cumulative Translation Adjustment amount for FX translations';

-- ==========================================
-- Intercompany Account Mappings
-- ==========================================

CREATE TABLE IF NOT EXISTS intercompany_account_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  source_account_id UUID NOT NULL REFERENCES accounts(id),
  target_account_id UUID NOT NULL REFERENCES accounts(id),
  elimination_debit_account_id UUID REFERENCES accounts(id),
  elimination_credit_account_id UUID REFERENCES accounts(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_mapping_org_source_target
  ON intercompany_account_mappings(organization_id, source_account_id, target_account_id);

COMMENT ON TABLE intercompany_account_mappings IS 'Maps intercompany accounts for automatic elimination matching';
COMMENT ON COLUMN intercompany_account_mappings.source_account_id IS 'Account used by source subsidiary (e.g., IC Receivable)';
COMMENT ON COLUMN intercompany_account_mappings.target_account_id IS 'Corresponding account on counterparty (e.g., IC Payable)';

-- ==========================================
-- Triggers for updated_at
-- ==========================================

CREATE OR REPLACE FUNCTION update_consolidation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'consolidation_groups',
    'consolidation_group_members',
    'elimination_rules',
    'fx_translation_rules',
    'consolidation_exchange_rates',
    'consolidation_runs',
    'intercompany_account_mappings'
  ] LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I;
      CREATE TRIGGER trg_%I_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW
        EXECUTE FUNCTION update_consolidation_updated_at();
    ', tbl, tbl, tbl, tbl);
  END LOOP;
END $$;

-- ==========================================
-- Helper function to get effective exchange rate
-- ==========================================

CREATE OR REPLACE FUNCTION get_consolidation_exchange_rate(
  p_organization_id TEXT,
  p_from_currency_id UUID,
  p_to_currency_id UUID,
  p_period_id UUID,
  p_rate_type TEXT DEFAULT 'CURRENT'
)
RETURNS DECIMAL(18,8) AS $$
DECLARE
  v_rate DECIMAL(18,8);
BEGIN
  -- If same currency, return 1
  IF p_from_currency_id = p_to_currency_id THEN
    RETURN 1.0;
  END IF;

  -- Look for direct rate
  SELECT rate INTO v_rate
  FROM consolidation_exchange_rates
  WHERE organization_id = p_organization_id
    AND from_currency_id = p_from_currency_id
    AND to_currency_id = p_to_currency_id
    AND period_id = p_period_id
    AND rate_type = p_rate_type;

  IF v_rate IS NOT NULL THEN
    RETURN v_rate;
  END IF;

  -- Look for inverse rate
  SELECT 1.0 / rate INTO v_rate
  FROM consolidation_exchange_rates
  WHERE organization_id = p_organization_id
    AND from_currency_id = p_to_currency_id
    AND to_currency_id = p_from_currency_id
    AND period_id = p_period_id
    AND rate_type = p_rate_type;

  RETURN COALESCE(v_rate, 1.0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_consolidation_exchange_rate IS 'Returns the exchange rate for consolidation, handling inverse rates';
