-- Invoice foundation
--
-- These tables have long existed in the Drizzle schema, but no forward SQL
-- migration created them. Later billing migrations (0019, 0070, and 0074)
-- reference them, so existing databases cannot be advanced without this
-- idempotent bridge migration.

DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM (
    'draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled', 'void'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM (
    'pending', 'completed', 'failed', 'refunded', 'partial_refund'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM (
    'credit_card', 'debit_card', 'ach', 'wire', 'check', 'cash', 'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  invoice_number VARCHAR(100) NOT NULL,
  entity_id UUID NOT NULL REFERENCES entities(id),
  subscription_id UUID REFERENCES subscriptions(id),
  sales_order_id UUID,
  invoice_date DATE NOT NULL,
  due_date DATE,
  billing_period_start DATE,
  billing_period_end DATE,
  subtotal NUMERIC(12, 2) NOT NULL,
  tax_amount NUMERIC(10, 2) DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL,
  status invoice_status NOT NULL DEFAULT 'draft',
  payment_link_url VARCHAR(2048),
  stripe_checkout_session_id VARCHAR(255),
  stripe_payment_intent_id VARCHAR(255),
  sent_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_stripe_checkout_session_id_idx
  ON invoices(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS invoices_stripe_payment_intent_id_idx
  ON invoices(stripe_payment_intent_id);

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  subscription_item_id UUID REFERENCES subscription_items(id),
  item_id UUID REFERENCES items(id),
  description TEXT,
  quantity NUMERIC(10, 4) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  invoice_id UUID REFERENCES invoices(id),
  payment_date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  payment_method payment_method,
  transaction_reference VARCHAR(255),
  status payment_status NOT NULL DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
