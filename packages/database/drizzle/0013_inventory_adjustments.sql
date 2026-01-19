-- Migration 0013: Inventory Adjustments and Transfers
-- Supports inventory adjustments (quantity/value changes) and transfers (location/subsidiary)

-- Create enums
DO $$ BEGIN
  CREATE TYPE adjustment_type_enum AS ENUM (
    'QUANTITY_INCREASE',
    'QUANTITY_DECREASE',
    'VALUE_REVALUATION',
    'WRITE_DOWN',
    'WRITE_OFF'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE adjustment_status_enum AS ENUM (
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'POSTED',
    'REJECTED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE transfer_type_enum AS ENUM (
    'LOCATION_TRANSFER',
    'SUBSIDIARY_TRANSFER',
    'BIN_TRANSFER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE transfer_status_enum AS ENUM (
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'IN_TRANSIT',
    'RECEIVED',
    'POSTED',
    'REJECTED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Inventory Adjustments
CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subsidiary_id UUID NOT NULL REFERENCES subsidiaries(id) ON DELETE CASCADE,

  adjustment_number TEXT NOT NULL,
  adjustment_date DATE NOT NULL,
  adjustment_type adjustment_type_enum NOT NULL,
  status adjustment_status_enum NOT NULL DEFAULT 'DRAFT',

  reason_code TEXT,
  reason TEXT,
  reference TEXT,
  notes TEXT,

  gl_transaction_id UUID,
  posted_at TIMESTAMPTZ,

  submitted_at TIMESTAMPTZ,
  submitted_by UUID,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  rejected_at TIMESTAMPTZ,
  rejected_by UUID,
  rejection_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,

  CONSTRAINT inventory_adjustments_number_unique UNIQUE (organization_id, adjustment_number)
);

CREATE INDEX IF NOT EXISTS inventory_adjustments_status_idx ON inventory_adjustments(status);
CREATE INDEX IF NOT EXISTS inventory_adjustments_date_idx ON inventory_adjustments(adjustment_date);

-- Inventory Adjustment Lines
CREATE TABLE IF NOT EXISTS inventory_adjustment_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id UUID NOT NULL REFERENCES inventory_adjustments(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,

  warehouse_id UUID,
  location_id UUID,
  bin_id UUID,
  lot_number_id UUID,
  serial_number TEXT,

  quantity_before DECIMAL(18, 4),
  quantity_adjustment DECIMAL(18, 4),
  quantity_after DECIMAL(18, 4),
  unit_of_measure TEXT,

  unit_cost_before DECIMAL(18, 4),
  unit_cost_after DECIMAL(18, 4),
  total_value_before DECIMAL(18, 4),
  total_value_after DECIMAL(18, 4),
  adjustment_value DECIMAL(18, 4),

  inventory_account_id UUID REFERENCES accounts(id),
  adjustment_account_id UUID REFERENCES accounts(id),

  costing_method TEXT,
  cost_layer_id UUID,

  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inventory_adjustment_lines_adjustment_idx ON inventory_adjustment_lines(adjustment_id);
CREATE INDEX IF NOT EXISTS inventory_adjustment_lines_item_idx ON inventory_adjustment_lines(item_id);

-- Inventory Transfers
CREATE TABLE IF NOT EXISTS inventory_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  transfer_number TEXT NOT NULL,
  transfer_date DATE NOT NULL,
  transfer_type transfer_type_enum NOT NULL,
  status transfer_status_enum NOT NULL DEFAULT 'DRAFT',

  from_subsidiary_id UUID NOT NULL REFERENCES subsidiaries(id) ON DELETE RESTRICT,
  from_warehouse_id UUID,
  from_location_id UUID,

  to_subsidiary_id UUID NOT NULL REFERENCES subsidiaries(id) ON DELETE RESTRICT,
  to_warehouse_id UUID,
  to_location_id UUID,

  is_intercompany BOOLEAN DEFAULT FALSE,
  transfer_price DECIMAL(18, 4),
  currency_code TEXT DEFAULT 'USD',

  expected_ship_date DATE,
  actual_ship_date DATE,
  expected_receive_date DATE,
  actual_receive_date DATE,
  tracking_number TEXT,
  carrier TEXT,

  reason TEXT,
  reference TEXT,
  notes TEXT,

  ship_gl_transaction_id UUID,
  receive_gl_transaction_id UUID,
  shipped_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,

  submitted_at TIMESTAMPTZ,
  submitted_by UUID,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  rejected_at TIMESTAMPTZ,
  rejected_by UUID,
  rejection_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,

  CONSTRAINT inventory_transfers_number_unique UNIQUE (organization_id, transfer_number)
);

CREATE INDEX IF NOT EXISTS inventory_transfers_status_idx ON inventory_transfers(status);
CREATE INDEX IF NOT EXISTS inventory_transfers_date_idx ON inventory_transfers(transfer_date);
CREATE INDEX IF NOT EXISTS inventory_transfers_from_subsidiary_idx ON inventory_transfers(from_subsidiary_id);
CREATE INDEX IF NOT EXISTS inventory_transfers_to_subsidiary_idx ON inventory_transfers(to_subsidiary_id);

-- Inventory Transfer Lines
CREATE TABLE IF NOT EXISTS inventory_transfer_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES inventory_transfers(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,

  from_bin_id UUID,
  to_bin_id UUID,

  lot_number_id UUID,
  serial_number TEXT,

  quantity_requested DECIMAL(18, 4) NOT NULL,
  quantity_shipped DECIMAL(18, 4),
  quantity_received DECIMAL(18, 4),
  unit_of_measure TEXT,

  unit_cost DECIMAL(18, 4),
  total_cost DECIMAL(18, 4),

  transfer_unit_price DECIMAL(18, 4),
  transfer_total_price DECIMAL(18, 4),

  from_inventory_account_id UUID REFERENCES accounts(id),
  to_inventory_account_id UUID REFERENCES accounts(id),
  transit_account_id UUID REFERENCES accounts(id),

  cost_layer_id UUID,
  new_cost_layer_id UUID,

  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inventory_transfer_lines_transfer_idx ON inventory_transfer_lines(transfer_id);
CREATE INDEX IF NOT EXISTS inventory_transfer_lines_item_idx ON inventory_transfer_lines(item_id);

-- Inventory Approval History
CREATE TABLE IF NOT EXISTS inventory_approval_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  document_type TEXT NOT NULL,
  document_id UUID NOT NULL,

  action TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,

  actor_id UUID NOT NULL,
  actor_name TEXT,

  comments TEXT,
  approval_level TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inventory_approval_history_document_idx ON inventory_approval_history(document_type, document_id);
CREATE INDEX IF NOT EXISTS inventory_approval_history_created_at_idx ON inventory_approval_history(created_at);

-- Adjustment Reason Codes
CREATE TABLE IF NOT EXISTS adjustment_reason_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  adjustment_type adjustment_type_enum,

  default_inventory_account_id UUID REFERENCES accounts(id),
  default_adjustment_account_id UUID REFERENCES accounts(id),

  requires_approval BOOLEAN DEFAULT TRUE,
  approval_threshold DECIMAL(18, 4),

  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,

  CONSTRAINT adjustment_reason_codes_unique UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS adjustment_reason_codes_active_idx ON adjustment_reason_codes(organization_id, is_active);

-- Add update triggers
DO $$ BEGIN
  CREATE TRIGGER update_inventory_adjustments_updated_at
    BEFORE UPDATE ON inventory_adjustments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_inventory_adjustment_lines_updated_at
    BEFORE UPDATE ON inventory_adjustment_lines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_inventory_transfers_updated_at
    BEFORE UPDATE ON inventory_transfers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_inventory_transfer_lines_updated_at
    BEFORE UPDATE ON inventory_transfer_lines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_adjustment_reason_codes_updated_at
    BEFORE UPDATE ON adjustment_reason_codes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
