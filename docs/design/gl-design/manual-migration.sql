-- GL System Tables Migration
-- This is a manual migration file due to Drizzle version compatibility issues

-- 1. Transaction Types Table (Global - no organization_id needed)
CREATE TABLE IF NOT EXISTS transaction_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_code TEXT NOT NULL UNIQUE,
  type_name TEXT NOT NULL,
  type_category TEXT,
  generates_gl BOOLEAN DEFAULT true NOT NULL,
  requires_approval BOOLEAN DEFAULT false NOT NULL,
  can_be_reversed BOOLEAN DEFAULT true NOT NULL,
  numbering_sequence TEXT,
  default_gl_account_id UUID,
  workflow_template JSONB,
  is_active BOOLEAN DEFAULT true NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. Payment Terms Table (Can be global or per-subsidiary)
CREATE TABLE IF NOT EXISTS payment_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subsidiary_id UUID,  -- Optional: null means global
  terms_code TEXT NOT NULL,
  terms_name TEXT NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0 NOT NULL,
  discount_days INTEGER DEFAULT 0 NOT NULL,
  net_days INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(subsidiary_id, terms_code)
);

-- 3. Tax Codes Table (Per subsidiary)
CREATE TABLE IF NOT EXISTS tax_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subsidiary_id UUID NOT NULL,
  tax_code TEXT NOT NULL,
  tax_name TEXT NOT NULL,
  tax_rate DECIMAL(8,5) NOT NULL,
  tax_account_id UUID,
  tax_agency_id UUID,
  is_active BOOLEAN DEFAULT true NOT NULL,
  effective_date DATE NOT NULL,
  expiration_date DATE,
  jurisdiction TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(subsidiary_id, tax_code)
);

-- 4. Activity Codes Table (Per subsidiary)
CREATE TABLE IF NOT EXISTS activity_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subsidiary_id UUID NOT NULL,
  activity_code TEXT NOT NULL,
  activity_name TEXT NOT NULL,
  activity_category TEXT,
  default_billing_rate DECIMAL(18,4),
  default_cost_rate DECIMAL(18,4),
  unit_of_measure TEXT DEFAULT 'HOUR',
  revenue_account_id UUID,
  cost_account_id UUID,
  description TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  requires_approval BOOLEAN DEFAULT false NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(subsidiary_id, activity_code)
);

-- 5. Business Transactions Table
CREATE TABLE IF NOT EXISTS business_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_number TEXT NOT NULL UNIQUE,
  transaction_type_id UUID NOT NULL REFERENCES transaction_types(id),
  subsidiary_id UUID NOT NULL,
  entity_id UUID,
  entity_type TEXT,
  transaction_date DATE NOT NULL,
  due_date DATE,
  terms_id UUID REFERENCES payment_terms(id),
  currency_code TEXT NOT NULL,
  exchange_rate DECIMAL(12,6) DEFAULT 1 NOT NULL,
  subtotal_amount DECIMAL(18,4) DEFAULT 0 NOT NULL,
  tax_amount DECIMAL(18,4) DEFAULT 0 NOT NULL,
  discount_amount DECIMAL(18,4) DEFAULT 0 NOT NULL,
  total_amount DECIMAL(18,4) NOT NULL,
  base_total_amount DECIMAL(18,4) NOT NULL,
  memo TEXT,
  external_reference TEXT,
  status TEXT NOT NULL,
  workflow_status TEXT,
  ship_date DATE,
  shipped_via TEXT,
  tracking_number TEXT,
  billing_address_id UUID,
  shipping_address_id UUID,
  sales_rep_id UUID,
  department_id UUID,
  class_id UUID,
  location_id UUID,
  project_id UUID,
  
  -- Opportunity/Estimate specific fields
  sales_stage TEXT,
  probability DECIMAL(5,2),
  expected_close_date DATE,
  lead_source TEXT,
  competitor TEXT,
  estimate_valid_until DATE,
  
  -- Project tracking
  estimated_hours DECIMAL(10,2),
  markup_percent DECIMAL(5,2),
  margin_percent DECIMAL(5,2),
  
  -- Relationships
  parent_transaction_id UUID REFERENCES business_transactions(id),
  root_transaction_id UUID REFERENCES business_transactions(id),
  gl_transaction_id UUID,
  
  -- Audit fields
  created_by UUID,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  modified_by UUID,
  modified_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  approved_by UUID,
  approved_date TIMESTAMP WITH TIME ZONE,
  posted_date TIMESTAMP WITH TIME ZONE,
  version_number INTEGER DEFAULT 1 NOT NULL
);

-- 6. Business Transaction Lines Table
CREATE TABLE IF NOT EXISTS business_transaction_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_transaction_id UUID NOT NULL REFERENCES business_transactions(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  line_type TEXT NOT NULL,
  item_id UUID,
  description TEXT NOT NULL,
  quantity DECIMAL(18,4) DEFAULT 0 NOT NULL,
  unit_of_measure TEXT,
  unit_price DECIMAL(18,4) DEFAULT 0 NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0 NOT NULL,
  discount_amount DECIMAL(18,4) DEFAULT 0 NOT NULL,
  line_amount DECIMAL(18,4) NOT NULL,
  tax_code_id UUID REFERENCES tax_codes(id),
  tax_amount DECIMAL(18,4) DEFAULT 0 NOT NULL,
  total_line_amount DECIMAL(18,4) NOT NULL,
  account_id UUID,
  class_id UUID,
  department_id UUID,
  location_id UUID,
  project_id UUID,
  job_id UUID,
  activity_code_id UUID REFERENCES activity_codes(id),
  
  -- Service/Time tracking fields
  billable_flag BOOLEAN DEFAULT true NOT NULL,
  billing_rate DECIMAL(18,4),
  hours_worked DECIMAL(10,2),
  employee_id UUID,
  work_date DATE,
  
  -- Fulfillment tracking
  parent_line_id UUID REFERENCES business_transaction_lines(id),
  quantity_received DECIMAL(18,4) DEFAULT 0 NOT NULL,
  quantity_billed DECIMAL(18,4) DEFAULT 0 NOT NULL,
  quantity_shipped DECIMAL(18,4) DEFAULT 0 NOT NULL,
  
  -- Costing
  cost_amount DECIMAL(18,4) DEFAULT 0 NOT NULL,
  margin_amount DECIMAL(18,4),
  
  -- Inventory tracking
  serial_numbers JSONB,
  lot_numbers JSONB,
  
  -- Estimates
  estimated_hours DECIMAL(10,2),
  hourly_rate DECIMAL(18,4),
  cost_estimate DECIMAL(18,4),
  
  notes TEXT,
  custom_fields JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 7. Transaction Relationships Table
CREATE TABLE IF NOT EXISTS transaction_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_transaction_id UUID NOT NULL REFERENCES business_transactions(id),
  child_transaction_id UUID NOT NULL REFERENCES business_transactions(id),
  relationship_type TEXT NOT NULL,
  applied_amount DECIMAL(18,4),
  parent_line_id UUID REFERENCES business_transaction_lines(id),
  child_line_id UUID REFERENCES business_transaction_lines(id),
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  notes TEXT
);

-- 8. Accounting Periods Table
CREATE TABLE IF NOT EXISTS accounting_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subsidiary_id UUID NOT NULL,
  period_name TEXT NOT NULL,
  fiscal_year TEXT NOT NULL,
  period_number INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  period_type TEXT NOT NULL,
  status TEXT NOT NULL,
  closed_by UUID,
  closed_date TIMESTAMP WITH TIME ZONE,
  is_adjustment_period BOOLEAN DEFAULT false NOT NULL,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 9. GL Transactions Table
CREATE TABLE IF NOT EXISTS gl_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_number TEXT NOT NULL UNIQUE,
  subsidiary_id UUID NOT NULL,
  transaction_date DATE NOT NULL,
  posting_date DATE NOT NULL,
  period_id UUID NOT NULL REFERENCES accounting_periods(id),
  transaction_type TEXT NOT NULL,
  source_system TEXT,
  source_transaction_id UUID REFERENCES business_transactions(id),
  source_transaction_type TEXT,
  description TEXT,
  reference_number TEXT,
  base_currency_code TEXT NOT NULL,
  total_debit_amount DECIMAL(18,4) NOT NULL,
  total_credit_amount DECIMAL(18,4) NOT NULL,
  status TEXT NOT NULL,
  recurring_template_id UUID,
  reversed_by_transaction_id UUID REFERENCES gl_transactions(id),
  reversal_reason TEXT,
  auto_generated BOOLEAN DEFAULT false NOT NULL,
  
  -- Audit fields
  created_by UUID,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  modified_by UUID,
  modified_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  posted_by UUID,
  posted_date TIMESTAMP WITH TIME ZONE,
  version_number INTEGER DEFAULT 1 NOT NULL
);

-- 10. GL Transaction Lines Table
CREATE TABLE IF NOT EXISTS gl_transaction_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES gl_transactions(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  account_id UUID NOT NULL,
  class_id UUID,
  department_id UUID,
  location_id UUID,
  subsidiary_id UUID NOT NULL,
  debit_amount DECIMAL(18,4) DEFAULT 0 NOT NULL,
  credit_amount DECIMAL(18,4) DEFAULT 0 NOT NULL,
  currency_code TEXT NOT NULL,
  exchange_rate DECIMAL(12,6) DEFAULT 1 NOT NULL,
  base_debit_amount DECIMAL(18,4) DEFAULT 0 NOT NULL,
  base_credit_amount DECIMAL(18,4) DEFAULT 0 NOT NULL,
  description TEXT,
  reference_1 TEXT,
  reference_2 TEXT,
  project_id UUID,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT chk_debit_credit CHECK ((debit_amount > 0 AND credit_amount = 0) OR (credit_amount > 0 AND debit_amount = 0))
);

-- 11. GL Posting Rules Table
CREATE TABLE IF NOT EXISTS gl_posting_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type_id UUID NOT NULL REFERENCES transaction_types(id),
  subsidiary_id UUID,
  rule_name TEXT NOT NULL,
  sequence_number INTEGER DEFAULT 10 NOT NULL,
  line_type TEXT,
  condition_sql TEXT,
  debit_account_id UUID,
  credit_account_id UUID,
  amount_formula TEXT,
  description_template TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  effective_date DATE NOT NULL,
  expiration_date DATE,
  created_by UUID,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  modified_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 12. GL Account Balances Table
CREATE TABLE IF NOT EXISTS gl_account_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  subsidiary_id UUID NOT NULL,
  period_id UUID NOT NULL REFERENCES accounting_periods(id),
  class_id UUID,
  department_id UUID,
  location_id UUID,
  currency_code TEXT NOT NULL,
  beginning_balance_debit DECIMAL(18,4) DEFAULT 0 NOT NULL,
  beginning_balance_credit DECIMAL(18,4) DEFAULT 0 NOT NULL,
  period_debit_amount DECIMAL(18,4) DEFAULT 0 NOT NULL,
  period_credit_amount DECIMAL(18,4) DEFAULT 0 NOT NULL,
  ending_balance_debit DECIMAL(18,4) DEFAULT 0 NOT NULL,
  ending_balance_credit DECIMAL(18,4) DEFAULT 0 NOT NULL,
  ytd_debit_amount DECIMAL(18,4) DEFAULT 0 NOT NULL,
  ytd_credit_amount DECIMAL(18,4) DEFAULT 0 NOT NULL,
  base_beginning_balance_debit DECIMAL(18,4) DEFAULT 0 NOT NULL,
  base_beginning_balance_credit DECIMAL(18,4) DEFAULT 0 NOT NULL,
  base_period_debit_amount DECIMAL(18,4) DEFAULT 0 NOT NULL,
  base_period_credit_amount DECIMAL(18,4) DEFAULT 0 NOT NULL,
  base_ending_balance_debit DECIMAL(18,4) DEFAULT 0 NOT NULL,
  base_ending_balance_credit DECIMAL(18,4) DEFAULT 0 NOT NULL,
  base_ytd_debit_amount DECIMAL(18,4) DEFAULT 0 NOT NULL,
  base_ytd_credit_amount DECIMAL(18,4) DEFAULT 0 NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 13. Exchange Rates Table
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate_date DATE NOT NULL,
  rate_type TEXT NOT NULL,
  exchange_rate DECIMAL(12,6) NOT NULL,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 14. GL Audit Trail Table
CREATE TABLE IF NOT EXISTS gl_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  user_id UUID NOT NULL,
  session_id TEXT,
  ip_address TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- RLS Tables

-- 15. Roles Table
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT NOT NULL UNIQUE,
  role_description TEXT,
  is_system_role BOOLEAN DEFAULT false NOT NULL
);

-- 16. Permissions Table
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_name TEXT NOT NULL UNIQUE,
  resource_type TEXT,
  action TEXT,
  description TEXT
);

-- 17. Role Permissions Table
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id),
  permission_id UUID NOT NULL REFERENCES permissions(id),
  PRIMARY KEY (role_id, permission_id)
);

-- 18. User Roles Table
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL,
  role_id UUID NOT NULL REFERENCES roles(id),
  subsidiary_id UUID,
  granted_by UUID,
  granted_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  expires_date TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (user_id, role_id, subsidiary_id)
);

-- 19. User Subsidiary Access Table
CREATE TABLE IF NOT EXISTS user_subsidiary_access (
  user_id UUID NOT NULL,
  subsidiary_id UUID NOT NULL,
  access_level TEXT DEFAULT 'READ' NOT NULL,
  granted_by UUID,
  granted_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, subsidiary_id)
);

-- Create Indexes
CREATE INDEX idx_business_trans_type_date ON business_transactions(transaction_type_id, transaction_date);
CREATE INDEX idx_business_trans_entity ON business_transactions(entity_id, entity_type, status);
CREATE INDEX idx_business_trans_subsidiary ON business_transactions(subsidiary_id, transaction_date);
CREATE INDEX idx_trans_rel_parent ON transaction_relationships(parent_transaction_id);
CREATE INDEX idx_trans_rel_child ON transaction_relationships(child_transaction_id);
CREATE INDEX idx_gl_trans_date_sub ON gl_transactions(transaction_date, subsidiary_id);
CREATE INDEX idx_gl_trans_period ON gl_transactions(period_id, status);
CREATE INDEX idx_gl_lines_account ON gl_transaction_lines(account_id, transaction_id);
CREATE INDEX idx_balance_account_period ON gl_account_balances(account_id, period_id);
CREATE INDEX idx_balance_sub_period ON gl_account_balances(subsidiary_id, period_id);
CREATE INDEX idx_tax_codes_sub_code ON tax_codes(subsidiary_id, tax_code);
CREATE INDEX idx_activity_codes_sub_code ON activity_codes(subsidiary_id, activity_code);

-- Add update timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_transaction_types_updated_at BEFORE UPDATE ON transaction_types 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tax_codes_updated_at BEFORE UPDATE ON tax_codes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_activity_codes_updated_at BEFORE UPDATE ON activity_codes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_business_transactions_updated_at BEFORE UPDATE ON business_transactions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_business_transaction_lines_updated_at BEFORE UPDATE ON business_transaction_lines 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_gl_transactions_updated_at BEFORE UPDATE ON gl_transactions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_gl_posting_rules_updated_at BEFORE UPDATE ON gl_posting_rules 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();