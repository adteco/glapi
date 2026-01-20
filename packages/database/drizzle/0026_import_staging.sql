-- Migration: Import Staging Tables
-- Description: Add staging tables for data import/migration operations
-- Date: 2026-01-20

-- ============================================================================
-- Enums
-- ============================================================================

-- Import batch status
CREATE TYPE import_batch_status AS ENUM (
  'pending',
  'validating',
  'validated',
  'processing',
  'completed',
  'failed',
  'rolled_back',
  'cancelled'
);

-- Import record status
CREATE TYPE import_record_status AS ENUM (
  'pending',
  'valid',
  'invalid',
  'imported',
  'skipped',
  'failed'
);

-- Import data type
CREATE TYPE import_data_type AS ENUM (
  'account',
  'customer',
  'vendor',
  'employee',
  'item',
  'department',
  'class',
  'location',
  'project',
  'cost_code',
  'subsidiary',
  'journal_entry',
  'invoice',
  'bill',
  'payment',
  'bill_payment',
  'opening_balance',
  'budget',
  'time_entry',
  'expense_entry'
);

-- Import source system
CREATE TYPE import_source_system AS ENUM (
  'quickbooks_online',
  'quickbooks_desktop',
  'xero',
  'sage',
  'netsuite',
  'dynamics',
  'freshbooks',
  'wave',
  'csv',
  'excel',
  'json',
  'other'
);

-- ============================================================================
-- Import Batches Table
-- ============================================================================

CREATE TABLE import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id),

  -- Batch identification
  batch_number TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- Source information
  source_system import_source_system NOT NULL,
  source_file TEXT,
  source_file_hash TEXT,

  -- Data types being imported
  data_types import_data_type[] NOT NULL,

  -- Status
  status import_batch_status NOT NULL DEFAULT 'pending',

  -- Statistics
  total_records INTEGER NOT NULL DEFAULT 0,
  valid_records INTEGER NOT NULL DEFAULT 0,
  invalid_records INTEGER NOT NULL DEFAULT 0,
  imported_records INTEGER NOT NULL DEFAULT 0,
  skipped_records INTEGER NOT NULL DEFAULT 0,
  failed_records INTEGER NOT NULL DEFAULT 0,

  -- Timing
  validation_started_at TIMESTAMPTZ,
  validation_completed_at TIMESTAMPTZ,
  import_started_at TIMESTAMPTZ,
  import_completed_at TIMESTAMPTZ,

  -- Rollback support
  can_rollback BOOLEAN NOT NULL DEFAULT TRUE,
  rolled_back_at TIMESTAMPTZ,
  rolled_back_by TEXT,

  -- Configuration and errors
  options JSONB,
  error_summary JSONB,

  -- Audit
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT import_batches_org_batch_unique UNIQUE (organization_id, batch_number)
);

-- Indexes
CREATE INDEX import_batches_status_idx ON import_batches(status);
CREATE INDEX import_batches_created_at_idx ON import_batches(created_at);
CREATE INDEX import_batches_org_idx ON import_batches(organization_id);

-- ============================================================================
-- Import Records Table
-- ============================================================================

CREATE TABLE import_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,

  -- Record identification
  row_number INTEGER NOT NULL,
  external_id TEXT,

  -- Data type
  data_type import_data_type NOT NULL,

  -- Data
  raw_data JSONB NOT NULL,
  mapped_data JSONB,

  -- Status
  status import_record_status NOT NULL DEFAULT 'pending',

  -- Validation
  validation_errors JSONB,
  validation_warnings JSONB,

  -- Import results
  imported_entity_id UUID,
  imported_entity_type TEXT,
  import_error TEXT,

  -- Duplicate detection
  is_duplicate BOOLEAN NOT NULL DEFAULT FALSE,
  duplicate_of_id UUID,

  -- Timestamps
  validated_at TIMESTAMPTZ,
  imported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT import_records_batch_row_unique UNIQUE (batch_id, row_number)
);

-- Indexes
CREATE INDEX import_records_batch_status_idx ON import_records(batch_id, status);
CREATE INDEX import_records_external_id_idx ON import_records(batch_id, external_id);
CREATE INDEX import_records_data_type_idx ON import_records(data_type);

-- ============================================================================
-- Import Field Mappings Table
-- ============================================================================

CREATE TABLE import_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id),

  -- Mapping identification
  name TEXT NOT NULL,
  description TEXT,

  -- Source/target configuration
  source_system import_source_system NOT NULL,
  data_type import_data_type NOT NULL,

  -- Mappings and transformations
  mappings JSONB NOT NULL,
  transformations JSONB,
  defaults JSONB,

  -- Status
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX import_field_mappings_org_source_type_idx
  ON import_field_mappings(organization_id, source_system, data_type);

-- ============================================================================
-- Import Templates Table
-- ============================================================================

CREATE TABLE import_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT,

  -- Template identification
  name TEXT NOT NULL,
  description TEXT,

  -- Configuration
  source_system import_source_system NOT NULL,
  data_types import_data_type[] NOT NULL,

  -- Template options
  options JSONB,
  validation_rules JSONB,

  -- Status
  is_system_template BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT import_templates_org_name_unique UNIQUE (organization_id, name)
);

-- ============================================================================
-- Import Audit Logs Table
-- ============================================================================

CREATE TABLE import_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES import_batches(id) ON DELETE CASCADE,
  record_id UUID REFERENCES import_records(id) ON DELETE CASCADE,

  -- Action
  action TEXT NOT NULL,

  -- Details
  details JSONB,
  before_state JSONB,
  after_state JSONB,

  -- Error info
  error_message TEXT,
  error_stack TEXT,

  -- Audit
  performed_by TEXT NOT NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX import_audit_logs_batch_idx ON import_audit_logs(batch_id);
CREATE INDEX import_audit_logs_record_idx ON import_audit_logs(record_id);
CREATE INDEX import_audit_logs_action_idx ON import_audit_logs(action);
CREATE INDEX import_audit_logs_performed_at_idx ON import_audit_logs(performed_at);

-- ============================================================================
-- Insert System Templates
-- ============================================================================

INSERT INTO import_templates (name, description, source_system, data_types, options, is_system_template, is_active) VALUES
  -- QuickBooks Online templates
  ('QuickBooks Online - Chart of Accounts', 'Import chart of accounts from QuickBooks Online', 'quickbooks_online', ARRAY['account']::import_data_type[], '{"skipDuplicates": true}', TRUE, TRUE),
  ('QuickBooks Online - Customers', 'Import customers from QuickBooks Online', 'quickbooks_online', ARRAY['customer']::import_data_type[], '{"skipDuplicates": true}', TRUE, TRUE),
  ('QuickBooks Online - Vendors', 'Import vendors from QuickBooks Online', 'quickbooks_online', ARRAY['vendor']::import_data_type[], '{"skipDuplicates": true}', TRUE, TRUE),
  ('QuickBooks Online - Full Migration', 'Full data migration from QuickBooks Online', 'quickbooks_online', ARRAY['account', 'customer', 'vendor', 'item', 'journal_entry', 'invoice', 'payment']::import_data_type[], '{"skipDuplicates": true, "enableRollback": true}', TRUE, TRUE),

  -- Xero templates
  ('Xero - Chart of Accounts', 'Import chart of accounts from Xero', 'xero', ARRAY['account']::import_data_type[], '{"skipDuplicates": true}', TRUE, TRUE),
  ('Xero - Contacts', 'Import contacts from Xero', 'xero', ARRAY['customer', 'vendor']::import_data_type[], '{"skipDuplicates": true}', TRUE, TRUE),

  -- CSV templates
  ('CSV - Chart of Accounts', 'Import chart of accounts from CSV', 'csv', ARRAY['account']::import_data_type[], '{"headerRow": 1, "dataStartRow": 2}', TRUE, TRUE),
  ('CSV - Customers', 'Import customers from CSV', 'csv', ARRAY['customer']::import_data_type[], '{"headerRow": 1, "dataStartRow": 2}', TRUE, TRUE),
  ('CSV - Vendors', 'Import vendors from CSV', 'csv', ARRAY['vendor']::import_data_type[], '{"headerRow": 1, "dataStartRow": 2}', TRUE, TRUE),
  ('CSV - Journal Entries', 'Import journal entries from CSV', 'csv', ARRAY['journal_entry']::import_data_type[], '{"headerRow": 1, "dataStartRow": 2}', TRUE, TRUE),
  ('CSV - Opening Balances', 'Import opening balances from CSV', 'csv', ARRAY['opening_balance']::import_data_type[], '{"headerRow": 1, "dataStartRow": 2}', TRUE, TRUE);

-- ============================================================================
-- Updated At Trigger
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_import_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables
CREATE TRIGGER import_batches_updated_at
  BEFORE UPDATE ON import_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_import_updated_at();

CREATE TRIGGER import_field_mappings_updated_at
  BEFORE UPDATE ON import_field_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_import_updated_at();

CREATE TRIGGER import_templates_updated_at
  BEFORE UPDATE ON import_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_import_updated_at();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE import_batches IS 'Tracks import/migration batch operations';
COMMENT ON TABLE import_records IS 'Staging table for individual import records';
COMMENT ON TABLE import_field_mappings IS 'Stores field mappings for different source systems';
COMMENT ON TABLE import_templates IS 'Predefined import templates';
COMMENT ON TABLE import_audit_logs IS 'Audit trail for import operations';
