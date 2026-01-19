-- Migration 0011: Item Costing Configuration
-- Supports configurable costing methods per item/subsidiary:
-- - FIFO (First In, First Out)
-- - LIFO (Last In, First Out)
-- - AVERAGE (Moving Average)
-- - WEIGHTED_AVERAGE (Weighted Average)
-- - STANDARD (Standard Cost with variance tracking)

-- Create costing method enum
DO $$ BEGIN
  CREATE TYPE costing_method_enum AS ENUM (
    'FIFO',
    'LIFO',
    'AVERAGE',
    'WEIGHTED_AVERAGE',
    'STANDARD'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Organization Costing Defaults
-- Default costing configuration at the organization level
CREATE TABLE IF NOT EXISTS organization_costing_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Default costing method for the organization
  default_costing_method costing_method_enum NOT NULL DEFAULT 'AVERAGE',

  -- Standard cost defaults
  allow_standard_cost_revaluation BOOLEAN DEFAULT FALSE,
  default_revaluation_account_id UUID REFERENCES accounts(id),

  -- Variance thresholds
  price_variance_threshold_percent DECIMAL(5, 2) DEFAULT 5.00,
  quantity_variance_threshold_percent DECIMAL(5, 2) DEFAULT 5.00,

  -- Settings
  track_cost_layers BOOLEAN DEFAULT TRUE,
  auto_recalculate_on_receipt BOOLEAN DEFAULT TRUE,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,

  CONSTRAINT org_costing_defaults_org_unique UNIQUE (organization_id)
);

-- Subsidiary Costing Configuration
-- Overrides organization defaults for specific subsidiaries
CREATE TABLE IF NOT EXISTS subsidiary_costing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subsidiary_id UUID NOT NULL REFERENCES subsidiaries(id) ON DELETE CASCADE,

  -- Override costing method for this subsidiary
  costing_method costing_method_enum NOT NULL,

  -- Override standard cost settings
  allow_standard_cost_revaluation BOOLEAN,
  revaluation_account_id UUID REFERENCES accounts(id),

  -- Override variance thresholds
  price_variance_threshold_percent DECIMAL(5, 2),
  quantity_variance_threshold_percent DECIMAL(5, 2),

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_date DATE NOT NULL,
  expiration_date DATE,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,

  CONSTRAINT subsidiary_costing_config_unique UNIQUE (organization_id, subsidiary_id)
);

CREATE INDEX IF NOT EXISTS subsidiary_costing_config_active_idx
  ON subsidiary_costing_config(subsidiary_id, is_active);

-- Item Costing Methods
-- Most granular override - applies to specific items in specific subsidiaries
CREATE TABLE IF NOT EXISTS item_costing_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subsidiary_id UUID NOT NULL REFERENCES subsidiaries(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,

  -- Costing method for this item in this subsidiary
  costing_method costing_method_enum NOT NULL,

  -- Standard cost (if using STANDARD method)
  standard_cost DECIMAL(18, 4),
  standard_cost_effective_date TIMESTAMPTZ,
  previous_standard_cost DECIMAL(18, 4),

  -- Revaluation settings
  allow_standard_cost_revaluation BOOLEAN DEFAULT FALSE,
  revaluation_account_id UUID REFERENCES accounts(id),

  -- Override default item cost with subsidiary-specific default
  override_default_cost DECIMAL(18, 4),

  -- Variance thresholds (override subsidiary/org defaults)
  price_variance_threshold_percent DECIMAL(5, 2),
  quantity_variance_threshold_percent DECIMAL(5, 2),

  -- Status and dates
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_date DATE NOT NULL,
  expiration_date DATE,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,

  CONSTRAINT item_costing_methods_unique UNIQUE (organization_id, subsidiary_id, item_id)
);

CREATE INDEX IF NOT EXISTS item_costing_methods_item_idx
  ON item_costing_methods(item_id);
CREATE INDEX IF NOT EXISTS item_costing_methods_subsidiary_idx
  ON item_costing_methods(subsidiary_id);
CREATE INDEX IF NOT EXISTS item_costing_methods_active_idx
  ON item_costing_methods(item_id, subsidiary_id, is_active);

-- Item Cost Layers (for FIFO/LIFO tracking)
-- Tracks individual cost layers for FIFO/LIFO inventory valuation
CREATE TABLE IF NOT EXISTS item_cost_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subsidiary_id UUID NOT NULL REFERENCES subsidiaries(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,

  -- Layer identification
  layer_number TEXT NOT NULL,
  receipt_date TIMESTAMPTZ NOT NULL,

  -- Source transaction
  source_transaction_id UUID,
  source_transaction_type TEXT,
  source_document_number TEXT,

  -- Quantities
  quantity_received DECIMAL(18, 4) NOT NULL,
  quantity_remaining DECIMAL(18, 4) NOT NULL,
  quantity_reserved DECIMAL(18, 4) DEFAULT 0,

  -- Costs
  unit_cost DECIMAL(18, 4) NOT NULL,
  total_cost DECIMAL(18, 4) NOT NULL,
  currency_code TEXT DEFAULT 'USD',

  -- Lot/Serial reference (if tracked)
  lot_number_id UUID,

  -- Status
  is_fully_depleted BOOLEAN NOT NULL DEFAULT FALSE,
  depleted_at TIMESTAMPTZ,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,

  CONSTRAINT item_cost_layers_number_unique UNIQUE (organization_id, item_id, subsidiary_id, layer_number)
);

CREATE INDEX IF NOT EXISTS item_cost_layers_item_subsidiary_idx
  ON item_cost_layers(item_id, subsidiary_id);
CREATE INDEX IF NOT EXISTS item_cost_layers_active_idx
  ON item_cost_layers(item_id, subsidiary_id, is_fully_depleted);
CREATE INDEX IF NOT EXISTS item_cost_layers_receipt_date_idx
  ON item_cost_layers(item_id, subsidiary_id, receipt_date);

-- Item Cost History (Audit Trail)
-- Tracks all changes to item costs for audit purposes
CREATE TABLE IF NOT EXISTS item_cost_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subsidiary_id UUID NOT NULL REFERENCES subsidiaries(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,

  -- What changed
  change_type TEXT NOT NULL,
  costing_method costing_method_enum,
  previous_cost DECIMAL(18, 4),
  new_cost DECIMAL(18, 4),
  variance_amount DECIMAL(18, 4),

  -- Context
  affected_transaction_id UUID,
  affected_transaction_type TEXT,
  cost_layer_id UUID,
  change_reason TEXT,
  notes TEXT,

  -- Quantities affected (for revaluations)
  quantity_affected DECIMAL(18, 4),
  total_value_change DECIMAL(18, 4),

  -- GL posting reference
  gl_transaction_id UUID,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX IF NOT EXISTS item_cost_history_item_idx
  ON item_cost_history(item_id);
CREATE INDEX IF NOT EXISTS item_cost_history_date_idx
  ON item_cost_history(created_at);
CREATE INDEX IF NOT EXISTS item_cost_history_change_type_idx
  ON item_cost_history(change_type);

-- Add trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ BEGIN
  CREATE TRIGGER update_organization_costing_defaults_updated_at
    BEFORE UPDATE ON organization_costing_defaults
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_subsidiary_costing_config_updated_at
    BEFORE UPDATE ON subsidiary_costing_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_item_costing_methods_updated_at
    BEFORE UPDATE ON item_costing_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_item_cost_layers_updated_at
    BEFORE UPDATE ON item_cost_layers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
